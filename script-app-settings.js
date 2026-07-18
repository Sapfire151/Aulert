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
      img.alt = name ? `${name}'s avatar` : 'User profile';
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
      img.alt = name ? `${name}'s avatar` : 'User profile';
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
      dlEl.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-3)">☀️ Clear skies! No deadlines ahead now go touch grass. 🌿</div>';
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
  s.textContent = 'Settings locked in 🔒';
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
  renderDiscordIntegration();
  loadDiscordConfiguration();
}

const DISCORD_OFFLINE_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
].join(' ');

let discordConfig = { enabled: false, webhooks: [] };

function escapeDiscordText(value) {
  const node = document.createElement('span');
  node.textContent = String(value || '');
  return node.innerHTML;
}

function renderDiscordIntegration() {
  const webhooks = Array.isArray(discordConfig.webhooks) ? discordConfig.webhooks : [];
  document.querySelectorAll('.discord-integration').forEach((section) => {
    const status = section.querySelector('.discord-status');
    const list = section.querySelector('.discord-list');
    if (status) {
      status.textContent = webhooks.length
        ? `${webhooks.length} destination${webhooks.length === 1 ? '' : 's'} connected · checks every 10 minutes`
        : 'Add a Discord incoming webhook to receive new Classroom updates, even while Aulert is closed.';
    }
    if (list) {
      list.innerHTML = webhooks.length
        ? webhooks.map((webhook) => `<div class="discord-destination">
            <div><strong>${escapeDiscordText(webhook.label)}</strong><span>${webhook.lastError ? `Needs attention: ${escapeDiscordText(webhook.lastError)}` : webhook.lastDeliveryAt ? 'Last delivery successful' : 'Ready for delivery'}</span></div>
            <div class="discord-destination-actions"><button type="button" class="btn-sm" data-webhook-id="${webhook.id}" onclick="discordTest(this.dataset.webhookId)">Test</button><button type="button" class="btn-sm discord-remove" data-webhook-id="${webhook.id}" onclick="discordRemove(this.dataset.webhookId)">Remove</button></div>
          </div>`).join('')
        : '<p class="discord-empty">No Discord destinations connected.</p>';
    }
    section.querySelectorAll('.discord-add-button').forEach((button) => { button.disabled = webhooks.length >= 5; });
    section.querySelectorAll('.discord-disconnect').forEach((button) => { button.hidden = !webhooks.length; });
  });
}

async function discordApi(payload) {
  const response = await fetch('/api/emailPrefs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${S.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Server returned ${response.status}`);
  return body;
}

async function loadDiscordConfiguration() {
  if (S.token?.startsWith('preview_bypass')) {
    discordConfig = S.settings.discordConfig || { enabled: false, webhooks: [] };
    renderDiscordIntegration();
    return;
  }
  if (!S.token) return;
  try {
    discordConfig = await discordApi({ action: 'list' });
  } catch (error) {
    console.warn('Failed to load Discord configuration:', error);
  }
  renderDiscordIntegration();
}

function requestDiscordAuthorization() {
  if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('Google Sign-In is still loading'));
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: DISCORD_OFFLINE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      callback: (response) => response.error ? reject(new Error('Google authorization was cancelled')) : resolve(response.code),
    });
    client.requestCode();
  });
}

async function discordAdd(form) {
  const labelInput = form.querySelector('[data-discord-label]');
  const webhookInput = form.querySelector('[data-discord-url]');
  const button = form.querySelector('.discord-add-button');
  const webhookUrl = webhookInput?.value.trim();
  if (!webhookUrl) {
    showToast('Webhook URL required', 'Paste a Discord incoming webhook URL to continue');
    webhookInput?.focus();
    return;
  }
  if (button) { button.disabled = true; button.textContent = 'Connecting…'; }
  try {
    if (S.token?.startsWith('preview_bypass')) {
      discordConfig.webhooks.push({ id: `preview-${Date.now()}`, label: labelInput?.value.trim() || 'Discord webhook' });
      discordConfig.enabled = true;
      S.settings.discordConfig = discordConfig;
      saveSettings();
    } else {
      const authCode = discordConfig.enabled ? undefined : await requestDiscordAuthorization();
      discordConfig = await discordApi({ action: 'add', label: labelInput?.value, webhookUrl, authCode });
    }
    form.reset();
    renderDiscordIntegration();
    showToast('Discord connected', 'Aulert sent a test message and will check for updates every 10 minutes.');
  } catch (error) {
    showToast('Could not connect Discord', error.message || 'Please try again');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Add destination'; }
  }
}

async function discordTest(webhookId) {
  try {
    if (S.token?.startsWith('preview_bypass')) {
      showToast('Test message sent', 'Preview Mode — no Discord message was delivered.');
      return;
    }
    await discordApi({ action: 'test', webhookId });
    await loadDiscordConfiguration();
    showToast('Test message sent', 'Check the selected Discord channel.');
  } catch (error) {
    showToast('Discord test failed', error.message || 'Please try again');
  }
}

async function discordRemove(webhookId) {
  if (!await showConfirmDialog('Remove destination?', 'This Discord webhook will stop receiving Classroom updates.', 'Remove')) return;
  try {
    if (S.token?.startsWith('preview_bypass')) {
      discordConfig.webhooks = discordConfig.webhooks.filter((webhook) => webhook.id !== webhookId);
      discordConfig.enabled = Boolean(discordConfig.webhooks.length);
      S.settings.discordConfig = discordConfig;
      saveSettings();
    } else {
      discordConfig = await discordApi({ action: 'remove', webhookId });
    }
    renderDiscordIntegration();
    showToast('Destination removed', 'It will no longer receive Aulert updates.');
  } catch (error) {
    showToast('Could not remove destination', error.message || 'Please try again');
  }
}

async function discordDisconnect() {
  if (!await showConfirmDialog('Disconnect all Discord destinations?', 'This permanently removes the stored offline authorization and all webhooks.', 'Disconnect')) return;
  try {
    if (S.token?.startsWith('preview_bypass')) {
      discordConfig = { enabled: false, webhooks: [] };
      S.settings.discordConfig = discordConfig;
      saveSettings();
    } else {
      discordConfig = await discordApi({ action: 'disconnect' });
    }
    renderDiscordIntegration();
    showToast('Discord disconnected', 'All stored Discord destinations and offline access were removed.');
  } catch (error) {
    showToast('Could not disconnect Discord', error.message || 'Please try again');
  }
}

/* ════════════════════════════════════════════
   CUSTOM CONFIRM DIALOG — centered card
════════════════════════════════════════════ */
function showConfirmDialog(title, message, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    const veil = document.createElement('div');
    veil.className = 'confirm-veil';

    const card = document.createElement('div');
    card.className = 'confirm-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'confirm-title');

    card.innerHTML = `
      <div class="confirm-card-title" id="confirm-title">${title}</div>
      <div class="confirm-card-msg">${message}</div>
      <div class="confirm-card-divider"></div>
      <div class="confirm-card-actions">
        <button class="confirm-btn-cancel">Cancel</button>
        <button class="confirm-btn-ok">${confirmLabel}</button>
      </div>
    `;

    veil.appendChild(card);
    document.body.appendChild(veil);

    const cleanup = () => {
      veil.classList.remove('open');
      setTimeout(() => veil.remove(), 280);
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { cleanup(); resolve(false); }
    };

    veil.addEventListener('click', (e) => {
      if (e.target === veil) { cleanup(); resolve(false); }
    });

    card.querySelector('.confirm-btn-cancel').onclick = () => { cleanup(); resolve(false); };
    card.querySelector('.confirm-btn-ok').onclick    = () => { cleanup(); resolve(true);  };

    document.addEventListener('keydown', onKey);

    // Trigger open animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => veil.classList.add('open'));
    });
  });
}