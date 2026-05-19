// ── Snail Mail – Outlook / Hotmail via Microsoft Graph ──

const GRAPH_BASE  = 'https://graph.microsoft.com/v1.0';
const AVATAR_COLS = ['#6aadff','#ff7730','#4caf78','#c084fc','#f472b6','#facc15','#f87171','#34d399'];

// ── Token helpers ──
// Two connection modes:
//   "token"  – user pastes a short-lived token from Graph Explorer (free, no setup)
//   "app"    – full Azure app registration with MSAL (free, permanent)

let msalApp = null;

function getMsalApp() {
  const clientId = window.state.outlookClientId || '';
  if (!clientId || typeof msal === 'undefined') return null;
  if (msalApp) return msalApp;
  try {
    msalApp = new msal.PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/'),
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
    });
    return msalApp;
  } catch (e) { return null; }
}

async function getToken() {
  // Mode 1 — pasted token
  const pasted = window.state.mailPastedToken || '';
  if (pasted) return pasted;

  // Mode 2 — MSAL app
  const app = getMsalApp();
  if (!app) return null;
  const accounts = app.getAllAccounts();
  if (accounts.length) {
    try {
      const r = await app.acquireTokenSilent({ scopes: ['Mail.Read','User.Read'], account: accounts[0] });
      return r.accessToken;
    } catch (_) {}
  }
  try {
    const r = await app.loginPopup({ scopes: ['Mail.Read','User.Read'] });
    return r.accessToken;
  } catch (e) { return null; }
}

// ── Fetch inbox data ──
async function fetchMailData() {
  const token = await getToken();
  if (!token) throw new Error('No token — please connect using one of the options below.');

  const headers = { Authorization: `Bearer ${token}` };

  const folderRes = await fetch(`${GRAPH_BASE}/me/mailFolders/inbox?$select=totalItemCount,unreadItemCount`, { headers });
  if (!folderRes.ok) {
    const err = await folderRes.json().catch(() => ({}));
    if (folderRes.status === 401) throw new Error('Token expired or invalid. Please reconnect.');
    throw new Error(err?.error?.message || 'Could not read inbox.');
  }
  const folder = await folderRes.json();

  // Fetch recent messages for top-senders analysis
  const msgRes = await fetch(
    `${GRAPH_BASE}/me/mailFolders/inbox/messages?$select=from,receivedDateTime&$top=250&$orderby=receivedDateTime desc`,
    { headers }
  );
  let messages = [];
  if (msgRes.ok) { const d = await msgRes.json(); messages = d.value || []; }

  const tally = {};
  for (const m of messages) {
    const addr = m.from?.emailAddress?.address?.toLowerCase() || 'unknown';
    const name = m.from?.emailAddress?.name || addr;
    if (!tally[addr]) tally[addr] = { name, email: addr, count: 0 };
    tally[addr].count++;
  }

  return {
    total:      folder.totalItemCount  || 0,
    unread:     folder.unreadItemCount || 0,
    analysed:   messages.length,
    topSenders: Object.values(tally).sort((a,b) => b.count - a.count).slice(0, 10),
    syncedAt:   new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
  };
}

function signOut() {
  const app = getMsalApp();
  if (app) {
    const accs = app.getAllAccounts();
    if (accs.length) app.logoutPopup({ account: accs[0] }).catch(() => {});
  }
  window.state.mailPastedToken  = '';
  window.state.outlookClientId  = '';
  window.state.mailCache        = null;
  window.state.mailMode         = null;
  msalApp = null;
  saveState();
  renderMail();
}

// ── Render ──
function renderMail() {
  const el       = document.getElementById('section-mail');
  const cache    = window.state.mailCache || null;
  const mode     = window.state.mailMode  || null;
  const isConnected = !!(window.state.mailPastedToken || window.state.outlookClientId);

  el.innerHTML = `
    <div class="page-header">
      <h1>Snail Mail</h1>
      <p>Your Hotmail inbox at a glance — count, unread, and who's filling it up.</p>
    </div>

    <!-- Connection card -->
    <div class="mail-connect-card ${isConnected ? 'connected' : ''}">
      <div class="mail-connect-header">
        <span class="mail-connect-icon">📬</span>
        <div>
          <div class="mail-connect-title">${isConnected ? 'Microsoft Account Connected' : 'Connect Your Hotmail'}</div>
          <div class="mail-connect-sub">mitchell.smith.work@hotmail.com</div>
        </div>
        ${isConnected ? `<span class="mail-connected-badge">✓ Connected</span>` : ''}
      </div>

      <!-- Two option tabs -->
      <div class="mail-option-tabs">
        <div class="mail-option-tab ${mode !== 'app' ? 'active' : ''}" id="tab-token">
          ⚡ Free &amp; Simple <span class="mail-option-note">token expires in ~1 hour</span>
        </div>
        <div class="mail-option-tab ${mode === 'app' ? 'active' : ''}" id="tab-app">
          🔒 Permanent Setup <span class="mail-option-note">one-time 5 min setup, free</span>
        </div>
      </div>

      <!-- Option A: Paste token -->
      <div id="panel-token" class="${mode === 'app' ? 'mail-panel hidden' : 'mail-panel'}">
        <div class="mail-option-desc">
          No accounts to create. Go to Microsoft's own tool, sign in, copy a token, paste it here. Done in 60 seconds. You'll need to repeat this roughly once per hour.
        </div>
        <div class="mail-steps">
          <div class="mail-step">
            <span class="step-num">1</span>
            <span>Open <strong><a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" style="color:var(--blue)">Graph Explorer</a></strong> — Microsoft's free tool (no account needed to open it)</span>
          </div>
          <div class="mail-step">
            <span class="step-num">2</span>
            <span>Click <strong>Sign in to Graph Explorer</strong> and log in with your Hotmail account</span>
          </div>
          <div class="mail-step">
            <span class="step-num">3</span>
            <span>Click the <strong>Access token</strong> tab at the top of the page</span>
          </div>
          <div class="mail-step">
            <span class="step-num">4</span>
            <span>Click <strong>Copy</strong> and paste it below</span>
          </div>
        </div>
        <div class="mail-input-row">
          <input type="password" id="mail-token-input" placeholder="Paste your access token here…" value="${window.state.mailPastedToken ? '••••••••••••' : ''}" />
          <button class="btn btn-primary" id="mail-token-btn">Connect</button>
        </div>
        <div class="mail-status" id="mail-token-status"></div>
      </div>

      <!-- Option B: Azure App -->
      <div id="panel-app" class="${mode === 'app' ? 'mail-panel' : 'mail-panel hidden'}">
        <div class="mail-option-desc">
          A one-time setup that works permanently. You create a free "app" in Microsoft's portal — no credit card, no payment. Once done, click Connect and log in normally.
        </div>
        <div class="mail-steps">
          <div class="mail-step"><span class="step-num">1</span><span>Go to <strong>portal.azure.com</strong> — sign in with your Hotmail account</span></div>
          <div class="mail-step"><span class="step-num">2</span><span>Search <strong>App registrations</strong> → <strong>New registration</strong></span></div>
          <div class="mail-step"><span class="step-num">3</span><span>Name it anything. Under account type choose <strong>"Personal Microsoft accounts only"</strong></span></div>
          <div class="mail-step"><span class="step-num">4</span><span>Redirect URI → <strong>Single-page application (SPA)</strong> → paste: <code class="mail-code">${window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/')}</code></span></div>
          <div class="mail-step"><span class="step-num">5</span><span>Click <strong>Register</strong>, then copy the <strong>Application (client) ID</strong> shown on the next page</span></div>
        </div>
        <div class="mail-input-row">
          <input type="text" id="mail-clientid-input" placeholder="Paste Application (client) ID…" value="${window.state.outlookClientId || ''}" />
          <button class="btn btn-primary" id="mail-app-btn">Connect</button>
        </div>
        <div class="mail-status" id="mail-app-status"></div>
      </div>

      ${isConnected ? `<button class="mail-signout" id="mail-signout-btn">Sign out / disconnect</button>` : ''}
    </div>

    <!-- Data area -->
    ${cache ? `
      <div class="mail-toolbar">
        <div class="mail-last-sync">Analysed ${cache.analysed} recent messages · Synced ${cache.syncedAt} AEST</div>
        <button class="btn btn-ghost" id="mail-refresh-btn" style="font-size:12px">↻ Refresh now</button>
      </div>

      <div class="mail-stats">
        <div class="mail-stat">
          <div class="mail-stat-label">Total in Inbox</div>
          <div class="mail-stat-value" style="color:var(--blue)">${cache.total.toLocaleString()}</div>
          <div class="mail-stat-sub">All emails</div>
        </div>
        <div class="mail-stat">
          <div class="mail-stat-label">Unread</div>
          <div class="mail-stat-value" style="color:var(--orange)">${cache.unread.toLocaleString()}</div>
          <div class="mail-stat-sub">${cache.total ? Math.round(cache.unread/cache.total*100) : 0}% of inbox</div>
        </div>
        <div class="mail-stat">
          <div class="mail-stat-label">Read</div>
          <div class="mail-stat-value" style="color:var(--green)">${(cache.total - cache.unread).toLocaleString()}</div>
          <div class="mail-stat-sub">Emails read</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Top 10 Talkers</div>
        ${renderSenderRows(cache.topSenders)}
      </div>
    ` : isConnected ? `
      <div class="card" style="text-align:center;padding:40px">
        <p class="text-muted" style="margin-bottom:16px">Connected — click below to load your inbox.</p>
        <button class="btn btn-primary" id="mail-load-btn">Load My Inbox</button>
      </div>
    ` : `
      <div class="card" style="text-align:center;padding:48px 20px">
        <div style="font-size:48px;margin-bottom:14px">📭</div>
        <p style="color:var(--text-muted);font-size:14px;max-width:320px;margin:0 auto">Connect your Hotmail above to see your inbox count and top senders.</p>
      </div>
    `}
  `;

  bindMailEvents();
  updateMailBadge(cache?.unread);
}

function renderSenderRows(senders) {
  if (!senders?.length) return `<p class="text-muted text-sm">No sender data yet.</p>`;
  const max = senders[0]?.count || 1;
  return senders.map((s, i) => {
    const rankCls = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const col     = AVATAR_COLS[i % AVATAR_COLS.length];
    const initial = (s.name || s.email || '?')[0].toUpperCase();
    const barPct  = Math.round((s.count / max) * 100);
    return `
      <div class="sender-row">
        <div class="sender-rank ${rankCls}">${i + 1}</div>
        <div class="sender-avatar" style="background:${col}">${initial}</div>
        <div class="sender-info">
          <div class="sender-name">${s.name || s.email}</div>
          <div class="sender-email">${s.email}</div>
        </div>
        <div class="sender-bar-wrap">
          <div class="sender-bar-track"><div class="sender-bar-fill" style="width:${barPct}%"></div></div>
        </div>
        <div class="sender-count-wrap">
          <div class="sender-count">${s.count}</div>
          <div class="sender-count-lbl">emails</div>
        </div>
      </div>`;
  }).join('');
}

function bindMailEvents() {
  // Tab switching
  document.getElementById('tab-token')?.addEventListener('click', () => {
    window.state.mailMode = 'token'; saveState(); renderMail();
  });
  document.getElementById('tab-app')?.addEventListener('click', () => {
    window.state.mailMode = 'app'; saveState(); renderMail();
  });

  // Token connect
  document.getElementById('mail-token-btn')?.addEventListener('click', async () => {
    const input    = document.getElementById('mail-token-input');
    const statusEl = document.getElementById('mail-token-status');
    const raw      = input?.value.trim();

    // If they haven't changed the masked value, use existing
    const token = raw && raw !== '••••••••••••' ? raw : window.state.mailPastedToken;
    if (!token) { statusEl.textContent = '✗ Please paste your token first.'; statusEl.className = 'mail-status err'; return; }

    window.state.mailPastedToken = token;
    window.state.mailMode        = 'token';
    saveState();

    statusEl.textContent = 'Loading your inbox…'; statusEl.className = 'mail-status loading';
    try {
      const data = await fetchMailData();
      window.state.mailCache = data; saveState();
      statusEl.textContent = `✓ Loaded — ${data.total} emails, ${data.unread} unread`; statusEl.className = 'mail-status ok';
      renderMail();
    } catch (err) {
      statusEl.textContent = `✗ ${err.message}`; statusEl.className = 'mail-status err';
    }
  });

  // App (Azure) connect
  document.getElementById('mail-app-btn')?.addEventListener('click', async () => {
    const input    = document.getElementById('mail-clientid-input');
    const statusEl = document.getElementById('mail-app-status');
    const clientId = input?.value.trim();
    if (!clientId) { statusEl.textContent = '✗ Paste your Client ID first.'; statusEl.className = 'mail-status err'; return; }

    window.state.outlookClientId = clientId;
    window.state.mailMode        = 'app';
    window.state.mailPastedToken = '';
    msalApp = null;
    saveState();

    statusEl.textContent = 'Opening Microsoft login…'; statusEl.className = 'mail-status loading';
    try {
      const data = await fetchMailData();
      window.state.mailCache = data; saveState();
      statusEl.textContent = `✓ Connected — ${data.total} emails, ${data.unread} unread`; statusEl.className = 'mail-status ok';
      renderMail();
    } catch (err) {
      statusEl.textContent = `✗ ${err.message}`; statusEl.className = 'mail-status err';
    }
  });

  document.getElementById('mail-refresh-btn')?.addEventListener('click', refreshMail);
  document.getElementById('mail-load-btn')?.addEventListener('click', refreshMail);
  document.getElementById('mail-signout-btn')?.addEventListener('click', signOut);
}

async function refreshMail() {
  const statusEls = ['mail-token-status','mail-app-status'].map(id => document.getElementById(id)).filter(Boolean);
  statusEls.forEach(el => { el.textContent = 'Refreshing…'; el.className = 'mail-status loading'; });
  try {
    const data = await fetchMailData();
    window.state.mailCache = data; saveState();
    renderMail();
  } catch (err) {
    statusEls.forEach(el => { el.textContent = `✗ ${err.message}`; el.className = 'mail-status err'; });
  }
}

function updateMailBadge(unread) {
  const badge = document.getElementById('mail-nav-badge');
  if (!badge) return;
  if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.style.display = 'inline-block'; }
  else badge.style.display = 'none';
}
