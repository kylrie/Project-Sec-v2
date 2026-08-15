import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User as FirebaseUser } from 'firebase/auth';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 20
    }
  }
});

/**
 * Bridge Firebase Auth JWT to Supabase RLS Session
 */
export async function syncFirebaseWithSupabase(firebaseUser: FirebaseUser | null): Promise<void> {
  if (!firebaseUser) {
    await supabase.auth.signOut();
    return;
  }

  try {
    const token = await firebaseUser.getIdToken();
    
    // Set custom auth header or session in Supabase client for RLS evaluation
    const { error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    if (error) {
      console.warn('[Supabase Bridge] JWT bridge notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Bridge] Token sync exception:', err.message);
  }
}
