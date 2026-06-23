/* ════════════════════════════════════════════
   SETTINGS & PROFILE MODULE
   ─────────────────────────────────────────────
   All settings, profile, and sidebar functionality
════════════════════════════════════════════ */

function renderGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('dashGreeting');
  const navEl = document.getElementById('navGreeting');
  const msg = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (el) el.textContent = msg;
  if (navEl) navEl.textContent = msg;
}

function renderAccount() {
  if (!S.user) return;
  const { name, email, picture } = S.user;
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';
  // Nav user pill
  const ava = document.querySelector('.user-pill .ava');
  const pillName = document.querySelector('.user-pill-name');
  if (ava) {
    ava.innerHTML = '';
    if (picture) {
      const img = document.createElement('img');
      img.src = picture;
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover';
      img.referrerPolicy = 'no-referrer';
      ava.appendChild(img);
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
    profAva.innerHTML = '';
    if (picture) {
      const img = document.createElement('img');
      img.src = picture;
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover';
      img.referrerPolicy = 'no-referrer';
      profAva.appendChild(img);
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
    dlEl.innerHTML = '';
    if (upcoming.length) {
      upcoming.forEach(dl => {
        const c = courseById(dl.courseId);
        const diff = Math.ceil((dl.date - nowDay) / 86400000);
        const when = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff}d`;
        const cls2 = dl.urg === 'urg' ? 'when-urg' : dl.urg === 'soo' ? 'when-soo' : 'when-ok';
        const div = document.createElement('div');
        div.className = 'mini-dl';
        div.onclick = () => openSheet(dl.notifId);
        const bar = document.createElement('div');
        bar.className = 'mini-dl-bar';
        bar.style.background = c.color;
        const info = document.createElement('div');
        info.className = 'mini-dl-info';
        const title = document.createElement('div');
        title.className = 'mini-dl-title';
        title.textContent = dl.title;
        const clsName = document.createElement('div');
        clsName.className = 'mini-dl-class';
        clsName.textContent = c.name;
        info.appendChild(title);
        info.appendChild(clsName);
        const whenEl = document.createElement('div');
        whenEl.className = 'mini-dl-when ' + cls2;
        whenEl.textContent = when;
        div.appendChild(bar);
        div.appendChild(info);
        div.appendChild(whenEl);
        dlEl.appendChild(div);
      });
    } else {
      dlEl.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-3)">No upcoming deadlines</div>';
    }
  }

  const clsEl = document.getElementById('sidebarClsList');
  if (clsEl) {
    clsEl.innerHTML = '';
    const addCls = (id, color, name, section, count) => {
      const div = document.createElement('div');
      div.className = 'sidebar-cls' + (S.courseFilter === id ? ' active' : '');
      div.tabIndex = 0;
      div.onclick = function() { setCourseFilter(id, this); };
      div.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCourseFilter(id, this); } };
      const dot = document.createElement('div');
      dot.className = 'sidebar-cls-dot';
      dot.style.background = color;
      div.appendChild(dot);
      const info = document.createElement('div');
      info.className = 'sidebar-cls-info';
      const nEl = document.createElement('div');
      nEl.className = 'sidebar-cls-name';
      nEl.textContent = name;
      info.appendChild(nEl);
      if (section) {
        const sEl = document.createElement('div');
        sEl.className = 'sidebar-cls-teacher';
        sEl.textContent = section;
        info.appendChild(sEl);
      }
      div.appendChild(info);
      if (count > 0) {
        const cEl = document.createElement('div');
        cEl.className = 'sidebar-cls-cnt';
        cEl.style.cssText = `background:${color}18;color:${color};border-color:${color}30`;
        cEl.textContent = count;
        div.appendChild(cEl);
      }
      clsEl.appendChild(div);
    };
    addCls('all', 'transparent', 'All classes', null, 0);
    S.courses.forEach(c => {
      const count = S.notifs.filter(n => n.courseId === c.id && !n.read).length;
      addCls(c.id, c.color, c.name, c.section, count);
    });
  }
}

function renderClasses() {
  const body = document.getElementById('clsBody');
  body.innerHTML = '';
  S.courses.forEach(c => {
    const row = document.createElement('div');
    row.className = 'cls-row';
    const swatch = document.createElement('div');
    swatch.className = 'cls-swatch';
    swatch.style.cssText = `background:${c.color}; color:var(--invertext)`;
    swatch.textContent = c.abbr;
    row.appendChild(swatch);
    const info = document.createElement('div');
    info.className = 'cls-info';
    const b = document.createElement('b');
    b.textContent = c.name;
    info.appendChild(b);
    if (c.section) {
      const span = document.createElement('span');
      span.textContent = c.section;
      info.appendChild(span);
    }
    row.appendChild(info);
    const lbl = document.createElement('label');
    lbl.className = 'tog';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;
    chk.onchange = saved;
    const trk = document.createElement('div');
    trk.className = 'tog-track';
    lbl.appendChild(chk);
    lbl.appendChild(trk);
    row.appendChild(lbl);
    body.appendChild(row);
  });
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
  if (!Object.prototype.hasOwnProperty.call(S.settings, key)) return;
  const prev = S.settings[key];
  S.settings[key] = val;
  try {
    saveSettings();
    saved();
  } catch(e) {
    // Revert on storage failure
    S.settings[key] = prev;
    const el = document.getElementById('set_' + key);
    if (el) el.checked = !!prev;
    console.error('saveSetting failed:', e);
    showToast('Save failed', 'Could not save setting — storage error');
  }
}



/* ════════════════════════════════════════════
   GOOGLE CALENDAR SYNC
════════════════════════════════════════════ */

const GCAL_API = 'https://www.googleapis.com/calendar/v3';
const GCAL_STORE_KEY = 'aul_gcal_ids';

function gcalLoadMap() {
  try {
    return JSON.parse(localStorage.getItem(GCAL_STORE_KEY)) || {};
  } catch(e) {
    console.warn('Failed to parse gcal map from localStorage', e);
    return {};
  }
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
  if (!S.token) throw new Error('Not signed in');
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
      catch(e) { console.warn('Failed to delete gcal event:', e); }
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

  // If every single operation failed (and there were items), treat as a hard failure
  const totalOps = allItems.length + removed;
  if (totalOps > 0 && errors === totalOps) {
    throw new Error('All Calendar operations failed — check permissions');
  }

  const parts = [];
  if (created) parts.push(created + ' added');
  if (updated) parts.push(updated + ' updated');
  if (removed) parts.push(removed + ' removed');
  const msg = parts.length ? parts.join(', ') : 'Already up to date';
  if (errors) showToast('Calendar sync (partial)', msg + ' · ' + errors + ' failed');
  else        showToast('Google Calendar synced ✓', msg);
  gcalRenderStatus();
}

async function gcalUnsyncAll() {
  if (!S.token) return;
  const map = gcalLoadMap();
  let removed = 0;
  for (const gcalId of Object.values(map)) {
    try { await gcalRequest('DELETE', '/calendars/primary/events/' + gcalId); removed++; }
    catch(e) { console.warn('Failed to delete gcal event:', e); }
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
  const checked = el.checked;

  if (!checked) {
    // Turning off: revert immediately in UI, then unsync in background
    S.settings.gcalSync = false;
    saveSettings();
    gcalRenderStatus();
    saved();
    gcalUnsyncAll();
    return;
  }

  // Turning on: disable toggle until sync confirms success
  el.disabled = true;
  el.closest('label')?.classList.add('tog-loading');

  gcalSyncAll()
    .then(result => {
      // Only mark as enabled if sync didn't fully fail
      S.settings.gcalSync = true;
      saveSettings();
      gcalRenderStatus();
      saved();
    })
    .catch(err => {
      console.error('gcalToggle sync failed:', err);
      // Revert toggle
      el.checked = false;
      S.settings.gcalSync = false;
      saveSettings();
      gcalRenderStatus();
      showToast('Calendar sync failed', err.message || 'Could not connect to Google Calendar');
    })
    .finally(() => {
      el.disabled = false;
      el.closest('label')?.classList.remove('tog-loading');
    });
}

function renderSettings() {
  const m = S.settings;
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.checked = !!val; };
  set('set_stream', m.stream);
  set('set_announcements', m.announcements);
  set('set_assignments', m.assignments);
  set('set_grades', m.grades);
  set('set_materials', m.materials);

  set('set_gcalSync', m.gcalSync);
  gcalRenderStatus();
  
  set('set_dailyEmail', m.dailyEmail);
  dailyEmailRenderStatus();
}

/* ════════════════════════════════════════════
   DAILY EMAIL SUMMARY
════════════════════════════════════════════ */

function dailyEmailRenderStatus() {
  const el = document.getElementById('emailPrefText');
  if (el) el.textContent = S.settings.dailyEmail ? 'Enabled — Emails sent daily at 7 AM UTC' : 'Disabled';
}

function dailyEmailToggle(el) {
  const checked = el.checked;

  // Lock toggle while the async operation is in-flight
  el.disabled = true;
  el.closest('label')?.classList.add('tog-loading');
  const unlock = () => {
    el.disabled = false;
    el.closest('label')?.classList.remove('tog-loading');
  };

  if (!checked) {
    // ─── DISABLE ─────────────────────────────────────────────────────────────
    // Call API first; only confirm state change on success
    fetch('/api/emailPrefs', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + S.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyEmail: false })
    })
    .then(res => {
      if (!res.ok) throw new Error('Server returned ' + res.status);
      S.settings.dailyEmail = false;
      saveSettings();
      dailyEmailRenderStatus();
      saved();
    })
    .catch(e => {
      console.warn('Failed to disable daily email:', e);
      el.checked = true; // revert — server still has it enabled
      showToast('Could not disable', 'Server error — please try again');
    })
    .finally(unlock);
    return;
  }

  // ─── ENABLE ──────────────────────────────────────────────────────────────
  if (!window.google?.accounts?.oauth2) {
    el.checked = false;
    unlock();
    showToast('Not ready', 'Google Sign-In is still loading');
    return;
  }

  let oauthCompleted = false;

  const client = google.accounts.oauth2.initCodeClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    access_type: 'offline',
    callback: async (resp) => {
      oauthCompleted = true;
      if (resp.error) {
        console.warn('OAuth code error:', resp.error);
        el.checked = false;
        unlock();
        showToast('Permission denied', 'Offline access is required for daily emails');
        return;
      }

      try {
        const apiRes = await fetch('/api/emailPrefs', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + S.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyEmail: true, authCode: resp.code })
        });

        const body = await apiRes.json().catch(() => ({}));
        if (!apiRes.ok) throw new Error(body.error || 'Server returned ' + apiRes.status);

        // Confirmed success — now save state
        S.settings.dailyEmail = true;
        saveSettings();
        dailyEmailRenderStatus();
        saved();
      } catch(e) {
        console.warn('Failed to enable daily email:', e);
        el.checked = false;
        showToast('Failed to enable', e.message || 'Server error — please try again');
      } finally {
        unlock();
      }
    }
  });

  // Detect if user closes/cancels the OAuth popup without completing
  window.addEventListener('focus', function onWindowFocus() {
    window.removeEventListener('focus', onWindowFocus);
    setTimeout(() => {
      if (!oauthCompleted) {
        el.checked = false;
        unlock();
      }
    }, 400);
  }, { once: true });

  client.requestCode();
}
