import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UseRealtimeTableReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRealtimeTable<T extends { id: string }>(
  userId: string | null | undefined,
  tableName: 'calendar_events' | 'tasks' | 'conversations' | 'notifications' | 'emails',
  orderBy: string = 'created_at',
  ascending: boolean = false
): UseRealtimeTableReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: rows, error: fetchErr } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order(orderBy, { ascending });

      if (fetchErr) throw fetchErr;
      setData((rows as T[]) || []);
    } catch (err: any) {
      console.warn(`[useRealtimeTable:${tableName}] Fetch error:`, err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, tableName, orderBy, ascending]);

  useEffect(() => {
    fetchData();

    if (!userId) return;

    let channel: RealtimeChannel;

    try {
      channel = supabase
        .channel(`realtime:${tableName}:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setData(prev => [payload.new as T, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setData(prev => prev.map(item => item.id === (payload.new as any).id ? (payload.new as T) : item));
            } else if (payload.eventType === 'DELETE') {
              setData(prev => prev.filter(item => item.id !== (payload.old as any).id));
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn(`[useRealtimeTable:${tableName}] Realtime subscription warning:`, err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, tableName, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
