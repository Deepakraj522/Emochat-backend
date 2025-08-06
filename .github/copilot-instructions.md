<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Emochat Backend Development Guidelines

## Project Context
This is the backend service for Emochat, an emotion-aware chat application. The backend is built with Node.js, Express.js, and MongoDB Atlas, featuring real-time messaging with Socket.IO and emotion analysis capabilities.

## Code Style & Patterns
- Use async/await for asynchronous operations
- Implement proper error handling with try-catch blocks
- Follow RESTful API conventions
- Use middleware for authentication and validation
- Maintain consistent response format: `{ success: boolean, message: string, data?: any }`
- Include proper HTTP status codes (200, 201, 400, 401, 404, 500)

## Database Patterns
- Use Mongoose schemas with proper validation
- Implement virtual fields and methods where appropriate
- Use proper indexing for performance
- Follow MongoDB naming conventions (camelCase for fields)
- Implement soft deletes where applicable

## Security Practices
- Always validate input using express-validator
- Use JWT for authentication with proper expiration
- Hash passwords with bcrypt (salt rounds: 12)
- Implement rate limiting for API endpoints
- Use helmet for security headers
- Sanitize user inputs

## Emotion Analysis Features
- Maintain emotion data structure: `{ emotion, confidence, sentiment: { score, magnitude } }`
- Support emotions: joy, sadness, anger, fear, surprise, disgust, neutral
- Update user emotional profiles after analysis
- Track emotion trends in chat rooms
- Respect user privacy settings for emotion sharing

## Real-time Features
- Use Socket.IO for real-time messaging
- Implement room-based messaging
- Handle typing indicators
- Broadcast emotion updates
- Manage user presence (online/offline status)

## API Response Examples
```javascript
// Success response
{
  success: true,
  message: "Operation completed successfully",
  data: { /* relevant data */ }
}

// Error response
{
  success: false,
  message: "Error description",
  errors?: [ /* validation errors */ ]
}
```

## Common Imports & Setup
```javascript
const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const router = express.Router();
```

## Environment Variables
- Use process.env for configuration
- Provide sensible defaults where possible
- Document all required environment variables

## Future Integration Readiness
- Prepare for Google Cloud NLP integration
- Support FCM tokens for push notifications
- Design extensible emotion analysis system
- Plan for file upload capabilities
