const mongoose = require('mongoose');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data (be careful in production!)
    await User.deleteMany({});
    await ChatRoom.deleteMany({});
    await Message.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Create sample users
    const users = await User.create([
      {
        username: 'alice_wonder',
        email: 'alice@example.com',
        password: 'Password123',
        avatar: 'https://ui-avatars.com/api/?name=Alice+Wonder&background=4f46e5&color=fff',
        emotionalProfile: {
          dominantEmotion: 'joy',
          averageSentiment: 0.6
        }
      },
      {
        username: 'bob_builder',
        email: 'bob@example.com',
        password: 'Password123',
        avatar: 'https://ui-avatars.com/api/?name=Bob+Builder&background=059669&color=fff',
        emotionalProfile: {
          dominantEmotion: 'neutral',
          averageSentiment: 0.1
        }
      },
      {
        username: 'charlie_dev',
        email: 'charlie@example.com',
        password: 'Password123',
        avatar: 'https://ui-avatars.com/api/?name=Charlie+Dev&background=dc2626&color=fff',
        emotionalProfile: {
          dominantEmotion: 'surprise',
          averageSentiment: 0.3
        }
      }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create a sample chat room
    const chatRoom = await ChatRoom.create({
      name: 'General Discussion',
      type: 'group',
      participants: users.map(user => ({
        user: user._id,
        role: 'member'
      })),
      settings: {
        emotionSharing: true,
        allowEmotionAnalysis: true,
        notifications: true
      }
    });

    console.log('✅ Created sample chat room');

    // Create sample messages
    const messages = [
      {
        sender: users[0]._id,
        receiver: users[1]._id,
        content: 'Hey everyone! 😊 So excited to test this new emotion-aware chat app!',
        chatRoom: chatRoom._id,
        emotion: {
          detected: 'joy',
          confidence: 0.85,
          sentiment: { score: 0.8, magnitude: 0.9 },
          processedBy: 'local-analysis'
        }
      },
      {
        sender: users[1]._id,
        receiver: users[0]._id,
        content: 'This looks really interesting. How does the emotion detection work?',
        chatRoom: chatRoom._id,
        emotion: {
          detected: 'neutral',
          confidence: 0.6,
          sentiment: { score: 0.1, magnitude: 0.3 },
          processedBy: 'local-analysis'
        }
      },
      {
        sender: users[2]._id,
        receiver: users[0]._id,
        content: 'Wow! This is amazing technology! 🚀 I love how it can understand emotions in text.',
        chatRoom: chatRoom._id,
        emotion: {
          detected: 'surprise',
          confidence: 0.9,
          sentiment: { score: 0.9, magnitude: 0.8 },
          processedBy: 'local-analysis'
        }
      }
    ];

    const createdMessages = await Message.create(messages);
    console.log(`✅ Created ${createdMessages.length} sample messages`);

    // Update chat room with last message
    chatRoom.lastMessage = createdMessages[createdMessages.length - 1]._id;
    chatRoom.lastActivity = new Date();
    await chatRoom.save();

    // Update users' emotion history
    for (let i = 0; i < users.length; i++) {
      const message = messages[i];
      if (message.emotion.confidence > 0.5) {
        await users[i].addEmotionToHistory(message.emotion.detected, message.emotion.confidence);
      }
    }

    console.log('✅ Updated user emotion histories');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Seeded data:');
    console.log(`   • ${users.length} users`);
    console.log(`   • 1 chat room`);
    console.log(`   • ${createdMessages.length} messages`);
    console.log('\n🔐 Sample login credentials:');
    console.log('   • alice@example.com / Password123');
    console.log('   • bob@example.com / Password123');
    console.log('   • charlie@example.com / Password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
