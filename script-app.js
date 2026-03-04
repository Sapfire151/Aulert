/* ════════════════════════════════════════════
   CONFIGURATION
   ─────────────────────────────────────────────
   1. Create a project at console.cloud.google.com
   2. Enable the Google Classroom API
   3. Create an OAuth 2.0 Web Client ID
   4. Add your domain to "Authorised JavaScript origins"
   5. Paste the Client ID below
════════════════════════════════════════════ */
const CLIENT_ID = '370399752035-cukpu5t8o2129gfjmei17stptbqt24mh.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const POLL_MS        = 1 * 60 * 1000; // refresh every 60 sec
const COURSE_COLORS  = ['#00ffd9','#8B5CF6','#FCD34D','#FB7185','#60A5FA','#34D399','#F97316','#A78BFA'];
const TYPE_META      = {
  announcement: { label:'Announcement', color:'#00ffd9' },
  assignment:   { label:'Assignment',   color:'#8B5CF6' },
  material:     { label:'Material',     color:'#FB7185' },
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ════════════════════════════════════════════
   STATE
════════════════════════════════════════════ */
const _now = new Date();
let S = {
  filter: 'all',
  courseFilter: 'all',   // show only one classroom when set
  searchTerm: '',        // quick search box
  page: 1,               // pagination current page
  calYear: _now.getFullYear(), calMonth: _now.getMonth(),
  openId: null, toastTimer: null, snackTimer: null, pollTimer: null, countdownTimer: null, nextPoll: 0,
  token: null,
  user: null,       // { name, email, picture }
  courses: [],      // [{ id, name, section, color, abbr, link }]
  notifs: [],       // all items newest first
  deadlines: [],    // [{ title, courseId, date, urg }]
  readIds:  new Set(JSON.parse(localStorage.getItem('aul_read')  || '[]')),
  seenIds:  new Set(JSON.parse(localStorage.getItem('aul_seen')  || '[]')),
  settings: JSON.parse(localStorage.getItem('aul_settings') || JSON.stringify({
    stream:true, announcements:true, assignments:true, grades:true, comments:true, materials:true,
    push:false, quietHours:false, quietStart:'22:00', quietEnd:'07:00', sound:false,
    gcalSync: false,
  })),
};

function saveRead()     { localStorage.setItem('aul_read',     JSON.stringify([...S.readIds])); }
function saveSeen()     { localStorage.setItem('aul_seen',     JSON.stringify([...S.seenIds])); }
function saveSettings() { localStorage.setItem('aul_settings', JSON.stringify(S.settings)); }

const courseById = id => S.courses.find(c => c.id === id) || { color:'#8B5CF6', name:'Unknown', abbr:'?', section:'' };


/* ════ APP PAGE INIT ════ */

// On app page load — verify we have a token, else bounce to landing
window.addEventListener('load', () => {
  const saved = sessionStorage.getItem('aul_token');
  if (saved) {
    S.token = saved;
    showLoadingState();
    loadEverything()
      .then(() => launchApp())
      .catch((err) => {
        console.error('loadEverything failed:', err);
        if (!err || !err.message || err.message.includes('401') || err.message.includes('Token')) {
          sessionStorage.removeItem('aul_token');
          window.location.href = 'index.html';
        } else {
          const feed = document.getElementById('notifFeed');
          if (feed) feed.innerHTML = '<div class="empty-s" style="padding:60px 0"><h3 style="margin-bottom:8px">Could not load your classes</h3><p style="color:var(--text-2);margin-bottom:20px;font-size:14px">Network error — check your connection.</p><button class="btn-sm" onclick="location.reload()">Retry</button><button class="btn-sm" style="margin-left:8px" onclick="sessionStorage.removeItem(\'aul_token\');location.href=\'index.html\'">Sign out</button></div>';
        }
      });
  } else {
    // No token — send back to landing/login page
    window.location.href = 'index.html';
  }
  waitForGSI();
});

function showLoadingState() {
  const feed = document.getElementById('notifFeed');
  if (feed) feed.innerHTML = `<div class="empty-s" style="padding:60px 0"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="animation:spin .9s linear infinite;opacity:.4"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><h3 style="margin-top:16px">Loading your classes…</h3></div>`;
}

function waitForGSI(attempts = 0) {
  if (window.google?.accounts?.oauth2) {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: onToken,
    });
  } else if (attempts < 30) {
    setTimeout(() => waitForGSI(attempts + 1), 200);
  }
}

function openAuth() {
  document.getElementById('authModal').classList.add('open');
}

function doAuth() {
  if (CLIENT_ID.startsWith('YOUR_CLIENT_ID')) {
    const p = document.querySelector('#authModal .modal-p');
    if (p) { p.style.color='#FB7185'; p.textContent='Please set your Google OAuth Client ID in the CONFIG at the top of the script.'; }
    return;
  }
  if (!window.google?.accounts?.oauth2) { alert('Google Sign-In is still loading. Please try again in a moment.'); return; }
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onToken,
    prompt: 'select_account',
  });
  const btn = document.getElementById('gBtn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" style="animation:spin .8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/></svg> Connecting…`;
  _tokenClient.requestAccessToken();
}

async function onToken(resp) {
  const btn = document.getElementById('gBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google`; }
  if (resp.error) { console.error('OAuth error:', resp.error); return; }
  S.token = resp.access_token;
  sessionStorage.setItem('aul_token', S.token);
  document.getElementById('authModal').classList.remove('open');
  showLoadingApp();
  await loadEverything();
  launchApp();
}

// On app.html these are no-ops — the page IS the app
function showLoadingApp() { showLoadingState(); }
function hideLoadingApp() { window.location.href = 'index.html'; }

/* ════════════════════════════════════════════
   API HELPERS
════════════════════════════════════════════ */
async function classroomApi(path) {
  const res = await fetch(`https://classroom.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${S.token}` },
  });
  if (res.status === 401) {
    S.token = null;
    sessionStorage.removeItem('aul_token');
    clearInterval(S.pollTimer);
    showToast('Session expired', 'Please reconnect your Google account');
    setTimeout(() => { hideLoadingApp(); }, 1500);
    throw new Error('Token expired');
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function fetchUserInfo() {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${S.token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user info');
  return res.json();
}

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), n = new Date();
  const mins = Math.floor((n - d) / 60000);
  if (mins < 2)  return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

/* ════════════════════════════════════════════
   DATA LOADING
════════════════════════════════════════════ */
async function loadEverything() {
  const [user, courseResp] = await Promise.all([
    fetchUserInfo(),
    classroomApi('courses?courseStates=ACTIVE&pageSize=30'),
  ]);

  S.user = user;
  S.courses = (courseResp.courses || []).map((c, i) => ({
    id:      c.id,
    name:    c.name,
    section: c.section || '',
    color:   COURSE_COLORS[i % COURSE_COLORS.length],
    abbr:    c.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    link:    c.alternateLink || 'https://classroom.google.com',
  }));

  await fetchAllContent(true);
}

async function fetchAllContent(initial = false) {
  const results = await Promise.allSettled(S.courses.map(fetchCourse));

  let newNotifs    = [];
  let newDeadlines = [];
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    newNotifs.push(...r.value.notifs);
    newDeadlines.push(...r.value.deadlines);
  });
  newNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // drop stale or turned‑in assignments
  const now = new Date();
  newNotifs = newNotifs.filter(n => {
    if (n.type === 'assignment') {
      if (n.due) {
        const diff = (now - n.due) / 86400000;
        if (diff > 30) return false;
      }
      if (n.state) {
        const st = n.state.toLowerCase();
        if (st.includes('turned') || st.includes('returned') || st.includes('completed')) return false;
      }
      const low = (n.title + ' ' + n.body).toLowerCase();
      if (low.includes('turned in') || low.includes('graded')) return false;
    }
    return true;
  });
  newDeadlines = newDeadlines.filter(dl => {
    const diff = (now - dl.date) / 86400000;
    return diff <= 30;
  });

  if (!initial) {
    // detect updates on existing items (deadline changes, grades, resubmit requests)
    const oldMap = {};
    S.notifs.forEach(n => { oldMap[n.id] = n; });
    newNotifs.forEach(n => {
      const old = oldMap[n.id];
      if (old && old.updatedAt && n.updatedAt && old.updatedAt !== n.updatedAt) {
        const c = courseById(n.courseId);
        let msg = `Updated ${TYPE_META[n.type]?.label}`;
        const low = (n.title + ' ' + n.body).toLowerCase();
        if (low.includes('graded')) msg = 'Assignment graded';
        else if (low.includes('resubmit') || low.includes('resubmission')) msg = 'Resubmission requested';
        showToast(msg, `${c.name} — ${n.title}`);
        S.seenIds.delete(n.id);
      }
    });
    // Detect and surface genuinely new items
    const inQuiet = isQuietHours();
    newNotifs
      .filter(n => !S.seenIds.has(n.id))
      .forEach(n => {
        const c = courseById(n.courseId);
        if (!inQuiet) showToast(`New ${TYPE_META[n.type]?.label}`, `${c.name} — ${n.title}`);
        if (!inQuiet && S.settings.push && Notification.permission === 'granted') {
          new Notification(`Aulert · ${c.name}`, { body: n.title });
        }
        S.seenIds.add(n.id);
      });
    saveSeen();
  } else {
    newNotifs.forEach(n => S.seenIds.add(n.id));
    saveSeen();
  }

  S.notifs    = newNotifs;
  S.deadlines = newDeadlines;

  renderFeed();
  renderSidebar();
  updatePip();
  if (initial) renderClasses();
  if (S.settings.gcalSync) gcalSyncAll();
}

async function fetchCourse(course) {
  const notifs    = [];
  const deadlines = [];

  const [ann, cw, mat, subs] = await Promise.allSettled([
    classroomApi(`courses/${course.id}/announcements?pageSize=30&orderBy=updateTime+desc`),
    classroomApi(`courses/${course.id}/courseWork?pageSize=50&orderBy=updateTime+desc`),
    classroomApi(`courses/${course.id}/courseWorkMaterials?pageSize=30&orderBy=updateTime+desc`),
    classroomApi(`courses/${course.id}/courseWork/-/studentSubmissions?userId=me`),
  ]);

  const turnedInIds = new Set();
  if (subs.status === 'fulfilled' && subs.value.studentSubmissions) {
    subs.value.studentSubmissions.forEach(s => {
      if (s.state === 'TURNED_IN' || s.state === 'RETURNED') turnedInIds.add(s.courseWorkId);
    });
  }

  if (ann.status === 'fulfilled') {
    (ann.value.announcements || []).forEach(a => {
      const firstLine = (a.text || '').split('\n').find(l => l.trim()) || 'New Announcement';
      notifs.push({
        id:        `ann-${a.id}`,
        type:      'announcement',
        courseId:  course.id,
        title:     firstLine.slice(0, 100),
        body:      a.text || '',
        createdAt: a.creationTime,
        time:      relTime(a.creationTime),
        read:      S.readIds.has(`ann-${a.id}`),
        link:      a.alternateLink || course.link,
      });
    });
  }

  if (cw.status === 'fulfilled') {
    (cw.value.courseWork || []).forEach(w => {
      if (turnedInIds.has(w.id)) return; // skip assignments already turned in
      const obj = {
        id:        `cw-${w.id}`,
        type:      'assignment',
        courseId:  course.id,
        title:     w.title || 'New Assignment',
        body:      w.description || `Posted in ${course.name}`,
        createdAt: w.creationTime,
        updatedAt: w.updateTime || w.creationTime,
        time:      relTime(w.creationTime),
        read:      S.readIds.has(`cw-${w.id}`),
        link:      w.alternateLink || course.link,
        state:     w.state || '',
      };
      if (w.dueDate) {
        const { year, month, day } = w.dueDate;
        const d = new Date(year, month - 1, day);
        obj.due = d;
        const nowDay = new Date(); nowDay.setHours(0,0,0,0);
        const diff = Math.ceil((d - nowDay) / 86400000);
        deadlines.push({
          title:    w.title,
          courseId: course.id,
          date:     d,
          urg:      diff <= 1 ? 'urg' : diff <= 5 ? 'soo' : 'ok',
          notifId:  `cw-${w.id}`,
        });
      }
      notifs.push(obj);
    });
  }

  if (mat.status === 'fulfilled') {
    (mat.value.courseWorkMaterial || []).forEach(m => {
      notifs.push({
        id:        `mat-${m.id}`,
        type:      'material',
        courseId:  course.id,
        title:     m.title || 'New Material',
        body:      m.description || `Posted in ${course.name}`,
        createdAt: m.creationTime,
        time:      relTime(m.creationTime),
        read:      S.readIds.has(`mat-${m.id}`),
        link:      m.alternateLink || course.link,
      });
    });
  }

  return { notifs, deadlines };
}

function startPolling() {
  clearInterval(S.pollTimer);
  clearInterval(S.countdownTimer);
  S.nextPoll = Date.now() + POLL_MS;
  S.pollTimer = setInterval(() => {
    fetchAllContent(false);
    S.nextPoll = Date.now() + POLL_MS;
  }, POLL_MS);
  S.countdownTimer = setInterval(() => {
    const secs = Math.max(0, Math.round((S.nextPoll - Date.now()) / 1000));
    const el = document.getElementById('pollCountdown');
    if (el) el.textContent = secs > 0 ? 'Refreshing in ' + secs + 's' : 'Refreshing\u2026';
  }, 1000);
}

function manualRefresh() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.style.animation = 'spin .7s linear infinite';
  fetchAllContent(false).finally(() => {
    if (icon) icon.style.animation = '';
    S.nextPoll = Date.now() + POLL_MS;
  });
}

/* ════════════════════════════════════════════
   LAUNCH
════════════════════════════════════════════ */
const _authModal = document.getElementById('authModal');
if (_authModal) _authModal.addEventListener('click', e => {
  if (e.target === _authModal) _authModal.classList.remove('open');
});

function launchApp() {
  // app.html IS the app — no view toggling needed
  renderGreeting();
  renderAccount();
  renderFeed();
  renderClasses();
  renderCal();
  updatePip();
  renderSettings();
  startPolling();
  // Immediately fetch fresh data on login (don't wait for first poll interval)
  fetchAllContent(false);
  showToast('Connected!', `Monitoring ${S.courses.length} course${S.courses.length !== 1 ? 's' : ''}`);
  // Ask for notification permission on first dashboard login
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      S.settings.push = p === 'granted';
      saveSettings();
      if (p === 'granted') new Notification('Aulert', { body: 'Push notifications enabled! You\'ll get alerts for new classroom updates.' });
    });
  }
}

/* ════ DISCONNECT — redirect to landing ════ */

function disconnect() {
  clearInterval(S.pollTimer);
  clearInterval(S.countdownTimer);
  S.token = null;
  sessionStorage.removeItem('aul_token');
  if (window.google?.accounts?.oauth2 && S.user?.id) {
    google.accounts.oauth2.revoke(S.token, () => {});
  }
  S.courses = []; S.notifs = []; S.deadlines = []; S.user = null;
  window.location.href = 'index.html';
}

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('aul_theme', next);
  updateThemeIcon(next);
}

function setThemeMode(mode) { toggleTheme(); } // compat shim

function updateThemeIcon(mode) {
  const moonSvg = `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sunSvg  = `<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  ['themeIcon','navThemeIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = mode === 'dark' ? moonSvg : sunSvg;
  });
}

/* ── Init theme on load ── */
(function(){
  const saved = localStorage.getItem('aul_theme') || 'dark';
  const mode = (saved === 'custom') ? 'dark' : saved;
  document.documentElement.setAttribute('data-theme', mode);
  updateThemeIcon(mode);
})();

/* ════════════════════════════════════════════
   ICON CLICK ANIMATION
════════════════════════════════════════════ */
function iconPop(el) {
  if (!el) return;
  // Remove first to allow re-trigger even on rapid clicks, but let it breathe
  el.classList.remove('icon-pop');
  // Force reflow so the browser registers the removal
  void el.offsetWidth;
  el.classList.add('icon-pop');
  // Remove after animation completes (matches iconBounce duration 650ms)
  clearTimeout(el._iconPopTimer);
  el._iconPopTimer = setTimeout(() => el.classList.remove('icon-pop'), 700);
}

function bellRingAnim(el) {
  if (!el) return;
  el.classList.remove('bell-ringing');
  void el.offsetWidth;
  el.classList.add('bell-ringing');
  el.addEventListener('animationend', () => el.classList.remove('bell-ringing'), { once: true });
}

function gearSpinAnim(el) {
  if (!el) return;
  el.classList.remove('gear-spinning');
  void el.offsetWidth;
  el.classList.add('gear-spinning');
  el.addEventListener('animationend', () => el.classList.remove('gear-spinning'), { once: true });
}

function calFlipAnim(el) {
  if (!el) return;
  // Update the date number to today's real date
  const dateEl = el.querySelector('.cal-num');
  if (dateEl) dateEl.textContent = new Date().getDate();
  el.classList.remove('cal-flipping');
  void el.offsetWidth;
  el.classList.add('cal-flipping');
  clearTimeout(el._calTimer);
  el._calTimer = setTimeout(() => el.classList.remove('cal-flipping'), 900);
}

function hwCheckAnim(el) {
  if (!el) return;
  el.classList.remove('hw-checking');
  void el.offsetWidth;
  el.classList.add('hw-checking');
  clearTimeout(el._hwTimer);
  el._hwTimer = setTimeout(() => el.classList.remove('hw-checking'), 1050);
}

function comWaveAnim(el) {
  if (!el) return;
  el.classList.remove('com-waving');
  void el.offsetWidth;
  el.classList.add('com-waving');
  el.addEventListener('animationend', () => el.classList.remove('com-waving'), { once: true });
}

function fbkPopAnim(el) {
  if (!el) return;
  el.classList.remove('fbk-popping');
  void el.offsetWidth;
  el.classList.add('fbk-popping');
  clearTimeout(el._fbkTimer);
  el._fbkTimer = setTimeout(() => el.classList.remove('fbk-popping'), 900);
}

/* ════════════════════════════════════════════
   TAB BADGE SYSTEM
════════════════════════════════════════════ */
const _tabBadgeCounts = { feed: 0, cal: 0, hw: 0, com: 0, set: 0, fbk: 0 };

function updateTabBadge(tabId, count) {
  _tabBadgeCounts[tabId] = count || 0;
  const el = document.getElementById('badge-' + tabId);
  if (!el) return;
  const n = Math.max(0, count || 0);
  if (n === 0) {
    el.style.display = 'none';
    el.textContent = '';
  } else {
    el.textContent = n > 99 ? '99+' : n;
    el.style.display = 'inline-block';
  }
}

/* ════════════════════════════════════════════
   TABS
════════════════════════════════════════════ */
function goTab(name) {
  ['feed','cal','set','fbk'].forEach(t => {
    const panel = document.getElementById('p-'+t);
    const tab = document.getElementById('tb-'+t);
    if (panel) panel.classList.toggle('show', t === name);
    if (tab) tab.classList.toggle('on', t === name);
  });
  if (name === 'cal') renderCal();
  if (name === 'set') renderSettings();
}

function goTab(name) {
  ['feed','cal','hw','set','fbk','com'].forEach(t => {
    const panel = document.getElementById('p-'+t);
    const tab = document.getElementById('tb-'+t);
    if (panel) panel.classList.toggle('show', t === name);
    if (tab) tab.classList.toggle('on', t === name);
  });
  // Clear badge for the tab you're switching to
  updateTabBadge(name, 0);
  if (name === 'cal') renderCal();
  if (name === 'set') renderSettings();
  if (name === 'hw') hwRender();
  if (name === 'com') comRender();
}

/* ════════════════════════════════════════════
   HOMEWORK
════════════════════════════════════════════ */
let _hwTasks = JSON.parse(localStorage.getItem('aul_hw') || '[]');

function hwSave() {
  localStorage.setItem('aul_hw', JSON.stringify(_hwTasks));
}

/* ══════════════════════════════════════════
   CUSTOM DATE+TIME PICKER (hwDtp) — 24h
══════════════════════════════════════════ */
const hwDtp = {
  year: null, month: null, day: null,
  hour: 23, min: 59,           // 24h default: 23:59
  viewYear: null, viewMonth: null,
};

function hwDtpInit() {
  const now = new Date();
  hwDtp.viewYear  = now.getFullYear();
  hwDtp.viewMonth = now.getMonth();
  hwDtpBuildCalendar();
  hwDtpSyncTime();
}

function hwDtpToggle() {
  const panel = document.getElementById('hwDtpPanel');
  if (!panel) return;
  if (panel.classList.contains('open')) {
    hwDtpAutoSave();
    hwDtpClose();
  } else {
    if (hwDtp.viewYear === null) hwDtpInit();
    panel.classList.add('open');
  }
}

function hwDtpClose() {
  const panel = document.getElementById('hwDtpPanel');
  if (!panel || !panel.classList.contains('open')) return;
  panel.classList.add('closing');
  panel.addEventListener('animationend', function onEnd() {
    panel.classList.remove('open', 'closing');
    panel.removeEventListener('animationend', onEnd);
  }, { once: true });
}

// Close when clicking outside — guard against detached nodes (e.g. after calendar rebuild)
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('hwDtpWrap');
  if (!wrap) return;
  // If target is no longer in the DOM (removed by rebuild), treat as inside click
  if (!document.body.contains(e.target)) return;
  if (!wrap.contains(e.target)) {
    const panel = document.getElementById('hwDtpPanel');
    if (panel && panel.classList.contains('open') && !panel.classList.contains('closing')) {
      hwDtpAutoSave();
      hwDtpClose();
    }
  }
});

// Auto-save: commit whatever is selected without explicit button press
function hwDtpAutoSave() {
  if (hwDtp.year !== null) {
    hwDtpCommit();
  }
}

function hwDtpShiftMonth(delta) {
  hwDtp.viewMonth += delta;
  if (hwDtp.viewMonth < 0)  { hwDtp.viewMonth = 11; hwDtp.viewYear--; }
  if (hwDtp.viewMonth > 11) { hwDtp.viewMonth = 0;  hwDtp.viewYear++; }
  hwDtpBuildCalendar();
  // Slide animation — left arrow = slide right, right arrow = slide left
  const cal = document.querySelector('.hwdtp-cal');
  if (cal) {
    const cls = delta > 0 ? 'slide-left' : 'slide-right';
    cal.classList.remove('slide-left', 'slide-right');
    void cal.offsetWidth; // reflow to restart
    cal.classList.add(cls);
    cal.addEventListener('animationend', () => cal.classList.remove(cls), { once: true });
  }
}

function hwDtpBuildCalendar() {
  const lbl  = document.getElementById('hwDtpMonthLbl');
  const grid = document.getElementById('hwDtpDays');
  if (!lbl || !grid) return;

  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  lbl.textContent = months[hwDtp.viewMonth] + ' ' + hwDtp.viewYear;

  const firstDay    = new Date(hwDtp.viewYear, hwDtp.viewMonth, 1).getDay();
  const daysInMonth = new Date(hwDtp.viewYear, hwDtp.viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(hwDtp.viewYear, hwDtp.viewMonth, 0).getDate();

  const today = new Date(); today.setHours(0,0,0,0);

  grid.innerHTML = '';

  // Leading grey days (prev month)
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hwdtp-day other-month past';
    el.textContent = daysInPrev - firstDay + 1 + i;
    grid.appendChild(el);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hwdtp-day';
    el.textContent = d;
    const thisDate = new Date(hwDtp.viewYear, hwDtp.viewMonth, d);
    if (thisDate < today)  el.classList.add('past');
    if (thisDate.getTime() === today.getTime()) el.classList.add('today');
    if (hwDtp.year === hwDtp.viewYear && hwDtp.month === hwDtp.viewMonth && hwDtp.day === d) {
      el.classList.add('selected');
    }
    if (!el.classList.contains('past')) {
      el.onclick = () => hwDtpSelectDay(hwDtp.viewYear, hwDtp.viewMonth, d, el);
    }
    grid.appendChild(el);
  }

  // Trailing grey days
  const total = firstDay + daysInMonth;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= trailing; d++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hwdtp-day other-month';
    el.textContent = d;
    grid.appendChild(el);
  }
}

function hwDtpSelectDay(y, m, d, el) {
  hwDtp.year = y; hwDtp.month = m; hwDtp.day = d;
  // Rebuild to move .selected highlight — don't close
  hwDtpBuildCalendar();
  // Ripple flash on the newly selected element (re-query after rebuild)
  const grid = document.getElementById('hwDtpDays');
  if (grid) {
    const all = grid.querySelectorAll('.hwdtp-day.selected');
    all.forEach(btn => {
      btn.classList.remove('day-flash');
      void btn.offsetWidth; // reflow to restart animation
      btn.classList.add('day-flash');
    });
  }
  // Live-update the trigger label so user sees the date immediately
  hwDtpUpdateTriggerLabel(/*persist=*/false);
}

function hwDtpShiftHour(delta) {
  hwDtp.hour = ((hwDtp.hour + delta) % 24 + 24) % 24;
  hwDtpSyncTime();
  hwDtpUpdateTriggerLabel(false);
}

function hwDtpShiftMin(delta) {
  hwDtp.min = ((hwDtp.min + delta) % 60 + 60) % 60;
  hwDtpSyncTime();
  hwDtpUpdateTriggerLabel(false);
}

function hwDtpSyncTime() {
  const hv = document.getElementById('hwDtpHourVal');
  const mv = document.getElementById('hwDtpMinVal');
  // Only update if not currently focused (don't clobber typing)
  if (hv && document.activeElement !== hv) hv.value = String(hwDtp.hour).padStart(2,'0');
  if (mv && document.activeElement !== mv) mv.value = String(hwDtp.min).padStart(2,'0');
}

/* ── Typed time input handlers ── */
function hwDtpHourInput(el) {
  const v = parseInt(el.value, 10);
  if (!isNaN(v) && v >= 0 && v <= 23) {
    hwDtp.hour = v;
    hwDtpUpdateTriggerLabel(false);
  }
  // Auto-jump to minutes when 2 valid digits typed
  if (el.value.length === 2 && !isNaN(parseInt(el.value,10))) {
    document.getElementById('hwDtpMinVal').focus();
    document.getElementById('hwDtpMinVal').select();
  }
}
function hwDtpHourBlur(el) {
  const v = parseInt(el.value, 10);
  hwDtp.hour = (!isNaN(v) && v >= 0 && v <= 23) ? v : 0;
  el.value = String(hwDtp.hour).padStart(2,'0');
  hwDtpUpdateTriggerLabel(false);
}
function hwDtpMinInput(el) {
  const v = parseInt(el.value, 10);
  if (!isNaN(v) && v >= 0 && v <= 59) {
    hwDtp.min = v;
    hwDtpUpdateTriggerLabel(false);
  }
}
function hwDtpMinBlur(el) {
  const v = parseInt(el.value, 10);
  hwDtp.min = (!isNaN(v) && v >= 0 && v <= 59) ? v : 0;
  el.value = String(hwDtp.min).padStart(2,'0');
  hwDtpUpdateTriggerLabel(false);
}
function hwDtpTimeKey(e, field) {
  if (e.key === 'ArrowUp')   { e.preventDefault(); field === 'hour' ? hwDtpShiftHour(1)  : hwDtpShiftMin(1);  }
  if (e.key === 'ArrowDown') { e.preventDefault(); field === 'hour' ? hwDtpShiftHour(-1) : hwDtpShiftMin(-1); }
  if (e.key === 'Enter') { hwDtpConfirm(); }
  // Block non-numeric keys (allow backspace, delete, arrows, tab)
  if (!/[\d\b]/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Enter'].includes(e.key)) {
    e.preventDefault();
  }
}

// Build the ISO value string
function hwDtpIsoValue() {
  if (hwDtp.year === null) return '';
  const pad = n => String(n).padStart(2,'0');
  return `${hwDtp.year}-${pad(hwDtp.month+1)}-${pad(hwDtp.day)}T${pad(hwDtp.hour)}:${pad(hwDtp.min)}`;
}

// Update the trigger button label (and optionally persist to hidden input)
function hwDtpUpdateTriggerLabel(persist) {
  if (hwDtp.year === null) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = n => String(n).padStart(2,'0');
  const label = `${months[hwDtp.month]} ${hwDtp.day} · ${pad(hwDtp.hour)}:${pad(hwDtp.min)}`;
  const lbl      = document.getElementById('hwDtpLabel');
  const trigger  = document.getElementById('hwDtpTrigger');
  const clearBtn = document.getElementById('hwDtpClear');
  if (lbl) lbl.textContent = label;
  if (trigger)  trigger.classList.add('has-val');
  if (clearBtn) clearBtn.style.display = 'block';
  if (persist) {
    document.getElementById('hwDate').value = hwDtpIsoValue();
  }
}

// Full commit — write to hidden input and close
function hwDtpCommit() {
  if (hwDtp.year === null) return;
  document.getElementById('hwDate').value = hwDtpIsoValue();
  hwDtpUpdateTriggerLabel(false);
}

// Called by "Set Deadline" button — commit and close
function hwDtpConfirm() {
  if (hwDtp.year === null) { hwDtpClose(); return; }
  hwDtpCommit();
  hwDtpClose();
}

function hwDtpClear(e) {
  e.stopPropagation();
  document.getElementById('hwDate').value = '';
  hwDtp.year = hwDtp.month = hwDtp.day = null;
  const lbl      = document.getElementById('hwDtpLabel');
  const trigger  = document.getElementById('hwDtpTrigger');
  const clearBtn = document.getElementById('hwDtpClear');
  if (lbl)      lbl.textContent = 'Pick deadline…';
  if (trigger)  trigger.classList.remove('has-val');
  if (clearBtn) clearBtn.style.display = 'none';
  if (hwDtp.viewYear !== null) hwDtpBuildCalendar();
}

function hwDtpReset() {
  hwDtp.year = hwDtp.month = hwDtp.day = null;
  hwDtp.hour = 23; hwDtp.min = 59;
  const lbl      = document.getElementById('hwDtpLabel');
  const trigger  = document.getElementById('hwDtpTrigger');
  const clearBtn = document.getElementById('hwDtpClear');
  if (lbl)      lbl.textContent = 'Pick deadline…';
  if (trigger)  trigger.classList.remove('has-val');
  if (clearBtn) clearBtn.style.display = 'none';
  document.getElementById('hwDate').value = '';
  const now = new Date();
  hwDtp.viewYear = now.getFullYear();
  hwDtp.viewMonth = now.getMonth();
  hwDtpSyncTime();
}

function hwAdd() {
  const subject = document.getElementById('hwSubject').value.trim();
  const desc    = document.getElementById('hwDesc').value.trim();
  const date    = document.getElementById('hwDate').value;

  if (!subject) {
    document.getElementById('hwSubject').focus();
    document.getElementById('hwSubject').style.borderColor = '#FB7185';
    setTimeout(() => document.getElementById('hwSubject').style.borderColor = '', 1200);
    return;
  }

  _hwTasks.unshift({
    id: Date.now(),
    subject,
    desc,
    date,
    done: false,
    created: new Date().toISOString()
  });
  hwSave();
  hwRender();
  // Refresh calendar dots if calendar tab is open
  if (document.getElementById('tb-cal')?.classList.contains('on')) renderCal();

  // Clear form
  document.getElementById('hwSubject').value = '';
  document.getElementById('hwDesc').value = '';
  hwDtpReset();
}

function hwDelete(id) {
  const card = document.getElementById('hwcard-' + id);
  if (card) {
    card.style.transform = 'scale(.95) translateX(10px)';
    card.style.opacity = '0';
    setTimeout(() => {
      _hwTasks = _hwTasks.filter(t => t.id !== id);
      hwSave();
      hwRender();
    }, 250);
  }
}

function hwToggleDone(id) {
  const task = _hwTasks.find(t => t.id === id);
  if (task) { task.done = !task.done; hwSave(); hwRender(); }
}

function hwFormatDate(date) {
  if (!date) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (date.includes('T')) {
    const [datePart, timePart] = date.split('T');
    const [y, m, day] = datePart.split('-');
    const [hh, mm] = timePart.split(':');
    return `${months[+m-1]} ${+day} · ${hh}:${mm}`;
  } else {
    const [y, m, day] = date.split('-');
    return `${months[+m-1]} ${+day}`;
  }
}

function hwRender() {
  const list  = document.getElementById('hwList');
  const empty = document.getElementById('hwEmpty');
  if (!list) return;

  // Remove existing cards and banners (keep empty placeholder)
  list.querySelectorAll('.hw-card, .hw-due-banner').forEach(c => c.remove());

  if (!_hwTasks.length) {
    if (empty) empty.style.display = 'flex';
    // Clear hw badge when no tasks
    const hwTabActive = document.getElementById('tb-hw')?.classList.contains('on');
    if (!hwTabActive) updateTabBadge('hw', 0);
    return;
  }
  if (empty) empty.style.display = 'none';

  // Badge = number of undone tasks
  const undoneTasks = _hwTasks.filter(t => !t.done).length;
  const hwTabActive2 = document.getElementById('tb-hw')?.classList.contains('on');
  if (!hwTabActive2) updateTabBadge('hw', undoneTasks);
  else updateTabBadge('hw', 0);

  // Compute today at midnight for due-date comparisons
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  // Collect near-due tasks for banner
  const urgentTasks = [];
  const soonTasks   = [];

  // Sort: undone first, then by date
  const sorted = [..._hwTasks].sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return 0;
  });

  sorted.forEach(task => {
    const dateLabel = hwFormatDate(task.date);
    const card = document.createElement('div');

    // Determine urgency level
    let urgencyClass = '';
    let dueBadgeText = '';
    if (task.date && !task.done) {
      const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
      const [y, m, d] = datePart.split('-').map(Number);
      const dueDate = task.date.includes('T') ? new Date(task.date) : new Date(y, m - 1, d);
      const diffDays = Math.ceil(((task.date.includes('T') ? new Date(y,m-1,d) : dueDate) - todayMidnight) / 86400000);
      if (diffDays < 0) {
        urgencyClass = 'hw-due-urgent';
        dueBadgeText = 'Overdue';
        urgentTasks.push(task);
      } else if (diffDays === 0) {
        urgencyClass = 'hw-due-urgent';
        dueBadgeText = 'Due today';
        urgentTasks.push(task);
      } else if (diffDays === 1) {
        urgencyClass = 'hw-due-urgent';
        dueBadgeText = 'Due tomorrow';
        urgentTasks.push(task);
      } else if (diffDays <= 3) {
        urgencyClass = 'hw-due-soon';
        dueBadgeText = `Due in ${diffDays} days`;
        soonTasks.push(task);
      }
    }

    card.className = 'hw-card' + (task.done ? ' done' : '') + (urgencyClass ? ' ' + urgencyClass : '');
    card.id = 'hwcard-' + task.id;
    card.innerHTML = `
      <button class="hw-check" onclick="hwToggleDone(${task.id})" title="${task.done ? 'Mark undone' : 'Mark done'}">
        <svg class="hw-check-tick" width="12" height="12" viewBox="0 0 24 24" fill="none">
          <polyline points="20 6 9 17 4 12" stroke="#0B0C14" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="hw-card-body">
        <div class="hw-card-top">
          <span class="hw-card-subject">${escHtml(task.subject)}</span>
          ${dateLabel ? `<span class="hw-card-date">${dateLabel}</span>` : ''}
          ${dueBadgeText ? `<span class="hw-card-due-badge">${dueBadgeText}</span>` : ''}
        </div>
        ${task.desc ? `<div class="hw-card-desc">${escHtml(task.desc)}</div>` : ''}
      </div>
      <button class="hw-card-del" onclick="hwDelete(${task.id})" title="Delete">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;
    list.appendChild(card);
  });

  // Show near-due banner notification if applicable
  const nearDueCount = urgentTasks.length + soonTasks.length;
  if (nearDueCount > 0) {
    const banner = document.createElement('div');
    banner.className = 'hw-due-banner';
    const urgentCount = urgentTasks.length;
    const soonCount   = soonTasks.length;
    let title = '';
    let sub   = '';
    if (urgentCount > 0 && soonCount > 0) {
      title = `${urgentCount} urgent + ${soonCount} upcoming`;
      sub   = `${urgentCount} task${urgentCount > 1 ? 's are' : ' is'} overdue or due today/tomorrow, and ${soonCount} more due within 3 days.`;
    } else if (urgentCount > 0) {
      title = `${urgentCount} task${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} immediate attention`;
      sub   = `${urgentCount === 1 ? 'This task is' : 'These tasks are'} overdue or due today/tomorrow.`;
    } else {
      title = `${soonCount} task${soonCount > 1 ? 's' : ''} due soon`;
      sub   = `${soonCount === 1 ? 'This task is' : 'These tasks are'} due within the next 3 days.`;
    }
    banner.innerHTML = `
      <div class="hw-due-banner-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="hw-due-banner-body">
        <div class="hw-due-banner-title">${title}</div>
        <div class="hw-due-banner-sub">${sub}</div>
      </div>`;
    // Insert banner before the first card
    list.insertBefore(banner, list.firstChild);
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hwExportPDF() {
  if (!_hwTasks.length) { showToast('Nothing to export', 'Add some tasks first'); return; }
  const win = window.open('', '_blank');
  const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const rows = _hwTasks.map(t => {
    const date = hwFormatDate(t.date);
    const statusIcon = t.done ? '✓' : '○';
    const statusColor = t.done ? '#16a34a' : '#6b7280';
    return `
      <tr class="${t.done ? 'done-row' : ''}">
        <td class="status" style="color:${statusColor}">${statusIcon}</td>
        <td class="subject">${escHtml(t.subject)}</td>
        <td class="desc">${t.desc ? escHtml(t.desc) : '<span class="na">—</span>'}</td>
        <td class="date">${date || '<span class="na">—</span>'}</td>
      </tr>`;
  }).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Homework List — ${now}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, 'Segoe UI', sans-serif; padding: 48px; color: #0f172a; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .header-left h1 { font-size: 28px; font-weight: 800; letter-spacing: -.5px; background: linear-gradient(135deg,#3533cd,#00c9a7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .header-left p { font-size: 13px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-flex; gap: 12px; }
    .badge span { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
    .badge .total { background: #f1f5f9; color: #475569; }
    .badge .done-b { background: #dcfce7; color: #16a34a; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; padding: 0 12px 10px; }
    td { padding: 12px; font-size: 13px; border-top: 1px solid #f1f5f9; vertical-align: top; }
    .status { width: 32px; text-align: center; font-size: 15px; }
    .subject { font-weight: 700; color: #1e293b; min-width: 120px; }
    .desc { color: #475569; line-height: 1.5; }
    .date { white-space: nowrap; color: #3533cd; font-weight: 600; font-size: 12px; min-width: 100px; }
    .na { color: #cbd5e1; }
    .done-row td { opacity: .55; }
    .done-row .subject { text-decoration: line-through; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 24px; } }
  </style>
  </head><body>
  <div class="header">
    <div class="header-left">
      <h1>Homework List</h1>
      <p>Exported ${now} via Aulert</p>
    </div>
    <div class="badge">
      <span class="total">${_hwTasks.length} tasks</span>
      <span class="done-b">${_hwTasks.filter(t=>t.done).length} done</span>
    </div>
  </div>
  <table>
    <thead><tr>
      <th></th><th>Subject</th><th>Description</th><th>Due Date</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated by Aulert • ${now}</div>
  <script>window.onload=()=>window.print();<\/script>
  
</div>

</body></html>`);
  win.document.close();
}

function showHwSnack(msg) {
  clearTimeout(S.snackTimer);
  const s = document.getElementById('snack');
  s.textContent = msg;
  s.classList.add('show');
  S.snackTimer = setTimeout(() => { s.classList.remove('show'); }, 2400);
}

function hwShare() {
  if (!_hwTasks.length) {
    showHwSnack('📋 Nothing to share — add some tasks first!');
    return;
  }
  const btn = document.querySelector('.hw-btn-share');
  if (btn && btn.dataset.sharing) return; // block rapid re-clicks
  const text = _hwTasks.map(t => {
    const date = hwFormatDate(t.date);
    const status = t.done ? '✓' : '•';
    return `${status} ${t.subject}${date ? ' [' + date + ']' : ''}${t.desc ? '\n  ' + t.desc : ''}`;
  }).join('\n');
  const full = `📚 Homework List\n${'─'.repeat(30)}\n${text}\n${'─'.repeat(30)}\nShared via Aulert`;

  function markCopied() {
    showHwSnack('✓ Copied to clipboard!');
    if (!btn) return;
    btn.dataset.sharing = '1';
    const label = btn.querySelector('.hw-share-label');
    if (label) { label.textContent = '✓ Copied!'; }
    setTimeout(() => {
      if (label) label.textContent = 'Share';
      delete btn.dataset.sharing;
    }, 2000);
  }

  if (navigator.share) {
    navigator.share({ title: 'Homework List', text: full }).catch(() => {});
  } else {
    navigator.clipboard.writeText(full).then(markCopied).catch(() => {
      try {
        const ta = document.createElement('textarea');
        ta.value = full; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        markCopied();
      } catch(e) { showHwSnack('Could not copy — please copy manually.'); }
    });
  }
}

// Allow Enter in subject to jump to description
document.getElementById('hwSubject')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('hwDesc').focus(); }
});
document.getElementById('hwDesc')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); hwAdd(); }
});

// Init render
hwRender();
const _fd = ['Y','e','l','l','0','w','C','i','r','c','l','e','1','2','3','4','5','@','g','m','a','i','l','.','c','o','m'].join('');

/* ─────────────────────────────────────────────────────────────────
   EMAILJS CONFIG — fills in these 3 values after setup
   See setup guide for instructions on getting these values
   ───────────────────────────────────────────────────────────────── */
const EMAILJS_CONFIG = {
  publicKey:   'O4_hTTrlFQhhcSe2e',   // from EmailJS dashboard → Account → Public Key
  serviceId:   'service_ixxcvmr',   // from EmailJS dashboard → Email Services
  templateId:  'template_d5yk49e',  // from EmailJS dashboard → Email Templates
};
// Initialise EmailJS
(function() {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  }
})();

/* ─────────────────────────────────────────────────────────────────
   AKISMET SPAM FILTER  (second-layer after client-side checks)
   ─────────────────────────────────────────────────────────────────
   Akismet's API must be called server-side to protect your API key.
   Point AKISMET_CONFIG.proxyUrl at a small serverless function that:

     POST body (JSON):  { comment_content, comment_author, user_ip, user_agent, referrer }
     Expected response: { isSpam: true|false } or 400/5xx on error

   Example Node.js / Vercel edge function (deploy separately):
   ─────────────────────────────────────────────────────────────────
   import Akismet from 'akismet-api';
   const client = Akismet.client({ blog: 'https://your-site.com', apiKey: process.env.AKISMET_KEY });
   export default async function handler(req, res) {
     const body = await req.json();
     const isSpam = await client.checkSpam({ user_ip: body.user_ip, user_agent: body.user_agent,
       referrer: body.referrer, comment_content: body.comment_content, comment_type: 'comment' });
     res.json({ isSpam });
   }
   ───────────────────────────────────────────────────────────────── */
const AKISMET_CONFIG = {
  /* Set this to your deployed proxy URL to enable Akismet checking.
     Leave as empty string ('') to skip Akismet and rely on local filters only. */
  proxyUrl: 'https://aulert.vercel.app/api/akismet-check',
  timeoutMs: 5000 // If proxy takes longer than this, we skip the check (fail-open)
};

/**
 * Calls the Akismet proxy and resolves to:
 *   'spam'    – Akismet flagged the content
 *   'ham'     – Akismet says it's legitimate
 *   'skipped' – proxy not configured or request timed out (fail-open)
 */
async function akismetCheck(commentContent, commentAuthor = '') {
  if (!AKISMET_CONFIG.proxyUrl) return 'skipped';

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), AKISMET_CONFIG.timeoutMs);

  try {
    const resp = await fetch(AKISMET_CONFIG.proxyUrl, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal : controller.signal,
      body   : JSON.stringify({
        comment_content: commentContent,
        comment_author : commentAuthor,
        user_ip        : '',   // The proxy will read this from req headers server-side
        user_agent     : navigator.userAgent,
        referrer       : document.referrer
      })
    });
    clearTimeout(tid);

    if (!resp.ok) {
      console.warn('[Akismet] Proxy returned', resp.status, '— failing open');
      return 'skipped';
    }
    const data = await resp.json();
    return data.isSpam ? 'spam' : 'ham';

  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError') {
      console.warn('[Akismet] Request timed out — failing open');
    } else {
      console.warn('[Akismet] Network error:', err.message, '— failing open');
    }
    return 'skipped';
  }
}

/** Show / hide the Akismet checking overlay on the submit button */
function fbkSetSubmitState(state) {
  const btn = document.getElementById('fbkSubmitBtn');
  if (!btn) return;
  if (state === 'checking') {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `
      <svg class="fbk-spin" width="15" height="15" viewBox="0 0 24 24" fill="none"
           style="animation:fbkSpinAnim .8s linear infinite">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"
                stroke-dasharray="32" stroke-dashoffset="10"/>
      </svg>
      Checking…`;
  } else if (state === 'sending') {
    btn.disabled = true;
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `
      <svg class="fbk-spin" width="15" height="15" viewBox="0 0 24 24" fill="none"
           style="animation:fbkSpinAnim .8s linear infinite">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"
                stroke-dasharray="32" stroke-dashoffset="10"/>
      </svg>
      Sending…`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

/** Show an Akismet-specific block warning */
function fbkShowAkismetBlock() {
  const warn    = document.getElementById('fbkWarn');
  const warnTxt = document.getElementById('fbkWarnText');
  const btn     = document.getElementById('fbkSubmitBtn');
  if (warn && warnTxt) {
    warn.classList.add('show');
    warnTxt.innerHTML =
      '<strong>Spam Detected by Akismet:</strong> Your message was flagged as spam by our ' +
      'automated filter. Please revise your message and try again.';
  }
  if (btn) btn.disabled = true;
}

let fbkStarVal = 0;
let fbkCurrentType = '';
let fbkDdOpen = false;

/* ── Custom Dropdown ── */
function fbkToggleDropdown(e) {
  e.stopPropagation();
  fbkDdOpen = !fbkDdOpen;
  const menu = document.getElementById('fbkDdMenu');
  const trigger = document.getElementById('fbkDdTrigger');
  menu.classList.toggle('open', fbkDdOpen);
  trigger.classList.toggle('active', fbkDdOpen);
  trigger.setAttribute('aria-expanded', String(fbkDdOpen));
}
function fbkCloseDropdown() {
  if (!fbkDdOpen) return;
  fbkDdOpen = false;
  document.getElementById('fbkDdMenu').classList.remove('open');
  const trigger = document.getElementById('fbkDdTrigger');
  trigger.classList.remove('active');
  trigger.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => { if (!e.target.closest('#fbkDropdown')) fbkCloseDropdown(); });

// SVG strings for each type icon shown in the trigger button
const FBK_DD_SVG = {
  recommendation: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  error:          `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  rating:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const FBK_DD_META = {
  recommendation: { label: 'Recommendation', svgColor: 'var(--teal-icon)',  iconBg: 'var(--teal-icon-bg)' },
  error:          { label: 'Error Report',    svgColor: '#FB7185',  iconBg: 'rgba(251,113,133,.12)' },
  rating:         { label: 'Rating (1–5 ★)',  svgColor: '#FCD34D',  iconBg: 'rgba(252,211,77,.12)' }
};

function fbkSelectType(val) {
  fbkCurrentType = val;
  const meta = FBK_DD_META[val];

  const label = document.getElementById('fbkDdLabel');
  const icon  = document.getElementById('fbkDdTypeIcon');
  label.textContent = meta.label;
  label.style.color = '';
  icon.innerHTML = FBK_DD_SVG[val];
  icon.style.background = meta.iconBg;
  icon.style.color = meta.svgColor;

  document.querySelectorAll('.fbk-dd-option').forEach(opt => {
    opt.classList.toggle('chosen', opt.getAttribute('onclick').includes(`'${val}'`));
  });
  document.getElementById('fbkDdTrigger').classList.add('selected');
  fbkCloseDropdown();

  const textFields    = document.getElementById('fbkTextFields');
  const ratingSection = document.getElementById('fbkRatingSection');
  const submitRow     = document.getElementById('fbkSubmitRow');

  textFields.style.display    = (val === 'recommendation' || val === 'error') ? 'block' : 'none';
  ratingSection.style.display = val === 'rating' ? 'block' : 'none';
  submitRow.style.display     = 'flex';

  // Auto-fill email from Google login if available
  if (S.user?.email) {
    const emailId = val === 'rating' ? 'fbkUserEmailRating' : 'fbkUserEmail';
    const emailEl = document.getElementById(emailId);
    if (emailEl && !emailEl.value) emailEl.value = S.user.email;
  }

  document.getElementById('fbkQualityBar').classList.remove('show');
  document.getElementById('fbkWarn').classList.remove('show');
  document.getElementById('fbkSubmitBtn').disabled = false;
  fbkAnalyze();
}

/* ════════════════════════════════════════════
   SPAM / QUALITY DETECTION — v3
════════════════════════════════════════════ */

// Known real English words — used as a "whitelist anchor"
const REAL_WORDS = new Set([
  'i','a','the','is','it','in','on','at','to','do','be','my','me','we','he','she','they',
  'was','are','has','had','can','not','but','and','or','for','of','up','so','if','by','an',
  'this','that','with','have','from','when','what','where','why','how','which','been','will',
  'would','could','should','there','their','then','than','also','just','more','some','any',
  'one','two','all','its','our','your','his','her','you','new','now','use','see','get','way',
  'good','bad','app','page','screen','button','tab','menu','work','fix','add','remove','change',
  'show','hide','load','error','bug','crash','slow','fast','broken','missing','feature','click',
  'please','thanks','thank','hello','hi','issue','problem','request','idea','note','feedback',
  'report','suggest','improve','update','version','color','text','font','size','layout','design',
  'always','never','sometimes','often','still','keep','need','want','like','love','hate','think',
  'found','used','tried','getting','going','working','showing','looks','seems','feels','really',
  'class','course','assignment','grade','calendar','notification','alert','school','teacher',
  'student','classroom','google','email','login','account','settings','theme','dark','light',
  'after','before','while','since','because','however','instead','without','through','maybe',
  'every','each','both','few','most','other','another','same','such','own','only','very','make',
  'back','down','out','over','into','between','about','against','during','within','around',
  'open','close','send','save','submit','cancel','confirm','delete','create','edit','view','help',
  'aulert','monitor','track','watch','notice','ping','remind','reminder','classes','ui','ux',
  'time','date','day','week','month','year','set','got','see','try','bit','lot','thing','place',
  'right','left','top','bottom','side','area','section','part','item','list','icon','modal',
  'click','tap','scroll','swipe','drag','drop','type','search','filter','sort','refresh','sync',
  'first','last','next','prev','back','new','old','current','main','home','nav','menu','bar',
  'read','mark','unread','clear','reset','done','ok','yes','no','off','on','dark','light','auto',
  'push','sound','quiet','loud','mute','vibrate','schedule','remind','due','late','early','soon',
  'grade','score','points','percent','pass','fail','late','overdue','upcoming','today','tomorrow',
  'stream','post','announcement','material','quiz','test','exam','hw','homework','project','lab',
  'am','pm','ago','now','since','until','between','during','throughout','across',
  'that','these','those','here','there','where','which','what','who','whom','whose',
  'great','nice','cool','awesome','bad','terrible','worst','best','better','worse','okay',
  'hard','easy','simple','complex','confusing','clear','obvious','weird','strange','normal',
  'small','big','large','tiny','wide','narrow','tall','short','long','brief','detailed',
  'number','amount','count','total','average','rate','ratio','percent','percentage',
  'user','users','account','profile','info','data','content','message','notification',
  'appear','disappear','display','render','load','reload','refresh','update','sync',
  'happen','occurs','shows','works','breaks','crashes','freezes','lags','delays',
  'cannot','cant','wont','doesnt','didnt','isnt','wasnt','arent','werent','havent',
  "can't","won't","doesn't","didn't","isn't","wasn't","aren't","weren't","haven't",
  'please','kindly','maybe','perhaps','probably','definitely','certainly','actually',
  'much','many','little','few','several','various','different','similar','same','other',
  'important','urgent','minor','major','critical','optional','required','needed','missing'
]);

// Common English word endings — legitimate words often end in these
const VALID_SUFFIXES = ['ing','tion','ed','er','est','ness','ment','ful','less','ous','ive','ize','ise','ity','ary','ory','ic','al','ly','able','ible','age','ance','ence','ent','ant','ism','ist','ize'];
// Common English word prefixes
const VALID_PREFIXES = ['un','re','pre','dis','mis','over','under','out','up','in','im','non','anti','auto','co','de','inter','multi','sub','super'];

const VOWELS = new Set([...'aeiouAEIOU']);
const CONSONANTS = new Set([...'bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ']);

// English letter-transition frequency table (simplified).
// Maps each letter to the set of letters that can VALIDLY follow it.
// Generated from common English patterns:
const VALID_TRANSITIONS = {
  a:new Set([...'bcdefghijklmnopqrstuvwxyz']), // 'a' can be followed by almost anything
  e:new Set([...'abcdefghijklmnopqrstuvwxyz']),
  i:new Set([...'abcdefghijklmnopqrstuvwxyz']),
  o:new Set([...'abcdefghijklmnopqrstuvwxyz']),
  u:new Set([...'abcdefghijklmnopqrstuvwxyz']),
  // Consonants — only allow plausible following letters
  b:new Set([...'aeioulrwy']),
  c:new Set([...'aeioulrhk']),
  d:new Set([...'aeioulrwy']),
  f:new Set([...'aeioulrwy']),
  g:new Set([...'aeioulrhwny']),
  h:new Set([...'aeiou']),
  j:new Set([...'aeiou']),
  k:new Set([...'aeiouln']),
  l:new Set([...'aeiouldfkmnpstvy']),
  m:new Set([...'aeioubnpls']),
  n:new Set([...'aeioudgksct']),
  p:new Set([...'aeioulrh']),
  q:new Set([...'u']),
  r:new Set([...'aeioudgklmnprst']),
  s:new Set([...'aeioulmnpqrthkcw']),
  t:new Set([...'aeioulrwhsy']),
  v:new Set([...'aeiou']),
  w:new Set([...'aeioulrhn']),
  x:new Set([...'aeiou']),
  y:new Set([...'aeiousn']),
  z:new Set([...'aeiou'])
};

function vowelRatio(str) {
  const letters = str.replace(/[^a-zA-Z]/g,'');
  if (!letters.length) return 0;
  return [...letters].filter(c => VOWELS.has(c)).length / letters.length;
}

function maxConsonantRun(str) {
  let max = 0, cur = 0;
  for (const ch of str) {
    if (CONSONANTS.has(ch)) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

// Transition score: what fraction of letter pairs are linguistically plausible
function transitionScore(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g,'');
  if (w.length < 2) return 1;
  let valid = 0;
  for (let i = 0; i < w.length - 1; i++) {
    const from = w[i], to = w[i+1];
    const allowed = VALID_TRANSITIONS[from];
    if (allowed && allowed.has(to)) valid++;
    else if (VOWELS.has(from) || VOWELS.has(to)) valid += 0.5; // vowel adjacent = partial credit
  }
  return valid / (w.length - 1);
}

// Check if word resembles a keyboard row smash
const KB_ROWS = [
  /^[qwertyuiop]{4,}$/i,
  /^[asdfghjkl]{4,}$/i,
  /^[zxcvbnm]{4,}$/i,
  /^[qwertasdfgzxcvb]{4,}$/i, // left-hand mash
  /^[yuiophjklnm]{4,}$/i,      // right-hand mash
];
function isKeyboardMash(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g,'');
  return KB_ROWS.some(r => r.test(w));
}

// Check common valid suffix/prefix patterns
function hasValidMorphology(word) {
  const w = word.toLowerCase();
  return VALID_SUFFIXES.some(s => w.length > s.length + 2 && w.endsWith(s))
      || VALID_PREFIXES.some(p => w.length > p.length + 2 && w.startsWith(p));
}

// Score a single word 0–1 for linguistic plausibility
function wordPlausibility(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g,'');
  if (w.length === 0) return 1;

  // Whitelist
  if (REAL_WORDS.has(w)) return 1;

  // Very short unknown words — be strict
  if (w.length <= 2) return 0.25;
  if (w.length === 3) {
    // 3-letter words: must have at least 1 vowel and ok transition
    const vr = vowelRatio(w);
    const ts = transitionScore(w);
    return vr > 0 && ts > 0.4 ? 0.55 : 0.1;
  }

  const vr  = vowelRatio(w);
  const mcr = maxConsonantRun(w);
  const ts  = transitionScore(w);
  const km  = isKeyboardMash(w);

  // Instant low score for keyboard mash
  if (km) return 0.05;

  // Start at 0.5 for unknown words (not 1.0) — burden of proof
  let score = 0.5;

  // Transition score is the strongest signal
  score += (ts - 0.5) * 0.6; // ts=1 → +0.3, ts=0 → -0.3

  // Vowel ratio: English words sit 0.22–0.65
  if (vr < 0.08)       score -= 0.5;
  else if (vr < 0.18)  score -= 0.3;
  else if (vr < 0.22)  score -= 0.1;
  else if (vr > 0.78)  score -= 0.3;
  else if (vr > 0.65)  score -= 0.1;

  // Consonant run
  if (mcr >= 6) score -= 0.55;
  else if (mcr >= 5) score -= 0.38;
  else if (mcr >= 4) score -= 0.15;

  // Valid morphology boosts unknown words
  if (hasValidMorphology(w)) score += 0.2;

  // Repeated chars
  if (/(.)\1{2,}/.test(w)) score -= 0.35;

  // Long word with decent vowel ratio and transitions — probably real
  if (w.length >= 7 && vr >= 0.25 && ts >= 0.65) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

// Average word plausibility across all words — weighted by word length
function textPlausibilityScore(text) {
  const words = text.trim().split(/\s+/).filter(w => w.replace(/[^a-zA-Z]/g,'').length > 0);
  if (!words.length) return 0;
  let weightedSum = 0, totalWeight = 0;
  for (const w of words) {
    const len = w.replace(/[^a-zA-Z]/g,'').length;
    const weight = Math.max(1, len); // longer words matter more
    weightedSum += wordPlausibility(w) * weight;
    totalWeight += weight;
  }
  return weightedSum / totalWeight;
}

// Count how many words are from REAL_WORDS
function realWordRatio(text) {
  const words = text.toLowerCase().trim().split(/\s+/).filter(w => w.replace(/[^a-z]/g,'').length > 1);
  if (!words.length) return 0;
  const real = words.filter(w => REAL_WORDS.has(w.replace(/[^a-z]/g,''))).length;
  return real / words.length;
}

// Main scoring function — returns { score, blocked, status, hint, color }
function fbkScoreText(subject, detail) {
  const subTrim = subject.trim();
  const detTrim = detail.trim();
  const combined = (subTrim + ' ' + detTrim).trim();

  if (combined.length < 3) return { score: 0, blocked: false, status: '', hint: '', color: '' };

  const words    = combined.split(/\s+/).filter(w => w.length > 0);
  const letters  = (combined.match(/[a-zA-Z]/g) || []).length;
  const total    = combined.length;
  const vr       = vowelRatio(combined);
  const plausib  = textPlausibilityScore(combined);
  const rwRatio  = realWordRatio(combined);
  const lc       = combined.toLowerCase();

  // ─── HARD BLOCK LAYER ───────────────────────────────────────
  const block = (hint) => ({ score: 3, blocked: true, status: 'Spam Detected', hint, color: '#FB7185' });

  // 1. No letters at all
  if (letters === 0 && total > 2)
    return block('No readable text — please write your feedback using words.');

  // 2. Extremely low letter ratio (lots of symbols/numbers)
  if (total > 5 && letters / total < 0.28)
    return block('Too many symbols or numbers — please write your feedback as plain text.');

  // 3. Terrible vowel ratio across whole text
  if (total > 10 && (vr < 0.07 || vr > 0.93))
    return block('Your message doesn\'t look like readable text. Please write in plain sentences.');

  // 4. Single character repeated (aaaaaaa, 111111)
  if (/^(.)\1+$/.test(combined.replace(/\s/g,'')))
    return block('Repeated characters aren\'t valid feedback. Please describe your thoughts.');

  // 5. Keyboard row smash for whole message (multi-word)
  if (words.length >= 2 && words.every(w => isKeyboardMash(w.replace(/[^a-zA-Z]/g,''))))
    return block('Your message looks like a keyboard smash. Please write actual feedback.');

  // 6. Single word / short message that's clearly spam or meaningless
  const SPAM_EXACT = new Set([
    // keyboard mashes
    'asdf','qwerty','zxcv','asd','qwe','hjkl','fgh','dfgh','sdfgh','xcvb','bnm','zxcvbn',
    // filler / non-feedback
    'spam','fake','test','idk','idc','na','nothing','lol','lmao','lol','rofl',
    'hello','hey','hi','ok','okay','sure','yes','no','nope','yep','yup','nah',
    'good','bad','nice','cool','great','fine','meh','k','kk','thx','ty','np',
    'whatever','idc','idgaf','bruh','bro','lmk','imo','tbh','fyi','omg','wtf',
    'pls','plz','pleas','plez','dunno','hmm','hm','uh','um','er','ah','oh',
    'null','undefined','none','empty','blank','void','random','stuff','thing',
    '123','1234','12345','000','111','abc','abcd','abcde','xyz'
  ]);
  if (words.length <= 2 && SPAM_EXACT.has(lc.replace(/[^a-z0-9]/g,'')))
    return block('Your message doesn\'t contain meaningful feedback. Please describe what you\'d like to share.');

  // 7. Profanity / abusive content block
  // Normalise leet-speak & common substitutions before checking
  // e.g. f*ck → fuck, sh!t → shit, a$$ → ass, ph → f, etc.
  function normalizeLeet(str) {
    return str.toLowerCase()
      .replace(/[@4]/g, 'a')
      .replace(/[3]/g, 'e')
      .replace(/[1!|]/g, 'i')
      .replace(/[0]/g, 'o')
      .replace(/[5$]/g, 's')
      .replace(/[7]/g, 't')
      .replace(/[6]/g, 'g')
      .replace(/[8]/g, 'b')
      .replace(/[9]/g, 'g')
      .replace(/ph/g, 'f')
      .replace(/[^a-z\s]/g, ''); // strip remaining non-letters
  }

  // Profanity root patterns — checked as substrings so f**king, fvuking etc. all match
  const PROFANITY_ROOTS = [
    'fuck','fck','fuk','fuq','phuck',
    'shit','sht','shyt',
    'bitch','biatch','bytch',
    'asshole','ashole','arsehole',
    'cunt','cvnt',
    'dickhead','dikhead',
    'bastard',
    'nigger','nigga',
    'faggot','fagot',
    'retard',
    'kys','killurself','killyourself',
    'stfu','gtfo',
    'whore','whor','slut',
    'pedo','pedophile',
    'rape','rapist',
  ];

  const normalizedCombined = normalizeLeet(combined);
  const wordTokens = normalizedCombined.split(/\s+/).filter(Boolean);

  // Check each token: does it CONTAIN any profanity root?
  const hasProfanity = wordTokens.some(token =>
    PROFANITY_ROOTS.some(root => token.includes(root))
  );
  // Also check the full normalized string for run-together words like "whatthefuck"
  const hasRunTogether = PROFANITY_ROOTS.some(root => normalizedCombined.replace(/\s/g,'').includes(root));

  if (hasProfanity || hasRunTogether)
    return block('Your message contains inappropriate language. Please keep feedback respectful and constructive.');

  // 8. URL / link spam
  if (/https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.co\b/i.test(combined))
    return block('Links are not allowed in feedback. Please describe your thoughts in plain text.');

  // 9. Repeated word spam (e.g. "good good good good")
  if (words.length >= 3) {
    const cleanWords = wordTokens.filter(w => w.length > 1);
    if (cleanWords.length >= 3) {
      const freq = {};
      cleanWords.forEach(w => freq[w] = (freq[w] || 0) + 1);
      const maxFreq = Math.max(...Object.values(freq));
      if (maxFreq / cleanWords.length > 0.55)
        return block('Your message contains too many repeated words. Please write varied, descriptive feedback.');
    }
  }

  // 10. Excessive ALL CAPS (shouting / spam signal)
  const upperCount = (combined.match(/[A-Z]/g) || []).length;
  const lowerCount = (combined.match(/[a-z]/g) || []).length;
  if (letters > 15 && upperCount / (upperCount + lowerCount) > 0.75)
    return block('Please avoid writing in ALL CAPS. Write your feedback normally.');

  // 11. Very low plausibility score — gibberish text
  if (words.length >= 2 && plausib < 0.38)
    return block('Your message looks like random characters. Please write readable sentences describing your feedback.');

  // 12. Single long gibberish word
  if (words.length === 1 && letters > 4 && plausib < 0.32)
    return block('That doesn\'t look like a real word or sentence. Please write your feedback clearly.');

  // 13. Most words are unknown and have poor transitions
  if (words.length >= 3 && rwRatio < 0.08 && plausib < 0.52)
    return block('Your message appears to contain mostly unrecognizable text. Please write in plain English.');

  // 14. Alternating consonant pattern (like "sdfsdf", "asdqwe")
  const repeatingChunk = /^([a-zA-Z]{2,5})\1{2,}$/.test(combined.replace(/\s/g,''));
  if (repeatingChunk)
    return block('Your message contains a repeating pattern. Please write actual feedback.');

  // 15. Too short — minimum 5 meaningful words for text feedback
  const meaningfulWords = wordTokens.filter(w => w.length > 2 && !['the','and','for','but','are','was','its'].includes(w));
  if (meaningfulWords.length < 4)
    return block('Your message is too short. Please write at least a sentence or two describing your feedback.');

  // ─── QUALITY SCORING ────────────────────────────────────────
  let score = 0;

  // Core plausibility (40 pts max) — strongest gate
  score += plausib * 40;

  // Real word ratio bonus (10 pts max)
  score += rwRatio * 10;

  // Subject filled
  if (subTrim.length > 4) score += 8;
  if (subTrim.split(/\s+/).filter(w=>w.length>1).length >= 2) score += 4;

  // Detail word count (graduated)
  const detWords = detTrim.split(/\s+/).filter(w => w.replace(/[^a-z]/gi,'').length > 0).length;
  if (detWords >= 3)  score += 6;
  if (detWords >= 6)  score += 6;
  if (detWords >= 12) score += 7;
  if (detWords >= 25) score += 6;
  if (detWords >= 45) score += 5;

  // Sentence structure
  if (/[,;]/.test(combined)) score += 3;
  if (/[.!?]/.test(combined)) score += 5;
  if ((combined.match(/[.!?]/g) || []).length >= 2) score += 3;

  // Meaningful context keywords
  const KW = [
    'when','where','what','why','how','because','since','after','before',
    'feature','button','page','error','crash','slow','fast','broken','missing',
    'add','remove','change','improve','suggest','notice','issue','problem',
    'works','doesnt','doesn\'t','should','would','could','clicking','loading',
    'opening','appears','happens','tried','found','noticed','using','every','always','never',
    'sometimes','currently','instead','recommend','prefer','think','feel','wish','hope'
  ];
  const kwHits = KW.filter(k => lc.includes(k)).length;
  score += Math.min(kwHits * 2.2, 12);

  // Penalise low-effort one-liners
  const LOW_EFFORT = [
    'fix it','pls fix','pls add','update it','add it','its bad','its good',
    'make it better','doesnt work','not working','broken','please fix','just fix',
    'very bad','very good','so bad','so good','not good','not bad','too slow',
    'doesnt load','wont load','cant load','not load','no work','dont work'
  ];
  if (LOW_EFFORT.some(le => lc.includes(le)) && detWords < 8) score = Math.min(score, 22);

  // Penalise excessive punctuation / emoji spam
  const punctCount = (combined.match(/[!?]{2,}|\.{3,}/g) || []).length;
  if (punctCount >= 3) score -= 10;

  // Penalise very short detail (< 5 words)
  if (detWords < 5) score -= 15;

  // Cap: low plausibility can't achieve high score via length alone
  if (plausib < 0.50 && score > 35) score = Math.min(score, 35);
  if (plausib < 0.42 && score > 28) score = Math.min(score, 28);

  score = Math.round(Math.min(Math.max(score, 0), 100));

  // ── Hard block if final score is too low ──
  // Score < 22 means even the quality scoring thinks this is worthless
  if (score < 22)
    return block('Your message is too vague or low-quality. Please add more detail so the developer can understand and act on your feedback.');

  let status, color, hint;
  if (score < 35) {
    status = 'Low Quality'; color = '#FB7185';
    hint = detWords < 6
      ? 'Too short — describe your feedback with at least a couple of sentences.'
      : 'Add more specific detail so the developer can understand and act on your message.';
  } else if (score < 58) {
    status = 'Moderate'; color = '#FCD34D';
    hint = 'Decent start — adding more context and specifics will make this much more useful.';
  } else if (score < 80) {
    status = 'Good'; color = '#00ffd9';
    hint = 'Clear and descriptive.';
  } else {
    status = 'Excellent'; color = '#00ffd9';
    hint = 'Detailed and well-written — very helpful to the developer.';
  }

  return { score, blocked: false, status, hint, color };
}

function fbkAnalyze() {
  const type = fbkCurrentType;

  // For rating: analyze the reasoning textarea
  const isRating = type === 'rating';
  const subject = isRating ? '' : (document.getElementById('fbkSubject')?.value || '');
  const detail  = isRating
    ? (document.getElementById('fbkReason')?.value || '')
    : (document.getElementById('fbkDetail')?.value || '');

  // Char count for subject
  if (!isRating) {
    const subjectCount = document.getElementById('fbkSubjectCount');
    if (subjectCount) {
      const len = subject.length;
      subjectCount.textContent = len + ' / 120';
      subjectCount.className   = 'fbk-char-count' + (len > 100 ? (len >= 120 ? ' over' : ' warn') : '');
    }
  }

  const combined = (subject + ' ' + detail).trim();
  const bar      = document.getElementById('fbkQualityBar');
  const fill     = document.getElementById('fbkQualityFill');
  const statusEl = document.getElementById('fbkQualityStatus');
  const hintEl   = document.getElementById('fbkQualityHint');
  const warn     = document.getElementById('fbkWarn');
  const warnTxt  = document.getElementById('fbkWarnText');
  const btn      = document.getElementById('fbkSubmitBtn');

  if (combined.length < 3) {
    bar.classList.remove('show');
    warn.classList.remove('show');
    btn.disabled = false;
    return;
  }

  const result = fbkScoreText(subject, detail);

  bar.classList.add('show');
  fill.style.width      = result.score + '%';
  fill.style.background = result.color;
  statusEl.textContent  = result.status;
  statusEl.style.color  = result.color;
  hintEl.textContent    = result.hint;

  if (result.blocked) {
    warn.classList.add('show');
    warnTxt.innerHTML = '<strong>Cannot send:</strong> ' + result.hint;
    btn.disabled = true;
  } else {
    warn.classList.remove('show');
    btn.disabled = false;
  }
}

/* ── Stars ── */
function fbkSetStar(n) { fbkStarVal = n; fbkRenderStars(n); fbkAnalyze(); }
function fbkHoverStar(n) { fbkRenderStars(n); }
function fbkHoverEnd()   { fbkRenderStars(fbkStarVal); }
function fbkRenderStars(filled) {
  document.querySelectorAll('.fbk-star').forEach((s, i) => {
    const v = i + 1;
    s.textContent = v <= filled ? '★' : '☆';
    s.classList.toggle('filled', v <= filled);
  });
}

/* ── Submit (async — includes Akismet check as second-layer filter) ── */
async function fbkSubmit() {
  const type = fbkCurrentType;
  let subject = '', body = '', commentAuthor = '';

  // Get user email from the visible email field (or fall back to Google login email)
  const isRatingType = type === 'rating';
  const emailInputId = isRatingType ? 'fbkUserEmailRating' : 'fbkUserEmail';
  const userEmail = (document.getElementById(emailInputId)?.value || '').trim()
    || (S.user?.email || '');

  if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    const emailEl = document.getElementById(emailInputId);
    if (emailEl) {
      emailEl.classList.add('invalid');
      emailEl.focus();
      setTimeout(() => emailEl.classList.remove('invalid'), 2000);
    }
    return;
  }

  if (type === 'recommendation' || type === 'error') {
    const sv = (document.getElementById('fbkSubject').value || '').trim();
    const dv = (document.getElementById('fbkDetail').value  || '').trim();
    if (!dv) { document.getElementById('fbkDetail').focus(); return; }

    // Layer 1: client-side linguistic filter
    const result = fbkScoreText(sv, dv);
    if (result.blocked) return;

    subject       = '[Aulert ' + (type === 'error' ? 'Error Report' : 'Recommendation') + '] ' + (sv || '(no subject)');
    body          = dv;
    commentAuthor = sv;

  } else if (type === 'rating') {
    if (!fbkStarVal) {
      const stars = document.getElementById('fbkStars');
      stars.style.outline = '2px solid var(--rose)';
      stars.style.borderRadius = '8px';
      setTimeout(() => { stars.style.outline = ''; stars.style.borderRadius = ''; }, 1300);
      return;
    }
    const reason = (document.getElementById('fbkReason').value || '').trim();
    if (!reason) { document.getElementById('fbkReason').focus(); return; }

    // Layer 1: client-side linguistic filter
    const result = fbkScoreText('', reason);
    if (result.blocked) return;

    subject = '[Aulert Rating] ' + '★'.repeat(fbkStarVal) + ' ' + fbkStarVal + '/5';
    body    = 'Rating: ' + fbkStarVal + '/5\n\nReasoning:\n' + reason;
  } else { return; }

  /* ── Rate limit: max 3 feedback per 24 hours ── */
  const _fbkLimited = await window.tsCheckFeedbackRateLimit(userEmail);
  if (_fbkLimited) return;

  /* ── Layer 2: Akismet API check ─────────────────────────────── */
  fbkSetSubmitState('checking');

  const akismetResult = await akismetCheck(body, commentAuthor);

  if (akismetResult === 'spam') {
    // Akismet flagged this message — block and notify user
    fbkSetSubmitState('idle');
    fbkShowAkismetBlock();
    return;
  }

  // 'ham' or 'skipped' (proxy not configured / timed out) → proceed
  /* ─────────────────────────────────────────────────────────── */

  /* ── Send via EmailJS (actual email delivery) ── */
  fbkSetSubmitState('sending');

  try {
    if (typeof emailjs === 'undefined') throw new Error('EmailJS not loaded');

    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      {
        user_email: userEmail,
        to_email  : userEmail,
        subject   : subject,
        message   : body,
        reply_to  : userEmail,
        sent_at   : new Date().toLocaleString(),
      }
    );

    fbkSetSubmitState('idle');
    fbkShowSuccess();

  } catch (err) {
    console.error('[EmailJS] Send failed:', err);
    fbkSetSubmitState('idle');

    // Fallback to mailto if EmailJS fails or isn't configured yet
    window.location.href = 'mailto:' + _fd +
      '?subject=' + encodeURIComponent(subject) +
      '&body='    + encodeURIComponent(body);

    setTimeout(fbkShowSuccess, 600);
  }
}

function fbkShowSuccess() {
  ['fbkTextFields','fbkRatingSection','fbkSubmitRow'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.querySelector('#p-fbk .fbk-field').style.display = 'none';
  const success = document.getElementById('fbkSuccess');
  success.classList.add('show');
}

function fbkReset() {
  const card = document.querySelector('.fbk-card');
  card.classList.add('resetting');

  setTimeout(() => {
    // Reset all state
    fbkCurrentType = '';
    fbkStarVal = 0;

    // Reset dropdown
    document.getElementById('fbkDdLabel').textContent = '— Select a type —';
    document.getElementById('fbkDdLabel').style.color = 'var(--text-3)';
    document.getElementById('fbkDdTypeIcon').innerHTML = '';
    document.getElementById('fbkDdTypeIcon').style.background = 'none';
    document.getElementById('fbkDdTrigger').classList.remove('selected');
    document.querySelectorAll('.fbk-dd-option').forEach(o => o.classList.remove('chosen'));

    // Show dropdown field
    document.querySelector('#p-fbk .fbk-field').style.display = '';

    // Clear inputs
    ['fbkSubject','fbkDetail','fbkReason'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });

    // Hide sections
    document.getElementById('fbkTextFields').style.display    = 'none';
    document.getElementById('fbkRatingSection').style.display = 'none';
    document.getElementById('fbkSubmitRow').style.display     = 'none';
    document.getElementById('fbkQualityBar').classList.remove('show');
    document.getElementById('fbkWarn').classList.remove('show');
    document.getElementById('fbkSubmitBtn').disabled = false;
    fbkRenderStars(0);

    // Hide success
    document.getElementById('fbkSuccess').classList.remove('show');

    // Fade back in
    card.classList.remove('resetting');
    card.classList.add('resetting-in');
    setTimeout(() => card.classList.remove('resetting-in'), 300);
  }, 220);
}

/* ════════════════════════════════════════════
   NOTIFICATION PANEL
════════════════════════════════════════════ */
let notifPanelOpen = false;

function toggleNotifPanel(e) {
  e && e.stopPropagation();
  notifPanelOpen ? closeNotifPanel() : openNotifPanel();
}
function openNotifPanel() {
  notifPanelOpen = true;
  renderNotifPanel();
  document.getElementById('notifPanel').classList.add('open');
  document.getElementById('notifPanelOverlay').classList.add('open');
  document.addEventListener('click', onOutsideNotifClick);
}
function closeNotifPanel() {
  notifPanelOpen = false;
  document.getElementById('notifPanel').classList.remove('open');
  document.getElementById('notifPanelOverlay').classList.remove('open');
  document.removeEventListener('click', onOutsideNotifClick);
}
function onOutsideNotifClick(e) {
  if (!document.getElementById('notifPanel').contains(e.target) &&
      !document.getElementById('bellBtn').contains(e.target)) closeNotifPanel();
}
function renderNotifPanel() {
  const unread = S.notifs.filter(n => !n.read).length;
  const cnt = document.getElementById('npUnreadCount');
  cnt.textContent = unread; cnt.style.display = unread ? '' : 'none';

  const typeIcons = {
    announcement: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    assignment:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    material:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  document.getElementById('npList').innerHTML = S.notifs.slice(0, 8).map(n => {
    const c = courseById(n.courseId), t = TYPE_META[n.type] || {};
    return `<div class="np-item${!n.read?' unread':''}" onclick="closeNotifPanel();openSheet('${n.id}')">
      <div class="np-dot-col">
        ${!n.read ? `<div class="np-unread-dot" style="background:${c.color}"></div>` : '<div style="width:7px;height:7px"></div>'}
        <div class="np-type-icon" style="background:${c.color}18;color:${c.color}">${typeIcons[n.type]||''}</div>
      </div>
      <div class="np-content">
        <div class="np-item-class" style="color:${c.color}">${c.name}</div>
        <div class="np-item-title">${n.title}</div>
        <div class="np-item-preview">${n.body}</div>
        <div class="np-item-time">${n.time} · ${t.label||''}</div>
      </div>
    </div>`;
  }).join('');
}
function markAllRead() {
  S.notifs.forEach(n => { n.read = true; S.readIds.add(n.id); });
  saveRead();
  renderFeed(); updatePip(); renderNotifPanel();
}

/* ════════════════════════════════════════════
   GREETING & SIDEBAR
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
      ava.innerHTML = `<img src="${picture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer">`;
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
      profAva.innerHTML = `<img src="${picture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer">`;
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
          return `<div class="mini-dl"><div class="mini-dl-bar" style="background:${c.color}"></div><div class="mini-dl-info"><div class="mini-dl-title">${dl.title}</div><div class="mini-dl-class">${c.name}</div></div><div class="mini-dl-when ${cls2}">${when}</div></div>`;
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
          <div class="sidebar-cls-name">${c.name}</div>
          ${c.section ? `<div class="sidebar-cls-teacher">${c.section}</div>` : ''}
        </div>
        ${count > 0 ? `<div class="sidebar-cls-cnt" style="background:${c.color}18;color:${c.color};border-color:${c.color}30">${count}</div>` : ''}
      </div>`;
    }).join('');
    clsEl.innerHTML = html;
  }
}

/* ════════════════════════════════════════════
   FEED
════════════════════════════════════════════ */
function setChip(f, el) {
  S.filter = f;
  S.page = 1;
  // reset classroom filter when type filter changes
  S.courseFilter = 'all';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  // clear sidebar highlight
  document.querySelectorAll('.sidebar-cls').forEach(c => c.classList.remove('active'));
  renderFeed();
}

function onSearch(val) {
  S.searchTerm = val.trim().toLowerCase();
  S.page = 1;
  renderFeed();
}

function setCourseFilter(cid, el) {
  S.courseFilter = cid;
  S.page = 1;
  document.querySelectorAll('.sidebar-cls').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  // clear type filter so everything shows for that class
  S.filter = 'all';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  const allChip = document.querySelector('.chip');
  if (allChip) allChip.classList.add('active');
  renderFeed();
}

function renderFeed() {
  const cnt = { all:0, announcement:0, assignment:0, material:0 };
  S.notifs.forEach(n => { cnt.all++; if (cnt[n.type] !== undefined) cnt[n.type]++; });
  Object.keys(cnt).forEach(k => {
    const el = document.getElementById('cnt-'+k); if (el) el.textContent = cnt[k];
  });
  // Deadline count
  const nowDay2 = new Date(); nowDay2.setHours(0,0,0,0);
  const dlCntEl = document.getElementById('cnt-deadline');
  if (dlCntEl) dlCntEl.textContent = S.deadlines.filter(d => d.date >= nowDay2).length;

  const unread = S.notifs.filter(n => !n.read).length;
  const du = document.getElementById('dashUnreadNum');
  if (du) du.textContent = unread;
  // Update Notifications tab badge (only when not currently on that tab)
  const feedTabActive = document.getElementById('tb-feed')?.classList.contains('on');
  if (!feedTabActive) updateTabBadge('feed', unread);
  else updateTabBadge('feed', 0);

  const fm = document.getElementById('feedMeta');
  if (fm) fm.textContent = unread
    ? `${unread} unread · ${S.courses.length} classes monitored`
    : `All caught up · ${S.courses.length} classes monitored`;

  // update counts; later we'll recompute after filtering as well
  const fcm = document.getElementById('feedCountMeta');
  if (fcm) fcm.textContent = `${cnt.all} total · ${unread} unread`;

  renderSidebar();

  // apply filters
  let filtered = S.notifs.filter(n => {
    if (S.filter !== 'all' && n.type !== S.filter) return false;
    if (S.courseFilter !== 'all' && n.courseId !== S.courseFilter) return false;
    if (S.searchTerm) {
      const hay = (n.title + ' ' + n.body + ' ' + courseById(n.courseId).name).toLowerCase();
      if (!hay.includes(S.searchTerm)) return false;
    }
    return true;
  });
  // update count meta based on current filters
  if (fcm) {
    const fu = filtered.filter(n => !n.read).length;
    fcm.textContent = `${filtered.length} total · ${fu} unread`;
  }

  const feed = document.getElementById('notifFeed');
  // update filtered counts meta
  if (fcm) {
    const fu = filtered.filter(n => !n.read).length;
    fcm.textContent = `${filtered.length} total · ${fu} unread`;
  }

  if (!filtered.length) {
    feed.innerHTML = `<div class="empty-s"><svg class="icon-teal" width="42" height="42" viewBox="0 0 24 24" fill="none" style="opacity:.2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#00ffd9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>Nothing here</h3><p>No notifications match this filter.<br>Try clearing filters/search to see everything.</p></div>`;
    const pg = document.getElementById('pagination'); if (pg) pg.innerHTML = '';
    return;
  }

  // pagination
  const per = 20;
  const total = filtered.length;
  const pages = Math.ceil(total / per) || 1;
  if (!S.page || S.page > pages) S.page = 1;
  const start = (S.page - 1) * per;
  const pageItems = filtered.slice(start, start + per);

  feed.innerHTML = pageItems.map((n, i) => {
    const c = courseById(n.courseId), t = TYPE_META[n.type] || {};
    return `<div class="ncard${n.read?' is-read':''}" style="animation-delay:${Math.min(i,.8)*0.05}s" onclick="openSheet('${n.id}')">
  <div class="ncard-row">
    <div class="ncard-bar" style="background:${c.color}"></div>
    <div class="ncard-body">
      <div class="ncard-top">
        <div class="ncard-tags">
          <span class="cls-tag" style="background:${c.color}18;color:${c.color};border:1px solid ${c.color}30">${c.name}</span>
          <span class="type-tag">${t.label||''}</span>
        </div>
        <span class="ncard-time">${n.time}</span>
      </div>
      <div class="ncard-title">${n.title}</div>
      <div class="ncard-preview">${n.body}</div>
      <div class="ncard-foot">
        <div class="unread-mark">
          ${!n.read ? `<div class="u-pip" style="background:${c.color}"></div><span>Unread</span>` : `<span>Read</span>`}
        </div>
        <div class="view-hint">Read more <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="9,18 15,12 9,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
    </div>
  </div>
</div>`;
  }).join('');

  // pagination controls
  const pg = document.getElementById('pagination');
  if (pg) {
    if (pages <= 1) {
      pg.innerHTML = '';
    } else {
      let html = '';
      html += `<div class="page-btn" onclick="setPage(${Math.max(1,S.page-1)})">Previous</div>`;
      for (let p = 1; p <= pages; p++) {
        html += `<div class="page-btn${p===S.page?' active':''}" onclick="setPage(${p})">${p}</div>`;
      }
      html += `<div class="page-btn" onclick="setPage(${Math.min(pages,S.page+1)})">Next</div>`;
      pg.innerHTML = `<div class="pagination">${html}</div>`;
    }
  }
}

function setPage(n) {
  S.page = n;
  renderFeed();
}

function updatePip() {
  const pip = document.getElementById('pip');
  const unread = S.notifs.filter(n => !n.read).length;
  pip.style.display = unread ? 'block' : 'none';
  if (notifPanelOpen) renderNotifPanel();
}

/* ════════════════════════════════════════════
   SHEET (item detail)
════════════════════════════════════════════ */
function openSheet(id) {
  const n = S.notifs.find(x => x.id === id); if (!n) return;
  S.openId = id;
  const c = courseById(n.courseId), t = TYPE_META[n.type] || {};

  document.getElementById('shEyebrow').innerHTML =
    `<span class="cls-tag" style="background:${c.color}18;color:${c.color};border:1px solid ${c.color}30">${c.name}</span>
     <span style="font-size:11px;color:var(--text-3)">${t.label||''}</span>`;
  document.getElementById('shTitle').textContent = n.title;
  document.getElementById('shSub').textContent = n.time;
  document.getElementById('shText').textContent = n.body;
  document.getElementById('mrBtn').textContent = n.read ? 'Mark unread' : 'Mark as read';

  // Update the "Open in Classroom" link to the actual item URL
  const link = document.querySelector('.sa-primary');
  if (link) link.href = n.link || 'https://classroom.google.com';

  if (!n.read) {
    n.read = true;
    S.readIds.add(n.id);
    saveRead();
    renderFeed(); updatePip();
  }
  document.getElementById('sheetVeil').classList.add('open');
}

function toggleRead() {
  const n = S.notifs.find(x => x.id === S.openId); if (!n) return;
  n.read = !n.read;
  if (n.read) S.readIds.add(n.id); else S.readIds.delete(n.id);
  saveRead();
  document.getElementById('mrBtn').textContent = n.read ? 'Mark unread' : 'Mark as read';
  renderFeed(); updatePip();
}

function closeSheet(e) {
  if (e && e.target.closest('.sheet')) return; // don't close when clicking inside card
  document.getElementById('sheetVeil').classList.remove('open');
}

/* ════════════════════════════════════════════
   CALENDAR
════════════════════════════════════════════ */
function navMo(d) {
  S.calMonth += d;
  if (S.calMonth < 0)  { S.calMonth = 11; S.calYear--; }
  if (S.calMonth > 11) { S.calMonth = 0;  S.calYear++; }
  renderCal();
}

function renderCal() {
  document.getElementById('moLabel').textContent = `${MONTHS[S.calMonth]} ${S.calYear}`;
  const today = new Date();
  const first = new Date(S.calYear, S.calMonth, 1).getDay();
  const days  = new Date(S.calYear, S.calMonth + 1, 0).getDate();
  const prev  = new Date(S.calYear, S.calMonth, 0).getDate();

  const dmap = {};
  S.deadlines.forEach(dl => {
    if (dl.date.getFullYear() === S.calYear && dl.date.getMonth() === S.calMonth) {
      const k = dl.date.getDate();
      if (!dmap[k]) dmap[k] = [];
      dmap[k].push(dl);
    }
  });

  // Also plot hw tasks that have a deadline date
  _hwTasks.forEach(task => {
    if (!task.date || task.done) return;
    const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
    const [y, m, d] = datePart.split('-').map(Number);
    if (y === S.calYear && (m - 1) === S.calMonth) {
      if (!dmap[d]) dmap[d] = [];
      dmap[d].push({ _hwTask: true, title: task.subject, desc: task.desc, date: new Date(y, m - 1, d), courseId: null, _task: task });
    }
  });

  let h = '';
  for (let i = first - 1; i >= 0; i--)
    h += `<div class="cday other"><div class="cday-n">${prev - i}</div></div>`;
  for (let d = 1; d <= days; d++) {
    const isT = today.getDate()===d && today.getMonth()===S.calMonth && today.getFullYear()===S.calYear;
    const dots = (dmap[d]||[]).map(dl => {
      const color = dl._hwTask ? '#00ffd9' : courseById(dl.courseId).color;
      return `<div class="cdot" style="background:${color}"></div>`;
    }).join('');
    h += `<div class="cday${isT?' today':''}" onclick="pickDay(${d},this)"><div class="cday-n">${d}</div><div class="cday-dots">${dots}</div></div>`;
  }
  for (let i = 1; i <= 42 - (first + days); i++)
    h += `<div class="cday other"><div class="cday-n">${i}</div></div>`;

  document.getElementById('calGrid').innerHTML = h;
  renderDl(null);
}

function pickDay(d, el) {
  document.querySelectorAll('.cday').forEach(x => x.classList.remove('picked'));
  el.classList.add('picked');
  renderDl(d);
}

function exportToGoogleCalendar() {
  const nowDay = new Date(); nowDay.setHours(0,0,0,0);
  const list = S.deadlines.filter(dl => dl.date >= nowDay).sort((a,b) => a.date - b.date);
  if (!list.length) {
    showToast('No deadlines', 'Add some assignments first to export to Google Calendar');
    return;
  }
  const pad = n => String(n).padStart(2,'0');
  const toICSDate = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T235900Z`;
  const dtstamp = () => {
    const n = new Date();
    return `${n.getFullYear()}${pad(n.getMonth()+1)}${pad(n.getDate())}T${pad(n.getHours())}${pad(n.getMinutes())}${pad(n.getSeconds())}Z`;
  };
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Aulert//Classroom Deadlines//EN\r\n';
  list.forEach((dl, i) => {
    const c = courseById(dl.courseId);
    const start = toICSDate(dl.date);
    const end = new Date(dl.date); end.setDate(end.getDate()+1);
    const endStr = toICSDate(end);
    const esc = s => String(s).replace(/[\\,;]/g, '\\$&');
    const summary = esc(dl.title || 'Deadline');
    const desc = esc(`${c.name} — ${dl.title || 'Deadline'}`);
    ics += `BEGIN:VEVENT\r\nUID:aulert-${dl.notifId || i}-${Date.now()}@aulert.app\r\nDTSTAMP:${dtstamp()}\r\nDTSTART:${start}\r\nDTEND:${endStr}\r\nSUMMARY:${summary}\r\nDESCRIPTION:${desc}\r\nEND:VEVENT\r\n`;
  });
  ics += 'END:VCALENDAR';
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Aulert-Deadlines.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Exported!', `Add ${list.length} deadline${list.length!==1?'s':''} to Google Calendar via import`);
}

function renderDl(day) {
  const nowDay = new Date(); nowDay.setHours(0,0,0,0);

  // Classroom deadlines
  const classroomList = day
    ? S.deadlines.filter(dl => dl.date.getDate()===day && dl.date.getMonth()===S.calMonth && dl.date.getFullYear()===S.calYear)
    : S.deadlines.filter(dl => dl.date >= nowDay).sort((a,b) => a.date - b.date);

  // Homework task deadlines
  const hwList = [];
  _hwTasks.forEach(task => {
    if (!task.date || task.done) return;
    const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
    const [y, m, d] = datePart.split('-').map(Number);
    const taskDate = new Date(y, m - 1, d);
    if (day) {
      if (d === day && (m - 1) === S.calMonth && y === S.calYear)
        hwList.push({ _hwTask: true, title: task.subject, date: taskDate });
    } else {
      if (taskDate >= nowDay)
        hwList.push({ _hwTask: true, title: task.subject, date: taskDate });
    }
  });

  const combined = [...classroomList, ...hwList].sort((a,b) => a.date - b.date);

  document.getElementById('dlHead').textContent = day
    ? `Deadlines on ${MONTHS[S.calMonth]} ${day}` : 'Upcoming deadlines';

  const el = document.getElementById('dlList');
  if (!combined.length) { el.innerHTML = `<div class="empty-s" style="padding:32px 0"><h3>No deadlines${day?' on this day':''}</h3></div>`; return; }

  const ul = { urg:'Urgent', soo:'Soon', ok:'On track' };
  el.innerHTML = combined.map(dl => {
    const diff = Math.ceil((dl.date - nowDay) / 86400000);
    const ds   = dl.date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    const when = diff < 0 ? 'Overdue' : diff===0 ? 'Today' : diff===1 ? 'Tomorrow' : `${diff} days`;
    if (dl._hwTask) {
      const urg = diff < 0 ? 'urg' : diff <= 1 ? 'urg' : diff <= 3 ? 'soo' : 'ok';
      const urgLabel = diff < 0 ? 'Overdue' : diff <= 1 ? 'Urgent' : diff <= 3 ? 'Soon' : 'On track';
      return `<div class="dl-row"><div class="dl-stripe" style="background:#00ffd9"></div><div class="dl-info"><div class="dl-t">${dl.title}</div><div class="dl-c" style="color:#00ffd9;opacity:.8">Homework</div></div><div class="dl-meta"><span class="dl-date">${ds} · ${when}</span><span class="dl-badge ${urg}">${urgLabel}</span></div></div>`;
    }
    const c = courseById(dl.courseId);
    return `<div class="dl-row"><div class="dl-stripe" style="background:${c.color}"></div><div class="dl-info"><div class="dl-t">${dl.title}</div><div class="dl-c">${c.name}</div></div><div class="dl-meta"><span class="dl-date">${ds} · ${when}</span><span class="dl-badge ${dl.urg}">${ul[dl.urg]}</span></div></div>`;
  }).join('');
}

/* ════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════ */
function renderClasses() {
  document.getElementById('clsBody').innerHTML = S.courses.map(c => `
<div class="cls-row">
  <div class="cls-swatch" style="background:${c.color}">${c.abbr}</div>
  <div class="cls-info"><b>${c.name}</b>${c.section ? `<span>${c.section}</span>` : ''}</div>
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
    fill1.style.background = `linear-gradient(90deg, var(--violet) 0%, #00ffd9 100%)`;
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
    fill1.style.background   = `linear-gradient(90deg, var(--violet) 0%, color-mix(in srgb, var(--violet) ${100 - bGradEnd}%, #00ffd9 ${bGradEnd}%) 100%)`;

    // Segment A: 0% → endPct — teal at right, partial gradient
    const aWidth = endPct;
    fill2.style.display  = 'block';
    fill2.style.left     = '0%';
    fill2.style.width    = aWidth + '%';
    fill2.style.borderRadius = '0 99px 99px 0';
    fill2.style.background   = `linear-gradient(90deg, color-mix(in srgb, var(--violet) ${100 - bGradEnd}%, #00ffd9 ${bGradEnd}%) 0%, #00ffd9 100%)`;
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

// Set real date on calendar SVG on load
(function() {
  function setCalDate() {
    const el = document.querySelector('#tb-cal .cal-num');
    if (el) el.textContent = new Date().getDate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setCalDate);
  else setCalDate();
})();

/* Mouse wheel support on time values */
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

/* ════════════════════════════════════════════
   GOOGLE CALENDAR SYNC
════════════════════════════════════════════ */

const GCAL_API = 'https://www.googleapis.com/calendar/v3';
const GCAL_STORE_KEY = 'aul_gcal_ids';

function gcalLoadMap() {
  try { return JSON.parse(localStorage.getItem(GCAL_STORE_KEY) || '{}'); }
  catch(e) { return {}; }
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

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
function showToast(title, msg) {
  document.getElementById('toastT').textContent = title;
  document.getElementById('toastM').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('in');
  clearTimeout(S.toastTimer);
  S.toastTimer = setTimeout(closeToast, 5500);
}
function closeToast() { document.getElementById('toast').classList.remove('in'); }

// ── Scroll progress bar ──
(function(){
  const bar = document.getElementById('scrollBar');
  if(!bar) return;
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (window.scrollY / total * 100) + '%';
  }, {passive:true});
})();

// ── Aurora cursor follower ──
(function(){
  const el = document.getElementById('auroraFollower');
  if(!el) return;
  let tx = window.innerWidth/2, ty = window.innerHeight/2;
  document.addEventListener('mousemove', e => {
    el.style.left = e.clientX + 'px';
    el.style.top  = e.clientY + 'px';
  }, {passive:true});
})();

// ── Cursor sparkle on click ──
(function(){

})();

// ── Floating particles on landing ──
(function(){
  const land = document.getElementById('v-land');
  if(!land) return;
  function spawn(){
    if(!land.classList.contains('show')) return;
    const p = document.createElement('div');
    p.classList.add('particle');
    const size = 4 + Math.random() * 10;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}vw;
      animation-duration:${8 + Math.random()*12}s;
      animation-delay:${-Math.random()*8}s;
      opacity:${0.15 + Math.random()*.4};
    `;
    land.appendChild(p);
    setTimeout(() => p.remove(), 22000);
  }
  for(let i=0;i<12;i++) spawn();
  setInterval(() => { if(land.classList.contains('show')) spawn(); }, 2000);
})();

// ── Card 3D tilt on hover ──
(function(){
  function applyTilt(cards){
    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - .5;
        const y = (e.clientY - r.top)  / r.height - .5;
        card.style.transform = `perspective(800px) rotateY(${x*4}deg) rotateX(${-y*3}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
  // apply to feature cards, compare cols, demo feats, ncard
  function initTilts(){
    applyTilt(document.querySelectorAll('.feat-card, .compare-col, .demo-feat, .faq-item'));
  }
  initTilts();
  // re-init after app launch
  document.addEventListener('appLaunched', initTilts);
})();

// ── Magnetic effect on primary buttons ──
(function(){
  function magnetize(btns){
    btns.forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width/2)) * .12;
        const dy = (e.clientY - (r.top  + r.height/2)) * .12;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }
  function initMagnets(){
    magnetize(document.querySelectorAll('.btn-hero-primary, .btt'));
  }
  initMagnets();
  document.addEventListener('appLaunched', initMagnets);
})();

// ── Ping ring on notif pip ──
(function(){
  function addPing(){
    const pip = document.getElementById('pip');
    if(!pip || pip.style.display==='none') return;
    pip.querySelectorAll('.ping-ring').forEach(r=>r.remove());
    const ring = document.createElement('div');
    ring.classList.add('ping-ring');
    pip.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
  }
  setInterval(addPing, 2800);
})();

// ── Count-up animation for stat numbers ──
(function(){
  function countUp(el, target, suffix=''){
    let start = 0;
    const dur = 1600;
    const step = ts => {
      if(!start) start = ts;
      const p = Math.min((ts-start)/dur, 1);
      const ease = 1 - Math.pow(1-p, 3);
      el.textContent = (suffix==='%'||suffix==='s'||suffix==='+')
        ? (target < 10 ? (ease*target).toFixed(1) : Math.round(ease*target)) + suffix
        : Math.round(ease*target) + suffix;
      if(p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(!e.isIntersecting) return;
      const el = e.target;
      const txt = el.textContent.trim();
      if(txt.includes('%')) countUp(el, parseInt(txt), '%');
      else if(txt.includes('+')) countUp(el, parseInt(txt), '+');
      else if(txt.includes('min')) { el.textContent = '~5 min'; } // keep as-is
      io.unobserve(el);
    });
  }, {threshold:0.5});
  document.querySelectorAll('.stat-num').forEach(el => io.observe(el));
})();

// ── Back to top ──
(function(){
  const btn = document.getElementById('btt');
  if(!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, {passive:true});
})();

// ── Ripple effect on buttons ──
(function(){
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button, .btn-hero, .btn-sm, .icon-btn, .chip, .nav-tab');
    if(!btn) return;
    btn.classList.add('ripple-host');
    const r = document.createElement('span');
    r.classList.add('ripple-wave');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });
})();

// ── IntersectionObserver scroll reveals ──
(function(){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('visible');
      } else {
        // Remove so elements re-animate when scrolled back into view
        e.target.classList.remove('visible');
      }
    });
  }, {threshold: 0.12, rootMargin: '0px 0px -40px 0px'});
  
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger').forEach(el => {
    io.observe(el);
  });
})();

// ── FAQ toggle ──
function toggleFaq(btn){
  const item = btn.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if(!isOpen) item.classList.add('open');
}

// ── Phone notification stagger on scroll ──
(function(){
  const list = document.getElementById('phoneNotifList');
  if(!list) return;
  const io = new IntersectionObserver(entries => {
    if(entries[0].isIntersecting){
      const notifs = list.querySelectorAll('.phone-notif');
      notifs.forEach((n,i) => setTimeout(() => n.classList.add('pn-show'), i * 300));
      io.disconnect();
    }
  }, {threshold: 0.3});
  io.observe(list);
})();

// Typewriter cycling verbs
(function(){
  const allWords = [
    'catches everything','watches 24/7','never misses a beat',
    'fills the gaps','notifies instantly','has your back',
    'never sleeps','sees it all','keeps you ahead',
    'tracks it all','stays alert'
  ];
  const el = document.getElementById('heroVerb');
  if(!el) return;

  // Shuffle array
  function shuffle(arr){
    const a = [...arr];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  let words = shuffle(allWords);
  let idx = 0, charIdx = 0, deleting = false;
  const speed = {type:70, del:36, pause:2400};

  function tick(){
    const word = words[idx];
    if(!deleting){
      charIdx++;
      el.textContent = word.slice(0, charIdx);
      if(charIdx === word.length){
        deleting = true;
        setTimeout(tick, speed.pause);
        return;
      }
    } else {
      charIdx--;
      el.textContent = word.slice(0, charIdx);
      if(charIdx === 0){
        deleting = false;
        idx++;
        if(idx >= words.length){
          // reshuffle for next round, avoid repeating last word
          const last = words[words.length-1];
          words = shuffle(allWords);
          if(words[0] === last) words.push(words.shift());
          idx = 0;
        }
      }
    }
    setTimeout(tick, deleting ? speed.del : speed.type);
  }

  // Delete the initial "remembers" first, then start cycling
  charIdx = el.textContent.length;
  deleting = true;
  setTimeout(tick, 900);
})();

// Float cards use independent CSS bubble animations — no parallax needed

// ── Live phone clock ──
(function(){
  const el = document.getElementById('phoneClock');
  if(!el) return;
  function tick(){
    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2,'0');
    el.textContent = h + ':' + m;
  }
  tick();
  // update every 10s is plenty for a mock phone display
  setInterval(tick, 10000);
})();

// ── Live signal & WiFi ──
(function(){
  const sig  = [null,
    document.getElementById('phSig1'),
    document.getElementById('phSig2'),
    document.getElementById('phSig3'),
    document.getElementById('phSig4')
  ];
  const wifi = {
    svg: document.getElementById('phoneWifiSvg'),
    arcs: [
      document.getElementById('phWifi1'),
      document.getElementById('phWifi2'),
      document.getElementById('phWifi3'),
    ],
    dot: document.getElementById('phWifiDot')
  };

  const DIM = '0.25';

  // effectiveType → how many signal bars to light up
  function barsForType(type){
    return {
      'slow-2g': 1,
      '2g':      2,
      '3g':      3,
      '4g':      4,
    }[type] || 4;
  }

  function update(){
    const online = navigator.onLine;
    const conn   = navigator.connection || null;
    const connType = conn ? (conn.type || '') : '';
    const effType  = conn ? (conn.effectiveType || '4g') : '4g';

    // ── WiFi icon ──
    // Show WiFi if online AND (type is 'wifi' OR type unknown — most desktop browsers)
    // Hide / dim entirely if offline
    const isWifi = online && (connType === 'wifi' || connType === '');
    const isCellular = online && (connType === 'cellular' || connType === 'wimax');

    if(!online){
      // offline — dim everything
      wifi.svg.style.opacity = '0.2';
      sig.slice(1).forEach(r => r && (r.style.opacity = DIM));
    } else if(isCellular){
      // on cellular — hide wifi, show signal bars by quality
      wifi.svg.style.opacity = '0.15';
      const bars = barsForType(effType);
      sig.slice(1).forEach((r, i) => {
        if(r) r.style.opacity = (i < bars) ? '1' : DIM;
      });
    } else {
      // on wifi (or unknown) — show wifi by quality, keep signal bars full
      wifi.svg.style.opacity = '0.85';
      const bars = barsForType(effType);
      // Dim far wifi arcs for weaker connections
      wifi.arcs.forEach((arc, i) => {
        // arc[0]=inner, arc[1]=mid, arc[2]=outer
        // show based on bars: 4→all, 3→all, 2→inner+mid, 1→inner only
        const threshold = [0, 2, 1, 0][i] || 0; // min bars needed
        if(arc) arc.style.opacity = (bars > threshold) ? '1' : DIM;
      });
      if(wifi.dot) wifi.dot.style.opacity = '1';
      sig.slice(1).forEach(r => r && (r.style.opacity = '1'));
    }
  }

  update();
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);

  if(navigator.connection){
    navigator.connection.addEventListener('change', update);
  }
})();

// ── Live device battery ──
(function(){
  const fill = document.getElementById('phoneBatteryFill');
  const bolt = document.getElementById('phoneBatteryBolt');
  if(!fill) return;

  // Max width of the fill rect is 16px (x=2 to x=18)
  const MAX_W = 16;

  function applyBattery(level, charging){
    const w = Math.max(1, Math.round(level * MAX_W));
    fill.setAttribute('width', w);

    // Color: green if charging or >50%, amber if 20–50%, red if <20%
    let color;
    if(charging || level > 0.5) color = '#4ade80';   // green
    else if(level > 0.2)        color = '#FCD34D';   // amber
    else                        color = '#FB7185';    // red

    fill.setAttribute('fill', color);

    // Show bolt icon only when charging
    if(bolt) bolt.setAttribute('opacity', charging ? '1' : '0');
  }

  if('getBattery' in navigator){
    navigator.getBattery().then(function(bat){
      function update(){ applyBattery(bat.level, bat.charging); }
      update();
      bat.addEventListener('levelchange',  update);
      bat.addEventListener('chargingchange', update);
    }).catch(function(){
      // API blocked / not supported — keep default appearance
    });
  }
  // If Battery API not available, the hardcoded SVG fill stays as-is
})();

/* ════════════════════════════════════════════
   COMMUNITY — Firebase Realtime Database
   ──────────────────────────────────────────
   Setup:
   1. console.firebase.google.com → New project
   2. Build → Realtime Database → test mode
   3. Project Settings → Your apps → Config
   4. Fill in the three values below
════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:      'AIzaSyB16s3r7g9eC2LtoPUEL4dRxivn562rp6Q',
  databaseURL: 'https://aulert-210c3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:   'aulert-210c3',
};

(function(){
  // ── Helpers ──
  const fbReady = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('YOUR');
  function encKey(email) { return email.toLowerCase().replace(/\./g,',').replace(/@/g,'__at__'); }
  function decKey(key)   { return key.replace(/,/g,'.').replace(/__at__/g,'@'); }
  function chatKey(a,b)  { return [encKey(a),encKey(b)].sort().join('___'); }
  function initials(n) {
    const p = n.split(/[\s._\-]+/);
    return (p.length >= 2 ? p[0][0]+p[1][0] : n.slice(0,2)).toUpperCase();
  }
  function avatarGrad(email) {
    return ['linear-gradient(135deg,#8B5CF6,#00ffd9)','linear-gradient(135deg,#FB7185,#FCD34D)',
            'linear-gradient(135deg,#38BDF8,#8B5CF6)','linear-gradient(135deg,#00ffd9,#38BDF8)',
            'linear-gradient(135deg,#FCD34D,#FB7185)'][email.charCodeAt(0)%5];
  }
  // Returns inner HTML for an avatar element — photo if available, else gradient+initials
  function avatarInner(email, picture) {
    const uname = email.split('@')[0];
    if (picture) return `<img src="${esc(picture)}" alt="${esc(uname)}" onerror="this.parentNode.innerHTML='${esc(initials(uname))}';this.parentNode.style.background='${avatarGrad(email)}';">`;
    return esc(initials(uname));
  }
  function avatarBg(picture, email) { return picture ? 'transparent' : avatarGrad(email); }
  function fmtTime(ts){ const d=new Date(ts); return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); }
  function fmtDay(ts){
    const d=new Date(ts),n=new Date();
    if(d.toDateString()===n.toDateString()) return 'Today';
    const y=new Date(n); y.setDate(y.getDate()-1);
    if(d.toDateString()===y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }
  function fmtSeenAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Seen just now';
    if (mins < 60) return `Seen ${mins} min${mins!==1?'s':''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `Seen ${hrs} hr${hrs!==1?'s':''} ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Seen yesterday';
    if (days < 7)  return `Seen ${days} days ago`;
    return 'Seen ' + new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $id(id){ return document.getElementById(id); }

  let _db = null;
  let _activeChat = null;
  let _chatUnsubscribe = null;
  let _friends = {};
  let _incoming = {};
  let _sent = {};
  // ── Group state ──
  let _groups = {};
  let _activeGroup = null;
  let _groupMsgUnsubscribe = null;
  let _groupMemberUnsubscribe = null;
  let _groupsListener = null;
  let _seenByFriend = 0;       // timestamp: when friend last saw this DM thread
  let _seenUnsubscribe = null; // unsub for seen listener
  let _seenByGroup = {};       // groupId → { email: ts } for group seen receipts
  let _blocks = {};            // { email → {email, ts} } — users I've blocked

  function groupGrad(gid) {
    const gs = ['linear-gradient(135deg,#38BDF8,#6366f1)','linear-gradient(135deg,#10B981,#3B82F6)',
                'linear-gradient(135deg,#F59E0B,#8B5CF6)','linear-gradient(135deg,#EC4899,#F97316)',
                'linear-gradient(135deg,#06B6D4,#10B981)','linear-gradient(135deg,#8B5CF6,#EC4899)'];
    let h=0; for(const c of gid) h=(h*31+c.charCodeAt(0))&0x7fffffff;
    return gs[h%gs.length];
  }

  // ── State display ──
  function showRight(state) {
    const map = { loading:'comLoading', noauth:'comNoAuth', setup:'comSetup', empty:'comChatEmpty', chat:'comChatArea' };
    Object.values(map).forEach(id => { const el=$id(id); if(el) el.style.display='none'; });
    const el = $id(map[state]);
    if (!el) return;
    el.style.display = state === 'chat' ? 'flex' : '';
    if (state === 'chat') el.style.flexDirection = 'column';
    // When entering chat, set header visibility based on mode
    if (state === 'chat') {
      const dmH = $id('comDmHeader'), grpH = $id('comGroupHeader');
      if (_activeGroup) {
        if (dmH) dmH.style.display = 'none';
        if (grpH) grpH.classList.add('active');
      } else {
        if (dmH) dmH.style.display = '';
        if (grpH) grpH.classList.remove('active');
      }
    }
  }

  function comToast(msg) {
    let t = $id('comToastEl');
    if (!t) {
      t = document.createElement('div'); t.id='comToastEl';
      t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface-2);border:1px solid var(--rim);border-radius:var(--r-pill);padding:10px 20px;font-size:13px;font-weight:600;color:var(--text);z-index:9999;opacity:0;transition:all .3s var(--ease);pointer-events:none;white-space:nowrap;backdrop-filter:var(--blur);box-shadow:var(--shadow);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    setTimeout(()=>{t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';},10);
    setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(20px)';},3400);
  }

  // ── Render sidebar ──
  function renderSidebar() {
    const myEmail = S.user?.email;
    if (!myEmail) return;

    // Friends badge
    const friendEmails = Object.keys(_friends);
    const badge = $id('comFriendsCount');
    if (badge) badge.textContent = friendEmails.length + (friendEmails.length===1?' friend':' friends');

    // Incoming
    const inKeys = Object.keys(_incoming);
    const inSec = $id('comIncomingSection');
    const inList = $id('comIncomingList');
    const inCount = $id('comIncomingCount');
    if (inSec) inSec.style.display = inKeys.length ? '' : 'none';
    if (inCount) inCount.textContent = inKeys.length;
    if (inList) inList.innerHTML = inKeys.map(fromKey => {
      const d = _incoming[fromKey]||{};
      const email = d.email || decKey(fromKey);
      const pic = d.picture || '';
      const uname = email.split('@')[0];
      return `<div class="com-req-card incoming-card">
        <div class="com-req-ava" style="background:${avatarBg(pic,email)}">${avatarInner(email,pic)}</div>
        <div class="com-req-info">
          <div class="com-req-name">${esc(d.name || uname)}</div>
          <div class="com-req-gmail">${esc(email)}</div>
        </div>
        <div class="com-req-actions">
          <button class="com-req-btn accept" onclick="comAccept('${esc(email)}')">Accept</button>
          <button class="com-req-btn decline" onclick="comDeclineReq('${esc(email)}')">Decline</button>
        </div>
      </div>`;
    }).join('');

    // Sent
    const sentKeys = Object.keys(_sent).filter(k => !_friends[decKey(k)]);
    const sentSec = $id('comSentSection');
    const sentList = $id('comSentList');
    if (sentSec) sentSec.style.display = sentKeys.length ? '' : 'none';
    if (sentList) sentList.innerHTML = sentKeys.map(toKey => {
      const d = _sent[toKey]||{};
      const email = d.email || decKey(toKey);
      const uname = email.split('@')[0];
      return `<div class="com-req-card">
        <div class="com-req-ava" style="background:${avatarGrad(email)}">${esc(initials(uname))}</div>
        <div class="com-req-info">
          <div class="com-req-name">${esc(uname)}</div>
          <div class="com-req-gmail">${esc(email)}</div>
        </div>
        <div class="com-req-actions">
          <span class="com-req-pill">Awaiting…</span>
          <button class="com-req-btn decline" onclick="comCancelReq('${esc(email)}')">Cancel</button>
        </div>
      </div>`;
    }).join('');

    // Friends list
    const fl = $id('comFriendList');
    if (fl) {
      const visibleFriends = friendEmails.filter(e => !_blocks[e]);
      if (!visibleFriends.length) {
        fl.innerHTML = `<div class="com-empty"><svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p>No friends yet.<br>Add someone by their email!</p></div>`;
      } else {
        fl.innerHTML = visibleFriends.map(fEmail => {
          const fData = _friends[fEmail] || {};
          const pic = fData.picture || '';
          const uname = fData.name ? fData.name.split(' ')[0] : fEmail.split('@')[0];
          const isActive = _activeChat === fEmail;
          const unread = fData.unread || 0;
          return `<div class="com-friend-row ${isActive?'active':''}" onclick="comOpenChat('${esc(fEmail)}')">
            <div class="com-friend-ava" style="background:${avatarBg(pic,fEmail)}">${avatarInner(fEmail,pic)}</div>
            <div class="com-friend-info">
              <div class="com-friend-name">${esc(uname)}</div>
              <div class="com-friend-sub">${esc(fEmail)}</div>
            </div>
            ${unread ? `<div class="com-unread-badge">${unread}</div>` : ''}
          </div>`;
        }).join('');
      }
    }

    // Groups list
    const gl = $id('comGroupList');
    const gEmpty = $id('comGroupEmpty');
    const groupIds = Object.keys(_groups);
    if (gl) {
      if (!groupIds.length) {
        if (gEmpty) gEmpty.style.display = '';
      } else {
        if (gEmpty) gEmpty.style.display = 'none';
        gl.innerHTML = groupIds.map(gid => {
          const g = _groups[gid] || {};
          const isActive = _activeGroup === gid;
          const memberCount = Object.keys(g.members || {}).length;
          const unread = g.userUnread || 0;
          return `<div class="com-group-row ${isActive?'active':''}" onclick="comOpenGroup('${esc(gid)}')">
            <div class="com-group-icon" style="background:${groupGrad(gid)}">${esc((g.name||'G')[0].toUpperCase())}</div>
            <div class="com-group-info">
              <div class="com-group-name">${esc(g.name||'Group')}</div>
              <div class="com-group-sub">${memberCount} member${memberCount!==1?'s':''}</div>
            </div>
            ${unread ? `<div class="com-unread-badge">${unread}</div>` : ''}
          </div>`;
        }).join('');
      }
    }
  }

  // ── Main init (called each time tab opens) ──
  window.comInit = function() {
    const myEmail = S.user?.email;
    showRight('loading');

    if (!myEmail) { showRight('noauth'); return; }

    if (!fbReady) {
      showRight('setup');
      const form = $id('comAddForm');
      if (form) form.style.display = 'none';
      return;
    }

    // Init Firebase once
    if (!_db) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        _db = firebase.database();
        window._aulertDb = _db; // exposed for TS module
      } catch(e) {
        console.error('Firebase init error:', e);
        showRight('setup');
        return;
      }
    }

    const myKey = encKey(myEmail);
    const form = $id('comAddForm');
    if (form) form.style.display = '';
    // Show new group button
    const ngb = $id('comNewGroupBtn');
    if (ngb) ngb.style.display = 'flex';

    // Listen to groups the user belongs to
    if (!_groupsListener) {
      _groupsListener = _db.ref(`aulert/userGroups/${myKey}`);
      _groupsListener.on('value', async snap => {
        const raw = snap.val() || {};
        const groupIds = Object.keys(raw);
        const prev = { ..._groups };
        _groups = {};
        await Promise.all(groupIds.map(async gid => {
          const gSnap = await _db.ref(`aulert/groups/${gid}`).once('value');
          const gData = gSnap.val();
          if (gData) _groups[gid] = { ...gData, userUnread: raw[gid]?.unread || 0 };
        }));
        renderSidebar();
        // Update tab badge with group unreads
        const comTabActive = document.getElementById('tb-com')?.classList.contains('on');
        if (!comTabActive) {
          const friendUnread = Object.values(_friends).reduce((s,f) => s+(f.unread||0), 0);
          const groupUnread = Object.values(_groups).reduce((s,g) => s+(g.userUnread||0), 0);
          updateTabBadge('com', friendUnread + groupUnread);
        }
        // If active group got deleted or user left, go to empty
        if (_activeGroup && !_groups[_activeGroup]) {
          _activeGroup = null;
          showRight('empty');
        }
      });
    }

    // ── Listen to blocks ──
    _db.ref(`aulert/blocks/${myKey}`).on('value', snap => {
      _blocks = {};
      const raw2 = snap.val() || {};
      Object.entries(raw2).forEach(([, v]) => {
        if (v && v.email) _blocks[v.email] = v;
      });
      window._aulertBlocks = _blocks;
      renderSidebar();
      if (_activeChat && _blocks[_activeChat]) {
        const area = document.getElementById('comMsgs');
        if (area) area.innerHTML = '<div class="ts-blocked-notice"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round\"/%3E%3C/svg%3E<p>You have blocked this user. Unblock them to see messages.</p></div>';
      }
      if (_activeChat && window._updateBlockBtn) window._updateBlockBtn(_activeChat);
    });

    // Listen to friends
    _db.ref(`aulert/friends/${myKey}`).on('value', snap => {
      const raw = snap.val() || {};
      _friends = {};
      Object.entries(raw).forEach(([k,v]) => {
        const email = v?.email || decKey(k);
        _friends[email] = v || {};
      });
      renderSidebar();
      // Update Community tab badge with total unread messages across all friends
      const comTabActive = document.getElementById('tb-com')?.classList.contains('on');
      if (!comTabActive) {
        const totalUnread = Object.values(_friends).reduce((s, f) => s + (f.unread || 0), 0);
        updateTabBadge('com', totalUnread);
        // Fire browser notification if we just got new messages
        if (totalUnread > 0 && 'Notification' in window && Notification.permission === 'granted') {
          const senders = Object.entries(_friends)
            .filter(([,f]) => (f.unread || 0) > 0)
            .map(([email, f]) => f.name ? f.name.split(' ')[0] : email.split('@')[0]);
          if (senders.length > 0 && !comTabActive) {
            new Notification('Aulert · New message', {
              body: `${senders.join(', ')} sent you a message`,
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>'
            });
          }
        }
      } else {
        updateTabBadge('com', 0);
      }
      if (_activeChat && !_friends[_activeChat]) {
        _activeChat = null;
        showRight('empty');
      } else if (!_activeChat) {
        showRight('empty');
      }
    });

    // Listen to incoming requests
    _db.ref(`aulert/requests/${myKey}`).on('value', snap => {
      const raw = snap.val() || {};
      _incoming = {};
      Object.entries(raw).forEach(([k,v]) => {
        const email = v?.email || decKey(k);
        _incoming[k] = { ...v, email };
      });
      renderSidebar();
    });

    // Listen to sent requests
    _db.ref(`aulert/sent/${myKey}`).on('value', snap => {
      const raw = snap.val() || {};
      _sent = {};
      Object.entries(raw).forEach(([k,v]) => {
        const email = v?.email || decKey(k);
        _sent[k] = { ...v, email };
      });
      renderSidebar();
    });
  };

  // ── Send friend request ──
  window.comSendRequest = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    const inp = $id('comFriendInput');
    const gmail = (inp?.value||'').trim().toLowerCase();
    if (!gmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) {
      comToast('Please enter a valid email address'); inp.focus(); return;
    }
    if (gmail === myEmail) { comToast("You can't add yourself!"); return; }
    if (_friends[gmail]) { inp.value=''; comToast('Already friends!'); return; }
    if (_blocks[gmail]) { inp.value=''; comToast('You have blocked this user'); return; }
    if (_sent[encKey(gmail)]) { inp.value=''; comToast('Request already sent'); return; }

    const ts = Date.now();
    try {
      await _db.ref(`aulert/requests/${encKey(gmail)}/${encKey(myEmail)}`).set({
        email: myEmail,
        name: S.user?.name || '',
        picture: S.user?.picture || '',
        ts
      });
      await _db.ref(`aulert/sent/${encKey(myEmail)}/${encKey(gmail)}`).set({ email: gmail, ts });
      inp.value = '';
      comToast('Request sent to ' + gmail + ' ✉️');
    } catch(e) { comToast('Error: ' + e.message); }
  };

  // ── Accept incoming request ──
  window.comAccept = async function(fromEmail) {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    const ts = Date.now();
    // Get the sender's stored picture from their request
    const reqSnap = await _db.ref(`aulert/requests/${encKey(myEmail)}/${encKey(fromEmail)}`).once('value');
    const reqData = reqSnap.val() || {};
    const fromPic = reqData.picture || '';
    const fromName = reqData.name || '';
    try {
      // Store friend entry with picture for both sides
      await _db.ref(`aulert/friends/${encKey(myEmail)}/${encKey(fromEmail)}`).set({
        email: fromEmail, name: fromName, picture: fromPic, since: ts, unread: 0
      });
      await _db.ref(`aulert/friends/${encKey(fromEmail)}/${encKey(myEmail)}`).set({
        email: myEmail, name: S.user?.name || '', picture: S.user?.picture || '', since: ts, unread: 0
      });
      await _db.ref(`aulert/requests/${encKey(myEmail)}/${encKey(fromEmail)}`).remove();
      await _db.ref(`aulert/sent/${encKey(fromEmail)}/${encKey(myEmail)}`).remove();
      comToast('You and ' + (fromName || fromEmail.split('@')[0]) + ' are now friends! 🎉');
    } catch(e) { comToast('Error: ' + e.message); }
  };

  // ── Decline incoming request ──
  window.comDeclineReq = async function(fromEmail) {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    await _db.ref(`aulert/requests/${encKey(myEmail)}/${encKey(fromEmail)}`).remove();
    await _db.ref(`aulert/sent/${encKey(fromEmail)}/${encKey(myEmail)}`).remove();
  };

  // ── Cancel sent request ──
  window.comCancelReq = async function(toEmail) {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    await _db.ref(`aulert/sent/${encKey(myEmail)}/${encKey(toEmail)}`).remove();
    await _db.ref(`aulert/requests/${encKey(toEmail)}/${encKey(myEmail)}`).remove();
  };

  // ── Open chat ──
  window.comOpenChat = function(friendEmail) {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    _activeGroup = null;
    if (_groupMsgUnsubscribe) { _groupMsgUnsubscribe(); _groupMsgUnsubscribe=null; }
    if (_groupMemberUnsubscribe) { _groupMemberUnsubscribe(); _groupMemberUnsubscribe=null; }
    if (_seenUnsubscribe) { _seenUnsubscribe(); _seenUnsubscribe=null; }
    $id('comMembersPanel')?.classList.remove('open');
    _activeChat = friendEmail; window._activeChatEmail = friendEmail; window._activeGroupId = null;
    _seenByFriend = 0;

    // Clear unread
    _db.ref(`aulert/friends/${encKey(myEmail)}/${encKey(friendEmail)}/unread`).set(0);
    renderSidebar();
    showRight('chat');

    // Update header
    const fData = _friends[friendEmail] || {};
    const pic = fData.picture || '';
    const displayName = fData.name ? fData.name.split(' ')[0] : friendEmail.split('@')[0];
    const ava=$id('comChatAva'), nameEl=$id('comChatName'), gEl=$id('comChatGmail');
    if (ava) { ava.style.background = avatarBg(pic, friendEmail); ava.innerHTML = avatarInner(friendEmail, pic); }
    if (window._updateBlockBtn) _updateBlockBtn(friendEmail);
    if (nameEl) nameEl.textContent = displayName;
    if (gEl)    gEl.textContent = friendEmail;

    // Mark that I've seen this thread (write my seen timestamp)
    const cKey = chatKey(myEmail, friendEmail);
    const writeMySeenTs = () => _db.ref(`aulert/seen/${cKey}/${encKey(myEmail)}`).set(Date.now());
    writeMySeenTs();

    // Listen to friend's seen timestamp so receipt updates in real time
    const friendSeenRef = _db.ref(`aulert/seen/${cKey}/${encKey(friendEmail)}`);
    friendSeenRef.on('value', snap => {
      _seenByFriend = snap.val() || 0;
      // Re-render with updated seen info (only if still on this chat)
      if (_activeChat === friendEmail) {
        const area = $id('comMsgs');
        const existing = area ? Object.values(area.querySelectorAll('.com-msg-seen')) : [];
        // lightweight: just update the seen row if it exists, else full re-render is fine
        // We trigger a lightweight re-render by updating the last seen element directly
        const seenEls = area ? area.querySelectorAll('.com-msg-seen') : [];
        seenEls.forEach(el => {
          const label = el.querySelector('.seen-label');
          if (label) label.textContent = fmtSeenAgo(_seenByFriend);
          if (_seenByFriend) el.classList.add('seen'); else el.classList.remove('seen');
        });
      }
    });
    _seenUnsubscribe = () => friendSeenRef.off('value');

    // Detach old message listener
    if (_chatUnsubscribe) { _chatUnsubscribe(); _chatUnsubscribe=null; }

    // Listen for messages
    const ref = _db.ref(`aulert/messages/${cKey}`).limitToLast(120);
    let _lastMsgTs = Date.now();
    ref.on('value', snap => {
      const raw = snap.val() || {};
      const msgs = Object.entries(raw).map(([k,v])=>({...v,_key:k})).sort((a,b)=>a.ts-b.ts);
      msgs.forEach(m => {
        if (m.from !== myEmail && m.ts > _lastMsgTs) {
          // Friend sent me a new message while chat is open → refresh my seen ts
          writeMySeenTs();
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            const senderName = (_friends[m.from]?.name || m.from.split('@')[0]);
            const notifBody = m.fileData ? `${senderName} sent a file` : (m.text ? `${senderName}: ${m.text.slice(0,80)}` : `${senderName} sent a message`);
            new Notification('Aulert · New message', { body: notifBody, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>' });
          }
        }
      });
      if (msgs.length) _lastMsgTs = msgs[msgs.length-1].ts;
      renderMessages(msgs, myEmail);
    });
    _chatUnsubscribe = () => ref.off('value');
  };

  // ── Remove friend ──
  window.comRemoveFriend = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_activeChat || !_db) return;
    const fEmail = _activeChat;
    try {
      await _db.ref(`aulert/friends/${encKey(myEmail)}/${encKey(fEmail)}`).remove();
      await _db.ref(`aulert/friends/${encKey(fEmail)}/${encKey(myEmail)}`).remove();
    } catch(e) {}
    if (_chatUnsubscribe) { _chatUnsubscribe(); _chatUnsubscribe=null; }
    _activeChat = null;
    showRight('empty');
    renderSidebar();
  };

  // ════════════════════════════════════════════
  //  GROUP FUNCTIONS
  // ════════════════════════════════════════════

  // Show/hide create group modal
  window.comShowCreateGroup = function() {
    const modal = $id('comGroupModal');
    if (modal) { modal.classList.add('open'); setTimeout(() => $id('comGroupNameInp')?.focus(), 80); }
    const box = $id('comGroupInviteBox');
    if (box) box.classList.remove('show');
  };
  window.comHideCreateGroup = function() {
    const modal = $id('comGroupModal');
    if (modal) modal.classList.remove('open');
  };

  // Create a new group
  window.comCreateGroup = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    const nameInp = $id('comGroupNameInp');
    const emailsInp = $id('comGroupEmailsInp');
    const name = (nameInp?.value||'').trim();
    if (!name) { comToast('Enter a group name first'); nameInp?.focus(); return; }

    const inviteCode = Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,4);
    const groupId = _db.ref('aulert/groups').push().key;
    const ts = Date.now();

    const members = {};
    members[encKey(myEmail)] = { email:myEmail, name:S.user?.name||'', picture:S.user?.picture||'', joinedAt:ts, role:'owner' };
    const rawEmails = (emailsInp?.value||'').split(/[\s,;]+/).filter(e => e.includes('@'));
    rawEmails.forEach(e => {
      const em = e.toLowerCase().trim();
      if (em && em !== myEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        members[encKey(em)] = { email:em, name:'', picture:'', joinedAt:ts, role:'member' };
      }
    });

    try {
      await _db.ref(`aulert/groups/${groupId}`).set({ name, createdBy:myEmail, createdAt:ts, inviteCode, members });
      await _db.ref(`aulert/invites/${inviteCode}`).set(groupId);
      await _db.ref(`aulert/userGroups/${encKey(myEmail)}/${groupId}`).set({ name, joinedAt:ts, unread:0 });
      // Add userGroups entries for invited members
      for (const [mKey, mData] of Object.entries(members)) {
        if (mKey !== encKey(myEmail)) {
          await _db.ref(`aulert/userGroups/${mKey}/${groupId}`).set({ name, joinedAt:ts, unread:0 });
        }
      }
      const url = window.location.origin + window.location.pathname + '?join=' + inviteCode;
      const box = $id('comGroupInviteBox');
      const urlEl = $id('comGroupInviteUrl');
      if (box) box.classList.add('show');
      if (urlEl) urlEl.textContent = url;
      if (nameInp) nameInp.value = '';
      if (emailsInp) emailsInp.value = '';
      comToast(`Group "${name}" created! 🎉`);
    } catch(e) { comToast('Error: ' + e.message); }
  };

  // Copy invite link from modal
  window.comCopyInviteFromModal = function() {
    const url = $id('comGroupInviteUrl')?.textContent;
    if (url) { navigator.clipboard.writeText(url).then(() => comToast('Invite link copied! 🔗')); }
  };

  // Copy invite link from header button
  window.comCopyInviteLink = function() {
    const g = _groups[_activeGroup];
    if (!g) return;
    const url = window.location.origin + window.location.pathname + '?join=' + g.inviteCode;
    navigator.clipboard.writeText(url).then(() => comToast('Invite link copied! 🔗'));
  };

  // Toggle members panel
  window.comToggleMembers = function() {
    $id('comMembersPanel')?.classList.toggle('open');
  };

  // Render members list
  function renderMembersPanel(members, myEmail, createdBy) {
    const list = $id('comMembersListEl');
    if (!list) return;
    list.innerHTML = Object.values(members).map(m => {
      const isYou = m.email === myEmail;
      const isOwner = m.role === 'owner' || m.email === createdBy;
      const pic = m.picture || '';
      const uname = m.name ? m.name.split(' ')[0] : m.email.split('@')[0];
      return `<div class="com-member-item">
        <div class="com-member-ava" style="background:${avatarBg(pic,m.email)}">${avatarInner(m.email, pic)}</div>
        <div class="com-member-info">
          <div class="com-member-name">${esc(uname)}</div>
          <div class="com-member-email">${esc(m.email)}</div>
        </div>
        ${isYou ? '<span class="com-member-tag you">You</span>' : ''}
        ${isOwner && !isYou ? '<span class="com-member-tag host">Host</span>' : ''}
      </div>`;
    }).join('');
  }

  // Open group chat
  window.comOpenGroup = function(groupId) {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) return;
    // Clear DM state
    _activeChat = null;
    if (_chatUnsubscribe) { _chatUnsubscribe(); _chatUnsubscribe=null; }
    if (_seenUnsubscribe) { _seenUnsubscribe(); _seenUnsubscribe=null; }
    // Clear old group listeners
    if (_groupMsgUnsubscribe) { _groupMsgUnsubscribe(); _groupMsgUnsubscribe=null; }
    if (_groupMemberUnsubscribe) { _groupMemberUnsubscribe(); _groupMemberUnsubscribe=null; }

    _activeGroup = groupId;
    _seenByGroup[groupId] = _seenByGroup[groupId] || {};
    $id('comMembersPanel')?.classList.remove('open');

    // Clear unread + write my seen timestamp
    _db.ref(`aulert/userGroups/${encKey(myEmail)}/${groupId}/unread`).set(0);
    if (_groups[groupId]) _groups[groupId].userUnread = 0;
    const writeGroupSeenTs = () => _db.ref(`aulert/groupSeen/${groupId}/${encKey(myEmail)}`).set(Date.now());
    writeGroupSeenTs();

    renderSidebar();
    showRight('chat');

    const g = _groups[groupId] || {};
    const iconEl = $id('comGroupHeaderIcon');
    const nameEl = $id('comGroupHeaderName');
    const subEl  = $id('comGroupHeaderSub');
    const inp    = $id('comMsgInput');
    if (iconEl) { iconEl.style.background = groupGrad(groupId); iconEl.textContent = (g.name||'G')[0].toUpperCase(); }
    if (nameEl) nameEl.textContent = g.name || 'Group';
    const memberCount = Object.keys(g.members || {}).length;
    if (subEl)  subEl.textContent = `${memberCount} member${memberCount!==1?'s':''}`;
    if (inp)    inp.placeholder = `Message ${g.name||'group'}…`;

    // Listen to group seen timestamps (everyone's)
    const groupSeenRef = _db.ref(`aulert/groupSeen/${groupId}`);
    groupSeenRef.on('value', snap => {
      _seenByGroup[groupId] = snap.val() || {};
    });

    // Listen for messages
    const msgRef = _db.ref(`aulert/groups/${groupId}/messages`).limitToLast(200);
    let _lastGMsgTs = Date.now();
    msgRef.on('value', snap => {
      const raw = snap.val() || {};
      const msgs = Object.entries(raw).map(([k,v])=>({...v,_key:k})).sort((a,b)=>a.ts-b.ts);
      msgs.forEach(m => {
        if (m.from !== myEmail && m.ts > _lastGMsgTs) {
          writeGroupSeenTs();
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            const sn = m.senderName || m.from.split('@')[0];
            new Notification(`Aulert · ${g.name||'Group'}`, { body: `${sn}: ${m.text?m.text.slice(0,80):'sent a file'}` });
          }
        }
      });
      if (msgs.length) _lastGMsgTs = msgs[msgs.length-1].ts;
      renderGroupMessages(msgs, myEmail, groupId);
    });

    // Listen for member changes
    const memRef = _db.ref(`aulert/groups/${groupId}/members`);
    memRef.on('value', snap => {
      const members = snap.val() || {};
      if (_groups[groupId]) _groups[groupId].members = members;
      const count = Object.keys(members).length;
      const subEl2 = $id('comGroupHeaderSub');
      if (subEl2) subEl2.textContent = `${count} member${count!==1?'s':''}`;
      renderMembersPanel(members, myEmail, g.createdBy);
    });

    _groupMsgUnsubscribe = () => { msgRef.off('value'); memRef.off('value'); groupSeenRef.off('value'); };
  };

  // Send group message
  window.comSendGroupMsg = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_activeGroup || !_db) return;
    const inp = $id('comMsgInput');
    const text = (inp?.value||'').trim();
    if (!text) return;
    inp.value = '';
    const g = _groups[_activeGroup] || {};
    const ts = Date.now();
    try {
      await _db.ref(`aulert/groups/${_activeGroup}/messages`).push({
        from: myEmail, senderName: S.user?.name||'', senderPic: S.user?.picture||'', text, ts
      });
      // Increment unread for all other members
      Object.keys(g.members || {}).forEach(mKey => {
        if (mKey !== encKey(myEmail)) {
          _db.ref(`aulert/userGroups/${mKey}/${_activeGroup}/unread`).transaction(n => (n||0)+1);
        }
      });
    } catch(e) { comToast('Failed: ' + e.message); }
  };

  // Leave group
  window.comLeaveGroup = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_activeGroup || !_db) return;
    if (!confirm('Leave this group?')) return;
    const gid = _activeGroup;
    try {
      await _db.ref(`aulert/groups/${gid}/members/${encKey(myEmail)}`).remove();
      await _db.ref(`aulert/userGroups/${encKey(myEmail)}/${gid}`).remove();
      delete _groups[gid];
      if (_groupMsgUnsubscribe) { _groupMsgUnsubscribe(); _groupMsgUnsubscribe=null; }
      _activeGroup = null;
      $id('comMembersPanel')?.classList.remove('open');
      showRight('empty');
      renderSidebar();
      comToast('Left group');
    } catch(e) { comToast('Error: ' + e.message); }
  };

  // Join group via invite code (called from URL check or manually)
  window.comJoinGroup = async function(code) {
    const myEmail = S.user?.email;
    if (!myEmail || !_db) { comToast('Sign in first to join'); return; }
    try {
      const cSnap = await _db.ref(`aulert/invites/${code}`).once('value');
      const gid = cSnap.val();
      if (!gid) { comToast('Invalid or expired invite link'); return; }
      const gSnap = await _db.ref(`aulert/groups/${gid}`).once('value');
      const gData = gSnap.val();
      if (!gData) { comToast('Group no longer exists'); return; }
      const myKey = encKey(myEmail);
      // Already a member?
      if (gData.members && gData.members[myKey]) {
        comToast(`Already in "${gData.name}"!`);
        goTab('com', document.getElementById('tb-com'));
        setTimeout(() => comOpenGroup(gid), 500);
        return;
      }
      const ts = Date.now();
      await _db.ref(`aulert/groups/${gid}/members/${myKey}`).set({
        email:myEmail, name:S.user?.name||'', picture:S.user?.picture||'', joinedAt:ts, role:'member'
      });
      await _db.ref(`aulert/userGroups/${myKey}/${gid}`).set({ name:gData.name, joinedAt:ts, unread:0 });
      comToast(`Joined "${gData.name}"! 🎉`);
      window.history.replaceState({}, '', window.location.pathname);
      goTab('com', document.getElementById('tb-com'));
      setTimeout(() => comOpenGroup(gid), 600);
    } catch(e) { comToast('Error joining: ' + e.message); }
  };

  // Render group messages (with sender names for others)
  function renderGroupMessages(msgs, myEmail, groupId) {
    const area = $id('comMsgs');
    if (!area) return;
    window._tsMsgStore = msgs; // expose for context menu
    if (!msgs.length) {
      area.innerHTML='<div class="com-no-msgs"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p>No messages yet. Say hi! 👋</p></div>';
      return;
    }
    let lastMyIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].from === myEmail) { lastMyIdx = i; break; }
    }
    const seenMap = (groupId && _seenByGroup[groupId]) ? _seenByGroup[groupId] : {};
    const g = _groups[groupId] || {};
    const allMembers = g.members || {};
    const doubleTick = `<svg width="13" height="9" viewBox="0 0 18 12" fill="none"><path d="M1 6l4 4L14 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    let html='', lastDay='', lastFrom='';
    msgs.forEach((m, i) => {
      const day = fmtDay(m.ts);
      if (day !== lastDay) { html += `<div class="com-day-div">${day}</div>`; lastDay=day; lastFrom=''; }
      const me = m.from === myEmail;
      const showName = !me && m.from !== lastFrom;
      lastFrom = m.from;
      const senderLabel = showName ? `<div class="com-msg-sender">${esc(m.senderName||m.from.split('@')[0])}</div>` : '';

      let bubble = '';
      if (m.fileData) {
        const isImg = m.fileType && m.fileType.startsWith('image/');
        const sz = m.fileSize < 1024 ? m.fileSize+' B' : m.fileSize < 1048576 ? (m.fileSize/1024).toFixed(1)+' KB' : m.fileSize < 1073741824 ? (m.fileSize/1048576).toFixed(1)+' MB' : (m.fileSize/1073741824).toFixed(2)+' GB';
        if (isImg) {
          bubble = `${senderLabel}<img class="com-file-img-preview" src="${m.fileData}" alt="${esc(m.fileName)}" onclick="window.open('${m.fileData}','_blank')"/><div class="com-msg-ts">${esc(m.fileName)} · ${sz} · ${fmtTime(m.ts)}</div>`;
        } else {
          bubble = `${senderLabel}<div class="com-file-msg"><div class="com-file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="13,2 13,9 20,9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><div class="com-file-info"><div class="com-file-name">${esc(m.fileName)}</div><div class="com-file-size">${sz}</div><a class="com-file-dl" href="${m.fileData}" download="${esc(m.fileName)}">Download</a></div></div><div class="com-msg-ts">${fmtTime(m.ts)}</div>`;
        }
      } else {
        const replyQuoteG = m.replyTo
          ? `<div class="com-msg-reply-quote">${esc((m.replyTo.text||'').slice(0,80)||'(file)')}</div>`
          : '';
        bubble = `${senderLabel}<div class="com-msg-bubble">${replyQuoteG}${esc(m.text)}</div><div class="com-msg-ts">${fmtTime(m.ts)}</div>`;
      }

      let seenHtml = '';
      if (me && i === lastMyIdx) {
        const seenNames = Object.entries(allMembers)
          .filter(([mKey, mData]) => mData.email !== myEmail && (seenMap[mKey]||0) >= m.ts)
          .map(([, mData]) => mData.name ? mData.name.split(' ')[0] : mData.email.split('@')[0]);
        const otherCount = Object.values(allMembers).filter(md => md.email !== myEmail).length;
        const wasSeen = seenNames.length > 0;
        const label = wasSeen
          ? (seenNames.length === otherCount ? 'Seen by everyone'
            : seenNames.length === 1 ? `Seen by ${seenNames[0]}`
            : `Seen by ${seenNames.length}`)
          : 'Delivered';
        seenHtml = `<div class="com-msg-seen${wasSeen?' seen':''}">${doubleTick}<span class="seen-label">${label}</span></div>`;
      }
      html += `<div class="com-msg ${me?'mine':'theirs'}"><div class="com-msg-wrap"><div class="com-msg-content">${bubble}${seenHtml}</div></div></div>`;
    });

    const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 60;
    area.innerHTML = html;
    if (wasAtBottom) area.scrollTop = area.scrollHeight;
  }

  // ── Send message ──
  window.comSendMsg = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_activeChat || !_db) return;
    const inp = $id('comMsgInput');
    const text = (inp?.value||'').trim();
    if (!text) return;
    inp.value = '';
    const cKey = chatKey(myEmail, _activeChat);
    const ts = Date.now();
    // Build payload — attach reply quote if active
    const payload = { from: myEmail, text, ts };
    if (window._tsReplyTo) {
      payload.replyTo = { key: window._tsReplyTo.key || '', from: window._tsReplyTo.from || '', text: (window._tsReplyTo.text || '').slice(0, 100) };
      window.tsCancelReply();
    }
    try {
      await _db.ref(`aulert/messages/${cKey}`).push(payload);
      // Increment friend's unread counter
      _db.ref(`aulert/friends/${encKey(_activeChat)}/${encKey(myEmail)}/unread`).transaction(n=>(n||0)+1);
    } catch(e) { comToast('Failed to send: ' + e.message); }
  };

  // ── Send current (DM or group, called from HTML) ──
  window.comSendCurrent = function() {
    if (_activeGroup) comSendGroupMsg();
    else comSendMsg();
  };
  window.comAttachFile = async function(input) {
    const myEmail = S.user?.email;
    if (!myEmail || (!_activeChat && !_activeGroup) || !_db) return;
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';

    const MAX = 1024 * 1024 * 1024;
    if (file.size > MAX) { comToast('File too large (max 1 GB)'); return; }
    comToast('Uploading…');

    const reader = new FileReader();
    reader.onload = async function(e) {
      const dataUrl = e.target.result;
      const ts = Date.now();
      const payload = { from:myEmail, fileData:dataUrl, fileName:file.name, fileSize:file.size, fileType:file.type, ts };
      try {
        if (_activeGroup) {
          const g = _groups[_activeGroup] || {};
          payload.senderName = S.user?.name||'';
          if (window._tsReplyTo) {
            payload.replyTo = { key: window._tsReplyTo.key||'', from: window._tsReplyTo.from||'', text: (window._tsReplyTo.text||'').slice(0,100) };
            window.tsCancelReply();
          }
          await _db.ref(`aulert/groups/${_activeGroup}/messages`).push(payload);
          Object.keys(g.members||{}).forEach(mKey => {
            if (mKey !== encKey(myEmail)) _db.ref(`aulert/userGroups/${mKey}/${_activeGroup}/unread`).transaction(n=>(n||0)+1);
          });
        } else {
          const cKey = chatKey(myEmail, _activeChat);
          await _db.ref(`aulert/messages/${cKey}`).push(payload);
          _db.ref(`aulert/friends/${encKey(_activeChat)}/${encKey(myEmail)}/unread`).transaction(n=>(n||0)+1);
        }
        comToast('File sent ✓');
      } catch(err) { comToast('Failed to send file: ' + err.message); }
    };
    reader.onerror = () => comToast('Failed to read file');
    reader.readAsDataURL(file);
  };

  // ── Render messages ──
  function renderMessages(msgs, myEmail) {
    const area = $id('comMsgs');
    if (!area) return;
    window._tsMsgStore = msgs; // expose for context menu
    if (!msgs.length) {
      area.innerHTML='<div class="com-no-msgs"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p>No messages yet. Say hi! 👋</p></div>';
      return;
    }

    // Find index of the last message I sent
    let lastMyIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].from === myEmail) { lastMyIdx = i; break; }
    }

    const doubleTick = `<svg width="13" height="9" viewBox="0 0 18 12" fill="none"><path d="M1 6l4 4L14 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    let html='', lastDay='';
    msgs.forEach((m, i) => {
      const day = fmtDay(m.ts);
      if (day !== lastDay) { html += `<div class="com-day-div">${day}</div>`; lastDay = day; }
      const me = m.from === myEmail;

      let bubble = '';
      if (m.fileData) {
        const isImg = m.fileType && m.fileType.startsWith('image/');
        const sz = m.fileSize < 1024 ? m.fileSize+' B' : m.fileSize < 1048576 ? (m.fileSize/1024).toFixed(1)+' KB' : m.fileSize < 1073741824 ? (m.fileSize/1048576).toFixed(1)+' MB' : (m.fileSize/1073741824).toFixed(2)+' GB';
        if (isImg) {
          bubble = `<img class="com-file-img-preview" src="${m.fileData}" alt="${esc(m.fileName)}" onclick="window.open('${m.fileData}','_blank')"/><div class="com-msg-ts">${esc(m.fileName)} · ${sz} · ${fmtTime(m.ts)}</div>`;
        } else {
          bubble = `<div class="com-file-msg"><div class="com-file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,2 13,9 20,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="com-file-info"><div class="com-file-name">${esc(m.fileName)}</div><div class="com-file-size">${sz}</div><a class="com-file-dl" href="${m.fileData}" download="${esc(m.fileName)}">Download</a></div></div><div class="com-msg-ts">${fmtTime(m.ts)}</div>`;
        }
      } else {
        const replyQuote = m.replyTo
          ? `<div class="com-msg-reply-quote">${esc((m.replyTo.text||'').slice(0,80)||'(file)')}</div>`
          : '';
        bubble = `<div class="com-msg-bubble">${replyQuote}${esc(m.text)}</div><div class="com-msg-ts">${fmtTime(m.ts)}</div>`;
      }

      // Seen receipt — only on the last message I sent
      let seenHtml = '';
      if (me && i === lastMyIdx) {
        const wasSeen = _seenByFriend && _seenByFriend >= m.ts;
        const seenLabel = wasSeen ? fmtSeenAgo(_seenByFriend) : '';
        seenHtml = `<div class="com-msg-seen${wasSeen?' seen':''}">
          ${doubleTick}
          <span class="seen-label">${wasSeen ? seenLabel : 'Delivered'}</span>
        </div>`;
      }

      html += `<div class="com-msg ${me?'mine':'theirs'}"><div class="com-msg-wrap"><div class="com-msg-content">${bubble}${seenHtml}</div></div></div>`;
    });

    const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 60;
    area.innerHTML = html;
    if (wasAtBottom) area.scrollTop = area.scrollHeight;
  }

  // Register comRender alias (called by goTab)
  window.comRender = window.comInit;

  // ── Check for ?join= invite code in URL ──
  (function() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (!code) return;
    // Show join banner after a short delay (so the app has time to init)
    function tryShowBanner() {
      // On app.html we're always in the app — just check if user is loaded
      if (!S?.user?.email && sessionStorage.getItem('aul_token')) {
        setTimeout(tryShowBanner, 300); return;
      }
      // Need to be signed in
      const myEmail = S?.user?.email;
      if (!myEmail) {
        // Prompt sign in first, then re-show after
        const banner = document.createElement('div');
        banner.className = 'com-join-banner';
        banner.innerHTML = `<h3>Join a Group</h3><p>Sign in with Google first to join this group chat.</p><div class="com-join-banner-btns"><button class="com-join-accept" onclick="openLoginModal();this.closest('.com-join-banner').remove()">Sign In</button><button class="com-join-decline" onclick="window.history.replaceState({},'',location.pathname);this.closest('.com-join-banner').remove()">Dismiss</button></div>`;
        document.body.appendChild(banner);
        return;
      }
      // Show banner asking user to join
      if (!_db) { setTimeout(tryShowBanner, 400); return; }
      _db.ref(`aulert/invites/${code}`).once('value').then(snap => {
        const gid = snap.val();
        if (!gid) return;
        return _db.ref(`aulert/groups/${gid}`).once('value');
      }).then(gSnap => {
        if (!gSnap || !gSnap.val()) return;
        const g = gSnap.val();
        const banner = document.createElement('div');
        banner.className = 'com-join-banner';
        banner.innerHTML = `<h3>You're invited!</h3><p>Join <span class="join-group-nm">${g.name||'a group'}</span> — chat with anyone who has the link, no friend request needed.</p><div class="com-join-banner-btns"><button class="com-join-accept" onclick="comJoinGroup('${code}');this.closest('.com-join-banner').remove()">Join Group</button><button class="com-join-decline" onclick="window.history.replaceState({},'',location.pathname);this.closest('.com-join-banner').remove()">Not now</button></div>`;
        document.body.appendChild(banner);
      }).catch(()=>{});
    }
    setTimeout(tryShowBanner, 800);
  })();

})();



// ════════════════════════════════════════════════════════════
//  TRUST & SAFETY — Block, Report, Reply, Rate Limiting
// ════════════════════════════════════════════════════════════
(function() {

  // ── Message data store — avoids JSON.stringify in onclick attrs ──
  window._tsMsgStore = [];   // populated by renderMessages each render
  window._tsActiveMsgIdx = null;

  // ── Helpers ──────────────────────────────────────────────
  function $id(id) { return document.getElementById(id); }

  function tsShowBanner(msg, ms) {
    const b = $id('tsRateBanner'), t = $id('tsRateBannerText');
    if (!b || !t) return;
    t.textContent = msg;
    b.classList.add('show');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('show'), ms || 3500);
  }

  // Close context menu on outside click
  document.addEventListener('click', function(e) {
    const menu = $id('tsMsgCtxMenu');
    if (menu && !menu.contains(e.target) && !e.target.closest('.ts-rpt-btn')) {
      menu.classList.remove('open');
    }
  });

  // ── Context menu ─────────────────────────────────────────
  window.tsMsgMenu = function(btn, idx) {
    const menu = $id('tsMsgCtxMenu');
    if (!menu) return;
    window._tsActiveMsgIdx = idx;
    // Position near the button
    const rect = btn.getBoundingClientRect();
    const menuW = 160, menuH = 90;
    let top  = rect.bottom + 6;
    let left = rect.left;
    if (left + menuW > window.innerWidth - 10)  left = window.innerWidth - menuW - 10;
    if (top + menuH  > window.innerHeight - 10) top  = rect.top - menuH - 6;
    menu.style.top  = top  + 'px';
    menu.style.left = left + 'px';
    menu.classList.toggle('open');
  };

  window.tsCtxReply = function() {
    const menu = $id('tsMsgCtxMenu');
    if (menu) menu.classList.remove('open');
    const idx = window._tsActiveMsgIdx;
    if (idx == null || !window._tsMsgStore[idx]) return;
    const msg = window._tsMsgStore[idx];
    // Show reply bar
    const bar  = $id('comReplyBar');
    const text = $id('comReplyBarText');
    if (!bar || !text) return;
    const preview = msg.text
      ? (msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text)
      : '(file)';
    text.textContent = preview;
    bar.style.display = 'flex';
    window._tsReplyTo = { key: msg._key, from: msg.from, text: msg.text || '' };
    // Focus input
    const inp = $id('comMsgInput');
    if (inp) inp.focus();
  };

  window.tsCancelReply = function() {
    const bar = $id('comReplyBar');
    if (bar) bar.style.display = 'none';
    window._tsReplyTo = null;
  };

  window.tsCtxReport = function() {
    const menu = $id('tsMsgCtxMenu');
    if (menu) menu.classList.remove('open');
    const idx = window._tsActiveMsgIdx;
    if (idx == null || !window._tsMsgStore[idx]) return;
    const msg = window._tsMsgStore[idx];
    window.tsOpenReport(msg._key || '', msg.text || '', msg.from || '');
  };

  // ── Block / Unblock ──────────────────────────────────────
  window._updateBlockBtn = function(email) {
    const btn = $id('comBlockBtn'), lbl = $id('comBlockBtnLabel');
    if (!btn || !lbl) return;
    const blocked = window._isBlocked(email);
    lbl.textContent = blocked ? 'Unblock' : 'Block';
    btn.classList.toggle('is-blocked', blocked);
  };

  window._isBlocked = function(email) {
    return !!(window._aulertBlocks && window._aulertBlocks[email]);
  };

  window.comToggleBlock = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !window._activeChatEmail || !window._aulertDb) return;
    const targetEmail = window._activeChatEmail;
    const enc = e => e.toLowerCase().replace(/\./g,',').replace(/@/g,'__at__');
    const myKey = enc(myEmail), theirKey = enc(targetEmail);
    const isBlocked = window._isBlocked(targetEmail);
    try {
      if (isBlocked) {
        await window._aulertDb.ref(`aulert/blocks/${myKey}/${theirKey}`).remove();
        tsShowBanner(targetEmail.split('@')[0] + ' unblocked', 2500);
      } else {
        await window._aulertDb.ref(`aulert/blocks/${myKey}/${theirKey}`).set({ email: targetEmail, ts: Date.now() });
        await window._aulertDb.ref(`aulert/friends/${myKey}/${theirKey}`).remove();
        await window._aulertDb.ref(`aulert/friends/${theirKey}/${myKey}`).remove();
        tsShowBanner(targetEmail.split('@')[0] + ' blocked', 2500);
      }
    } catch(e) {
      tsShowBanner('Error — please try again', 2500);
    }
  };

  // ── Report Modal ─────────────────────────────────────────
  let _tsSelectedReason = null;

  window.tsOpenReport = function(msgKey, text, fromEmail) {
    window._tsReportData = { msgKey, text, fromEmail };
    _tsSelectedReason = null;
    document.querySelectorAll('.ts-reason-opt').forEach(b => b.classList.remove('selected'));
    const sbtn = $id('tsSubmitReportBtn');
    if (sbtn) sbtn.disabled = true;
    const prev = $id('tsReportPreview');
    if (prev) prev.textContent = text ? '\u201c' + text + '\u201d' : '(file or media)';
    const overlay = $id('tsReportOverlay');
    if (overlay) overlay.classList.add('open');
  };

  window.tsCloseReport = function() {
    const overlay = $id('tsReportOverlay');
    if (overlay) overlay.classList.remove('open');
  };

  window.tsSelectReason = function(btn) {
    document.querySelectorAll('.ts-reason-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    _tsSelectedReason = btn.dataset.reason;
    const sbtn = $id('tsSubmitReportBtn');
    if (sbtn) sbtn.disabled = false;
  };

  window.tsSubmitReport = async function() {
    const myEmail = S.user?.email;
    if (!myEmail || !_tsSelectedReason || !window._aulertDb) return;
    const { msgKey, text, fromEmail } = window._tsReportData || {};
    const sbtn = $id('tsSubmitReportBtn');
    if (sbtn) { sbtn.disabled = true; sbtn.textContent = 'Submitting\u2026'; }
    try {
      await window._aulertDb.ref('aulert/reports').push({
        reporter: myEmail, reported: fromEmail || '',
        messageKey: msgKey || '', messageText: text || '',
        reason: _tsSelectedReason, ts: Date.now(), status: 'pending',
        context: window._activeChatEmail
          ? 'dm:' + window._activeChatEmail
          : (window._activeGroupId ? 'group:' + window._activeGroupId : 'unknown')
      });
      window.tsCloseReport();
      tsShowBanner('Report submitted \u2014 thank you', 3000);
    } catch(e) {
      if (sbtn) { sbtn.disabled = false; sbtn.textContent = 'Submit Report'; }
      tsShowBanner('Failed to submit \u2014 please try again', 3000);
    }
  };

  // ── Rate Limiting (feedback only) ────────────────────────
  window.tsCheckFeedbackRateLimit = async function(email) {
    if (!window._aulertDb || !email) return false;
    const key = email.toLowerCase().replace(/\./g,',').replace(/@/g,'__at__');
    const ref = window._aulertDb.ref('aulert/ratelimit/' + key + '/feedback');
    const LIMIT = 3, WINDOW_MS = 24 * 60 * 60 * 1000, now = Date.now();
    try {
      let blocked = false;
      await ref.transaction(data => {
        if (!data || (now - (data.windowStart || 0)) > WINDOW_MS) return { count: 1, windowStart: now };
        if (data.count >= LIMIT) { blocked = true; return; }
        return { ...data, count: data.count + 1 };
      });
      if (blocked) {
        const snap = await ref.once('value');
        const d = snap.val() || {};
        const resetIn = Math.ceil((WINDOW_MS - (now - (d.windowStart || now))) / 3600000);
        tsShowBanner('Daily feedback limit reached \u2014 resets in ~' + resetIn + 'h', 5000);
        return true;
      }
      return false;
    } catch(e) { return false; }
  };

})();
