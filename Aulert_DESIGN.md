# Aulert — Design Rules
> A dark-canvas, taxonomy-driven design language adapted from GSAP's style reference for a dense student notification app. Color encodes meaning (urgency vs. course), not decoration. Typography is Bricolage Grotesque throughout — one family, two weights, tight tracking.

**Themes:** dark (default) and light — same structure, tokens swap by role, not by inverting hex values blindly.

---

## 1. Design Philosophy

1. **Color is taxonomy, not decoration.** Orange means "overdue, act now" and nothing else. The four remaining hues (green, pink, lilac, blue) tag courses as plain colored text — never as filled badges.
2. **Outline-only controls.** Every interactive control is a ghost-pill: transparent fill, 1px border, 100px radius. There are no filled/solid buttons anywhere in the system, including primary actions like "Save" or "Mark complete."
3. **Hairline dividers over cards.** Dense lists (Homework, Calendar, Dashboard urgent items) are separated by 1px hairlines, not boxed into individual cards. Cards are reserved for the off-black/warm-tint "nested panel" role (stat metrics, calendar day cells' background is NOT a card — cells are grid cells).
4. **One display moment per screen.** Only the Dashboard's greeting headline gets the large display treatment (44px+). Every other screen — Calendar, Homework, Settings — stays in the compact UI range (13–19px). Don't repeat the "big number" hero move on every screen; it stops meaning "important" if it's everywhere.
5. **Single type family.** Bricolage Grotesque carries both headings (600) and body/UI (400). No second display face. Prompt is a script fallback for Thai content only, not a stylistic choice.

---

## 2. Color Tokens

### Dark theme (default)

| Name | Value | Token | Role |
|---|---|---|---|
| Just Black | `#0e100f` | `--color-bg` | Page canvas |
| Cream | `#fffce1` | `--color-text-primary` | Primary text, ghost-pill borders, active nav |
| Surface 50 | `#7c7c6f` | `--color-text-muted` | Secondary text, inactive nav, due dates (non-urgent), icons at rest |
| Surface 25 | `#42433d` | `--color-hairline` | Row dividers, grid lines, low-contrast outlines |
| Off Black | `#191919` | `--color-panel` | Stat/metric card backgrounds only |
| **Alarm Orange** | `#ff8709` | `--color-alarm` | **Reserved exclusively for overdue/urgent semantics** — overdue stat count, overdue item title, overdue due-date text. Never used for anything else. |
| Course — Green | `#0ae448` | `--color-course-1` | Course tag text (reserved, currently unused in mocks — see Section 6 open item) |
| Course — Pink | `#fec5fb` | `--color-course-2` | Course tag text |
| Course — Lilac | `#9d95ff` | `--color-course-3` | Course tag text |
| Course — Blue | `#00bae2` | `--color-course-4` | Course tag text |

### Light theme

| Name | Value | Token | Role | Derived from |
|---|---|---|---|---|
| Cream Paper | `#FFFCE1` | `--color-bg` | Page canvas | Dark theme's `--color-text-primary` |
| Ink | `#17181A` | `--color-text-primary` | Primary text, ghost-pill borders, active nav | Dark theme's `--color-bg` |
| Slate | `#6B6B5E` | `--color-text-muted` | Secondary text, inactive nav, due dates | Darkened for AA contrast on cream |
| Warm Hairline | `#E4E0C8` | `--color-hairline` | Row dividers, grid lines | Lightened for visibility on cream |
| Warm Panel | `#F5F0D8` | `--color-panel` | Stat/metric card backgrounds only | Slightly darker than page bg, same warmth |
| **Alarm Orange (on-light)** | `#C15A00` | `--color-alarm` | Overdue/urgent semantics | Darkened from `#ff8709` — original fails text contrast on cream |
| Course — Green (on-light) | `#0B8A2E` | `--color-course-1` | Course tag text | Darkened from `#0ae448` |
| Course — Pink (on-light) | `#B23FA8` | `--color-course-2` | Course tag text | Darkened from `#fec5fb` |
| Course — Lilac (on-light) | `#5B4FD1` | `--color-course-3` | Course tag text | Darkened from `#9d95ff` |
| Course — Blue (on-light) | `#0089A8` | `--color-course-4` | Course tag text | Darkened from `#00bae2` |

**Rule:** never use a dark-theme hue value directly on a light background, or vice versa. Each theme has its own contrast-safe variant; swap the whole token, not just the background.

---

## 3. Typography

| Role | Family | Weight | Notes |
|---|---|---|---|
| Headings (Dashboard greeting only) | Bricolage Grotesque | 600 | 44px, line-height 1.2, letter-spacing -0.44px. Reserved for one hero moment per screen (Dashboard greeting). |
| Recurring nav headers (e.g. calendar month label) | Bricolage Grotesque | 600 | 24px, letter-spacing -0.24px. Smaller than the full display treatment — this repeats often, so it doesn't get the hero size. |
| Body / UI / lists | Bricolage Grotesque | 400 | 13–19px depending on density. This is the resting rhythm — nav items, item titles, form labels, table cells. |
| Emphasized body (item titles, "Aulert" wordmark) | Bricolage Grotesque | 600 | Same size as surrounding body text, weight is the only differentiator. |
| Thai-script fallback | Prompt | 400 / 600 | Loads automatically via font stack when Bricolage Grotesque lacks Thai glyphs. Matches weight-for-weight with Bricolage. |

**Font stack:** `'Bricolage Grotesque', 'Prompt', sans-serif`

**Weights:** strictly 400 and 600. No 500, no 700. If something needs to feel "more important" than 600, increase size instead of weight.

**Letter-spacing:** tight/negative at heading sizes (-0.24px to -0.44px), matching the GSAP source aesthetic. Body text uses default spacing — the tightness is a headline signature, not an all-text rule.

**⚠️ Production note:** GSAP's actual typeface is **Mori**, a commercial custom font not available on any public CDN. All mockups in this doc substitute **Bricolage Grotesque** throughout (both heading and body roles) per the latest direction. Before shipping, confirm whether Aulert licenses Mori directly or commits to Bricolage Grotesque permanently — don't let the substitute silently become the "real" choice without an explicit decision.

---

## 4. Components

### Ghost-pill button (the only button)
Transparent background, 1px border in `--color-text-primary`, 100px border-radius, 6–8px vertical / 16–18px horizontal padding, 13–14px text at weight 600. Used for **every** interactive control: nav CTAs, "Save," "Mark complete," "Invite bot," "See calendar," view-tab selection (active tab), filters. There is no filled/solid variant anywhere in Aulert.

### Category color label (course tag)
Plain colored text, 12–14px, weight 400, no background, no border. Color comes from the course-hue token set (Section 2). This is a text color, not a badge — do not wrap it in a pill or add a fill.

### Stat / metric card
`--color-panel` background, 8px border-radius, no border, 16px/20px padding. Large number (28–32px, weight 600) above a small label (13–14px, weight 400). The overdue card's number and label both use `--color-alarm`; all other stat cards use default text colors.

### Item row (Dashboard, Homework)
Flex row, 12px gap, 16px vertical padding, bottom hairline divider (`--color-hairline`, 1px, full width, no border-radius). Contains: checkbox icon (borderless icon button, round, no bg), item title, course tag (colored text), due date, overflow icon button (dots, borderless). Overdue rows tint their title and due-date text with `--color-alarm`; everything else stays default.

### Calendar grid
CSS grid, 7 equal columns, hairline borders forming the grid lines (not gaps + card cells). Day number top-left of each cell, small and muted. Items inside a cell render as colored text lines (category color label pattern), not chips. Overflow beyond 2 items shows "+N more" in muted text. Today's cell gets a small ghost-pill circle around the day number — not a thicker border, not a fill.

### Detail panel (Classroom-synced vs. Homework item)
Bordered panel (1px `--color-hairline` or `--color-text-primary` at higher emphasis), no drop shadow. Classroom-synced items are read-only with a single "Open in Classroom" ghost-pill action. Homework items are editable with "Edit" / "Delete" / "Mark complete" ghost-pills. Source (Classroom vs. self-created) is a hover-reveal detail, never a persistent badge on the calendar/dashboard grid — only appears once the panel is open.

### Navigation bar
Flex row, "Aulert" wordmark at weight 600, nav items at weight 400 (muted) with the active page at weight 400/600 in `--color-text-primary`. No underline, no background pill on the active item — active state is conveyed by color contrast alone (matches GSAP's "Ghost Nav Link" component).

---

## 5. Spacing & Shape

Reused directly from the GSAP source — no changes needed for Aulert's context.

| Element | Value |
|---|---|
| Base unit | 4px |
| Card padding | 16–20px (Aulert's stat cards are smaller than GSAP's marketing cards) |
| Row vertical padding | 16px |
| Element gap | 12–16px |
| Card / panel radius | 8px |
| Pill / button radius | 100px |
| Hairline weight | 1px |

---

## 6. Open Items (Not Yet Resolved)

- [ ] **5-color taxonomy ceiling.** GSAP's system is a closed 5-hue taxonomy (one color = one meaning, never reused). Aulert reserves Orange for urgency and has 4 remaining hues for courses. A student with 5+ concurrent courses will run out of distinct hues. Decide: reuse hues across courses (breaks the "one color, one meaning" rule), open the palette beyond 5, or accept a 4-course visual ceiling before building the real course-color assignment logic.
- [ ] **Mori licensing.** Confirm whether production Aulert licenses the real Mori typeface or formally adopts Bricolage Grotesque as the permanent brand face. All work so far uses Bricolage Grotesque as a stand-in.
- [ ] **Light theme parity check.** Only the Dashboard has been fully re-derived for light theme. Calendar, Homework, Settings, and the detail panel still need their on-light hue/hairline/panel tokens applied and visually confirmed for contrast (especially the course-hue text colors, which needed manual darkening once already).
- [ ] **Heading-tag rendering gotcha.** In at least one prototyping environment, native `<h1>`/`<h2>` tags had their color force-overridden by host styles regardless of inline color. Production build should verify custom heading colors render correctly in the actual framework (Next.js/React), and not assume the workaround (styling headings as plain text elements) is needed outside the prototyping tool.

---

## 7. Do's and Don'ts

### Do
- Reserve Alarm Orange for overdue/urgent meaning only — stat counts, item titles, due-date text on overdue items.
- Render every button as a ghost-pill: transparent fill, 1px border, 100px radius, weight 600 text.
- Separate list rows with 1px hairlines, not individual bordered/shadowed cards.
- Render course tags as plain colored text, never as a filled badge or pill.
- Keep the large display-headline treatment to one moment per screen (the Dashboard greeting).
- Use Bricolage Grotesque at exactly two weights: 400 and 600.

### Don't
- Don't introduce a filled/solid button anywhere, even for primary actions like "Save."
- Don't reuse Alarm Orange for anything other than urgency — not for a course color, not for a decorative accent.
- Don't add a persistent "Classroom-synced" or "Homework" badge to calendar/dashboard items — that distinction is hover/click-only, inside the detail panel.
- Don't apply drop shadows anywhere — depth comes from the panel/hairline system, not shadows.
- Don't use a third font weight (500, 700, etc.) — the system is binary between 400 and 600.
- Don't hardcode a dark-theme hue value onto a light background or vice versa — always swap to the theme's own on-light/on-dark variant.
