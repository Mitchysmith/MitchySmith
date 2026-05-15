// ── Home / Overview ──
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Small daily improvements lead to stunning results.", author: "Robin Sharma" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayStr() {
  return new Date().toDateString();
}

function renderHome() {
  const el = document.getElementById('section-home');
  const s  = window.state;

  const pendingTasks  = (s.tasks || []).filter(t => !t.done);
  const doneTasks     = (s.tasks || []).filter(t => t.done);
  const highPriority  = pendingTasks.filter(t => t.priority === 'high').slice(0, 3);
  const topTasks      = pendingTasks.slice(0, 4);

  const today    = new Date();
  const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const quote = QUOTES[today.getDate() % QUOTES.length];

  // Upcoming events (next 5)
  const upcoming = (s.events || [])
    .filter(e => new Date(e.start) >= today)
    .sort((a,b) => new Date(a.start) - new Date(b.start))
    .slice(0, 4);

  const eventsHtml = upcoming.length
    ? upcoming.map(e => {
        const d = new Date(e.start);
        return `
          <div class="event-mini">
            <div class="event-mini-date">
              <span class="day-num">${d.getDate()}</span>
              <span class="day-mon">${months[d.getMonth()]}</span>
            </div>
            <div class="event-mini-info">
              <div class="event-title">${e.title}</div>
              <div class="event-time">${e.time || ''} ${e.category ? '· ' + e.category : ''}</div>
            </div>
          </div>`;
      }).join('')
    : `<p class="text-muted text-sm" style="padding:12px 0">No upcoming events — add some in the Calendar tab.</p>`;

  const prioritiesHtml = topTasks.length
    ? topTasks.map(t => `
        <li class="priority-item">
          <span class="priority-dot dot-${t.priority || 'med'}"></span>
          <span class="priority-text">${t.text}</span>
          <span class="priority-badge">${t.priority || ''}</span>
        </li>`).join('')
    : `<li class="priority-item"><span class="priority-text text-muted">All tasks complete — great work!</span></li>`;

  const income   = s.finance?.income   || 0;
  const expenses = s.finance?.expenses || 0;
  const savings  = s.finance?.savings  || 0;
  const surplus  = income - expenses;

  el.innerHTML = `
    <div class="page-header">
      <h1>Overview</h1>
      <p>Here's what's on your plate today.</p>
    </div>

    <div class="home-grid">

      <!-- Greeting -->
      <div class="greeting-card home-wide">
        <div class="greeting-left">
          <h2>${getGreeting()}, <span>Mitch</span> 👋</h2>
          <p>You have <strong>${pendingTasks.length}</strong> task${pendingTasks.length !== 1 ? 's' : ''} remaining and <strong>${upcoming.length}</strong> upcoming event${upcoming.length !== 1 ? 's' : ''}.</p>
        </div>
        <div class="greeting-meta">
          <span class="day-tag">${days[today.getDay()]}</span>
          <span class="weather-stub">${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}</span>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stat-tile stat-orange">
        <div class="stat-label">Tasks Remaining</div>
        <div class="stat-value">${pendingTasks.length}</div>
        <div class="stat-sub">${doneTasks.length} completed this month</div>
      </div>

      <div class="stat-tile stat-blue">
        <div class="stat-label">Upcoming Events</div>
        <div class="stat-value">${upcoming.length}</div>
        <div class="stat-sub">Next 30 days</div>
      </div>

      <div class="stat-tile stat-green">
        <div class="stat-label">Monthly Surplus</div>
        <div class="stat-value">${surplus >= 0 ? '+' : ''}$${Math.abs(surplus).toLocaleString()}</div>
        <div class="stat-sub">Income minus expenses</div>
      </div>

      <div class="stat-tile">
        <div class="stat-label">Savings</div>
        <div class="stat-value">$${(savings).toLocaleString()}</div>
        <div class="stat-sub">Current balance</div>
      </div>

      <!-- Today's priorities -->
      <div class="card">
        <div class="section-title">Today's Priorities</div>
        <ul class="priorities-list">${prioritiesHtml}</ul>
      </div>

      <!-- Upcoming events -->
      <div class="card">
        <div class="section-title">Coming Up</div>
        ${eventsHtml}
      </div>

      <!-- Financial snapshot -->
      <div class="card">
        <div class="section-title">Money at a Glance</div>
        <div class="snapshot-row">
          <span class="snapshot-label">Monthly Income</span>
          <span class="snapshot-value up">$${income.toLocaleString()}</span>
        </div>
        <div class="snapshot-row">
          <span class="snapshot-label">Monthly Expenses</span>
          <span class="snapshot-value ${expenses > income ? 'down' : ''}">$${expenses.toLocaleString()}</span>
        </div>
        <div class="snapshot-row">
          <span class="snapshot-label">Investments</span>
          <span class="snapshot-value">$${(s.finance?.investments || 0).toLocaleString()}</span>
        </div>
        <div class="snapshot-row">
          <span class="snapshot-label">Net Surplus</span>
          <span class="snapshot-value ${surplus >= 0 ? 'up' : 'down'}">$${surplus.toLocaleString()}</span>
        </div>
      </div>

      <!-- Motivation -->
      <div class="card">
        <div class="section-title">Daily Thought</div>
        <div class="quote-card">
          "${quote.text}"
          <cite>— ${quote.author}</cite>
        </div>
      </div>

    </div>
  `;
}
