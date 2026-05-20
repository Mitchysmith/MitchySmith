// ── Exercise – Australian Time + Backdating ──
const PEOPLE    = ['Sam', 'Mitch'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Return today's date string in Australian Eastern Time (AEST/AEDT)
function aestDateStr(offsetDays = 0) {
  const now  = new Date();
  // AEST = UTC+10, AEDT = UTC+11 (daylight saving Oct–Apr)
  const aest = new Date(now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
  aest.setDate(aest.getDate() + offsetDays);
  const y = aest.getFullYear();
  const m = String(aest.getMonth() + 1).padStart(2,'0');
  const d = String(aest.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function todayKey() { return aestDateStr(0); }

function getStreak(log) {
  if (!log.length) return 0;
  const sorted = [...new Set(log)].sort().reverse();
  let streak = 0;
  const check = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
  for (const d of sorted) {
    const cKey = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`;
    if (d === cKey) { streak++; check.setDate(check.getDate() - 1); }
    else if (streak === 0) { check.setDate(check.getDate() - 1); }
    else break;
  }
  return streak;
}

function getWeekLog(log) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(aestDateStr(-i));
  return days.map(d => log.includes(d));
}

function getMonthLog(log) {
  const now  = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
  const y    = now.getFullYear();
  const mo   = now.getMonth();
  const days = new Date(y, mo + 1, 0).getDate();
  const result = [];
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    result.push(log.includes(key));
  }
  return result;
}

function renderExercise() {
  const el = document.getElementById('section-exercise');
  el.innerHTML = `
    <div class="page-header">
      <h1>Exercise</h1>
      <p>Tracking for Sam and Mitch — AEST time. Log any day, past or present.</p>
    </div>
    <div class="exercise-grid" id="exercise-grid"></div>
  `;
  renderPersonCards();
}

function renderPersonCards() {
  const grid = document.getElementById('exercise-grid');
  if (!grid) return;

  const today = todayKey();

  const cardsHtml = PEOPLE.map(person => {
    const data    = window.state.exercise?.[person] || { log: [] };
    const log     = data.log || [];
    const isToday = log.includes(today);
    const streak  = getStreak(log);
    const weekLog = getWeekLog(log);
    const monthLog= getMonthLog(log);
    const wkTotal = weekLog.filter(Boolean).length;
    const moTotal = monthLog.filter(Boolean).length;

    const now  = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
    const monthName = now.toLocaleString('en-AU', { month: 'long' });

    const weekDots = weekLog.map((done, i) => `
      <div class="week-day">
        <div class="week-dot ${done ? 'done' : ''}"></div>
        <span class="week-dot-label">${DAY_NAMES[i]}</span>
      </div>`).join('');

    const heatCells = monthLog.map(done =>
      `<div class="heat-cell ${done ? 'active' : ''}"></div>`).join('');

    const cls = person === 'Sam' ? 'avatar-sam' : 'avatar-mitch';

    // Build backdate selector (last 30 days not already logged)
    const backdateOptions = [];
    for (let i = 1; i <= 30; i++) {
      const key = aestDateStr(-i);
      if (!log.includes(key)) {
        const d = new Date(key + 'T00:00:00');
        backdateOptions.push({ key, label: d.toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short' }) });
      }
    }

    const backdateHtml = backdateOptions.length
      ? `<div class="backdate-row">
          <select class="backdate-select" id="backdate-${person}">
            <option value="">Pick a past day…</option>
            ${backdateOptions.map(o => `<option value="${o.key}">${o.label}</option>`).join('')}
          </select>
          <button class="btn btn-ghost backdate-btn" data-person="${person}">Log Past Day</button>
        </div>`
      : `<p class="text-xs text-muted" style="margin-top:6px">All recent days logged!</p>`;

    return `
      <div class="person-card" id="card-${person}">
        <div class="person-header">
          <div class="flex items-center gap-12">
            <div class="person-avatar ${cls}">${person[0]}</div>
            <span class="person-name">${person}</span>
          </div>
          ${streak > 0 ? `<div class="streak-badge">🔥 ${streak} day streak</div>` : ''}
        </div>

        <button class="exercise-log-btn ${isToday ? 'logged-today' : ''}" data-person="${person}" id="log-btn-${person}">
          ${isToday ? '✓ Exercised today!' : '+ Log today\'s exercise'}
        </button>

        ${backdateHtml}

        <div class="ex-stats">
          <div class="ex-stat">
            <div class="ex-stat-val" style="color:var(--green)">${streak}</div>
            <div class="ex-stat-lbl">Streak</div>
          </div>
          <div class="ex-stat">
            <div class="ex-stat-val" style="color:var(--blue)">${wkTotal}</div>
            <div class="ex-stat-lbl">This Week</div>
          </div>
          <div class="ex-stat">
            <div class="ex-stat-val" style="color:var(--orange)">${moTotal}</div>
            <div class="ex-stat-lbl">This Month</div>
          </div>
        </div>

        <div>
          <div class="section-title">This Week</div>
          <div class="week-dots">${weekDots}</div>
        </div>

        <div>
          <div class="section-title">${monthName} Overview</div>
          <div class="month-heatmap">${heatCells}</div>
        </div>
      </div>`;
  }).join('');

  // Leaderboard
  const scores = PEOPLE.map(p => ({
    name: p, total: (window.state.exercise?.[p]?.log || []).length,
  })).sort((a,b) => b.total - a.total);

  const lbHtml = `
    <div class="card leaderboard">
      <div class="section-title">All-Time Leaderboard</div>
      ${scores.map((s,i) => `
        <div class="lb-row">
          <span class="lb-name">${i === 0 ? '🥇 ' : '🥈 '}${s.name}</span>
          <span class="lb-score">${s.total} sessions</span>
        </div>`).join('')}
    </div>`;

  grid.innerHTML = cardsHtml + lbHtml;

  // Bind today buttons
  PEOPLE.forEach(person => {
    const btn = document.getElementById(`log-btn-${person}`);
    if (btn) btn.addEventListener('click', () => toggleExercise(person, todayKey()));
  });

  // Bind backdate buttons
  grid.querySelectorAll('.backdate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const person = btn.dataset.person;
      const sel    = document.getElementById(`backdate-${person}`);
      const date   = sel?.value;
      if (date) toggleExercise(person, date);
    });
  });
}

function toggleExercise(person, dateKey) {
  if (!window.state.exercise) window.state.exercise = {};
  if (!window.state.exercise[person]) window.state.exercise[person] = { log: [] };

  const log = window.state.exercise[person].log;
  if (log.includes(dateKey)) {
    window.state.exercise[person].log = log.filter(d => d !== dateKey);
  } else {
    window.state.exercise[person].log.push(dateKey);
  }

  saveState();
  renderPersonCards();
}
