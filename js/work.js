// ── Work – Task Manager ──

const WORK_LISTS = {
  daily:      { label: 'Daily',         icon: '☀️', desc: 'Tasks to get done today' },
  longterm:   { label: 'Long Term',     icon: '🗂️', desc: 'Projects and ongoing work items' },
  onboarding: { label: 'Onboarding',    icon: '🚀', desc: 'Onboarding checklist items' },
  panel:      { label: 'Panel Reviews', icon: '📋', desc: 'Client panel reviews (~45 min each)' },
};

const WORK_DURATIONS = [
  { val: 15,  label: '15 min' },
  { val: 30,  label: '30 min' },
  { val: 45,  label: '45 min' },
  { val: 60,  label: '1 hour' },
  { val: 90,  label: '1.5 hrs' },
  { val: 120, label: '2 hours' },
  { val: 180, label: '3 hours' },
];

const WORK_DAY_START_MINS = 8 * 60;   // 8:00 AM
const WORK_DAY_TOTAL_MINS = 420;      // 7 hours
const LUNCH_AT_MINS       = 12 * 60;  // noon
const LUNCH_DURATION      = 30;

let activeWorkList = 'daily';

// ── Render shell ──
function renderWork() {
  if (!window.state.work) {
    window.state.work = { daily: [], longterm: [], onboarding: [], panel: [] };
    saveState();
  }

  const el = document.getElementById('section-work');
  el.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>Work</h1>
        <p>Daily tasks, long-term projects, onboarding, and panel reviews.</p>
      </div>
      <button class="btn btn-primary" id="plan-day-btn">⚡ Plan My Day</button>
    </div>

    <div class="work-tabs">
      ${Object.entries(WORK_LISTS).map(([key, meta]) => `
        <button class="work-tab ${key === activeWorkList ? 'active' : ''}" data-list="${key}">
          <span>${meta.icon}</span>
          <span>${meta.label}</span>
          <span class="work-tab-count" id="wcount-${key}">0</span>
        </button>`).join('')}
    </div>

    ${Object.keys(WORK_LISTS).map(key => `
      <div class="work-panel ${key === activeWorkList ? 'active' : ''}" id="work-panel-${key}">
        <div class="work-add-row">
          <input type="text" id="winput-${key}" placeholder="Add a task to ${WORK_LISTS[key].label}…" class="work-text-input" />
          <select id="wpri-${key}" class="work-select">
            <option value="high">High</option>
            <option value="med" selected>Medium</option>
            <option value="low">Low</option>
          </select>
          <select id="wdur-${key}" class="work-select">
            ${WORK_DURATIONS.map(d =>
              `<option value="${d.val}" ${(key === 'panel' && d.val === 45) || (key !== 'panel' && d.val === 30) ? 'selected' : ''}>${d.label}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary" onclick="addWorkTask('${key}')">Add</button>
        </div>
        <ul class="work-list" id="wlist-${key}"></ul>
      </div>`).join('')}

    <!-- Plan My Day overlay -->
    <div class="work-day-plan-overlay hidden" id="day-plan-overlay">
      <div class="work-day-plan-modal" id="day-plan-modal"></div>
    </div>
  `;

  // Tab switching
  el.querySelectorAll('.work-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeWorkList = btn.dataset.list;
      el.querySelectorAll('.work-tab').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.work-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`work-panel-${activeWorkList}`).classList.add('active');
    });
  });

  // Enter key to add
  Object.keys(WORK_LISTS).forEach(key => {
    document.getElementById(`winput-${key}`).addEventListener('keydown', e => {
      if (e.key === 'Enter') addWorkTask(key);
    });
  });

  document.getElementById('plan-day-btn').addEventListener('click', planMyDay);

  document.getElementById('day-plan-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDayPlan();
  });

  refreshAllWorkLists();
}

// ── CRUD ──
function addWorkTask(listKey) {
  const input = document.getElementById(`winput-${listKey}`);
  const text  = input.value.trim();
  if (!text) return;

  if (!window.state.work[listKey]) window.state.work[listKey] = [];
  window.state.work[listKey].push({
    id:       'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    text,
    priority: document.getElementById(`wpri-${listKey}`).value,
    duration: +document.getElementById(`wdur-${listKey}`).value,
    done:     false,
    comments: [],
    created:  Date.now(),
  });
  saveState();
  input.value = '';
  refreshWorkList(listKey);
  refreshWorkCount(listKey);
}

function toggleWorkDone(listKey, id) {
  const task = (window.state.work[listKey] || []).find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveState();
  refreshWorkList(listKey);
  refreshWorkCount(listKey);
}

function deleteWorkTask(listKey, id) {
  window.state.work[listKey] = (window.state.work[listKey] || []).filter(t => t.id !== id);
  saveState();
  refreshWorkList(listKey);
  refreshWorkCount(listKey);
}

// ── Comments ──
function toggleWorkComments(id) {
  const box = document.getElementById(`wcomments-box-${id}`);
  const btn = document.querySelector(`[data-comment-toggle="${id}"]`);
  if (box) box.classList.toggle('open');
  if (btn) btn.classList.toggle('open');
}

function addWorkComment(listKey, id) {
  const input = document.getElementById(`wcomment-input-${id}`);
  const text  = input.value.trim();
  if (!text) return;

  const task = (window.state.work[listKey] || []).find(t => t.id === id);
  if (!task) return;

  if (!task.comments) task.comments = [];
  task.comments.push({ text, ts: Date.now() });
  saveState();
  input.value = '';

  // Re-render just the comment list within the open box
  const list = document.querySelector(`#wcomments-box-${id} .wcomment-list`);
  if (list) list.innerHTML = buildCommentListHtml(task.comments);

  // Update comment count badge
  const btn = document.querySelector(`[data-comment-toggle="${id}"]`);
  if (btn) {
    btn.textContent = `💬 ${task.comments.length}`;
    btn.classList.add('has-comments');
  }
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── List render ──
function refreshAllWorkLists() {
  Object.keys(WORK_LISTS).forEach(key => {
    refreshWorkList(key);
    refreshWorkCount(key);
  });
}

function refreshWorkCount(listKey) {
  const count = (window.state.work[listKey] || []).filter(t => !t.done).length;
  const el    = document.getElementById(`wcount-${listKey}`);
  if (el) el.textContent = count;
}

function refreshWorkList(listKey) {
  const ul = document.getElementById(`wlist-${listKey}`);
  if (!ul) return;

  const tasks = window.state.work[listKey] || [];
  if (!tasks.length) {
    ul.innerHTML = `<li class="task-list-empty">${WORK_LISTS[listKey].desc} — nothing here yet.</li>`;
    return;
  }

  const priOrder = { high: 0, med: 1, low: 2 };
  const sorted   = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priOrder[a.priority] || 1) - (priOrder[b.priority] || 1);
  });

  ul.innerHTML = sorted.map(task => {
    const commentCount = task.comments?.length || 0;
    const durLabel     = WORK_DURATIONS.find(d => d.val === task.duration)?.label || `${task.duration}m`;
    const priKey       = task.priority === 'high' ? 'high' : task.priority === 'med' ? 'med' : 'low';
    const priLabel     = priKey === 'high' ? 'High' : priKey === 'med' ? 'Med' : 'Low';

    return `
      <li class="work-item ${task.done ? 'done' : ''}" id="witem-${task.id}">
        <div class="work-item-main">
          <div class="task-check ${task.done ? 'checked' : ''}"
               onclick="toggleWorkDone('${listKey}','${task.id}')">
            ${task.done ? '<span>✓</span>' : ''}
          </div>
          <span class="task-text">${escWH(task.text)}</span>
          <span class="task-priority pri-${priKey}">${priLabel}</span>
          <span class="work-dur-badge">${durLabel}</span>
          <div class="task-actions">
            <button class="task-action-btn ${commentCount > 0 ? 'has-comments' : ''}"
                    data-comment-toggle="${task.id}"
                    onclick="toggleWorkComments('${task.id}')">
              💬 ${commentCount > 0 ? commentCount : 'Note'}
            </button>
            <button class="task-action-btn delete"
                    onclick="deleteWorkTask('${listKey}','${task.id}')">Delete</button>
          </div>
        </div>

        <div class="wcomments-box" id="wcomments-box-${task.id}">
          <div class="wcomment-list">${buildCommentListHtml(task.comments)}</div>
          <div class="wcomment-add-row">
            <input type="text" id="wcomment-input-${task.id}"
                   placeholder="Add a note or update…" class="wcomment-input"
                   onkeydown="if(event.key==='Enter')addWorkComment('${listKey}','${task.id}')" />
            <button class="btn btn-sm" onclick="addWorkComment('${listKey}','${task.id}')">Save</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

// ── Plan My Day ──
function planMyDay() {
  // Gather all undone tasks across lists
  const allTasks = [];
  Object.entries(WORK_LISTS).forEach(([key, meta]) => {
    (window.state.work[key] || []).forEach(t => {
      if (!t.done) allTasks.push({ ...t, listKey: key, listLabel: meta.label });
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
        <p>No outstanding work tasks. Add some tasks and come back.</p>
      </div>`);
    return;
  }

  // Sort: daily first, then priority, then shorter tasks first
  const listOrder = { daily: 0, onboarding: 1, panel: 2, longterm: 3 };
  const priOrder  = { high: 0, med: 1, low: 2 };
  allTasks.sort((a, b) => {
    const ld = (listOrder[a.listKey] ?? 3) - (listOrder[b.listKey] ?? 3);
    if (ld !== 0) return ld;
    const pd = (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1);
    if (pd !== 0) return pd;
    return a.duration - b.duration;
  });

  // Time-block from 8 AM, insert lunch at noon
  const end        = WORK_DAY_START_MINS + WORK_DAY_TOTAL_MINS;
  let   cursor     = WORK_DAY_START_MINS;
  let   lunchDone  = false;
  const scheduled  = [];
  const deferred   = [];

  for (const task of allTasks) {
    if (!lunchDone && cursor >= LUNCH_AT_MINS) {
      scheduled.push({ isBreak: true, start: LUNCH_AT_MINS, end: LUNCH_AT_MINS + LUNCH_DURATION });
      cursor   = LUNCH_AT_MINS + LUNCH_DURATION;
      lunchDone = true;
    }
    if (cursor + task.duration <= end) {
      scheduled.push({ ...task, start: cursor, end: cursor + task.duration });
      cursor += task.duration;
    } else {
      deferred.push(task);
    }
  }

  const toTime = mins => {
    const h    = Math.floor(mins / 60);
    const m    = mins % 60;
    const ampm = h < 12 ? 'AM' : 'PM';
    const hh   = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const totalTaskMins = scheduled.filter(s => !s.isBreak).reduce((n, s) => n + s.duration, 0);
  const hrs  = Math.floor(totalTaskMins / 60);
  const mins = totalTaskMins % 60;

  const slotsHtml = scheduled.map(s => {
    if (s.isBreak) return `
      <div class="day-plan-break">
        <span class="dp-time">${toTime(s.start)} – ${toTime(s.end)}</span>
        <span class="dp-break-label">🍽 Lunch break</span>
      </div>`;

    const durLabel = WORK_DURATIONS.find(d => d.val === s.duration)?.label || `${s.duration}m`;
    const priKey   = s.priority === 'high' ? 'high' : s.priority === 'med' ? 'med' : 'low';
    const priLabel = priKey === 'high' ? 'High' : priKey === 'med' ? 'Med' : 'Low';
    return `
      <div class="day-plan-slot">
        <span class="dp-time">${toTime(s.start)} – ${toTime(s.end)}</span>
        <div class="dp-task-info">
          <span class="dp-task-name">${escWH(s.text)}</span>
          <span class="dp-task-meta">${s.listLabel} · ${durLabel}</span>
        </div>
        <span class="task-priority pri-${priKey}">${priLabel}</span>
      </div>`;
  }).join('');

  const deferredHtml = deferred.length ? `
    <div class="day-plan-deferred">
      <div class="dpd-title">⏭ Not enough time today (${deferred.length} deferred):</div>
      ${deferred.map(t => {
        const dur = WORK_DURATIONS.find(d => d.val === t.duration)?.label || `${t.duration}m`;
        return `<div class="dpd-item">· ${escWH(t.text)} <span>(${dur})</span></div>`;
      }).join('')}
    </div>` : '';

  showDayPlanModal(`
    <div class="day-plan-header">
      <div>
        <div class="dp-title">⚡ Today's Plan</div>
        <div class="dp-subtitle">${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} · ${hrs}h${mins > 0 ? ` ${mins}m` : ''} of work</div>
      </div>
      <button class="dp-close-btn" onclick="closeDayPlan()">✕</button>
    </div>
    <div class="day-plan-schedule">${slotsHtml}</div>
    ${deferredHtml}
  `);
}

function showDayPlanModal(html) {
  document.getElementById('day-plan-modal').innerHTML = html;
  document.getElementById('day-plan-overlay').classList.remove('hidden');
}

function closeDayPlan() {
  document.getElementById('day-plan-overlay').classList.add('hidden');
}
