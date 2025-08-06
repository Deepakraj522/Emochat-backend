const admin = require('firebase-admin');

const initializeFirebase = () => {
  try {
    if (admin.apps.length === 0) {
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Firebase environment variables are not properly configured');
      }

      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      console.log('🔥 Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.log('⚠️  Server will continue without Firebase authentication');
  }
};

const getAuth = () => {
  try {
    return admin.auth();
  } catch (error) {
    console.error('Firebase Auth not available:', error.message);
    return null;
  }
};

const getFirestore = () => {
  try {
    return admin.firestore();
  } catch (error) {
    console.error('Firebase Firestore not available:', error.message);
    return null;
  }
};

// Verify Firebase ID Token
const verifyIdToken = async (idToken) => {
  try {
    const auth = getAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

// Get user by UID
const getUserByUid = async (uid) => {
  try {
    const auth = getAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
};

// Create custom token (for special cases)
const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const auth = getAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    throw new Error(`Failed to create custom token: ${error.message}`);
  }
};

// Set custom user claims
const setCustomUserClaims = async (uid, customClaims) => {
  try {
    const auth = getAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    await auth.setCustomUserClaims(uid, customClaims);
    return true;
  } catch (error) {
    throw new Error(`Failed to set custom claims: ${error.message}`);
  }
};

// Disable user account
const disableUser = async (uid) => {
  try {
    const auth = getAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    await auth.updateUser(uid, { disabled: true });
    return true;
  } catch (error) {
    throw new Error(`Failed to disable user: ${error.message}`);
  }
};

// Enable user account
const enableUser = async (uid) => {
  try {
    const auth = getAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    await auth.updateUser(uid, { disabled: false });
    return true;
  } catch (error) {
    throw new Error(`Failed to enable user: ${error.message}`);
  }
};

module.exports = {
  initializeFirebase,
  getAuth,
  getFirestore,
  verifyIdToken,
  getUserByUid,
  createCustomToken,
  setCustomUserClaims,
  disableUser,
  enableUser,
  admin
};
