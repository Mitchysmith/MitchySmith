// ── Tasks / Monthly Whiteboard ──
let lastCompleted = null;
let undoTimer     = null;
let taskFilter    = 'all';

function renderTasks() {
  const el = document.getElementById('section-tasks');
  el.innerHTML = `
    <div class="page-header">
      <h1>Tasks</h1>
      <p>Your monthly whiteboard — tick things off and keep moving.</p>
    </div>

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
  refreshTaskList();
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
    const tog = document.getElementById('completed-toggle');
    const lst = document.getElementById('completed-list');
    tog.classList.toggle('open');
    lst.classList.toggle('open');
  });
}

function addTask() {
  const input = document.getElementById('task-input');
  const pri   = document.getElementById('task-priority').value;
  const text  = input.value.trim();
  if (!text) return;

  const newTask = {
    id:       Date.now(),
    text,
    priority: pri,
    done:     false,
    month:    new Date().getMonth(),
  };

  window.state.tasks.unshift(newTask);
  saveState();
  input.value = '';
  refreshTaskList();
  refreshHome();
}

function completeTask(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task || task.done) return;

  // Shimmer animation
  const itemEl = document.querySelector(`[data-id="${id}"]`);
  if (itemEl) {
    itemEl.classList.add('completing');
    setTimeout(() => itemEl.classList.remove('completing'), 600);
  }

  lastCompleted = { ...task };
  task.done = true;
  saveState();

  // Show undo
  showUndo(task.text);

  setTimeout(() => {
    refreshTaskList();
    refreshHome();
  }, 300);
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
  const area = document.getElementById('undo-area');
  if (area) area.innerHTML = '';
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
  const pending   = window.state.tasks.filter(t => !t.done);
  const done      = window.state.tasks.filter(t => t.done);
  const filtered  = taskFilter === 'all' ? pending : pending.filter(t => t.priority === taskFilter);
  const total     = window.state.tasks.length;
  const pct       = total ? Math.round((done.length / total) * 100) : 0;

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

  const doneEl    = document.getElementById('completed-list');
  const countEl   = document.getElementById('completed-count');
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
