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
    document.getElementById('notifPanelOverlay')?.classList.add('open');
    ModalManager.open('notifPanel');
    document.addEventListener('click', onOutsideNotifClick);
}
function closeNotifPanel() {
    notifPanelOpen = false;
    document.getElementById('notifPanelOverlay')?.classList.remove('open');
    ModalManager.close('notifPanel');
    document.removeEventListener('click', onOutsideNotifClick);
}
function onOutsideNotifClick(e) {
    if (!document.getElementById('notifPanel').contains(e.target) &&
        !document.getElementById('bellBtn').contains(e.target))
        closeNotifPanel();
}
function renderNotifPanel() {
    const unread = S.notifs.filter(n => !n.read).length;
    const cnt = document.getElementById('npUnreadCount');
    cnt.textContent = String(unread);
    cnt.style.display = unread ? '' : 'none';
    const typeIconName = {
        announcement: 'message',
        assignment: 'file',
        material: 'book',
    };
    const typeIcon = (type, color) => `<span class="morph-icon" data-morph-icon data-icon="${typeIconName[type] || 'circle'}" data-size="13" data-color="${color || 'currentColor'}"></span>`;
    document.getElementById('npList').innerHTML = S.notifs.slice(0, 8).map(n => {
        const c = courseById(n.courseId), t = TYPE_META[n.type] || {};
        return `<div class="np-item${!n.read ? ' unread' : ''}" onclick="closeNotifPanel();openSheet('${n.id}')">
      <div class="np-dot-col">
        ${!n.read ? `<div class="np-unread-dot" style="background:${c.color}"></div>` : '<div style="width:7px;height:7px"></div>'}
        <div class="np-type-icon" style="background:${c.color}18;color:${c.color}">${typeIcon(n.type, c.color)}</div>
      </div>
      <div class="np-content">
        <div class="np-item-class" style="color:${c.color}">${c.name}</div>
        <div class="np-item-title">${n.title}</div>
        <div class="np-item-preview">${n.body}</div>
        <div class="np-item-time">${n.time} · ${t.label || ''}</div>
      </div>
    </div>`;
    }).join('');
    const np = document.getElementById('npList');
    if (np && window.MorphIcons)
        window.MorphIcons.mount(np);
}
function markAllRead() {
    S.notifs.forEach(n => { n.read = true; S.readIds.add(n.id); });
    saveRead();
    renderFeed();
    updatePip();
    renderNotifPanel();
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
    if (el)
        el.classList.add('active');
    // clear type filter so everything shows for that class
    S.filter = 'all';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const allChip = document.querySelector('.chip');
    if (allChip)
        allChip.classList.add('active');
    renderFeed();
}
let _feedObserver = null;
let _feedRenderCount = 0;
function renderFeed() {
    const cnt = { all: 0, announcement: 0, assignment: 0, material: 0 };
    S.notifs.forEach(n => { cnt.all++; if (cnt[n.type] !== undefined)
        cnt[n.type]++; });
    Object.keys(cnt).forEach(k => {
        const el = document.getElementById('cnt-' + k);
        if (el)
            el.textContent = String(cnt[k]);
    });
    // Deadline count
    const nowDay2 = new Date();
    nowDay2.setHours(0, 0, 0, 0);
    const dlCntEl = document.getElementById('cnt-deadline');
    if (dlCntEl)
        dlCntEl.textContent = String(S.deadlines.filter(d => d.date >= nowDay2).length);
    const unread = S.notifs.filter(n => !n.read).length;
    const du = document.getElementById('dashUnreadNum');
    if (du)
        du.textContent = String(unread);
    // Update Notifications tab badge (only when not currently on that tab)
    const feedTabActive = document.getElementById('tb-feed')?.classList.contains('on');
    if (!feedTabActive)
        updateTabBadge('feed', unread);
    else
        updateTabBadge('feed', 0);
    const fm = document.getElementById('feedMeta');
    if (fm)
        fm.textContent = unread
            ? `${unread} unread · ${S.courses.length} classes monitored`
            : `You are all caught up · ${S.courses.length} classes monitored`;
    // update counts; later we'll recompute after filtering as well
    const fcm = document.getElementById('feedCountMeta');
    if (fcm)
        fcm.textContent = `${cnt.all} total · ${unread} unread`;
    renderSidebar();
    // apply filters
    let filtered = S.notifs.filter(n => {
        if (S.filter !== 'all' && n.type !== S.filter)
            return false;
        if (S.courseFilter !== 'all' && n.courseId !== S.courseFilter)
            return false;
        if (S.searchTerm) {
            const hay = (n.title + ' ' + n.body + ' ' + courseById(n.courseId).name).toLowerCase();
            if (!hay.includes(S.searchTerm))
                return false;
        }
        return true;
    });
    const feed = document.getElementById('notifFeed');
    // update filtered counts meta
    if (fcm) {
        const fu = filtered.filter(n => !n.read).length;
        fcm.textContent = `${filtered.length} total · ${fu} unread`;
    }
    if (!filtered.length) {
        feed.innerHTML = `<div class="empty-s"><h3>No matching updates</h3><p>No notifications match the current filters. Clear a filter or choose another class to see more updates.</p></div>`;
        const pg = document.getElementById('pagination');
        if (pg)
            pg.innerHTML = '';
        if (_feedObserver)
            _feedObserver.disconnect();
        return;
    }
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (S.page > totalPages)
        S.page = totalPages;
    if (S.page < 1)
        S.page = 1;
    const start = (S.page - 1) * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE);
    feed.innerHTML = items.map((n, i) => {
        const c = courseById(n.courseId), t = TYPE_META[n.type] || {};
        const isUpdated = n.title.startsWith('[Updated]');
        const displayTitle = isUpdated ? n.title.replace(/^\[Updated\]\s*/, '') : n.title;
        // Parse update date for badge: use updatedAt if available, else fall back to createdAt
        let updatedLabel = '';
        if (isUpdated) {
            const updDate = n.updatedAt ? new Date(n.updatedAt) : (n.createdAt ? new Date(n.createdAt) : null);
            if (updDate && !isNaN(updDate.getTime())) {
                updatedLabel = updDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        }
        return `<div class="ncard${n.read ? ' is-read' : ''}" style="animation-delay:${Math.min(i % 20, .8) * 0.05}s" onclick="openSheet('${n.id}')">
  <div class="ncard-row">
    <div class="ncard-bar" style="background:${c.color}"></div>
    <div class="ncard-body">
      <div class="ncard-top">
        <div class="ncard-tags">
          <span class="cls-tag" style="background:${c.color}18;color:${c.color};border:1px solid ${c.color}30">${c.name}</span>
          <span class="type-tag">${t.label || ''}</span>
          ${isUpdated ? `<span class="updated-badge">✦ Updated${updatedLabel ? ' ' + updatedLabel : ''}</span>` : ''}
        </div>
        <span class="ncard-time">${n.time}</span>
      </div>
      <div class="ncard-title">${displayTitle}</div>
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
    if (_feedObserver) {
        _feedObserver.disconnect();
        _feedObserver = null;
    }
    const pg = document.getElementById('pagination');
    if (pg) {
        if (totalPages > 1) {
            pg.innerHTML = `
        <div class="pagination-controls" style="display:flex; justify-content:center; align-items:center; gap:16px; margin-top:20px; margin-bottom:20px;">
          <button onclick="setPage(${S.page - 1})" ${S.page === 1 ? 'disabled' : ''} style="background:var(--surface); border:1px solid var(--border); padding:6px 12px; border-radius:6px; color:var(--text-1); cursor:${S.page === 1 ? 'not-allowed' : 'pointer'}; opacity:${S.page === 1 ? 0.5 : 1}">Previous</button>
          <span style="color:var(--text-2); font-size:14px;">Page ${S.page} of ${totalPages}</span>
          <button onclick="setPage(${S.page + 1})" ${S.page === totalPages ? 'disabled' : ''} style="background:var(--surface); border:1px solid var(--border); padding:6px 12px; border-radius:6px; color:var(--text-1); cursor:${S.page === totalPages ? 'not-allowed' : 'pointer'}; opacity:${S.page === totalPages ? 0.5 : 1}">Next</button>
        </div>
      `;
        }
        else {
            pg.innerHTML = '';
        }
    }
}
function setPage(p) {
    S.page = p;
    renderFeed();
    document.querySelector('.dash-feed-col')?.scrollIntoView({ behavior: 'smooth' });
}
function updatePip() {
    const pip = document.getElementById('pip');
    const unread = S.notifs.filter(n => !n.read).length;
    pip.style.display = unread ? 'block' : 'none';
    if (notifPanelOpen)
        renderNotifPanel();
}
