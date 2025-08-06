# Frontend Demo for Firebase Authentication

This is a simple HTML/JavaScript frontend demo that showcases Firebase Authentication integration with the EMOCHAT backend.

## Features

- **Email/Password Authentication**: Register and sign in with email
- **Google Sign-In**: One-click authentication with Google
- **Backend Integration**: Automatic token verification with your Node.js backend
- **User Dashboard**: Display user information from both Firebase and your backend
- **Real-time State Management**: Automatic login/logout state handling

## Setup Instructions

### 1. Configure Firebase Project

First, set up your Firebase project following the `FIREBASE_SETUP.md` guide in the root directory.

### 2. Update Firebase Configuration

Edit `firebase-config.js` and replace the placeholder values with your actual Firebase project configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com", 
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

You can find these values in:
- Firebase Console → Project Settings → General tab → Your apps → Web app

### 3. Enable Authentication Providers

In Firebase Console:
1. Go to Authentication → Sign-in method
2. Enable **Email/Password**
3. Enable **Google** (set support email)

### 4. Run the Demo

#### Option 1: Simple File Server
```bash
# Navigate to frontend directory
cd frontend

# Start a simple HTTP server (Python 3)
python -m http.server 8080

# Or using Node.js
npx http-server -p 8080
```

#### Option 2: Live Server (VS Code)
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### 5. Test the Integration

1. Open `http://localhost:8080` in your browser
2. Make sure your backend is running on `http://localhost:5000`
3. Try the following flows:

#### Email/Password Registration:
1. Click "Create New Account"
2. Enter email and password
3. Click "Create Account"
4. Check that user appears in Firebase Console → Authentication

#### Email/Password Sign In:
1. Use the credentials you just created
2. Click "Sign In"
3. Verify the user dashboard loads with both Firebase and backend data

#### Google Sign In:
1. Click "Continue with Google"
2. Select/sign in with your Google account
3. Verify authentication completes

#### Backend Integration Test:
1. After signing in, click "Test Backend Connection"
2. Verify success message appears
3. Check browser console for detailed logs

## File Structure

```
frontend/
├── index.html          # Main demo page
├── firebase-config.js  # Firebase configuration (update this!)
└── README.md          # This file
```

## Authentication Flow

1. **Frontend**: User signs in with Firebase Authentication
2. **Frontend**: Gets Firebase ID token from authenticated user
3. **Frontend**: Sends ID token to backend `/api/auth/verify`
4. **Backend**: Verifies token with Firebase Admin SDK
5. **Backend**: Creates/updates user in MongoDB
6. **Backend**: Returns user profile data
7. **Frontend**: Displays user dashboard with combined data

## API Endpoints Used

- `POST /api/auth/verify` - Verify Firebase token and sync user
- `GET /api/auth/me` - Get current user profile  
- `POST /api/auth/logout` - Update user offline status

## Browser Support

This demo uses ES6 modules and modern JavaScript features:
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 16+

## Security Notes

- ✅ Firebase ID tokens are automatically validated by your backend
- ✅ Tokens expire after 1 hour and auto-refresh
- ✅ CORS is properly configured for localhost development
- ⚠️ Update `CLIENT_URL` in backend `.env` for production

## Troubleshooting

### "Firebase configuration error"
- Check that `firebase-config.js` has valid values
- Verify project ID matches your Firebase project

### "Backend connection failed"
- Ensure backend is running on `http://localhost:5000`
- Check browser console for detailed error messages
- Verify CORS settings in backend

### "Authentication provider not enabled"
- Go to Firebase Console → Authentication → Sign-in method
- Enable the authentication methods you want to use

### "Invalid token" errors
- Check that Firebase service account is properly configured in backend
- Verify environment variables in backend `.env` file

## Next Steps

This is a basic demo. For a production app, consider:

1. **React/Vue/Angular**: Use a proper frontend framework
2. **Router**: Add proper routing for different pages
3. **State Management**: Use Redux/Vuex for complex state
4. **UI Library**: Material-UI, Tailwind, or similar
5. **Error Handling**: More robust error handling and user feedback
6. **Loading States**: Better loading indicators
7. **Form Validation**: Client-side validation with proper feedback

The authentication foundation is solid - you can build any frontend on top of it!
