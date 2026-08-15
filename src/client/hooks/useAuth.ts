import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  onAuthChange, 
  signInWithGoogle as fbSignInGoogle, 
  signInWithEmail as fbSignInEmail,
  signUpWithEmail as fbSignUpEmail,
  signOutUser as fbSignOut,
  getCurrentIdToken
} from '../lib/firebase';
import { syncFirebaseWithSupabase } from '../lib/supabase';

export interface UseAuthReturn {
  user: User | null;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string) => Promise<User>;
  signOut: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        await syncFirebaseWithSupabase(firebaseUser);
      } else {
        setToken(null);
        await syncFirebaseWithSupabase(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const u = await fbSignInGoogle();
      await syncFirebaseWithSupabase(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const u = await fbSignInEmail(email, pass);
      await syncFirebaseWithSupabase(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const u = await fbSignUpEmail(email, pass);
      await syncFirebaseWithSupabase(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await fbSignOut();
      await syncFirebaseWithSupabase(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getToken = useCallback(async (forceRefresh = false) => {
    return await getCurrentIdToken(forceRefresh);
  }, []);

  return {
    user,
    token,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    getToken
  };
}
