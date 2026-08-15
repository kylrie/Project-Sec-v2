import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

const env = (import.meta as any).env || {};

const required = [
  'VITE_FIREBASE_API_KEY', 
  'VITE_FIREBASE_AUTH_DOMAIN', 
  'VITE_FIREBASE_PROJECT_ID', 
  'VITE_FIREBASE_STORAGE_BUCKET', 
  'VITE_FIREBASE_MESSAGING_SENDER_ID', 
  'VITE_FIREBASE_APP_ID'
];

const missing = required.filter(k => !env[k]);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (missing.length === 0) {
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };

  appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(appInstance);
} else {
  console.warn(`[Firebase Client] Firebase env vars missing (${missing.join(', ')}). Authentication features will run in offline mode.`);
}

export const firebaseApp: FirebaseApp | null = appInstance;
export const auth: Auth | null = authInstance;
export const googleProvider = new GoogleAuthProvider();

// Safe Messaging Initialization (Browser only)
let messagingInstance: Messaging | null = null;
export const getClientMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined' || !appInstance) return null;
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(appInstance);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[Firebase Client] Messaging not supported in this environment', err);
  }
  return null;
};

// =============================================================================
// AUTH HELPER FUNCTIONS
// =============================================================================

export async function signInWithGoogle(): Promise<User> {
  if (!authInstance) throw new Error("Firebase Auth is not configured with environment variables.");
  const result = await signInWithPopup(authInstance, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  if (!authInstance) throw new Error("Firebase Auth is not configured with environment variables.");
  const result = await signInWithEmailAndPassword(authInstance, email, pass);
  return result.user;
}

export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  if (!authInstance) throw new Error("Firebase Auth is not configured with environment variables.");
  const result = await createUserWithEmailAndPassword(authInstance, email, pass);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (authInstance) {
    await fbSignOut(authInstance);
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  if (!authInstance) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, callback);
}

export async function getCurrentIdToken(forceRefresh: boolean = false): Promise<string | null> {
  if (!authInstance) return null;
  const user = authInstance.currentUser;
  if (!user) return null;
  return await user.getIdToken(forceRefresh);
}
