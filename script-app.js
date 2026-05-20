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
const COURSE_COLORS  = ['var(--teal)', 'var(--violet)', 'var(--amber)', 'var(--rose)', 'var(--sky)', 'var(--green)', 'var(--orange)', 'var(--pink)', 'var(--emerald)', 'var(--gamemaster)'];
const TYPE_META      = {
  announcement: { label:'Announcement', color:'var(--teal)' },
  assignment:   { label:'Assignment',   color:'var(--violet)' },
  material:     { label:'Material',     color:'var(--rose)' },
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

const courseById = id => S.courses.find(c => c.id === id) || { color:'var(--violet)', name:'Unknown', abbr:'?', section:'' };


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
    if (p) { p.style.color='var(--rose)'; p.textContent='Please set your Google OAuth Client ID in the CONFIG at the top of the script.'; }
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
    document.getElementById('hwSubject').style.borderColor = 'var(--rose)';
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
      } else if (diffDays <= 5) {
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
    const statusColor = t.done ? 'var(--emerald)' : '#6b7280';
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
    .badge .done-b { background: #dcfce7; color: var(--emerald); }
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
  <div class="footer">Exported from Aulert</div>
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
    feed.innerHTML = `<div class="empty-s"><svg class="icon-teal" width="42" height="42" viewBox="0 0 24 24" fill="none" style="opacity:.2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="var(--gamemaster)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>Nothing here</h3><p>No notifications match this filter.<br>Try clearing filters/search to see everything.</p></div>`;
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
      const color = dl._hwTask ? 'var(--gamemaster)' : courseById(dl.courseId).color;
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
      const urg = diff < 0 ? 'urg' : diff <= 1 ? 'urg' : diff <= 5 ? 'soo' : 'ok';
      const urgLabel = diff < 0 ? 'Overdue' : diff <= 1 ? 'Urgent' : diff <= 5 ? 'Soon' : 'On track';
      return `<div class="dl-row"><div class="dl-stripe" style="background:var(--gamemaster)"></div><div class="dl-info"><div class="dl-t">${dl.title}</div><div class="dl-c" style="color:var(--gamemaster);opacity:.8">Homework</div></div><div class="dl-meta"><span class="dl-date">${ds} · ${when}</span><span class="dl-badge ${urg}">${urgLabel}</span></div></div>`;
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
  <div class="cls-swatch" style="background:${c.color}; color:var(--invertext)">${c.abbr}</div>
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
    if(charging || level > 0.5) color = 'var(--green)';   // green
    else if(level > 0.2)        color = 'var(--amber)';   // amber
    else                        color = 'var(--rose)';    // red

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

// Community module removed. No community chat or Firebase social features are loaded in this build.
window.comInit = window.comRender = function() {};


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
});
