# Aulert — Implementation Roadmap
**Based on:** PRD (Checkpoint 4) + Technical Architecture v3
**Scale:** Solo/hobby build, free-tier infra
**Estimated total:** ~10–12 weeks at a steady part-time pace (adjust to your actual hours/week)
**Revision:** Folds in six additional decisions resolved after the initial planning round (see updated Decisions Log)

---

## How this roadmap is organized

Phases follow the dependency chain in the architecture doc: you can't build the delivery resolver before you have Discord connections stored, and you can't build Discord connections before auth + RLS exist. Each phase lists **tasks**, **exit criteria** (how you know it's done), and **blocks** (what depends on it).

---

## Phase 0 — Project Scaffolding (Week 1)

**Goal:** Empty-but-real skeleton across all three runtimes (Vercel, Supabase, Railway).

| Task | Notes |
|---|---|
| Init Next.js (App Router) + TypeScript repo | Deploy to Vercel immediately, even blank, to confirm pipeline |
| Provision Supabase project | Enable Auth, Vault extension |
| Provision Railway project | Deploy a "hello world" always-on Node worker to confirm persistent process works on free tier |
| Set up environment variable / secrets strategy | Vercel env vars, Railway env vars, Supabase service role key handling |
| Repo-level conventions | Folder structure for API routes, Supabase client wrapper, shared types |
| **Stand up a staging environment** | Separate Supabase project (or branch) + separate Vercel/Railway deploy targets, mirroring prod config. Decided: worth the setup cost given RLS/schema mistakes are much cheaper to catch pre-prod. |

**Exit criteria:** All three services deployed and talking to each other with a trivial "ping" (e.g., Vercel route writes a row, Railway worker reads it).

**Blocks:** Everything.

---

## Phase 1 — Auth, Data Model & RLS (Weeks 1–2)

**Goal:** A real, secure user can log in and their data is isolated.

| Task | Notes |
|---|---|
| Supabase Auth + Google OAuth | Request Classroom read scopes at consent time (Section 1 of PRD flow) |
| **OAuth callback: handle school-admin-blocked error explicitly** | *(New)* Google returns a distinguishable error code (e.g. `admin_policy_enforced`) when a Workspace domain admin has blocked third-party API access — separate from a generic `access_denied`. Detect this specific code in the OAuth callback route and show a dedicated, friendly page ("Your school's Google account doesn't allow Aulert to connect — this is a setting your school's IT admin controls, not a problem with your account") rather than a raw Google error. Write this copy now, not when the first confused user hits it. |
| **Capture browser timezone at signup, and re-capture on every login** | *(New)* Add a `timezone` column on `users` (IANA string, e.g. `America/Chicago`). Capture client-side on first signup and silently refresh it on every subsequent login, so a relocated student's due-date math stays correct without needing a settings page in v1. All due-date/"overdue" comparisons downstream (Dashboard, Calendar, Late Ping cron) read from this field rather than assuming UTC or server time. |
| **Kick off Google OAuth verification review** | Decided: start this in parallel with Phase 1, not later. Classroom read scopes are almost certainly "sensitive/restricted" and the review has real lead time (days–weeks) — treat this as a submit-and-wait task running alongside everything else in this phase, not a blocking one |
| **Draft privacy policy + Terms of Service** | Decided: address both now rather than deferring, given Aulert touches student academic data. Neither needs to be exhaustive at MVP stage. Privacy policy: what's collected, how it's stored (Vault for secrets, Postgres for the rest), FERPA/COPPA-adjacent considerations given your actual user base. ToS (new, bundled into this same task): not affiliated with Google/Discord/schools, provided as-is, right to terminate accounts, basic liability disclaimer. Both should be live routes linked from the signup flow and OAuth consent screen — Google's verification review typically wants to see both anyway, so bundling them is efficient. |
| Create all tables from Section 3 of architecture doc, plus new fields below | `users`, `courses`, `classroom_items`, `homework_items`, `discord_connections`, `alert_log`, `pending_classroom_reads` |
| **New field:** `users.needs_reauth` | *(New)* Boolean (or small status enum: `active` / `needs_reauth` / `revoked`). Set when a Classroom API token refresh fails with `invalid_grant` (revoked access, admin revocation, or the 50-refresh-token-per-client cap). Decided: dashboard shows existing synced data plus a persistent "Reconnect Google Classroom" banner rather than going blank — stale visibility beats no visibility, consistent with the product's core promise. |
| **New field:** `users.pubsub_subscription_expires_at` | *(New)* Timestamp tracking when the user's Classroom Pub/Sub push subscription needs renewal. Populated in Phase 2, read by the renewal check added to the cron job in Phase 6. Keeps the renewal check a cheap indexed query rather than a live API call on every cron run. |
| **New fields:** `discord_connections.status`, `discord_connections.consecutive_failures` | *(New)* `status`: `active` / `broken`. `consecutive_failures`: integer counter. Wired up in Phase 5/6 once the retry queue exists — see those phases for the logic. |
| Write + test RLS policies per table | Use the template in Section 7.3; test with two dummy users to confirm isolation |
| Create indexes from Section 8.1 | Do this now, not later — cheap to add early, easy to forget |
| Supabase Vault wiring for `discord_connections.webhook_url` | Confirm store/retrieve round-trip before building the feature that uses it |

**Exit criteria:** Two test accounts can sign in via Google, each sees only their own rows, a webhook URL can be stored/retrieved via Vault, OAuth verification submission is in progress, a first-draft privacy policy + ToS exist and are linked from signup, the school-admin-block error path shows a friendly page (test by simulating the error code), and each test user has a captured `timezone` value.

**Blocks:** Classroom sync, Discord integration, Dashboard.

---

## Phase 2 — Classroom Sync (Weeks 2–4)

**Goal:** Real Classroom data flows into `classroom_items`, read-only.

| Task | Notes |
|---|---|
| Google Cloud Pub/Sub subscription registration on OAuth consent | Per-user subscription pointing at the Vercel webhook receiver. **Record the subscription's expiry into `users.pubsub_subscription_expires_at`** *(new)* at registration time, so Phase 6's renewal check has something to read. |
| Vercel webhook receiver route | Accepts POST, checks `alert_log.idempotency_key`, fetches full resource via Classroom API, upserts into `classroom_items` |
| **Token refresh failure handling** | *(New)* Any Classroom API call that fails on token refresh with `invalid_grant` sets `users.needs_reauth = true` and short-circuits further sync attempts for that user until they reconnect — no point retrying a dead token every cycle. |
| Idempotency key handling | This is the piece the whole reliability story depends on — build and test duplicate-delivery scenarios explicitly |
| `pending_classroom_reads` queue + batch job | Section 6.2 — build this alongside sync, not after, since rate-limit handling changes the receiver's control flow |
| Initial full sync on first login | Pull existing enrolled courses + current assignments/announcements (PRD Section 3, step 3) |
| Submission status updates (no ping) | Distinguish "new item" (triggers ping, later) from "status changed" (silent update) |
| **Resolved:** synced item completion is read-only, mirrors Classroom | No manual override UI for `classroom_items` completion — it's a pure reflection of `submission_status`. This confirms the "no ping" row above is the complete behavior, not a placeholder for a future manual-check feature |

**Exit criteria:** Posting a new assignment in a real (test) Classroom course reliably produces exactly one row in `classroom_items`, with duplicate Pub/Sub deliveries producing zero extra rows. A simulated `invalid_grant` failure correctly sets `needs_reauth` and halts further sync attempts for that user.

**Blocks:** Dashboard/Calendar (need real data), Alert Engine (needs "new item" events to fire on).

**Known risk carried from architecture doc:** Pub/Sub JWT validation is explicitly skipped (Section 7.1). Fine for MVP, but flag it in your own backlog as a fast-follow — don't let it become permanent by default.

---

## Phase 3 — Dashboard & Calendar (Weeks 4–6)

**Goal:** The PRD's "aha moment" — usable before any Discord setup.

| Task | Notes |
|---|---|
| Dashboard: quick stats bar | Due this week / overdue / completed this month |
| **`needs_reauth` banner** | *(New)* Dashboard checks `users.needs_reauth` on load; if true, shows a persistent "Reconnect Google Classroom" banner above the stats bar, routing back into the OAuth consent flow. Existing synced data still renders underneath — don't blank the dashboard. |
| Dashboard: urgent items list | Merged Classroom + Homework, sorted Overdue → Today → This Week (single query per Section 8.2), evaluated against `users.timezone`, not server/UTC time |
| Calendar: Month/Week/Agenda views | Course color-coding, due-soon highlighting, same timezone-aware date math as above |
| Assignment detail panel | Description, attachments, due date, submission status, source badge |
| Search & filter (course/type/completion) | |
| Unified visual treatment for synced vs. custom items | Badge only in detail panel, not on the grid (PRD 4.2) |

**Exit criteria:** A logged-in user with synced Classroom data sees a correct, navigable Dashboard and Calendar with zero Discord setup required, all due-date groupings correct against their captured timezone. This is a natural internal demo checkpoint.

**Note:** Homework module (Phase 4) isn't required for this phase's exit criteria, but the queries here should be written to already accommodate the union of `classroom_items` + `homework_items` so you're not refactoring the dashboard query twice.

---

## Phase 4 — Homework Module (Week 6)

**Goal:** Custom tasks, dual-displayed, alert-parity-ready.

| Task | Notes |
|---|---|
| Create/edit/delete custom Homework items | Title, optional course tag or "Uncategorized," due date, notes |
| Dual display wiring | Appears in both Calendar and dedicated Homework page from the same table |
| Homework page grouping | Overdue → Today → This Week → Later; completed collapses to bottom; grouping evaluated against `users.timezone` |
| Binary completion checkbox | No subtasks/progress-% (explicitly out of scope). This checkbox is independent and user-controlled — distinct from `classroom_items`, which is read-only and mirrors Classroom (see Phase 2) |

**Exit criteria:** A Homework item created in the UI appears identically in Calendar and Homework page, and is indistinguishable in styling from synced items until clicked.

**Blocks:** Alert Engine needs Homework creation events, same as Classroom needs new-item events.

---

## Phase 5 — Discord Integration (Weeks 6–9)

**Goal:** Webhook and Bot modes both connectable; delivery resolver has real channels to choose between. PRD calls for parallel build, and **onboarding is resolved: present both as equal, side-by-side choices** rather than sequencing one before the other. Build tracks 5a and 5b together where bandwidth allows — the equal-choice decision doesn't force build order, only presentation order in the UI.

| Task | Notes |
|---|---|
| **Onboarding UI: side-by-side Webhook/Bot picker** | Both options presented at equal visual weight in Settings, no default/recommended styling on either — this is the resolved decision from the PRD open item |

### 5a. Webhook Mode
| Task | Notes |
|---|---|
| Settings UI: paste webhook URL | Store via Vault (already wired in Phase 1) |
| Railway worker: webhook send queue consumer | `webhook_send_queue` table, polling worker (Section 6.1) |
| Retry logic | Exponential backoff 1/2/4/8/16s, 5 retries max, then log + abandon |
| **Connection health tracking** | *(New)* After retries are exhausted, inspect the failure reason. A 404/410 (webhook deleted) is permanent: increment `discord_connections.consecutive_failures` and flip `status = 'broken'`, stopping further sends to that connection. A timeout or 5xx is transient — leave `status = 'active'`, don't count it toward the threshold. |
| Rich embed formatting | Course name, due date, Classroom deep link, urgency color |

### 5b. Bot Mode
| Task | Notes |
|---|---|
| Register Discord application + bot, OAuth invite flow | |
| Railway worker: discord.js gateway connection | Always-on process, auto-reconnect (built into discord.js) |
| Channel selection UI | User picks server + channel post-invite |
| DM fallback | Personal DM ping for users without a shared server (PRD 4.4) |
| Rich embeds with interactive buttons | Mark Complete / Open in Classroom |
| Gateway health logging | >5 min disconnect → warning log (Section 6.3) — no supervisor process needed for MVP |
| **Connection health tracking (bot channel)** | *(New)* Same `status`/`consecutive_failures` logic as the webhook path: a permanent failure (bot kicked from server, channel deleted — surfaced as a 403/404 from the Discord API) marks that `discord_connections` row `broken` and stops further sends; transient failures don't. |

### 5c. Global Mute
| Task | Notes |
|---|---|
| Per-webhook/channel mute toggle | Global only, not per-course (PRD 4.5) |

**Exit criteria:** A user can connect either or both channel types, receive a manually-triggered test embed on each, toggle mute per channel with the toggle actually suppressing sends, and a simulated permanent failure (e.g., delete the test webhook, then trigger a send) correctly flips that connection to `broken` and stops further attempts.

**Blocks:** Alert Engine (needs real channels to deliver to).

---

## Phase 6 — Alert Engine & Delivery Resolver (Weeks 9–10)

**Goal:** Wire Classroom sync + Homework creation to actual Discord delivery, following the priority/fallthrough logic.

| Task | Notes |
|---|---|
| Instant Ping trigger | Fires on new `classroom_items` row and new `homework_items` row |
| Late Ping cron | Vercel Cron, daily sweep for newly-overdue items (timezone-aware per `users.timezone`); repeats daily until marked complete |
| **Pub/Sub subscription renewal check** | *(New)* Piggybacked onto the same daily cron invocation as the Late Ping sweep, but implemented as a clearly separate code path so a bug in one doesn't silently break the other. Queries `users.pubsub_subscription_expires_at`, renews any subscription expiring within ~24–48h, and updates the stored expiry on success. |
| Delivery resolver | Priority order DM > Bot channel > Webhook, fall through on mute **or on `status = 'broken'`** *(updated — broken connections are skipped the same way muted ones are)* |
| `alert_log` write on send | Timestamp, `sent_via`, idempotency key |
| Dedup logic for Late Ping repeats | Distinct from Instant Ping idempotency — daily repeat is intentional, but must not double-send same day |

**Exit criteria:** Full end-to-end test: post a new assignment in Classroom → Instant Ping arrives in Discord within expected latency. Let an item go overdue → Late Ping arrives, then repeats the next day, then stops once marked complete. A subscription artificially set to expire within 24h is renewed by the next cron run, and its `pubsub_subscription_expires_at` updates accordingly. A `broken` connection is correctly skipped by the resolver in favor of the next priority channel.

**This is the integration-heaviest phase** — budget slack here even though the task list looks short; it touches every prior phase.

---

## Phase 7 — Hardening & Launch Readiness (Weeks 10–12)

Maps directly to Section 10 (Deployment Checklist) and Section 9 (Monitoring) of the architecture doc.

| Task | Notes |
|---|---|
| Run through full Deployment Checklist (Arch Section 10) | Vault, RLS, idempotency, worker heartbeat, retry queue, batch job schedule, resolver logic, error logging — check each explicitly |
| **Manual test pass on reliability-critical paths** | Decided: manual testing only, no automated suite for MVP. Explicitly walk through duplicate Pub/Sub delivery, webhook retry exhaustion, delivery-resolver mute fallthrough, **`needs_reauth` banner behavior, subscription renewal, and connection-health `broken` fallthrough** *(expanded)*, by hand before launch, since these are the paths most likely to fail silently |
| Monitoring setup | Vercel Cron failure emails, Railway → Slack error webhook, Supabase usage alerts, `#aulert-logs` Discord channel |
| `system_logs` table (or file) for manual weekly review | Classroom API failures, Pub/Sub validation errors, webhook delivery failures |
| Load/edge-case pass | Rapid Pub/Sub bursts (rate-limit path), Discord API outage (retry exhaustion path), mute-everything edge case |
| Cold start / latency check on Vercel routes | Acceptable per architecture doc, but confirm it's not worse than expected |
| Confirm OAuth verification has cleared | Should have been submitted back in Phase 1 — this is the check that it actually came back approved, not a new task |

**Explicitly reactive / deferred (decided, not overlooked):**
- **Free-tier limits** (Supabase rows/storage, Railway hours, Vercel invocations) — no proactive monitoring or upgrade-trigger plan for MVP; handle if/when a limit is actually hit.
- **Data export/backup for users** — deferred to Phase 2 (product phase, not this roadmap's Phase 2).
- **Usage analytics** — deferred to Phase 2; MVP-vs-Phase-2 prioritization will rely on informal/direct feedback instead of usage data for now.
- **Manual timezone override in Settings** — deferred; v1 relies on auto-capture at signup/login only (see Decisions Log).

**Exit criteria:** Every box in the Architecture doc's Deployment Checklist (Section 10) is checked, and you've dogfooded the app on your own real Classroom account for at least a few days.

---

## Timeline Summary

| Phase | Weeks | Can overlap with |
|---|---|---|
| 0 — Scaffolding | 1 | — |
| 1 — Auth/Data/RLS | 1–2 | — |
| 2 — Classroom Sync | 2–4 | Late part can overlap early Phase 3 |
| 3 — Dashboard/Calendar | 4–6 | Overlaps Phase 4 |
| 4 — Homework Module | 6 | Overlaps Phase 3, Phase 5a |
| 5 — Discord Integration | 6–9 | Webhook/Bot tracks can run in parallel |
| 6 — Alert Engine | 9–10 | Needs 2, 4, 5 substantially done |
| 7 — Hardening/Launch | 10–12 | — |

**Critical path:** Phase 1 → Phase 2 → Phase 5 → Phase 6. Dashboard/Calendar/Homework (Phases 3–4) are important for usability but not blockers for the alert pipeline — if time gets tight, the Discord/Alert critical path should win over UI polish, since Discord delivery is the product's core differentiator per the PRD's insight statement.

---

## Decisions Log (resolved this planning round)

| Question | Decision |
|---|---|
| Synced item completion checkbox | Read-only, mirrors Classroom (no manual override) |
| Webhook vs. Bot onboarding | Equal, side-by-side choice in UI |
| Staging environment | Yes — separate Supabase/Vercel/Railway targets before prod |
| Testing strategy for reliability logic | Manual testing only for MVP |
| OAuth verification timing | Start in parallel with Phase 1, not later |
| Privacy/compliance review | Address now (Phase 1), not deferred |
| Free-tier limit monitoring | Reactive — handle if/when hit, no proactive plan |
| Data export/backup | Deferred to Phase 2 |
| Usage analytics | Deferred to Phase 2 |

## Decisions Log (round 2 — post-architecture-review)

| Question | Decision |
|---|---|
| OAuth refresh token dies (revoked/expired) | Flag `users.needs_reauth`; dashboard shows existing stale data + persistent reconnect banner (not a blank screen) |
| Pub/Sub subscription renewal | Piggyback onto the existing Late Ping daily cron, as a separate code path within the same invocation |
| User timezone for due-date logic | Auto-capture browser timezone at signup, re-capture on every login; no manual override in v1 |
| School Workspace domain blocks the app | Detect the specific Google error code in the OAuth callback; show a dedicated friendly explanation page rather than a raw error |
| Discord connection health tracking | Yes — track `status`/`consecutive_failures` per connection; mark `broken` after a permanent failure (404/410/403), stop retrying, and have the delivery resolver skip `broken` connections like muted ones |
| Terms of Service | Draft now, bundled into the same Phase 1 pass as the privacy policy |

## One thing still worth flagging, not fixing now

**Pub/Sub validation gap** (Architecture 7.1, 11) is an accepted MVP trade-off, not an oversight — but it's the kind of thing that's easy to forget once the app is "working." Consider adding a one-line reminder in your own backlog now so it doesn't silently become permanent. This wasn't part of this round's decisions, so it's still open.
