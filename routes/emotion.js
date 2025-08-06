const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Basic emotion detection using keyword analysis (placeholder for Google Cloud NLP)
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

// Analyze emotion in a message
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

    // Perform emotion analysis
    const analysis = analyzeEmotionBasic(text);
    analysis.processingTime = Date.now() - startTime;

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

    // Get recent emotion trends
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentTrends = chatRoom.emotionalContext.emotionTrends
      .filter(trend => trend.date >= cutoffDate)
      .sort((a, b) => b.date - a.date);

    res.json({
      success: true,
      data: {
        roomId: chatRoom._id,
        roomName: chatRoom.name,
        currentContext: {
          averageSentiment: chatRoom.emotionalContext.averageSentiment,
          dominantEmotion: chatRoom.emotionalContext.dominantEmotion
        },
        trends: recentTrends,
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

module.exports = router;
