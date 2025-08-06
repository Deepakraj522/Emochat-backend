const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Message = require('../models/Message');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all chat rooms for the authenticated user
router.get('/rooms', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const chatRooms = await ChatRoom.find({
      'participants.user': req.userId,
      isActive: true
    })
    .populate('participants.user', 'username avatar isOnline lastSeen')
    .populate('lastMessage')
    .sort({ lastActivity: -1 })
    .skip(skip)
    .limit(limit);

    const total = await ChatRoom.countDocuments({
      'participants.user': req.userId,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        chatRooms,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving chat rooms'
    });
  }
});

// Create a new chat room
router.post('/rooms', auth, [
  body('type')
    .isIn(['private', 'group'])
    .withMessage('Type must be either private or group'),
  body('participants')
    .isArray({ min: 1 })
    .withMessage('At least one participant is required'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { type, participants, name } = req.body;

    // Add current user to participants if not already included
    const allParticipants = [...participants];
    if (!allParticipants.includes(req.userId)) {
      allParticipants.push(req.userId);
    }

    // For private chats, check if room already exists
    if (type === 'private' && allParticipants.length === 2) {
      const existingRoom = await ChatRoom.findOne({
        type: 'private',
        'participants.user': { $all: allParticipants }
      });

      if (existingRoom) {
        return res.json({
          success: true,
          message: 'Chat room already exists',
          data: { chatRoom: existingRoom }
        });
      }
    }

    // Verify all participants exist
    const users = await User.find({ _id: { $in: allParticipants } });
    if (users.length !== allParticipants.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participants not found'
      });
    }

    // Create new chat room
    const chatRoom = new ChatRoom({
      type,
      name: type === 'group' ? name : undefined,
      participants: allParticipants.map(userId => ({
        user: userId,
        role: userId === req.userId ? 'admin' : 'member'
      }))
    });

    await chatRoom.save();
    await chatRoom.populate('participants.user', 'username avatar isOnline lastSeen');

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: { chatRoom }
    });

  } catch (error) {
    console.error('Create chat room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating chat room'
    });
  }
});

// Get messages for a specific chat room
router.get('/rooms/:roomId/messages', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user has access to this chat room
    const chatRoom = await ChatRoom.findOne({
      _id: roomId,
      'participants.user': req.userId
    });

    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found or access denied'
      });
    }

    const messages = await Message.find({
      chatRoom: roomId,
      'metadata.isDeleted': false
    })
    .populate('sender', 'username avatar')
    .populate('receiver', 'username avatar')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Message.countDocuments({
      chatRoom: roomId,
      'metadata.isDeleted': false
    });

    // Mark messages as read
    await Message.updateMany({
      chatRoom: roomId,
      receiver: req.userId,
      'metadata.isRead': false
    }, {
      'metadata.isRead': true,
      'metadata.readAt': new Date(),
      'metadata.deliveryStatus': 'read'
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving messages'
    });
  }
});

// Send a new message
router.post('/rooms/:roomId/messages', auth, [
  body('content')
    .notEmpty()
    .isLength({ max: 1000 })
    .withMessage('Message content is required and must be less than 1000 characters'),
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file', 'emoji', 'voice'])
    .withMessage('Invalid message type'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid reply message ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { roomId } = req.params;
    const { content, messageType = 'text', replyTo, attachments } = req.body;

    // Verify user has access to this chat room
    const chatRoom = await ChatRoom.findOne({
      _id: roomId,
      'participants.user': req.userId
    }).populate('participants.user');

    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found or access denied'
      });
    }

    // For private chats, find the receiver
    let receiverId = null;
    if (chatRoom.type === 'private') {
      const receiver = chatRoom.participants.find(p => p.user._id.toString() !== req.userId);
      receiverId = receiver ? receiver.user._id : null;
    }

    // Create new message
    const message = new Message({
      sender: req.userId,
      receiver: receiverId,
      content,
      messageType,
      chatRoom: roomId,
      replyTo,
      attachments
    });

    await message.save();
    await message.populate(['sender', 'receiver', 'replyTo']);

    // Update chat room last activity and last message
    chatRoom.lastMessage = message._id;
    chatRoom.lastActivity = new Date();
    await chatRoom.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending message'
    });
  }
});

// Update message (edit)
router.put('/messages/:messageId', auth, [
  body('content')
    .notEmpty()
    .isLength({ max: 1000 })
    .withMessage('Message content is required and must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findOne({
      _id: messageId,
      sender: req.userId,
      'metadata.isDeleted': false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or unauthorized'
      });
    }

    // Check if message is not too old (e.g., within 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Message too old to edit'
      });
    }

    message.content = content;
    message.metadata.isEdited = true;
    message.metadata.editedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: { message }
    });

  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating message'
    });
  }
});

// Delete message
router.delete('/messages/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      sender: req.userId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or unauthorized'
      });
    }

    await message.softDelete();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting message'
    });
  }
});

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiver: req.userId,
      'metadata.isRead': false,
      'metadata.isDeleted': false
    });

    res.json({
      success: true,
      data: { unreadCount }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving unread count'
    });
  }
});

module.exports = router;
