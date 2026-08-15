import { supabase } from '../lib/supabase';

export type SyncStatusState = 'synced' | 'syncing' | 'offline';

export interface PendingSyncItem {
  id: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
}

const SYNC_QUEUE_KEY = 'ahri_offline_sync_queue_v1';

class SyncEngine {
  private status: SyncStatusState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private listeners: Set<(status: SyncStatusState) => void> = new Set();
  private isFlushing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setStatus('syncing');
        this.flushPendingQueue();
      });

      window.addEventListener('offline', () => {
        this.setStatus('offline');
      });
    }
  }

  public getStatus(): SyncStatusState {
    return this.status;
  }

  public subscribeToSyncStatus(listener: (status: SyncStatusState) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(newStatus: SyncStatusState) {
    this.status = newStatus;
    this.listeners.forEach(l => l(newStatus));
  }

  public getPendingQueue(): PendingSyncItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private savePendingQueue(queue: PendingSyncItem[]) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('[SyncEngine] Failed to persist sync queue:', e);
    }
  }

  /**
   * Push an operation to offline queue and attempt immediate sync if online
   */
  public async pushLocalChange(table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', data: any): Promise<void> {
    const queueItem: PendingSyncItem = {
      id: data.id || 'sync-' + Math.random().toString(36).substring(2, 9),
      table,
      operation,
      data,
      timestamp: Date.now()
    };

    const currentQueue = this.getPendingQueue();
    currentQueue.push(queueItem);
    this.savePendingQueue(currentQueue);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await this.flushPendingQueue();
    } else {
      this.setStatus('offline');
    }
  }

  /**
   * Flush all offline queued operations to Supabase in order
   */
  public async flushPendingQueue(): Promise<void> {
    if (this.isFlushing) return;
    const queue = this.getPendingQueue();
    if (queue.length === 0) {
      this.setStatus('synced');
      return;
    }

    this.isFlushing = true;
    this.setStatus('syncing');

    const remainingQueue: PendingSyncItem[] = [];

    for (const item of queue) {
      try {
        if (item.operation === 'INSERT') {
          const { error } = await supabase.from(item.table).upsert(item.data);
          if (error) throw error;
        } else if (item.operation === 'UPDATE') {
          const { error } = await supabase.from(item.table).update(item.data).eq('id', item.data.id);
          if (error) throw error;
        } else if (item.operation === 'DELETE') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.data.id);
          if (error) throw error;
        }
      } catch (err) {
        console.warn(`[SyncEngine] Retry queued item failed for ${item.table}:`, err);
        remainingQueue.push(item);
      }
    }

    this.savePendingQueue(remainingQueue);
    this.isFlushing = false;
    this.setStatus(remainingQueue.length === 0 ? 'synced' : 'offline');
  }

  /**
   * Last-write-wins conflict resolution algorithm
   */
  public resolveConflict(serverRecord: any, localRecord: any): any {
    const serverTime = serverRecord?.updated_at ? new Date(serverRecord.updated_at).getTime() : 0;
    const localTime = localRecord?.updated_at ? new Date(localRecord.updated_at).getTime() : (localRecord?.timestamp || 0);

    if (serverTime >= localTime) {
      return serverRecord; // Server record takes precedence
    }
    return localRecord;
  }

  // Convenience pull methods
  public async syncCalendarEvents(userId: string) {
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId);
    return data || [];
  }

  public async syncTasks(userId: string) {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', userId);
    return data || [];
  }

  public async syncConversations(userId: string, limit = 20) {
    const { data } = await supabase.from('conversations').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  }
}

export const syncEngine = new SyncEngine();
