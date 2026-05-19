// ── Tasks – linked to Calendar ──
let lastCompleted = null;
let undoTimer     = null;
let taskFilter    = 'all';

const CAT_COLORS_TASK = {
  work:'#6aadff', personal:'#ff7730', finance:'#4caf78',
  family:'#c084fc', health:'#f472b6', social:'#facc15',
};

function renderTasks() {
  const el = document.getElementById('section-tasks');
  el.innerHTML = `
    <div class="page-header">
      <h1>Tasks</h1>
      <p>Your monthly whiteboard — linked to your calendar so nothing slips.</p>
    </div>

    <!-- Calendar events for today & upcoming -->
    <div id="tasks-calendar-strip"></div>

    <div class="tasks-toolbar">
      <input type="text" id="task-input" placeholder="Add a new task…" />
      <select id="task-priority" style="width:auto">
        <option value="high">High</option>
        <option value="med" selected>Medium</option>
        <option value="low">Low</option>
      </select>
      <button class="btn btn-primary" id="add-task-btn">Add</button>
    </div>

    <div class="filter-tabs mb-16">
      <div class="filter-tab active" data-filter="all">All</div>
      <div class="filter-tab" data-filter="high">High</div>
      <div class="filter-tab" data-filter="med">Medium</div>
      <div class="filter-tab" data-filter="low">Low</div>
    </div>

    <div class="tasks-progress-wrap">
      <div class="tasks-progress-label">
        <span>Monthly Progress</span>
        <span class="pct" id="tasks-pct">0%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill progress-green" id="tasks-bar" style="width:0%"></div>
      </div>
    </div>

    <div id="undo-area"></div>

    <ul class="task-list" id="task-list"></ul>

    <div class="completed-toggle" id="completed-toggle">
      <span class="arrow">▶</span>
      <span>Completed</span>
      <span class="completed-count" id="completed-count">0</span>
    </div>
    <ul class="task-list completed-list" id="completed-list"></ul>
  `;

  bindTaskEvents();
  refreshCalendarStrip();
  refreshTaskList();
}

// ── Calendar strip at top of Tasks ──
function refreshCalendarStrip() {
  const el = document.getElementById('tasks-calendar-strip');
  if (!el) return;

  const today     = new Date().toISOString().split('T')[0];
  const in7days   = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];

  const events = (window.state.events || [])
    .filter(e => e.start >= today && e.start <= in7days)
    .sort((a,b) => a.start.localeCompare(b.start));

  if (!events.length) {
    el.innerHTML = `
      <div class="cal-strip-empty">
        <span class="cal-strip-icon">📅</span>
        <span>No events in the next 7 days — use the free space below for your tasks.</span>
        <a class="cal-strip-link" data-goto="calendar">Add to Calendar →</a>
      </div>`;
    el.querySelector('[data-goto]')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelector('[data-section="calendar"]')?.classList.add('active');
      document.getElementById('section-calendar')?.classList.add('active');
    });
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
            <div class="cse-date" style="color:${col}">
              ${isToday ? 'Today' : `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`}
            </div>
            <div class="cse-title">${e.title}</div>
            ${e.time ? `<div class="cse-time">${e.time}</div>` : ''}
            <button class="cse-task-btn" data-title="Prepare for: ${e.title}" title="Add as task">+ Task</button>
          </div>`;
      }).join('')}
    </div>`;

  el.querySelector('[data-goto]')?.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-section="calendar"]')?.classList.add('active');
    document.getElementById('section-calendar')?.classList.add('active');
  });

  el.querySelectorAll('.cse-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('task-input');
      if (input) {
        input.value = btn.dataset.title;
        input.focus();
      }
    });
  });
}

function bindTaskEvents() {
  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      taskFilter = tab.dataset.filter;
      refreshTaskList();
    });
  });

  document.getElementById('completed-toggle').addEventListener('click', () => {
    document.getElementById('completed-toggle').classList.toggle('open');
    document.getElementById('completed-list').classList.toggle('open');
  });
}

function addTask() {
  const input = document.getElementById('task-input');
  const pri   = document.getElementById('task-priority').value;
  const text  = input.value.trim();
  if (!text) return;

  window.state.tasks.unshift({
    id: Date.now(), text, priority: pri, done: false, month: new Date().getMonth(),
  });
  saveState();
  input.value = '';
  refreshTaskList();
  refreshHome();
}

function completeTask(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task || task.done) return;

  const itemEl = document.querySelector(`[data-id="${id}"]`);
  if (itemEl) {
    itemEl.classList.add('completing');
    setTimeout(() => itemEl.classList.remove('completing'), 600);
  }

  lastCompleted = { ...task };
  task.done = true;
  saveState();
  showUndo(task.text);
  setTimeout(() => { refreshTaskList(); refreshHome(); }, 300);
}

function showUndo(text) {
  clearTimeout(undoTimer);
  const area = document.getElementById('undo-area');
  if (!area) return;
  area.innerHTML = `
    <div class="undo-bar">
      <span>"${text}" marked as done.</span>
      <button class="undo-btn" id="undo-btn">Undo</button>
    </div>`;
  document.getElementById('undo-btn').addEventListener('click', undoComplete);
  undoTimer = setTimeout(() => { if (area) area.innerHTML = ''; lastCompleted = null; }, 6000);
}

function undoComplete() {
  if (!lastCompleted) return;
  const task = window.state.tasks.find(t => t.id === lastCompleted.id);
  if (task) task.done = false;
  saveState();
  clearTimeout(undoTimer);
  document.getElementById('undo-area').innerHTML = '';
  lastCompleted = null;
  refreshTaskList();
  refreshHome();
}

function deleteTask(id) {
  window.state.tasks = window.state.tasks.filter(t => t.id !== id);
  saveState();
  refreshTaskList();
  refreshHome();
}

function refreshTaskList() {
  const pending  = window.state.tasks.filter(t => !t.done);
  const done     = window.state.tasks.filter(t => t.done);
  const filtered = taskFilter === 'all' ? pending : pending.filter(t => t.priority === taskFilter);
  const total    = window.state.tasks.length;
  const pct      = total ? Math.round((done.length / total) * 100) : 0;

  const pctEl = document.getElementById('tasks-pct');
  const barEl = document.getElementById('tasks-bar');
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';

  const listEl = document.getElementById('task-list');
  if (listEl) {
    listEl.innerHTML = filtered.map(t => taskHtml(t, false)).join('');
    listEl.querySelectorAll('.task-check').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); completeTask(+el.dataset.id); });
    });
    listEl.querySelectorAll('.task-delete').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); deleteTask(+el.dataset.id); });
    });
  }

  const doneEl  = document.getElementById('completed-list');
  const countEl = document.getElementById('completed-count');
  if (countEl) countEl.textContent = done.length;
  if (doneEl) {
    doneEl.innerHTML = done.map(t => taskHtml(t, true)).join('');
    doneEl.querySelectorAll('.task-delete').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); deleteTask(+el.dataset.id); });
    });
  }
}

function taskHtml(t, isDone) {
  return `
    <li class="task-item ${isDone ? 'done' : ''}" data-id="${t.id}">
      <div class="task-check ${isDone ? 'checked' : ''}" data-id="${t.id}"></div>
      <span class="task-text">${t.text}</span>
      <span class="task-priority pri-${t.priority}">${t.priority}</span>
      <button class="task-delete" data-id="${t.id}" title="Delete">✕</button>
    </li>`;
}

function refreshHome() {
  const homeEl = document.getElementById('section-home');
  if (homeEl && homeEl.classList.contains('active')) renderHome();
}
