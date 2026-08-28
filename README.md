<div align="center">

# 🎓 Aulert

**Your Google Classroom updates, in one calm place.**

[Open Aulert](https://aulert.vercel.app)
· [Report an issue](https://github.com/Sapfire151/Aulert/issues)
· [Privacy](privacy.html)
· [Terms](terms.html)

</div>

---

## What Aulert does

Aulert gives students a focused view of Google Classroom: one feed for announcements,
assignments, and materials; a deadline calendar; and a personal homework tracker. Optional
**Discord notifications** keep selected channels updated even when the web app is closed.

| Feature | What it gives you |
| --- | --- |
| **Unified activity feed** | New announcements, assignments, and materials without jumping between classrooms. |
| **Deadline calendar** | A monthly view of Classroom due dates and personal homework. |
| **Homework tracker** | Add, prioritize, complete, and share your own tasks. |
| **Discord notifications** | Concise Classroom updates sent to up to five Discord incoming webhooks. |
| **Privacy choices** | Essential storage for the app, plus an explicit accept/reject choice for analytics. |

---

## Architecture

Aulert is a static-frontend app with Vercel serverless functions and a Firebase Realtime
Database backing the optional Discord service.

| Layer | Technology |
| --- | --- |
| Frontend | Vanilla TypeScript (compiled to the `script-app*.js` bundles the HTML loads) |
| API | [Vercel serverless functions](api/) written in **TypeScript** |
| Database | Firebase Realtime Database (user config, delivery state, realtime `syncTick`) |
| Cache | Upstash Redis (optional; in-memory fallback when unconfigured) |
| Integrations | Google Classroom API, Google RISC security events, Discord webhooks |

### Event-driven updates

The client no longer relies on fixed-interval polling. Instead it subscribes to Firebase
`users/{id}/syncTick` via `onValue`. Whenever the server detects new activity — the daily
digest cron or a Classroom push receiver — it bumps `syncTick`, and the client refreshes
immediately. Polling still runs as a visibility-gated safety net (paused in background tabs).

### Caching

`api/lib/cache.ts` short-circuits repeated Google Classroom API calls and Discord config
reads. It uses Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
are set, and transparently falls back to an in-memory store otherwise.

### Security

Every API handler applies defense-in-depth security headers (CSP, HSTS, `X-Frame-Options`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy`), centralised in `api/lib/security.ts`
and reinforced at the edge in `vercel.json`. The daily-digest endpoint is protected by a
shared-secret rate limiter and a `CRON_SECRET` check.

---

## Get started

1. Visit [aulert.vercel.app](https://aulert.vercel.app).
2. Connect your Google Classroom account.
3. Open **Settings** to tune in-app notifications or connect Discord.

### Connect Discord

1. In Discord, create an **incoming webhook** for the channel you want to receive updates.
2. In Aulert **Settings**, give the destination a label and paste the webhook URL.
3. Approve the separate offline Classroom permission when prompted. Aulert sends a test
   message before saving the destination.

Discord delivery is triggered by the daily digest scheduled in `vercel.json` (daily at
08:00 UTC) and by event-driven `syncTick` bumps; the web app itself refreshes as soon as
new data arrives.

---

## Privacy and security

- Core Classroom viewing happens in the browser.
- Discord notifications are optional. Their Google refresh token and webhook URL are
  encrypted before storage; URLs are never returned to the browser after setup.
- Disconnecting Discord permanently removes its stored credentials and destinations.
- The app uses short-lived Google access cookies. It attempts a no-prompt restoration when
  Google permits it, then asks you to reconnect only when Google requires interaction.
- Analytics does not load until the user explicitly accepts it.

Read the full [Privacy Policy](privacy.html) and [Terms of Service](terms.html).

---

## Development

### Prerequisites

- Node.js 18+ (Vercel's runtime)
- A Firebase service account (or `FIREBASE_SERVICE_ACCOUNT` env var)
- Optional: an Upstash Redis instance for the cache layer

### Install

```bash
npm install
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run typecheck` | Type-check the **API and frontend** TypeScript (`tsc --noEmit`). |
| `npm run typecheck:api` | Type-check only the API. |
| `npm run typecheck:frontend` | Type-check only the frontend. |
| `npm run build` | Compile the frontend bundles and build the Morphicons icon runtime. |
| `npm run build:frontend` | Compile `src/frontend/` into the browser bundles used by `app.html`. |
| `npm run build:icons` | Build `morphicon-icons.js` with production-safe environment definitions. |
| `npm run lint` | Run ESLint (security plugin) over the frontend bundles. |
| `npm run security:audit` | Run `npm audit` at the `high` level. |

The frontend is authored in `src/frontend/` as TypeScript and built into the root
`script-app*.js` files that `app.html` references. Icon definitions are authored in
`src/frontend/icons-react.tsx` and compiled to `morphicon-icons.js`. Edit the source files,
then run `npm run build`; do not hand-edit generated bundles. Vercel runs the same build
automatically on deploy; the API functions are compiled by Vercel's own bundler.

For a local static preview after building, serve the repository root on any local HTTP server
(for example `npx serve . -l 5501`) and open `http://localhost:5501`.

---

## Environment variables

Set these in the Vercel dashboard (or your local environment). Required variables must be
present for the app to function; optional ones unlock additional capabilities.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_SECRET` | ✅ | Exchanges the optional offline Google authorization. |
| `DISCORD_WEBHOOK_ENCRYPTION_KEY` | ✅ | 32-byte base64 value or 64-character hex key used to encrypt Discord URLs and refresh tokens. |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | Firebase Admin service-account JSON. |
| `CRON_SECRET` | ✅ | Protects the scheduled Discord delivery job. |
| `ALLOWED_ORIGIN` | ⬜ | CORS origin override; defaults to the production app URL. |
| `CLIENT_ID` | ⬜ | Google OAuth Client ID; falls back to the bundled default if unset. |
| `UPSTASH_REDIS_REST_URL` | ⬜ | Enables the Redis cache layer (with `UPSTASH_REDIS_REST_TOKEN`). |
| `UPSTASH_REDIS_REST_TOKEN` | ⬜ | Upstash Redis REST token. |
| `PUSH_SECRET` | ⬜ | Shared secret that authenticates the Classroom push receiver. |
| `CLASSROOM_PUSH_ADDRESS` | ⬜ | Public URL of `/api/classroomPush` for Google Workspace push notifications. |

Never commit real webhook URLs, Firebase credentials, or encryption keys. See
[`.env-example`](.env-example) for the full reference. Keep local values in an ignored
`.env.local` file; never add production credentials to a checked-in environment file.

---

## Deployment

Deploy with the Vercel CLI or Git integration. `vercel.json` wires:

- a daily cron at `0 8 * * *` hitting `/api/dailyDigest`, and
- global security headers on every response plus `no-store` on `/api/*`.

`npm run build` runs during the build step to produce the frontend bundles.

---

## Built by students, for students

- [esrazti](https://github.com/esrazti)
- [Sapfire151](https://github.com/Sapfire151)
