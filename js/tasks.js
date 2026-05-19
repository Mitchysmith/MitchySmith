// ── Tasks ──
let taskFilter = 'all';

const CAT_COLORS_TASK = {
  work:'#6aadff', personal:'#ff7730', finance:'#4caf78',
  family:'#c084fc', health:'#f472b6', social:'#facc15',
};

const DAILY_COMPLETE_MSGS = [
  { emoji: '🏆', title: 'Daily list demolished!',    sub: 'Every single task done. That\'s a perfect day — you showed up and delivered. Go enjoy the rest of it.' },
  { emoji: '🔥', title: 'Absolutely on fire!',       sub: 'Daily list: cleared. You didn\'t just get things done today — you owned it. Seriously well done.' },
  { emoji: '⚡', title: 'Full send. Zero left.',     sub: 'All daily tasks complete. This is what momentum looks like — keep this energy into tomorrow.' },
  { emoji: '🎯', title: 'Bullseye. Every. Single. One.', sub: 'The entire daily list is done. That focus is rare and it shows. Take a breath — you\'ve earned it.' },
  { emoji: '🚀', title: 'Launched. Done. Nailed it.', sub: 'No tasks left on today\'s list. Whatever you do next, you\'ve already won today.' },
];

// ── Render shell ──
function renderTasks() {
  const el = document.getElementById('section-tasks');
  el.innerHTML = `
    <div class="page-header">
      <h1>Tasks</h1>
      <p>Daily list for today, monthly backlog for everything else.</p>
    </div>

    <div id="tasks-calendar-strip"></div>

    <!-- Monthly progress -->
    <div class="tasks-progress-wrap">
      <div class="tasks-progress-label">
        <span>Monthly Progress</span>
        <span class="pct" id="tasks-pct">0%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill progress-green" id="tasks-bar" style="width:0%"></div>
      </div>
    </div>

    <!-- ── TODAY'S LIST ── -->
    <div class="tasks-section-header">
      <div class="tasks-section-title">
        <span class="tasks-section-icon">☀️</span>
        Today's List
        <span class="tasks-count-pill" id="daily-count-pill">0</span>
      </div>
    </div>

    <div class="tasks-toolbar">
      <input type="text" id="daily-input" placeholder="Add a task for today…" />
      <select id="daily-priority" style="width:auto">
        <option value="high">High</option>
        <option value="med" selected>Medium</option>
        <option value="low">Low</option>
      </select>
      <button class="btn btn-primary" id="add-daily-btn">Add to Today</button>
    </div>

    <ul class="task-list" id="daily-list"></ul>

    <!-- ── MONTHLY BACKLOG ── -->
    <div class="tasks-section-header" style="margin-top:36px">
      <div class="tasks-section-title">
        <span class="tasks-section-icon">📋</span>
        Monthly Backlog
        <span class="tasks-count-pill" id="monthly-count-pill">0</span>
      </div>
      <div class="filter-tabs" style="margin-bottom:0">
        <div class="filter-tab active" data-filter="all">All</div>
        <div class="filter-tab" data-filter="high">High</div>
        <div class="filter-tab" data-filter="med">Med</div>
        <div class="filter-tab" data-filter="low">Low</div>
      </div>
    </div>

    <div class="tasks-toolbar">
      <input type="text" id="monthly-input" placeholder="Add to monthly backlog…" />
      <select id="monthly-priority" style="width:auto">
        <option value="high">High</option>
        <option value="med" selected>Medium</option>
        <option value="low">Low</option>
      </select>
      <button class="btn btn-ghost" id="add-monthly-btn">Add to Backlog</button>
    </div>

    <ul class="task-list" id="monthly-list"></ul>

    <!-- ── COMPLETED ── -->
    <div class="completed-toggle" id="completed-toggle">
      <span class="arrow">▶</span>
      <span>Completed</span>
      <span class="completed-count" id="completed-count">0</span>
      <span style="font-size:11px;color:var(--text-dim);margin-left:4px">— click checkbox to move back</span>
    </div>
    <ul class="task-list completed-list" id="completed-list"></ul>
  `;

  bindTaskEvents();
  refreshCalendarStrip();
  refreshAllLists();
}

// ── Event binding ──
function bindTaskEvents() {
  document.getElementById('add-daily-btn').addEventListener('click', () => addTask(true));
  document.getElementById('daily-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(true); });

  document.getElementById('add-monthly-btn').addEventListener('click', () => addTask(false));
  document.getElementById('monthly-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(false); });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      taskFilter = tab.dataset.filter;
      refreshAllLists();
    });
  });

  document.getElementById('completed-toggle').addEventListener('click', () => {
    document.getElementById('completed-toggle').classList.toggle('open');
    document.getElementById('completed-list').classList.toggle('open');
  });
}

// ── Add task ──
function addTask(isDaily) {
  const inputId = isDaily ? 'daily-input' : 'monthly-input';
  const priId   = isDaily ? 'daily-priority' : 'monthly-priority';
  const input   = document.getElementById(inputId);
  const text    = input.value.trim();
  if (!text) return;

  window.state.tasks.unshift({
    id:      Date.now(),
    text,
    priority: document.getElementById(priId).value,
    done:    false,
    isDaily: !!isDaily,
    month:   new Date().getMonth(),
  });

  saveState();
  input.value = '';
  refreshAllLists();
  refreshHome();
}

// ── Complete a task (with small celebration) ──
function completeTask(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task || task.done) return;

  // Shimmer the row
  const itemEl = document.querySelector(`[data-id="${id}"]`);
  if (itemEl) {
    itemEl.classList.add('completing');
    setTimeout(() => itemEl.classList.remove('completing'), 700);

    // Bounce the checkbox
    const chk = itemEl.querySelector('.task-check');
    if (chk) { chk.classList.add('bounce'); setTimeout(() => chk.classList.remove('bounce'), 500); }

    // Small emoji pop from task position
    smallCelebration(itemEl);
  }

  task.done = true;
  saveState();

  // Check if all daily tasks are now done
  const dailyPending = window.state.tasks.filter(t => t.isDaily && !t.done);
  const hadAnyDaily  = window.state.tasks.some(t => t.isDaily);

  setTimeout(() => {
    refreshAllLists();
    refreshHome();
    if (hadAnyDaily && dailyPending.length === 0 && task.isDaily) {
      // The last daily task was just ticked — wait a beat then CELEBRATE
      setTimeout(() => hugeCelebration(), 400);
    }
  }, 250);
}

// ── Untick a task (move back to active) ──
function untickTask(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = false;
  saveState();
  refreshAllLists();
  refreshHome();
}

// ── Move between daily and monthly ──
function moveToDaily(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task) return;
  task.isDaily = true;
  saveState();
  refreshAllLists();
}

function moveToMonthly(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task) return;
  task.isDaily = false;
  saveState();
  refreshAllLists();
}

// ── Delete ──
function deleteTask(id) {
  window.state.tasks = window.state.tasks.filter(t => t.id !== id);
  saveState();
  refreshAllLists();
  refreshHome();
}

// ── Refresh all lists + progress ──
function refreshAllLists() {
  const tasks    = window.state.tasks || [];
  const allDone  = tasks.filter(t => t.done);
  const total    = tasks.length;
  const pct      = total ? Math.round((allDone.length / total) * 100) : 0;

  // Progress bar
  const pctEl = document.getElementById('tasks-pct');
  const barEl = document.getElementById('tasks-bar');
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';

  // Daily list
  const dailyActive = tasks.filter(t => t.isDaily && !t.done);
  const dailyDone   = tasks.filter(t => t.isDaily && t.done);
  const pill        = document.getElementById('daily-count-pill');
  if (pill) {
    pill.textContent = dailyActive.length === 0 && tasks.some(t => t.isDaily)
      ? 'All done ✓' : dailyActive.length;
    pill.className = dailyActive.length === 0 && tasks.some(t => t.isDaily)
      ? 'tasks-count-pill daily-done' : 'tasks-count-pill';
  }

  const dailyEl = document.getElementById('daily-list');
  if (dailyEl) {
    dailyEl.innerHTML = dailyActive.length
      ? dailyActive.map(t => taskHtml(t)).join('')
      : `<div class="task-list-empty">${
          tasks.some(t => t.isDaily && t.done)
            ? '🎉 All done for today!'
            : 'Nothing here yet — add a task above or move one up from the backlog.'
        }</div>`;
    bindListActions(dailyEl);
  }

  // Monthly list (only non-daily, non-done)
  const monthly = tasks.filter(t => !t.isDaily && !t.done);
  const filtered = taskFilter === 'all' ? monthly : monthly.filter(t => t.priority === taskFilter);
  const monthPill = document.getElementById('monthly-count-pill');
  if (monthPill) monthPill.textContent = monthly.length;

  const monthlyEl = document.getElementById('monthly-list');
  if (monthlyEl) {
    monthlyEl.innerHTML = filtered.length
      ? filtered.map(t => taskHtml(t)).join('')
      : `<div class="task-list-empty">Backlog is clear. Add tasks above.</div>`;
    bindListActions(monthlyEl);
  }

  // Completed (all done tasks)
  const doneAll   = tasks.filter(t => t.done);
  const countEl   = document.getElementById('completed-count');
  const doneEl    = document.getElementById('completed-list');
  if (countEl) countEl.textContent = doneAll.length;
  if (doneEl) {
    doneEl.innerHTML = doneAll.length
      ? doneAll.map(t => taskHtml(t)).join('')
      : `<div class="task-list-empty" style="margin-bottom:8px">Nothing completed yet.</div>`;
    bindListActions(doneEl);
  }
}

// ── Build task HTML ──
function taskHtml(t) {
  const isDone   = t.done;
  const isDaily  = t.isDaily;

  // Action buttons differ based on state
  let actions = '';
  if (!isDone) {
    if (isDaily) {
      actions = `
        <button class="task-action-btn to-monthly" data-id="${t.id}" title="Move to backlog">↓ Backlog</button>
        <button class="task-action-btn delete"     data-id="${t.id}" title="Delete">✕</button>`;
    } else {
      actions = `
        <button class="task-action-btn to-daily"   data-id="${t.id}" title="Move to today">↑ Today</button>
        <button class="task-action-btn delete"      data-id="${t.id}" title="Delete">✕</button>`;
    }
  } else {
    actions = `<button class="task-action-btn delete" data-id="${t.id}" title="Delete">✕</button>`;
  }

  return `
    <li class="task-item ${isDone ? 'done' : ''} ${isDaily && !isDone ? 'is-daily' : ''}" data-id="${t.id}">
      <div class="task-check ${isDone ? 'checked' : ''}" data-id="${t.id}"></div>
      <span class="task-text">${t.text}</span>
      <span class="task-priority pri-${t.priority}">${t.priority}</span>
      <div class="task-actions">${actions}</div>
    </li>`;
}

// ── Bind click handlers on a rendered list ──
function bindListActions(listEl) {
  // Checkbox — complete or untick
  listEl.querySelectorAll('.task-check').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id   = +el.dataset.id;
      const task = window.state.tasks.find(t => t.id === id);
      if (!task) return;
      task.done ? untickTask(id) : completeTask(id);
    });
  });

  // Move to today
  listEl.querySelectorAll('.task-action-btn.to-daily').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); moveToDaily(+el.dataset.id); });
  });

  // Move to backlog
  listEl.querySelectorAll('.task-action-btn.to-monthly').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); moveToMonthly(+el.dataset.id); });
  });

  // Delete
  listEl.querySelectorAll('.task-action-btn.delete').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); deleteTask(+el.dataset.id); });
  });
}

// ── Small celebration: emoji floats up from the task ──
function smallCelebration(itemEl) {
  const emojis  = ['✅','⭐','✨','🎯','💪','👏','🔥'];
  const emoji   = emojis[Math.floor(Math.random() * emojis.length)];
  const rect    = itemEl.getBoundingClientRect();
  const pop     = document.createElement('div');
  pop.className = 'task-pop';
  pop.textContent = emoji;
  pop.style.left  = (rect.left + rect.width / 2 - 12) + 'px';
  pop.style.top   = (rect.top + window.scrollY - 10)  + 'px';
  document.body.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

// ── HUGE celebration: all daily tasks done ──
function hugeCelebration() {
  const msg = DAILY_COMPLETE_MSGS[Math.floor(Math.random() * DAILY_COMPLETE_MSGS.length)];

  // Full confetti storm
  massConfetti();

  // Overlay card
  const overlay = document.createElement('div');
  overlay.className = 'daily-complete-overlay';
  overlay.innerHTML = `
    <div class="daily-complete-card">
      <div class="daily-complete-emoji">${msg.emoji}</div>
      <div class="daily-complete-title">${msg.title}</div>
      <div class="daily-complete-sub">${msg.sub}</div>
      <div class="daily-complete-close">Tap anywhere to close</div>
    </div>`;
  document.body.appendChild(overlay);

  // Second confetti burst after a moment
  setTimeout(massConfetti, 600);

  overlay.addEventListener('click', () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  });

  // Auto close after 6s
  setTimeout(() => { if (overlay.parentNode) overlay.click(); }, 6000);
}

function massConfetti() {
  const colours = ['#ffe000','#4caf78','#6aadff','#ff7730','#c084fc','#f472b6','#fff','#facc15'];
  for (let i = 0; i < 120; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const size = 5 + Math.random() * 9;
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top:  ${-10 - Math.random() * 40}px;
      width: ${size}px;
      height: ${size}px;
      background: ${colours[Math.floor(Math.random() * colours.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 1}s;
      animation-duration: ${2 + Math.random() * 1.5}s;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Calendar strip (unchanged logic) ──
function refreshCalendarStrip() {
  const el = document.getElementById('tasks-calendar-strip');
  if (!el) return;

  const today   = new Date().toISOString().split('T')[0];
  const in7days = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
  const events  = (window.state.events || [])
    .filter(e => e.start >= today && e.start <= in7days)
    .sort((a,b) => a.start.localeCompare(b.start));

  if (!events.length) {
    el.innerHTML = `
      <div class="cal-strip-empty">
        <span class="cal-strip-icon">📅</span>
        <span>No events in the next 7 days — free space for your tasks below.</span>
        <a class="cal-strip-link" data-goto="calendar">Add to Calendar →</a>
      </div>`;
    el.querySelector('[data-goto]')?.addEventListener('click', () => gotoSection('calendar'));
    return;
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  el.innerHTML = `
    <div class="cal-strip-header">
      <span class="section-title" style="margin:0">Coming Up</span>
      <a class="cal-strip-link" data-goto="calendar">View Calendar →</a>
    </div>
    <div class="cal-strip-events">
      ${events.map(e => {
        const d   = new Date(e.start + 'T00:00:00');
        const col = CAT_COLORS_TASK[e.category] || '#6aadff';
        const isToday = e.start === today;
        return `
          <div class="cal-strip-event" style="border-left-color:${col}">
            <div class="cse-date" style="color:${col}">${isToday ? 'Today' : `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`}</div>
            <div class="cse-title">${e.title}</div>
            ${e.time ? `<div class="cse-time">${e.time}</div>` : ''}
            <button class="cse-task-btn" data-title="Prepare for: ${e.title}">+ Task</button>
          </div>`;
      }).join('')}
    </div>`;

  el.querySelector('[data-goto]')?.addEventListener('click', () => gotoSection('calendar'));
  el.querySelectorAll('.cse-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('daily-input');
      if (input) { input.value = btn.dataset.title; input.focus(); }
    });
  });
}

function gotoSection(name) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');
  document.getElementById(`section-${name}`)?.classList.add('active');
}

function refreshHome() {
  const homeEl = document.getElementById('section-home');
  if (homeEl?.classList.contains('active')) renderHome();
}
