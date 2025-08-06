const { verifyIdToken, getUserByUid } = require('../config/firebase');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No valid Firebase token provided.'
      });
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Check if user exists in our database
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Get user details from Firebase
      const firebaseUser = await getUserByUid(decodedToken.uid);
      
      // Create user in our database if doesn't exist
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || firebaseUser.email,
        username: decodedToken.name || firebaseUser.displayName || `user_${decodedToken.uid.substring(0, 8)}`,
        avatar: decodedToken.picture || firebaseUser.photoURL,
        emailVerified: decodedToken.email_verified || firebaseUser.emailVerified,
        provider: decodedToken.firebase.sign_in_provider,
        createdAt: new Date(decodedToken.auth_time * 1000)
      });
      
      try {
        await user.save();
        console.log(`🆕 New user created: ${user.email}`);
      } catch (saveError) {
        if (saveError.code === 11000) {
          const field = Object.keys(saveError.keyPattern)[0];
          return res.status(400).json({
            success: false,
            message: `${field} already exists. Please use a different ${field}.`
          });
        }
        throw saveError;
      }
    } else {
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();
    }

    req.userId = user._id;
    req.firebaseUid = decodedToken.uid;
    req.user = user;
    req.firebaseToken = decodedToken;
    
    next();
  } catch (error) {
    console.error('Firebase Auth middleware error:', error);
    
    if (error.message.includes('Token verification failed')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Firebase token.'
      });
    } else if (error.message.includes('Firebase Auth not initialized')) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service temporarily unavailable.'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Server error during authentication.'
      });
    }
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await verifyIdToken(idToken);
    
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (user) {
      req.userId = user._id;
      req.firebaseUid = decodedToken.uid;
      req.user = user;
      req.firebaseToken = decodedToken;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = { auth, optionalAuth };
