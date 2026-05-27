// ── Dev Tools — version badge + Flask monitor ──

const APP_VERSION = 'v1.2';
const FLASK_URL   = 'http://localhost:5000';

let _flaskTimer    = null;
let _flaskState    = 'unknown'; // 'green' | 'amber' | 'red' | 'unknown'

function initFlaskMonitor() {
  // Stamp version into sidebar
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = APP_VERSION;

  // Initial check then poll every 12 s
  _checkFlask();
  _flaskTimer = setInterval(_checkFlask, 12000);

  document.getElementById('flask-start-btn')?.addEventListener('click', _showStartPopover);
  document.getElementById('flask-stop-btn')?.addEventListener('click',  _stopFlask);
}

async function _checkFlask() {
  _setFlaskUI('amber', 'Checking…');

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);

  try {
    // no-cors: resolves with opaque response if server is up, rejects if connection refused
    await fetch(FLASK_URL, { mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(timer);
    _setFlaskUI('green', 'Running');
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      _setFlaskUI('amber', 'No response');
    } else {
      _setFlaskUI('red', 'Offline');
    }
  }
}

function _setFlaskUI(state, label) {
  _flaskState = state;
  const dot = document.getElementById('flask-dot');
  const lbl = document.getElementById('flask-status-label');
  if (dot) dot.className = 'flask-dot flask-' + state;
  if (lbl) lbl.textContent = label;
}

function _showStartPopover() {
  const existing = document.getElementById('flask-popover');
  if (existing) { existing.remove(); return; }

  const pop = document.createElement('div');
  pop.id = 'flask-popover';
  pop.className = 'flask-popover';
  pop.innerHTML = `
    <div class="flask-popover-title">Start Flask Server</div>
    <code class="flask-popover-cmd" id="flask-cmd">flask run --host=0.0.0.0 --port=5000</code>
    <div class="flask-popover-row">
      <button class="flask-popover-copy" id="flask-copy-btn">Copy command</button>
      <button class="flask-popover-check" id="flask-check-btn">↻ Check now</button>
    </div>
    <p class="flask-popover-note">Run the command above in your project terminal, then click "Check now".</p>`;

  document.body.appendChild(pop);

  // Position below the Start button
  const btn  = document.getElementById('flask-start-btn');
  if (btn) {
    const r = btn.getBoundingClientRect();
    pop.style.top   = (r.bottom + 6) + 'px';
    pop.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  }

  pop.querySelector('#flask-copy-btn').addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText('flask run --host=0.0.0.0 --port=5000').then(() => {
      const b = document.getElementById('flask-copy-btn');
      if (b) { b.textContent = 'Copied ✓'; setTimeout(() => { if (b) b.textContent = 'Copy command'; }, 2000); }
    }).catch(() => {
      // fallback — select text
      const cmd = document.getElementById('flask-cmd');
      if (cmd) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(cmd);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });

  pop.querySelector('#flask-check-btn').addEventListener('click', e => {
    e.stopPropagation();
    pop.remove();
    _checkFlask();
  });

  // Dismiss on outside click
  const dismiss = (e) => {
    if (!pop.contains(e.target) && e.target.id !== 'flask-start-btn') {
      pop.remove();
      document.removeEventListener('click', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss), 60);
}

async function _stopFlask() {
  if (_flaskState !== 'green') {
    _showStartPopover();
    return;
  }
  _setFlaskUI('amber', 'Stopping…');
  try {
    // Flask /shutdown requires a POST; many setups don't have it — that's fine
    await fetch(FLASK_URL + '/shutdown', { method: 'POST', mode: 'no-cors' });
  } catch (_) { /* server closes connection — expected */ }
  // Re-check after brief delay
  setTimeout(_checkFlask, 1400);
}
