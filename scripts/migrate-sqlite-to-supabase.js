#!/usr/bin/env node
/**
 * =============================================================================
 * PROJECT AHRI / FRIDAY: SQLITE TO SUPABASE DATA MIGRATION SCRIPT
 * =============================================================================
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xnqfhjlqowjeepnygbdn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env file.');
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), 'data', 'friday_brain.db');

if (!fs.existsSync(dbPath)) {
  console.log(`ℹ️  No SQLite database found at ${dbPath}.`);
  process.exit(0);
}

const sqlite = new Database(dbPath);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function parseDateSafe(val) {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') return new Date(val).toISOString();
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

async function runMigration() {
  console.log('🚀 Starting SQLite -> Supabase Migration Pipeline...\n');

  // Test connection to Supabase
  const { error: testErr } = await supabase.from('profiles').select('id').limit(1);
  if (testErr) {
    console.error(`\n❌ ERROR: Cannot access Supabase tables (${testErr.message}).`);
    console.error('👉 Please make sure you have executed the SQL script in your Supabase SQL Editor:');
    console.error('   File: supabase/migrations/001_friday_schema.sql\n');
    process.exit(1);
  }

  // 1. Get or create default user in auth / profiles
  let targetUserId;
  const { data: existingProfiles } = await supabase.from('profiles').select('id').limit(1);
  if (existingProfiles && existingProfiles.length > 0) {
    targetUserId = existingProfiles[0].id;
  } else {
    // If no profiles yet, check auth.users or create a placeholder profile
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    if (authUsers && authUsers.users && authUsers.users.length > 0) {
      targetUserId = authUsers.users[0].id;
    } else {
      console.log('ℹ️  No auth users found in Supabase yet. Creating demo executive profile.');
      const demoUser = await supabase.auth.admin.createUser({
        email: 'tony.stark@enterprise.io',
        password: 'TemporaryPassword123!',
        email_confirm: true,
        user_metadata: { full_name: 'Tony Stark' }
      });
      targetUserId = demoUser.data?.user?.id;
    }
  }

  if (!targetUserId) {
    console.error('❌ Could not establish target user ID for migration.');
    process.exit(1);
  }

  console.log(`👤 Target User ID: ${targetUserId}`);

  // 2. Migrate Calendar Events
  try {
    const events = sqlite.prepare('SELECT * FROM calendar_events').all();
    console.log(`📅 Found ${events.length} calendar events in SQLite.`);

    let insertedEvents = 0;
    for (const evt of events) {
      const attendees = evt.attendees ? JSON.parse(evt.attendees) : [];
      const startTime = parseDateSafe(evt.start_time || evt.created_at);
      const endTime = parseDateSafe(evt.end_time || (Date.now() + 3600000));

      const { error } = await supabase.from('calendar_events').insert({
        user_id: targetUserId,
        title: evt.title,
        description: evt.notes || null,
        start_time: startTime,
        end_time: endTime,
        location: evt.location || 'Stark HQ',
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
      const dueDate = t.due_date ? parseDateSafe(t.due_date) : null;

      const { error } = await supabase.from('tasks').insert({
        user_id: targetUserId,
        title: t.title,
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
    const convos = sqlite.prepare('SELECT * FROM conversations ORDER BY timestamp ASC').all();
    console.log(`\n💬 Found ${convos.length} conversation turns in SQLite.`);

    let insertedConvos = 0;
    for (const c of convos) {
      const actionData = c.action_data ? JSON.parse(c.action_data) : null;
      const toolsUsed = c.tools_used ? JSON.parse(c.tools_used) : [];

      const textContent = c.content || c.text || 'Action acknowledged.';

      const { error } = await supabase.from('conversations').insert({
        user_id: targetUserId,
        session_id: c.session_id || 'default',
        role: c.role || 'user',
        content: textContent,
        intent: c.intent || null,
        action_data: actionData,
        tools_used: toolsUsed,
        latency_ms: c.latency_ms || null,
        created_at: parseDateSafe(c.timestamp)
      });

      if (!error) {
        insertedConvos++;
      } else {
        console.warn(`⚠️ Conversation turn failed (${c.role}):`, error.message);
      }
    }
    console.log(`✅ Conversations Migrated: ${insertedConvos}/${convos.length}`);
  } catch (e) {
    console.warn('⚠️  Conversations migration notice:', e.message);
  }

  console.log('\n🎉 SQLite to Supabase Migration Pipeline Finished Successfully!\n');
  sqlite.close();
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
