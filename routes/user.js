const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Update user profile
router.put('/profile', auth, [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
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

    const { username, avatar } = req.body;
    const updateFields = {};

    if (username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: req.userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      
      updateFields.username = username;
    }

    if (avatar !== undefined) {
      updateFields.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateFields,
      { new: true }
    ).populate('joinedRooms', 'name description isPrivate');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: user.getPublicProfile() }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
});

// Update user preferences
router.put('/preferences', auth, [
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  body('notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notifications preference must be boolean'),
  body('notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notifications preference must be boolean'),
  body('notifications.emotionAlerts')
    .optional()
    .isBoolean()
    .withMessage('Emotion alerts preference must be boolean'),
  body('privacy.shareEmotions')
    .optional()
    .isBoolean()
    .withMessage('Share emotions preference must be boolean'),
  body('privacy.showOnlineStatus')
    .optional()
    .isBoolean()
    .withMessage('Show online status preference must be boolean')
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

    const { language, notifications, privacy } = req.body;
    const updateFields = {};

    if (language) {
      updateFields['preferences.language'] = language;
    }

    if (notifications) {
      if (notifications.push !== undefined) {
        updateFields['preferences.notifications.push'] = notifications.push;
      }
      if (notifications.email !== undefined) {
        updateFields['preferences.notifications.email'] = notifications.email;
      }
      if (notifications.emotionAlerts !== undefined) {
        updateFields['preferences.notifications.emotionAlerts'] = notifications.emotionAlerts;
      }
    }

    if (privacy) {
      if (privacy.shareEmotions !== undefined) {
        updateFields['preferences.privacy.shareEmotions'] = privacy.shareEmotions;
      }
      if (privacy.showOnlineStatus !== undefined) {
        updateFields['preferences.privacy.showOnlineStatus'] = privacy.showOnlineStatus;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateFields,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating preferences'
    });
  }
});

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q: query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    if (query.length < 1 || query.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be 1-50 characters'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = new RegExp(query, 'i');
    
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { email: searchRegex }
      ],
      _id: { $ne: req.userId }
    })
    .select('username avatar isOnline lastSeen')
    .skip(skip)
    .limit(limitNum);

    const total = await User.countDocuments({
      $or: [
        { username: searchRegex },
        { email: searchRegex }
      ],
      _id: { $ne: req.userId }
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching users'
    });
  }
});

// Get user by ID
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('username avatar isOnline lastSeen emotionalProfile preferences.privacy');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Filter sensitive information based on privacy settings
    const userData = {
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      isOnline: user.preferences.privacy.showOnlineStatus ? user.isOnline : false,
      lastSeen: user.preferences.privacy.showOnlineStatus ? user.lastSeen : null
    };

    // Only include emotional profile if user allows emotion sharing
    if (user.preferences.privacy.shareEmotions) {
      userData.emotionalProfile = {
        dominantEmotion: user.emotionalProfile.dominantEmotion,
        averageSentiment: user.emotionalProfile.averageSentiment
      };
    }

    res.json({
      success: true,
      data: { user: userData }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user'
    });
  }
});

// Update online status
router.put('/status', auth, [
  body('isOnline')
    .isBoolean()
    .withMessage('Online status must be boolean')
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

    const { isOnline } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        isOnline,
        lastSeen: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: { 
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating status'
    });
  }
});

// Get user statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('emotionalProfile createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate account age
    const accountAge = Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24));

    // Get emotion history statistics
    const emotionHistory = user.emotionalProfile.emotionHistory;
    const totalEmotions = emotionHistory.length;

    const emotionCounts = emotionHistory.reduce((acc, entry) => {
      acc[entry.emotion] = (acc[entry.emotion] || 0) + 1;
      return acc;
    }, {});

    // Calculate recent activity (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEmotions = emotionHistory.filter(entry => entry.timestamp >= weekAgo);

    res.json({
      success: true,
      data: {
        accountAge: `${accountAge} days`,
        emotionalProfile: {
          dominantEmotion: user.emotionalProfile.dominantEmotion,
          averageSentiment: user.emotionalProfile.averageSentiment,
          totalAnalyzedMessages: totalEmotions,
          emotionDistribution: emotionCounts,
          recentActivity: {
            period: '7 days',
            emotionsAnalyzed: recentEmotions.length
          }
        }
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user statistics'
    });
  }
});

module.exports = router;
