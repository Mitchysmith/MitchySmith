// ── Snail Mail – Outlook / Hotmail via Microsoft Graph ──

const MAIL_SCOPES  = ['Mail.Read', 'User.Read'];
const GRAPH_BASE   = 'https://graph.microsoft.com/v1.0';

// Avatar colours cycling for senders
const AVATAR_COLS  = ['#6aadff','#ff7730','#4caf78','#c084fc','#f472b6','#facc15','#f87171','#34d399'];

let msalApp   = null;
let mailToken = null;

function getMsalApp() {
  const clientId = window.state.outlookClientId || '';
  if (!clientId) return null;
  if (msalApp) return msalApp;
  try {
    msalApp = new msal.PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/consumers',
        // Match the exact URL of wherever the dashboard is running
        redirectUri: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/'),
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
    });
    return msalApp;
  } catch (e) {
    console.error('MSAL init failed', e);
    return null;
  }
}

async function getMailToken() {
  const app = getMsalApp();
  if (!app) return null;

  const accounts = app.getAllAccounts();

  // Try silent first
  if (accounts.length) {
    try {
      const res = await app.acquireTokenSilent({ scopes: MAIL_SCOPES, account: accounts[0] });
      return res.accessToken;
    } catch (_) { /* fall through to popup */ }
  }

  // Interactive popup login
  try {
    const res = await app.loginPopup({ scopes: MAIL_SCOPES });
    return res.accessToken;
  } catch (e) {
    console.error('Mail login failed', e);
    return null;
  }
}

function signOutMail() {
  const app = getMsalApp();
  if (app) {
    const accounts = app.getAllAccounts();
    if (accounts.length) app.logoutPopup({ account: accounts[0] }).catch(() => {});
  }
  window.state.outlookClientId = '';
  window.state.mailCache = null;
  saveState();
  msalApp   = null;
  mailToken = null;
  renderMail();
}

// ── Fetch inbox data ──
async function fetchMailData(statusEl) {
  const token = await getMailToken();
  if (!token) {
    if (statusEl) { statusEl.textContent = '✗ Login cancelled or failed. Try again.'; statusEl.className = 'mail-status err'; }
    return null;
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Total inbox count (fast — just reads folder metadata)
  const folderRes = await fetch(`${GRAPH_BASE}/me/mailFolders/inbox?$select=totalItemCount,unreadItemCount`, { headers });
  if (!folderRes.ok) throw new Error('Could not read inbox. Check your app permissions include Mail.Read.');
  const folder = await folderRes.json();

  // Fetch up to 250 recent messages to find top senders
  // We only request the "from" field to keep it fast
  let messages = [];
  let url = `${GRAPH_BASE}/me/mailFolders/inbox/messages?$select=from,receivedDateTime&$top=250&$orderby=receivedDateTime desc`;

  const msgRes = await fetch(url, { headers });
  if (msgRes.ok) {
    const data = await msgRes.json();
    messages = data.value || [];
  }

  // Tally senders
  const tally = {};
  for (const m of messages) {
    const addr = m.from?.emailAddress?.address?.toLowerCase() || 'unknown';
    const name = m.from?.emailAddress?.name || addr;
    if (!tally[addr]) tally[addr] = { name, email: addr, count: 0 };
    tally[addr].count++;
  }

  const topSenders = Object.values(tally)
    .sort((a,b) => b.count - a.count)
    .slice(0, 10);

  return {
    total:      folder.totalItemCount  || 0,
    unread:     folder.unreadItemCount || 0,
    analysed:   messages.length,
    topSenders,
    syncedAt:   new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
  };
}

// ── Render ──
function renderMail() {
  const el = document.getElementById('section-mail');
  const hasClientId = !!(window.state.outlookClientId || '').trim();
  const cache       = window.state.mailCache || null;

  el.innerHTML = `
    <div class="page-header">
      <h1>Snail Mail</h1>
      <p>Your Hotmail inbox at a glance — count, unread, and who's filling it up.</p>
    </div>

    <!-- Connect / setup card -->
    <div class="mail-connect-card ${hasClientId ? 'connected' : ''}" id="mail-connect-card">
      <div class="mail-connect-header">
        <span class="mail-connect-icon">📬</span>
        <div>
          <div class="mail-connect-title">${hasClientId ? 'Microsoft Account Connected' : 'Connect Your Hotmail'}</div>
          <div class="mail-connect-sub">mitchell.smith.work@hotmail.com</div>
        </div>
        ${hasClientId ? `<span class="mail-connected-badge">✓ Connected</span>` : ''}
      </div>

      ${!hasClientId ? `
      <div class="mail-steps">
        <div class="mail-step"><span class="step-num">1</span><span>Go to <strong>portal.azure.com</strong> — sign in with any Microsoft account (even your Hotmail works)</span></div>
        <div class="mail-step"><span class="step-num">2</span><span>Search for <strong>App registrations</strong> at the top, then click <strong>New registration</strong></span></div>
        <div class="mail-step"><span class="step-num">3</span><span>Name it anything (e.g. <em>My Dashboard</em>). Under <strong>Supported account types</strong> choose <strong>"Personal Microsoft accounts only"</strong></span></div>
        <div class="mail-step"><span class="step-num">4</span><span>Under <strong>Redirect URI</strong> choose <strong>Single-page application (SPA)</strong> and paste: <code style="background:var(--surface-3);padding:2px 6px;border-radius:4px;font-size:11px">${window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/')}</code></span></div>
        <div class="mail-step"><span class="step-num">5</span><span>Click <strong>Register</strong>. Copy the <strong>Application (client) ID</strong> shown on the overview page and paste it below</span></div>
      </div>
      ` : `
      <button class="btn btn-ghost" id="mail-show-setup" style="font-size:12px;margin-bottom:16px">Show setup instructions again ↓</button>
      <div id="mail-setup-steps" style="display:none">
        <div class="mail-steps">
          <div class="mail-step"><span class="step-num">1</span><span>Go to <strong>portal.azure.com</strong></span></div>
          <div class="mail-step"><span class="step-num">2</span><span>Find your app registration and copy the <strong>Application (client) ID</strong></span></div>
          <div class="mail-step"><span class="step-num">3</span><span>Paste it below and click Connect</span></div>
        </div>
      </div>
      `}

      <div class="mail-input-row">
        <input type="text" id="mail-client-id" placeholder="Paste your Application (client) ID here…" value="${window.state.outlookClientId || ''}" />
        <button class="btn btn-primary" id="mail-connect-btn">${hasClientId ? 'Refresh' : 'Connect'}</button>
        ${hasClientId ? `<button class="mail-signout" id="mail-signout-btn">Sign out</button>` : ''}
      </div>
      <div class="mail-status" id="mail-status">${cache ? `✓ Last synced ${cache.syncedAt}` : ''}</div>
    </div>

    <!-- Stats -->
    ${cache ? `
    <div class="mail-toolbar">
      <div class="mail-last-sync">Analysed ${cache.analysed} recent messages · Synced ${cache.syncedAt} AEST</div>
      <button class="btn btn-ghost" id="mail-refresh-btn" style="font-size:12px">↻ Refresh</button>
    </div>

    <div class="mail-stats">
      <div class="mail-stat">
        <div class="mail-stat-label">Total in Inbox</div>
        <div class="mail-stat-value" style="color:var(--blue)">${cache.total.toLocaleString()}</div>
        <div class="mail-stat-sub">All time</div>
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

    <div class="card senders-card">
      <div class="section-title">Top 10 Talkers</div>
      <div id="senders-list">${renderSenderRows(cache.topSenders)}</div>
    </div>
    ` : hasClientId ? `
    <div class="card" style="text-align:center;padding:40px">
      <p class="text-muted" style="margin-bottom:16px">Click <strong>Refresh</strong> above to load your inbox data.</p>
      <button class="btn btn-primary" id="mail-load-btn">Load My Inbox</button>
    </div>
    ` : `
    <div class="card" style="text-align:center;padding:48px 20px">
      <div style="font-size:48px;margin-bottom:12px">📭</div>
      <p style="color:var(--text-muted);font-size:14px;max-width:300px;margin:0 auto">Connect your Hotmail above to see your inbox count and top senders.</p>
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
          <div class="sender-bar-track">
            <div class="sender-bar-fill" style="width:${barPct}%"></div>
          </div>
        </div>
        <div class="sender-count-wrap">
          <div class="sender-count">${s.count}</div>
          <div class="sender-count-lbl">emails</div>
        </div>
      </div>`;
  }).join('');
}

function bindMailEvents() {
  document.getElementById('mail-connect-btn')?.addEventListener('click', connectMail);
  document.getElementById('mail-refresh-btn')?.addEventListener('click', connectMail);
  document.getElementById('mail-load-btn')?.addEventListener('click', connectMail);
  document.getElementById('mail-signout-btn')?.addEventListener('click', signOutMail);

  document.getElementById('mail-show-setup')?.addEventListener('click', () => {
    const steps = document.getElementById('mail-setup-steps');
    if (steps) steps.style.display = steps.style.display === 'none' ? 'block' : 'none';
  });
}

async function connectMail() {
  const idInput  = document.getElementById('mail-client-id');
  const statusEl = document.getElementById('mail-status');
  const clientId = idInput?.value.trim() || window.state.outlookClientId || '';

  if (!clientId) {
    if (statusEl) { statusEl.textContent = '✗ Please paste your Application (client) ID first.'; statusEl.className = 'mail-status err'; }
    return;
  }

  // Save client ID so MSAL can use it
  window.state.outlookClientId = clientId;
  msalApp = null; // reset so it re-initialises with new ID
  saveState();

  if (statusEl) { statusEl.textContent = 'Connecting to Microsoft… (a login popup will appear)'; statusEl.className = 'mail-status loading'; }

  try {
    const data = await fetchMailData(statusEl);
    if (!data) return;

    window.state.mailCache = data;
    saveState();

    if (statusEl) { statusEl.textContent = `✓ Synced successfully — ${data.total} emails, ${data.unread} unread`; statusEl.className = 'mail-status ok'; }

    renderMail();
  } catch (err) {
    if (statusEl) { statusEl.textContent = `✗ ${err.message}`; statusEl.className = 'mail-status err'; }
  }
}

function updateMailBadge(unread) {
  const badge = document.getElementById('mail-nav-badge');
  if (!badge) return;
  if (unread && unread > 0) {
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}
