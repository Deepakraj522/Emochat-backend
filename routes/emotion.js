const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Emotion = require('../models/Emotion');
const { auth, optionalAuth } = require('../middleware/auth');
const { analyzeEmotion, analyzeBatchEmotions, getEmotionStatistics } = require('../utils/emotionAPI');
const { sendNotification, sendNotificationToMultiple } = require('../config/firebase');

const router = express.Router();

// Legacy basic emotion detection (kept as fallback)
const analyzeEmotionBasic = (text) => {
  const emotions = {
    joy: ['happy', 'joy', 'excited', 'great', 'awesome', 'amazing', 'wonderful', 'fantastic', 'love', 'excellent'],
    sadness: ['sad', 'unhappy', 'depressed', 'down', 'upset', 'disappointed', 'heartbroken', 'miserable'],
    anger: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'irritated', 'rage', 'hate'],
    fear: ['scared', 'afraid', 'terrified', 'worried', 'anxious', 'nervous', 'panic'],
    surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected'],
    disgust: ['disgusted', 'sick', 'gross', 'awful', 'terrible', 'horrible']
  };

  const lowercaseText = text.toLowerCase();
  const detectedEmotions = {};
  let totalMatches = 0;

  // Count emotion keywords
  Object.keys(emotions).forEach(emotion => {
    const matches = emotions[emotion].filter(keyword => lowercaseText.includes(keyword)).length;
    detectedEmotions[emotion] = matches;
    totalMatches += matches;
  });

  // Calculate dominant emotion and confidence
  const dominantEmotion = Object.keys(detectedEmotions).reduce((a, b) => 
    detectedEmotions[a] > detectedEmotions[b] ? a : b
  );

  const confidence = totalMatches > 0 ? detectedEmotions[dominantEmotion] / totalMatches : 0;

  // Calculate sentiment score (-1 to 1)
  const positiveWords = [...emotions.joy, 'good', 'nice', 'fine', 'ok', 'yes'];
  const negativeWords = [...emotions.sadness, ...emotions.anger, ...emotions.fear, ...emotions.disgust, 'bad', 'no', 'not'];
  
  const positiveCount = positiveWords.filter(word => lowercaseText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowercaseText.includes(word)).length;
  
  const sentimentScore = positiveCount + negativeCount > 0 ? 
    (positiveCount - negativeCount) / (positiveCount + negativeCount) : 0;

  return {
    emotion: totalMatches > 0 ? dominantEmotion : 'neutral',
    confidence: confidence,
    sentiment: {
      score: sentimentScore,
      magnitude: Math.abs(sentimentScore)
    },
    processedBy: 'local-analysis'
  };
};

// Comprehensive emotion analysis with Google Cloud NLP and FCM notifications
router.post('/analyze-with-support', auth, [
  body('text')
    .notEmpty()
    .withMessage('Text is required for emotion analysis'),
  body('messageId')
    .optional()
    .isMongoId()
    .withMessage('Invalid message ID')
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

    const { text, messageId } = req.body;
    const startTime = Date.now();

    // 1. Use Google Cloud NLP API for sentiment analysis
    const analysis = await analyzeEmotion(text);
    analysis.processingTime = Date.now() - startTime;

    // 2. Parse sentiment score and magnitude (already done in analyzeEmotion)
    const { sentiment, emotion, confidence } = analysis;
    const sentimentScore = sentiment.score;
    const magnitude = sentiment.magnitude;

    // 3. Save emotion data to Emotion collection
    const emotionRecord = new Emotion({
      userId: req.userId,
      text: text,
      sentimentScore: sentimentScore,
      magnitude: magnitude,
      emotion: emotion,
      confidence: confidence,
      processedBy: analysis.processedBy || 'google-cloud-nlp',
      processingTime: analysis.processingTime,
      messageId: messageId || null
    });

    await emotionRecord.save();

    // 4. Check if emotion score is below -0.6 (very negative)
    let notificationSent = false;
    if (sentimentScore <= -0.6) {
      try {
        // 5. Get user's FCM tokens
        const user = await User.findById(req.userId);
        if (user) {
          const fcmTokens = user.getActiveFCMTokens();
          
          if (fcmTokens.length > 0) {
            // 6. Send FCM notification using Firebase Admin SDK
            const notificationTitle = "Hey, you okay?";
            const notificationBody = "We noticed you're feeling down. Remember, we're here for you! 💙";
            
            try {
              await sendNotificationToMultiple(
                fcmTokens,
                notificationTitle,
                notificationBody,
                {
                  type: 'emotional_support',
                  sentimentScore: sentimentScore.toString(),
                  emotion: emotion,
                  timestamp: new Date().toISOString()
                },
                {
                  notification: {
                    tag: 'emotional_support',
                    requireInteraction: true
                  },
                  android: {
                    notification: {
                      icon: 'ic_heart',
                      color: '#4A90E2',
                      sound: 'gentle_chime',
                      priority: 'high'
                    }
                  },
                  apns: {
                    payload: {
                      aps: {
                        sound: 'gentle_chime.wav',
                        badge: 1,
                        category: 'EMOTIONAL_SUPPORT'
                      }
                    }
                  }
                }
              );
              
              notificationSent = true;
              
              // Update emotion record to mark notification as sent
              emotionRecord.fcmNotificationSent = true;
              await emotionRecord.save();
              
              console.log(`🔔 Emotional support notification sent to user ${req.userId} (sentiment: ${sentimentScore})`);
            } catch (fcmError) {
              console.error('FCM notification error:', fcmError.message);
              // Don't fail the entire request if notification fails
            }
          }
        }
      } catch (notificationError) {
        console.error('Notification process error:', notificationError.message);
        // Continue with response even if notification fails
      }
    }

    // Update user's emotional profile
    const user = await User.findById(req.userId);
    if (user && confidence > 0.3) {
      await user.addEmotionToHistory(emotion, confidence);
      
      // Update dominant emotion if confidence is high
      if (confidence > 0.7) {
        user.emotionalProfile.dominantEmotion = emotion;
        user.emotionalProfile.averageSentiment = 
          (user.emotionalProfile.averageSentiment + sentimentScore) / 2;
        await user.save();
      }
    }

    // Update message with emotion data if messageId provided
    if (messageId) {
      const message = await Message.findOne({
        _id: messageId,
        sender: req.userId
      });

      if (message) {
        message.emotion = analysis;
        await message.save();
      }
    }

    // 7. Return sentiment analysis result as JSON
    res.json({
      success: true,
      message: 'Emotion analysis completed',
      data: {
        emotionId: emotionRecord._id,
        analysis: {
          emotion: emotion,
          confidence: confidence,
          sentiment: {
            score: sentimentScore,
            magnitude: magnitude
          },
          processedBy: analysis.processedBy,
          processingTime: analysis.processingTime
        },
        supportNotification: {
          triggered: sentimentScore <= -0.6,
          sent: notificationSent,
          threshold: -0.6
        },
        userEmotionalUpdate: {
          profileUpdated: confidence > 0.3,
          dominantEmotionUpdated: confidence > 0.7
        }
      }
    });

  } catch (error) {
    console.error('Comprehensive emotion analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during emotion analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Analyze emotion in a message using Google Cloud NLP
router.post('/analyze', auth, [
  body('text')
    .notEmpty()
    .withMessage('Text is required for emotion analysis'),
  body('messageId')
    .optional()
    .isMongoId()
    .withMessage('Invalid message ID')
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

    const { text, messageId } = req.body;
    const startTime = Date.now();

    // Perform emotion analysis using Google Cloud NLP
    const analysis = await analyzeEmotion(text);
    analysis.processingTime = Date.now() - startTime;
    analysis.text = text;

    // If messageId is provided, update the message with emotion data
    if (messageId) {
      const message = await Message.findOne({
        _id: messageId,
        sender: req.userId
      });

      if (message) {
        message.emotion = analysis;
        await message.save();

        // Update user's emotional profile
        const user = await User.findById(req.userId);
        if (user && analysis.confidence > 0.3) {
          await user.addEmotionToHistory(analysis.emotion, analysis.confidence);
          
          // Update dominant emotion if confidence is high
          if (analysis.confidence > 0.7) {
            user.emotionalProfile.dominantEmotion = analysis.emotion;
            user.emotionalProfile.averageSentiment = 
              (user.emotionalProfile.averageSentiment + analysis.sentiment.score) / 2;
            await user.save();
          }
        }

        // Update chat room emotion trends
        const chatRoom = await ChatRoom.findById(message.chatRoom);
        if (chatRoom && chatRoom.settings.allowEmotionAnalysis) {
          const emotionUpdate = { [analysis.emotion]: 1 };
          await chatRoom.updateEmotionTrends(emotionUpdate, analysis.sentiment.score);
        }
      }
    }

    res.json({
      success: true,
      message: 'Emotion analysis completed',
      data: {
        analysis: {
          emotion: analysis.emotion,
          confidence: analysis.confidence,
          sentiment: analysis.sentiment,
          processingTime: analysis.processingTime,
          processedBy: analysis.processedBy
        }
      }
    });

  } catch (error) {
    console.error('Emotion analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during emotion analysis'
    });
  }
});

// Get user's emotional profile
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).select('emotionalProfile username');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get emotions from Emotion collection for better analytics
    const totalEmotions = await Emotion.countDocuments({ userId });
    const recentEmotions = await Emotion.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('emotion sentimentScore magnitude confidence createdAt messageId roomId');

    // Calculate emotion distribution from Emotion collection
    const emotionAggregation = await Emotion.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$emotion', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const emotionDistribution = emotionAggregation.map(item => ({
      emotion: item._id,
      count: item.count,
      percentage: totalEmotions > 0 ? (item.count / totalEmotions * 100).toFixed(2) : 0
    }));

    // Calculate average sentiment
    const sentimentAgg = await Emotion.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: null, avgSentiment: { $avg: '$sentimentScore' } } }
    ]);
    const averageSentiment = sentimentAgg.length > 0 ? sentimentAgg[0].avgSentiment : 0;

    // Get dominant emotion
    const dominantEmotion = emotionDistribution.length > 0 ? emotionDistribution[0].emotion : 'neutral';

    res.json({
      success: true,
      data: {
        username: user.username,
        pagination: {
          page,
          limit,
          total: totalEmotions,
          pages: Math.ceil(totalEmotions / limit),
          hasNext: page < Math.ceil(totalEmotions / limit),
          hasPrev: page > 1
        },
        emotionalProfile: {
          dominantEmotion,
          averageSentiment: parseFloat(averageSentiment.toFixed(3)),
          emotionDistribution,
          totalAnalyzedMessages: totalEmotions,
          recentEmotions: recentEmotions.map(emotion => ({
            id: emotion._id,
            emotion: emotion.emotion,
            sentimentScore: emotion.sentimentScore,
            magnitude: emotion.magnitude,
            confidence: emotion.confidence,
            messageId: emotion.messageId,
            roomId: emotion.roomId,
            timestamp: emotion.createdAt
          }))
        }
      }
    });

  } catch (error) {
    console.error('Get emotional profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving emotional profile'
    });
  }
});

// Get user's emotional profile
router.get('/profile/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check if user is requesting someone else's profile
    if (userId !== req.userId) {
      // Verify they are in a shared chat room
      const sharedRoom = await ChatRoom.findOne({
        'participants.user': { $all: [req.userId, userId] }
      });

      if (!sharedRoom) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this user\'s emotional profile'
        });
      }
    }

    const user = await User.findById(userId).select('emotionalProfile username');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate emotion distribution from history
    const emotionCounts = user.emotionalProfile.emotionHistory.reduce((acc, entry) => {
      acc[entry.emotion] = (acc[entry.emotion] || 0) + 1;
      return acc;
    }, {});

    const totalEmotions = user.emotionalProfile.emotionHistory.length;
    const emotionDistribution = Object.keys(emotionCounts).map(emotion => ({
      emotion,
      count: emotionCounts[emotion],
      percentage: totalEmotions > 0 ? (emotionCounts[emotion] / totalEmotions * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        username: user.username,
        emotionalProfile: {
          dominantEmotion: user.emotionalProfile.dominantEmotion,
          averageSentiment: user.emotionalProfile.averageSentiment,
          emotionDistribution,
          totalAnalyzedMessages: totalEmotions,
          recentEmotions: user.emotionalProfile.emotionHistory.slice(-10).reverse()
        }
      }
    });

  } catch (error) {
    console.error('Get emotional profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving emotional profile'
    });
  }
});

// Get chat room emotion trends
router.get('/trends/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const days = parseInt(req.query.days) || 7;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Verify user has access to this chat room
    const chatRoom = await ChatRoom.findOne({
      _id: roomId,
      $or: [
        { participants: req.userId },
        { createdBy: req.userId }
      ]
    });

    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found or access denied'
      });
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total count for pagination
    const totalEmotions = await Emotion.countDocuments({
      roomId: roomId,
      createdAt: { $gte: startDate }
    });

    // Get emotions from this room with pagination
    const roomEmotions = await Emotion.find({
      roomId: roomId,
      createdAt: { $gte: startDate }
    })
    .populate('userId', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('emotion sentimentScore magnitude confidence userId createdAt messageId');

    // Get aggregated trends (not paginated as it's summary data)
    const emotionTrends = await Emotion.aggregate([
      {
        $match: {
          roomId: roomId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            emotion: "$emotion"
          },
          count: { $sum: 1 },
          avgSentiment: { $avg: "$sentimentScore" }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          emotions: {
            $push: {
              emotion: "$_id.emotion",
              count: "$count",
              avgSentiment: "$avgSentiment"
            }
          },
          totalMessages: { $sum: "$count" },
          dailyAvgSentiment: { $avg: "$avgSentiment" }
        }
      },
      { $sort: { "_id": -1 } }
    ]);

    // Calculate room-wide statistics
    const roomStats = await Emotion.aggregate([
      {
        $match: {
          roomId: roomId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          averageSentiment: { $avg: "$sentimentScore" },
          emotionCounts: {
            $push: "$emotion"
          }
        }
      }
    ]);

    // Get dominant emotion
    let dominantEmotion = 'neutral';
    if (roomStats.length > 0) {
      const emotionFreq = {};
      roomStats[0].emotionCounts.forEach(emotion => {
        emotionFreq[emotion] = (emotionFreq[emotion] || 0) + 1;
      });
      dominantEmotion = Object.keys(emotionFreq).reduce((a, b) => 
        emotionFreq[a] > emotionFreq[b] ? a : b, 'neutral');
    }

    res.json({
      success: true,
      data: {
        roomId: chatRoom._id,
        roomName: chatRoom.name,
        pagination: {
          page,
          limit,
          total: totalEmotions,
          pages: Math.ceil(totalEmotions / limit),
          hasNext: page < Math.ceil(totalEmotions / limit),
          hasPrev: page > 1
        },
        currentContext: {
          averageSentiment: roomStats.length > 0 ? 
            parseFloat(roomStats[0].averageSentiment.toFixed(3)) : 0,
          dominantEmotion
        },
        dailyTrends: emotionTrends,
        recentEmotions: roomEmotions.map(emotion => ({
          id: emotion._id,
          emotion: emotion.emotion,
          sentimentScore: emotion.sentimentScore,
          magnitude: emotion.magnitude,
          confidence: emotion.confidence,
          messageId: emotion.messageId,
          user: {
            id: emotion.userId._id,
            username: emotion.userId.username,
            avatar: emotion.userId.avatar
          },
          timestamp: emotion.createdAt
        })),
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Get emotion trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving emotion trends'
    });
  }
});

// Get emotion statistics for a specific time period
router.get('/stats', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get user's messages with emotions from the specified period
    const messages = await Message.find({
      sender: req.userId,
      createdAt: { $gte: cutoffDate },
      'emotion.confidence': { $gt: 0.3 },
      'metadata.isDeleted': false
    }).select('emotion createdAt');

    // Calculate statistics
    const emotionCounts = {};
    let totalSentiment = 0;
    let sentimentCount = 0;

    messages.forEach(message => {
      const emotion = message.emotion.detected;
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      
      if (message.emotion.sentiment && message.emotion.sentiment.score !== undefined) {
        totalSentiment += message.emotion.sentiment.score;
        sentimentCount++;
      }
    });

    const averageSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => 
      emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral'
    );

    // Group by date for trend analysis
    const dailyStats = {};
    messages.forEach(message => {
      const date = message.createdAt.toDateString();
      if (!dailyStats[date]) {
        dailyStats[date] = { emotions: {}, sentimentSum: 0, sentimentCount: 0 };
      }
      
      const emotion = message.emotion.detected;
      dailyStats[date].emotions[emotion] = (dailyStats[date].emotions[emotion] || 0) + 1;
      
      if (message.emotion.sentiment && message.emotion.sentiment.score !== undefined) {
        dailyStats[date].sentimentSum += message.emotion.sentiment.score;
        dailyStats[date].sentimentCount++;
      }
    });

    const dailyTrends = Object.keys(dailyStats).map(date => ({
      date,
      emotions: dailyStats[date].emotions,
      averageSentiment: dailyStats[date].sentimentCount > 0 ? 
        dailyStats[date].sentimentSum / dailyStats[date].sentimentCount : 0
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        totalMessages: messages.length,
        emotionDistribution: emotionCounts,
        dominantEmotion,
        averageSentiment,
        dailyTrends
      }
    });

  } catch (error) {
    console.error('Get emotion stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving emotion statistics'
    });
  }
});

// Get emotion analysis for a specific message
router.get('/message/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Find the message and check if user has access
    const message = await Message.findById(messageId)
      .populate('sender', 'username avatar')
      .populate('chatRoom', 'name type');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has access to this message (must be sender, receiver, or room member)
    const hasAccess = message.sender._id.toString() === req.userId ||
                     message.receiver?.toString() === req.userId ||
                     (message.chatRoom && await ChatRoom.findOne({
                       _id: message.chatRoom._id,
                       $or: [
                         { participants: req.userId },
                         { createdBy: req.userId }
                       ]
                     }));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
      });
    }

    // Get emotion data from Emotion collection for additional analytics
    const emotionAnalytics = await Emotion.findOne({ messageId: message._id });

    const response = {
      messageId: message._id,
      content: message.content,
      sender: {
        id: message.sender._id,
        username: message.sender.username,
        avatar: message.sender.avatar
      },
      timestamp: message.createdAt,
      emotion: message.emotion || null,
      analytics: emotionAnalytics ? {
        id: emotionAnalytics._id,
        emotion: emotionAnalytics.emotion,
        sentimentScore: emotionAnalytics.sentimentScore,
        magnitude: emotionAnalytics.magnitude,
        confidence: emotionAnalytics.confidence,
        processedBy: emotionAnalytics.processedBy,
        fcmNotificationSent: emotionAnalytics.fcmNotificationSent
      } : null
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get message emotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving message emotion data'
    });
  }
});

// Get user's emotion history and trends
router.get('/history', auth, [
  body('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
], async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total count for pagination
    const totalEmotions = await Emotion.countDocuments({
      userId: req.userId,
      createdAt: { $gte: startDate }
    });

    // Get user's recent emotions from Emotion collection with pagination
    const recentEmotions = await Emotion.find({
      userId: req.userId,
      createdAt: { $gte: startDate }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    // Get emotion trends (not paginated as it's aggregated data)
    const emotionTrends = await Emotion.getUserEmotionTrends(req.userId, days);
    
    // Calculate statistics
    const averageSentiment = totalEmotions > 0 
      ? recentEmotions.reduce((sum, emotion) => sum + emotion.sentimentScore, 0) / recentEmotions.length
      : 0;
    
    const negativeEmotionsCount = await Emotion.countDocuments({
      userId: req.userId,
      createdAt: { $gte: startDate },
      sentimentScore: { $lte: -0.6 }
    });
    
    const supportNotificationCount = await Emotion.countDocuments({
      userId: req.userId,
      createdAt: { $gte: startDate },
      fcmNotificationSent: true
    });

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        pagination: {
          page,
          limit,
          total: totalEmotions,
          pages: Math.ceil(totalEmotions / limit),
          hasNext: page < Math.ceil(totalEmotions / limit),
          hasPrev: page > 1
        },
        statistics: {
          totalEmotions,
          averageSentiment: parseFloat(averageSentiment.toFixed(3)),
          negativeEmotionsCount,
          supportNotificationsTriggered: supportNotificationCount
        },
        trends: emotionTrends,
        emotions: recentEmotions.map(emotion => ({
          id: emotion._id,
          text: emotion.text.substring(0, 100) + (emotion.text.length > 100 ? '...' : ''),
          emotion: emotion.emotion,
          sentimentScore: emotion.sentimentScore,
          magnitude: emotion.magnitude,
          confidence: emotion.confidence,
          fcmNotificationSent: emotion.fcmNotificationSent,
          messageId: emotion.messageId,
          roomId: emotion.roomId,
          timestamp: emotion.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Get emotion history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving emotion history'
    });
  }
});

module.exports = router;
