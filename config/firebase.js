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

// Firebase Cloud Messaging (FCM) Functions

/**
 * Send push notification to a single device
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload (optional)
 * @param {Object} options - Additional notification options
 * @returns {Promise<string>} - Message ID if successful
 */
const sendNotification = async (token, title, body, data = {}, options = {}) => {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid FCM token provided');
    }

    const messaging = admin.messaging();
    
    const message = {
      token: token,
      notification: {
        title: title,
        body: body,
        ...options.notification
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        type: data.type || 'general'
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#007bff',
          sound: 'default',
          ...options.android
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            ...options.apns
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          ...options.webpush
        }
      }
    };

    const response = await messaging.send(message);
    console.log('✅ FCM notification sent successfully:', response);
    return response;

  } catch (error) {
    console.error('❌ FCM notification error:', error.message);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('📱 Device token expired or invalid - should remove from database');
      throw new Error('INVALID_TOKEN');
    } else if (error.code === 'messaging/invalid-registration-token') {
      console.log('📱 Invalid token format');
      throw new Error('INVALID_TOKEN_FORMAT');
    } else if (error.code === 'messaging/mismatched-credential') {
      console.log('🔑 Firebase credentials mismatch');
      throw new Error('CREDENTIAL_ERROR');
    }
    
    throw error;
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload (optional)
 * @param {Object} options - Additional notification options
 * @returns {Promise<Object>} - Batch response with success/failure counts
 */
const sendNotificationToMultiple = async (tokens, title, body, data = {}, options = {}) => {
  try {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new Error('Invalid tokens array provided');
    }

    // Filter out invalid tokens
    const validTokens = tokens.filter(token => token && typeof token === 'string');
    
    if (validTokens.length === 0) {
      throw new Error('No valid tokens provided');
    }

    const messaging = admin.messaging();
    
    const message = {
      notification: {
        title: title,
        body: body,
        ...options.notification
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        type: data.type || 'general'
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#007bff',
          sound: 'default',
          ...options.android
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            ...options.apns
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          ...options.webpush
        }
      },
      tokens: validTokens
    };

    const response = await messaging.sendMulticast(message);
    
    console.log(`✅ FCM batch sent: ${response.successCount} success, ${response.failureCount} failed`);
    
    // Log failed tokens for cleanup
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.log(`❌ Failed token ${validTokens[idx]}: ${resp.error?.message}`);
        }
      });
    }
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
      invalidTokens: response.responses
        .map((resp, idx) => !resp.success ? validTokens[idx] : null)
        .filter(token => token !== null)
    };

  } catch (error) {
    console.error('❌ FCM batch notification error:', error.message);
    throw error;
  }
};

/**
 * Send notification to a topic (for broadcast messages)
 * @param {string} topic - Topic name
 * @param {string} title - Notification title  
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<string>} - Message ID if successful
 */
const sendNotificationToTopic = async (topic, title, body, data = {}) => {
  try {
    const messaging = admin.messaging();
    
    const message = {
      topic: topic,
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        type: data.type || 'broadcast'
      }
    };

    const response = await messaging.send(message);
    console.log('✅ FCM topic notification sent:', response);
    return response;

  } catch (error) {
    console.error('❌ FCM topic notification error:', error.message);
    throw error;
  }
};

/**
 * Subscribe device token to a topic
 * @param {string|string[]} tokens - Device token(s)
 * @param {string} topic - Topic name
 * @returns {Promise<Object>} - Subscription result
 */
const subscribeToTopic = async (tokens, topic) => {
  try {
    const messaging = admin.messaging();
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    
    const response = await messaging.subscribeToTopic(tokenArray, topic);
    console.log(`✅ Subscribed ${response.successCount} tokens to topic ${topic}`);
    return response;

  } catch (error) {
    console.error('❌ FCM topic subscription error:', error.message);
    throw error;
  }
};

/**
 * Unsubscribe device token from a topic
 * @param {string|string[]} tokens - Device token(s)
 * @param {string} topic - Topic name
 * @returns {Promise<Object>} - Unsubscription result
 */
const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const messaging = admin.messaging();
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    
    const response = await messaging.unsubscribeFromTopic(tokenArray, topic);
    console.log(`✅ Unsubscribed ${response.successCount} tokens from topic ${topic}`);
    return response;

  } catch (error) {
    console.error('❌ FCM topic unsubscription error:', error.message);
    throw error;
  }
};

/**
 * Validate FCM token format
 * @param {string} token - FCM token to validate
 * @returns {boolean} - True if token format is valid
 */
const validateFCMToken = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Basic FCM token validation (tokens are typically 140+ characters)
  return token.length > 100 && /^[A-Za-z0-9_-]+$/.test(token.replace(/:/g, '').replace(/-/g, ''));
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
  // FCM Functions
  sendNotification,
  sendNotificationToMultiple,
  sendNotificationToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  validateFCMToken,
  admin
};
