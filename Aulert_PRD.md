# Aulert — Product Requirements Document (PRD)
**Status:** Checkpoint 8 (Synced with Technical Architecture v3 + Implementation Roadmap — no open items)
**Owner:** Sapfire151
**Document Type:** Product Concept & Feature Spec (pre-technical-architecture)

---

## 1. Overview

**Aulert** is a web-based centralized notification and visual calendar platform for Google Classroom that delivers real-time alerts via Discord (Webhooks & Bot).

### 1.1 Problem Statement
Google Classroom notifications are passive and easy to miss. Students check email inconsistently, and Classroom's own push notifications get buried among other apps. Deadlines slip not from lack of care, but because the system doesn't fight for attention in a channel students actually watch.

### 1.2 Insight
Students already live in Discord — it's open all day, notifications are trusted, and it's inherently social. Meeting students where their attention already lives (instead of asking them to check one more dashboard) is the core unlock.

### 1.3 Vision Statement
> Aulert turns Google Classroom's scattered, easy-to-miss updates into a single visual timeline and real-time Discord pings — so no assignment, announcement, or deadline slips through the cracks.

### 1.4 Positioning
Aulert is **not** a Classroom replacement. It is a **notification and visibility layer** on top of Classroom. It does not compete with Classroom's submission workflow — it ensures students *know* what's happening without opening five separate course pages.

---

## 2. Goals & Non-Goals (v1)

### In Scope (v1)
- Google OAuth sign-in + Classroom sync (read-only)
- Central Dashboard (landing page)
- Visual Calendar (Month/Week/Agenda)
- Homework module (custom, manually-created tasks)
- Discord integration — Webhook **and** Bot, built in parallel, presented as an equal side-by-side choice
- Simplified two-trigger alert model (Instant + Late)
- Global (non-per-course) alert rules
- Global per-webhook/channel mute
- Web-only, responsive/mobile-browser-friendly UI
- Account health surfacing: reconnect banner, school-block explanation page, broken-connection fallback (see Section 4.6, new)

### Out of Scope (v1 — explicitly descoped)
- Per-course alert overrides / per-course muting
- Digest Mode (daily/weekly summary)
- Custom/configurable pre-due reminder scheduling
- Snooze functionality on Late Pings
- Social/shared visibility features (e.g., seeing classmates on Aulert)
- Native mobile app / PWA
- Subtasks or progress-% tracking on Homework items
- Manual timezone override in Settings (auto-captured only — see Section 4.6)
- Deep technical architecture, code, database schema (covered in companion Architecture doc)

---

## 3. User Journey & Flow

```
1. LANDING → Student discovers Aulert
2. SIGN IN → "Continue with Google" → OAuth consent for Classroom read access
   → If the student's school Workspace admin blocks third-party API access,
     a dedicated friendly explanation page is shown (not a raw Google error)
3. SYNC → Aulert pulls enrolled courses + existing assignments/announcements
4. MAIN DASHBOARD (first view) → Lands on Dashboard (NOT Calendar directly)
   → Dashboard shows quick stats + urgent items list
   → Calendar and Homework are separate, navigable views
5. CONNECT DISCORD (optional) → Can be done immediately or skipped and
   configured later via Settings → Webhook and Bot presented side-by-side,
   equal visual weight, no default/recommended option
6. CONFIGURE ALERTS → Global rules only (Instant + Late pings), optional
   global mute per Discord connection
7. LIVE LOOP →
   - New Classroom post → Instant Ping to Discord
   - Item becomes overdue → Late Ping (repeats daily until marked complete)
   - Custom Homework created → same alert behavior as Classroom items
8. ONGOING USE → Student sees Discord ping → clicks link → jumps to
   Dashboard / Calendar / Homework or directly to Classroom
   → If Google access is later revoked, Dashboard keeps showing existing
     data plus a persistent "Reconnect Google Classroom" banner
   → If a Discord connection breaks (deleted webhook, bot removed from
     server), that connection stops receiving sends silently in the
     background — no broken pings, no user-facing error unless they check Settings
```

**Key UX Principle:** Discord connection is optional at onboarding. The Dashboard delivers the "aha moment" (organized, real assignment data) before any Discord setup is required — lowering the barrier to entry.

---

## 4. Feature Matrix

### 4.1 Dashboard (Landing Page)
| Feature | Description |
|---|---|
| Quick Stats Bar | e.g., "5 due this week," "2 overdue," "12 completed this month" |
| Reconnect Banner | If Google access has been revoked or expired, a persistent banner appears above the stats bar prompting reconnection. Existing synced data still renders underneath — the dashboard never goes blank |
| Urgent Items List | Prioritized: Overdue → Due Today → Due This Week. Merges Classroom-synced + custom Homework items, evaluated against the student's local timezone |
| Recent Activity (optional) | Feed of newly posted Classroom announcements/assignments |

### 4.2 Visual Calendar
| Feature | Description |
|---|---|
| Multi-view Calendar | Month / Week / Agenda (list) views |
| Course Color-coding | Each class gets a distinct color for fast scanning |
| Due-soon Highlighting | Visual urgency states (due today / overdue), evaluated against the student's local timezone |
| Assignment Detail Panel | Click item → description, attachments, due date, submission status, and source badge (Classroom-synced vs. self-created) |
| Synced Item Completion | **Read-only** — mirrors Classroom's actual submission status. Students cannot manually check off a Classroom-sourced item; it reflects reality, not intent |
| Unified Visual Treatment | Classroom-synced and custom Homework items **blend visually** on the grid — the "self-created" distinction only appears in the detail panel (hover/click), not as a persistent badge |
| Search & Filter | Filter by course, type, or completion status |

### 4.3 Homework (New Module)
| Feature | Description |
|---|---|
| Create Custom Task | Title, optional course tag (dropdown, "Uncategorized" allowed if not selected), due date, notes |
| Dual Display | Automatically appears in both the **Calendar** and the dedicated **Homework page** |
| Completion | Single checkbox — binary complete/incomplete, no subtasks or progress %. **Independent and student-controlled** — unlike Classroom-synced items, this is Aulert's own state, not a mirror of anything external |
| Homework Page Grouping | Grouped by due-date buckets: Overdue → Today → This Week → Later. Completed items collapse into a separate section at the bottom |
| Alert Parity | Custom Homework items use the **same alert engine** as Classroom-synced items (Instant + Late pings apply identically) |

### 4.4 Discord Integration
| Feature | Description |
|---|---|
| Webhook Mode | Student pastes a channel webhook URL — no bot install needed |
| Bot Mode | Aulert bot joins a server; supports richer interactive embeds (Mark Complete / Open in Classroom buttons) |
| Onboarding Presentation | Webhook and Bot presented as an **equal, side-by-side choice** in Settings — no default or recommended styling on either |
| Rich Embeds | Formatted messages: course name, due date, direct Classroom link, urgency color-coding |
| Global Mute | Per-connection mute toggle (not per-course) |
| DM Fallback | Personal DM ping option for students without a shared server |

### 4.5 Alert Rules (Simplified Model)
| Trigger | Behavior |
|---|---|
| **Instant Ping** | Fires immediately when a new Classroom item posts, or when a custom Homework task is created |
| **Late Ping** | Fires once an item becomes overdue; **repeats daily** until the item is marked complete |

**Explicitly removed from scope:** Digest Mode, custom/pre-due reminder scheduling (e.g., "24h before"), snooze functionality, per-course rule overrides.

**Rules Scope:** Global only — one set of alert behaviors applies across all courses and Homework. No per-course customization in v1.

### 4.6 Account & Connection Health (New — promoted from implementation notes)
These surfaced as backend necessities during technical planning but have direct, user-visible product impact and belong in the spec, not just the build plan.

| Feature | Description |
|---|---|
| School-Block Explanation Page | If a student's school Google Workspace admin has disabled third-party API access, Aulert shows a dedicated, friendly page clarifying this is a school IT setting — not an account problem or Aulert bug. The page includes a **copyable request template** the student can forward to their school's IT department asking them to whitelist Aulert's OAuth client, giving blocked students a concrete next step rather than a dead end |
| Reconnect Banner | Persistent Dashboard banner when Google access has lapsed (revoked, expired). Prompts reconnection without hiding existing synced data |
| Silent Connection Fallback | If a Discord connection (webhook or bot channel) breaks permanently, Aulert quietly stops sending to it — no repeated failures, no broken pings. In Settings, that connection shows a **status badge/label (e.g. "Not delivering")** so the student can notice and reconnect, rather than being fully silent about it |
| Timezone Handling | Captured automatically from the browser at signup and refreshed on every login; all due-date/overdue logic reads from this. No manual override in v1 |

### 4.7 Legal & Compliance (Thailand PDPA)
Aulert's privacy policy and consent flow are governed by Thailand's Personal Data Protection Act (PDPA), not US-centric frameworks (FERPA/COPPA don't apply — Aulert isn't a US school and doesn't specifically target under-13 users).

| Item | Decision / Note |
|---|---|
| Regulatory frame | Privacy policy drafted against Thailand's PDPA (consent, data subject rights, breach notification), not FERPA/COPPA |
| Minor consent | Users fall in PDPA's 10–20 age band, where parental consent is not automatically required. **Age verification:** a student's school-issued Google account is treated as sufficient verification — no separate age/grade field at signup |
| Cross-border data transfer | Supabase/Vercel/Railway hosting outside Thailand constitutes a cross-border transfer under PDPA. Privacy policy must document the transfer and reference the safeguards in place (provider DPAs/SCCs), even though no Thai data-localization requirement exists |
| Data Protection Officer (DPO) | Not required at current/expected scale (PDPA's large-scale threshold is ~100,000 data subjects) — revisit if user base approaches that order of magnitude |
| Breach notification | Note internally that a confirmed breach requires notifying the PDPC within 72 hours, and affected users if risk is high — compatible with the Architecture doc's existing same-day high-severity alerting |

---

## 5. Design Principles

1. **Dashboard-first, not Calendar-first.** The landing experience is an overview (stats + urgency), not a full calendar grid — faster to scan, faster "aha moment."
2. **Discord is additive, not required.** The web dashboard must be fully functional and valuable on its own; Discord is an enhancement layer added at the student's pace.
3. **Visual cleanliness over labeling.** Custom vs. synced items shouldn't clutter the calendar with badges — surfaced only on demand (detail panel).
4. **Simplicity over configurability.** The alert model deliberately avoids a complex reminder-scheduling engine in favor of two clear, predictable triggers (Instant + Late).
5. **Personal, not social.** v1 stays strictly single-user in experience — no shared/classmate visibility.
6. **Stale visibility beats no visibility.** When something breaks (Google access, a Discord connection), Aulert degrades gracefully — showing what it still knows rather than going blank or silent about the product's core promise.

---

## 6. Open Items (Not Yet Resolved)

None currently — see Section 7 for the resolved MVP vs. Phase 2 cut list.

---

## 7. MVP vs. Phase 2 Cut List

This resolves the last open item from Section 6. The split follows the Roadmap's own critical-path logic: the Alert Engine + Discord delivery pipeline is the product's core differentiator and wins over UI polish if timeline pressure hits. Legal/compliance items are launch blockers regardless of pressure, since they aren't optional the way a UI feature is.

### MVP — Launch Blockers
- Google OAuth + Classroom sync (read-only)
- Alert Engine: Instant Ping + Late Ping (daily repeat)
- Both Webhook **and** Bot Mode, in parallel — holds even under timeline pressure, not reopened as a cut candidate
- DM Fallback (for students without a shared Discord server)
- Privacy Policy + ToS (PDPA-compliant), OAuth verification cleared
- Dashboard — minimal version (stats bar, urgent items list, reconnect banner)

### Should-Ship (important for usability, not blockers for the alert pipeline)
- Calendar (Month/Week/Agenda, color-coding, detail panel)
- Homework module
- Connection health badge ("Not delivering")
- School-block explanation page + IT whitelist template

### Phase 2 (Deferred)
- Search & Filter (Calendar/Dashboard)
- Recent Activity feed (Dashboard)
- Data export/backup, usage analytics (already deferred per Roadmap)
- Manual timezone override (already deferred per Roadmap)

---

## 8. Change Log

| Date | Change |
|---|---|
| Checkpoint 1 | Initial concept, feature matrix, and user journey drafted |
| Checkpoint 2 | Dashboard confirmed as landing page (not Calendar); Homework module added |
| Checkpoint 3 | Discord made optional at onboarding; Webhook + Bot parallel build confirmed; Alert Rules simplified to global-only |
| Checkpoint 4 | Alert model redefined: Instant + Late (daily repeat) pings only; Digest Mode and snooze removed from scope |
| Checkpoint 5 | Synced with Roadmap/Architecture decisions: resolved completion-checkbox and onboarding-UI open items; promoted account/connection-health behaviors (reconnect banner, school-block page, connection fallback, timezone handling) into the formal feature matrix (new Section 4.6); replaced resolved items in Section 6 with newly surfaced open questions (broken-connection UI, school-block market scope, privacy policy regulatory frame) |
| Checkpoint 6 | Resolved privacy-policy regulatory frame: added Section 4.7 (Legal & Compliance) confirming PDPA as the governing framework, minor age-band handling, cross-border transfer implications for the Supabase/Vercel/Railway stack, DPO threshold, and breach-notification timing. Decided school-issued Google account is sufficient age verification — no separate signup age/grade field |
| Checkpoint 7 | Resolved school-block market scope: added a copyable IT-whitelist-request template to the School-Block Explanation Page rather than accepting those students as unreachable. Resolved broken-connection UI: added a status badge/label ("Not delivering") in Settings rather than staying fully silent. Only remaining open item is the MVP vs. Phase 2 cut list |
| Checkpoint 8 | Added Section 7 (MVP vs. Phase 2 Cut List), resolving the last open item. Webhook+Bot parallel build and DM Fallback confirmed as launch blockers even under timeline pressure; Search & Filter and Recent Activity feed deferred to Phase 2. No open items remain |
