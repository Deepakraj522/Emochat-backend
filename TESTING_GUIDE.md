# 🧪 EMOCHAT API Testing Guide

## Prerequisites
1. **Start your backend server**:
   ```bash
   npm start
   ```
   Server should be running on http://localhost:5000

2. **Firebase Authentication Setup**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to Authentication > Sign-in method
   - Enable Google, Email/Password, or your preferred providers

## 🔥 **Option A: Frontend Testing (Recommended)**

### Step 1: Test Frontend Authentication
1. Open `frontend/index.html` in browser
2. Click "Sign In with Google"
3. Complete authentication
4. Check browser console for Firebase idToken
5. Copy the idToken for API testing

### Step 2: Test API Integration
```javascript
// Example: Test authenticated API call from browser console
const idToken = 'your_firebase_id_token_here';

fetch('http://localhost:5000/api/auth/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ idToken })
})
.then(res => res.json())
.then(data => console.log('Auth Result:', data));
```

## 📮 **Option B: Postman Testing**

### Step 1: Import Collection
1. Open Postman
2. Import `EMOCHAT_API_Collection.json`
3. Create new environment with variables:
   - `base_url`: http://localhost:5000
   - `firebase_token`: YOUR_FIREBASE_ID_TOKEN

### Step 2: Get Firebase Token
**Method 1 - Frontend:**
1. Use frontend to sign in
2. Copy idToken from browser console

**Method 2 - Direct Firebase SDK:**
```javascript
// In browser console on any page:
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const firebaseConfig = {
  // Your config from firebase-config.js
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

signInWithPopup(auth, provider).then((result) => {
  result.user.getIdToken().then(token => {
    console.log('Firebase ID Token:', token);
  });
});
```

### Step 3: Test Sequence
1. **Health Check** - Verify server is running
2. **Auth/Verify** - Test Firebase token validation
3. **Auth/Me** - Get current user profile
4. **Create Room** - Test chat room creation
5. **Send Message** - Test messaging with emotion analysis
6. **Emotion Analysis** - Test direct emotion analysis

## 🔍 **Manual Testing Checklist**

### ✅ Authentication Flow
- [ ] Firebase token verification works
- [ ] User creation/login works
- [ ] Profile updates work
- [ ] Logout works

### ✅ Chat Features
- [ ] Create chat rooms
- [ ] Join chat rooms
- [ ] Send messages
- [ ] Retrieve messages
- [ ] Real-time updates (Socket.IO)

### ✅ Emotion Analysis
- [ ] Text emotion analysis works
- [ ] Emotion confidence scores returned
- [ ] User emotion profile updates
- [ ] Room emotion trends calculated

### ✅ Real-time Features (Socket.IO)
- [ ] User connection/disconnection
- [ ] Message broadcasting
- [ ] Typing indicators
- [ ] Emotion updates

## 🔧 **Common Issues & Solutions**

### Firebase Auth Issues
```bash
# Check Firebase config
Error: "Firebase Auth not initialized"
Solution: Verify .env file has correct Firebase credentials
```

### CORS Issues
```bash
# Frontend can't connect to backend
Error: "CORS policy blocked"
Solution: Check server.js CORS configuration includes your frontend URL
```

### MongoDB Connection
```bash
# Database connection fails
Error: "MongoNetworkError"
Solution: Check MongoDB Atlas connection string and whitelist IP
```

## 🚀 **Expected API Responses**

### Successful Authentication
```json
{
  "success": true,
  "message": "Token verified successfully",
  "data": {
    "user": {
      "id": "user_object_id",
      "email": "user@example.com",
      "username": "username"
    },
    "firebaseData": {
      "uid": "firebase_uid",
      "email": "user@example.com"
    }
  }
}
```

### Emotion Analysis Response
```json
{
  "success": true,
  "message": "Emotion analyzed successfully",
  "data": {
    "emotion": "joy",
    "confidence": 0.85,
    "sentiment": {
      "score": 0.8,
      "magnitude": 0.9
    },
    "text": "I'm feeling great today!"
  }
}
```

## 🎯 **Next Steps After Testing**
1. ✅ Confirm all endpoints work
2. ✅ Test Socket.IO real-time features
3. 🔄 Setup Firebase Cloud Messaging (optional)
4. 🚀 Deploy to production (Render/Railway/Vercel)
