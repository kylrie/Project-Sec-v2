import { initializeApp, cert, getApps, getApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

let isInitialized = false;
let appInstance: App | null = null;
let authInstance: Auth | null = null;
let messagingInstance: Messaging | null = null;

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    appInstance = getApp();
    authInstance = getAuth(appInstance);
    messagingInstance = getMessaging(appInstance);
    return appInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Replace escaped \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    try {
      appInstance = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      authInstance = getAuth(appInstance);
      messagingInstance = getMessaging(appInstance);
      isInitialized = true;
      console.log(`[Firebase Admin] Initialized successfully for project: ${projectId}`);
      return appInstance;
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to initialize credentials:', err.message);
    }
  } else {
    console.warn('[Firebase Admin] Running in standalone development mode (Credentials unconfigured).');
  }

  // Standalone fallback
  try {
    appInstance = initializeApp();
    authInstance = getAuth(appInstance);
    messagingInstance = getMessaging(appInstance);
    return appInstance;
  } catch {
    return null;
  }
}

initFirebaseAdmin();

export const firebaseAdminApp = appInstance;
export const adminAuth = authInstance;
export const adminMessaging = messagingInstance;
export const isFirebaseAdminActive = () => isInitialized;
