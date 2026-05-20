// ── Tasks – Family Daily Planner ──

let _weekSelected = null;

// ── Helpers ──
function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _weekDays() {
  const todayStr = _todayStr();
  const today    = new Date(todayStr + 'T00:00:00');
  const dow      = today.getDay();
  const monday   = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d  = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    return {
      date:    ds,
      label:   ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
      num:     d.getDate(),
      isToday: ds === todayStr,
      isPast:  ds < todayStr,
    };
  });
}

function _getTaskPeople() {
  return window.state.householdMembers || [];
}

function _saveTaskPerson(name) {
  if (!name) return;
  if (!window.state.householdMembers) window.state.householdMembers = [];
  if (!window.state.householdMembers.includes(name)) {
    window.state.householdMembers.push(name);
    saveState();
  }
}

// ── Render shell ──
function renderTasks() {
  _weekSelected = _todayStr();
  const el = document.getElementById('section-tasks');
  if (!el) return;

  const now      = new Date();
  const dateStr  = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour     = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  el.innerHTML = `
    <div class="tp-header">
      <div>
        <h1 class="tp-greeting">${greeting}, Mitch</h1>
        <p class="tp-date">${dateStr}</p>
      </div>
      <div class="tp-stats-row" id="tp-stats-row"></div>
    </div>

    <div class="tp-section-lbl">☀️ Today</div>
    <div class="tp-today-grid">
      <div class="tp-loc-card">
        <div class="tp-loc-hdr">
          <span>🏠</span>
          <span class="tp-loc-title">At Home</span>
          <span class="tp-loc-pill" id="tp-home-pill">0</span>
        </div>
        <div class="tp-quick-add">
          <input class="tp-input" id="tp-home-input" placeholder="Add home task…" />
          <select class="tp-mini-select" id="tp-home-pri">
            <option value="high">High</option>
            <option value="med" selected>Med</option>
            <option value="low">Low</option>
          </select>
          <input class="tp-input tp-who-input" id="tp-home-who" list="tp-people-list" placeholder="Who?" />
          <button class="tp-qadd-btn" onclick="quickAddTask('home')">+</button>
        </div>
        <ul class="tp-list" id="tp-home-list"></ul>
      </div>

      <div class="tp-loc-card">
        <div class="tp-loc-hdr">
          <span>🚗</span>
          <span class="tp-loc-title">Out &amp; About</span>
          <span class="tp-loc-pill" id="tp-out-pill">0</span>
        </div>
        <div class="tp-quick-add">
          <input class="tp-input" id="tp-out-input" placeholder="Add errand or outing…" />
          <select class="tp-mini-select" id="tp-out-pri">
            <option value="high">High</option>
            <option value="med" selected>Med</option>
            <option value="low">Low</option>
          </select>
          <input class="tp-input tp-who-input" id="tp-out-who" list="tp-people-list" placeholder="Who?" />
          <button class="tp-qadd-btn" onclick="quickAddTask('out')">+</button>
        </div>
        <ul class="tp-list" id="tp-out-list"></ul>
      </div>
    </div>

    <datalist id="tp-people-list"></datalist>

    <div class="tp-section-lbl" style="margin-top:32px">📅 This Week</div>
    <div class="tp-week-strip" id="tp-week-strip"></div>
    <div class="tp-week-panel" id="tp-week-panel"></div>

    <div class="tp-section-lbl" style="margin-top:32px">🛒 Shopping &amp; Errands</div>
    <div class="tp-shop-wrap">
      <div class="tp-quick-add">
        <input class="tp-input" id="tp-shop-input" placeholder="Add item or errand…" />
        <button class="tp-qadd-btn" onclick="addShoppingItem()">+</button>
      </div>
      <ul class="tp-list" id="tp-shop-list"></ul>
    </div>

    <div class="tp-section-lbl tp-backlog-lbl" style="margin-top:32px" id="tp-backlog-toggle" onclick="toggleBacklog()">
      📋 Someday / Backlog
      <span class="tp-backlog-arrow">▶</span>
      <span class="tp-loc-pill" id="tp-backlog-pill">0</span>
    </div>
    <div id="tp-backlog-wrap" style="display:none">
      <div class="tp-quick-add" style="margin-bottom:10px">
        <input class="tp-input" id="tp-backlog-input" placeholder="Add to someday list…" />
        <button class="tp-qadd-btn" onclick="addBacklogTask()">+</button>
      </div>
      <ul class="tp-list" id="tp-backlog-list"></ul>
    </div>
  `;

  document.getElementById('tp-home-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') quickAddTask('home'); });
  document.getElementById('tp-out-input')?.addEventListener('keydown',  e => { if (e.key === 'Enter') quickAddTask('out'); });
  document.getElementById('tp-shop-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addShoppingItem(); });
  document.getElementById('tp-backlog-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') addBacklogTask(); });

  refreshTasksView();
}

// ── Add today task ──
function quickAddTask(location) {
  const inputId = location === 'home' ? 'tp-home-input' : 'tp-out-input';
  const priId   = location === 'home' ? 'tp-home-pri'   : 'tp-out-pri';
  const whoId   = location === 'home' ? 'tp-home-who'   : 'tp-out-who';
  const input   = document.getElementById(inputId);
  const text    = input?.value.trim();
  if (!text) return;

  const who = document.getElementById(whoId)?.value.trim() || '';
  _saveTaskPerson(who);

  window.state.tasks.unshift({
    id:       Date.now(),
    text,
    priority: document.getElementById(priId)?.value || 'med',
    done:     false,
    location,
    assignee: who,
    dueDate:  _todayStr(),
    isDaily:  true,
    month:    new Date().getMonth(),
  });

  saveState();
  if (input) input.value = '';
  const whoEl = document.getElementById(whoId);
  if (whoEl) whoEl.value = '';
  refreshTasksView();
  refreshHome();
}

// ── Add week-panel task (for any selected day) ──
function quickAddWeekTask(location) {
  const input = document.getElementById(`tp-week-${location}-input`);
  const text  = input?.value.trim();
  if (!text) return;

  const who = document.getElementById(`tp-week-${location}-who`)?.value.trim() || '';
  _saveTaskPerson(who);

  window.state.tasks.unshift({
    id:       Date.now(),
    text,
    priority: document.getElementById(`tp-week-${location}-pri`)?.value || 'med',
    done:     false,
    location,
    assignee: who,
    dueDate:  _weekSelected,
    isDaily:  _weekSelected === _todayStr(),
    month:    new Date().getMonth(),
  });

  saveState();
  if (input) input.value = '';
  refreshTasksView();
}

// ── Toggle done ──
function toggleTask(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task) return;
  const wasDone = task.done;
  task.done = !task.done;
  saveState();

  if (!wasDone) {
    const el = document.querySelector(`[data-tid="${id}"]`);
    if (el) {
      el.classList.add('tp-completing');
      smallCelebration(el);
      setTimeout(() => {
        el.classList.remove('tp-completing');
        refreshTasksView();
        refreshHome();
        checkDailyCelebration();
      }, 600);
      return;
    }
  }
  refreshTasksView();
  refreshHome();
}

function checkDailyCelebration() {
  const today    = _todayStr();
  const todayAll = (window.state.tasks || []).filter(t =>
    t.dueDate === today || (!t.dueDate && t.isDaily)
  );
  if (todayAll.length > 0 && todayAll.every(t => t.done)) {
    setTimeout(() => hugeCelebration(), 300);
  }
}

// ── Delete ──
function deleteTask(id) {
  window.state.tasks = window.state.tasks.filter(t => t.id !== id);
  saveState();
  refreshTasksView();
  refreshHome();
}

// ── Backlog ──
function addBacklogTask() {
  const input = document.getElementById('tp-backlog-input');
  const text  = input?.value.trim();
  if (!text) return;

  window.state.tasks.unshift({
    id:       Date.now(),
    text,
    priority: 'med',
    done:     false,
    location: 'home',
    assignee: '',
    dueDate:  null,
    isDaily:  false,
    month:    new Date().getMonth(),
  });

  saveState();
  if (input) input.value = '';
  refreshTasksView();
}

function moveToToday(id) {
  const task = window.state.tasks.find(t => t.id === id);
  if (!task) return;
  task.dueDate  = _todayStr();
  task.isDaily  = true;
  saveState();
  refreshTasksView();
  refreshHome();
}

function toggleBacklog() {
  const wrap  = document.getElementById('tp-backlog-wrap');
  const arrow = document.querySelector('.tp-backlog-arrow');
  if (!wrap) return;
  const open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▶' : '▼';
}

// ── Shopping ──
function addShoppingItem() {
  const input = document.getElementById('tp-shop-input');
  const text  = input?.value.trim();
  if (!text) return;
  if (!window.state.shopping) window.state.shopping = [];
  window.state.shopping.unshift({ id: Date.now(), text, done: false });
  saveState();
  if (input) input.value = '';
  renderShoppingList();
  renderStats();
}

function toggleShoppingItem(id) {
  const item = (window.state.shopping || []).find(i => i.id === id);
  if (!item) return;
  item.done = !item.done;
  saveState();
  renderShoppingList();
  renderStats();
}

function deleteShoppingItem(id) {
  window.state.shopping = (window.state.shopping || []).filter(i => i.id !== id);
  saveState();
  renderShoppingList();
  renderStats();
}

function clearDoneShoppingItems() {
  window.state.shopping = (window.state.shopping || []).filter(i => !i.done);
  saveState();
  renderShoppingList();
}

// ── Refresh all ──
function refreshTasksView() {
  renderTodayTasks();
  renderWeekStrip();
  renderWeekPanel();
  renderShoppingList();
  renderBacklogList();
  renderStats();
  updatePeopleDatalist();
}

function renderStats() {
  const el = document.getElementById('tp-stats-row');
  if (!el) return;
  const today     = _todayStr();
  const todayAll  = (window.state.tasks || []).filter(t =>
    t.dueDate === today || (!t.dueDate && t.isDaily)
  );
  const done      = todayAll.filter(t => t.done).length;
  const total     = todayAll.length;
  const pct       = total ? Math.round(done / total * 100) : 0;
  const shopping  = (window.state.shopping || []).filter(i => !i.done).length;
  const allDone   = total > 0 && done === total;

  el.innerHTML = `
    <div class="tp-stat-chip ${allDone ? 'all-done' : ''}">
      <span class="tp-stat-num">${done}/${total}</span>
      <span class="tp-stat-lbl">today</span>
    </div>
    ${total > 0 ? `<div class="tp-prog-wrap"><div class="tp-prog-fill" style="width:${pct}%"></div></div>` : ''}
    ${shopping > 0 ? `<div class="tp-stat-chip"><span class="tp-stat-num">${shopping}</span><span class="tp-stat-lbl">to shop</span></div>` : ''}
  `;
}

// ── Today tasks ──
function renderTodayTasks() {
  const today    = _todayStr();
  const active   = (window.state.tasks || []).filter(t =>
    !t.done && (t.dueDate === today || (!t.dueDate && t.isDaily))
  );
  const done     = (window.state.tasks || []).filter(t =>
    t.done && (t.dueDate === today || (!t.dueDate && t.isDaily))
  );

  const home     = active.filter(t => (t.location || 'home') === 'home');
  const out      = active.filter(t => t.location === 'out');
  const homeDone = done.filter(t => (t.location || 'home') === 'home');
  const outDone  = done.filter(t => t.location === 'out');

  const homePill = document.getElementById('tp-home-pill');
  const outPill  = document.getElementById('tp-out-pill');
  if (homePill) homePill.textContent = home.length;
  if (outPill)  outPill.textContent  = out.length;

  const homeEl = document.getElementById('tp-home-list');
  const outEl  = document.getElementById('tp-out-list');
  if (homeEl) homeEl.innerHTML = taskListHtml(home, homeDone);
  if (outEl)  outEl.innerHTML  = taskListHtml(out,  outDone);
}

function taskListHtml(active, done) {
  if (!active.length && !done.length) {
    return `<li class="tp-empty">Nothing here yet</li>`;
  }
  let html = active.map(t => taskRowHtml(t, false)).join('');
  if (done.length) {
    html += `<li class="tp-done-sep">${done.length} completed ✓</li>`;
    html += done.map(t => taskRowHtml(t, true)).join('');
  }
  return html;
}

function taskRowHtml(t, isBacklog) {
  const isDone     = t.done;
  const priColor   = { high:'#f87171', med:'#facc15', low:'#6aadff' };
  const assignee   = t.assignee
    ? `<span class="tp-assignee-chip">${t.assignee}</span>` : '';
  const todayBtn   = isBacklog && !isDone
    ? `<button class="tp-row-btn" onclick="moveToToday(${t.id})">→ Today</button>` : '';

  return `
    <li class="tp-task-row ${isDone ? 'is-done' : ''}" data-tid="${t.id}">
      <button class="tp-chk ${isDone ? 'checked' : ''}" onclick="toggleTask(${t.id})"></button>
      <span class="tp-task-txt">${t.text}</span>
      ${assignee}
      <span class="tp-pri-pip" style="background:${priColor[t.priority]||priColor.med}" title="${t.priority} priority"></span>
      ${todayBtn}
      <button class="tp-del" onclick="deleteTask(${t.id})" title="Delete">✕</button>
    </li>`;
}

// ── Week strip ──
function renderWeekStrip() {
  const el = document.getElementById('tp-week-strip');
  if (!el) return;
  const days  = _weekDays();
  const tasks = window.state.tasks || [];

  el.innerHTML = days.map(d => {
    const pending = tasks.filter(t => t.dueDate === d.date && !t.done).length;
    const doneN   = tasks.filter(t => t.dueDate === d.date && t.done).length;
    const sel     = d.date === _weekSelected;
    return `
      <div class="tp-week-cell ${d.isToday?'is-today':''} ${d.isPast?'is-past':''} ${sel?'is-sel':''}"
           onclick="selectWeekDay('${d.date}')">
        <div class="tp-wc-label">${d.label}</div>
        <div class="tp-wc-num">${d.num}</div>
        <div class="tp-wc-dots">
          ${pending ? `<span class="tp-wdot">${pending}</span>` : `<span class="tp-wdot-empty"></span>`}
          ${doneN   ? `<span class="tp-wdot done">${doneN}✓</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function selectWeekDay(ds) {
  _weekSelected = ds;
  renderWeekStrip();
  renderWeekPanel();
}

// ── Week panel ──
function renderWeekPanel() {
  const el = document.getElementById('tp-week-panel');
  if (!el) return;

  const isToday = _weekSelected === _todayStr();
  const d       = new Date(_weekSelected + 'T00:00:00');
  const label   = isToday
    ? 'Today'
    : d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });

  const active   = (window.state.tasks || []).filter(t => t.dueDate === _weekSelected && !t.done);
  const done     = (window.state.tasks || []).filter(t => t.dueDate === _weekSelected && t.done);
  const home     = active.filter(t => (t.location||'home') === 'home');
  const out      = active.filter(t => t.location === 'out');
  const homeDone = done.filter(t => (t.location||'home') === 'home');
  const outDone  = done.filter(t => t.location === 'out');

  el.innerHTML = `
    <div class="tp-week-panel-inner">
      <div class="tp-wp-hdr">
        <span class="tp-wp-label">${label}</span>
        ${isToday ? '<span class="tp-wp-today-tag">TODAY</span>' : ''}
      </div>
      <div class="tp-wp-grid">
        <div class="tp-wp-col">
          <div class="tp-wp-col-lbl">🏠 At Home</div>
          <div class="tp-wp-add-row">
            <input class="tp-input" id="tp-week-home-input" placeholder="Home task…" />
            <select class="tp-mini-select" id="tp-week-home-pri">
              <option value="high">High</option>
              <option value="med" selected>Med</option>
              <option value="low">Low</option>
            </select>
            <input class="tp-input tp-who-input" id="tp-week-home-who" list="tp-people-list" placeholder="Who?" />
            <button class="tp-qadd-btn" onclick="quickAddWeekTask('home')">+</button>
          </div>
          <ul class="tp-list">${taskListHtml(home, homeDone)}</ul>
        </div>
        <div class="tp-wp-col">
          <div class="tp-wp-col-lbl">🚗 Out &amp; About</div>
          <div class="tp-wp-add-row">
            <input class="tp-input" id="tp-week-out-input" placeholder="Errand or outing…" />
            <select class="tp-mini-select" id="tp-week-out-pri">
              <option value="high">High</option>
              <option value="med" selected>Med</option>
              <option value="low">Low</option>
            </select>
            <input class="tp-input tp-who-input" id="tp-week-out-who" list="tp-people-list" placeholder="Who?" />
            <button class="tp-qadd-btn" onclick="quickAddWeekTask('out')">+</button>
          </div>
          <ul class="tp-list">${taskListHtml(out, outDone)}</ul>
        </div>
      </div>
    </div>`;

  ['home','out'].forEach(loc => {
    document.getElementById(`tp-week-${loc}-input`)
      ?.addEventListener('keydown', e => { if (e.key === 'Enter') quickAddWeekTask(loc); });
  });
}

// ── Shopping ──
function renderShoppingList() {
  const el = document.getElementById('tp-shop-list');
  if (!el) return;
  const items   = window.state.shopping || [];
  const pending = items.filter(i => !i.done);
  const done    = items.filter(i => i.done);

  if (!pending.length && !done.length) {
    el.innerHTML = `<li class="tp-empty">List is empty — add items above</li>`;
    return;
  }

  let html = pending.map(i => shopRowHtml(i, false)).join('');
  if (done.length) {
    html += `<li class="tp-done-sep">
      <span>${done.length} collected</span>
      <button class="tp-clear-btn" onclick="clearDoneShoppingItems()">Clear done</button>
    </li>`;
    html += done.map(i => shopRowHtml(i, true)).join('');
  }
  el.innerHTML = html;
}

function shopRowHtml(i, isDone) {
  return `
    <li class="tp-task-row ${isDone ? 'is-done' : ''}">
      <button class="tp-chk ${isDone ? 'checked' : ''}" onclick="toggleShoppingItem(${i.id})"></button>
      <span class="tp-task-txt">${i.text}</span>
      <button class="tp-del" onclick="deleteShoppingItem(${i.id})">✕</button>
    </li>`;
}

// ── Backlog ──
function renderBacklogList() {
  const el   = document.getElementById('tp-backlog-list');
  const pill = document.getElementById('tp-backlog-pill');
  if (!el) return;

  const items = (window.state.tasks || []).filter(t => !t.done && !t.dueDate && !t.isDaily);
  if (pill) pill.textContent = items.length;

  el.innerHTML = items.length
    ? items.map(t => taskRowHtml(t, true)).join('')
    : `<li class="tp-empty">Nothing in the backlog</li>`;
}

// ── People datalist ──
function updatePeopleDatalist() {
  const dl = document.getElementById('tp-people-list');
  if (!dl) return;
  dl.innerHTML = _getTaskPeople().map(p => `<option value="${p}">`).join('');
}

// ── Celebrations ──
const DAILY_COMPLETE_MSGS = [
  { emoji: '🏆', title: 'Daily list demolished!',        sub: "Every single task done. That's a perfect day — you showed up and delivered. Go enjoy the rest of it." },
  { emoji: '🔥', title: 'Absolutely on fire!',           sub: "Daily list: cleared. You didn't just get things done today — you owned it. Seriously well done." },
  { emoji: '⚡', title: 'Full send. Zero left.',         sub: 'All daily tasks complete. This is what momentum looks like — keep this energy into tomorrow.' },
  { emoji: '🎯', title: 'Bullseye. Every. Single. One.', sub: 'The entire daily list is done. That focus is rare and it shows. Take a breath — you\'ve earned it.' },
  { emoji: '🚀', title: 'Launched. Done. Nailed it.',    sub: "No tasks left on today's list. Whatever you do next, you've already won today." },
];

function smallCelebration(itemEl) {
  const emojis = ['✅','⭐','✨','🎯','💪','👏','🔥'];
  const emoji  = emojis[Math.floor(Math.random() * emojis.length)];
  const rect   = itemEl.getBoundingClientRect();
  const pop    = document.createElement('div');
  pop.className   = 'task-pop';
  pop.textContent = emoji;
  pop.style.left  = (rect.left + rect.width / 2 - 12) + 'px';
  pop.style.top   = (rect.top + window.scrollY - 10)  + 'px';
  document.body.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function hugeCelebration() {
  const msg     = DAILY_COMPLETE_MSGS[Math.floor(Math.random() * DAILY_COMPLETE_MSGS.length)];
  massConfetti();
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
  setTimeout(massConfetti, 600);
  overlay.addEventListener('click', () => {
    overlay.style.opacity    = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  });
  setTimeout(() => { if (overlay.parentNode) overlay.click(); }, 6000);
}

function massConfetti() {
  const colours = ['#ffe000','#4caf78','#6aadff','#ff7730','#c084fc','#f472b6','#fff','#facc15'];
  for (let i = 0; i < 120; i++) {
    const el   = document.createElement('div');
    el.className = 'confetti-piece';
    const size = 5 + Math.random() * 9;
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top:  ${-10 - Math.random() * 40}px;
      width: ${size}px; height: ${size}px;
      background: ${colours[Math.floor(Math.random() * colours.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 1}s;
      animation-duration: ${2 + Math.random() * 1.5}s;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Sync home section if visible ──
function refreshHome() {
  const homeEl = document.getElementById('section-home');
  if (homeEl?.classList.contains('active')) renderHome();
}
