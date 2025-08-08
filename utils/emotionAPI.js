const { LanguageServiceClient } = require('@google-cloud/language');

// Initialize the Language client
const client = new LanguageServiceClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
  // If using service account key from environment variable
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ? undefined : {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }
});

/**
 * Analyze emotion and sentiment of text using Google Cloud NLP
 * @param {string} text - The text to analyze
 * @returns {Promise<Object>} - Emotion analysis result
 */
const analyzeEmotion = async (text) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Text input is required and must be a non-empty string');
    }

    // Create the document object
    const document = {
      content: text,
      type: 'PLAIN_TEXT',
    };

    // Analyze sentiment
    const [sentimentResult] = await client.analyzeSentiment({
      document: document,
    });

    const sentiment = sentimentResult.documentSentiment;
    const score = sentiment.score;
    const magnitude = sentiment.magnitude;

    // Map sentiment score to emotions
    const emotion = mapScoreToEmotion(score, magnitude);
    
    // Calculate confidence based on magnitude and absolute score
    const confidence = Math.min(magnitude * Math.abs(score), 1.0);

    return {
      emotion: emotion,
      confidence: parseFloat(confidence.toFixed(3)),
      sentiment: {
        score: parseFloat(score.toFixed(3)),
        magnitude: parseFloat(magnitude.toFixed(3))
      },
      processedBy: 'google-cloud-nlp'
    };

  } catch (error) {
    console.error('Google Cloud NLP Error:', error.message);
    
    // Fallback to local analysis if Google Cloud fails
    return await fallbackEmotionAnalysis(text);
  }
};

/**
 * Map sentiment score and magnitude to emotion categories
 * @param {number} score - Sentiment score (-1 to 1)
 * @param {number} magnitude - Sentiment magnitude (0 to infinity)
 * @returns {string} - Detected emotion
 */
const mapScoreToEmotion = (score, magnitude) => {
  // If magnitude is very low, it's likely neutral
  if (magnitude < 0.3) {
    return 'neutral';
  }

  // Strong positive emotions
  if (score > 0.6) {
    return magnitude > 0.8 ? 'joy' : 'surprise';
  }
  
  // Moderate positive emotions
  if (score > 0.2) {
    return 'joy';
  }
  
  // Neutral range
  if (score > -0.2) {
    return 'neutral';
  }
  
  // Moderate negative emotions
  if (score > -0.6) {
    return magnitude > 0.7 ? 'sadness' : 'fear';
  }
  
  // Strong negative emotions
  return magnitude > 0.8 ? 'anger' : 'sadness';
};

/**
 * Fallback emotion analysis using local keywords
 * @param {string} text - The text to analyze
 * @returns {Promise<Object>} - Fallback emotion analysis result
 */
const fallbackEmotionAnalysis = async (text) => {
  const lowerText = text.toLowerCase();
  
  // Emotion keyword patterns
  const emotionPatterns = {
    joy: ['happy', 'excited', 'great', 'awesome', 'love', 'amazing', '😊', '😃', '🎉', '❤️'],
    sadness: ['sad', 'disappointed', 'down', 'depressed', 'crying', '😢', '😭', '💔'],
    anger: ['angry', 'mad', 'furious', 'annoyed', 'hate', 'frustrated', '😠', '😡', '🤬'],
    fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified', '😨', '😰'],
    surprise: ['wow', 'amazing', 'unbelievable', 'shocking', 'incredible', '😲', '🤯', '😱'],
    disgust: ['disgusting', 'gross', 'awful', 'terrible', 'horrible', '🤢', '🤮'],
    neutral: ['okay', 'fine', 'normal', 'regular', 'standard']
  };

  let maxScore = 0;
  let detectedEmotion = 'neutral';
  
  for (const [emotion, keywords] of Object.entries(emotionPatterns)) {
    const score = keywords.reduce((count, keyword) => {
      return count + (lowerText.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (score > maxScore) {
      maxScore = score;
      detectedEmotion = emotion;
    }
  }

  // Calculate basic sentiment score
  const positiveWords = emotionPatterns.joy.length + emotionPatterns.surprise.length;
  const negativeWords = emotionPatterns.sadness.length + emotionPatterns.anger.length + 
                       emotionPatterns.fear.length + emotionPatterns.disgust.length;
  
  let sentimentScore = 0;
  if (maxScore > 0) {
    if (['joy', 'surprise'].includes(detectedEmotion)) {
      sentimentScore = 0.3 + (maxScore * 0.2);
    } else if (['sadness', 'anger', 'fear', 'disgust'].includes(detectedEmotion)) {
      sentimentScore = -0.3 - (maxScore * 0.2);
    }
  }

  return {
    emotion: detectedEmotion,
    confidence: maxScore > 0 ? Math.min(maxScore * 0.3, 0.8) : 0.1,
    sentiment: {
      score: parseFloat(sentimentScore.toFixed(3)),
      magnitude: maxScore > 0 ? Math.min(maxScore * 0.4, 1.0) : 0.1
    },
    processedBy: 'local-fallback'
  };
};

/**
 * Analyze multiple texts in batch
 * @param {string[]} texts - Array of texts to analyze
 * @returns {Promise<Object[]>} - Array of emotion analysis results
 */
const analyzeBatchEmotions = async (texts) => {
  try {
    const promises = texts.map(text => analyzeEmotion(text));
    return await Promise.all(promises);
  } catch (error) {
    console.error('Batch emotion analysis error:', error);
    throw error;
  }
};

/**
 * Get emotion statistics for an array of emotion results
 * @param {Object[]} emotionResults - Array of emotion analysis results
 * @returns {Object} - Emotion statistics
 */
const getEmotionStatistics = (emotionResults) => {
  if (!emotionResults || emotionResults.length === 0) {
    return {
      dominant: 'neutral',
      distribution: {},
      averageSentiment: 0,
      totalAnalyzed: 0
    };
  }

  const emotionCounts = {};
  let totalSentiment = 0;

  emotionResults.forEach(result => {
    const emotion = result.emotion;
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    totalSentiment += result.sentiment.score;
  });

  // Find dominant emotion
  const dominant = Object.keys(emotionCounts).reduce((a, b) => 
    emotionCounts[a] > emotionCounts[b] ? a : b
  );

  // Calculate distribution percentages
  const total = emotionResults.length;
  const distribution = {};
  Object.keys(emotionCounts).forEach(emotion => {
    distribution[emotion] = parseFloat((emotionCounts[emotion] / total * 100).toFixed(1));
  });

  return {
    dominant,
    distribution,
    averageSentiment: parseFloat((totalSentiment / total).toFixed(3)),
    totalAnalyzed: total
  };
};

module.exports = {
  analyzeEmotion,
  analyzeBatchEmotions,
  getEmotionStatistics,
  mapScoreToEmotion
};
