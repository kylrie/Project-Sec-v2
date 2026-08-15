import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize or connect to persistent SQLite Database
const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'friday_brain.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
  `);

  // Run seed data in dev by default; opt-out with SEED_DEMO_DATA=false
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA !== 'false') {
    seedInitialData();
  }
}

/**
 * Seed initial executive state if database is fresh (only in dev mode with SEED_DEMO_DATA=true)
 */
function seedInitialData() {
  const eventCount = db.prepare('SELECT count(*) as count FROM calendar_events').get() as { count: number };
  if (eventCount.count === 0) {
    const insertEvent = db.prepare(`
      INSERT INTO calendar_events (id, title, start_time, end_time, date, location, attendees, status, created_at)
      VALUES (@id, @title, @start_time, @end_time, @date, @location, @attendees, @status, @created_at)
    `);

    const now = Date.now();
    insertEvent.run({
      id: 'evt-101',
      title: 'Executive Briefing & Daily Standup',
      start_time: '10:00 AM',
      end_time: '10:45 AM',
      date: 'Today',
      location: 'Conference Room 4A / Virtual',
      attendees: JSON.stringify(['Demo User 2', 'Demo User 3']),
      status: 'confirmed',
      created_at: now
    });

    insertEvent.run({
      id: 'evt-102',
      title: 'Board Review & Q3 Financial Strategy',
      start_time: '04:00 PM',
      end_time: '05:30 PM',
      date: 'Today',
      location: 'Executive Boardroom',
      attendees: JSON.stringify(['Demo User 4 (CFO)', 'Demo User 2']),
      status: 'confirmed',
      created_at: now
    });

    insertEvent.run({
      id: 'evt-103',
      title: 'Neural Architecture Sync',
      start_time: '02:00 PM',
      end_time: '03:00 PM',
      date: 'Tomorrow',
      location: 'Virtual Lab 1',
      attendees: JSON.stringify(['Demo User 3', 'Demo User 4']),
      status: 'confirmed',
      created_at: now
    });
  }

  const contactCount = db.prepare('SELECT count(*) as count FROM contacts').get() as { count: number };
  if (contactCount.count === 0) {
    const insertContact = db.prepare(`
      INSERT INTO contacts (id, name, email, phone, role, company, is_vip, notes, created_at)
      VALUES (@id, @name, @email, @phone, @role, @company, @is_vip, @notes, @created_at)
    `);

    const now = Date.now();
    insertContact.run({
      id: 'cnt-1',
      name: 'Demo User 2',
      email: 'demo.user.2@example.com',
      phone: '+1 (555) 019-2834',
      role: 'Chief Executive Officer',
      company: 'Demo Corp',
      is_vip: 1,
      notes: 'Direct bypass authorization for all urgent calendar items.',
      created_at: now
    });

    insertContact.run({
      id: 'cnt-2',
      name: 'Demo User 3',
      email: 'demo.user.3@example.com',
      phone: '+1 (555) 384-9921',
      role: 'VP of Product',
      company: 'Demo Enterprise',
      is_vip: 1,
      notes: 'Lead on Q3 Enterprise platform rollouts.',
      created_at: now
    });

    insertContact.run({
      id: 'cnt-3',
      name: 'Demo User 4',
      email: 'demo.user.4@example.com',
      phone: '+1 (555) 912-4411',
      role: 'Chief Financial Officer',
      company: 'Demo Corp',
      is_vip: 1,
      notes: 'Requires budget approvals by 5 PM.',
      created_at: now
    });
  }

  const taskCount = db.prepare('SELECT count(*) as count FROM tasks').get() as { count: number };
  if (taskCount.count === 0) {
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, title, due_date, priority, status, category, created_at)
      VALUES (@id, @title, @due_date, @priority, @status, @category, @created_at)
    `);

    const now = Date.now();
    insertTask.run({
      id: 'tsk-1',
      title: 'Review and sign Q3 budget allocation deck',
      due_date: 'Today, 5:00 PM',
      priority: 'high',
      status: 'pending',
      category: 'executive',
      created_at: now
    });

    insertTask.run({
      id: 'tsk-2',
      title: 'Authorize security vault key rotation',
      due_date: 'Tomorrow, 12:00 PM',
      priority: 'medium',
      status: 'pending',
      category: 'security',
      created_at: now
    });
  }

  const memoryCount = db.prepare('SELECT count(*) as count FROM memory_facts').get() as { count: number };
  if (memoryCount.count === 0) {
    const insertMemory = db.prepare(`
      INSERT INTO memory_facts (id, category, fact_key, fact_value, confidence, created_at, updated_at)
      VALUES (@id, @category, @fact_key, @fact_value, @confidence, @created_at, @updated_at)
    `);

    const now = Date.now();
    insertMemory.run({
      id: 'mem-1',
      category: 'preference',
      fact_key: 'preferred_meeting_duration',
      fact_value: '30 minutes default, mornings preferred for strategic reviews',
      confidence: 1.0,
      created_at: now,
      updated_at: now
    });

    insertMemory.run({
      id: 'mem-2',
      category: 'executive',
      fact_key: 'primary_timezone',
      fact_value: 'America/New_York (EST)',
      confidence: 1.0,
      created_at: now,
      updated_at: now
    });
  }

  const emailCount = db.prepare('SELECT count(*) as count FROM emails').get() as { count: number };
  if (emailCount.count === 0) {
    const insertEmail = db.prepare(`
      INSERT INTO emails (id, thread_id, from_name, from_email, to_email, subject, body, snippet, is_unread, urgency, created_at)
      VALUES (@id, @thread_id, @from_name, @from_email, @to_email, @subject, @body, @snippet, @is_unread, @urgency, @created_at)
    `);

    const now = Date.now();
    insertEmail.run({
      id: 'em-1',
      thread_id: 'th-1',
      from_name: 'Demo User 3',
      from_email: 'demo.user.3@example.com',
      to_email: 'demo.user.1@example.com',
      subject: 'URGENT: Budget Approval Deadline Today at 5 PM',
      body: 'We need authorization on the finalized Q3 budget allocation before 5 PM today for committee circulation.',
      snippet: 'We need authorization on the finalized Q3 budget allocation...',
      is_unread: 1,
      urgency: 'urgent',
      created_at: now - 900000
    });

    insertEmail.run({
      id: 'em-2',
      thread_id: 'th-2',
      from_name: 'Demo User 4',
      from_email: 'demo.user.4@example.com',
      to_email: 'demo.user.1@example.com',
      subject: 'Sync on neural voice architecture tomorrow',
      body: 'Confirming our 2 PM sync tomorrow to review the low-latency WebGL voice engine metrics.',
      snippet: 'Confirming our 2 PM sync tomorrow to review neural voice metrics...',
      is_unread: 1,
      urgency: 'standard',
      created_at: now - 3600000
    });
  }
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
  }
};
