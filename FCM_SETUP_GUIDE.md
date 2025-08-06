# 📱 Firebase Cloud Messaging (FCM) Setup Guide

## 🎯 **What is FCM?**
Firebase Cloud Messaging allows you to send push notifications to users even when they're not actively using your app.

## 🔧 **Backend Integration (Optional)**

### Step 1: Install FCM Dependencies
```bash
# FCM is included in firebase-admin SDK (already installed ✅)
```

### Step 2: Add FCM Functions to Firebase Config
Add these functions to `config/firebase.js`:

```javascript
// Add to existing firebase.js
const sendNotification = async (token, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      token
    };
    
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
};

const sendToMultipleDevices = async (tokens, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      tokens
    };
    
    const response = await admin.messaging().sendMulticast(message);
    console.log('✅ Notifications sent:', response.successCount, 'success,', response.failureCount, 'failed');
    return response;
  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    throw error;
  }
};

module.exports = {
  // ...existing exports
  sendNotification,
  sendToMultipleDevices
};
```

### Step 3: Add FCM Token to User Model
Update `models/User.js` to store FCM tokens:

```javascript
// Add to User schema
fcmTokens: [{
  token: { type: String, required: true },
  device: { type: String }, // 'web', 'android', 'ios'
  createdAt: { type: Date, default: Date.now }
}],
```

### Step 4: FCM Routes
Create `routes/notifications.js`:

```javascript
const express = require('express');
const { auth } = require('../middleware/auth');
const { sendNotification } = require('../config/firebase');
const User = require('../models/User');
const router = express.Router();

// Save FCM token
router.post('/token', auth, async (req, res) => {
  try {
    const { token, device } = req.body;
    
    const user = await User.findById(req.userId);
    
    // Remove existing token if it exists
    user.fcmTokens = user.fcmTokens.filter(t => t.token !== token);
    
    // Add new token
    user.fcmTokens.push({ token, device });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'FCM token saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving FCM token'
    });
  }
});

// Send notification to user
router.post('/send', auth, async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    
    const user = await User.findById(userId);
    if (!user || user.fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or no FCM tokens'
      });
    }
    
    const token = user.fcmTokens[user.fcmTokens.length - 1].token;
    await sendNotification(token, title, body, data);
    
    res.json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending notification'
    });
  }
});

module.exports = router;
```

## 🌐 **Frontend Integration (Optional)**

### Step 1: Add FCM to Frontend
Create `frontend/firebase-messaging.js`:

```javascript
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase-config.js';

const messaging = getMessaging(app);

// Request permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY' // Get from Firebase Console
      });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const setupForegroundMessageListener = () => {
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    // Show notification to user
    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: '/icon.png'
    });
  });
};
```

### Step 2: Web App Manifest
Create `frontend/manifest.json`:

```json
{
  "name": "EMOCHAT",
  "short_name": "EMOCHAT",
  "description": "Emotion-aware chat application",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#007bff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png", 
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Step 3: Service Worker
Create `frontend/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png',
    badge: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## 📋 **Firebase Console FCM Setup**

### Step 1: Get VAPID Key
1. Go to Firebase Console > Project Settings
2. Navigate to "Cloud Messaging" tab
3. In "Web configuration" section, generate Web Push certificates
4. Copy the "Key pair" (VAPID key)

### Step 2: Test Notifications
1. Go to Firebase Console > Cloud Messaging
2. Click "Send test message"
3. Enter FCM token from your frontend
4. Send test notification

## 🎯 **Integration with Chat Features**

### Auto-Notifications for Messages
Add to your message creation logic:

```javascript
// In routes/chat.js - after saving message
if (room.participants.length > 1) {
  const otherParticipants = room.participants.filter(p => !p.equals(req.userId));
  
  for (const participantId of otherParticipants) {
    const participant = await User.findById(participantId);
    if (participant.fcmTokens.length > 0) {
      const token = participant.fcmTokens[participant.fcmTokens.length - 1].token;
      await sendNotification(
        token,
        `New message in ${room.name}`,
        message.content,
        { roomId: room._id.toString(), messageId: message._id.toString() }
      );
    }
  }
}
```

## ✅ **Testing FCM**
1. Request notification permission in frontend
2. Save FCM token to backend
3. Send test notification via API
4. Verify notification appears on device

## 🚀 **Production Considerations**
- Store FCM tokens securely
- Handle token refresh/updates
- Implement notification preferences
- Rate limit notifications
- Analytics for notification delivery
