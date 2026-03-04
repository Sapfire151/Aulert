/* ════════════════════════════════════════════
   CONFIGURATION
   ─────────────────────────────────────────────
   1. Create a project at console.cloud.google.com
   2. Enable the Google Classroom API
   3. Create an OAuth 2.0 Web Client ID
   4. Add your domain to "Authorised JavaScript origins"
      For local dev, also add:
        http://localhost:3000
        http://127.0.0.1:5500  (VS Code Live Server)
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
].join(' ');

const POLL_MS        = 5 * 60 * 1000;
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
  openId: null, toastTimer: null, snackTimer: null, pollTimer: null,
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
  })),
};

function saveRead()     { localStorage.setItem('aul_read',     JSON.stringify([...S.readIds])); }
function saveSeen()     { localStorage.setItem('aul_seen',     JSON.stringify([...S.seenIds])); }
function saveSettings() { localStorage.setItem('aul_settings', JSON.stringify(S.settings)); }

const courseById = id => S.courses.find(c => c.id === id) || { color:'#8B5CF6', name:'Unknown', abbr:'?', section:'' };

/* ════════════════════════════════════════════
   OAUTH — Google Identity Services
════════════════════════════════════════════ */
let _tokenClient;

window.addEventListener('load', () => {
  // If already authenticated, go straight to the app
  const saved = sessionStorage.getItem('aul_token');
  if (saved) {
    window.location.href = 'app.html';
    return;
  }
  // Wait until GSI is ready
  waitForGSI();
});

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
  // Re-initialize client on every click so subsequent auths work correctly
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
  // Save token and navigate to the app page
  sessionStorage.setItem('aul_token', resp.access_token);
  window.location.href = 'app.html';
}

/* ════ NAVIGATION (Page-based) ════ */

function showLoadingApp() {
  // Redirect to app page — token already saved in sessionStorage
  window.location.href = 'app.html';
}

function hideLoadingApp() {
  // Already on landing page, nothing to do
  const fixedBtn = document.getElementById('globalThemeBtn');
  if (fixedBtn) fixedBtn.classList.remove('hidden');
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

