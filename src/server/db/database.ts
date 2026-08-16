import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize or connect to persistent SQLite Database
function resolveDatabaseDirectory(): string {
  if (process.env.AHRI_DATA_DIR && process.env.AHRI_DATA_DIR.trim().length > 0) {
    return process.env.AHRI_DATA_DIR;
  }
  if (process.env.NODE_ENV === 'production' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'Project Ahri', 'data');
  }
  return path.resolve(process.cwd(), 'data');
}

const DB_DIR = resolveDatabaseDirectory();
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (dirErr) {
  console.warn('[Database] Could not create target data directory:', DB_DIR, dirErr);
}

const DB_PATH = path.join(DB_DIR, 'ahri_brain.db');
console.log(`[Project Ahri Database] Loading SQLite from: ${DB_PATH}`);

export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
try {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (pragmaErr) {
  console.warn('[Database] PRAGMA configuration notice:', pragmaErr);
}

/**
 * Initialize all database schemas
 */
export function initDatabase() {
  db.exec(`
    -- 1. Conversation History & Multi-turn Context
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      intent TEXT,
      latency_ms INTEGER,
      tools_used TEXT,
      timestamp INTEGER NOT NULL
    );

    -- 2. Long-Term Executive Memory & Facts
    CREATE TABLE IF NOT EXISTS memory_facts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'general',
      fact_key TEXT NOT NULL UNIQUE,
      fact_value TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 3. Calendar & Events
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT,
      attendees TEXT, -- JSON array
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    -- 4. Tasks & Action Items
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      due_date TEXT,
      priority TEXT DEFAULT 'medium', -- low, medium, high
      status TEXT DEFAULT 'pending',   -- pending, in_progress, completed, cancelled
      category TEXT DEFAULT 'executive',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- 5. Emails & Inbound Comms
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      thread_id TEXT,
      from_name TEXT NOT NULL,
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      snippet TEXT,
      is_unread INTEGER DEFAULT 1,
      urgency TEXT DEFAULT 'standard', -- urgent, standard, newsletter
      created_at INTEGER NOT NULL
    );

    -- 6. Executive Contacts
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      company TEXT,
      is_vip INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    -- 7. Meeting Minutes & Sessions
    CREATE TABLE IF NOT EXISTS meeting_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      transcript TEXT,
      executive_summary TEXT, -- JSON array
      detailed_minutes TEXT,  -- JSON array
      action_items TEXT,      -- JSON array
      decisions TEXT,         -- JSON array
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      created_at INTEGER NOT NULL
    );

    -- 8. Communication Logs (SMS, Calls, Messenger, Viber)
    CREATE TABLE IF NOT EXISTS communications_log (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL, -- sms, phone_call, messenger, viber, gmail
      direction TEXT DEFAULT 'inbound', -- inbound, outbound
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'delivered',
      timestamp INTEGER NOT NULL
    );

    -- 9. Active Timers
    CREATE TABLE IF NOT EXISTS timers (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      total_seconds INTEGER NOT NULL,
      remaining_seconds INTEGER NOT NULL,
      is_running INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    -- 10. Reminders
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      due_time TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- 11. Executive Profile & Preferences
    CREATE TABLE IF NOT EXISTS executive_profile (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 12. Cross-Device Neural Mesh Nodes
    CREATE TABLE IF NOT EXISTS device_nodes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      local_ip TEXT,
      ws_connected INTEGER DEFAULT 0,
      last_seen INTEGER NOT NULL,
      capabilities TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, device_name)
    );

    -- 13. Proactive Executive Suggestions
    CREATE TABLE IF NOT EXISTS proactive_suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'calendar',
      action_intent TEXT,
      action_payload TEXT DEFAULT '{}',
      spoken_prompt TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);


  // Seed data permanently disabled — app starts with a clean database
  // To enable demo data, set SEED_DEMO_DATA=true in your .env
  if (process.env.SEED_DEMO_DATA === 'true') {
    seedInitialData();
  }
}

/**
 * Seed initial executive state — DISABLED by default.
 * Enable by setting SEED_DEMO_DATA=true in .env
 */
function seedInitialData(): void {
  // Seed data disabled — app starts with a clean database
  console.log('[Project Ahri Database] Starting with clean database (no demo data)');
}

// =========================================================================
// REPOSITORY HELPERS FOR AI TOOLS
// =========================================================================

export const dbRepository = {
  // Conversations
  saveConversation: (turn: { id: string; sessionId: string; role: string; text: string; intent?: string; latencyMs?: number; toolsUsed?: string[] }) => {
    const stmt = db.prepare(`
      INSERT INTO conversations (id, session_id, role, text, intent, latency_ms, tools_used, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      turn.id,
      turn.sessionId,
      turn.role,
      turn.text,
      turn.intent || null,
      turn.latencyMs || null,
      turn.toolsUsed ? JSON.stringify(turn.toolsUsed) : null,
      Date.now()
    );
  },

  getRecentConversations: (sessionId: string = 'default', limit: number = 8) => {
    const stmt = db.prepare(`
      SELECT role, text, intent, timestamp FROM conversations
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(sessionId, limit) as any[];
    return rows.reverse();
  },

  // Long-term Memory Facts
  saveMemoryFact: (factKey: string, factValue: string, category: string = 'general') => {
    const stmt = db.prepare(`
      INSERT INTO memory_facts (id, category, fact_key, fact_value, confidence, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1.0, ?, ?)
      ON CONFLICT(fact_key) DO UPDATE SET
        fact_value = excluded.fact_value,
        category = excluded.category,
        updated_at = excluded.updated_at
    `);
    const now = Date.now();
    stmt.run(`mem-${Math.random().toString(36).substring(2, 9)}`, category, factKey, factValue, now, now);
    return { factKey, factValue, category };
  },

  getMemoryFacts: (limit: number = 20) => {
    const stmt = db.prepare(`SELECT fact_key, fact_value, category FROM memory_facts ORDER BY updated_at DESC LIMIT ?`);
    return stmt.all(limit) as { fact_key: string; fact_value: string; category: string }[];
  },

  // Calendar
  listCalendarEvents: (dateFilter?: string) => {
    if (dateFilter) {
      const stmt = db.prepare(`SELECT * FROM calendar_events WHERE date LIKE ? ORDER BY start_time ASC`);
      return stmt.all(`%${dateFilter}%`);
    }
    const stmt = db.prepare(`SELECT * FROM calendar_events ORDER BY created_at DESC LIMIT 15`);
    return stmt.all();
  },

  createCalendarEvent: (event: { title: string; startTime: string; endTime?: string; date?: string; location?: string; attendees?: string[] }) => {
    const id = `evt-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO calendar_events (id, title, start_time, end_time, date, location, attendees, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `);
    const date = event.date || 'Today';
    const endTime = event.endTime || 'Next hour';
    const attendeesJson = event.attendees ? JSON.stringify(event.attendees) : JSON.stringify([]);
    stmt.run(id, event.title, event.startTime, endTime, date, event.location || 'Executive HQ / Virtual', attendeesJson, Date.now());
    return { id, ...event, date, endTime };
  },

  deleteCalendarEvent: (titleOrId: string) => {
    const stmt = db.prepare(`DELETE FROM calendar_events WHERE id = ? OR title LIKE ?`);
    const info = stmt.run(titleOrId, `%${titleOrId}%`);
    return { success: info.changes > 0, deletedCount: info.changes };
  },

  // Tasks
  listTasks: (status: string = 'pending') => {
    const stmt = db.prepare(`SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC`);
    return stmt.all(status);
  },

  createTask: (title: string, dueDate?: string, priority: string = 'medium') => {
    const id = `tsk-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO tasks (id, title, due_date, priority, status, category, created_at)
      VALUES (?, ?, ?, ?, 'pending', 'executive', ?)
    `);
    stmt.run(id, title, dueDate || 'Today', priority, Date.now());
    return { id, title, dueDate, priority, status: 'pending' };
  },

  completeTask: (titleOrId: string) => {
    const stmt = db.prepare(`
      UPDATE tasks SET status = 'completed', completed_at = ?
      WHERE id = ? OR title LIKE ?
    `);
    const info = stmt.run(Date.now(), titleOrId, `%${titleOrId}%`);
    return { success: info.changes > 0 };
  },

  // Emails
  listEmails: (unreadOnly: boolean = false) => {
    const query = unreadOnly 
      ? `SELECT * FROM emails WHERE is_unread = 1 ORDER BY created_at DESC LIMIT 10`
      : `SELECT * FROM emails ORDER BY created_at DESC LIMIT 10`;
    return db.prepare(query).all();
  },

  createDraftEmail: (to: string, subject: string, body: string) => {
    const id = `em-draft-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO emails (id, thread_id, from_name, from_email, to_email, subject, body, snippet, is_unread, urgency, created_at)
      VALUES (?, ?, 'Executive User', 'user@example.com', ?, ?, ?, ?, 0, 'standard', ?)
    `);
    stmt.run(id, id, to, subject, body, body.substring(0, 80), Date.now());
    return { id, to, subject, body, status: 'draft_created' };
  },

  // Contacts
  searchContacts: (query: string) => {
    const stmt = db.prepare(`
      SELECT * FROM contacts 
      WHERE name LIKE ? OR email LIKE ? OR role LIKE ? OR company LIKE ?
    `);
    const q = `%${query}%`;
    return stmt.all(q, q, q, q);
  },

  // Meeting Sessions
  saveMeetingSummary: (session: { title: string; summary: string[]; minutes: any[]; decisions: string[]; actionItems: any[] }) => {
    const id = `meet-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO meeting_sessions (id, title, executive_summary, detailed_minutes, decisions, action_items, start_time, end_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    stmt.run(
      id,
      session.title,
      JSON.stringify(session.summary),
      JSON.stringify(session.minutes),
      JSON.stringify(session.decisions),
      JSON.stringify(session.actionItems),
      now - 1800000,
      now,
      now
    );
    return { id, ...session };
  },

  // Timers & Reminders
  setTimer: (label: string, durationSeconds: number) => {
    const id = `tmr-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO timers (id, label, total_seconds, remaining_seconds, is_running, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    stmt.run(id, label || 'Timer', durationSeconds, durationSeconds, Date.now());
    return { id, label, durationSeconds };
  },

  setReminder: (task: string, dueTime: string, priority: string = 'medium') => {
    const id = `rem-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO reminders (id, task, due_time, priority, completed, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `);
    stmt.run(id, task, dueTime, priority, Date.now());
    return { id, task, dueTime, priority };
  },

  // 12. Device Mesh Nodes
  upsertDeviceNode: (userId: string, node: {
    deviceName: string;
    deviceType: string;
    platform: string;
    localIp?: string;
    capabilities?: string[];
    metadata?: any;
  }) => {
    const id = `dev-${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO device_nodes (id, user_id, device_name, device_type, platform, local_ip, ws_connected, last_seen, capabilities, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(user_id, device_name) DO UPDATE SET
        device_type = excluded.device_type,
        platform = excluded.platform,
        local_ip = excluded.local_ip,
        ws_connected = 1,
        last_seen = excluded.last_seen,
        capabilities = excluded.capabilities,
        metadata = excluded.metadata
    `);
    stmt.run(
      id,
      userId,
      node.deviceName,
      node.deviceType,
      node.platform,
      node.localIp || null,
      now,
      JSON.stringify(node.capabilities || []),
      JSON.stringify(node.metadata || {}),
      now
    );
    const getStmt = db.prepare(`SELECT * FROM device_nodes WHERE user_id = ? AND device_name = ?`);
    const row: any = getStmt.get(userId, node.deviceName);
    if (row) {
      row.capabilities = JSON.parse(row.capabilities || '[]');
      row.metadata = JSON.parse(row.metadata || '{}');
      row.ws_connected = Boolean(row.ws_connected);
    }
    return row;
  },

  listDeviceNodes: (userId: string) => {
    const stmt = db.prepare(`SELECT * FROM device_nodes WHERE user_id = ? ORDER BY last_seen DESC`);
    const rows: any[] = stmt.all(userId);
    return rows.map(r => ({
      ...r,
      capabilities: JSON.parse(r.capabilities || '[]'),
      metadata: JSON.parse(r.metadata || '{}'),
      ws_connected: Boolean(r.ws_connected)
    }));
  },

  updateDeviceNodeStatus: (userId: string, deviceName: string, connected: boolean) => {
    const stmt = db.prepare(`UPDATE device_nodes SET ws_connected = ?, last_seen = ? WHERE user_id = ? AND device_name = ?`);
    stmt.run(connected ? 1 : 0, Date.now(), userId, deviceName);
  },

  // 13. Proactive Suggestions
  saveProactiveSuggestion: (userId: string, suggestion: {
    title: string;
    description: string;
    urgency?: string;
    category?: string;
    actionIntent?: string;
    actionPayload?: any;
    spokenPrompt?: string;
    expiresAt?: number;
  }) => {
    const id = `sug-${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO proactive_suggestions (id, user_id, title, description, urgency, category, action_intent, action_payload, spoken_prompt, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);
    stmt.run(
      id,
      userId,
      suggestion.title,
      suggestion.description,
      suggestion.urgency || 'medium',
      suggestion.category || 'calendar',
      suggestion.actionIntent || null,
      JSON.stringify(suggestion.actionPayload || {}),
      suggestion.spokenPrompt || null,
      suggestion.expiresAt || null,
      now
    );
    return { id, userId, ...suggestion, status: 'active', createdAt: now };
  },

  listProactiveSuggestions: (userId: string, status: string = 'active') => {
    const stmt = db.prepare(`SELECT * FROM proactive_suggestions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 10`);
    const rows: any[] = stmt.all(userId, status);
    return rows.map(r => ({
      ...r,
      action_payload: JSON.parse(r.action_payload || '{}')
    }));
  },

  dismissProactiveSuggestion: (userId: string, id: string) => {
    const stmt = db.prepare(`UPDATE proactive_suggestions SET status = 'dismissed' WHERE user_id = ? AND id = ?`);
    stmt.run(userId, id);
    return { success: true };
  },

  executeProactiveSuggestion: (userId: string, id: string) => {
    const stmt = db.prepare(`UPDATE proactive_suggestions SET status = 'executed' WHERE user_id = ? AND id = ?`);
    stmt.run(userId, id);
    return { success: true };
  }
};

