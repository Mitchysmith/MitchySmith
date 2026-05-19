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

// ── iCal parser ──
function parseICSDate(str) {
  if (!str) return null;
  // Strip VALUE=DATE: or TZID= prefix after the colon
  const raw = str.includes(':') ? str.split(':').pop() : str;
  const y  = raw.slice(0,4);
  const mo = raw.slice(4,6);
  const d  = raw.slice(6,8);
  return `${y}-${mo}-${d}`;
}

function parseICSTime(str) {
  if (!str || str.length < 13) return '';
  const h = str.slice(9,11);
  const m = str.slice(11,13);
  return `${h}:${m}`;
}

function parseICS(text) {
  // Unfold wrapped lines
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines    = unfolded.split(/\r?\n/);
  const events   = [];
  let cur        = null;

  for (const line of lines) {
    const key = line.split(':')[0].split(';')[0].toUpperCase();
    const val = line.slice(line.indexOf(':') + 1).trim();

    if (key === 'BEGIN' && val === 'VEVENT') { cur = {}; }
    else if (key === 'END'   && val === 'VEVENT' && cur) {
      if (cur.title && cur.start) events.push(cur);
      cur = null;
    } else if (cur) {
      if      (key === 'SUMMARY')     cur.title    = val.replace(/\\,/g,',').replace(/\\n/g,' ').trim();
      else if (key === 'DTSTART' || key.startsWith('DTSTART;')) {
        cur.start = parseICSDate(line);
        cur.time  = parseICSTime(line);
      }
      else if (key === 'DESCRIPTION') cur.description = val.replace(/\\n/g,' ').trim();
      else if (key === 'LOCATION')    cur.location    = val.trim();
    }
  }
  return events;
}

function guessCategory(title) {
  const t = (title || '').toLowerCase();
  if (/work|meeting|standup|sprint|interview|client|office|project/.test(t))  return 'work';
  if (/gym|run|walk|swim|exercise|yoga|physio|doctor|dentist|health/.test(t)) return 'health';
  if (/pay|tax|bank|invoice|accountant|finance|budget/.test(t))               return 'finance';
  if (/family|mum|dad|kids|school|birthday|anniversary/.test(t))              return 'family';
  if (/dinner|lunch|drinks|party|catch|social|friends/.test(t))               return 'social';
  return 'personal';
}

async function importFromIcal(url) {
  const statusEl = document.getElementById('ical-status');
  if (statusEl) { statusEl.textContent = 'Importing…'; statusEl.className = 'ical-status loading'; }

  try {
    // Use a free CORS proxy — no account or API key needed
    const proxy   = 'https://api.allorigins.win/raw?url=';
    const res     = await fetch(proxy + encodeURIComponent(url));
    if (!res.ok) throw new Error('Could not fetch calendar');
    const text    = await res.text();
    const parsed  = parseICS(text);

    if (!parsed.length) throw new Error('No events found in that calendar');

    // Merge — don't duplicate events already manually added
    const existing = new Set((window.state.events || []).map(e => `${e.title}|${e.start}`));
    let added = 0;
    for (const e of parsed) {
      const key = `${e.title}|${e.start}`;
      if (!existing.has(key)) {
        window.state.events.push({
          id:       Date.now() + Math.random(),
          title:    e.title,
          start:    e.start,
          time:     e.time || '',
          category: guessCategory(e.title),
          fromGcal: true,
        });
        existing.add(key);
        added++;
      }
    }

    // Save the URL so we can re-sync later
    window.state.icalUrl = url;
    saveState();

    if (statusEl) {
      statusEl.textContent = `✓ Imported ${added} new event${added !== 1 ? 's' : ''} (${parsed.length} total in feed)`;
      statusEl.className = 'ical-status ok';
    }

    drawCalGrid();
    renderUpcoming();
    renderHome();

  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `✗ ${err.message} — check the URL and try again`;
      statusEl.className = 'ical-status err';
    }
  }
}

function renderCalendar() {
  const el = document.getElementById('section-calendar');
  const savedUrl = window.state.icalUrl || '';
  const isConnected = !!savedUrl;

  el.innerHTML = `
    <div class="page-header">
      <h1>Calendar</h1>
      <p>Stay on top of what's coming up.</p>
    </div>

    <!-- Google Calendar connect card -->
    <div class="gcal-card ${isConnected ? 'connected' : ''}" id="gcal-card">
      <div class="gcal-card-header">
        <span class="gcal-icon">📅</span>
        <div>
          <div class="gcal-card-title">${isConnected ? 'Google Calendar Connected' : 'Connect Google Calendar'}</div>
          <div class="gcal-card-sub">${isConnected ? 'Your events are synced. Paste a new link to update.' : 'No downloads. No login. Just paste one link.'}</div>
        </div>
        ${isConnected ? '<span class="gcal-connected-badge">✓ Connected</span>' : ''}
      </div>

      <div class="gcal-how" id="gcal-how" style="${isConnected ? 'display:none' : ''}">
        <div class="gcal-steps">
          <div class="gcal-step"><span class="step-num">1</span><span>Open <strong>Google Calendar</strong> on desktop (calendar.google.com)</span></div>
          <div class="gcal-step"><span class="step-num">2</span><span>Click the <strong>three dots ⋮</strong> next to your calendar name on the left</span></div>
          <div class="gcal-step"><span class="step-num">3</span><span>Click <strong>Settings</strong></span></div>
          <div class="gcal-step"><span class="step-num">4</span><span>Scroll down to <strong>"Secret address in iCal format"</strong></span></div>
          <div class="gcal-step"><span class="step-num">5</span><span>Click <strong>Copy</strong> and paste it below</span></div>
        </div>
      </div>

      <div class="gcal-input-row">
        <input type="text" id="ical-url" placeholder="Paste your iCal link here (starts with https://calendar.google.com/calendar/ical/…)" value="${savedUrl}" />
        <button class="btn btn-primary" id="import-ical-btn">${isConnected ? 'Re-sync' : 'Import'}</button>
      </div>
      <div class="ical-status" id="ical-status">${isConnected ? '✓ Previously connected — click Re-sync to refresh events' : ''}</div>

      ${isConnected ? '<button class="btn btn-ghost" id="show-how-btn" style="margin-top:8px;font-size:12px">How to find the link again ↓</button>' : ''}
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
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-name">${d}</div>`).join('')}
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>

      <div class="cal-sidebar">
        <div class="card">
          <div class="section-title">Add Event Manually</div>
          <div class="cal-add-form">
            <input type="text" id="ev-title" placeholder="Event title" />
            <input type="date" id="ev-date" />
            <input type="time" id="ev-time" />
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

  document.getElementById('import-ical-btn').addEventListener('click', () => {
    const url = document.getElementById('ical-url').value.trim();
    if (!url) return;
    importFromIcal(url);
  });

  document.getElementById('show-how-btn')?.addEventListener('click', () => {
    const how = document.getElementById('gcal-how');
    if (how) how.style.display = how.style.display === 'none' ? 'block' : 'none';
  });
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

  const today  = new Date();
  const first  = new Date(calYear, calMonth, 1).getDay();
  const daysIn = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  let cells = '';

  for (let i = first - 1; i >= 0; i--) {
    cells += `<div class="cal-cell other-month"><div class="cal-cell-num">${prevDays - i}</div></div>`;
  }

  for (let d = 1; d <= daysIn; d++) {
    const dateStr  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday  = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const dayEvents = (window.state.events || []).filter(e => e.start === dateStr);

    const evPills = dayEvents.slice(0,2).map(e => {
      const col = CAT_COLORS[e.category] || '#6aadff';
      return `<span class="cal-event-pill" style="background:${col}22;border-left:2px solid ${col};color:${col}">${e.title}</span>`;
    }).join('');

    cells += `
      <div class="cal-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
        <div class="cal-cell-num">${d}</div>
        ${evPills}
        ${dayEvents.length > 2 ? `<span style="font-size:10px;color:var(--text-dim)">+${dayEvents.length-2} more</span>` : ''}
      </div>`;
  }

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
    .slice(0, 8);

  el.innerHTML = list.length
    ? list.map(e => {
        const col = CAT_COLORS[e.category] || '#6aadff';
        return `
          <div class="upcoming-event" style="border-left-color:${col}">
            <div class="ev-title">${e.title}</div>
            <div class="ev-meta">${e.start}${e.time ? ' · '+e.time : ''}${e.category ? ' · '+e.category : ''}</div>
          </div>`;
      }).join('')
    : `<p class="text-muted text-sm">No upcoming events yet.</p>`;
}
