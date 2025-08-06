# Firebase Authentication Setup Guide

## Firebase Console Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `emochat-app` (or your preferred name)
4. Enable Google Analytics (optional)
5. Choose your analytics account
6. Click "Create project"

### 2. Enable Authentication
1. In the Firebase console, click "Authentication" from the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable the following providers:
   - **Email/Password**: Click and enable
   - **Google**: Click, enable, and set support email
   - **Anonymous**: Click and enable (optional, for guest users)

### 3. Create Web App
1. Click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>`
5. Register your app:
   - App nickname: `emochat-web`
   - Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the Firebase configuration object

### 4. Generate Service Account Key
1. Go to Project Settings → Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. **Important**: Keep this file secure and never commit it to version control

## Environment Variables Setup

### Backend (.env file)
Add these variables to your `.env` file:

```env
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-private-key-here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# Optional: Firebase Storage Bucket
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

**How to get these values:**
1. Open the downloaded service account JSON file
2. Copy `project_id` → `FIREBASE_PROJECT_ID`
3. Copy `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and newlines)
4. Copy `client_email` → `FIREBASE_CLIENT_EMAIL`

### Frontend Configuration
For your frontend application, use this config:

```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

export default firebaseConfig;
```

## Authentication Flow

### Backend Implementation
The backend now uses Firebase Authentication with these endpoints:

#### POST `/api/auth/verify`
Verify Firebase ID token and create/update user in database.

**Request:**
```json
{
  "idToken": "firebase-id-token-from-frontend"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "user-id",
      "username": "username",
      "email": "email",
      "avatar": "avatar-url",
      "emailVerified": true,
      "provider": "google.com"
    },
    "firebaseData": {
      "uid": "firebase-uid",
      "email": "email",
      "emailVerified": true,
      "provider": "google.com"
    }
  }
}
```

#### POST `/api/auth/logout`
Update user online status (requires Authorization header).

#### GET `/api/auth/me`
Get current user profile (requires Authorization header).

#### PUT `/api/auth/profile`
Update user profile (requires Authorization header).

### Frontend Implementation Example

```javascript
// Firebase Authentication
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import firebaseConfig from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sign in with email/password
async function signInWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    
    // Send token to your backend
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Store user data and redirect
      localStorage.setItem('firebaseToken', idToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
  } catch (error) {
    console.error('Sign in error:', error);
  }
}

// Sign in with Google
async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const idToken = await userCredential.user.getIdToken();
    
    // Send token to your backend (same as above)
    // ...
  } catch (error) {
    console.error('Google sign in error:', error);
  }
}

// Make authenticated requests
async function makeAuthenticatedRequest(url, options = {}) {
  const token = localStorage.getItem('firebaseToken');
  
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}
```

## Security Rules

### Firestore Security Rules (if using Firestore)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Chat rooms (adjust based on your needs)
    match /chatrooms/{roomId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firebase Storage Security Rules (if using Storage)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /chat-files/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Testing Authentication

### Test with curl
```bash
# Get a Firebase ID token from your frontend first, then:
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"idToken":"your-firebase-id-token"}'

# Make authenticated request
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer your-firebase-id-token"
```

## Free Tier Limits

Firebase Authentication free tier includes:
- **10,000 phone authentications per month**
- **Unlimited email/password, Google, Facebook, etc.**
- **Unlimited custom authentication**
- **50,000 monthly active users**

Perfect for development and small-scale production apps!

## Troubleshooting

### Common Issues

1. **"Firebase service account key is not configured"**
   - Check your environment variables
   - Ensure private key includes proper newlines

2. **"Token verification failed"**
   - Check if Firebase ID token is expired
   - Verify project ID matches

3. **"User not found in Firebase"**
   - Ensure user exists in Firebase Authentication
   - Check if user was deleted from Firebase console

### Debug Mode
Add this to your `.env` for detailed Firebase logs:
```env
FIREBASE_DEBUG=true
```

## Next Steps

1. Set up your Firebase project using this guide
2. Update your `.env` file with the Firebase credentials
3. Test authentication with the `/api/auth/verify` endpoint
4. Integrate with your frontend application
5. Configure Firestore/Storage if needed

Your backend is now ready for Firebase Authentication! 🔥
