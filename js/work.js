// ── Work – Project Manager ──

const WORK_LISTS = {
  daily:      { label: 'Daily',         icon: '☀️', color: 'var(--orange)' },
  longterm:   { label: 'Projects',       icon: '🗂️', color: 'var(--blue)'   },
  onboarding: { label: 'Onboarding',    icon: '🚀', color: 'var(--green)'  },
  panel:      { label: 'Panel Reviews', icon: '📋', color: '#c084fc'       },
  personal:   { label: 'Personal',      icon: '🏠', color: '#f472b6'       },
};

const WORK_DURATIONS = [
  { val: 15,  label: '15m'  },
  { val: 30,  label: '30m'  },
  { val: 45,  label: '45m'  },
  { val: 60,  label: '1hr'  },
  { val: 90,  label: '1.5h' },
  { val: 120, label: '2hr'  },
  { val: 180, label: '3hr'  },
];

const WORK_FREQUENCIES = [
  { val: 'none',        label: 'One-time'    },
  { val: 'daily',       label: 'Daily'       },
  { val: 'weekly',      label: 'Weekly'      },
  { val: 'fortnightly', label: 'Fortnightly' },
  { val: 'monthly',     label: 'Monthly'     },
];

const WORK_DAY_START_MINS = 8 * 60;
const WORK_DAY_TOTAL_MINS = 420;
const LUNCH_AT_MINS       = 12 * 60;
const LUNCH_DURATION      = 30;

let workTopTab      = 'summary';
let workTableFilter = 'all';

function initWork() {
  if (!window.state.work) window.state.work = {};
  Object.keys(WORK_LISTS).forEach(k => {
    if (!window.state.work[k]) window.state.work[k] = [];
    window.state.work[k].forEach(t => {
      if (!t.completions) t.completions = [];
      if (!t.repeat)      t.repeat      = 'none';
      if (t.lastDone === undefined) t.lastDone = null;
      if (!t.subtasks)    t.subtasks    = [];
    });
  });
}

function checkAndResetRecurring(listKey) {
  const tasks   = window.state.work[listKey] || [];
  let   changed = false;
  const todayMs = new Date(new Date().toDateString()).getTime();
  const now     = new Date();
  tasks.forEach(t => {
    if (!t.done || !t.repeat || t.repeat === 'none' || !t.lastDone) return;
    const ld   = new Date(t.lastDone);
    let reset  = false;
    if      (t.repeat === 'daily')       reset = new Date(ld.toDateString()).getTime() < todayMs;
    else if (t.repeat === 'weekly')      reset = (Date.now() - t.lastDone) >= 7  * 86400000;
    else if (t.repeat === 'fortnightly') reset = (Date.now() - t.lastDone) >= 14 * 86400000;
    else if (t.repeat === 'monthly')     reset = ld.getMonth() !== now.getMonth() || ld.getFullYear() !== now.getFullYear();
    if (reset) { t.done = false; changed = true; }
  });
  if (changed) saveState();
}

// ── Root render ──
function renderWork() {
  initWork();
  const el = document.getElementById('section-work');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <h1 class="page-title">Work</h1>
        <p class="page-sub">Project overview and daily planner.</p>
      </div>
      <button class="btn btn-primary" id="plan-day-btn">⚡ Plan My Day</button>
    </div>

    <div class="work-top-tabs">
      <button class="work-top-tab ${workTopTab==='summary'?'active':''}" data-tab="summary">📊 Summary</button>
      <button class="work-top-tab ${workTopTab==='tasks'?'active':''}" data-tab="tasks">✅ Tasks</button>
    </div>

    <div class="work-top-panel ${workTopTab==='summary'?'active':''}" id="wtp-summary"></div>
    <div class="work-top-panel ${workTopTab==='tasks'?'active':''}"   id="wtp-tasks"></div>

    <div class="work-day-plan-overlay hidden" id="day-plan-overlay">
      <div class="work-day-plan-modal" id="day-plan-modal"></div>
    </div>`;

  el.querySelectorAll('.work-top-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      workTopTab = btn.dataset.tab;
      el.querySelectorAll('.work-top-tab').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.work-top-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`wtp-${workTopTab}`).classList.add('active');
    });
  });

  document.getElementById('plan-day-btn').addEventListener('click', planMyDay);
  document.getElementById('day-plan-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDayPlan();
  });

  buildSummaryPanel();
  buildTasksPanel();
}

// ═══════════════════════════════════════════════════
// SUMMARY TAB
// ═══════════════════════════════════════════════════

function buildSummaryPanel() {
  const p = document.getElementById('wtp-summary');
  p.innerHTML = `
    <div class="work-stat-tiles" id="work-stat-tiles"></div>
    <div class="work-load-cards" id="work-load-cards"></div>

    <div class="card" style="margin-top:20px">
      <div class="work-table-hdr">
        <div class="section-title" style="margin-bottom:0">All Tasks</div>
        <div class="work-filter-row" id="work-table-filters">
          <button class="work-filter-btn ${workTableFilter==='all'?'active':''}"     data-f="all">All</button>
          <button class="work-filter-btn ${workTableFilter==='pending'?'active':''}" data-f="pending">Pending</button>
          <button class="work-filter-btn ${workTableFilter==='high'?'active':''}"    data-f="high">High Priority</button>
          <button class="work-filter-btn ${workTableFilter==='soon'?'active':''}"    data-f="soon">Due This Week</button>
        </div>
      </div>
      <div id="work-all-table"></div>
    </div>`;

  p.querySelectorAll('.work-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      workTableFilter = btn.dataset.f;
      p.querySelectorAll('.work-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshSummaryTable();
    });
  });

  refreshSummary();
}

function getAllTasks() {
  const out = [];
  Object.entries(WORK_LISTS).forEach(([key, meta]) => {
    (window.state.work[key] || []).forEach(t => {
      out.push({ ...t, listKey: key, listLabel: meta.label, listColor: meta.color, listIcon: meta.icon });
    });
  });
  return out;
}

function isDueSoon(t) {
  if (!t.deadline || t.done) return false;
  const diff = (new Date(t.deadline) - new Date(new Date().toDateString())) / 86400000;
  return diff >= 0 && diff <= 7;
}

function isOverdue(t) {
  if (!t.deadline || t.done) return false;
  return new Date(t.deadline) < new Date(new Date().toDateString());
}

function refreshSummary() {
  refreshSummaryStats();
  refreshWorkloadCards();
  refreshSummaryTable();
}

function refreshSummaryStats() {
  const el = document.getElementById('work-stat-tiles');
  if (!el) return;
  const all     = getAllTasks();
  const pending = all.filter(t => !t.done);
  const high    = pending.filter(t => t.priority === 'high').length;
  const soon    = pending.filter(t => isDueSoon(t) || isOverdue(t)).length;
  const done    = all.filter(t => t.done).length;

  el.innerHTML = `
    <div class="wst"><div class="wst-val">${pending.length}</div><div class="wst-lbl">Pending</div></div>
    <div class="wst"><div class="wst-val" style="color:var(--orange)">${high}</div><div class="wst-lbl">High Priority</div></div>
    <div class="wst"><div class="wst-val" style="color:${soon > 0 ? '#f87171' : 'var(--text)'}">${soon}</div><div class="wst-lbl">Due This Week</div></div>
    <div class="wst"><div class="wst-val" style="color:var(--green)">${done}</div><div class="wst-lbl">Completed</div></div>`;
}

function refreshWorkloadCards() {
  const el = document.getElementById('work-load-cards');
  if (!el) return;
  el.innerHTML = Object.entries(WORK_LISTS).map(([key, meta]) => {
    const tasks   = window.state.work[key] || [];
    const total   = tasks.length;
    const done    = tasks.filter(t => t.done).length;
    const pending = total - done;
    const pct     = total > 0 ? Math.round(done / total * 100) : 0;
    const high    = tasks.filter(t => !t.done && t.priority === 'high').length;
    const med     = tasks.filter(t => !t.done && t.priority === 'med').length;
    const low     = tasks.filter(t => !t.done && t.priority === 'low').length;
    const next    = tasks.filter(t => !t.done && t.deadline)
                         .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    return `
      <div class="wlc">
        <div class="wlc-head" style="border-left-color:${meta.color}">
          <span class="wlc-icon">${meta.icon}</span>
          <div style="flex:1;min-width:0">
            <div class="wlc-name">${meta.label}</div>
            <div class="wlc-sub">${pending} pending · ${total} total</div>
          </div>
          <div class="wlc-pct" style="color:${meta.color}">${pct}%</div>
        </div>
        <div class="progress-track" style="height:5px;margin:10px 0 8px">
          <div class="progress-fill" style="width:${pct}%;background:${meta.color};border-radius:99px;transition:width 0.8s ease"></div>
        </div>
        <div class="wlc-pills">
          ${high ? `<span class="wlc-pill" style="background:var(--orange-glow);color:var(--orange)">${high} High</span>` : ''}
          ${med  ? `<span class="wlc-pill" style="background:var(--blue-glow);color:var(--blue)">${med} Med</span>`       : ''}
          ${low  ? `<span class="wlc-pill" style="background:var(--green-glow);color:var(--green)">${low} Low</span>`     : ''}
          ${!high && !med && !low ? '<span style="font-size:11px;color:var(--text-dim)">All clear ✓</span>' : ''}
        </div>
        ${next ? `<div class="wlc-next">📅 ${formatDeadline(next.deadline)} — ${escWH(next.text.slice(0, 38))}${next.text.length > 38 ? '…' : ''}</div>` : ''}
      </div>`;
  }).join('');
}

function refreshSummaryTable() {
  const el = document.getElementById('work-all-table');
  if (!el) return;

  let tasks = getAllTasks();
  if (workTableFilter === 'pending') tasks = tasks.filter(t => !t.done);
  if (workTableFilter === 'high')    tasks = tasks.filter(t => !t.done && t.priority === 'high');
  if (workTableFilter === 'soon')    tasks = tasks.filter(t => !t.done && (isDueSoon(t) || isOverdue(t)));

  const priOrder = { high: 0, med: 1, low: 2 };
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1);
  });

  if (!tasks.length) {
    el.innerHTML = `<div class="task-list-empty">No tasks match this filter.</div>`;
    return;
  }

  el.innerHTML = `
    <table class="work-table">
      <thead>
        <tr>
          <th style="width:34px"></th>
          <th>Task</th>
          <th>List</th>
          <th>Priority</th>
          <th>Est.</th>
          <th>Deadline</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(t => {
          const priKey  = t.priority === 'high' ? 'high' : t.priority === 'med' ? 'med' : 'low';
          const priLbl  = priKey === 'high' ? 'High' : priKey === 'med' ? 'Med' : 'Low';
          const overdue = isOverdue(t);
          const dur     = WORK_DURATIONS.find(d => d.val === t.duration)?.label || `${t.duration || '?'}m`;
          const dlStr   = t.deadline ? formatDeadline(t.deadline) : '—';
          const dlCls   = overdue ? 'wt-overdue' : isDueSoon(t) ? 'wt-soon' : '';
          const status  = t.done    ? '<span style="color:var(--green)">Done</span>'
                        : overdue   ? '<span style="color:#f87171">Overdue</span>'
                        :             '<span style="color:var(--text-muted)">Pending</span>';
          return `
            <tr class="${t.done ? 'wtr-done' : ''}">
              <td>
                <div class="task-check ${t.done ? 'checked' : ''}"
                     style="width:18px;height:18px;border-radius:5px;font-size:10px"
                     onclick="toggleWorkDone('${t.listKey}','${t.id}')">
                  ${t.done ? '✓' : ''}
                </div>
              </td>
              <td class="wt-name">${escWH(t.text)}</td>
              <td><span class="wt-list-badge" style="background:${t.listColor}20;color:${t.listColor}">${t.listIcon} ${t.listLabel}</span></td>
              <td><span class="task-priority pri-${priKey}">${priLbl}</span></td>
              <td class="wt-dim">${dur}</td>
              <td class="${dlCls}">${dlStr}</td>
              <td>${status}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function formatDeadline(dateStr) {
  if (!dateStr) return '—';
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(new Date().toDateString());
  const diff  = Math.round((d - today) / 86400000);
  const fmt   = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (diff < 0)   return `${fmt} (${Math.abs(diff)}d overdue)`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7)  return `${fmt} (in ${diff}d)`;
  return fmt;
}

// ═══════════════════════════════════════════════════
// TASKS TAB
// ═══════════════════════════════════════════════════

function buildTasksPanel() {
  const p = document.getElementById('wtp-tasks');

  const durationOpts = key =>
    WORK_DURATIONS.map(d =>
      `<option value="${d.val}" ${(key === 'panel' && d.val === 45) || (key !== 'panel' && d.val === 30) ? 'selected' : ''}>${d.label}</option>`
    ).join('');

  p.innerHTML = `
    <!-- Daily widget: full width -->
    <div class="work-widget work-widget-daily">
      <div class="work-widget-hdr">
        <span class="wwh-title" style="color:var(--orange)">☀️ Daily Tasks</span>
        <span class="work-tab-count" id="wcount-daily" style="background:var(--orange-glow);color:var(--orange)">0</span>
        <button class="work-gen-btn" onclick="generateInlinePlan()">⚡ Generate Schedule</button>
      </div>

      <div class="work-inline-plan hidden" id="inline-plan-area"></div>

      <div class="work-add-row" style="margin-top:14px">
        <input type="text" id="winput-daily" placeholder="Add a task for today…" class="work-text-input" />
        <select id="wpri-daily" class="work-select">
          <option value="high">High</option>
          <option value="med" selected>Medium</option>
          <option value="low">Low</option>
        </select>
        <select id="wdur-daily" class="work-select">${durationOpts('daily')}</select>
        <select id="wfreq-daily" class="work-select" title="Repeat frequency">
          ${WORK_FREQUENCIES.map(f => `<option value="${f.val}">${f.label}</option>`).join('')}
        </select>
        <input type="date" id="wdl-daily" class="work-select" title="Deadline (optional)" />
        <button class="btn btn-primary" onclick="addWorkTask('daily')">Add</button>
      </div>
      <ul class="work-list" id="wlist-daily"></ul>
    </div>

    <!-- Three smaller widgets in a row -->
    <div class="work-widgets-row">
      ${['longterm', 'onboarding', 'panel', 'personal'].map(key => `
        <div class="work-widget">
          <div class="work-widget-hdr">
            <span class="wwh-title" style="color:${WORK_LISTS[key].color}">${WORK_LISTS[key].icon} ${WORK_LISTS[key].label}</span>
            <span class="work-tab-count" id="wcount-${key}">0</span>
          </div>
          <div class="work-add-row" style="margin-top:10px">
            <input type="text" id="winput-${key}" placeholder="Add task…" class="work-text-input" />
            <select id="wpri-${key}" class="work-select">
              <option value="high">High</option>
              <option value="med" selected>Med</option>
              <option value="low">Low</option>
            </select>
            <select id="wdur-${key}" class="work-select">${durationOpts(key)}</select>
            <select id="wfreq-${key}" class="work-select" title="Repeat frequency">
              ${WORK_FREQUENCIES.map(f => `<option value="${f.val}">${f.label}</option>`).join('')}
            </select>
            <input type="date" id="wdl-${key}" class="work-select" title="Deadline (optional)" />
            <button class="btn btn-primary" onclick="addWorkTask('${key}')" style="padding:7px 12px">+</button>
          </div>
          <ul class="work-list" id="wlist-${key}"></ul>
        </div>`).join('')}
    </div>

    <!-- ── Task Repository ── -->
    <div class="work-repo-section" style="margin-top:24px">
      <div class="work-repo-header" onclick="toggleRepoSection()">
        <span class="repo-arrow">▶</span>
        <span>🗃 Task Repository</span>
        <span class="repo-count-badge" id="repo-count-badge">0 records</span>
        <span class="repo-header-hint">completed tasks · searchable · re-addable</span>
      </div>
      <div class="work-repo-body" id="work-repo-body">
        <div class="work-repo-search-row">
          <input type="text" id="work-repo-search" placeholder="🔍  Search completed tasks to re-add…" class="work-text-input" />
        </div>
        <div id="work-repo-list"></div>
      </div>
    </div>`;

  Object.keys(WORK_LISTS).forEach(key => {
    const inp = document.getElementById(`winput-${key}`);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addWorkTask(key); });
  });

  const repoSearch = document.getElementById('work-repo-search');
  if (repoSearch) repoSearch.addEventListener('input', refreshRepository);

  refreshAllWorkLists();
}

function generateInlinePlan() {
  const area = document.getElementById('inline-plan-area');
  const btn  = document.querySelector('.work-gen-btn');
  if (!area) return;

  const tasks = (window.state.work.daily || []).filter(t => !t.done);
  if (!tasks.length) {
    area.innerHTML = `<div class="ip-empty">No undone daily tasks — add some using the form above.</div>`;
    area.classList.remove('hidden');
    return;
  }

  const priOrder = { high: 0, med: 1, low: 2 };
  const sorted   = [...tasks].sort((a, b) => (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1));

  const end       = WORK_DAY_START_MINS + WORK_DAY_TOTAL_MINS;
  let   cursor    = WORK_DAY_START_MINS;
  let   lunchDone = false;
  const slots     = [];
  const missed    = [];

  for (const t of sorted) {
    if (!lunchDone && cursor >= LUNCH_AT_MINS) {
      slots.push({ isBreak: true });
      cursor    = LUNCH_AT_MINS + LUNCH_DURATION;
      lunchDone = true;
    }
    if (cursor + t.duration <= end) {
      slots.push({ ...t, start: cursor, end: cursor + t.duration });
      cursor += t.duration;
    } else {
      missed.push(t);
    }
  }

  const toTime = m => {
    const h = Math.floor(m / 60), min = m % 60, ampm = h < 12 ? 'AM' : 'PM';
    const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hh}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  area.innerHTML = `
    <div class="ip-header">Schedule for ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    ${slots.map(s => s.isBreak
      ? `<div class="ip-break">🍽 Lunch — ${toTime(LUNCH_AT_MINS)} to ${toTime(LUNCH_AT_MINS + LUNCH_DURATION)}</div>`
      : `<div class="ip-slot">
           <span class="ip-time">${toTime(s.start)} – ${toTime(s.end)}</span>
           <span class="ip-task">${escWH(s.text)}</span>
           <span class="task-priority pri-${s.priority === 'high' ? 'high' : s.priority === 'med' ? 'med' : 'low'}">
             ${s.priority === 'high' ? 'High' : s.priority === 'med' ? 'Med' : 'Low'}
           </span>
         </div>`
    ).join('')}
    ${missed.length ? `<div class="ip-missed">⏭ ${missed.length} task${missed.length > 1 ? 's' : ''} won't fit today: ${missed.map(t => escWH(t.text)).join(', ')}</div>` : ''}`;

  area.classList.remove('hidden');
  if (btn) btn.textContent = '↺ Refresh';
}

// ═══════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════

function addWorkTask(listKey) {
  const input = document.getElementById(`winput-${listKey}`);
  const text  = input?.value.trim();
  if (!text) return;

  if (!window.state.work[listKey]) window.state.work[listKey] = [];
  window.state.work[listKey].push({
    id:       'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    text,
    priority: document.getElementById(`wpri-${listKey}`)?.value || 'med',
    duration: +(document.getElementById(`wdur-${listKey}`)?.value || 30),
    deadline: document.getElementById(`wdl-${listKey}`)?.value || '',
    done:        false,
    repeat:      document.getElementById(`wfreq-${listKey}`)?.value || 'none',
    lastDone:    null,
    subtasks:    [],
    comments:    [],
    completions: [],
    created:     Date.now(),
  });
  saveState();
  if (input) input.value = '';
  refreshWorkList(listKey);
  refreshWorkCount(listKey);
  refreshSummary();
}

function toggleWorkDone(listKey, id) {
  const task = (window.state.work[listKey] || []).find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;

  if (task.done) {
    if (!task.completions) task.completions = [];
    task.completions.push({ ts: Date.now(), year: new Date().getFullYear() });
    task.lastDone = Date.now();

    // Immediate visual feedback before DOM re-render
    const checkEl = document.querySelector(`#witem-${id} .task-check`);
    const rowEl   = document.getElementById(`witem-${id}`);
    if (checkEl) { checkEl.classList.add('checked', 'bounce'); checkEl.innerHTML = '<span>✓</span>'; }
    if (rowEl)   rowEl.classList.add('done');

    workCompleteEffect(checkEl);
    saveState();

    // Delay list re-render so animations play first
    setTimeout(() => {
      refreshWorkList(listKey);
      refreshWorkCount(listKey);
      refreshSummary();
      refreshRepository();
    }, 650);
  } else {
    saveState();
    refreshWorkList(listKey);
    refreshWorkCount(listKey);
    refreshSummary();
    refreshRepository();
  }
}

function workCompleteEffect(checkEl) {
  if (!checkEl) return;

  // Bounce the checkbox
  checkEl.classList.add('bounce');
  setTimeout(() => checkEl.classList.remove('bounce'), 500);

  // Shimmer the task row
  const rowEl = checkEl.closest('.work-item');
  if (rowEl) {
    rowEl.classList.add('work-completing');
    setTimeout(() => rowEl.classList.remove('work-completing'), 700);
  }

  // Particle burst
  const rect   = checkEl.getBoundingClientRect();
  const cx     = rect.left + rect.width / 2;
  const cy     = rect.top  + rect.height / 2;
  const colors = ['#4caf78', '#ffe000', '#6aadff', '#ff7730', '#c084fc', '#fff'];

  for (let i = 0; i < 12; i++) {
    const p     = document.createElement('div');
    p.className = 'work-particle';
    const angle = (i / 12) * 360;
    const dist  = 28 + Math.random() * 34;
    const size  = 5 + Math.random() * 5;
    p.style.cssText = `
      left:${cx}px; top:${cy}px;
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --tx:${Math.cos(angle * Math.PI / 180) * dist}px;
      --ty:${Math.sin(angle * Math.PI / 180) * dist - 14}px;
      animation-delay:${i * 0.025}s;
      border-radius:${Math.random() > 0.4 ? '50%' : '3px'};
    `;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }

  // "Done!" toast
  const toast = document.createElement('div');
  toast.className = 'work-done-toast';
  toast.textContent = '✓ Done!';
  toast.style.cssText = `left:${cx + 18}px; top:${cy - 6}px;`;
  document.body.appendChild(toast);
  toast.addEventListener('animationend', () => toast.remove());
}

function deleteWorkTask(listKey, id) {
  window.state.work[listKey] = (window.state.work[listKey] || []).filter(t => t.id !== id);
  saveState();
  refreshWorkList(listKey);
  refreshWorkCount(listKey);
  refreshSummary();
}

// ── Sub-tasks (Steps) ──
function buildSubtaskListHtml(listKey, task) {
  if (!task.subtasks?.length) return '<p class="wcomment-empty">No steps yet. Break this into smaller pieces.</p>';
  return task.subtasks.map(s => `
    <div class="wsubtask-item ${s.done ? 'done' : ''}">
      <div class="task-check ${s.done ? 'checked' : ''}"
           style="width:18px;height:18px;border-radius:5px;font-size:10px;flex-shrink:0"
           onclick="toggleSubtask('${listKey}','${task.id}','${s.id}')">
        ${s.done ? '✓' : ''}
      </div>
      <span class="wsubtask-text">${escWH(s.text)}</span>
      <button class="wsubtask-del" onclick="deleteSubtask('${listKey}','${task.id}','${s.id}')">✕</button>
    </div>`).join('');
}

function toggleSubtasks(taskId) {
  document.getElementById(`wsubtasks-${taskId}`)?.classList.toggle('open');
}

function addSubtask(listKey, taskId) {
  const input = document.getElementById(`wsubtask-input-${taskId}`);
  const text  = input?.value.trim();
  if (!text) return;
  const task = (window.state.work[listKey] || []).find(t => t.id === taskId);
  if (!task) return;
  if (!task.subtasks) task.subtasks = [];
  task.subtasks.push({ id: 'ws_' + Date.now(), text, done: false });
  saveState();
  if (input) input.value = '';
  refreshSubtaskList(listKey, taskId);
  refreshSummary();
}

function toggleSubtask(listKey, taskId, subId) {
  const task = (window.state.work[listKey] || []).find(t => t.id === taskId);
  const sub  = task?.subtasks?.find(s => s.id === subId);
  if (!sub) return;
  sub.done = !sub.done;
  saveState();
  refreshSubtaskList(listKey, taskId);
  refreshSummary();
}

function deleteSubtask(listKey, taskId, subId) {
  const task = (window.state.work[listKey] || []).find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = (task.subtasks || []).filter(s => s.id !== subId);
  saveState();
  refreshSubtaskList(listKey, taskId);
  refreshSummary();
}

function refreshSubtaskList(listKey, taskId) {
  const task   = (window.state.work[listKey] || []).find(t => t.id === taskId);
  if (!task) return;
  const listEl = document.getElementById(`wsubtask-list-${taskId}`);
  if (listEl)  listEl.innerHTML = buildSubtaskListHtml(listKey, task);
  const badge  = document.querySelector(`#witem-${taskId} .work-steps-badge`);
  if (badge) {
    const done  = (task.subtasks || []).filter(s => s.done).length;
    const total = (task.subtasks || []).length;
    badge.textContent = `${done}/${total} steps`;
  }
  const stepsBtn = document.querySelector(`#witem-${taskId} .task-action-btn.steps`);
  if (stepsBtn) {
    stepsBtn.classList.toggle('has-steps', task.subtasks?.length > 0);
  }
}

// ── Inline edit ──
function editWorkTask(listKey, id) {
  const task = (window.state.work[listKey] || []).find(t => t.id === id);
  if (!task) return;

  const durOptions = WORK_DURATIONS.map(d =>
    `<option value="${d.val}" ${task.duration === d.val ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  const deadlineVal = task.deadline || '';

  const main = document.querySelector(`#witem-${id} .work-item-main`);
  if (!main) return;

  main.innerHTML = `
    <div class="work-edit-form">
      <input class="work-edit-input" id="wedit-text-${id}" type="text" value="${escWH(task.text)}" placeholder="Task description" />
      <div class="work-edit-row2">
        <select id="wedit-pri-${id}">
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
          <option value="med"  ${task.priority === 'med'  ? 'selected' : ''}>Med</option>
          <option value="low"  ${task.priority === 'low'  ? 'selected' : ''}>Low</option>
        </select>
        <select id="wedit-dur-${id}">${durOptions}</select>
        <select id="wedit-freq-${id}">
          ${WORK_FREQUENCIES.map(f => `<option value="${f.val}" ${(task.repeat||'none') === f.val ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
        <input type="date" id="wedit-dl-${id}" value="${deadlineVal}" />
        <button class="task-action-btn save"   onclick="saveWorkTaskEdit('${listKey}','${id}')">Save</button>
        <button class="task-action-btn cancel" onclick="cancelWorkTaskEdit('${listKey}')">Cancel</button>
      </div>
    </div>`;

  document.getElementById(`wedit-text-${id}`)?.focus();
}

function saveWorkTaskEdit(listKey, id) {
  const task = (window.state.work[listKey] || []).find(t => t.id === id);
  if (!task) return;

  const text = document.getElementById(`wedit-text-${id}`)?.value.trim();
  if (!text) return;

  task.text     = text;
  task.priority = document.getElementById(`wedit-pri-${id}`)?.value  || task.priority;
  task.duration = Number(document.getElementById(`wedit-dur-${id}`)?.value) || task.duration;
  task.repeat   = document.getElementById(`wedit-freq-${id}`)?.value || 'none';
  task.deadline = document.getElementById(`wedit-dl-${id}`)?.value  || '';

  saveState();
  refreshWorkList(listKey);
  refreshSummary();
}

function cancelWorkTaskEdit(listKey) {
  refreshWorkList(listKey);
}

// ── Comments ──
function toggleWorkComments(id) {
  document.getElementById(`wcomments-box-${id}`)?.classList.toggle('open');
  document.querySelector(`[data-comment-toggle="${id}"]`)?.classList.toggle('open');
}

function addWorkComment(listKey, id) {
  const input = document.getElementById(`wcomment-input-${id}`);
  const text  = input?.value.trim();
  if (!text) return;
  const task  = (window.state.work[listKey] || []).find(t => t.id === id);
  if (!task) return;
  if (!task.comments) task.comments = [];
  task.comments.push({ text, ts: Date.now() });
  saveState();
  if (input) input.value = '';
  const list = document.querySelector(`#wcomments-box-${id} .wcomment-list`);
  if (list) list.innerHTML = buildCommentListHtml(task.comments);
  const btn = document.querySelector(`[data-comment-toggle="${id}"]`);
  if (btn) { btn.textContent = `💬 ${task.comments.length}`; btn.classList.add('has-comments'); }
}

function buildCommentListHtml(comments) {
  if (!comments?.length) return '<p class="wcomment-empty">No notes yet.</p>';
  return comments.map(c => `
    <div class="wcomment-item">
      <div class="wcomment-text">${escWH(c.text)}</div>
      <div class="wcomment-ts">${new Date(c.ts).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}</div>
    </div>`).join('');
}

function escWH(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── List refresh ──
function refreshAllWorkLists() {
  Object.keys(WORK_LISTS).forEach(key => {
    refreshWorkList(key);
    refreshWorkCount(key);
  });
  refreshSummary();
  refreshRepository();
}

function refreshWorkCount(listKey) {
  const count = (window.state.work[listKey] || []).filter(t => !t.done).length;
  const el    = document.getElementById(`wcount-${listKey}`);
  if (el) el.textContent = count;
}

function refreshWorkList(listKey) {
  checkAndResetRecurring(listKey);
  const ul = document.getElementById(`wlist-${listKey}`);
  if (!ul) return;
  const tasks = window.state.work[listKey] || [];

  if (!tasks.length) {
    ul.innerHTML = `<li class="task-list-empty">${WORK_LISTS[listKey]?.label} — nothing added yet.</li>`;
    return;
  }

  const priOrder = { high: 0, med: 1, low: 2 };
  const sorted   = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1);
  });

  ul.innerHTML = sorted.map(task => {
    const commentCount = task.comments?.length || 0;
    const dur          = WORK_DURATIONS.find(d => d.val === task.duration)?.label || `${task.duration}m`;
    const priKey       = task.priority === 'high' ? 'high' : task.priority === 'med' ? 'med' : 'low';
    const priLbl       = priKey === 'high' ? 'High' : priKey === 'med' ? 'Med' : 'Low';
    const overdue      = isOverdue(task);
    const dlStr       = task.deadline ? formatDeadline(task.deadline) : '';
    const stepsDone   = (task.subtasks || []).filter(s => s.done).length;
    const stepsTotal  = (task.subtasks || []).length;
    const freqLabel   = task.repeat && task.repeat !== 'none'
                        ? WORK_FREQUENCIES.find(f => f.val === task.repeat)?.label || ''
                        : '';

    return `
      <li class="work-item ${task.done ? 'done' : ''}" id="witem-${task.id}">
        <div class="work-item-main">
          <div class="task-check ${task.done ? 'checked' : ''}" onclick="toggleWorkDone('${listKey}','${task.id}')">
            ${task.done ? '<span>✓</span>' : ''}
          </div>
          <div class="work-item-body">
            <span class="task-text">${escWH(task.text)}</span>
            ${dlStr ? `<span class="work-dl-badge ${overdue ? 'overdue' : isDueSoon(task) ? 'soon' : ''}">📅 ${dlStr}</span>` : ''}
            ${stepsTotal ? `<span class="work-steps-badge">${stepsDone}/${stepsTotal} steps</span>` : ''}
          </div>
          <span class="task-priority pri-${priKey}">${priLbl}</span>
          ${freqLabel ? `<span class="work-repeat-badge">♻ ${freqLabel}</span>` : ''}
          <span class="work-dur-badge">${dur}</span>
          <div class="task-actions">
            <button class="task-action-btn steps ${stepsTotal ? 'has-steps' : ''}"
                    onclick="toggleSubtasks('${task.id}')">📋 Steps</button>
            <button class="task-action-btn ${commentCount > 0 ? 'has-comments' : ''}"
                    data-comment-toggle="${task.id}"
                    onclick="toggleWorkComments('${task.id}')">💬 ${commentCount > 0 ? commentCount : 'Note'}</button>
            <button class="task-action-btn edit" onclick="editWorkTask('${listKey}','${task.id}')">Edit</button>
            <button class="task-action-btn delete" onclick="deleteWorkTask('${listKey}','${task.id}')">Delete</button>
          </div>
        </div>
        <div class="wsubtasks-box" id="wsubtasks-${task.id}">
          <div class="wsubtask-list" id="wsubtask-list-${task.id}">${buildSubtaskListHtml(listKey, task)}</div>
          <div class="wsubtask-add-row">
            <input type="text" id="wsubtask-input-${task.id}" placeholder="Add a step…" class="wcomment-input"
                   onkeydown="if(event.key==='Enter')addSubtask('${listKey}','${task.id}')" />
            <button class="btn-sm" onclick="addSubtask('${listKey}','${task.id}')">+ Step</button>
          </div>
        </div>
        <div class="wcomments-box" id="wcomments-box-${task.id}">
          <div class="wcomment-list">${buildCommentListHtml(task.comments)}</div>
          <div class="wcomment-add-row">
            <input type="text" id="wcomment-input-${task.id}"
                   placeholder="Add a note or status update…" class="wcomment-input"
                   onkeydown="if(event.key==='Enter')addWorkComment('${listKey}','${task.id}')" />
            <button class="btn-sm" onclick="addWorkComment('${listKey}','${task.id}')">Save</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// PLAN MY DAY (full-day modal across all lists)
// ═══════════════════════════════════════════════════

function planMyDay() {
  const allTasks  = [];
  const listOrder = { daily: 0, onboarding: 1, panel: 2, longterm: 3, personal: 4 };
  const priOrder  = { high: 0, med: 1, low: 2 };

  Object.entries(WORK_LISTS).forEach(([key, meta]) => {
    (window.state.work[key] || []).forEach(t => {
      if (t.done) return;
      const undoneSteps = (t.subtasks || []).filter(s => !s.done);
      if (undoneSteps.length > 0) {
        const stepDur = Math.max(15, Math.round(t.duration / undoneSteps.length));
        undoneSteps.forEach(s => {
          allTasks.push({
            ...t,
            id:         `${t.id}_${s.id}`,
            text:       s.text,
            parentText: t.text,
            duration:   stepDur,
            listKey:    key,
            listLabel:  meta.label,
            isStep:     true,
          });
        });
      } else {
        allTasks.push({ ...t, listKey: key, listLabel: meta.label });
      }
    });
  });

  if (!allTasks.length) {
    showDayPlanModal(`
      <div class="day-plan-header">
        <div class="dp-title">⚡ Plan My Day</div>
        <button class="dp-close-btn" onclick="closeDayPlan()">✕</button>
      </div>
      <div class="day-plan-empty">
        <div style="font-size:52px;margin-bottom:12px">✅</div>
        <h3>All clear!</h3>
        <p>No outstanding tasks. Head to the Tasks tab to add some.</p>
      </div>`);
    return;
  }

  allTasks.sort((a, b) => {
    const ld = (listOrder[a.listKey] ?? 3) - (listOrder[b.listKey] ?? 3);
    if (ld !== 0) return ld;
    const pd = (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1);
    return pd !== 0 ? pd : a.duration - b.duration;
  });

  const end       = WORK_DAY_START_MINS + WORK_DAY_TOTAL_MINS;
  let   cursor    = WORK_DAY_START_MINS;
  let   lunchDone = false;
  const slots     = [];
  const missed    = [];

  for (const t of allTasks) {
    if (!lunchDone && cursor >= LUNCH_AT_MINS) {
      slots.push({ isBreak: true, start: LUNCH_AT_MINS, end: LUNCH_AT_MINS + LUNCH_DURATION });
      cursor    = LUNCH_AT_MINS + LUNCH_DURATION;
      lunchDone = true;
    }
    if (cursor + t.duration <= end) {
      slots.push({ ...t, start: cursor, end: cursor + t.duration });
      cursor += t.duration;
    } else {
      missed.push(t);
    }
  }

  const toTime = m => {
    const h = Math.floor(m / 60), min = m % 60, ampm = h < 12 ? 'AM' : 'PM';
    const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hh}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  const totalMins = slots.filter(s => !s.isBreak).reduce((n, s) => n + s.duration, 0);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  showDayPlanModal(`
    <div class="day-plan-header">
      <div>
        <div class="dp-title">⚡ Today's Plan</div>
        <div class="dp-subtitle">${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} · ${hrs}h${mins > 0 ? ` ${mins}m` : ''} of work</div>
      </div>
      <button class="dp-close-btn" onclick="closeDayPlan()">✕</button>
    </div>
    <div class="day-plan-schedule">
      ${slots.map(s => s.isBreak
        ? `<div class="day-plan-break">
             <span class="dp-time">${toTime(s.start)} – ${toTime(s.end)}</span>
             <span>🍽 Lunch break</span>
           </div>`
        : `<div class="day-plan-slot">
             <span class="dp-time">${toTime(s.start)} – ${toTime(s.end)}</span>
             <div class="dp-task-info">
               <span class="dp-task-name">${escWH(s.text)}</span>
               <span class="dp-task-meta">
                 ${s.isStep ? `<span class="dp-step-parent">📂 ${escWH(s.parentText)}</span> · ` : ''}${s.listLabel} · ${WORK_DURATIONS.find(d => d.val === s.duration)?.label || s.duration + 'm'}
               </span>
             </div>
             <span class="task-priority pri-${s.priority === 'high' ? 'high' : s.priority === 'med' ? 'med' : 'low'}">
               ${s.priority === 'high' ? 'High' : s.priority === 'med' ? 'Med' : 'Low'}
             </span>
           </div>`
      ).join('')}
    </div>
    ${missed.length ? `
      <div class="day-plan-deferred">
        <div class="dpd-title">⏭ Not enough time today (${missed.length} deferred):</div>
        ${missed.map(t => `<div class="dpd-item">· ${escWH(t.text)} <span>(${WORK_DURATIONS.find(d => d.val === t.duration)?.label || t.duration + 'm'})</span></div>`).join('')}
      </div>` : ''}`);
}

// ═══════════════════════════════════════════════════
// TASK REPOSITORY
// ═══════════════════════════════════════════════════

function toggleRepoSection() {
  const body  = document.getElementById('work-repo-body');
  const arrow = document.querySelector('.repo-arrow');
  if (body)  body.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
}

function getAllCompletedTasks() {
  const out = [];
  Object.entries(WORK_LISTS).forEach(([key, meta]) => {
    (window.state.work[key] || []).forEach(t => {
      if ((t.completions?.length || 0) > 0) {
        out.push({ ...t, listKey: key, listLabel: meta.label, listColor: meta.color, listIcon: meta.icon });
      }
    });
  });
  return out;
}

function refreshRepository() {
  const listEl  = document.getElementById('work-repo-list');
  const badgeEl = document.getElementById('repo-count-badge');
  if (!listEl) return;

  const search   = document.getElementById('work-repo-search')?.value.trim().toLowerCase() || '';
  const allDone  = getAllCompletedTasks();
  const filtered = search ? allDone.filter(t => t.text.toLowerCase().includes(search)) : allDone;

  // Sort by most recently completed
  filtered.sort((a, b) => {
    const aLast = Math.max(...(a.completions?.map(c => c.ts) || [0]));
    const bLast = Math.max(...(b.completions?.map(c => c.ts) || [0]));
    return bLast - aLast;
  });

  if (badgeEl) badgeEl.textContent = `${allDone.length} record${allDone.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    listEl.innerHTML = search
      ? `<div class="repo-empty">No completed tasks match "<strong>${escWH(search)}</strong>".</div>`
      : `<div class="repo-empty">No completed tasks yet. Tick off a task and it will appear here.</div>`;
    return;
  }

  const thisYear = new Date().getFullYear();

  listEl.innerHTML = filtered.map(t => {
    const yearCount  = (t.completions || []).filter(c => c.year === thisYear).length;
    const totalCount = (t.completions || []).length;
    const lastTs     = t.completions?.length ? Math.max(...t.completions.map(c => c.ts)) : null;
    const lastStr    = lastTs ? timeSince(new Date(lastTs)) : '—';
    const dur        = WORK_DURATIONS.find(d => d.val === t.duration)?.label || `${t.duration || '?'}m`;

    return `
      <div class="repo-item">
        <div class="repo-item-main">
          <div class="repo-item-info">
            <span class="repo-task-text">${escWH(t.text)}</span>
            <span class="wt-list-badge" style="background:${t.listColor}20;color:${t.listColor};margin-left:8px">${t.listIcon} ${t.listLabel}</span>
            <span class="work-dur-badge" style="margin-left:4px">${dur}</span>
          </div>
          <div class="repo-item-stats">
            <div class="repo-stat-block">
              <span class="repo-stat-val ${yearCount > 1 ? 'highlight' : ''}">${yearCount}</span>
              <span class="repo-stat-lbl">times in ${thisYear}</span>
            </div>
            <div class="repo-stat-block">
              <span class="repo-stat-val">${totalCount}</span>
              <span class="repo-stat-lbl">all time</span>
            </div>
            <span class="repo-stat-last">Last: ${lastStr}</span>
          </div>
          <div class="repo-readd-group">
            <select class="work-select" id="repo-target-${t.id}">
              ${Object.entries(WORK_LISTS).map(([k, m]) =>
                `<option value="${k}" ${k === t.listKey ? 'selected' : ''}>${m.icon} ${m.label}</option>`
              ).join('')}
            </select>
            <button class="repo-readd-btn" id="repo-readd-${t.id}"
                    onclick="reAddTask('${t.listKey}','${t.id}')">↩ Re-add</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function reAddTask(sourceListKey, sourceId) {
  const sourceTask   = (window.state.work[sourceListKey] || []).find(t => t.id === sourceId);
  if (!sourceTask) return;

  const targetListKey = document.getElementById(`repo-target-${sourceId}`)?.value || sourceListKey;
  if (!window.state.work[targetListKey]) window.state.work[targetListKey] = [];

  window.state.work[targetListKey].push({
    id:          'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    text:        sourceTask.text,
    priority:    sourceTask.priority,
    duration:    sourceTask.duration,
    deadline:    '',
    done:        false,
    comments:    [],
    completions: [...(sourceTask.completions || [])], // inherit history
    created:     Date.now(),
  });
  saveState();
  refreshWorkList(targetListKey);
  refreshWorkCount(targetListKey);
  refreshSummary();

  // Switch to tasks tab if not already there
  if (workTopTab !== 'tasks') {
    workTopTab = 'tasks';
    document.querySelectorAll('.work-top-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.work-top-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="tasks"]')?.classList.add('active');
    document.getElementById('wtp-tasks')?.classList.add('active');
  }

  const btn = document.getElementById(`repo-readd-${sourceId}`);
  if (btn) {
    btn.textContent = `Added to ${WORK_LISTS[targetListKey].label} ✓`;
    btn.style.cssText = 'background:var(--green);color:#fff;border-color:var(--green)';
    setTimeout(() => {
      btn.textContent = '↩ Re-add';
      btn.style.cssText = '';
    }, 2500);
  }
}

function timeSince(date) {
  const secs = Math.round((Date.now() - date) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  const days = Math.round(secs / 86400);
  if (days < 7)     return `${days}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function showDayPlanModal(html) {
  document.getElementById('day-plan-modal').innerHTML = html;
  document.getElementById('day-plan-overlay').classList.remove('hidden');
}

function closeDayPlan() {
  document.getElementById('day-plan-overlay').classList.add('hidden');
}
