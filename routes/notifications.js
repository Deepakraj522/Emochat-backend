const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { 
  sendNotification, 
  sendNotificationToMultiple, 
  sendNotificationToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  validateFCMToken 
} = require('../config/firebase');

const router = express.Router();

// Register FCM token for current user
router.post('/token', auth, [
  body('token')
    .notEmpty()
    .withMessage('FCM token is required'),
  body('deviceType')
    .optional()
    .isIn(['web', 'android', 'ios'])
    .withMessage('Invalid device type'),
  body('deviceId')
    .optional()
    .isString()
    .withMessage('Device ID must be a string')
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

    const { token, deviceType = 'web', deviceId } = req.body;

    // Validate FCM token format
    if (!validateFCMToken(token)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FCM token format'
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add FCM token to user
    await user.addFCMToken(token, deviceType, deviceId);

    res.json({
      success: true,
      message: 'FCM token registered successfully',
      data: {
        tokenCount: user.fcmTokens.length,
        deviceType,
        registeredAt: new Date()
      }
    });

  } catch (error) {
    console.error('FCM token registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register FCM token'
    });
  }
});

// Remove FCM token
router.delete('/token', auth, [
  body('token')
    .notEmpty()
    .withMessage('FCM token is required')
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

    const { token } = req.body;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.removeFCMToken(token);

    res.json({
      success: true,
      message: 'FCM token removed successfully',
      data: {
        tokenCount: user.fcmTokens.length
      }
    });

  } catch (error) {
    console.error('FCM token removal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove FCM token'
    });
  }
});

// Send test notification to current user
router.post('/test', auth, [
  body('title')
    .optional()
    .isString()
    .withMessage('Title must be a string'),
  body('body')
    .optional()
    .isString()
    .withMessage('Body must be a string')
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

    const { title = 'EMOCHAT Test', body = 'This is a test notification from your EMOCHAT backend!' } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const activeTokens = user.getActiveFCMTokens();
    
    if (activeTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active FCM tokens found for user'
      });
    }

    const results = [];
    const failedTokens = [];

    // Send to each token individually to track failures
    for (const token of activeTokens) {
      try {
        const messageId = await sendNotification(
          token, 
          title, 
          body,
          {
            type: 'test',
            userId: user._id.toString()
          }
        );
        
        results.push({ token: token.substring(0, 20) + '...', success: true, messageId });
        
        // Update token activity
        await user.updateFCMTokenActivity(token);
        
      } catch (error) {
        console.error(`Failed to send to token ${token.substring(0, 20)}...`, error.message);
        results.push({ token: token.substring(0, 20) + '...', success: false, error: error.message });
        
        // Deactivate invalid tokens
        if (error.message === 'INVALID_TOKEN' || error.message === 'INVALID_TOKEN_FORMAT') {
          await user.deactivateFCMToken(token);
          failedTokens.push(token);
        }
      }
    }

    res.json({
      success: true,
      message: 'Test notifications sent',
      data: {
        totalTokens: activeTokens.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results,
        deactivatedTokens: failedTokens.length
      }
    });

  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
});

// Send notification to specific user (admin endpoint)
router.post('/send', auth, [
  body('userId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('title')
    .notEmpty()
    .withMessage('Notification title is required'),
  body('body')
    .notEmpty()
    .withMessage('Notification body is required'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object')
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

    const { userId, title, body, data = {} } = req.body;
    
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Check if user has notifications enabled
    if (!targetUser.preferences.notifications.push) {
      return res.status(400).json({
        success: false,
        message: 'User has disabled push notifications'
      });
    }

    const activeTokens = targetUser.getActiveFCMTokens();
    
    if (activeTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active FCM tokens found for target user'
      });
    }

    // Send to multiple tokens
    const response = await sendNotificationToMultiple(
      activeTokens,
      title,
      body,
      {
        ...data,
        senderId: req.userId,
        targetUserId: userId
      }
    );

    // Deactivate invalid tokens
    if (response.invalidTokens.length > 0) {
      for (const invalidToken of response.invalidTokens) {
        await targetUser.deactivateFCMToken(invalidToken);
      }
    }

    res.json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        successCount: response.successCount,
        failureCount: response.failureCount,
        deactivatedTokens: response.invalidTokens.length
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
});

// Subscribe to topic
router.post('/subscribe', auth, [
  body('topic')
    .notEmpty()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid topic name'),
  body('token')
    .optional()
    .isString()
    .withMessage('Token must be a string')
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

    const { topic, token } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let tokensToSubscribe;
    if (token) {
      tokensToSubscribe = [token];
    } else {
      tokensToSubscribe = user.getActiveFCMTokens();
    }

    if (tokensToSubscribe.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No FCM tokens available for subscription'
      });
    }

    const response = await subscribeToTopic(tokensToSubscribe, topic);

    res.json({
      success: true,
      message: `Successfully subscribed to topic: ${topic}`,
      data: {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      }
    });

  } catch (error) {
    console.error('Topic subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to topic'
    });
  }
});

// Get user's FCM tokens (admin only or own tokens)
router.get('/tokens', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const tokens = user.fcmTokens.map(token => ({
      id: token._id,
      deviceType: token.deviceType,
      deviceId: token.deviceId,
      isActive: token.isActive,
      lastUsed: token.lastUsed,
      tokenPreview: token.token.substring(0, 20) + '...' // Don't expose full token
    }));

    res.json({
      success: true,
      message: 'FCM tokens retrieved successfully',
      data: {
        tokens,
        totalTokens: tokens.length,
        activeTokens: tokens.filter(t => t.isActive).length
      }
    });

  } catch (error) {
    console.error('Get FCM tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve FCM tokens'
    });
  }
});

module.exports = router;
