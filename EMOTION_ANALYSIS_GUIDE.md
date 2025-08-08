# 🧠 Enhanced Emotion Analysis with Support System

## 🎯 **New Endpoint: POST /api/emotion/analyze-with-support**

### **Features Implemented:**
1. ✅ **Google Cloud NLP Integration** - Advanced sentiment analysis
2. ✅ **Emotion Data Storage** - Persistent emotion tracking in MongoDB
3. ✅ **Automatic Support Notifications** - FCM alerts for users feeling down
4. ✅ **User Profile Updates** - Emotional profile tracking
5. ✅ **Comprehensive Response** - Detailed analysis results

---

## 🔧 **How It Works:**

### **Step 1: Text Analysis**
- Sends user text to Google Cloud NLP API
- Gets sentiment score (-1 to +1) and magnitude
- Maps to emotion categories (joy, sadness, anger, etc.)

### **Step 2: Data Storage**
- Saves analysis to new `Emotion` collection
- Links to user and optional message
- Tracks processing time and method used

### **Step 3: Support System**
- **Trigger**: Sentiment score ≤ -0.6 (very negative)
- **Action**: Sends FCM notification: "Hey, you okay? We noticed you're feeling down. 💙"
- **Features**: High priority, special icon, gentle sound

### **Step 4: Profile Updates**
- Updates user's emotional history
- Adjusts dominant emotion (if confidence > 0.7)
- Tracks average sentiment trends

---

## 📱 **API Usage Examples:**

### **Basic Analysis:**
```javascript
POST /api/emotion/analyze-with-support
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "text": "I feel terrible today, everything is going wrong"
}
```

### **Message-Linked Analysis:**
```javascript
POST /api/emotion/analyze-with-support
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "text": "I'm so depressed and hopeless",
  "messageId": "60d5ecb74b0b8c001f647d23"
}
```

---

## 📊 **Response Format:**

```javascript
{
  "success": true,
  "message": "Emotion analysis completed",
  "data": {
    "emotionId": "64a1b2c3d4e5f6789abcdef0",
    "analysis": {
      "emotion": "sadness",
      "confidence": 0.85,
      "sentiment": {
        "score": -0.75,
        "magnitude": 0.8
      },
      "processedBy": "google-cloud-nlp",
      "processingTime": 234
    },
    "supportNotification": {
      "triggered": true,
      "sent": true,
      "threshold": -0.6
    },
    "userEmotionalUpdate": {
      "profileUpdated": true,
      "dominantEmotionUpdated": true
    }
  }
}
```

---

## 📈 **Additional Endpoints:**

### **GET /api/emotion/history**
- View user's emotion trends over time
- Filter by days (1-365)
- See support notifications triggered

**Example:**
```javascript
GET /api/emotion/history?days=30
Authorization: Bearer <firebase-token>
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "period": "30 days",
    "statistics": {
      "totalEmotions": 45,
      "averageSentiment": -0.12,
      "negativeEmotionsCount": 8,
      "supportNotificationsTriggered": 3
    },
    "trends": [
      {
        "_id": "neutral",
        "count": 20,
        "averageScore": 0.05,
        "averageMagnitude": 0.3
      },
      {
        "_id": "sadness", 
        "count": 15,
        "averageScore": -0.65,
        "averageMagnitude": 0.8
      }
    ],
    "recentEmotions": [...]
  }
}
```

---

## 🔔 **FCM Notification Details:**

### **Notification Content:**
- **Title**: "Hey, you okay?"
- **Body**: "We noticed you're feeling down. Remember, we're here for you! 💙"
- **Icon**: Heart icon (ic_heart)
- **Sound**: Gentle chime
- **Priority**: High
- **Category**: Emotional Support

### **Notification Data:**
```javascript
{
  "type": "emotional_support",
  "sentimentScore": "-0.75",
  "emotion": "sadness",
  "timestamp": "2025-08-08T10:30:00.000Z"
}
```

---

## 🗄️ **Database Schema:**

### **Emotion Collection:**
```javascript
{
  userId: ObjectId,
  text: String,
  sentimentScore: Number (-1 to 1),
  magnitude: Number (0+),
  emotion: String,
  confidence: Number (0-1),
  processedBy: String,
  processingTime: Number,
  fcmNotificationSent: Boolean,
  messageId: ObjectId (optional),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🎯 **Testing the System:**

### **1. Test Negative Emotion (Triggers Support):**
```bash
curl -X POST http://localhost:5000/api/emotion/analyze-with-support \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "I feel hopeless and depressed, nothing matters anymore"}'
```

### **2. Test Positive Emotion (No Notification):**
```bash
curl -X POST http://localhost:5000/api/emotion/analyze-with-support \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "I am so happy and excited about today!"}'
```

### **3. View Emotion History:**
```bash
curl -X GET "http://localhost:5000/api/emotion/history?days=7" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## 🎉 **Features Summary:**

✅ **Google Cloud NLP** - Professional sentiment analysis  
✅ **Persistent Storage** - All emotions tracked in database  
✅ **Smart Notifications** - Support alerts for negative emotions  
✅ **User Profiling** - Emotional trends and history  
✅ **Comprehensive API** - Detailed responses with full context  
✅ **Error Handling** - Graceful fallbacks if services fail  
✅ **Performance** - Processing time tracking  
✅ **Privacy** - User controls over emotion sharing  

**Your EMOCHAT now has a caring, intelligent emotion support system! 💙**
