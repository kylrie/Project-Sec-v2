/**
 * Optimized WebSocket Service with Exponential Backoff Reconnection
 * Handles persistent real-time streaming between Project Ahri client & backend
 */

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
  [key: string]: any;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private authToken: string | null = null;
  private listeners: Set<(data: any) => void> = new Set(); // BUG 2 FIX: Set instead of array
  private isConnected = false;
  private pingInterval: any = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null; // BUG 2 FIX: Track timer

  // Optimized Exponential Backoff Reconnect properties
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor(customUrl?: string) {
    const isBrowser = typeof window !== 'undefined';
    const defaultHost = isBrowser ? window.location.origin : 'http://localhost:3000';
    const baseUrl = customUrl || (import.meta as any).env?.VITE_WS_URL || (import.meta as any).env?.VITE_API_URL || defaultHost;
    
    if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
      this.url = baseUrl;
    } else {
      const wsProto = baseUrl.startsWith('https') ? 'wss' : 'ws';
      const hostPart = baseUrl.replace(/^https?:\/\//, '');
      this.url = `${wsProto}://${hostPart}/live`;
    }
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  public connect(onMessage?: (data: any) => void): () => void {
    if (onMessage) {
      this.listeners.add(onMessage); // BUG 2 FIX: Set.add() is idempotent — no duplicates
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return () => this.unsubscribe(onMessage);
    }

    // BUG 2 FIX: Clean up existing socket before creating a new one
    this.cleanupSocket();

    const tokenQuery = this.authToken ? `?token=${encodeURIComponent(this.authToken)}` : '';
    const fullWsUrl = `${this.url}${tokenQuery}`;

    try {
      this.ws = new WebSocket(fullWsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset on successful connection
        console.log('[WebSocketService] Connected successfully to Ahri Live Stream');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.broadcast(data);
        } catch {
          this.broadcast(event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocketService] Connection error:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.handleReconnect();
      };
    } catch (err) {
      console.warn('[WebSocketService] Exception connecting:', err);
      this.handleReconnect();
    }

    return () => this.unsubscribe(onMessage);
  }

  // BUG 2 FIX: Separate cleanup method to prevent leaked sockets
  private cleanupSocket() {
    if (this.ws) {
      // Detach handlers to prevent ghost callbacks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch {}
      this.ws = null;
    }
    this.stopHeartbeat();
  }

  private handleReconnect() {
    // BUG 2 FIX: Clear any pending reconnect timer first
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[WebSocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.listeners.size > 0) {
          this.connect();
        }
      }, delay);
    } else {
      console.warn('[WebSocketService] Max reconnect attempts reached.');
    }
  }

  public send(data: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
      return true;
    }
    return false;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING', timestamp: Date.now() });
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private broadcast(data: any) {
    this.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('[WebSocketService] Broadcast listener error:', err);
      }
    });
  }

  private unsubscribe(fn?: (data: any) => void) {
    if (!fn) return;
    this.listeners.delete(fn); // BUG 2 FIX: Set.delete()
    if (this.listeners.size === 0) {
      // BUG 2 FIX: Cancel pending reconnect on full unsubscribe
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.cleanupSocket();
    }
  }

  public getStatus(): { isConnected: boolean; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

export const websocketService = new WebSocketService();
