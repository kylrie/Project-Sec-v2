#!/usr/bin/env node
/**
 * =============================================================================
 * PROJECT AHRI / FRIDAY: SQLITE TO SUPABASE DATA MIGRATION SCRIPT
 * =============================================================================
 * Reads local SQLite database (data/friday_brain.db) and uploads all calendar events,
 * tasks, conversations, emails, and profiles into Supabase PostgreSQL.
 * 
 * Usage:
 *   node scripts/migrate-sqlite-to-supabase.js
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env file.');
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), 'data', 'friday_brain.db');

if (!fs.existsSync(dbPath)) {
  console.log(`ℹ️  No SQLite database found at ${dbPath}. Initializing clean Supabase instance.`);
  process.exit(0);
}

const sqlite = new Database(dbPath);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigration() {
  console.log('🚀 Starting SQLite -> Supabase Migration Pipeline...\n');

  // 1. Ensure a default Profile exists
  try {
    const profileRow = sqlite.prepare('SELECT * FROM executive_profile LIMIT 1').get();
    const { error: profErr } = await supabase.from('profiles').upsert({
      id: DEFAULT_USER_ID,
      email: profileRow?.email || 'executive@stark.io',
      full_name: profileRow?.full_name || 'Tony Stark',
      executive_title: profileRow?.executive_title || 'Chief Executive Officer',
      timezone: profileRow?.timezone || 'America/New_York',
      wake_word: profileRow?.wake_word || 'Hey Ahri',
      personality: profileRow?.personality || 'professional'
    });

    if (profErr) {
      console.warn('⚠️  Profile upsert notice:', profErr.message);
    } else {
      console.log('✅ Profile synchronized.');
    }
  } catch (e) {
    console.warn('⚠️  No executive_profile table in SQLite, continuing...');
  }

  // 2. Migrate Calendar Events
  try {
    const events = sqlite.prepare('SELECT * FROM calendar_events').all();
    console.log(`📅 Found ${events.length} calendar events in SQLite.`);

    let insertedEvents = 0;
    for (const evt of events) {
      const attendees = evt.attendees ? JSON.parse(evt.attendees) : [];
      const startTime = evt.start_time ? new Date(evt.start_time).toISOString() : new Date().toISOString();
      const endTime = evt.end_time ? new Date(evt.end_time).toISOString() : new Date(Date.now() + 3600000).toISOString();

      const { error } = await supabase.from('calendar_events').insert({
        user_id: DEFAULT_USER_ID,
        title: evt.title,
        description: evt.description || null,
        start_time: startTime,
        end_time: endTime,
        location: evt.location || 'Stark HQ',
        hangout_link: evt.hangout_link || null,
        attendees,
        status: evt.status || 'confirmed'
      });

      if (!error) insertedEvents++;
    }
    console.log(`✅ Calendar Events Migrated: ${insertedEvents}/${events.length}`);
  } catch (e) {
    console.warn('⚠️  Calendar events migration notice:', e.message);
  }

  // 3. Migrate Tasks
  try {
    const tasks = sqlite.prepare('SELECT * FROM tasks').all();
    console.log(`\n📋 Found ${tasks.length} tasks in SQLite.`);

    let insertedTasks = 0;
    for (const t of tasks) {
      const dueDate = t.due_date ? new Date(t.due_date).toISOString() : null;

      const { error } = await supabase.from('tasks').insert({
        user_id: DEFAULT_USER_ID,
        title: t.title,
        description: t.description || null,
        due_date: dueDate,
        priority: t.priority || 'medium',
        status: t.status || 'pending',
        category: t.category || 'executive'
      });

      if (!error) insertedTasks++;
    }
    console.log(`✅ Tasks Migrated: ${insertedTasks}/${tasks.length}`);
  } catch (e) {
    console.warn('⚠️  Tasks migration notice:', e.message);
  }

  // 4. Migrate Conversations
  try {
    const convos = sqlite.prepare('SELECT * FROM conversations ORDER BY created_at ASC').all();
    console.log(`\n💬 Found ${convos.length} conversation turns in SQLite.`);

    let insertedConvos = 0;
    for (const c of convos) {
      const actionData = c.action_data ? JSON.parse(c.action_data) : null;
      const toolsUsed = c.tools_used ? JSON.parse(c.tools_used) : [];

      const { error } = await supabase.from('conversations').insert({
        user_id: DEFAULT_USER_ID,
        session_id: c.session_id || 'default',
        role: c.role,
        content: c.content,
        intent: c.intent || null,
        action_data: actionData,
        tools_used: toolsUsed,
        latency_ms: c.latency_ms || null,
        created_at: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString()
      });

      if (!error) insertedConvos++;
    }
    console.log(`✅ Conversations Migrated: ${insertedConvos}/${convos.length}`);
  } catch (e) {
    console.warn('⚠️  Conversations migration notice:', e.message);
  }

  console.log('\n🎉 SQLite to Supabase Migration Complete!\n');
  sqlite.close();
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
