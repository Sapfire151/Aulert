/* ════════════════════════════════════════════
   FEED (Notifications) MODULE
   ─────────────────────────────────────────────
   All notification/feed rendering and interactions
════════════════════════════════════════════ */

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
