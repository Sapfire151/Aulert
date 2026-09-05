<div align="center">

# Aulert

**Never miss a deadline again.**

Aulert is a centralized notification and visual calendar platform for Google Classroom — delivering real-time deadline alerts straight to your Discord server via Webhooks and Bot DMs.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js%2014-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🏫 **Google Classroom Sync** | Push notifications via Google Cloud Pub/Sub — syncs in seconds, no passwords stored |
| 🔔 **Instant Discord Alerts** | Pings your server the moment a teacher posts a new assignment |
| 📅 **Visual Calendar** | Month, Week, and Agenda views with course-colored assignments |
| ✅ **Homework Tracker** | Track, filter, and complete assignments with due-date awareness |
| 🌙 **Dark / Light Mode** | System-aware theme with a refined dark-first design |
| 🔒 **Secure by Default** | Row-Level Security (RLS) on all data, Supabase Vault for webhook URLs |
| 📱 **Responsive UI** | Full mobile support with a collapsible sidebar navigation |

---

## 🏗 Architecture

```
Google Classroom
       │
       │  Pub/Sub Push Notifications
       ▼
  Next.js API  ──────────────────────────────────┐
  (Vercel)                                        │
       │                                          │
       │  Postgres + RLS                          │  Discord Bot / Webhook
       ▼                                          ▼
   Supabase  ◄──── Railway Worker ────────► Discord Server
  (Database)       (discord.js + retry      (Channels, DMs)
                    queue consumer)
```

### Stack at a Glance

- **Frontend**: Next.js 14 App Router + TypeScript — hosted on **Vercel**
- **Design System**: Vanilla CSS tokens, dark-first (`#0e100f`), Bricolage Grotesque, outline ghost-pill controls, Alarm Orange (`#ff8709`) reserved for urgency
- **Database**: **Supabase** Postgres with RLS + Vault for encrypted secrets
- **Worker**: Always-on Node.js service on **Railway** (`discord.js` + webhook retry queue with exponential backoff)
- **Classroom Sync**: Google Cloud Pub/Sub with database-level idempotency
- **Alert Engine**: Two-trigger model — *Instant Ping* on new post, *Late Ping* daily sweep — with priority fallthrough: **DM › Bot channel › Webhook**

---

## 📁 Project Structure

```
Aulert/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx          # Greeting, Quick Stats, Urgent Items
│   │   │   ├── calendar/page.tsx           # Visual Calendar (Month / Week / Agenda)
│   │   │   ├── homework/page.tsx           # Homework tracker module
│   │   │   ├── settings/page.tsx           # Discord Webhook & Bot configuration
│   │   │   └── layout.tsx                  # App shell with NavBar
│   │   ├── api/
│   │   │   ├── webhooks/classroom-pubsub/  # Pub/Sub receiver & Instant Ping
│   │   │   └── cron/daily-late-sweep/      # Daily Late Ping sweep & token renewal
│   │   ├── auth/
│   │   │   └── school-blocked/page.tsx     # School IT block explanation page
│   │   ├── privacy/page.tsx                # Thailand PDPA Privacy Policy
│   │   ├── terms/page.tsx                  # Terms of Service
│   │   ├── globals.css                     # Design tokens, variables & typography
│   │   ├── layout.tsx                      # Root HTML layout with Google fonts
│   │   └── page.tsx                        # Landing page
│   ├── components/
│   │   ├── ui/ghost-pill.tsx               # Outline-only ghost-pill control
│   │   ├── navigation/nav-bar.tsx          # Header with theme toggle
│   │   ├── dashboard/                      # Stat cards & reconnect banner
│   │   ├── items/                          # ItemRow and DetailPanel
│   │   └── homework/                       # HomeworkModal
│   ├── lib/
│   │   ├── date-utils.ts                   # Timezone-aware date calculations
│   │   ├── course-colors.ts                # 4-hue taxonomy rotation
│   │   ├── data-provider.ts                # Demo dataset & calculation helpers
│   │   ├── alert-engine/resolver.ts        # Priority delivery resolver & deduplication
│   │   ├── classroom/client.ts             # Google Classroom client
│   │   ├── discord/embed-builder.ts        # Rich Discord embed generator
│   │   └── supabase/                       # SSR & Admin Supabase clients
│   └── types/                              # TypeScript database & app models
├── worker/                                 # Railway Discord worker
│   ├── src/
│   │   ├── index.ts                        # Worker entrypoint
│   │   ├── bot.ts                          # discord.js Gateway client
│   │   └── webhook-consumer.ts             # Retry queue (exponential backoff)
│   ├── package.json
│   └── tsconfig.json
└── supabase/
    └── schema.sql                          # Full PostgreSQL DDL, RLS & indexes
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A [Google Cloud](https://console.cloud.google.com/) project with Classroom API & Pub/Sub enabled
- A Discord application (Bot token + Webhook URL)

### 1. Install Dependencies

```bash
# Root Next.js app
npm install

# Railway Discord worker
npm --prefix worker install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth & Classroom
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_PUBSUB_TOPIC=

# Discord
DISCORD_BOT_TOKEN=
DISCORD_WEBHOOK_URL=

# App
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

### 3. Database Setup

Run the schema in your Supabase SQL Editor:

> Paste and run the contents of `supabase/schema.sql` in your Supabase Dashboard → SQL Editor.

This sets up all tables, foreign keys, indexes, and RLS policies.

### 4. Run Locally

```bash
# Start the Next.js dev server
npm run dev

# In a separate terminal — start the Discord worker
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 🛠 Development

### Type Checking

```bash
# Next.js app
npm run type-check

# Discord worker
npm --prefix worker run type-check
```

### Production Build

```bash
npm run build
```

---

## 🔐 Security Notes

> **Never commit service account JSON files or `.env` files.**
> The `.gitignore` excludes all `*.json` files except known-safe config files (`package.json`, `tsconfig.json`, etc.) to prevent accidental credential leaks.

- All Discord webhook URLs are encrypted at rest via **Supabase Vault**
- Database access is gated by **Row-Level Security** — users can only read/write their own data
- Google OAuth tokens are stored server-side only, never exposed to the client

---

## 📄 License

This project is for educational and personal use.

---

<div align="center">
  Built with ❤️ using Next.js, Supabase, and Discord
</div>
