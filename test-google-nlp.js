// Test Google Cloud NLP Integration
// Run this file to test your Google Cloud setup
// Usage: node test-google-nlp.js

const { analyzeEmotion } = require('./utils/emotionAPI');
require('dotenv').config();

const testTexts = [
  "I am absolutely thrilled and excited about this amazing project! 🎉",
  "This is really disappointing and makes me quite sad 😢",
  "I'm so angry and frustrated with this situation!",
  "This is okay, nothing special really.",
  "I'm worried and scared about what might happen next.",
  "This is absolutely disgusting and horrible!"
];

const runTests = async () => {
  console.log('🧪 Testing Google Cloud NLP Emotion Analysis...\n');

  for (let i = 0; i < testTexts.length; i++) {
    const text = testTexts[i];
    console.log(`Test ${i + 1}: "${text}"`);
    
    try {
      const result = await analyzeEmotion(text);
      console.log(`✅ Emotion: ${result.emotion}`);
      console.log(`📊 Confidence: ${result.confidence}`);
      console.log(`📈 Sentiment: ${result.sentiment.score} (magnitude: ${result.sentiment.magnitude})`);
      console.log(`🔧 Processed by: ${result.processedBy}`);
      console.log('---');
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log('---');
    }
  }

  console.log('\n🎉 Testing completed!');
  process.exit(0);
};

if (require.main === module) {
  runTests();
}

module.exports = runTests;
