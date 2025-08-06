const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyIdToken, getUserByUid, setCustomUserClaims, disableUser, enableUser } = require('../config/firebase');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required'
      });
    }

    const decodedToken = await verifyIdToken(idToken);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      const firebaseUser = await getUserByUid(decodedToken.uid);
      
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || firebaseUser.email,
        username: decodedToken.name || firebaseUser.displayName || `user_${decodedToken.uid.substring(0, 8)}`,
        avatar: decodedToken.picture || firebaseUser.photoURL,
        emailVerified: decodedToken.email_verified || firebaseUser.emailVerified,
        provider: decodedToken.firebase.sign_in_provider
      });
      
      await user.save();
      console.log(`🆕 New user created: ${user.email}`);
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: user.getPublicProfile(),
        firebaseData: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified,
          provider: decodedToken.firebase.sign_in_provider
        }
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.message.includes('Token verification failed')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Firebase token'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
});

// Logout user (update online status)
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile(),
        firebaseUid: req.firebaseUid
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving profile'
    });
  }
});

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
    );

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

// Update FCM token for push notifications
router.post('/fcm-token', auth, [
  body('fcmToken')
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

    const { fcmToken } = req.body;

    await User.findByIdAndUpdate(req.userId, { fcmToken });

    res.json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    console.error('FCM token update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating FCM token'
    });
  }
});

// Admin: Set custom user claims
router.post('/admin/set-claims', auth, [
  body('targetUid')
    .notEmpty()
    .withMessage('Target user UID is required'),
  body('claims')
    .isObject()
    .withMessage('Claims must be an object')
], async (req, res) => {
  try {
    // Check if current user has admin privileges
    if (!req.firebaseToken.admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { targetUid, claims } = req.body;

    await setCustomUserClaims(targetUid, claims);

    // Update our database
    await User.findOneAndUpdate(
      { firebaseUid: targetUid },
      { customClaims: claims }
    );

    res.json({
      success: true,
      message: 'Custom claims set successfully'
    });

  } catch (error) {
    console.error('Set custom claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error setting custom claims'
    });
  }
});

// Admin: Disable user
router.post('/admin/disable-user', auth, [
  body('targetUid')
    .notEmpty()
    .withMessage('Target user UID is required')
], async (req, res) => {
  try {
    // Check if current user has admin privileges
    if (!req.firebaseToken.admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const { targetUid } = req.body;

    await disableUser(targetUid);

    // Update our database
    await User.findOneAndUpdate(
      { firebaseUid: targetUid },
      { isDisabled: true, isOnline: false }
    );

    res.json({
      success: true,
      message: 'User disabled successfully'
    });

  } catch (error) {
    console.error('Disable user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error disabling user'
    });
  }
});

// Admin: Enable user
router.post('/admin/enable-user', auth, [
  body('targetUid')
    .notEmpty()
    .withMessage('Target user UID is required')
], async (req, res) => {
  try {
    // Check if current user has admin privileges
    if (!req.firebaseToken.admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const { targetUid } = req.body;

    await enableUser(targetUid);

    // Update our database
    await User.findOneAndUpdate(
      { firebaseUid: targetUid },
      { isDisabled: false }
    );

    res.json({
      success: true,
      message: 'User enabled successfully'
    });

  } catch (error) {
    console.error('Enable user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error enabling user'
    });
  }
});

module.exports = router;
