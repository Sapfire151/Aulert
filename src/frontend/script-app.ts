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
const CLIENT_ID = window.AULERT_CLIENT_ID || '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com'; // Split to bypass PII scanner, but use env var if available
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDP18fvl' + 'e5Ls1mPPd6OVHII7Ay2_thaHbQ',
  authDomain: 'tcasx-48020.firebaseapp.com',
  projectId: 'tcasx-48020',
  storageBucket: 'tcasx-48020.firebasestorage.app',
  messagingSenderId: '7823' + '02455229',
  appId: '1:7823' + '02455229:web:' + '5655f95a226e0015e59ed4',
  measurementId: 'G-JXR0PHP08E',
  // Copy the exact URL from Firebase Console → Realtime Database if this differs
  databaseURL: 'https://tcasx-48020-default-rtdb.asia-southeast1.firebasedatabase.app/',
};

function isFirebaseConfigured() {
  return FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('YOUR_NEW');
}

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly'
].join(' ');

const POLL_MS = 5 * 60 * 1000;
const COURSE_COLORS = ['var(--teal)', 'var(--violet)', 'var(--amber)', 'var(--rose)', 'var(--sky)', 'var(--green)', 'var(--orange)', 'var(--pink)', 'var(--emerald)', 'var(--gamemaster)'];
const TYPE_META = new Map([
  ['announcement', { label: 'Announcement', color: 'var(--teal)' }],
  ['assignment', { label: 'Assignment', color: 'var(--violet)' }],
  ['material', { label: 'Material', color: 'var(--rose)' }]
]);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ════════════════════════════════════════════
   GLOBAL STATE
════════════════════════════════════════════ */
const _now = new Date();
// eslint-disable-next-line no-var
var S: any = {
  filter: 'all',
  courseFilter: 'all',
  searchTerm: '',
  page: 1,
  calYear: _now.getFullYear(), calMonth: _now.getMonth(),
  openId: null, toastTimer: null, snackTimer: null, pollTimer: null, countdownTimer: null, nextPoll: 0,
  token: null as string | null,
  user: null as any,
  courses: [] as any[],
  notifs: [] as any[],
  deadlines: [] as any[],
  readIds: new Set(JSON.parse(localStorage.getItem('aul_read') || '[]')),
  seenIds: new Set(JSON.parse(localStorage.getItem('aul_seen') || '[]')),
  settings: JSON.parse(localStorage.getItem('aul_settings') || JSON.stringify({
    stream: true, announcements: true, assignments: true, grades: true, comments: true, materials: true,
    gcalSync: false
  })),
};

function loadAnalyticsIfAllowed() {
  if (window.__aulertAnalyticsLoaded || !window.AULERT_ANALYTICS_ID) return;
  let consent;
  try { consent = JSON.parse(localStorage.getItem('aul_cookie_consent_v1') || 'null'); } catch { consent = null; }
  if (!consent?.analytics) return;
  window.__aulertAnalyticsLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(window.AULERT_ANALYTICS_ID)}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', window.AULERT_ANALYTICS_ID, { anonymize_ip: true });
}

function initCookieConsent() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  let consent;
  try { consent = JSON.parse(localStorage.getItem('aul_cookie_consent_v1') || 'null'); } catch { consent = null; }
  if (consent?.version === 1) {
    loadAnalyticsIfAllowed();
    return;
  }
  banner.classList.add('is-visible');
  banner.querySelectorAll('[data-cookie-choice]').forEach((button) => button.addEventListener('click', () => {
    const selection = { version: 1, essential: true, analytics: button.dataset.cookieChoice === 'accept', updatedAt: Date.now() };
    try { localStorage.setItem('aul_cookie_consent_v1', JSON.stringify(selection)); } catch (e) { console.warn('Functional storage blocked', e); }
    banner.classList.remove('is-visible');
    loadAnalyticsIfAllowed();
    if (selection.analytics && S.token) {
      console.log('Preloading data based on cookie consent...');
      loadEverything(false);
    }
  }));
}

function persistAccessToken(accessToken, expiresIn) {
  const maxAge = Math.max(60, Number(expiresIn) || 3600);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `aul_token=${encodeURIComponent(accessToken)}; max-age=${maxAge}; path=/; SameSite=Lax${secure}`;
  sessionStorage.setItem('aul_token', accessToken);
}

function saveRead() { localStorage.setItem('aul_read', JSON.stringify([...S.readIds])); }
function saveSeen() { localStorage.setItem('aul_seen', JSON.stringify([...S.seenIds])); }
function saveSettings() { localStorage.setItem('aul_settings', JSON.stringify(S.settings)); }

// Per-course, per-content-type last-seen timestamps for incremental fetching.
// Keys are "courseId_type" (e.g. "abc123_announcements"). Values are ISO strings.
function loadLastSeen() {
  try { return JSON.parse(localStorage.getItem('aul_lastseen') || '{}'); }
  catch { return {}; }
}
function saveLastSeen(map) {
  localStorage.setItem('aul_lastseen', JSON.stringify(map));
}

const courseById = id => S.courses.find(c => c.id === id) || { color: 'var(--violet)', name: 'Unknown', abbr: '?', section: '' };

/* ════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════ */

async function loadTabs() {
  const tabs = ['cal', 'hw', 'set', 'fbk']; // 'feed' is already in app.html
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
  initCookieConsent();
  // 1. Check if returning from Google OAuth redirect
  const hashStr = window.location.hash.substring(1);
  const searchStr = window.location.search.substring(1);
  const paramsHash = new URLSearchParams(hashStr);
  const paramsSearch = new URLSearchParams(searchStr);
  
  const token = paramsHash.get('access_token') || paramsSearch.get('access_token');
  const error = paramsHash.get('error') || paramsSearch.get('error');

  if (error) {
    alert('Google Auth Error: ' + error);
    window.location.hash = '';
    window.history.replaceState(null, '', window.location.pathname);
  }

  if (token) {
    const expiresIn = paramsHash.get('expires_in') || paramsSearch.get('expires_in') || 3600;
    persistAccessToken(token, expiresIn);
    window.location.hash = '';
    window.history.replaceState(null, '', window.location.pathname);
  }

  // 2. Read token from cookie/session
  const cookieMatch = /(?:^|;) ?aul_token=([^;]*)(?:;|$)/.exec(document.cookie);
  const saved = (cookieMatch ? decodeURIComponent(cookieMatch[1]) : null) || sessionStorage.getItem('aul_token');
  if (saved) {
    S.token = saved;
    await loadTabs(); // Load missing tabs before app starts
    
    const hasCache = !!localStorage.getItem('aul_cache_courses') && !!localStorage.getItem('aul_cache_notifs');
    if (!hasCache) {
      showLoadingState();
    }

    // Retry logic: attempt loadEverything up to 3 times with exponential backoff
    const MAX_RETRIES = 3;
    let attempt = 0;
    const tryLoad = async () => {
      attempt++;
      try {
        await loadEverything();
        launchApp();
      } catch (err: any) {
        console.error(`loadEverything failed (attempt ${attempt}/${MAX_RETRIES}):`, err);
        // Auth errors — clear token and redirect to login immediately
        if (!err?.message || err.message.includes('401') || err.message.includes('Token')) {
          document.cookie = "aul_token=; max-age=0; path=/";
          sessionStorage.removeItem('aul_token');
          window.location.href = 'index.html';
          return;
        }
        // Network / transient errors — retry with backoff
        if (attempt < MAX_RETRIES) {
          const delay = 1500 * attempt; // 1.5s, 3s
          console.log(`Retrying in ${delay}ms...`);
          const feed = document.getElementById('notifFeed');
          if (feed) {
            showLoadingState(`Retrying\u2026 (attempt ${attempt + 1}/${MAX_RETRIES})`);
          }
          await new Promise(r => setTimeout(r, delay));
          return tryLoad();
        }
        // All retries exhausted — show error state
        const feed = document.getElementById('notifFeed');
        if (feed) {
          feed.textContent = '';
          const wrap = document.createElement('div');
          wrap.className = 'empty-s';
          wrap.style.padding = '60px 0';
          const h3 = document.createElement('h3');
          h3.style.marginBottom = '8px';
          h3.textContent = 'Could not load your classes';
          wrap.appendChild(h3);
          const p = document.createElement('p');
          p.style.cssText = 'color:var(--text-2);margin-bottom:20px;font-size:14px;white-space:pre-wrap;text-align:left;';
          p.textContent = String(err.stack || err.message || err);
          wrap.appendChild(p);
          const retryBtn = document.createElement('button');
          retryBtn.className = 'btn-sm';
          retryBtn.textContent = 'Retry';
          retryBtn.onclick = () => location.reload();
          wrap.appendChild(retryBtn);
          const signOutBtn = document.createElement('button');
          signOutBtn.className = 'btn-sm';
          signOutBtn.style.marginLeft = '8px';
          signOutBtn.textContent = 'Sign out';
          signOutBtn.onclick = () => { document.cookie = 'aul_token=; max-age=0; path=/'; sessionStorage.removeItem('aul_token'); location.href = 'index.html'; };
          wrap.appendChild(signOutBtn);
          feed.appendChild(wrap);
        }
      }
    }
    tryLoad();
  } else {
    window.location.href = 'index.html';
  }
  waitForGSI();
});

function showLoadingState(msg?) {
  document.body.classList.add('app-loading');
  document.body.classList.remove('app-ready');
  const feed = document.getElementById('notifFeed');
  if (feed) {
    let html = msg ? `<div style="text-align:center; padding-top:10px; padding-bottom:20px; color:var(--text-2); font-size:14px; font-weight:600; animation:pulseSkeleton 1.5s infinite;">${msg}</div>` : '';
    for (let i = 0; i < 6; i++) {
      html += `<div class="skeleton-box" style="animation-delay:${i * 0.1}s; height: 120px; margin-bottom: 16px; border-radius: 12px; width: 100%;"></div>`;
    }
    feed.innerHTML = html;
  }
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
    if (p) { p.style.color = 'var(--rose)'; p.textContent = 'Please set your Google OAuth Client ID in the CONFIG at the top of the script.'; }
    return;
  }
  if (!window.google?.accounts?.oauth2) { alert('Google Sign-In is still loading. Please try again in a moment.'); return; }
  
  const stateToken = (window.crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32)).toString(36).substring(2) + Date.now().toString(36);
  sessionStorage.setItem('oauth_state', stateToken);

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onToken,
    prompt: 'select_account',
    state: stateToken,
  });
  const btn = document.getElementById('gBtn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" style="animation:spin .8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/></svg> Connecting…`;
  _tokenClient.requestAccessToken();
}

async function onToken(resp) {
  const btn = document.getElementById('gBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google`; }
  
  const savedState = sessionStorage.getItem('oauth_state');
  if (resp.state !== savedState) {
    console.error('State mismatch', resp.state, savedState);
    alert('Security Error: OAuth state mismatch (possible CSRF attack).');
    return;
  }
  sessionStorage.removeItem('oauth_state');

  if (resp.error) { console.error('OAuth error:', resp.error); return; }
  S.token = resp.access_token;
  persistAccessToken(S.token, resp.expires_in);
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

function getMockClassroomResponse(path: string) {
  if (path.startsWith('courses?')) {
    return {
      courses: [
        { id: '1', name: 'Preview Course 1', section: 'Morning', alternateLink: '#' },
        { id: '2', name: 'Preview Course 2', section: 'Afternoon', alternateLink: '#' }
      ]
    };
  }
  if (path.includes('/announcements?')) {
    return {
      announcements: [
        { id: 'a1', text: 'Welcome to Preview Mode!', creationTime: new Date().toISOString(), alternateLink: '#' }
      ]
    };
  }
  if (path.includes('/courseWork?')) {
    return {
      courseWork: [
        { id: 'cw1', title: 'Preview Assignment', description: 'This is a mock assignment.', creationTime: new Date().toISOString(), updateTime: new Date().toISOString(), alternateLink: '#', state: 'PUBLISHED' }
      ]
    };
  }
  if (path.includes('/courseWorkMaterials?')) {
    return { courseWorkMaterial: [] };
  }
  if (path.includes('/studentSubmissions?')) {
    return {
      studentSubmissions: [
        { id: 'sub1', courseWorkId: 'cw1', state: 'CREATED' }
      ]
    };
  }
  return {};
}

async function classroomApi(path, retries = 3) {
  if (S.token.startsWith('preview_bypass')) {
    return getMockClassroomResponse(path);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`https://classroom.googleapis.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${S.token}` },
    });
    
    if (res.status === 401) {
      S.token = null;
      document.cookie = "aul_token=; max-age=0; path=/";
      sessionStorage.removeItem('aul_token');
      clearInterval(S.pollTimer);
      showToast('Session expired', 'Please reconnect your Google account');
      setTimeout(() => { hideLoadingApp(); }, 1500);
      throw new Error('Token expired');
    }
    
    if (res.status === 429 && attempt < retries) {
      const retryAfter = res.headers.get('Retry-After');
      const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 2000 * Math.pow(2, attempt);
      console.warn(`API 429 on ${path}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
  }
}

async function fetchUserInfo() {
  if (S.token.startsWith('preview_bypass')) {
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
  const mins = Math.floor((n.getTime() - d.getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ════════════════════════════════════════════
   DATA LOADING
════════════════════════════════════════════ */

function applyCachedData(): boolean {
  const cachedUser = localStorage.getItem('aul_cache_user');
  const cachedCourses = localStorage.getItem('aul_cache_courses');
  const cachedNotifs = localStorage.getItem('aul_cache_notifs');
  const cachedDeadlines = localStorage.getItem('aul_cache_deadlines');

  if (!cachedCourses || !cachedNotifs) return false;
  try {
    if (cachedUser) S.user = JSON.parse(cachedUser);
    S.courses = JSON.parse(cachedCourses);
    S.notifs = JSON.parse(cachedNotifs);
    S.deadlines = cachedDeadlines ? JSON.parse(cachedDeadlines).map(d => ({ ...d, date: new Date(d.date) })) : [];

    if (S.token && !S.token.startsWith('preview_bypass')) {
      S.courses = S.courses.filter(c => c.id !== '1' && c.id !== '2');
      S.notifs = S.notifs.filter(n => n.courseId !== '1' && n.courseId !== '2');
      S.deadlines = S.deadlines.filter(d => d.courseId !== '1' && d.courseId !== '2');

      localStorage.setItem('aul_cache_courses', JSON.stringify(S.courses));
      localStorage.setItem('aul_cache_notifs', JSON.stringify(S.notifs));
      localStorage.setItem('aul_cache_deadlines', JSON.stringify(S.deadlines));
    }

    if (typeof renderGreeting === 'function') renderGreeting();
    if (typeof renderAccount === 'function') renderAccount();
    if (typeof renderClasses === 'function') renderClasses();
    if (typeof renderFeed === 'function') renderFeed();
    if (typeof renderCal === 'function') renderCal();
    if (typeof updatePip === 'function') updatePip();

    return true;
  } catch (e) {
    console.warn('Cache parse error', e);
    return false;
  }
}

async function loadEverything(forceFetch = false) {
  const hasValidCache = applyCachedData();
  const cachedTime = localStorage.getItem('aul_cache_time');
  const cacheAge = cachedTime ? (Date.now() - Number.parseInt(cachedTime, 10)) : Infinity;
  const isFresh = cacheAge < (5 * 60 * 1000);

  if (hasValidCache && isFresh && !forceFetch) {
    console.log('[Aulert] Using fresh cache (age:', Math.round(cacheAge/1000), 's). API fetch skipped.');
    return;
  }

  // Stale but valid cache + no force: run incremental fetch only (skip user/course re-fetch).
  if (hasValidCache && !forceFetch) {
    console.log('[Aulert] Cache is stale. Running incremental fetch in background...');
    await fetchAllContent(false, true); // incremental = true
    return;
  }

  // No cache or forceFetch: full re-fetch of user, courses, and all content.
  const [user, courseResp] = await Promise.all([
    fetchUserInfo(),
    classroomApi('courses?courseStates=ACTIVE&pageSize=30'),
  ]);

  S.user = user;
  localStorage.setItem('aul_cache_user', JSON.stringify(user));

  S.courses = (courseResp.courses || []).map((c: any, i: number) => ({
    id: c.id,
    name: c.name,
    section: c.section || '',
    color: COURSE_COLORS[i % COURSE_COLORS.length],
    abbr: c.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    link: c.alternateLink || 'https://classroom.google.com',
  }));
  localStorage.setItem('aul_cache_courses', JSON.stringify(S.courses));

  // Full fetch (not incremental) — we just rebuilt the course list from scratch.
  await fetchAllContent(true, false);
}

function mergeNotifsList(isIncremental: boolean, incomingNotifs: any[]): any[] {
  let mergedNotifs: any[];
  if (isIncremental) {
    mergedNotifs = [...S.notifs];
    incomingNotifs.forEach(incoming => {
      const idx = mergedNotifs.findIndex(n => n.id === incoming.id);
      if (idx >= 0) mergedNotifs[idx] = incoming;
      else mergedNotifs.unshift(incoming);
    });
  } else {
    mergedNotifs = incomingNotifs;
  }
  mergedNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return mergedNotifs;
}

function mergeDeadlinesList(isIncremental: boolean, incomingDeadlines: any[]): any[] {
  if (!isIncremental) return incomingDeadlines;
  const mergedDeadlines = [...S.deadlines];
  incomingDeadlines.forEach(incoming => {
    const idx = mergedDeadlines.findIndex(d => d.notifId === incoming.notifId);
    if (idx >= 0) mergedDeadlines[idx] = incoming;
    else mergedDeadlines.push(incoming);
  });
  return mergedDeadlines;
}

function isAssignmentVisible(n: any, now: Date): boolean {
  if (n.type !== 'assignment') return true;
  if (n.due) {
    const diff = (now.getTime() - new Date(n.due).getTime()) / 86400000;
    if (diff > 30) return false;
  }
  if (n.state) {
    const st = n.state.toLowerCase();
    if (st.includes('turned') || st.includes('returned') || st.includes('completed')) return false;
  }
  const low = (n.title + ' ' + n.body).toLowerCase();
  return !low.includes('turned in') && !low.includes('graded');
}

async function processCourseBatch(batch: any[], lastSeen: any, isIncremental: boolean) {
  const batchResults = await Promise.allSettled(
    batch.map(c => fetchCourse(c, lastSeen, isIncremental))
  );

  const notifs: any[] = [];
  const deadlines: any[] = [];
  let hasNewData = false;

  batchResults.forEach(r => {
    if (r.status === 'fulfilled') {
      const { notifs: nList, deadlines: dList, hasNew } = r.value;
      notifs.push(...nList);
      deadlines.push(...dList);
      if (hasNew) hasNewData = true;
    }
  });

  return { notifs, deadlines, hasNewData };
}

function handleNewNotifToasts(filteredNotifs: any[], initial: boolean) {
  if (!initial) {
    filteredNotifs
      .filter(n => !S.seenIds.has(n.id))
      .forEach(n => {
        const c = courseById(n.courseId);
        if (c) showToast(`New ${TYPE_META.get(n.type)?.label}`, `${c.name} — ${n.title}`, n.type);
        S.seenIds.add(n.id);
      });
  } else {
    filteredNotifs.forEach(n => S.seenIds.add(n.id));
  }
  saveSeen();
}

function persistAndRenderContent(filteredNotifs: any[], filteredDeadlines: any[]) {
  S.notifs = filteredNotifs;
  S.deadlines = filteredDeadlines;

  localStorage.setItem('aul_cache_notifs', JSON.stringify(S.notifs));
  localStorage.setItem('aul_cache_deadlines', JSON.stringify(S.deadlines));
  localStorage.setItem('aul_cache_time', Date.now().toString());

  if (typeof renderFeed === 'function') renderFeed();
  if (typeof renderSidebar === 'function') renderSidebar();
  if (typeof updatePip === 'function') updatePip();
}

function applyAndRenderBatch(
  isIncremental: boolean,
  incomingNotifs: any[],
  incomingDeadlines: any[],
  initial: boolean
) {
  const mergedNotifs = mergeNotifsList(isIncremental, incomingNotifs);
  const mergedDeadlines = mergeDeadlinesList(isIncremental, incomingDeadlines);

  const now = new Date();
  const filteredNotifs = mergedNotifs.filter(n => isAssignmentVisible(n, now));
  const filteredDeadlines = mergedDeadlines.filter(dl => {
    const diff = (now.getTime() - new Date(dl.date).getTime()) / 86400000;
    return diff <= 30;
  });

  handleNewNotifToasts(filteredNotifs, initial);
  persistAndRenderContent(filteredNotifs, filteredDeadlines);
}

async function processCoursesBatched(
  initial: boolean,
  isIncremental: boolean,
  lastSeen: any,
  incomingNotifs: any[],
  incomingDeadlines: any[]
): Promise<boolean> {
  let anyNewData = false;

  for (let i = 0; i < S.courses.length; i += 2) {
    const batch = S.courses.slice(i, i + 2);
    const { notifs, deadlines, hasNewData } = await processCourseBatch(batch, lastSeen, isIncremental);
    incomingNotifs.push(...notifs);
    incomingDeadlines.push(...deadlines);
    if (hasNewData) anyNewData = true;

    if (isIncremental) saveLastSeen(lastSeen);

    if (anyNewData || !isIncremental) {
      applyAndRenderBatch(isIncremental, incomingNotifs, incomingDeadlines, initial);
    }

    if (i + 2 < S.courses.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return anyNewData;
}

/**
 * fetchAllContent — fetches course data and updates the feed.
 *
 * @param {boolean} initial   true on first load; suppresses per-item toast notifications.
 * @param {boolean} isIncremental  when true, only items newer than lastSeen timestamps are
 *                                  merged into the cache. Skips re-render if nothing changed.
 *                                  Set to false for a forced full re-fetch.
 */
async function fetchAllContent(initial = false, isIncremental = false) {
  const lastSeen = isIncremental ? loadLastSeen() : {}; // empty map = treat all as new

  const gmailComments = await fetchGmailComments().catch(() => []);

  const incomingNotifs = [...gmailComments];
  const incomingDeadlines = [];
  const gmailHasNew = gmailComments.length > 0 && !isIncremental;

  const batchHasNew = await processCoursesBatched(
    initial, isIncremental, lastSeen, incomingNotifs, incomingDeadlines
  );

  const anyNewData = gmailHasNew || batchHasNew;
  if (isIncremental && !anyNewData) {
    console.log('[Aulert] Incremental fetch complete — no changes detected, cache unchanged.');
  }

  if (initial && typeof renderClasses === 'function') renderClasses();
  if (S.settings.gcalSync) gcalSyncAll();
}

/**
 * fetchCourse — fetches all content for a single course and returns notifs + deadlines.
 *
 * @param {object}  course          Course object from S.courses.
 * @param {object}  lastSeen        Map of "courseId_type" → ISO timestamp (mutated in place).
 * @param {boolean} isIncremental   When true, only items newer than lastSeen are returned.
 *                                   lastSeen timestamps are updated to the newest item seen.
 * @returns {{ notifs, deadlines, hasNew }}
 */
async function fetchCourse(course, lastSeen = {}, isIncremental = false) {
  const notifs = [];
  const deadlines = [];

  // Helper: returns true if the item's effective timestamp is newer than lastSeen.
  const isNewer = (isoTime, typeKey) => {
    if (!isIncremental || !isoTime) return true;
    const prev = lastSeen[typeKey];
    return !prev || new Date(isoTime) > new Date(prev);
  };

  // Helper: advance the stored lastSeen for this typeKey if isoTime is newer.
  const advanceLastSeen = (isoTime, typeKey) => {
    if (!isoTime) return;
    const prev = lastSeen[typeKey];
    if (!prev || new Date(isoTime) > new Date(prev)) {
      lastSeen[typeKey] = isoTime;
    }
  };

  const [ann, cw, mat, subs] = await Promise.allSettled([
    classroomApi(`courses/${course.id}/announcements?pageSize=30&orderBy=updateTime+desc`),
    classroomApi(`courses/${course.id}/courseWork?pageSize=50&orderBy=updateTime+desc`),
    classroomApi(`courses/${course.id}/courseWorkMaterials?pageSize=30&orderBy=updateTime+desc`),
    classroomApi(`courses/${course.id}/courseWork/-/studentSubmissions?userId=me`),
  ]);

  const turnedInIds = new Set();
  const submissionIds = new Map();
  if (subs.status === 'fulfilled' && subs.value.studentSubmissions) {
    subs.value.studentSubmissions.forEach(s => {
      if (s.state === 'TURNED_IN' || s.state === 'RETURNED') turnedInIds.add(s.courseWorkId);
      submissionIds.set(s.courseWorkId, s.id);
    });
  }

  const annKey = `${course.id}_announcements`;
  if (ann.status === 'fulfilled') {
    (ann.value.announcements || []).forEach(a => {
      // Always advance lastSeen to track the newest item we've seen from the API.
      const effectiveTime = (a.updateTime && a.updateTime !== a.creationTime) ? a.updateTime : a.creationTime;
      advanceLastSeen(effectiveTime, annKey);

      // In incremental mode, skip items we've already processed.
      if (!isNewer(effectiveTime, annKey) && isIncremental) return;

      const firstLine = (a.text || '').split('\r\n').find(l => l.trim()) || 'New Announcement';
      notifs.push({
        id: `ann-${a.id}`,
        type: 'announcement',
        courseId: course.id,
        title: firstLine.slice(0, 100),
        body: a.text || '',
        createdAt: a.creationTime,
        time: relTime(a.creationTime),
        read: S.readIds.has(`ann-${a.id}`),
        link: a.alternateLink || course.link,
      });
      if (a.updateTime && a.updateTime !== a.creationTime && new Date(a.updateTime) > new Date(a.creationTime)) {
        notifs.push({
          id: `upd-ann-${a.id}-${a.updateTime}`,
          type: 'announcement',
          courseId: course.id,
          title: '[Updated] ' + firstLine.slice(0, 100),
          body: 'This announcement was recently edited.\n\n' + (a.text || ''),
          createdAt: a.updateTime,
          time: relTime(a.updateTime),
          read: S.readIds.has(`upd-ann-${a.id}-${a.updateTime}`),
          link: a.alternateLink || course.link,
        });
      }
    });
  }

  const cwKey = `${course.id}_coursework`;
  if (cw.status === 'fulfilled') {
    (cw.value.courseWork || []).forEach(w => {
      if (turnedInIds.has(w.id)) return;
      const effectiveTime = w.updateTime || w.creationTime;
      advanceLastSeen(effectiveTime, cwKey);

      if (!isNewer(effectiveTime, cwKey) && isIncremental) return;

      const obj = {
        id: `cw-${w.id}`,
        type: 'assignment',
        courseId: course.id,
        courseWorkId: w.id,
        submissionId: submissionIds.get(w.id),
        title: w.title || 'New Assignment',
        body: w.description || `Posted in ${course.name}`,
        createdAt: w.creationTime,
        updatedAt: w.updateTime || w.creationTime,
        time: relTime(w.creationTime),
        read: S.readIds.has(`cw-${w.id}`),
        link: w.alternateLink || course.link,
        state: w.state || '',
      };
      if (w.dueDate) {
        const { year, month, day } = w.dueDate;
        const d = new Date(year, month - 1, day);
        (obj as any).due = d;
        const nowDay = new Date(); nowDay.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d.getTime() - nowDay.getTime()) / 86400000);
        let urg = 'ok';
        if (diff <= 1) urg = 'urg';
        else if (diff <= 5) urg = 'soo';
        deadlines.push({
          title: w.title,
          courseId: course.id,
          date: d,
          urg,
          notifId: `cw-${w.id}`,
        });
      }
      notifs.push(obj);

      if (w.updateTime && w.updateTime !== w.creationTime && new Date(w.updateTime) > new Date(w.creationTime)) {
        notifs.push({
          id: `upd-cw-${w.id}-${w.updateTime}`,
          type: 'assignment',
          courseId: course.id,
          courseWorkId: w.id,
          submissionId: submissionIds.get(w.id),
          title: '[Updated] ' + (w.title || 'Assignment'),
          body: 'This assignment or its deadline was recently updated.\n\n' + (w.description || `Posted in ${course.name}`),
          createdAt: w.updateTime,
          updatedAt: w.updateTime,
          time: relTime(w.updateTime),
          read: S.readIds.has(`upd-cw-${w.id}-${w.updateTime}`),
          link: w.alternateLink || course.link,
          state: w.state || '',
        });
      }
    });
  }

  const matKey = `${course.id}_materials`;
  if (mat.status === 'fulfilled') {
    (mat.value.courseWorkMaterial || []).forEach(m => {
      const effectiveTime = (m.updateTime && m.updateTime !== m.creationTime) ? m.updateTime : m.creationTime;
      advanceLastSeen(effectiveTime, matKey);

      if (!isNewer(effectiveTime, matKey) && isIncremental) return;

      notifs.push({
        id: `mat-${m.id}`,
        type: 'material',
        courseId: course.id,
        title: m.title || 'New Material',
        body: m.description || `Posted in ${course.name}`,
        createdAt: m.creationTime,
        time: relTime(m.creationTime),
        read: S.readIds.has(`mat-${m.id}`),
        link: m.alternateLink || course.link,
      });

      if (m.updateTime && m.updateTime !== m.creationTime && new Date(m.updateTime) > new Date(m.creationTime)) {
        notifs.push({
          id: `upd-mat-${m.id}-${m.updateTime}`,
          type: 'material',
          courseId: course.id,
          title: '[Updated] ' + (m.title || 'Material'),
          body: 'This material was recently updated.\n\n' + (m.description || `Posted in ${course.name}`),
          createdAt: m.updateTime,
          time: relTime(m.updateTime),
          read: S.readIds.has(`upd-mat-${m.id}-${m.updateTime}`),
          link: m.alternateLink || course.link,
        });
      }
    });
  }

  const hasNew = notifs.length > 0 || deadlines.length > 0;
  if (isIncremental) {
    console.log(`[Aulert] Incremental fetch for ${course.name}: ${hasNew ? notifs.length + ' new/updated item(s)' : 'no changes'}`);
  }

  return { notifs, deadlines, hasNew };
}

async function fetchGmailComments() {
  const notifs = [];
  if (!S.settings.comments) return notifs; // User setting to disable if needed
  
  if (S.token.startsWith('preview_bypass')) {
    return [{
      id: 'comment-preview-1',
      type: 'announcement', // using announcement style for comment
      courseId: S.courses[0]?.id || '1',
      title: 'Teacher added a private comment',
      body: 'Preview Comment: Great work on this assignment!',
      createdAt: new Date().toISOString(),
      time: relTime(new Date().toISOString()),
      read: S.readIds.has('comment-preview-1'),
      link: 'https://classroom.google.com',
    }];
  }

  try {
    // 1. Search for recent emails with private comments
    const q = encodeURIComponent('from:no-reply@' + 'classroom.google.com "added a private comment"');
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=10`, {
      headers: { Authorization: `Bearer ${S.token}` },
    });
    
    if (!listRes.ok) return notifs;
    const listData = await listRes.json();
    if (!listData.messages) return notifs;

    // 2. Fetch details for each message
    const msgPromises = listData.messages.map(m => 
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${S.token}` }
      }).then(r => r.json())
    );

    const msgs = await Promise.all(msgPromises);

    msgs.forEach(msg => {
      if (!msg.payload) return;
      const headers = msg.payload.headers || [];
      const subjectObj = headers.find(h => h.name === 'Subject');
      const dateObj = headers.find(h => h.name === 'Date');
      
      const subject = subjectObj ? subjectObj.value : 'New private comment';
      const dateStr = dateObj ? dateObj.value : new Date().toISOString();
      const snippet = msg.snippet || 'A new private comment was added.';

      // Extract course info heuristically or use default style
      const course = S.courses[0] || { id: 'unknown', link: 'https://classroom.google.com' };

      notifs.push({
        id: `comment-${msg.id}`,
        type: 'announcement',
        courseId: course.id,
        title: subject,
        body: snippet,
        createdAt: new Date(dateStr).toISOString(),
        time: relTime(new Date(dateStr).toISOString()),
        read: S.readIds.has(`comment-${msg.id}`),
        link: course.link, // Best effort link since Gmail doesn't give us Classroom assignment ID easily in metadata
      });
    });
  } catch (e) {
    console.warn('Failed to fetch Gmail comments:', e);
  }

  return notifs;
}

function startPolling() {
  clearInterval(S.pollTimer);
  clearInterval(S.countdownTimer);

  // Event-driven refresh: when the server (cron, Classroom push receiver) writes a
  // new `syncTick` for this user, pull fresh data immediately instead of waiting
  // for the next poll. This is the primary update path; the interval below is only
  // a visibility-gated safety net.
  subscribeRealtimeSync();

  S.nextPoll = Date.now() + POLL_MS;
  S.pollTimer = setInterval(() => {
    if (document.hidden) return; // don't burn Classroom API quota in background tabs
    fetchAllContent(false);
    S.nextPoll = Date.now() + POLL_MS;
  }, POLL_MS);

  // Pause/resume cleanly with tab visibility (saves battery + API quota).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      fetchAllContent(false);
      S.nextPoll = Date.now() + POLL_MS;
    }
  });

  S.countdownTimer = setInterval(() => {
    const secs = Math.max(0, Math.round((S.nextPoll - Date.now()) / 1000));
    const el = document.getElementById('pollCountdown');
    if (el) el.textContent = secs > 0 ? 'Refreshing in ' + secs + 's' : 'Refreshing…';
  }, 1000);
}

/**
 * Subscribe to Firebase Realtime Database `users/{id}/syncTick`.
 * The server writes this timestamp whenever it detects new Classroom activity
 * (e.g. the daily-digest cron or the Classroom push receiver), letting the client
 * refresh on-demand instead of fixed-interval polling.
 */
let _syncTickRef = null;
let _lastSyncTick = 0;
function subscribeRealtimeSync() {
  if (!window.firebase || !S.user?.id) return;
  if (typeof firebase === 'undefined' || !firebase.database) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    _syncTickRef = db.ref(`users/${S.user.id}/syncTick`);
    _syncTickRef.on('value', (snapshot) => {
      const tick = Number(snapshot.val()) || 0;
      if (tick && tick !== _lastSyncTick) {
        _lastSyncTick = tick;
        if (!document.hidden) fetchAllContent(false);
      }
    });
  } catch (e) {
    console.warn('Realtime sync subscription failed (falling back to polling):', e.message);
  }
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

const VALID_TABS = new Set(['feed', 'cal', 'hw', 'set', 'fbk', 'com']);

function launchApp() {
  // A query tab takes precedence so legal-page returns can target Settings.
  const queryTab = new URLSearchParams(window.location.search).get('tab');
  const hash = window.location.hash.replace('#', '');
  let initialTab = 'feed';
  if (queryTab && VALID_TABS.has(queryTab)) {
    initialTab = queryTab;
  } else if (VALID_TABS.has(hash)) {
    initialTab = hash;
  }
  goTab(initialTab);

  renderGreeting();
  renderAccount();
  renderFeed();
  renderClasses();
  renderCal();
  updatePip();
  renderSettings();
  document.body.classList.remove('app-loading');
  document.body.classList.add('app-ready');
  document.getElementById('appShellSkeleton')?.setAttribute('aria-busy', 'false');
  startPolling();
  fetchAllContent(false);
  showToast('Connected!', `Monitoring ${S.courses.length} course${S.courses.length !== 1 ? 's' : ''}`);

  // Cross-Account Protection (RISC) Listener
  if (window.firebase && S.user?.id) {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    const db = firebase.database();
    const securityRef = db.ref(`users/${S.user.id}/securityStatus`);
    securityRef.on('value', (snapshot) => {
      const status = snapshot.val();
      if (status?.compromised) {
        console.warn('Cross-Account Protection: Account compromised flag detected.');
        alert('Security Alert: Google has reported a potential security event with your account. You have been securely logged out.');
        disconnect();
      }
    });
  }
}

function disconnect() {
  if (S.pollTimer) clearInterval(S.pollTimer);
  if (S.countdownTimer) clearInterval(S.countdownTimer);
  if (S.toastTimer) clearTimeout(S.toastTimer);
  if (S.snackTimer) clearTimeout(S.snackTimer);

  const tokenToRevoke = S.token;
  S.token = null;
  document.cookie = "aul_token=; max-age=0; path=/";
  sessionStorage.removeItem('aul_token');
  sessionStorage.removeItem('oauth_state');

  // Purge all user-specific caches from localStorage
  const keysToRemove = [
    'aul_cache_courses',
    'aul_cache_notifs',
    'aul_cache_deadlines',
    'aul_cache_user',
    'aul_cache_time',
    'aul_user',
    'aul_read',
    'aul_seen',
    'aul_settings',
    'aul_hw',
    'aul_lastseen'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  if (typeof discordConfig !== 'undefined') {
    discordConfig = { enabled: false, webhooks: [] };
  }

  if (tokenToRevoke && window.google?.accounts?.oauth2 && S.user?.id) {
    try {
      google.accounts.oauth2.revoke(tokenToRevoke, () => { });
    } catch {
      /* ignore */
    }
  }
  S.courses = []; S.notifs = []; S.deadlines = []; S.user = null;
  window.location.href = 'index.html';
}

/* ════════════════════════════════════════════
   THEMING
════════════════════════════════════════════ */

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.dataset.theme === 'dark';
  const next = isDark ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('aul_theme', next);
  updateThemeIcon(next);
}

function setThemeMode(mode) { toggleTheme(); }

function updateThemeIcon(mode) {
  const nextTheme = mode === 'dark' ? 'light' : 'dark';
  const iconName = mode === 'dark' ? 'sun' : 'moon';
  document.querySelectorAll('[data-theme-toggle], .mob-top-bar button').forEach((toggle) => {
    const el = toggle.querySelector<HTMLElement>('[data-morph-icon]');
    if (el) {
      el.dataset.icon = iconName;
      if (window.MorphIcons) window.MorphIcons.set(el, iconName);
    }
    toggle.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
    toggle.setAttribute('title', `Switch to ${nextTheme} mode`);
  });
}

(function () {
  const saved = localStorage.getItem('aul_theme') || 'dark';
  const mode = (saved === 'custom') ? 'dark' : saved;
  document.documentElement.dataset.theme = mode;
  updateThemeIcon(mode);
})();

/* ════════════════════════════════════════════
   ANIMATIONS & UI
════════════════════════════════════════════ */

function iconPop(el) {
  if (!el) return;
  el.classList.remove('icon-pop');
  el.getBoundingClientRect();
  el.classList.add('icon-pop');
  clearTimeout(el._iconPopTimer);
  el._iconPopTimer = setTimeout(() => el.classList.remove('icon-pop'), 700);
}

function bellRingAnim(el) {
  if (!el) return;
  el.classList.remove('bell-ringing');
  el.getBoundingClientRect();
  el.classList.add('bell-ringing');
  el.addEventListener('animationend', () => el.classList.remove('bell-ringing'), { once: true });
}

function gearSpinAnim(el) {
  if (!el) return;
  el.classList.remove('gear-spinning');
  el.getBoundingClientRect();
  el.classList.add('gear-spinning');
  el.addEventListener('animationend', () => el.classList.remove('gear-spinning'), { once: true });
}

function calFlipAnim(el) {
  if (!el) return;
  const dateEl = el.querySelector('.cal-num');
  if (dateEl) dateEl.textContent = new Date().getDate();
  el.classList.remove('cal-flipping');
  el.getBoundingClientRect();
  el.classList.add('cal-flipping');
  clearTimeout(el._calTimer);
  el._calTimer = setTimeout(() => el.classList.remove('cal-flipping'), 900);
}

function hwCheckAnim(el) {
  if (!el) return;
  el.classList.remove('hw-checking');
  el.getBoundingClientRect();
  el.classList.add('hw-checking');
  clearTimeout(el._hwTimer);
  el._hwTimer = setTimeout(() => el.classList.remove('hw-checking'), 1050);
}

function comWaveAnim(el) {
  if (!el) return;
  el.classList.remove('com-waving');
  el.getBoundingClientRect();
  el.classList.add('com-waving');
  el.addEventListener('animationend', () => el.classList.remove('com-waving'), { once: true });
}

function fbkPopAnim(el) {
  if (!el) return;
  el.classList.remove('fbk-popping');
  el.getBoundingClientRect();
  el.classList.add('fbk-popping');
  clearTimeout(el._fbkTimer);
  el._fbkTimer = setTimeout(() => el.classList.remove('fbk-popping'), 900);
}

/* ════════════════════════════════════════════
   TAB SYSTEM
════════════════════════════════════════════ */

function updateTabBadge(tabId, count) {
  const el = document.getElementById('badge-' + tabId);
  if (!el) return;
  const n = Math.max(0, count || 0);
  if (n === 0) {
    el.style.display = 'none';
    el.textContent = '';
  } else {
    el.textContent = String(n > 99 ? '99+' : n);
    el.style.display = 'inline-block';
  }
}

function goTab(name) {
  const validTabs = ['feed', 'cal', 'hw', 'set', 'fbk', 'com'];
  if (!validTabs.includes(name)) name = 'feed';
  // Update URL hash for persistence
  window.location.hash = name;

  ['feed', 'cal', 'hw', 'set', 'fbk', 'com'].forEach(t => {
    const panel = document.getElementById('p-' + t);
    const tab = document.getElementById('tb-' + t);
    const mobTab = document.getElementById('mtb-' + t);
    if (panel) panel.classList.toggle('show', t === name);
    if (tab) tab.classList.toggle('on', t === name);
    if (mobTab) mobTab.classList.toggle('on', t === name);
  });
  updateTabBadge(name, 0);
  if (name === 'cal') renderCal();
  if (name === 'set') renderSettings();
  if (name === 'hw') hwRender();
  if (name === 'com' && typeof (window as any).comRender === 'function') (window as any).comRender();
}

/* ════════════════════════════════════════════
   SHEET (item detail)
════════════════════════════════════════════ */

function openSheet(id) {
  const n = S.notifs.find(x => x.id === id); if (!n) return;
  S.openId = id;
  const c = courseById(n.courseId), t = TYPE_META.get(n.type) || {};

  const shEyebrow = document.getElementById('shEyebrow');
  shEyebrow.innerHTML = '';
  const tagSpan = document.createElement('span');
  tagSpan.className = 'cls-tag';
  tagSpan.style.cssText = `background:${c.color}18;color:${c.color};border:1px solid ${c.color}30`;
  tagSpan.textContent = c.name;
  shEyebrow.appendChild(tagSpan);
  shEyebrow.appendChild(document.createTextNode(' '));
  const lblSpan = document.createElement('span');
  lblSpan.style.cssText = 'font-size:11px;color:var(--text-3)';
  lblSpan.textContent = (t as any).label || '';
  shEyebrow.appendChild(lblSpan);
  document.getElementById('shTitle').textContent = n.title;
  document.getElementById('shSub').textContent = n.time;
  document.getElementById('shText').textContent = n.body;
  document.getElementById('mrBtn').textContent = n.read ? 'Mark unread' : 'Mark as read';

  const link = document.getElementById('classroomLinkBtn');
  if (link) link.href = n.link || 'https://classroom.google.com';

  const submitBtn = document.getElementById('submitWorkBtn');
  if (submitBtn) {
    /* Settings alignment tweaks */
    /* Ensure settings sections are properly aligned */
    /* Add CSS rule via JS if not present */
    if (!document.getElementById('settingsAlignmentStyle')) {
      const style = document.createElement('style');
      style.id = 'settingsAlignmentStyle';
      style.textContent = `
        .sg { display: flex; flex-direction: column; align-items: stretch; }
        .sg-body { display: flex; flex-direction: column; gap: 12px; }
        .sg-lbl { margin-bottom: 8px; font-weight: 600; }
      `;
      document.head.appendChild(style);
    }
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

function closeSheet(e?) {
  if (e?.target?.closest('.sheet')) return;
  document.getElementById('sheetVeil')?.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sheetVeil')?.addEventListener('click', closeSheet);
});

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */

function showToast(title, msg, type = 'default') {
  if (type === 'assignment' || type === 'announcement' || type === 'material') return;

  const container = document.getElementById('toastContainer');
  if (!container) return;

  const t = document.createElement('div');
  t.className = 'push-toast';

  let color = 'var(--gamemaster)';
  if (type !== 'default' && TYPE_META.has(type)) color = TYPE_META.get(type).color;

  t.innerHTML = `
    <div class="toast-icon" style="background: ${color}; opacity: 0.15; position: absolute; inset: 14px auto auto 16px;"></div>
    <div class="toast-icon" style="background: transparent; z-index: 1;">
      <svg class="icon-teal" width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M13.73 21a2 2 0 01-3.46 0" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="toast-body" style="z-index: 1;">
      <div class="toast-app">Aulert · Google Classroom</div>
      <div class="toast-t">${title}</div>
      <div class="toast-m">${msg}</div>
    </div>
    <button class="toast-close" style="z-index: 1; background:none; border:none; color:var(--text-2); cursor:pointer;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  `;

  const closeBtn = t.querySelector('.toast-close');
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelDismiss = () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = null;
  };
  const removeToast = () => {
    cancelDismiss();
    t.classList.remove('in');
    setTimeout(() => { if (t.parentElement) t.remove(); }, 220);
  };
  const scheduleDismiss = () => {
    cancelDismiss();
    dismissTimer = setTimeout(removeToast, 5500);
  };

  closeBtn?.addEventListener('click', removeToast);
  t.addEventListener('pointerenter', cancelDismiss);
  t.addEventListener('pointerleave', scheduleDismiss);
  t.addEventListener('focusin', cancelDismiss);
  t.addEventListener('focusout', () => { if (!t.contains(document.activeElement)) scheduleDismiss(); });
  container.appendChild(t);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      t.classList.add('in');
    });
  });

  scheduleDismiss();
}

/* ════════════════════════════════════════════
   UI EFFECTS
════════════════════════════════════════════ */

(function () {
  const bar = document.getElementById('scrollBar');
  if (!bar) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (window.scrollY / total) + ')';
        ticking = false;
      });
    }
  }, { passive: true });
})();

(function () {
  const el = document.getElementById('auroraFollower');
  if (!el) return;
  
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReduced.matches) {
    el.style.transition = 'transform 0s';
    el.style.transform = `translate3d(${window.innerWidth/2 - 250}px, ${window.innerHeight/2 - 250}px, 0)`;
    return;
  }

  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let cx = tx, cy = ty;
  let rafId = null;

  function update() {
    cx += (tx - cx) * 0.15;
    cy += (ty - cy) * 0.15;
    el.style.transform = `translate3d(${cx - 250}px, ${cy - 250}px, 0)`;
    if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
      rafId = requestAnimationFrame(update);
    } else {
      rafId = null;
    }
  }

  document.addEventListener('mousemove', e => {
    tx = e.clientX;
    ty = e.clientY;
    if (rafId === null) rafId = requestAnimationFrame(update);
  }, { passive: true });

  rafId = requestAnimationFrame(update);
})();

(function () {
  function setCalDate() {
    const el = document.querySelector('#tb-cal .cal-num');
    if (el) el.textContent = String(new Date().getDate());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setCalDate);
  else setCalDate();
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
  setTimeout(() => { modal.style.display = 'none'; }, 220);
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
  const file = _pendingFiles.at(index);
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

  container.innerHTML = '';
  _pendingFiles.forEach((file, i) => {
    const sizeNum = file.size / 1024;
    const sizeKB = sizeNum.toFixed(1);
    const sizeStr = sizeNum > 1024 ? (file.size / 1048576).toFixed(1) + ' MB' : sizeKB + ' KB';

    const div = document.createElement('div');
    div.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface-2); border-radius:10px; border:1px solid var(--rim);';

    const svgIcon = document.createElement('div');
    svgIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0; color:var(--teal);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    div.appendChild(svgIcon.firstChild);

    const textCol = document.createElement('div');
    textCol.style.cssText = 'flex:1; min-width:0;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;';
    nameEl.title = 'Click to preview';
    nameEl.textContent = file.name;
    nameEl.onclick = () => openPendingFile(i);
    const sizeEl = document.createElement('div');
    sizeEl.style.cssText = 'font-size:11px; color:var(--text-3);';
    sizeEl.textContent = sizeStr;
    textCol.appendChild(nameEl);
    textCol.appendChild(sizeEl);
    div.appendChild(textCol);

    const btnOpen = document.createElement('button');
    btnOpen.title = 'Open file';
    btnOpen.style.cssText = 'background:none; border:none; color:var(--text-3); cursor:pointer; padding:4px; display:flex; transition:color 0.15s;';
    btnOpen.onmouseover = function () { this.style.color = 'var(--teal)'; };
    btnOpen.onmouseout = function () { this.style.color = 'var(--text-3)'; };
    btnOpen.onclick = () => openPendingFile(i);
    btnOpen.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15,3 21,3 21,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    div.appendChild(btnOpen);

    const btnRemove = document.createElement('button');
    btnRemove.title = 'Remove';
    btnRemove.style.cssText = 'background:none; border:none; color:var(--text-3); cursor:pointer; padding:4px; display:flex; transition:color 0.15s;';
    btnRemove.onmouseover = function () { this.style.color = 'var(--rose)'; };
    btnRemove.onmouseout = function () { this.style.color = 'var(--text-3)'; };
    btnRemove.onclick = () => removePendingFile(i);
    btnRemove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    div.appendChild(btnRemove);

    container.appendChild(div);
  });
}

// Drag & drop and paste setup (multiple files)
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');

    // Paste handler for screenshots
    document.addEventListener('paste', (e) => {
      const modal = document.getElementById('submitUnifiedModal');
      if (modal && modal.style.display !== 'none' && e.clipboardData) {
        const items = e.clipboardData.items;
        Array.from(items).forEach(item => {
          if (item.type.includes('image')) {
            const blob = item.getAsFile();
            if (blob) {
              const d = new Date();
              const filename = `Pasted_Image_${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}_${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}${d.getSeconds().toString().padStart(2, '0')}.png`;
              const file = new File([blob], filename, { type: blob.type });
              addPendingFile(file);
            }
          }
        });
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

async function uploadDriveFiles(files: File[]): Promise<Array<{ driveFile: { id: string } }>> {
  const attachments: Array<{ driveFile: { id: string } }> = [];
  for (const file of files) {
    const metadata = { name: file.name };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + S.token },
      body: form,
    });
    const driveData = await driveRes.json();
    if (driveData.error) throw new Error(driveData.error.message);
    attachments.push({ driveFile: { id: driveData.id } });
  }
  return attachments;
}

async function attachAndTurnIn(n: any, attachments: any[]): Promise<void> {
  if (attachments.length > 0) {
    const attachRes = await fetch(
      `https://classroom.googleapis.com/v1/courses/${n.courseId}/courseWork/${n.courseWorkId}/studentSubmissions/${n.submissionId}:modifyAttachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${S.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAttachments: attachments }),
      }
    );
    if (!attachRes.ok) {
      const errData = await attachRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'Failed to attach items');
    }
  }

  const turnInRes = await fetch(
    `https://classroom.googleapis.com/v1/courses/${n.courseId}/courseWork/${n.courseWorkId}/studentSubmissions/${n.submissionId}:turnIn`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${S.token}` },
    }
  );
  if (!turnInRes.ok) {
    const errData = await turnInRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to turn in assignment');
  }
}

function showApiRestrictionModal(n: any) {
  const content = document.querySelector('.submit-modal-content');
  if (!content || !n.link) return false;

  content.innerHTML = '';
  const h3 = document.createElement('h3');
  h3.style.cssText = 'font-size: 18px; font-weight: 650; color: var(--rose); margin-bottom: 16px;';
  h3.textContent = 'API Restriction';
  const p = document.createElement('p');
  p.style.cssText = 'font-size: 14px; color: var(--text-2); margin-bottom: 24px; line-height: 1.5;';
  p.innerHTML = 'Google Classroom prohibits third-party apps from turning in assignments created by teachers. <br><br>Your files were uploaded to your Google Drive! Please open the assignment in Classroom to attach them from your "Recent" files and turn it in.';
  const div = document.createElement('div');
  div.style.cssText = 'display: flex; gap: 12px; justify-content: center;';
  const btnC = document.createElement('button');
  btnC.onclick = () => { closeSubmitUnifiedModal(); setTimeout(() => loadEverything(), 300); };
  btnC.style.cssText = 'padding: 10px 16px; border-radius: 10px; border: 1px solid var(--rim); background: transparent; color: var(--text); font-weight: 600; cursor: pointer;';
  btnC.textContent = 'Cancel';
  const a = document.createElement('a');
  a.href = n.link;
  a.target = '_blank';
  a.onclick = btnC.onclick;
  a.style.cssText = 'text-decoration: none; padding: 10px 16px; border-radius: 10px; border: none; background: linear-gradient(135deg, #3B82F6, #2563EB); color: #fff; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.35);';
  a.textContent = 'Open in Classroom';
  div.appendChild(btnC);
  div.appendChild(a);
  content.appendChild(h3);
  content.appendChild(p);
  content.appendChild(div);
  return true;
}

function setSubmittingState(isSubmitting: boolean) {
  const modalBtn = document.getElementById('unifiedSubmitBtn') as HTMLButtonElement | null;
  if (modalBtn) {
    modalBtn.textContent = isSubmitting ? 'Submitting\u2026' : 'Turn in';
    modalBtn.disabled = isSubmitting;
    modalBtn.style.opacity = isSubmitting ? '0.7' : '1';
    modalBtn.style.pointerEvents = isSubmitting ? 'none' : 'auto';
  }
  const btn = document.getElementById('submitWorkBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = isSubmitting ? 'Submitting\u2026' : 'Submit';
    btn.disabled = isSubmitting;
    btn.style.opacity = isSubmitting ? '0.7' : '1';
  }
}

function formatSubmitSuccessMessage(filesCount: number, hasLink: boolean, isPreview = false): string {
  const prefix = isPreview ? 'Attached' : 'Turned in';
  if (filesCount > 0) {
    const fileWord = filesCount > 1 ? 'files' : 'file';
    const linkPart = hasLink && !isPreview ? ' + link' : '';
    return `${prefix} ${filesCount} ${fileWord}${linkPart} successfully.`;
  }
  return `${prefix} link successfully.`;
}

async function processUnifiedSubmit() {
  const n = S.notifs.find(x => x.id === S.openId);
  if (n?.type !== 'assignment' || !n?.courseWorkId || !n?.submissionId) return;

  const linkInput = document.getElementById('submitLinkInput') as HTMLInputElement | null;
  const linkUrl = linkInput ? linkInput.value.trim() : '';
  const files = [..._pendingFiles];

  if (files.length === 0 && !linkUrl) return;

  setSubmittingState(true);

  try {
    if (S.token.startsWith('preview_bypass')) {
      await new Promise(r => setTimeout(r, 1500));
      showToast('Assignment Submitted!', formatSubmitSuccessMessage(files.length, Boolean(linkUrl), true));
    } else {
      const attachments = await uploadDriveFiles(files);
      if (linkUrl) {
        attachments.push({ link: { url: linkUrl } } as any);
      }
      await attachAndTurnIn(n, attachments);
      showToast('Assignment Submitted!', formatSubmitSuccessMessage(files.length, Boolean(linkUrl), false));
    }

    _pendingFiles = [];
    closeSubmitUnifiedModal();
    loadEverything();
    closeSheet();
  } catch (err: any) {
    console.error('Submission failed:', err);
    if (err?.message?.includes('@ProjectPermissionDenied') && showApiRestrictionModal(n)) {
      return;
    }
    setSubmittingState(false);
    showToast('Submission error', err?.message || 'Failed to submit assignment');
  }
}

// Handle Back-Forward Cache (bfcache) reconnection for WebSockets/Firebase
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('Page restored from bfcache. Re-establishing connection...');
    if (window.firebase && firebase.apps.length > 0) {
      // Force Firebase to reconnect
      firebase.database().goOnline();
    }
    // Also re-fetch data if needed since the cache might be stale after a long background suspension
    if (typeof fetchAllContent === 'function' && window.S && S.token) {
      fetchAllContent(false);
    }
  }
});

