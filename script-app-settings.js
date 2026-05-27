/* ════════════════════════════════════════════
   SETTINGS & PROFILE MODULE
   ─────────────────────────────────────────────
   All settings, profile, and sidebar functionality
════════════════════════════════════════════ */

function renderGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('dashGreeting');
  if (el) el.textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function renderAccount() {
  if (!S.user) return;
  const { name, email, picture } = S.user;
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';
  // Nav user pill
  const ava = document.querySelector('.user-pill .ava');
  const pillName = document.querySelector('.user-pill-name');
  if (ava) {
    if (picture) {
      ava.innerHTML = `<img src="${escHtml(picture)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer">`;
    } else {
      ava.textContent = initials;
    }
  }
  if (pillName) pillName.textContent = name ? name.split(' ')[0] : email;
  // Settings profile section
  const profAva   = document.getElementById('profAva');
  const profName  = document.getElementById('profName');
  const profEmail = document.getElementById('profEmailText');
  if (profAva) {
    if (picture) {
      profAva.innerHTML = `<img src="${escHtml(picture)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer">`;
    } else {
      profAva.textContent = initials;
    }
  }
  if (profName)  profName.textContent  = name  || 'Student User';
  if (profEmail) profEmail.textContent = email || '';
}

function renderSidebar() {
  const nowDay = new Date(); nowDay.setHours(0,0,0,0);
  const upcoming = S.deadlines.filter(d => d.date >= nowDay).sort((a,b) => a.date - b.date).slice(0,5);

  const dlEl  = document.getElementById('sidebarDlList');
  const cntEl = document.getElementById('sc-dl-count');
  if (cntEl) cntEl.textContent = upcoming.length;
  if (dlEl) {
    dlEl.innerHTML = upcoming.length
      ? upcoming.map(dl => {
          const c = courseById(dl.courseId);
          const diff = Math.ceil((dl.date - nowDay) / 86400000);
          const when = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff}d`;
          const cls2 = dl.urg === 'urg' ? 'when-urg' : dl.urg === 'soo' ? 'when-soo' : 'when-ok';
          return `<div class="mini-dl" onclick="openSheet('${dl.notifId}')"><div class="mini-dl-bar" style="background:${c.color}"></div><div class="mini-dl-info"><div class="mini-dl-title">${escHtml(dl.title)}</div><div class="mini-dl-class">${escHtml(c.name)}</div></div><div class="mini-dl-when ${cls2}">${when}</div></div>`;
        }).join('')
      : `<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-3)">No upcoming deadlines</div>`;
  }

  const clsEl = document.getElementById('sidebarClsList');
  if (clsEl) {
    // start with a special "All classes" item
    let html = `<div class="sidebar-cls${S.courseFilter==='all'?' active':''}" onclick="setCourseFilter('all',this)">
        <div class="sidebar-cls-dot" style="background:transparent"></div>
        <div class="sidebar-cls-info">
          <div class="sidebar-cls-name">All classes</div>
        </div>
      </div>`;
    html += S.courses.map(c => {
      const count = S.notifs.filter(n => n.courseId === c.id && !n.read).length;
      return `<div class="sidebar-cls${S.courseFilter===c.id?' active':''}" onclick="setCourseFilter('${c.id}',this)">
        <div class="sidebar-cls-dot" style="background:${c.color}"></div>
        <div class="sidebar-cls-info">
          <div class="sidebar-cls-name">${escHtml(c.name)}</div>
          ${c.section ? `<div class="sidebar-cls-teacher">${escHtml(c.section)}</div>` : ''}
        </div>
        ${count > 0 ? `<div class="sidebar-cls-cnt" style="background:${c.color}18;color:${c.color};border-color:${c.color}30">${count}</div>` : ''}
      </div>`;
    }).join('');
    clsEl.innerHTML = html;
  }
}

function renderClasses() {
  document.getElementById('clsBody').innerHTML = S.courses.map(c => `
<div class="cls-row">
  <div class="cls-swatch" style="background:${c.color}; color:var(--invertext)">${escHtml(c.abbr)}</div>
  <div class="cls-info"><b>${escHtml(c.name)}</b>${c.section ? `<span>${escHtml(c.section)}</span>` : ''}</div>
  <label class="tog"><input type="checkbox" checked onchange="saved()"><div class="tog-track"></div></label>
</div>`).join('');
}

function saved() {
  clearTimeout(S.snackTimer);
  const s = document.getElementById('snack');
  s.textContent = 'Setting saved ✓';
  s.classList.add('show');
  S.snackTimer = setTimeout(() => s.classList.remove('show'), 2200);
  saveSettings();
}

function saveSetting(key, val) {
  S.settings[key] = val;
  saveSettings();
  saved();
}

function saveQuietTime() {
  S.settings.quietStart = document.getElementById('quietStart')?.value || '22:00';
  S.settings.quietEnd   = document.getElementById('quietEnd')?.value   || '07:00';
  saveSettings();
  saved();
  qtpRenderTimeline();
}

function isQuietHours() {
  if (!S.settings.quietHours) return false;
  const now = new Date();
  const [sh, sm] = (S.settings.quietStart || '22:00').split(':').map(Number);
  const [eh, em] = (S.settings.quietEnd   || '07:00').split(':').map(Number);
  const nowMins   = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  if (startMins > endMins) return nowMins >= startMins || nowMins < endMins;
  return nowMins >= startMins && nowMins < endMins;
}

/* ════════════════════════════════════════════
   CUSTOM QUIET-HOURS TIME PICKER
════════════════════════════════════════════ */
let _qtpState = { start: { h: 22, m: 0 }, end: { h: 7, m: 0 } };

function qtpPad(n) { return String(n).padStart(2, '0'); }

function qtpRender() {
  const s = _qtpState;
  document.getElementById('qtp-start-h').textContent = qtpPad(s.start.h);
  document.getElementById('qtp-start-m').textContent = qtpPad(s.start.m);
  document.getElementById('qtp-end-h').textContent   = qtpPad(s.end.h);
  document.getElementById('qtp-end-m').textContent   = qtpPad(s.end.m);

  // Sync hidden native inputs
  const vs = qtpPad(s.start.h) + ':' + qtpPad(s.start.m);
  const ve = qtpPad(s.end.h)   + ':' + qtpPad(s.end.m);
  const qs = document.getElementById('quietStart');
  const qe = document.getElementById('quietEnd');
  if (qs) qs.value = vs;
  if (qe) qe.value = ve;

  S.settings.quietStart = vs;
  S.settings.quietEnd   = ve;
  saveSettings();
  saved();
  qtpRenderTimeline();
}

function qtpStep(which, unit, dir) {
  const t = _qtpState[which];
  if (unit === 'h') {
    t.h = (t.h + dir + 24) % 24;
  } else {
    t.m = (t.m + dir * 5 + 60) % 60;
  }
  qtpRender();
  // animate the changed value
  const el = document.getElementById(`qtp-${which}-${unit}`);
  if (el) {
    el.style.transform = dir > 0 ? 'translateY(-4px)' : 'translateY(4px)';
    el.style.opacity = '0.4';
    requestAnimationFrame(() => {
      el.style.transition = 'transform .18s cubic-bezier(.34,1.56,.64,1), opacity .15s';
      el.style.transform = 'translateY(0)';
      el.style.opacity   = '1';
      setTimeout(() => { el.style.transition = ''; }, 200);
    });
  }
}

function qtpLoadFromSettings() {
  const sv = S.settings.quietStart || '22:00';
  const ev = S.settings.quietEnd   || '07:00';
  const [sh, sm] = sv.split(':').map(Number);
  const [eh, em] = ev.split(':').map(Number);
  _qtpState.start = { h: sh, m: sm };
  _qtpState.end   = { h: eh, m: em };
  document.getElementById('qtp-start-h').textContent = qtpPad(sh);
  document.getElementById('qtp-start-m').textContent = qtpPad(sm);
  document.getElementById('qtp-end-h').textContent   = qtpPad(eh);
  document.getElementById('qtp-end-m').textContent   = qtpPad(em);
  qtpRenderTimeline();
}

function qtpToggleVisibility() {
  const enabled = document.getElementById('set_quietHours')?.checked;
  const times   = document.getElementById('qtpTimes');
  const timeline= document.getElementById('quietTimeline');
  if (times) times.style.opacity = enabled ? '1' : '0.35';
  if (times) times.style.pointerEvents = enabled ? '' : 'none';
  if (timeline) timeline.classList.toggle('qt-visible', !!enabled);
}

/* ── 24-hour timeline bar ── */
function qtpMinsToPercent(h, m) { return ((h * 60 + m) / 1440) * 100; }
function qtpPercentToHM(pct) {
  const totalMins = Math.round((pct / 100) * 1440 / 5) * 5; // snap to 5-min
  return { h: Math.floor(totalMins / 60) % 24, m: totalMins % 60 };
}

function qtpRenderTimeline() {
  const s        = _qtpState;
  const startPct = qtpMinsToPercent(s.start.h, s.start.m);
  const endPct   = qtpMinsToPercent(s.end.h,   s.end.m);

  const fill1      = document.getElementById('qtrFill');
  const fill2      = document.getElementById('qtrFill2');
  const thumbStart = document.getElementById('qtrThumbStart');
  const thumbEnd   = document.getElementById('qtrThumbEnd');
  const lblStart   = document.getElementById('qtrLabelStart');
  const lblEnd     = document.getElementById('qtrLabelEnd');
  if (!fill1) return;

  // Position thumbs — direct, no transitions
  thumbStart.style.left = startPct + '%';
  thumbEnd.style.left   = endPct   + '%';

  // Normal case: start ≤ end — single segment
  if (startPct <= endPct) {
    // Segment A: start→end
    fill1.style.display = 'block';
    fill1.style.left    = startPct + '%';
    fill1.style.width   = (endPct - startPct) + '%';
    // Full gradient across segment
    fill1.style.background = `linear-gradient(90deg, var(--violet) 0%, var(--gamemaster) 100%)`;
    fill1.style.borderRadius = '99px';

    // Segment B: hidden
    fill2.style.display = 'none';

  } else {
    // Overnight wrap: end < start — two segments
    // Segment A: 0% → endPct  (teal side, start of day)
    // Segment B: startPct → 100% (violet side, end of day)
    // We want the gradient to feel continuous: violet at start, teal at end
    // So segment B (start→right edge) is the violet portion,
    // and segment A (left edge→end) is the teal portion.

    // The full arc spans: (100 - startPct) + endPct total width
    const totalPct = (100 - startPct) + endPct;

    // Segment B: startPct → 100% — violet at left, partial gradient
    const bWidth = 100 - startPct;
    const bGradEnd = totalPct > 0 ? (bWidth / totalPct) * 100 : 50; // where teal starts within full grad
    fill1.style.display  = 'block';
    fill1.style.left     = startPct + '%';
    fill1.style.width    = bWidth + '%';
    fill1.style.borderRadius = '99px 0 0 99px';
    fill1.style.background   = `linear-gradient(90deg, var(--violet) 0%, color-mix(in srgb, var(--violet) ${100 - bGradEnd}%, var(--gamemaster) ${bGradEnd}%) 100%)`;

    // Segment A: 0% → endPct — teal at right, partial gradient
    const aWidth = endPct;
    fill2.style.display  = 'block';
    fill2.style.left     = '0%';
    fill2.style.width    = aWidth + '%';
    fill2.style.borderRadius = '0 99px 99px 0';
    fill2.style.background   = `linear-gradient(90deg, color-mix(in srgb, var(--violet) ${100 - bGradEnd}%, var(--gamemaster) ${bGradEnd}%) 0%, var(--gamemaster) 100%)`;
  }

  // Labels
  lblStart.textContent = qtpPad(s.start.h) + ':' + qtpPad(s.start.m);
  lblEnd.textContent   = qtpPad(s.end.h)   + ':' + qtpPad(s.end.m);
}

/* Drag thumbs — zero-lag, no CSS transition during drag */
(function initQtrDrag() {
  let activeDrag = null; // 'start' | 'end' | null
  const bar = () => document.getElementById('qtrBar');

  function pctFromClient(clientX) {
    const rect = bar().getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  function applyMove(clientX) {
    const pct       = pctFromClient(clientX);
    const { h, m }  = qtpPercentToHM(pct);
    _qtpState[activeDrag] = { h, m };

    // Update thumb position directly (no qtpRender to avoid stepper animation overhead)
    const thumbEl = document.getElementById(activeDrag === 'start' ? 'qtrThumbStart' : 'qtrThumbEnd');
    if (thumbEl) thumbEl.style.left = pct + '%';
    qtpRenderTimeline();

    // Also sync steppers and hidden inputs without triggering bounce animation
    const t = _qtpState[activeDrag];
    document.getElementById(`qtp-${activeDrag}-h`).textContent = qtpPad(t.h);
    document.getElementById(`qtp-${activeDrag}-m`).textContent = qtpPad(t.m);
    const vs = qtpPad(_qtpState.start.h) + ':' + qtpPad(_qtpState.start.m);
    const ve = qtpPad(_qtpState.end.h)   + ':' + qtpPad(_qtpState.end.m);
    const qs = document.getElementById('quietStart');
    const qe = document.getElementById('quietEnd');
    if (qs) qs.value = vs;
    if (qe) qe.value = ve;
    S.settings.quietStart = vs;
    S.settings.quietEnd   = ve;
  }

  function startDrag(which) {
    activeDrag = which;
    bar().classList.add('qtr-is-dragging');
    document.body.style.userSelect = 'none';
  }

  function endDrag() {
    if (!activeDrag) return;
    activeDrag = null;
    bar().classList.remove('qtr-is-dragging');
    document.body.style.userSelect = '';
    saveSettings();
    saved();
  }

  function setupThumb(thumbId, which) {
    const thumb = document.getElementById(thumbId);
    if (!thumb) return;

    thumb.addEventListener('mousedown', e => {
      e.preventDefault();
      startDrag(which);
    });
    thumb.addEventListener('touchstart', e => {
      startDrag(which);
    }, { passive: true });
  }

  // Global move/up listeners (attached once, check activeDrag)
  document.addEventListener('mousemove', e => {
    if (!activeDrag) return;
    applyMove(e.clientX);
  });
  document.addEventListener('mouseup', () => endDrag());

  document.addEventListener('touchmove', e => {
    if (!activeDrag) return;
    e.preventDefault();
    applyMove(e.touches[0].clientX);
  }, { passive: false });
  document.addEventListener('touchend', () => endDrag());

  // Also allow clicking anywhere on the bar to jump nearest thumb
  const barEl = document.getElementById('qtrBar');
  if (barEl) {
    barEl.addEventListener('mousedown', e => {
      if (e.target.classList.contains('qtr-thumb')) return; // handled by thumb
      const pct = pctFromClient(e.clientX);
      // Move whichever thumb is closer
      const startPct = qtpMinsToPercent(_qtpState.start.h, _qtpState.start.m);
      const endPct   = qtpMinsToPercent(_qtpState.end.h,   _qtpState.end.m);
      const dStart   = Math.abs(pct - startPct);
      const dEnd     = Math.abs(pct - endPct);
      startDrag(dStart <= dEnd ? 'start' : 'end');
      applyMove(e.clientX);
    });
  }

  function init() {
    setupThumb('qtrThumbStart', 'start');
    setupThumb('qtrThumbEnd',   'end');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ════════════════════════════════════════════
   GOOGLE CALENDAR SYNC
════════════════════════════════════════════ */

const GCAL_API = 'https://www.googleapis.com/calendar/v3';
const GCAL_STORE_KEY = 'aul_gcal_ids';

function gcalLoadMap() {
  let obj = {};
  try { obj = JSON.parse(localStorage.getItem(GCAL_STORE_KEY) || '{}'); } catch(e) {}
  return Object.assign(Object.create(null), obj);
}

function gcalSaveMap(map) {
  localStorage.setItem(GCAL_STORE_KEY, JSON.stringify(map));
}

async function gcalRequest(method, path, body) {
  const res = await fetch(GCAL_API + path, {
    method,
    headers: { 'Authorization': 'Bearer ' + S.token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.error && err.error.message) || ('Calendar API ' + res.status));
  }
  return method === 'DELETE' ? null : res.json();
}

function gcalBuildClassroomEvent(dl) {
  const c = courseById(dl.courseId);
  const pad = n => String(n).padStart(2, '0');
  const d = dl.date;
  const dateStr = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  const endDate = new Date(d); endDate.setDate(endDate.getDate() + 1);
  const endStr  = endDate.getFullYear() + '-' + pad(endDate.getMonth()+1) + '-' + pad(endDate.getDate());
  return {
    summary: '\uD83D\uDCDA ' + dl.title,
    description: 'Course: ' + c.name + '\nSynced by Aulert',
    start: { date: dateStr },
    end:   { date: endStr },
    colorId: '9',
    extendedProperties: { private: { aulertId: dl.notifId, aulertType: 'classroom' } },
  };
}

function gcalBuildHwEvent(task) {
  const pad = n => String(n).padStart(2, '0');
  const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
  const [y, m, d] = datePart.split('-').map(Number);
  const dateStr = y + '-' + pad(m) + '-' + pad(d);
  const endDate = new Date(y, m - 1, d + 1);
  const endStr  = endDate.getFullYear() + '-' + pad(endDate.getMonth()+1) + '-' + pad(endDate.getDate());
  return {
    summary: '\u270F\uFE0F ' + task.subject,
    description: (task.desc || '') + '\nHomework — synced by Aulert',
    start: { date: dateStr },
    end:   { date: endStr },
    colorId: '2',
    extendedProperties: { private: { aulertId: 'hw-' + task.id, aulertType: 'homework' } },
  };
}

async function gcalSyncAll() {
  if (!S.token || !S.settings.gcalSync) return;
  const map = gcalLoadMap();
  const nowDay = new Date(); nowDay.setHours(0, 0, 0, 0);

  // Gather all items to sync: classroom deadlines + hw tasks
  const classroomItems = S.deadlines
    .filter(dl => dl.date >= nowDay)
    .map(dl => ({ id: dl.notifId, event: gcalBuildClassroomEvent(dl) }));

  const hwItems = _hwTasks
    .filter(task => task.date && !task.done)
    .map(task => {
      const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
      const [y, m, d] = datePart.split('-').map(Number);
      const taskDate = new Date(y, m - 1, d);
      if (taskDate < nowDay) return null;
      return { id: 'hw-' + task.id, event: gcalBuildHwEvent(task) };
    })
    .filter(Boolean);

  const allItems = [...classroomItems, ...hwItems];
  const activeIds = new Set(allItems.map(x => x.id));

  let created = 0, updated = 0, removed = 0, errors = 0;

  // Remove stale events
  for (const notifId of Object.keys(map)) {
    if (!activeIds.has(notifId)) {
      try { await gcalRequest('DELETE', '/calendars/primary/events/' + map[notifId]); removed++; }
      catch(e) { /* already gone */ }
      delete map[notifId];
    }
  }

  // Create or update
  for (const item of allItems) {
    try {
      if (map[item.id]) {
        await gcalRequest('PUT', '/calendars/primary/events/' + map[item.id], item.event);
        updated++;
      } else {
        const res = await gcalRequest('POST', '/calendars/primary/events', item.event);
        map[item.id] = res.id;
        created++;
      }
    } catch(e) {
      console.warn('gcal sync error:', item.id, e.message);
      errors++;
    }
  }

  gcalSaveMap(map);
  const parts = [];
  if (created) parts.push(created + ' added');
  if (updated) parts.push(updated + ' updated');
  if (removed) parts.push(removed + ' removed');
  const msg = parts.length ? parts.join(', ') : 'Already up to date';
  if (errors) showToast('Calendar sync (partial)', msg + ' \u00b7 ' + errors + ' failed');
  else        showToast('Google Calendar synced \u2713', msg);
  gcalRenderStatus();
}

async function gcalUnsyncAll() {
  if (!S.token) return;
  const map = gcalLoadMap();
  let removed = 0;
  for (const gcalId of Object.values(map)) {
    try { await gcalRequest('DELETE', '/calendars/primary/events/' + gcalId); removed++; }
    catch(e) { /* already gone */ }
  }
  localStorage.removeItem(GCAL_STORE_KEY);
  showToast('Google Calendar unsynced', removed + ' event' + (removed !== 1 ? 's' : '') + ' removed');
  gcalRenderStatus();
}

function gcalRenderStatus() {
  const map   = gcalLoadMap();
  const count = Object.keys(map).length;
  const el    = document.getElementById('gcalStatusText');
  if (el) el.textContent = S.settings.gcalSync
    ? count + ' item' + (count !== 1 ? 's' : '') + ' synced to Google Calendar'
    : 'Sync disabled';
  const syncBtn   = document.getElementById('gcalSyncBtn');
  const unsyncBtn = document.getElementById('gcalUnsyncBtn');
  if (syncBtn)   syncBtn.style.display   = S.settings.gcalSync ? 'inline-flex' : 'none';
  if (unsyncBtn) unsyncBtn.style.display = (S.settings.gcalSync && count > 0) ? 'inline-flex' : 'none';
}

function gcalToggle(el) {
  S.settings.gcalSync = el.checked;
  saveSettings();
  gcalRenderStatus();
  if (el.checked) gcalSyncAll();
  saved();
}

function renderSettings() {
  const m = S.settings;
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.checked = !!val; };
  set('set_stream', m.stream);
  set('set_announcements', m.announcements);
  set('set_assignments', m.assignments);
  set('set_grades', m.grades);
  set('set_materials', m.materials);
  set('set_push', m.push);
  set('set_quietHours', m.quietHours);
  set('set_sound', m.sound);
  const qs = document.getElementById('quietStart');
  const qe = document.getElementById('quietEnd');
  if (qs) qs.value = m.quietStart || '22:00';
  if (qe) qe.value = m.quietEnd   || '07:00';
  qtpLoadFromSettings();
  qtpToggleVisibility();
  set('set_gcalSync', m.gcalSync);
  gcalRenderStatus();
}

function reqPush(el) {
  if (el.checked && 'Notification' in window) {
    Notification.requestPermission().then(p => {
      S.settings.push = p === 'granted';
      saveSettings();
      if (p === 'granted') new Notification('Aulert', { body: 'Push notifications enabled!' });
    });
  } else {
    S.settings.push = false;
    saveSettings();
  }
  saved();
}

/* ── Mouse wheel support on time values ── */
document.addEventListener('wheel', function(e) {
  const el = e.target.closest('.qtp-wrap');
  if (!el) return;
  e.preventDefault();
  const which = el.id === 'qtpStartWrap' ? 'start' : 'end';
  const col = e.target.closest('.qtp-col');
  if (!col) return;
  const valEl = col.querySelector('.qtp-val');
  const unit = valEl?.id.endsWith('-h') ? 'h' : 'm';
  qtpStep(which, unit, e.deltaY < 0 ? 1 : -1);
}, { passive: false });
