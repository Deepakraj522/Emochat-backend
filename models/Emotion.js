const mongoose = require('mongoose');

const emotionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  sentimentScore: {
    type: Number,
    required: true,
    min: -1,
    max: 1
  },
  magnitude: {
    type: Number,
    required: true,
    min: 0
  },
  emotion: {
    type: String,
    enum: ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  processedBy: {
    type: String,
    enum: ['google-cloud-nlp', 'local-analysis'],
    default: 'google-cloud-nlp'
  },
  processingTime: {
    type: Number,
    default: 0
  },
  fcmNotificationSent: {
    type: Boolean,
    default: false
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
emotionSchema.index({ userId: 1, createdAt: -1 });
emotionSchema.index({ sentimentScore: 1 });
emotionSchema.index({ emotion: 1 });

// Static method to get user's recent emotions
emotionSchema.statics.getUserRecentEmotions = function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    userId: userId,
    createdAt: { $gte: startDate }
  }).sort({ createdAt: -1 });
};

// Static method to get user's emotion trends
emotionSchema.statics.getUserEmotionTrends = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$emotion',
        count: { $sum: 1 },
        averageScore: { $avg: '$sentimentScore' },
        averageMagnitude: { $avg: '$magnitude' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

module.exports = mongoose.model('Emotion', emotionSchema);
