// ── Calendar ──
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

const CAT_COLORS = {
  work:     '#6aadff',
  personal: '#ff7730',
  finance:  '#4caf78',
  family:   '#c084fc',
  health:   '#f472b6',
  social:   '#facc15',
};

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function renderCalendar() {
  const el = document.getElementById('section-calendar');
  el.innerHTML = `
    <div class="page-header">
      <h1>Calendar</h1>
      <p>Stay on top of what's coming up.</p>
    </div>

    <div class="gcal-connect" id="gcal-btn">
      <span class="gcal-icon">📅</span>
      <span>Connect Google Calendar — import your events automatically</span>
    </div>

    <div class="cal-layout" style="margin-top:20px">
      <div>
        <div class="cal-header">
          <div class="cal-nav">
            <button class="cal-nav-btn" id="cal-prev">‹</button>
            <span class="cal-month-label" id="cal-month-label"></span>
            <button class="cal-nav-btn" id="cal-next">›</button>
          </div>
          <button class="btn btn-ghost" id="cal-today-btn">Today</button>
        </div>

        <div class="cal-grid-days">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>

      <div class="cal-sidebar">
        <div class="card">
          <div class="section-title">Add Event</div>
          <div class="cal-add-form">
            <input type="text" id="ev-title" placeholder="Event title" />
            <input type="date" id="ev-date" />
            <input type="time" id="ev-time" placeholder="Time (optional)" />
            <select id="ev-cat">
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="finance">Finance</option>
              <option value="family">Family</option>
              <option value="health">Health</option>
              <option value="social">Social</option>
            </select>
            <button class="btn btn-primary" id="add-event-btn">Add Event</button>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Categories</div>
          <div class="cat-legend">
            ${Object.entries(CAT_COLORS).map(([k,v]) => `
              <div class="cat-item">
                <span class="cat-dot" style="background:${v}"></span>
                <span style="text-transform:capitalize">${k}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="section-title">Upcoming</div>
          <div id="upcoming-events-list"></div>
        </div>
      </div>
    </div>
  `;

  bindCalendarEvents();
  drawCalGrid();
  renderUpcoming();
  setDefaultDate();
}

function setDefaultDate() {
  const d = document.getElementById('ev-date');
  if (d) d.valueAsDate = new Date();
}

function bindCalendarEvents() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    drawCalGrid();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    drawCalGrid();
  });
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    const now = new Date(); calYear = now.getFullYear(); calMonth = now.getMonth();
    drawCalGrid();
  });
  document.getElementById('add-event-btn').addEventListener('click', addEvent);
  document.getElementById('gcal-btn').addEventListener('click', showGcalInfo);
}

function showGcalInfo() {
  alert('Google Calendar integration requires an API key.\n\nTo connect:\n1. Go to console.cloud.google.com\n2. Enable the Google Calendar API\n3. Create OAuth credentials\n4. Paste your Client ID in the settings area.\n\nFor now, add events manually below.');
}

function addEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const date  = document.getElementById('ev-date').value;
  const time  = document.getElementById('ev-time').value;
  const cat   = document.getElementById('ev-cat').value;
  if (!title || !date) return;

  window.state.events.push({ id: Date.now(), title, start: date, time, category: cat });
  saveState();
  document.getElementById('ev-title').value = '';
  drawCalGrid();
  renderUpcoming();
  renderHome();
}

function drawCalGrid() {
  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const today   = new Date();
  const first   = new Date(calYear, calMonth, 1).getDay();
  const daysIn  = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();

  let cells = '';

  // Previous month spillover
  for (let i = first - 1; i >= 0; i--) {
    cells += `<div class="cal-cell other-month"><div class="cal-cell-num">${prevDays - i}</div></div>`;
  }

  for (let d = 1; d <= daysIn; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const dayEvents = (window.state.events || []).filter(e => e.start === dateStr);

    const evPills = dayEvents.slice(0,2).map(e => {
      const col = CAT_COLORS[e.category] || '#6aadff';
      return `<span class="cal-event-pill" style="background:${col}88;border-left:2px solid ${col}">${e.title}</span>`;
    }).join('');

    cells += `
      <div class="cal-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
        <div class="cal-cell-num">${d}</div>
        ${evPills}
        ${dayEvents.length > 2 ? `<span style="font-size:10px;color:var(--text-dim)">+${dayEvents.length - 2} more</span>` : ''}
      </div>`;
  }

  // Next month fill
  const remaining = (7 - ((first + daysIn) % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells += `<div class="cal-cell other-month"><div class="cal-cell-num">${i}</div></div>`;
  }

  grid.innerHTML = cells;
}

function renderUpcoming() {
  const el = document.getElementById('upcoming-events-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const list  = (window.state.events || [])
    .filter(e => e.start >= today)
    .sort((a,b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  el.innerHTML = list.length
    ? list.map(e => {
        const col = CAT_COLORS[e.category] || '#6aadff';
        return `
          <div class="upcoming-event" style="border-left-color:${col}">
            <div class="ev-title">${e.title}</div>
            <div class="ev-meta">${e.start}${e.time ? ' · ' + e.time : ''} · ${e.category || ''}</div>
          </div>`;
      }).join('')
    : `<p class="text-muted text-sm">No upcoming events yet.</p>`;
}
