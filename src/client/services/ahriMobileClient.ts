/**
 * Project Ahri (F.R.I.D.A.Y.) Mobile & Android SDK Client
 * Connects directly to Project Ahri Express WebSocket & REST endpoints
 */

export interface AhriCommandRequest {
  message: string;
  sessionId?: string;
  personality?: 'professional' | 'tactical' | 'concise';
  userTimezone?: string;
  userId?: string;
}

export interface AhriCommandResponse {
  spokenReply: string;
  intent?: string;
  actionData?: any;
  toolsUsed?: string[];
  latencyMs?: number;
  provider?: string;
  timestamp: number;
}

export interface AhriSystemReadyEvent {
  type: 'SYSTEM_READY';
  message: string;
  userId: string;
  timestamp: number;
}

export interface AhriAgentToolExecutionEvent {
  type: 'AGENT_TOOL_EXECUTION';
  tools: string[];
  intent?: string;
  reply?: string;
  timestamp: number;
}

export interface AhriDeviceSyncUpdateEvent {
  type: 'DEVICE_SYNC_UPDATE';
  deviceId: string;
  timestamp: number;
  dataSummary?: any;
}

export interface AhriPongEvent {
  type: 'PONG';
  clientTimestamp?: number;
  serverTimestamp?: number;
}

export type AhriLiveEvent =
  | AhriSystemReadyEvent
  | AhriAgentToolExecutionEvent
  | AhriDeviceSyncUpdateEvent
  | AhriPongEvent;

export class AhriMobileClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private pingInterval: any = null;
  private listeners: ((event: AhriLiveEvent) => void)[] = [];
  private authToken: string | null = null;
  private isConnected = false;

  constructor(customBaseUrl?: string) {
    const isBrowser = typeof window !== 'undefined';
    const defaultHost = isBrowser ? window.location.origin : 'http://localhost:3000';
    this.baseUrl = customBaseUrl || (import.meta as any).env?.VITE_API_BASE_URL || defaultHost;
    
    // Compute WebSocket URL from Base HTTP URL
    const wsProto = this.baseUrl.startsWith('https') ? 'wss' : 'ws';
    const hostPart = this.baseUrl.replace(/^https?:\/\//, '');
    this.wsUrl = `${wsProto}://${hostPart}/live`;
  }

  /**
   * Set or update the Firebase Auth ID token
   */
  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  /**
   * Health check to verify backend operational state
   */
  public async getHealth(): Promise<{
    status: string;
    system: string;
    engine: string;
    version: string;
    uptime: number;
    timestamp: string;
  }> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Send a voice or text command to Project Ahri AI Brain
   * POST /api/command
   * Response: { spokenReply, intent, actionData, toolsUsed, latencyMs, provider, timestamp }
   */
  public async sendCommand(request: AhriCommandRequest): Promise<AhriCommandResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const payload = {
      message: request.message,
      sessionId: request.sessionId || 'default',
      personality: request.personality || 'professional',
      userTimezone: request.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      userId: request.userId || 'anonymous'
    };

    const res = await fetch(`${this.baseUrl}/api/command`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Command failed with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      spokenReply: data.spokenReply || '',
      intent: data.intent,
      actionData: data.actionData,
      toolsUsed: data.toolsUsed || [],
      latencyMs: data.latencyMs,
      provider: data.provider,
      timestamp: data.timestamp || Date.now()
    };
  }

  /**
   * Connect to the live multi-device WebSocket channel
   * ws://localhost:3000/live?token=<firebaseIdToken>
   */
  public connectLiveStream(onEvent?: (event: AhriLiveEvent) => void): () => void {
    if (onEvent) {
      this.listeners.push(onEvent);
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return () => this.removeListener(onEvent);
    }

    const tokenQuery = this.authToken ? `?token=${encodeURIComponent(this.authToken)}` : '';
    const fullWsUrl = `${this.wsUrl}${tokenQuery}`;

    try {
      this.ws = new WebSocket(fullWsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.emitEvent(payload);
        } catch (e) {
          console.warn('[Ahri WS] Failed to parse message:', event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Ahri WS] Error:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          if (this.listeners.length > 0) {
            this.connectLiveStream();
          }
        }, 3000);
      };
    } catch (err) {
      console.warn('[Ahri WS] Connection exception:', err);
    }

    return () => this.removeListener(onEvent);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private emitEvent(event: AhriLiveEvent) {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('[Ahri WS Listener Error]', err);
      }
    });
  }

  private removeListener(fn?: (event: AhriLiveEvent) => void) {
    if (!fn) return;
    this.listeners = this.listeners.filter((l) => l !== fn);
    if (this.listeners.length === 0 && this.ws) {
      this.stopHeartbeat();
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Calendar APIs
   */
  public async getCalendarEvents(dateFilter?: string): Promise<any[]> {
    const query = dateFilter ? `?date=${encodeURIComponent(dateFilter)}` : '';
    const res = await fetch(`${this.baseUrl}/api/calendar${query}`, {
      headers: this.getAuthHeaders()
    });
    return res.ok ? res.json() : [];
  }

  /**
   * Tasks APIs
   */
  public async getTasks(status: string = 'pending'): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/tasks?status=${encodeURIComponent(status)}`, {
      headers: this.getAuthHeaders()
    });
    return res.ok ? res.json() : [];
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }
}

export const ahriMobileClient = new AhriMobileClient();
