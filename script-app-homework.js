/* ════════════════════════════════════════════
   HOMEWORK TRACKER MODULE
   ─────────────────────────────────────────────
   All homework management and custom date/time picker
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
