<div align="center">
  <h1>🎓 Aulert</h1>
  <p><strong>Your Google Classroom updates, in one calm place.</strong></p>
  <p>
    <a href="https://aulert.vercel.app">Open Aulert</a>
    · <a href="https://github.com/Sapfire151/Aulert/issues">Report an issue</a>
    · <a href="privacy.html">Privacy</a>
  </p>
</div>

## What Aulert does

Aulert gives students a focused view of Google Classroom: one feed for announcements, assignments, and materials; a deadline calendar; and a personal homework tracker. Optional Discord Notifications keep selected channels updated even when the web app is closed.

| Feature | What it gives you |
| --- | --- |
| Unified activity feed | New announcements, assignments, and materials without jumping between classrooms. |
| Deadline calendar | A monthly view of Classroom due dates and personal homework. |
| Homework tracker | Add, prioritize, complete, and share your own tasks. |
| Discord Notifications | Send concise Classroom updates to up to five Discord incoming webhooks. |
| Privacy choices | Essential storage for the app, plus an explicit accept/reject choice for analytics. |

## Get started

1. Visit [aulert.vercel.app](https://aulert.vercel.app).
2. Connect your Google Classroom account.
3. Open Settings to tune in-app notifications or connect Discord.

### Connect Discord

1. In Discord, create an incoming webhook for the channel you want to receive updates.
2. In Aulert Settings, give the destination a label and paste the webhook URL.
3. Approve the separate offline Classroom permission when prompted. Aulert sends a test message before saving the destination.

Aulert checks for new Classroom announcements, assignments, and materials about every 10 minutes. It batches nearby updates into compact Discord messages, so delivery is prompt but not guaranteed to be real-time.

## Privacy and security

- Core Classroom viewing happens in the browser.
- Discord Notifications are optional. Their Google refresh token and webhook URL are encrypted before storage; URLs are never returned to the browser after setup.
- Disconnecting Discord permanently removes its stored credentials and destinations.
- The app uses short-lived Google access cookies. It attempts a no-prompt restoration when Google permits it, then asks you to reconnect only when Google requires interaction.
- Analytics does not load until the user explicitly accepts it.

Read the full [Privacy Policy](privacy.html) and [Terms of Service](terms.html).

## Deployment notes

The project is a static web app with Vercel serverless functions and Firebase Realtime Database for the optional Discord service.

Required Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_SECRET` | Exchanges the optional offline Google authorization. |
| `DISCORD_WEBHOOK_ENCRYPTION_KEY` | A 32-byte base64 value or 64-character hex key used to encrypt Discord URLs and refresh tokens. |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin service-account JSON. |
| `CRON_SECRET` | Protects the scheduled Discord delivery job. |
| `ALLOWED_ORIGIN` | Optional CORS origin override; defaults to the production app URL. |

`vercel.json` schedules the existing delivery endpoint every ten minutes. Never commit real webhook URLs, Firebase credentials, or encryption keys.

## Local checks

```powershell
node --check api\lib\digestCore.js
node --check api\emailPrefs.js
node --check api\dailyDigest.js
node --check script-app.js
node --check script-app-settings.js
node --check script-landing.js
```

## Built by students, for students

- [esrazti](https://github.com/esrazti)
- [Sapfire151](https://github.com/Sapfire151)
