/* ════════════════════════════════════════════
   CALENDAR MODULE
   ─────────────────────────────────────────────
   All calendar rendering and deadline functionality
════════════════════════════════════════════ */
function navMo(d) {
    S.calMonth += d;
    if (S.calMonth < 0) {
        S.calMonth = 11;
        S.calYear--;
    }
    if (S.calMonth > 11) {
        S.calMonth = 0;
        S.calYear++;
    }
    renderCal(d);
}
function goToday() {
    const now = new Date();
    const dir = (now.getFullYear() > S.calYear || (now.getFullYear() === S.calYear && now.getMonth() > S.calMonth)) ? 1 : -1;
    S.calYear = now.getFullYear();
    S.calMonth = now.getMonth();
    renderCal(dir);
}
function calDayKeydown(e, d, el) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickDay(d, el);
    }
}
function renderCal(direction = 0) {
    document.getElementById('moLabel').textContent = `${MONTHS[S.calMonth]} ${S.calYear}`;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === S.calYear && today.getMonth() === S.calMonth;
    document.querySelectorAll('.mnav-today-btn').forEach((btn) => {
        btn.style.display = isCurrentMonth ? 'none' : 'inline-flex';
    });
    const first = new Date(S.calYear, S.calMonth, 1).getDay();
    const days = new Date(S.calYear, S.calMonth + 1, 0).getDate();
    const prev = new Date(S.calYear, S.calMonth, 0).getDate();
    const dmap = Object.create(null);
    S.deadlines.forEach(dl => {
        if (dl.date.getFullYear() === S.calYear && dl.date.getMonth() === S.calMonth) {
            const k = dl.date.getDate();
            if (!dmap[k])
                dmap[k] = [];
            dmap[k].push(dl);
        }
    });
    // Also plot hw tasks that have a deadline date
    _hwTasks.forEach(task => {
        if (!task.date || task.done)
            return;
        const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
        const [y, m, d] = datePart.split('-').map(Number);
        if (y === S.calYear && (m - 1) === S.calMonth) {
            if (!dmap[d])
                dmap[d] = [];
            dmap[d].push({ _hwTask: true, title: task.subject, desc: task.desc, date: new Date(y, m - 1, d), courseId: null, _task: task });
        }
    });
    let h = '';
    for (let i = first - 1; i >= 0; i--)
        h += `<div class="cday other" role="gridcell" aria-disabled="true"><div class="cday-n">${prev - i}</div></div>`;
    for (let d = 1; d <= days; d++) {
        const isT = today.getDate() === d && today.getMonth() === S.calMonth && today.getFullYear() === S.calYear;
        const dots = (dmap[d] || []).map(dl => {
            const color = dl._hwTask ? 'var(--gamemaster)' : courseById(dl.courseId).color;
            return `<div class="cdot" style="background:${color}"></div>`;
        }).join('');
        h += `<div class="cday${isT ? ' today' : ''}" role="gridcell" tabindex="0" aria-label="${MONTHS[S.calMonth]} ${d}, ${S.calYear}" onclick="pickDay(${d},this)" onkeydown="calDayKeydown(event,${d},this)"><div class="cday-n">${d}</div><div class="cday-dots">${dots}</div></div>`;
    }
    for (let i = 1; i <= 42 - (first + days); i++)
        h += `<div class="cday other" role="gridcell" aria-disabled="true"><div class="cday-n">${i}</div></div>`;
    const grid = document.getElementById('calGrid');
    grid.innerHTML = h;
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Calendar');
    if (direction !== 0) {
        grid.classList.remove('slide-left', 'slide-right');
        // Trigger reflow
        void grid.offsetWidth;
        grid.classList.add(direction > 0 ? 'slide-left' : 'slide-right');
    }
    renderDl(null, direction);
}
function pickDay(d, el) {
    document.querySelectorAll('.cday').forEach(x => x.classList.remove('picked'));
    el.classList.add('picked');
    renderDl(d);
}
function exportToGoogleCalendar() {
    if (S.settings.gcalSync) {
        showToast('Syncing...', 'Your deadlines are already set to sync. Forcing a refresh now.');
        gcalSyncAll();
        return;
    }
    S.settings.gcalSync = true;
    saveSettings();
    // Update UI if settings tab is loaded
    const toggle = document.getElementById('set_gcalSync');
    if (toggle)
        toggle.checked = true;
    if (typeof gcalRenderStatus === 'function')
        gcalRenderStatus();
    showToast('Calendar Sync Enabled', 'Syncing deadlines to Google Calendar...');
    gcalSyncAll();
}
function renderDl(day, direction = 0) {
    const nowDay = new Date();
    nowDay.setHours(0, 0, 0, 0);
    // Classroom deadlines
    const classroomList = day
        ? S.deadlines.filter(dl => dl.date.getDate() === day && dl.date.getMonth() === S.calMonth && dl.date.getFullYear() === S.calYear)
        : S.deadlines.filter(dl => dl.date >= nowDay).sort((a, b) => a.date - b.date);
    // Homework task deadlines
    const hwList = [];
    _hwTasks.forEach(task => {
        if (!task.date || task.done)
            return;
        const datePart = task.date.includes('T') ? task.date.split('T')[0] : task.date;
        const [y, m, d] = datePart.split('-').map(Number);
        const taskDate = new Date(y, m - 1, d);
        if (day) {
            if (d === day && (m - 1) === S.calMonth && y === S.calYear)
                hwList.push({ _hwTask: true, title: task.subject, date: taskDate });
        }
        else {
            if (taskDate >= nowDay)
                hwList.push({ _hwTask: true, title: task.subject, date: taskDate });
        }
    });
    const combined = [...classroomList, ...hwList].sort((a, b) => a.date - b.date);
    document.getElementById('dlHead').textContent = day
        ? `Deadlines on ${MONTHS[S.calMonth]} ${day}` : 'Upcoming deadlines';
    const el = document.getElementById('dlList');
    if (!combined.length) {
        el.innerHTML = `<div class="empty-s empty-s-compact"><h3>No deadlines${day ? ' on this day' : ''}</h3><p>${day ? 'Choose another date or add a homework task to plan ahead.' : 'Upcoming due dates and homework tasks will appear here.'}</p></div>`;
        return;
    }
    const ul = { urg: 'Urgent', soo: 'Soon', ok: 'On track' };
    el.innerHTML = combined.map(dl => {
        const diff = Math.ceil((dl.date.getTime() - nowDay.getTime()) / 86400000);
        const ds = dl.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const when = diff < 0 ? 'Overdue' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`;
        if (dl._hwTask) {
            const urg = diff < 0 ? 'urg' : diff <= 1 ? 'urg' : diff <= 5 ? 'soo' : 'ok';
            const urgLabel = diff < 0 ? 'Overdue' : diff <= 1 ? 'Urgent' : diff <= 5 ? 'Soon' : 'On track';
            return `<div class="dl-row" onclick="goTab('hw')"><div class="dl-stripe" style="background:var(--gamemaster)"></div><div class="dl-info"><div class="dl-t">${escHtml(dl.title)}</div><div class="dl-c" style="color:var(--gamemaster);opacity:.8">Homework</div></div><div class="dl-meta"><span class="dl-date">${ds} · ${when}</span><span class="dl-badge ${urg}">${urgLabel}</span></div></div>`;
        }
        const c = courseById(dl.courseId);
        return `<div class="dl-row" onclick="openSheet('${dl.notifId}')"><div class="dl-stripe" style="background:${c.color}"></div><div class="dl-info"><div class="dl-t">${escHtml(dl.title)}</div><div class="dl-c">${escHtml(c.name)}</div></div><div class="dl-meta"><span class="dl-date">${ds} · ${when}</span><span class="dl-badge ${dl.urg}">${ul[dl.urg] || 'On track'}</span></div></div>`;
    }).join('');
    if (direction !== 0) {
        el.classList.remove('slide-left', 'slide-right');
        void el.offsetWidth; // Trigger reflow
        el.classList.add(direction > 0 ? 'slide-left' : 'slide-right');
    }
}
