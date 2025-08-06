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
