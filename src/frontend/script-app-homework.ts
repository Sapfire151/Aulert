/* ════════════════════════════════════════════
   HOMEWORK TRACKER MODULE
   ─────────────────────────────────────────────
   All homework management and custom date/time picker
════════════════════════════════════════════ */

// eslint-disable-next-line no-var
var _hwTasks: any[] = JSON.parse(localStorage.getItem('aul_hw') || '[]');

function hwSave() {
  localStorage.setItem('aul_hw', JSON.stringify(_hwTasks));
}

/* ══════════════════════════════════════════
   CUSTOM DATE+TIME PICKER (hwDtp) — 24h
══════════════════════════════════════════ */
interface HwDtpState {
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number;
  min: number;
  viewYear: number;
  viewMonth: number;
}

const hwDtp: HwDtpState = {
  year: null, month: null, day: null,
  hour: 23, min: 59,           // 24h default: 23:59
  viewYear: new Date().getFullYear(), viewMonth: new Date().getMonth(),
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
  if (!panel?.classList.contains('open')) return;
  panel.classList.add('closing');
  panel.addEventListener('animationend', function onEnd() {
    panel.classList.remove('open', 'closing');
    panel.removeEventListener('animationend', onEnd);
  }, { once: true });
}

// Close when clicking outside — guard against detached nodes (e.g. after calendar rebuild)
document.addEventListener('click', function(e: MouseEvent) {
  const wrap = document.getElementById('hwDtpWrap');
  if (!wrap) return;
  // If target is no longer in the DOM (removed by rebuild), treat as inside click
  if (!document.body.contains(e.target as any)) return;
  if (!wrap.contains(e.target as any)) {
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

function hwDtpShiftMonth(delta: number) {
  hwDtp.viewMonth += delta;
  if (hwDtp.viewMonth < 0)  { hwDtp.viewMonth = 11; hwDtp.viewYear--; }
  if (hwDtp.viewMonth > 11) { hwDtp.viewMonth = 0;  hwDtp.viewYear++; }
  hwDtpBuildCalendar();
  // Slide animation — left arrow = slide right, right arrow = slide left
  const cal = document.querySelector('.hwdtp-cal');
  if (cal) {
    const cls = delta > 0 ? 'slide-left' : 'slide-right';
    cal.classList.remove('slide-left', 'slide-right');
    (cal as HTMLElement).getBoundingClientRect(); // reflow to restart — side effect read
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
    el.textContent = String(daysInPrev - firstDay + 1 + i);
    grid.appendChild(el);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hwdtp-day';
    el.textContent = String(d);
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
    el.textContent = String(d);
    grid.appendChild(el);
  }
}

function hwDtpSelectDay(y: number, m: number, d: number, _el?: HTMLElement) {
  hwDtp.year = y; hwDtp.month = m; hwDtp.day = d;
  // Rebuild to move .selected highlight — don't close
  hwDtpBuildCalendar();
  // Ripple flash on the newly selected element (re-query after rebuild)
  const grid = document.getElementById('hwDtpDays');
  if (grid) {
    const all = grid.querySelectorAll('.hwdtp-day.selected');
    all.forEach(btn => {
      btn.classList.remove('day-flash');
      (btn as HTMLElement).getBoundingClientRect(); // reflow to restart animation — side effect read
      btn.classList.add('day-flash');
    });
  }
  // Live-update the trigger label so user sees the date immediately
  hwDtpUpdateTriggerLabel(/*persist=*/false);
}

function hwDtpShiftHour(delta: number) {
  hwDtp.hour = ((hwDtp.hour + delta) % 24 + 24) % 24;
  hwDtpSyncTime();
  hwDtpUpdateTriggerLabel(false);
}

function hwDtpShiftMin(delta: number) {
  hwDtp.min = ((hwDtp.min + delta) % 60 + 60) % 60;
  hwDtpSyncTime();
  hwDtpUpdateTriggerLabel(false);
}

function hwDtpSyncTime() {
  const hv = document.getElementById('hwDtpHourVal') as HTMLInputElement | null;
  const mv = document.getElementById('hwDtpMinVal') as HTMLInputElement | null;
  // Only update if not currently focused (don't clobber typing)
  if (hv && document.activeElement !== hv) hv.value = String(hwDtp.hour).padStart(2,'0');
  if (mv && document.activeElement !== mv) mv.value = String(hwDtp.min).padStart(2,'0');
}

/* ── Typed time input handlers ── */
function hwDtpHourInput(el: HTMLInputElement) {
  const v = Number.parseInt(el.value, 10);
  if (!Number.isNaN(v) && v >= 0 && v <= 23) {
    hwDtp.hour = v;
    hwDtpUpdateTriggerLabel(false);
  }
  // Auto-jump to minutes when 2 valid digits typed
  if (el.value.length === 2 && !Number.isNaN(Number.parseInt(el.value, 10))) {
    const minVal = document.getElementById('hwDtpMinVal') as HTMLInputElement | null;
    if (minVal) {
      minVal.focus();
      minVal.select();
    }
  }
}
function hwDtpHourBlur(el: HTMLInputElement) {
  const v = Number.parseInt(el.value, 10);
  hwDtp.hour = (!Number.isNaN(v) && v >= 0 && v <= 23) ? v : 0;
  el.value = String(hwDtp.hour).padStart(2,'0');
  hwDtpUpdateTriggerLabel(false);
}
function hwDtpMinInput(el: HTMLInputElement) {
  const v = Number.parseInt(el.value, 10);
  if (!Number.isNaN(v) && v >= 0 && v <= 59) {
    hwDtp.min = v;
    hwDtpUpdateTriggerLabel(false);
  }
}
function hwDtpMinBlur(el: HTMLInputElement) {
  const v = Number.parseInt(el.value, 10);
  hwDtp.min = (!Number.isNaN(v) && v >= 0 && v <= 59) ? v : 0;
  el.value = String(hwDtp.min).padStart(2,'0');
  hwDtpUpdateTriggerLabel(false);
}
function hwDtpTimeKey(e: KeyboardEvent, field: string) {
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
  if (hwDtp.year === null || hwDtp.month === null || hwDtp.day === null) return '';
  const pad = (n: number) => String(n).padStart(2,'0');
  return `${hwDtp.year}-${pad(hwDtp.month+1)}-${pad(hwDtp.day)}T${pad(hwDtp.hour)}:${pad(hwDtp.min)}`;
}

// Update the trigger button label (and optionally persist to hidden input)
function hwDtpUpdateTriggerLabel(persist: boolean) {
  if (hwDtp.year === null || hwDtp.month === null || hwDtp.day === null) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = (n: number) => String(n).padStart(2,'0');
  const label = `${months[hwDtp.month]} ${hwDtp.day} · ${pad(hwDtp.hour)}:${pad(hwDtp.min)}`;
  const lbl      = document.getElementById('hwDtpLabel');
  const trigger  = document.getElementById('hwDtpTrigger');
  const clearBtn = document.getElementById('hwDtpClear');
  if (lbl) lbl.textContent = label;
  if (trigger)  trigger.classList.add('has-val');
  if (clearBtn) clearBtn.style.display = 'block';
  if (persist) {
    const hwDate = document.getElementById('hwDate') as HTMLInputElement | null;
    if (hwDate) hwDate.value = hwDtpIsoValue();
  }
}

// Full commit — write to hidden input and close
function hwDtpCommit() {
  if (hwDtp.year === null) return;
  const hwDate = document.getElementById('hwDate') as HTMLInputElement | null;
  if (hwDate) hwDate.value = hwDtpIsoValue();
  hwDtpUpdateTriggerLabel(false);
}

// Called by "Set Deadline" button — commit and close
function hwDtpConfirm() {
  if (hwDtp.year === null) { hwDtpClose(); return; }
  hwDtpCommit();
  hwDtpClose();
}

function hwDtpClear(e: MouseEvent) {
  e.stopPropagation();
  const hwDate = document.getElementById('hwDate') as HTMLInputElement | null;
  if (hwDate) hwDate.value = '';
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
  const hwDate = document.getElementById('hwDate') as HTMLInputElement | null;
  if (hwDate) hwDate.value = '';
  const now = new Date();
  hwDtp.viewYear = now.getFullYear();
  hwDtp.viewMonth = now.getMonth();
  hwDtpSyncTime();
}

function hwAdd() {
  const subjectEl = document.getElementById('hwSubject') as HTMLInputElement | null;
  const descEl    = document.getElementById('hwDesc') as HTMLInputElement | null;
  const dateEl    = document.getElementById('hwDate') as HTMLInputElement | null;

  const subject = subjectEl?.value.trim() || '';
  const desc    = descEl?.value.trim() || '';
  const date    = dateEl?.value || '';

  if (!subject) {
    if (subjectEl) {
      subjectEl.focus();
      subjectEl.style.borderColor = 'var(--rose)';
      setTimeout(() => { subjectEl.style.borderColor = ''; }, 1200);
    }
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
  try {
    hwSave();
    hwRender();
    if (document.getElementById('tb-cal')?.classList.contains('on') && typeof renderCal === 'function') renderCal();

    if (subjectEl) subjectEl.value = '';
    if (descEl) descEl.value = '';
    hwDtpReset();

    showHwSnack('✓ Task added successfully');
  } catch(e) {
    console.error('hwAdd Error:', e);
    showHwSnack('❌ Failed to add task (Storage error?)');
  }
}

function hwDelete(id: any) {
  const card = document.getElementById('hwcard-' + id);
  if (card) {
    card.style.transform = 'scale(.95) translateX(10px)';
    card.style.opacity = '0';
    setTimeout(() => {
      try {
        _hwTasks = _hwTasks.filter(t => t.id !== id);
        hwSave();
        hwRender();
        showHwSnack('✓ Task deleted');
      } catch(e) {
        console.error('hwDelete Error:', e);
        showHwSnack('❌ Failed to delete task');
      }
    }, 250);
  }
}

function hwToggleDone(id: any) {
  const task = _hwTasks.find(t => t.id === id);
  if (task) { 
    task.done = !task.done; 
    try {
      hwSave(); 
      hwRender(); 
      showHwSnack(task.done ? '✓ Marked as done' : '✓ Marked as to-do');
    } catch(e) {
      task.done = !task.done; // revert
      hwRender(); // revert visually
      console.error('hwToggleDone Error:', e);
      showHwSnack('❌ Action failed');
    }
  }
}

function hwFormatDate(date?: string | null) {
  if (!date) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (date.includes('T')) {
    const [datePart, timePart] = date.split('T');
    const [, m, day] = datePart.split('-');
    const [hh, mm] = timePart.split(':');
    return `${months[+m-1]} ${+day} · ${hh}:${mm}`;
  } else {
    const [, m, day] = date.split('-');
    return `${months[+m-1]} ${+day}`;
  }
}


/**
 * Generates the pill HTML for a task's urgency state.
 * Used by hwRender() card rendering and was previously inline in the forEach callback.
 */
function hwPillHtml(task: any, today: Date, nowMs: number): string {
  if (task.done) {
    return `<span class="hw-pill done">Done</span>`;
  } else if (task.date) {
    const isFullIso = task.date.includes('T');
    const dueTime = new Date(task.date).getTime();
    const datePart = isFullIso ? task.date.split('T')[0] : task.date;
    const [y, m, d] = datePart.split('-').map(Number);
    const dueMidnight = isFullIso ? new Date(task.date) : new Date(y, m - 1, d);
    const diffDays = Math.ceil((dueMidnight.getTime() - today.getTime()) / 86400000);

    if (isFullIso ? dueTime < nowMs : dueMidnight < today) {
      return `<span class="hw-pill overdue">Overdue</span>`;
    } else if (diffDays === 0) {
      return `<span class="hw-pill today">Due today</span>`;
    } else if (diffDays === 1) {
      return `<span class="hw-pill soon">Due tomorrow</span>`;
    } else if (diffDays <= 3) {
      return `<span class="hw-pill soon">Due in ${diffDays}d</span>`;
    } else {
      return `<span class="hw-pill ok">In ${diffDays}d</span>`;
    }
  }
  return '';
}

/**
 * Finds the most urgent non-done task within the task list.
 * Used by hwRender() to find the due-soon banner task.
 */
function findUrgentTask(tasks: any[], today: Date): any {
  let urgentTask: any = null;
  let urgentDiffDays = Infinity;
  tasks.filter(t => !t.done && t.date).forEach(t => {
    const datePart = t.date.includes('T') ? t.date.split('T')[0] : t.date;
    const [y, m, d] = datePart.split('-').map(Number);
    const dueMidnight = t.date.includes('T') ? new Date(t.date) : new Date(y, m - 1, d);
    const diff = Math.ceil((dueMidnight.getTime() - today.getTime()) / 86400000);
    if (diff < urgentDiffDays) {
      urgentDiffDays = diff;
      urgentTask = t;
    }
  });
  return urgentTask;
}

function calculateDiffDays(dateStr: string, today: Date): number {
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [y, m, d] = datePart.split('-').map(Number);
  const dueMidnight = dateStr.includes('T') ? new Date(dateStr) : new Date(y, m - 1, d);
  return Math.ceil((dueMidnight.getTime() - today.getTime()) / 86400000);
}

function createHwCardElement(task: any, today: Date, nowMs: number): HTMLElement {
  const card = document.createElement('div');
  card.className = 'hw-card' + (task.done ? ' done' : '');
  card.id = 'hwcard-' + task.id;

  const pillHtml = hwPillHtml(task, today, nowMs);
  const dateHtml = task.date
    ? `<span class="hw-date"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${hwFormatDate(task.date)}</span>`
    : '';

  card.innerHTML = `
    <button class="hw-check ${task.done ? 'checked' : ''}" type="button" aria-label="${task.done ? 'Mark undone' : 'Mark done'}" onclick="hwToggleDone(${task.id})">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="hw-body">
      <div class="hw-subj">${escHtml(task.subject)}</div>
      ${task.desc ? `<div class="hw-desc">${escHtml(task.desc)}</div>` : ''}
      <div class="hw-meta">
        ${dateHtml}
        ${pillHtml}
      </div>
    </div>
    <button class="hw-del" type="button" aria-label="Delete task" onclick="hwDelete(${task.id})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  `;
  return card;
}

function createDueSoonBannerElement(urgentTask: any, urgentDiffDays: number): HTMLElement {
  const banner = document.createElement('div');
  const isOverdue = urgentDiffDays < 0;
  const isToday = urgentDiffDays === 0;
  let bannerMod = 'banner-soon';
  let icon = '⏳';
  let title = `Due in ${urgentDiffDays} day${urgentDiffDays > 1 ? 's' : ''}: ${escHtml(urgentTask.subject)}`;

  if (isOverdue) {
    bannerMod = 'banner-overdue';
    icon = '⚠️';
    title = `Overdue: ${escHtml(urgentTask.subject)}`;
  } else if (isToday) {
    bannerMod = 'banner-today';
    icon = '🔔';
    title = `Due Today: ${escHtml(urgentTask.subject)}`;
  }

  banner.className = `hw-due-banner ${bannerMod}`;
  const sub = urgentTask.date ? `Deadline: ${hwFormatDate(urgentTask.date)}` : '';
  banner.innerHTML = `
    <div class="hw-due-banner-icon">${icon}</div>
    <div class="hw-due-banner-text">
      <div class="hw-due-banner-title">${title}</div>
      <div class="hw-due-banner-sub">${sub}</div>
    </div>`;
  return banner;
}

function hwRender() {
  const list = document.getElementById('hwList');
  const empty = document.getElementById('hwEmpty');
  if (!list) return;

  list.querySelectorAll('.hw-card, .hw-due-banner').forEach(c => c.remove());

  if (!_hwTasks.length) {
    if (empty) empty.style.display = 'flex';
    const hwTabActive = document.getElementById('tb-hw')?.classList.contains('on');
    if (!hwTabActive) updateTabBadge('hw', 0);
    return;
  }
  if (empty) empty.style.display = 'none';

  const undoneTasks = _hwTasks.filter(t => !t.done).length;
  const hwTabActive = document.getElementById('tb-hw')?.classList.contains('on');
  updateTabBadge('hw', hwTabActive ? 0 : undoneTasks);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nowMs = Date.now();

  const urgentTask = findUrgentTask(_hwTasks, today);
  const urgentDiffDays = urgentTask ? calculateDiffDays(urgentTask.date, today) : Infinity;

  _hwTasks.forEach(task => {
    list.appendChild(createHwCardElement(task, today, nowMs));
  });

  if (urgentTask && urgentDiffDays <= 3) {
    list.insertBefore(createDueSoonBannerElement(urgentTask, urgentDiffDays), list.firstChild);
  }
}

function hwSectionHeader(task: any, currentSection: string): { html: string; section: string } {
  let label = 'Upcoming';
  if (currentSection === 'done') label = 'Done';
  else if (currentSection === 'overdue') label = 'Overdue';
  const sectionHeader = `<tr><td colspan="4" class="section-header">${label}</td></tr>`;
  return { html: sectionHeader, section: currentSection };
}

function hwStatusHtml(task: any, overdue: any[], todayMidnight: Date): string {
  if (task.done) return `<span class="pill pill-done">Done</span>`;
  if (overdue.includes(task)) return `<span class="pill pill-overdue">Overdue</span>`;

  if (task.date) {
    const diffDays = calculateDiffDays(task.date, todayMidnight);
    if (diffDays <= 5) return `<span class="pill pill-soon">Due soon</span>`;
  }
  return `<span class="pill pill-todo">To do</span>`;
}

function hwRowClass(task: any, overdue: any[]): string {
  if (task.done) return 'done-row';
  else if (overdue.includes(task)) return 'overdue-row';
  else return 'upcoming-row';
}

function escHtml(s?: string | null) {
  if (s == null) return '';
  return String(s).replaceAll('&','&').replaceAll('<','<').replaceAll('>','>').replaceAll('"','"');
}

function hwExportPDF() {
  if (!_hwTasks.length) { showToast('Nothing to export', 'Add some tasks first'); return; }
  const win = window.open('', '_blank');
  if (!win) { showToast('Popup blocked', 'Please allow popups for PDF export'); return; }
  const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  
  // Sort tasks
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const overdue: any[] = [];
  const upcoming: any[] = [];
  const done: any[] = [];

  _hwTasks.forEach(t => {
    if (t.done) {
      done.push(t);
    } else if (t.date) {
      const datePart = t.date.includes('T') ? t.date.split('T')[0] : t.date;
      const [y, m, d] = datePart.split('-').map(Number);
      const dueDate = t.date.includes('T') ? new Date(t.date) : new Date(y, m - 1, d);
      if (dueDate < todayMidnight) overdue.push(t);
      else upcoming.push(t);
    } else {
      upcoming.push(t);
    }
  });

  const allSorted = [...overdue, ...upcoming, ...done];
  const completionPercent = _hwTasks.length > 0 ? Math.round((done.length / _hwTasks.length) * 100) : 0;

  let currentSection = '';

  const rows = allSorted.map(t => {
    const date = hwFormatDate(t.date);
    
    const { html: sectionHeader, section: newSection } = hwSectionHeader(t, currentSection);
    currentSection = newSection;
    
    const statusHtml = hwStatusHtml(t, overdue, todayMidnight);
    const rowClass = hwRowClass(t, overdue);
    const altClass = allSorted.indexOf(t) % 2 === 0 ? 'alt-row' : '';
    
    return `
      ${sectionHeader}
      <tr class="${rowClass} ${altClass}">
        <td class="status-col">${statusHtml}</td>
        <td class="subject-col"><div class="subject-text">${escHtml(t.subject)}</div></td>
        <td class="desc-col">${t.desc ? escHtml(t.desc) : '<span class="na">—</span>'}</td>
        <td class="date-col">${date || '<span class="na">—</span>'}</td>
      </tr>`;
  }).join('');

  // Build the HTML as a blob URL to avoid deprecated document.write
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Homework List \u2014 ${now}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { margin: 0.75in; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; padding: 48px; color: #0f172a; background: #fff; }
    .accent-bar { display: none; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo-mark { width: 36px; height: 36px; background: transparent; border: 1px solid #cbd5e1; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #4f46e5; }
    .header-text h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; }
    .header-text p { font-size: 13px; color: #64748b; margin-top: 2px; }
    .stats-bar { display: flex; gap: 24px; padding: 16px 20px; background: transparent; border: 1px solid #cbd5e1; border-radius: 12px; margin-bottom: 32px; }
    .stat { display: flex; flex-direction: column; gap: 4px; }
    .stat-lbl { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    .stat-val { font-size: 18px; font-weight: 700; color: #0f172a; }
    .stat-val.c-overdue { color: #e11d48; }
    .stat-val.c-done { color: #10b981; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 0 16px 12px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 14px 16px; font-size: 13px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
    .section-header { padding: 24px 16px 8px; font-size: 14px; font-weight: 700; color: #334155; border-bottom: none; }
    .status-col { width: 100px; }
    .subject-col { width: 200px; }
    .date-col { width: 140px; text-align: right; font-weight: 500; color: #4f46e5; }
    .subject-text { font-weight: 600; color: #1e293b; }
    .desc-col { color: #475569; line-height: 1.5; }
    .na { color: #cbd5e1; }
    .pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: transparent; }
    .pill-done { border: 1px solid #059669; color: #059669; }
    .pill-overdue { border: 1px solid #e11d48; color: #e11d48; }
    .pill-soon { border: 1px solid #d97706; color: #d97706; }
    .pill-todo { border: 1px solid #64748b; color: #475569; }
    .done-row td { opacity: 0.6; }
    .done-row .subject-text { text-decoration: line-through; }
    .overdue-row td:first-child { position: relative; }
    .overdue-row td:first-child::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #e11d48; }
    .alt-row td { background: transparent; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 0; }
      .accent-bar { display: none; }
      .pill, .stats-bar, .logo-mark, .overdue-row td:first-child::before { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
  </head><body>
  <div class="accent-bar"></div>
  <div class="header">
    <div class="header-left">
      <div class="logo-mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>
      <div class="header-text">
        <h1>Homework Report</h1>
        <p>Exported ${now}</p>
      </div>
    </div>
  </div>
  <div class="stats-bar">
    <div class="stat"><span class="stat-lbl">Total Tasks</span><span class="stat-val">${_hwTasks.length}</span></div>
    <div class="stat"><span class="stat-lbl">Done</span><span class="stat-val c-done">${done.length}</span></div>
    <div class="stat"><span class="stat-lbl">Overdue</span><span class="stat-val c-overdue">${overdue.length}</span></div>
    <div class="stat"><span class="stat-lbl">Completion</span><span class="stat-val">${completionPercent}%</span></div>
  </div>
  <table>
    <thead><tr>
      <th class="status-col">Status</th>
      <th class="subject-col">Subject</th>
      <th>Description</th>
      <th class="date-col" style="text-align: right;">Due Date</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Exported from Aulert</div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  win.location.href = blobUrl;
  // Revoke after a short delay to free memory once the popup has loaded
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

function showHwSnack(msg: string) {
  if (S?.snackTimer) clearTimeout(S.snackTimer);
  const s = document.getElementById('snack');
  if (!s) return;
  s.textContent = msg;
  s.classList.add('show');
  S.snackTimer = setTimeout(() => { s.classList.remove('show'); }, 2400);
}

function hwShare() {
  if (!_hwTasks.length) {
    showHwSnack('📋 Nothing to share — add some tasks first!');
    return;
  }
  const btn = document.querySelector('.hw-btn-share') as HTMLElement | null;
  if (btn?.dataset.sharing) return; // block rapid re-clicks
  const text = _hwTasks.map((t: any) => {
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
      // Fallback: prompt user to copy manually (execCommand is deprecated)
      showHwSnack('Could not copy — please copy manually.');
    });
  }
}

// Allow Enter in subject to jump to description
document.getElementById('hwSubject')?.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('hwDesc')?.focus(); }
});
document.getElementById('hwDesc')?.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); hwAdd(); }
});
