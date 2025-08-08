const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  avatar: {
    type: String,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  provider: {
    type: String,
    enum: ['password', 'google.com', 'facebook.com', 'github.com', 'twitter.com', 'phone'],
    default: 'password'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  emotionalProfile: {
    dominantEmotion: {
      type: String,
      default: 'neutral'
    },
    emotionHistory: [{
      emotion: String,
      confidence: Number,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    averageSentiment: {
      type: Number,
      default: 0,
      min: -1,
      max: 1
    }
  },
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      push: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: true
      },
      emotionAlerts: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      shareEmotions: {
        type: Boolean,
        default: true
      },
      showOnlineStatus: {
        type: Boolean,
        default: true
      }
    }
  },
  fcmTokens: [{
    token: {
      type: String,
      required: true
    },
    deviceType: {
      type: String,
      enum: ['web', 'android', 'ios'],
      default: 'web'
    },
    deviceId: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  // Legacy field - kept for compatibility
  fcmToken: {
    type: String,
    default: null
  },
  customClaims: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  isDisabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

userSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

// FCM Token Management Methods
userSchema.methods.addFCMToken = function(token, deviceType = 'web', deviceId = null) {
  // Remove existing token if it exists
  this.fcmTokens = this.fcmTokens.filter(t => t.token !== token);
  
  // Add new token
  this.fcmTokens.push({
    token,
    deviceType,
    deviceId,
    isActive: true,
    lastUsed: new Date()
  });
  
  // Keep only last 5 tokens per user
  if (this.fcmTokens.length > 5) {
    this.fcmTokens = this.fcmTokens.slice(-5);
  }
  
  return this.save();
};

userSchema.methods.removeFCMToken = function(token) {
  this.fcmTokens = this.fcmTokens.filter(t => t.token !== token);
  return this.save();
};

userSchema.methods.getActiveFCMTokens = function() {
  return this.fcmTokens
    .filter(t => t.isActive)
    .map(t => t.token);
};

userSchema.methods.updateFCMTokenActivity = function(token) {
  const tokenObj = this.fcmTokens.find(t => t.token === token);
  if (tokenObj) {
    tokenObj.lastUsed = new Date();
    tokenObj.isActive = true;
    return this.save();
  }
  return Promise.resolve(this);
};

userSchema.methods.deactivateFCMToken = function(token) {
  const tokenObj = this.fcmTokens.find(t => t.token === token);
  if (tokenObj) {
    tokenObj.isActive = false;
    return this.save();
  }
  return Promise.resolve(this);
};

userSchema.methods.addEmotionToHistory = function(emotion, confidence) {
  this.emotionalProfile.emotionHistory.push({
    emotion,
    confidence,
    timestamp: new Date()
  });
  
  // Keep only last 100 emotions
  if (this.emotionalProfile.emotionHistory.length > 100) {
    this.emotionalProfile.emotionHistory.shift();
  }
  
  return this.save();
};

// Get user profile for API responses
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    firebaseUid: this.firebaseUid,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    emailVerified: this.emailVerified,
    provider: this.provider,
    isOnline: this.preferences.privacy.showOnlineStatus ? this.isOnline : false,
    lastSeen: this.preferences.privacy.showOnlineStatus ? this.lastSeen : null,
    emotionalProfile: this.preferences.privacy.shareEmotions ? this.emotionalProfile : null,
    preferences: this.preferences,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
