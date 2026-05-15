// ── Exercise ──
const PEOPLE = ['Sam', 'Mitch'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function getStreak(log) {
  if (!log.length) return 0;
  const sorted = [...new Set(log)].sort().reverse();
  let streak = 0;
  let check  = new Date();
  for (const d of sorted) {
    const cKey = check.toISOString().split('T')[0];
    if (d === cKey) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  return streak;
}

function getWeekLog(log) {
  const now  = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days.map(d => log.includes(d));
}

function getMonthLog(log) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  const result = [];
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    result.push(log.includes(key));
  }
  return result;
}

function renderExercise() {
  const el = document.getElementById('section-exercise');
  el.innerHTML = `
    <div class="page-header">
      <h1>Exercise</h1>
      <p>Tracking for Sam and Mitch — keep the streaks going.</p>
    </div>
    <div class="exercise-grid" id="exercise-grid"></div>
  `;
  renderPersonCards();
}

function renderPersonCards() {
  const grid = document.getElementById('exercise-grid');
  if (!grid) return;

  const cardsHtml = PEOPLE.map(person => {
    const data    = window.state.exercise?.[person] || { log: [] };
    const log     = data.log || [];
    const today   = todayKey();
    const isToday = log.includes(today);
    const streak  = getStreak(log);
    const weekLog = getWeekLog(log);
    const monthLog= getMonthLog(log);

    const now   = new Date();
    const wkTotal = weekLog.filter(Boolean).length;
    const moTotal = monthLog.filter(Boolean).length;

    const weekDots = weekLog.map((done, i) => `
      <div class="week-day">
        <div class="week-dot ${done ? 'done' : ''}"></div>
        <span class="week-dot-label">${DAY_NAMES[i]}</span>
      </div>`).join('');

    const heatCells = monthLog.map(done =>
      `<div class="heat-cell ${done ? 'active' : ''}"></div>`).join('');

    const cls = person === 'Sam' ? 'avatar-sam' : 'avatar-mitch';

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
          ${isToday ? '✓ Exercised today!' : '+ Log exercise for today'}
        </button>

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
          <div class="section-title">${now.toLocaleString('default',{month:'long'})} Overview</div>
          <div class="month-heatmap">${heatCells}</div>
        </div>
      </div>`;
  }).join('');

  // Leaderboard
  const scores = PEOPLE.map(p => {
    const log = window.state.exercise?.[p]?.log || [];
    return { name: p, total: log.length };
  }).sort((a,b) => b.total - a.total);

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

  // Bind log buttons
  PEOPLE.forEach(person => {
    const btn = document.getElementById(`log-btn-${person}`);
    if (btn) btn.addEventListener('click', () => toggleExercise(person));
  });
}

function toggleExercise(person) {
  const today = todayKey();
  if (!window.state.exercise) window.state.exercise = {};
  if (!window.state.exercise[person]) window.state.exercise[person] = { log: [] };

  const log = window.state.exercise[person].log;
  if (log.includes(today)) {
    window.state.exercise[person].log = log.filter(d => d !== today);
  } else {
    window.state.exercise[person].log.push(today);
  }

  saveState();
  renderPersonCards();
}
