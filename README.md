# Emochat Backend

🔧 **Description**: Backend service for Emochat - An emotion-aware chat application built with Node.js, Express, and MongoDB Atlas. This backend integrates real-time messaging with emotion analysis capabilities.

## Features

- 🚀 **RESTful API** with Express.js
- 💬 **Real-time messaging** with Socket.IO
- 🧠 **Emotion analysis** for chat messages
- 🔐 **JWT-based authentication**
- 📊 **User emotional profiles** and chat room emotion trends
- 🛡️ **Security** with helmet, rate limiting, and input validation
- 🌐 **MongoDB Atlas** integration
- 📱 **Ready for** Google Cloud NLP and Firebase Cloud Messaging integration

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Real-time**: Socket.IO
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: Helmet, CORS, rate limiting

## Quick Start

### 1. Environment Setup

Copy the environment example file and configure your settings:

```bash
cp .env.example .env
```

Update `.env` with your MongoDB Atlas connection string and other configuration:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/emochat
JWT_SECRET=your_super_secure_jwt_secret_key_here
CLIENT_URL=http://localhost:3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000` with auto-reload enabled.

### 4. Production Start

```bash
npm start
```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | User login |
| POST | `/auth/logout` | User logout |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/refresh` | Refresh JWT token |
| POST | `/auth/fcm-token` | Update FCM token |

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chat/rooms` | Get user's chat rooms |
| POST | `/chat/rooms` | Create new chat room |
| GET | `/chat/rooms/:roomId/messages` | Get messages for a room |
| POST | `/chat/rooms/:roomId/messages` | Send new message |
| PUT | `/chat/messages/:messageId` | Edit message |
| DELETE | `/chat/messages/:messageId` | Delete message |
| GET | `/chat/unread-count` | Get unread message count |

### Emotion Analysis Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/emotion/analyze` | Analyze emotion in text |
| GET | `/emotion/profile/:userId?` | Get emotional profile |
| GET | `/emotion/trends/:roomId` | Get chat room emotion trends |
| GET | `/emotion/stats` | Get emotion statistics |

### User Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/user/profile` | Update user profile |
| PUT | `/user/preferences` | Update user preferences |
| GET | `/user/search` | Search users |
| GET | `/user/:userId` | Get user by ID |
| PUT | `/user/status` | Update online status |
| GET | `/user/stats/overview` | Get user statistics |

## Project Structure

```
emochat-backend/
├── models/
│   ├── User.js           # User model with emotional profile
│   ├── Message.js        # Message model with emotion data
│   └── ChatRoom.js       # Chat room model with trends
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── chat.js           # Chat and messaging routes
│   ├── emotion.js        # Emotion analysis routes
│   └── user.js           # User management routes
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── server.js             # Main server file
├── package.json          # Dependencies and scripts
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Socket.IO Events

### Client to Server Events
- `join-room` - Join a chat room
- `send-message` - Send a message
- `emotion-update` - Send emotion update
- `typing` - User started typing
- `stop-typing` - User stopped typing

### Server to Client Events
- `receive-message` - Receive new message
- `emotion-received` - Receive emotion update
- `user-typing` - User is typing indicator
- `user-stopped-typing` - User stopped typing indicator

## Database Models

### User Model
- Basic user information (username, email, password)
- Emotional profile with history and trends
- Preferences for notifications and privacy
- FCM token for push notifications

### Message Model
- Message content and metadata
- Emotion analysis results
- Read/delivery status
- Support for attachments and replies

### ChatRoom Model
- Private and group chat support
- Participant management
- Emotional context and trends
- Settings for emotion sharing

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | No (default: 5000) |
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `CLIENT_URL` | Frontend URL for CORS | No (default: localhost:3000) |

## Future Integrations

### Google Cloud NLP
Ready for integration with Google Cloud Natural Language API for advanced emotion analysis.

### Firebase Cloud Messaging
Prepared for push notification implementation with FCM tokens stored in user profiles.

## Development

### Running in Development Mode
```bash
npm run dev
```

### Code Style
- Use ES6+ features
- Follow REST API conventions
- Implement proper error handling
- Add input validation for all endpoints

### Security Features
- JWT token authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Input sanitization
- Helmet security headers

## Health Check

Check if the server is running:
```
GET http://localhost:5000/health
```

Response:
```json
{
  "status": "OK",
  "message": "Emochat Backend Server is running",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

---

Built with ❤️ for emotion-aware communication
