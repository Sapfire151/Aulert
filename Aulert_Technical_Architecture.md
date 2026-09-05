# Aulert — Technical Architecture (v2 / MVP — Decisions Resolved)
**Status:** Draft — Checkpoint 2 (Decisions Complete)
**Companion to:** Aulert PRD (Checkpoint 5)
**Scale target:** Solo/hobby scale, free-tier infra

---

## 1. Stack Summary

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Dashboard, Calendar, Homework UI |
| Hosting (web) | Vercel | Free tier; hosts API routes for webhook receivers and cron triggers |
| Database | Supabase Postgres | Free tier; RLS enforced per-user (strict isolation) |
| Secrets | Supabase Vault | Managed encryption for webhook URLs and sensitive tokens |
| Auth | Supabase Auth (Google OAuth) | Reuses Google login for Classroom scope consent |
| Query layer | Supabase client directly | No ORM (Prisma/Drizzle explicitly skipped) |
| Discord Bot | discord.js, always-on Node worker | Hosted on **Railway** — persistent gateway connection. Automatic reconnect with exponential backoff built-in |
| Discord Webhook | Plain HTTP POST | Queued and sent from Railway worker with retry logic |
| Classroom sync | Classroom API + Google Cloud Pub/Sub push notifications | No polling; idempotency keys prevent duplicate Instant Pings |
| Scheduled jobs | Vercel Cron (or Supabase `pg_cron`) | Drives the daily Late Ping sweep; also batches pending Classroom API reads |

---

## 2. System Diagram (textual)

```
Google Classroom ──(Pub/Sub push)──> Vercel API route (webhook receiver)
                                            │
                                      (validate message ID)
                                            │
                                     Supabase Postgres
                                     (+ Supabase Vault)
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                         ▼
           Next.js Dashboard        Cron job (batch API    Railway worker
           (reads via Supabase       reads + Late Ping       (Discord Bot +
           client + RLS)            sweep)                   Webhook retry queue)
                                            │
                                            ▼
                                    Delivery resolver
                                    (DM > Bot channel >
                                     Webhook, per user)
```

---

## 3. Data Model (v2, RLS-aware)

| Table | Key fields | RLS Policy | Notes |
|---|---|---|---|
| `users` | id, google_id, email, discord_user_id (nullable) | `auth.uid() = id` | User must be authenticated as themselves |
| `courses` | id, user_id, classroom_course_id, name, color | `auth.uid() = user_id` | One row per synced Classroom course |
| `classroom_items` | id, course_id, classroom_item_id, type (assignment/announcement), title, due_at, submission_status | `auth.uid()` via `course_id.user_id` (nested) | Read-only completion state from Classroom |
| `homework_items` | id, user_id, course_id (nullable), title, due_at, notes, completed (bool) | `auth.uid() = user_id` | Independent completion; supports "Uncategorized" |
| `discord_connections` | id, user_id, type (webhook/bot_channel), webhook_url (encrypted in Vault), channel_id, muted (bool) | `auth.uid() = user_id` | Webhook URLs stored in Supabase Vault, not plaintext |
| `alert_log` | id, item_id (polymorphic), item_type (classroom_item / homework_item), trigger_type (instant/late), sent_via (dm/bot_channel/webhook), sent_at, idempotency_key (unique per message) | `auth.uid()` via nested join | Idempotency key prevents duplicate Instant Pings from Pub/Sub retries |
| `pending_classroom_reads` | id, user_id, classroom_item_id, created_at | `auth.uid() = user_id` | Queue for batched API reads (see Section 6.2) |

**Polymorphic reference approach (resolved):** Use separate `classroom_items` and `homework_items` tables with `item_type` discriminator in `alert_log`. A single polymorphic `items` table was rejected to keep schemas simpler for hobby scale and avoid complex join patterns.

---

## 4. Classroom Sync Flow

1. On OAuth consent, Aulert registers a Pub/Sub push subscription per user pointing at the Vercel webhook receiver.
2. Classroom pushes a notification on change → Vercel API route:
   - Validates the Pub/Sub message envelope (trusts Google's signature for now; relies on Classroom API call to fail if message is spoofed).
   - Checks `alert_log.idempotency_key` — if the message ID already exists, return 200 OK without re-processing.
   - Fetches the changed resource via the Classroom API (push notifications carry minimal payload).
   - Upserts into `classroom_items`; inserts idempotency record into `alert_log`.
3. New item insert → triggers Instant Ping via delivery resolver (Section 5).
4. `submission_status` changes → updates the read-only completion state; no ping.

---

## 5. Delivery Resolver

Runs on:
- **Instant Ping:** Immediately when a new item is created (Classroom or Homework).
- **Late Ping:** Daily via Vercel Cron, sweeping for items that became overdue.

### Delivery Logic

1. Look up the user's `discord_connections` from Supabase.
2. Pick the first available channel in priority order: **DM > Bot server channel > Webhook**.
3. If the chosen channel is muted, fall through to the next channel in priority order.
4. **If DM or Bot channel:** Send rich embed (fields + Mark Complete / Open in Classroom buttons) to Railway worker via job queue (see Section 6.1).
5. **If Webhook:** Add job to Railway's webhook retry queue with exponential backoff (see Section 6.1).
6. Log the send in `alert_log` with a timestamp.

---

## 6. Reliability & Retry Strategies

### 6.1 Discord Webhook Sends (Railway Worker)

**Ownership:** Railway worker exclusively owns all webhook sends (including Instant Pings).

**Flow:**
- Vercel API route (on Instant Ping) or Cron job (on Late Ping) inserts a message into a `webhook_send_queue` table.
- Railway worker polls the queue continuously, picks up unprocessed jobs, and attempts delivery to Discord.
- **Retry logic:** Exponential backoff (1s, 2s, 4s, 8s, 16s) up to 5 retries. If all retries fail, log error and abandon (don't retry forever; prevent memory leak).
- **Idempotency:** Discord webhook sends are idempotent by webhook ID — sending the same message twice produces the same result, so retries are safe.

**Trade-off:** Adds Railway-side complexity but ensures Instant Pings don't get lost if Discord is temporarily down.

### 6.2 Classroom API Rate Limits (Batched Reads)

**Problem:** Pub/Sub pushes can arrive rapidly; hitting the API follow-up read limit is possible.

**Solution:**
- When a Pub/Sub message arrives, Vercel checks the message ID (idempotency).
- If it's a new message but the API read would exceed quota, insert a record into `pending_classroom_reads` instead of calling the API immediately.
- **Batch job (runs once per minute):** A Vercel Cron or Railway job processes all pending reads in a single batch, spreading API calls over time.
- If quota is still exhausted, re-queue the batch and try again in 5 minutes.

**Trade-off:** Instant Pings may be delayed by up to 1 minute during high-load periods, but no data is lost.

### 6.3 Discord Bot Gateway (Railway Worker)

**Resilience:**
- discord.js automatically handles WebSocket reconnection with exponential backoff.
- Bot checks for connectivity issues; if disconnected for >5 minutes, logs a warning (manual review required, but auto-reconnect attempts continue).
- No health-check endpoint or process supervisor needed; discord.js's built-in heartbeat loop handles most scenarios.

---

## 7. Security Decisions

### 7.1 Pub/Sub Message Validation

**Decision:** Accept any POST to the webhook endpoint; rely on the Classroom API call to fail if the message is spoofed.

**Rationale:** For hobby scale, validating Google's JWT signature adds latency and complexity. The API call acts as a natural gate — if someone spoofs a message, the follow-up read to the Classroom API will fail (no such item exists), and the malicious message is dropped.

**Caveat:** This assumes the Classroom API credentials are secure. If they're compromised, spoofing becomes possible. Mitigate by rotating Classroom OAuth tokens periodically and monitoring failed API calls.

### 7.2 Discord Webhook URL Storage

**Decision:** Store webhook URLs in Supabase Vault (managed encryption).

**Implementation:**
- On webhook setup, Aulert stores the URL in Supabase Vault instead of plaintext in Postgres.
- The `discord_connections.webhook_url` column stores a reference/UUID, not the actual URL.
- Retrieve the URL from Vault only when sending the webhook.

**Trade-off:** Minimal extra complexity (Supabase Vault is built-in); prevents accidental exposure if someone dumps the Postgres database.

### 7.3 Row-Level Security (RLS)

**Decision:** Enforce RLS policies on all tables with `auth.uid()` checks.

**Policy Template:**

```sql
CREATE POLICY user_isolation ON courses
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY item_isolation ON classroom_items
  USING (EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = classroom_items.course_id
    AND courses.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = classroom_items.course_id
    AND courses.user_id = auth.uid()
  ));
```

**Rationale:** For a single-user app, RLS is defensive security. If a bug ever allows an unauthenticated query or session hijacking, RLS prevents cross-user data leakage. Also forces discipline: every query must be conscious of the user context.

---

## 8. Performance & Optimization

### 8.1 Database Indexes

**Required indexes (on free tier):**
- `classroom_items (course_id, due_at)` — for calendar queries (Month/Week view)
- `homework_items (user_id, due_at)` — for dashboard/calendar
- `alert_log (item_id, item_type, sent_at)` — for deduplication and daily Late Ping scan
- `discord_connections (user_id)` — for delivery resolver lookups
- `pending_classroom_reads (user_id, created_at)` — for batch job scans

### 8.2 Query Optimization

- Dashboard: Single query fetching all overdue + due-today items, sorted by urgency.
- Calendar (Month view): Fetch all items due in the visible month in one query, grouped by date.
- Avoid N+1: Use SQL joins to fetch courses + items in one pass.

### 8.3 Caching

- **Classroom items:** No TTL cache (always fetch fresh from DB; DB is source of truth).
- **Discord connections:** Cache in memory on the Railway worker (refresh on each send; ~100ms lookup cost is negligible).
- **User settings:** Fetch once on login; refresh on settings change.

---

## 9. Monitoring & Observability (Hobby Scale)

- **Vercel:** Monitor Cron job execution via Vercel dashboard; set up email alerts for failures.
- **Railway:** Basic process logs available via Railway dashboard. Set up a Slack webhook to log errors from the bot worker.
- **Supabase:** Monitor database size and row counts via Supabase dashboard; set up usage alerts.
- **Discord bot:** Log all sends to a private Discord channel (e.g., `#aulert-logs`). Include message ID, timestamp, and success/failure status.
- **Errors:** Log Classroom API failures, Pub/Sub validation errors, and webhook delivery failures to a `system_logs` table or file. Review manually on a weekly basis.

---

## 10. Deployment Checklist (Before MVP Launch)

- [ ] Supabase Vault configured; webhook URL encryption working.
- [ ] RLS policies created and tested on all tables.
- [ ] Idempotency keys generated and checked on all Pub/Sub receives.
- [ ] Railway worker running with discord.js bot; heartbeat logging enabled.
- [ ] Webhook retry queue table created; retry logic tested.
- [ ] Batch Classroom API read job scheduled (Vercel Cron or Railway interval job).
- [ ] Delivery resolver prioritization logic (DM > Bot > Webhook > muted fallthrough) tested end-to-end.
- [ ] Error logging set up; manual review process documented.

---

## 11. Known Limitations (Accepted for MVP)

- **Pub/Sub JWT validation skipped** — Trusting Classroom API call to gate spoofed messages.
- **Webhook retry limit:** 5 retries max; no infinite queues to prevent memory bloat on free tier.
- **API rate limit handling:** Batched reads may delay Instant Pings by up to 1 minute during quota exhaustion.
- **No distributed tracing** — Manual logs only; no OpenTelemetry or similar. Acceptable for solo user.
- **Cold starts on Vercel API routes** — May cause slight lag on Instant Ping delivery; acceptable for MVP.

---

## 12. Idempotency & Monitoring — Stress-Test Findings

The base design (idempotency keys in `alert_log`; per-platform dashboards + Slack/email alerts) holds up for the common case. Pushed harder, six gaps surface — three per topic.

### 12.1 Idempotency — Edge Cases

| # | Scenario | Why it breaks the current design | Fix |
|---|---|---|---|
| 1 | **Check-then-insert race.** Two Pub/Sub redeliveries of the same message arrive within milliseconds (network retry, not just Google's own retry policy) and both pass the `SELECT ... WHERE idempotency_key = ?` check before either has inserted. | Section 4's "check `alert_log`, then insert" is two separate statements — classic TOCTOU race. Under concurrent Vercel invocations this is not theoretical; simultaneous cold starts of the same route are routine. | Make the idempotency key a DB-level `UNIQUE` constraint and do the write as `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`. Treat a 0-row-affected result as "already processed, skip Instant Ping" — don't pre-check at all. |
| 2 | **Webhook resend is not actually idempotent.** Section 6.1 states "Discord webhook sends are idempotent by webhook ID." This is incorrect — Discord's webhook endpoint has no dedup semantics; POSTing the same payload twice creates two messages. | If the Railway worker sends successfully but crashes/restarts before marking the `webhook_send_queue` job complete, the job is picked up again and the same alert is posted twice to the student's Discord channel. | Mark the job `sending` (not just `pending`/`sent`) before the HTTP call, and `sent` only after a 2xx response, in the same transaction as recording the Discord message ID. On worker restart, treat any job stuck in `sending` for >30s as "unknown outcome" — check `alert_log` for a `sent_at` from that idempotency key before resending, rather than assuming failure. |
| 3 | **Late Ping double-fire from a re-run cron.** If a Vercel Cron invocation times out and Vercel (or a manual retry) re-triggers the same daily sweep, nothing currently stops it from re-inserting Late Ping sends for every still-overdue item. | The idempotency key described in Section 4 is scoped to Pub/Sub message IDs (Instant Ping path) — Section 5's Late Ping path has no equivalent per-run key. | Derive a deterministic key for Late Pings: `(item_id, item_type, 'late', date)` as a unique constraint on `alert_log`. A re-run sweep then collides on the same key for items already pinged today and is silently skipped, exactly like the Instant Ping path. |

### 12.2 Monitoring — Edge Cases

| # | Scenario | Why it breaks the current design | Fix |
|---|---|---|---|
| 1 | **Silent Pub/Sub subscription death.** (Related to the subscription-renewal gap flagged earlier.) If the push subscription expires or is deleted server-side, Classroom simply stops delivering — no error, no failed cron, nothing in Vercel/Railway logs. | Section 9's monitoring is all "watch for failures" (cron failed, worker crashed, delivery failed). None of it detects the absence of expected activity, which is exactly what a dead subscription looks like. | Add a dead-man's-switch check: a scheduled job that alerts if zero Pub/Sub messages have been received in an interval where at least one was expected (e.g., >48h with active courses). This doubles as the renewal-tracking job once subscription renewal is implemented. |
| 2 | **Weekly manual log review is too slow for a solo user's actual risk.** Section 9 says "review manually on a weekly basis" for `system_logs`. | For a single-user app, the cost of a silent failure isn't diffuse — it's 100% of the value prop for up to 7 days (missed deadlines is the exact problem Aulert exists to prevent). | Keep weekly review for low-severity log noise, but push high-severity events (Classroom API auth failure, Pub/Sub validation failure, webhook permanently abandoned after 5 retries) to the same-day Discord `#aulert-logs` channel or email, not the weekly batch. |
| 3 | **Discord log channel can itself be rate-limited during the exact incident you need it for.** A burst of failures (e.g., Discord outage triggering many webhook retries) generates a burst of log messages to `#aulert-logs`, which can hit Discord's own rate limits and drop log messages — precisely when observability matters most. | Section 9 routes bot-worker errors through the same Discord channel the alerts themselves use, with no backpressure handling. | Batch/collapse repeated identical errors within a short window into a single summary message ("Classroom API failed 12x in last 5 min") instead of one message per occurrence; keep a secondary out-of-band channel (email or Vercel/Railway's own alerting) for anything Discord-delivery-related, so a Discord-side incident doesn't also blind you to the incident. |

---

## 13. Security & Rate Limits — Closing the Gaps

Section 7 covers Pub/Sub message trust and webhook URL encryption; Section 6.2 covers Classroom API quota batching. Two dimensions were left open: **Discord bot permission scope** and **Discord API rate limits on the bot worker**. Both are addressed together below since they're both governed by how the bot client is configured.

### 13.1 Discord Bot Permission Scopes & Intents

**Decision:** Request the minimum OAuth2 scope and Gateway intents needed for the bot's actual job — sending rich embeds and reacting to button interactions. The bot never needs to read arbitrary message content.

| Setting | Value | Rationale |
|---|---|---|
| OAuth2 scopes | `bot`, `applications.commands` | `applications.commands` is required to register the Mark Complete / Open in Classroom message components; no other scope is needed. |
| Bot permissions (invite link) | `Send Messages`, `Embed Links`, `Use External Emojis` (optional), `Read Message History` (only if editing/updating a prior embed in place) | Least-privilege invite — deliberately excludes `Manage Channels`, `Manage Messages`, `Mention Everyone`, `Administrator`. |
| Gateway intents | `GUILDS` (required baseline), plus whatever discord.js requires internally for interaction events | **`MESSAGE_CONTENT` intent is explicitly NOT requested.** The bot only sends messages and receives button-click interactions — it never needs to read message text, so requesting the privileged content intent would be an unnecessary exposure and would also trigger Discord's bot-verification review at 100+ servers for no benefit. |
| Interaction handling | Gateway-based (discord.js), not HTTP-interaction-endpoint based | Since the bot already holds a persistent Gateway connection (Section 1), there's no need for a separate signed-request verification path (the kind HTTP-only bots need via Discord's public-key signature check) — that verification model is for stateless bots without a Gateway connection. |

**Trade-off:** None of this changes bot capability for Aulert's feature set — Instant/Late Ping delivery and Mark Complete buttons don't need broader scope. It does mean if a future feature wants the bot to *read* channel messages (e.g., a slash-command interface), that's a deliberate, separate intent request revisited at that time — not something to pre-authorize now.

### 13.2 Discord API Rate Limits (Bot Worker)

**Current gap:** Section 6.1 covers webhook send retries; Section 6.3 covers Gateway reconnect. Neither covers REST-level rate limiting for the bot's own message sends (DMs and bot-channel sends), which are a different Discord subsystem with its own per-route and global limits.

**Decision:**
- Rely on discord.js's built-in per-route rate-limit bucketing for individual REST calls (message sends, interaction responses) — it queues and paces requests automatically and is sufficient at hobby scale (single user, low message volume).
- Explicitly handle the case discord.js surfaces but doesn't resolve for you: a sustained `429` with a long `retry_after` (e.g., global rate limit hit, which is unlikely at this scale but possible if a bug causes a send loop). Treat repeated 429s on the same route as a signal to pause that route's queue and log a high-severity event (per Section 12.2's same-day alerting), rather than let discord.js retry silently forever.
- DM sends specifically: Discord rate-limits DMs per-recipient more aggressively to fight spam. Since Aulert only ever DMs its own single associated user per connection, this ceiling is never realistically approached — no special handling needed beyond the shared bucket logic above.

**Trade-off:** No new infrastructure — this leans on discord.js's existing behavior and adds one failure-mode alert on top, consistent with the "hobby scale, manual review with alerts for the loud failures" posture the rest of the doc already takes.

---

## 14. Change Log

| Version | Date | Change |
|---|---|---|
| v1 | — | Initial architecture sketch; open items listed |
| v2 | 2024 | **Decisions locked:** idempotency strategy, bot resilience, Pub/Sub validation, webhook retry ownership, API rate limit batching, Vault encryption, RLS enforcement |
| v3 | 2026 | **Added:** Idempotency & Monitoring stress-test findings (Section 12) covering check-then-insert races, non-idempotent webhook resends, Late Ping re-fire, silent Pub/Sub subscription death, slow manual log review, and log-channel self-rate-limiting. **Closed:** Discord bot permission scope/intents and Discord API rate-limit handling for the bot worker (Section 13). **Still open:** OAuth refresh token lifecycle, Pub/Sub subscription renewal (~7-day expiry), and timezone source-of-truth remain unaddressed — flagged for a future checkpoint. |
