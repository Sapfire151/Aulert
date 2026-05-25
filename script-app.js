/* ════════════════════════════════════════════
   AULERT - CORE APPLICATION MODULE
   ─────────────────────────────────────────────
   Orchestrator that coordinates all tabs and modules
   The actual module implementations are in:
   - script-app-feed.js
   - script-app-calendar.js
   - script-app-homework.js
   - script-app-settings.js
   - script-app-feedback.js
════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   CONFIGURATION
═════════════════════════════════════════════════════ */
const CLIENT_ID = '464032446404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const POLL_MS        = 1 * 60 * 1000;
const COURSE_COLORS  = ['var(--teal)', 'var(--violet)', 'var(--amber)', 'var(--rose)', 'var(--sky)', 'var(--green)', 'var(--orange)', 'var(--pink)', 'var(--emerald)', 'var(--gamemaster)'];
const TYPE_META      = {
  announcement: { label:'Announcement', color:'var(--teal)' },
  assignment:   { label:'Assignment',   color:'var(--violet)' },
  material:     { label:'Material',     color:'var(--rose)' },
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ════════════════════════════════════════════
   GLOBAL STATE
════════════════════════════════════════════ */
const _now = new Date();
let S = {
  filter: 'all',
  courseFilter: 'all',
  searchTerm: '',
  page: 1,
  calYear: _now.getFullYear(), calMonth: _now.getMonth(),
  openId: null, toastTimer: null, snackTimer: null, pollTimer: null, countdownTimer: null, nextPoll: 0,
  token: null,
  user: null,
  courses: [],
  notifs: [],
  deadlines: [],
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

/* ════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════ */

async function loadTabs() {
  const tabs = ['feed', 'cal', 'hw', 'set', 'fbk'];
  const appBody = document.getElementById('appBody');
  if (!appBody) return;
  for (const tab of tabs) {
    try {
      const res = await fetch(`tab-${tab}.html`);
      const html = await res.text();
      appBody.insertAdjacentHTML('beforeend', html);
    } catch (e) {
      console.error('Failed to load tab:', tab, e);
    }
  }
}

window.addEventListener('load', async () => {
  const saved = sessionStorage.getItem('aul_token');
  if (saved) {
    S.token = saved;
    // await loadTabs(); // Removed to prevent duplicating hardcoded tabs
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

function showLoadingApp() { showLoadingState(); }
function hideLoadingApp() { window.location.href = 'index.html'; }

/* ════════════════════════════════════════════
   API & DATA HELPERS
════════════════════════════════════════════ */

async function classroomApi(path) {
  if (S.token === 'preview_bypass') {
    if (path.startsWith('courses?')) {
      return {
        courses: [
          { id: '1', name: 'Preview Course 1', section: 'Morning', alternateLink: '#' },
          { id: '2', name: 'Preview Course 2', section: 'Afternoon', alternateLink: '#' }
        ]
      };
    } else if (path.includes('/announcements?')) {
      return {
        announcements: [
          { id: 'a1', text: 'Welcome to Preview Mode!', creationTime: new Date().toISOString(), alternateLink: '#' }
        ]
      };
    } else if (path.includes('/courseWork?')) {
      return {
        courseWork: [
          { id: 'cw1', title: 'Preview Assignment', description: 'This is a mock assignment.', creationTime: new Date().toISOString(), updateTime: new Date().toISOString(), alternateLink: '#', state: 'PUBLISHED' }
        ]
      };
    } else if (path.includes('/courseWorkMaterials?')) {
      return { courseWorkMaterial: [] };
    } else if (path.includes('/studentSubmissions?')) {
      return { 
        studentSubmissions: [
          { id: 'sub1', courseWorkId: 'cw1', state: 'CREATED' }
        ] 
      };
    }
    return {};
  }

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
  if (S.token === 'preview_bypass') {
    return { id: 'preview-id', name: 'Preview User', email: 'preview@example.com' };
  }
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
  const submissionIds = {};
  if (subs.status === 'fulfilled' && subs.value.studentSubmissions) {
    subs.value.studentSubmissions.forEach(s => {
      if (s.state === 'TURNED_IN' || s.state === 'RETURNED') turnedInIds.add(s.courseWorkId);
      submissionIds[s.courseWorkId] = s.id;
    });
  }

  if (ann.status === 'fulfilled') {
    (ann.value.announcements || []).forEach(a => {
      const firstLine = (a.text || '').split('\r\n').find(l => l.trim()) || 'New Announcement';
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
      if (turnedInIds.has(w.id)) return;
      const obj = {
        id:           `cw-${w.id}`,
        type:         'assignment',
        courseId:     course.id,
        courseWorkId: w.id,
        submissionId: submissionIds[w.id],
        title:        w.title || 'New Assignment',
        body:         w.description || `Posted in ${course.name}`,
        createdAt:    w.creationTime,
        updatedAt:    w.updateTime || w.creationTime,
        time:         relTime(w.creationTime),
        read:         S.readIds.has(`cw-${w.id}`),
        link:         w.alternateLink || course.link,
        state:        w.state || '',
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
   LAUNCH & LIFECYCLE
════════════════════════════════════════════ */

const _authModal = document.getElementById('authModal');
if (_authModal) _authModal.addEventListener('click', e => {
  if (e.target === _authModal) _authModal.classList.remove('open');
});

function launchApp() {
  renderGreeting();
  renderAccount();
  renderFeed();
  renderClasses();
  renderCal();
  updatePip();
  renderSettings();
  startPolling();
  fetchAllContent(false);
  showToast('Connected!', `Monitoring ${S.courses.length} course${S.courses.length !== 1 ? 's' : ''}`);
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      S.settings.push = p === 'granted';
      saveSettings();
      if (p === 'granted') new Notification('Aulert', { body: 'Push notifications enabled! You\'ll get alerts for new classroom updates.' });
    });
  }
}

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

/* ════════════════════════════════════════════
   THEMING
════════════════════════════════════════════ */

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('aul_theme', next);
  updateThemeIcon(next);
}

function setThemeMode(mode) { toggleTheme(); }

function updateThemeIcon(mode) {
  const moonSvg = `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sunSvg  = `<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  ['themeIcon','navThemeIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = mode === 'dark' ? moonSvg : sunSvg;
  });
}

(function(){
  const saved = localStorage.getItem('aul_theme') || 'dark';
  const mode = (saved === 'custom') ? 'dark' : saved;
  document.documentElement.setAttribute('data-theme', mode);
  updateThemeIcon(mode);
})();

/* ════════════════════════════════════════════
   ANIMATIONS & UI
════════════════════════════════════════════ */

function iconPop(el) {
  if (!el) return;
  el.classList.remove('icon-pop');
  void el.offsetWidth;
  el.classList.add('icon-pop');
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
   TAB SYSTEM
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

function goTab(name) {
  ['feed','cal','hw','set','fbk','com'].forEach(t => {
    const panel = document.getElementById('p-'+t);
    const tab = document.getElementById('tb-'+t);
    if (panel) panel.classList.toggle('show', t === name);
    if (tab) tab.classList.toggle('on', t === name);
  });
  updateTabBadge(name, 0);
  if (name === 'cal') renderCal();
  if (name === 'set') renderSettings();
  if (name === 'hw') hwRender();
  if (name === 'com') comRender();
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

  const link = document.querySelector('.sa-primary');
  if (link) link.href = n.link || 'https://classroom.google.com';

  const submitBtn = document.getElementById('submitWorkBtn');
  if (submitBtn) {
    // Only show if it's an assignment and we have the necessary IDs
    if (n.type === 'assignment' && n.courseWorkId && n.submissionId) {
      submitBtn.style.display = 'flex';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="margin-right: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line></svg> Submit Work`;
    } else {
      submitBtn.style.display = 'none';
    }
  }

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
  if (e && e.target.closest('.sheet')) return;
  document.getElementById('sheetVeil').classList.remove('open');
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

/* ════════════════════════════════════════════
   UI EFFECTS
════════════════════════════════════════════ */

(function(){
  const bar = document.getElementById('scrollBar');
  if(!bar) return;
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (window.scrollY / total * 100) + '%';
  }, {passive:true});
})();

(function(){
  const el = document.getElementById('auroraFollower');
  if(!el) return;
  document.addEventListener('mousemove', e => {
    el.style.left = e.clientX + 'px';
    el.style.top  = e.clientY + 'px';
  }, {passive:true});
})();

(function(){
  function setCalDate() {
    const el = document.querySelector('#tb-cal .cal-num');
    if (el) el.textContent = new Date().getDate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setCalDate);
  else setCalDate();
})();

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

let _pendingFiles = [];

function showSubmitConfirm() {
  const modal = document.getElementById('submitUnifiedModal');
  // Reset state
  _pendingFiles = [];
  const dropZoneText = document.getElementById('dropZoneText');
  const fileList = document.getElementById('fileListContainer');
  const linkInput = document.getElementById('submitLinkInput');
  const submitBtn = document.getElementById('unifiedSubmitBtn');
  const dropZone = document.getElementById('dropZone');
  if (dropZoneText) dropZoneText.textContent = 'Click to browse or drag files here';
  if (fileList) fileList.innerHTML = '';
  if (linkInput) linkInput.value = '';
  if (submitBtn) { submitBtn.style.opacity = '0.5'; submitBtn.style.pointerEvents = 'none'; }
  if (dropZone) { dropZone.style.borderColor = 'var(--rim)'; dropZone.style.background = 'rgba(0,0,0,0.02)'; }

  // Show with animation
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      const content = modal.querySelector('.submit-modal-content');
      if (content) { content.style.transform = 'scale(1) translateY(0)'; content.style.opacity = '1'; }
    });
  });
}

function closeSubmitUnifiedModal() {
  const modal = document.getElementById('submitUnifiedModal');
  const content = modal.querySelector('.submit-modal-content');
  modal.style.opacity = '0';
  if (content) { content.style.transform = 'scale(0.9) translateY(20px)'; content.style.opacity = '0'; }
  setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function updateSubmitBtn() {
  const btn = document.getElementById('unifiedSubmitBtn');
  const linkInput = document.getElementById('submitLinkInput');
  const hasFiles = _pendingFiles.length > 0;
  const hasLink = linkInput && linkInput.value.trim().length > 0;
  if (hasFiles || hasLink) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  } else {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }
}

function handleLinkInput() {
  updateSubmitBtn();
}

// Handle file input from browse button (supports multiple)
function handleSubmissionUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  event.target.value = '';
  files.forEach(f => addPendingFile(f));
}

function addPendingFile(file) {
  if (_pendingFiles.some(f => f.name === file.name && f.size === file.size)) return;
  _pendingFiles.push(file);
  renderFileList();
  updateSubmitBtn();
}

function removePendingFile(index) {
  _pendingFiles.splice(index, 1);
  renderFileList();
  updateSubmitBtn();
  if (_pendingFiles.length === 0) {
    const dropZone = document.getElementById('dropZone');
    const dropZoneText = document.getElementById('dropZoneText');
    if (dropZone) { dropZone.style.borderColor = 'var(--rim)'; dropZone.style.background = 'rgba(0,0,0,0.02)'; }
    if (dropZoneText) dropZoneText.textContent = 'Click to browse or drag files here';
  }
}

function openPendingFile(index) {
  const file = _pendingFiles[index];
  if (!file) return;
  const url = URL.createObjectURL(file);
  window.open(url, '_blank');
}

function renderFileList() {
  const container = document.getElementById('fileListContainer');
  const dropZoneText = document.getElementById('dropZoneText');
  const dropZone = document.getElementById('dropZone');
  if (!container) return;

  if (_pendingFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  if (dropZoneText) dropZoneText.textContent = _pendingFiles.length + ' file' + (_pendingFiles.length > 1 ? 's' : '') + ' selected \u2014 click to add more';
  if (dropZone) {
    dropZone.style.borderColor = 'var(--teal)';
    dropZone.style.background = 'rgba(0,255,217,0.05)';
  }

  let html = '';
  for (let i = 0; i < _pendingFiles.length; i++) {
    const file = _pendingFiles[i];
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeStr = sizeKB > 1024 ? (file.size / 1048576).toFixed(1) + ' MB' : sizeKB + ' KB';
    html += '<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface-2); border-radius:10px; border:1px solid var(--rim);">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0; color:var(--teal);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="flex:1; min-width:0;">'
      + '<div style="font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;" onclick="openPendingFile(' + i + ')" title="Click to preview">' + file.name + '</div>'
      + '<div style="font-size:11px; color:var(--text-3);">' + sizeStr + '</div>'
      + '</div>'
      + '<button onclick="openPendingFile(' + i + ')" title="Open file" style="background:none; border:none; color:var(--text-3); cursor:pointer; padding:4px; display:flex; transition:color 0.15s;" onmouseover="this.style.color=\'var(--teal)\'" onmouseout="this.style.color=\'var(--text-3)\'">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15,3 21,3 21,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      + '</button>'
      + '<button onclick="removePendingFile(' + i + ')" title="Remove" style="background:none; border:none; color:var(--text-3); cursor:pointer; padding:4px; display:flex; transition:color 0.15s;" onmouseover="this.style.color=\'var(--rose)\'" onmouseout="this.style.color=\'var(--text-3)\'">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      + '</button>'
      + '</div>';
  }
  container.innerHTML = html;
}

// Drag & drop and paste setup (multiple files)
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    
    // Paste handler for screenshots
    document.addEventListener('paste', (e) => {
      const modal = document.getElementById('submitUnifiedModal');
      if (modal && modal.style.display !== 'none' && e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const d = new Date();
              const filename = `Pasted_Image_${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}${d.getSeconds().toString().padStart(2,'0')}.png`;
              const file = new File([blob], filename, { type: blob.type });
              addPendingFile(file);
            }
          }
        }
      }
    });

    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = 'var(--teal)';
      dropZone.style.background = 'rgba(0,255,217,0.08)';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (_pendingFiles.length === 0) {
        dropZone.style.borderColor = 'var(--rim)';
        dropZone.style.background = 'rgba(0,0,0,0.02)';
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      files.forEach(f => addPendingFile(f));
    });
  });
})();

async function processUnifiedSubmit() {
  const n = S.notifs.find(x => x.id === S.openId);
  if (!n || n.type !== 'assignment' || !n.courseWorkId || !n.submissionId) return;

  const linkInput = document.getElementById('submitLinkInput');
  const linkUrl = linkInput ? linkInput.value.trim() : '';
  const files = [..._pendingFiles];

  if (files.length === 0 && !linkUrl) return;

  const modalBtn = document.getElementById('unifiedSubmitBtn');
  const origModalHtml = modalBtn ? modalBtn.innerHTML : '';
  if (modalBtn) {
    modalBtn.innerHTML = 'Submitting\u2026';
    modalBtn.disabled = true;
    modalBtn.style.opacity = '0.7';
    modalBtn.style.pointerEvents = 'none';
  }

  const btn = document.getElementById('submitWorkBtn');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = 'Submitting\u2026';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  }

  try {
    if (S.token === 'preview_bypass') {
      await new Promise(r => setTimeout(r, 1500));
      const msg = files.length > 0
        ? 'Attached ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' successfully.'
        : 'Link attached successfully.';
      showToast('Assignment Submitted!', msg);
    } else {
      const attachments = [];

      // Upload all files to Drive
      for (const file of files) {
        const metadata = { name: file.name };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + S.token },
          body: form
        });
        const driveData = await driveRes.json();
        if (driveData.error) throw new Error(driveData.error.message);
        attachments.push({ driveFile: { id: driveData.id } });
      }

      // Add link if provided
      if (linkUrl) {
        attachments.push({ link: { url: linkUrl } });
      }

      // Attach all at once
      if (attachments.length > 0) {
        const attachRes = await fetch('https://classroom.googleapis.com/v1/courses/' + n.courseId + '/courseWork/' + n.courseWorkId + '/studentSubmissions/' + n.submissionId + ':modifyAttachments', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ addAttachments: attachments })
        });
        if (!attachRes.ok) {
          const errData = await attachRes.json().catch(() => ({}));
          throw new Error((errData.error && errData.error.message) || 'Failed to attach items');
        }
      }

      // Turn in
      const turnInRes = await fetch('https://classroom.googleapis.com/v1/courses/' + n.courseId + '/courseWork/' + n.courseWorkId + '/studentSubmissions/' + n.submissionId + ':turnIn', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + S.token }
      });
      if (!turnInRes.ok) {
        const errData = await turnInRes.json().catch(() => ({}));
        throw new Error((errData.error && errData.error.message) || 'Failed to turn in assignment');
      }

      const msg = files.length > 0
        ? 'Turned in ' + files.length + ' file' + (files.length > 1 ? 's' : '') + (linkUrl ? ' + link' : '') + ' successfully.'
        : 'Turned in link successfully.';
      showToast('Assignment Submitted!', msg);
    }

    _pendingFiles = [];
    closeSubmitUnifiedModal();
    loadEverything();
    closeSheet();

  } catch (err) {
    console.error('Submission failed:', err);
    showToast('Submission Failed', err.message);
    if (modalBtn) {
      modalBtn.innerHTML = origModalHtml;
      modalBtn.disabled = false;
      modalBtn.style.opacity = '1';
      modalBtn.style.pointerEvents = 'auto';
    }
    if (btn) {
      btn.innerHTML = origHtml;
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

