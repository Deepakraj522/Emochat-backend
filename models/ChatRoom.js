const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    emotionSharing: {
      type: Boolean,
      default: true
    },
    allowEmotionAnalysis: {
      type: Boolean,
      default: true
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  emotionalContext: {
    averageSentiment: {
      type: Number,
      default: 0,
      min: -1,
      max: 1
    },
    dominantEmotion: {
      type: String,
      default: 'neutral'
    },
    emotionTrends: [{
      date: {
        type: Date,
        default: Date.now
      },
      emotions: {
        joy: { type: Number, default: 0 },
        sadness: { type: Number, default: 0 },
        anger: { type: Number, default: 0 },
        fear: { type: Number, default: 0 },
        surprise: { type: Number, default: 0 },
        disgust: { type: Number, default: 0 },
        neutral: { type: Number, default: 0 }
      },
      averageSentiment: { type: Number, default: 0 }
    }]
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ lastActivity: -1 });
chatRoomSchema.index({ type: 1, isActive: 1 });

// Update last activity
chatRoomSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Add participant
chatRoomSchema.methods.addParticipant = function(userId, role = 'member') {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      role: role,
      joinedAt: new Date(),
      lastReadAt: new Date()
    });
  }
  
  return this.save();
};

// Remove participant
chatRoomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => p.user.toString() !== userId.toString());
  return this.save();
};

// Update emotion trends
chatRoomSchema.methods.updateEmotionTrends = function(emotions, sentiment) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let todayTrend = this.emotionalContext.emotionTrends.find(trend => 
    trend.date.toDateString() === today.toDateString()
  );
  
  if (!todayTrend) {
    todayTrend = {
      date: today,
      emotions: {
        joy: 0, sadness: 0, anger: 0, fear: 0, 
        surprise: 0, disgust: 0, neutral: 0
      },
      averageSentiment: 0
    };
    this.emotionalContext.emotionTrends.push(todayTrend);
  }
  
  // Update emotions
  Object.keys(emotions).forEach(emotion => {
    if (todayTrend.emotions[emotion] !== undefined) {
      todayTrend.emotions[emotion] += emotions[emotion];
    }
  });
  
  // Update sentiment
  todayTrend.averageSentiment = (todayTrend.averageSentiment + sentiment) / 2;
  
  // Keep only last 30 days
  if (this.emotionalContext.emotionTrends.length > 30) {
    this.emotionalContext.emotionTrends.sort((a, b) => b.date - a.date);
    this.emotionalContext.emotionTrends = this.emotionalContext.emotionTrends.slice(0, 30);
  }
  
  return this.save();
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
