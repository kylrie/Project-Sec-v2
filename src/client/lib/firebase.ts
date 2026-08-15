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

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCKLXCdAsPlU7TFR7yFlTOL7mKMnsspvow",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0699733118.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0699733118",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0699733118.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "189100351312",
  appId: env.VITE_FIREBASE_APP_ID || "1:189100351312:web:1ea04173d96d62d2909655"
};

// Singleton Firebase App
export const firebaseApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Safe Messaging Initialization (Browser only)
let messagingInstance: Messaging | null = null;
export const getClientMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(firebaseApp);
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
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(forceRefresh);
}
