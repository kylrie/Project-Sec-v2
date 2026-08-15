# Project Ahri (F.R.I.D.A.Y.) — Cross-Platform Cloud Sync & Notification Setup

This guide walks you through setting up **Firebase** (Auth + Push Notifications) and **Supabase** (PostgreSQL + Realtime Sync) with the **Express + Gemini AI Brain** backend.

---

## 1. Supabase Project Setup (PostgreSQL + Realtime)

### A. Create Project
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Set your Project Name (e.g. `Project-Ahri-Brain`) and generate a strong database password.
3. Select your region (e.g., `US East` or `EU Central`).

### B. Run SQL Schema Migration
1. In your Supabase Dashboard, go to **SQL Editor** -> **New Query**.
2. Open [`supabase/migrations/001_friday_schema.sql`](supabase/migrations/001_friday_schema.sql) and paste the entire script.
3. Click **Run** (or `Ctrl+Enter`).
4. This creates all 9 tables (`profiles`, `devices`, `calendar_events`, `tasks`, `emails`, `conversations`, `voice_settings`, `meetings`, `notifications`), enables Row Level Security (RLS), adds indexes, and activates **Supabase Realtime** replication.

### C. Retrieve API Keys
Go to **Project Settings** -> **API**:
- **Project URL**: `https://<your-project>.supabase.co`
- **anon (public)** key: Used in client `.env.local`
- **service_role (secret)** key: Used in backend `.env`

---

## 2. Firebase Setup (Authentication + Push Notifications)

### A. Web App & Credentials
1. Go to [Firebase Console](https://console.firebase.google.com/) -> Select project `gen-lang-client-0699733118`.
2. Go to **Authentication** -> **Sign-in method** -> Enable **Google** and **Email/Password**.
3. Go to **Project Settings** -> **General** -> **Your apps** -> Web App -> Copy configuration keys to `.env.local`.

### B. Firebase Admin Service Account Key
1. Go to **Project Settings** -> **Service accounts**.
2. Click **Generate new private key**.
3. Open the downloaded JSON file and populate:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` in your `.env`.

---

## 3. Environment Configuration

### Backend `.env`
```bash
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Firebase Admin
FIREBASE_PROJECT_ID=gen-lang-client-0699733118
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@gen-lang-client-0699733118.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Gemini 3.7 Pro AI Brain
GEMINI_API_KEY=AIzaSy...
```

### Client `.env.local`
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

VITE_FIREBASE_API_KEY=AIzaSyCKLXCdAsPlU7TFR7yFlTOL7mKMnsspvow
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0699733118.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0699733118
VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0699733118.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=189100351312
VITE_FIREBASE_APP_ID=1:189100351312:web:1ea04173d96d62d2909655

VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/live
```

---

## 4. SQLite Data Migration

To import your existing SQLite database records into Supabase:
```bash
node scripts/migrate-sqlite-to-supabase.js
```

---

## 5. Testing Multi-Device Realtime Sync

1. Start the server:
   ```bash
   npm run dev
   ```
2. Open **Tab 1** (`http://localhost:3000`) and **Tab 2** (or your phone on the local network `http://<your-lan-ip>:3000`).
3. Click **Talk with Ahri** in Tab 1 and speak: *"Add a board meeting today at 4 PM"*.
4. Observe **Tab 2** immediately updating its calendar events and tasks in sub-100ms via Supabase Realtime without refreshing.
5. In the top-right corner, check the **`Cloud Synced`** glassmorphism badge.

---

## 6. React Native Setup (Android & iOS)

For native mobile builds using React Native:
1. Install `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/messaging`.
2. Add `google-services.json` to `android/app/` and `GoogleService-Info.plist` to `ios/`.
3. In your React Native root:
   ```ts
   import messaging from '@react-native-firebase/messaging';
   import { pushNotificationService } from './src/client/services/pushNotification';

   // Request permissions
   const authStatus = await messaging().requestPermission();
   const fcmToken = await messaging().getToken();
   await pushNotificationService.sendTokenToServer(fcmToken, undefined, Platform.OS);
   ```
