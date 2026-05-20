// ── Learning – Markets & News ──

const LEARN_CURRENCIES = ['USD','EUR','GBP','JPY','CNY','NZD','SGD'];

const SENT_POS = ['surge','gain','rise','soar','climb','strong','bullish','growth','record high','beat','exceed','upgrade','rally','recover','outperform','boost','jump','advance','increase','rebound'];
const SENT_NEG = ['fall','drop','plunge','decline','slump','weak','bearish','loss','miss','below','downgrade','crash','risk','cut','underperform','concern','fear','recession','contract','pressure','tumble'];

let _learnRates   = null;
let _learnNews    = [];
let _learnBusy    = false;
let _learnFilter  = 'all';

function renderLearn() {
  const el = document.getElementById('section-learn');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
      <div>
        <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.5px">Markets &amp; News</h1>
        <p style="font-size:14px;color:var(--text-muted);margin-top:4px">Live AUD rates · ASX &amp; macro headlines · sentiment</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span id="learn-updated" style="font-size:11px;color:var(--text-dim)"></span>
        <button class="btn btn-ghost" onclick="refreshLearnData()" id="learn-refresh-btn">↻ Refresh</button>
      </div>
    </div>

    <div class="learn-section-lbl">💱 AUD Exchange Rates</div>
    <div class="learn-fx-grid" id="learn-fx-grid">
      <div class="learn-placeholder">Fetching live rates…</div>
    </div>

    <div class="learn-news-hdr">
      <div class="learn-section-lbl" style="margin:0">📰 Market &amp; ASX News</div>
      <div class="learn-filters" id="learn-filters">
        <button class="learn-filter active" data-f="all">All</button>
        <button class="learn-filter" data-f="asx">ASX</button>
        <button class="learn-filter" data-f="aud">AUD / FX</button>
        <button class="learn-filter" data-f="macro">Macro</button>
      </div>
    </div>
    <div class="learn-news-feed" id="learn-news-feed">
      <div class="learn-placeholder">Fetching market news…</div>
    </div>`;

  el.querySelectorAll('.learn-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      _learnFilter = btn.dataset.f;
      el.querySelectorAll('.learn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderNews();
    });
  });

  refreshLearnData();
}

async function refreshLearnData() {
  if (_learnBusy) return;
  _learnBusy = true;
  const btn = document.getElementById('learn-refresh-btn');
  if (btn) { btn.textContent = '⟳ Loading…'; btn.disabled = true; }

  await Promise.allSettled([_fetchRates(), _fetchNews()]);

  _learnBusy = false;
  if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
  const upd = document.getElementById('learn-updated');
  if (upd) upd.textContent = 'Updated ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

async function _fetchRates() {
  const grid = document.getElementById('learn-fx-grid');
  try {
    const data = await fetch('https://open.er-api.com/v6/latest/AUD').then(r => r.json());
    if (data.result !== 'success') throw new Error('bad response');

    const today        = new Date().toISOString().slice(0, 10);
    const latestStored = JSON.parse(localStorage.getItem('_fxLatest') || 'null');

    // When the day rolls over, promote yesterday's snapshot to "prev" for comparison
    if (latestStored && latestStored.date !== today) {
      localStorage.setItem('_fxPrev', JSON.stringify(latestStored));
    }
    localStorage.setItem('_fxLatest', JSON.stringify({ rates: data.rates, date: today }));

    const prevStored = JSON.parse(localStorage.getItem('_fxPrev') || 'null');
    _learnRates = { today: data.rates, prev: prevStored?.rates || null };
    _renderRates();
  } catch {
    if (grid) grid.innerHTML = `<div class="learn-error">⚠ Could not fetch rates — check your connection.</div>`;
  }
}

function _renderRates() {
  const grid = document.getElementById('learn-fx-grid');
  if (!grid || !_learnRates) return;
  const { today, prev } = _learnRates;
  const META = {
    USD: { flag:'🇺🇸', name:'US Dollar'         },
    EUR: { flag:'🇪🇺', name:'Euro'               },
    GBP: { flag:'🇬🇧', name:'British Pound'      },
    JPY: { flag:'🇯🇵', name:'Japanese Yen'       },
    CNY: { flag:'🇨🇳', name:'Chinese Yuan'       },
    NZD: { flag:'🇳🇿', name:'NZ Dollar'          },
    SGD: { flag:'🇸🇬', name:'Singapore Dollar'   },
  };
  grid.innerHTML = LEARN_CURRENCIES.map(cur => {
    const rate   = today[cur];
    const pRate  = prev?.[cur];
    const chg    = pRate ? (rate - pRate) / pRate * 100 : 0;
    const dir    = chg > 0.02 ? 'up' : chg < -0.02 ? 'down' : 'flat';
    const dp     = cur === 'JPY' ? 2 : 4;
    const arrow  = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→';
    return `
      <div class="learn-fx-card learn-fx-${dir}">
        <div class="learn-fx-left">
          <span class="learn-fx-flag">${META[cur].flag}</span>
          <div>
            <div class="learn-fx-pair">AUD / ${cur}</div>
            <div class="learn-fx-name">${META[cur].name}</div>
          </div>
        </div>
        <div class="learn-fx-right">
          <div class="learn-fx-rate">${rate?.toFixed(dp) ?? '—'}</div>
          <div class="learn-fx-chg learn-fx-chg-${dir}">${arrow} ${Math.abs(chg).toFixed(2)}%</div>
        </div>
      </div>`;
  }).join('');
}

async function _fetchNews() {
  const RSS2J = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const FEEDS = [
    { url: 'https://www.afr.com/rss',                                             src: 'AFR'          },
    { url: 'https://www.afr.com/markets.rss',                                     src: 'AFR'          },
    { url: 'https://www.afr.com/companies.rss',                                   src: 'AFR'          },
    { url: 'https://www.abc.net.au/news/feed/51120/rss.xml',                      src: 'ABC News'     },
    { url: 'https://www.theguardian.com/australia-news/business/rss',             src: 'The Guardian' },
    { url: 'https://feeds.reuters.com/reuters/businessNews',                      src: 'Reuters'      },
  ];

  const results = await Promise.allSettled(
    FEEDS.map(f =>
      fetch(RSS2J + encodeURIComponent(f.url))
        .then(r => r.json())
        .then(j => (j.items || []).map(item => ({ ...item, _src: f.src })))
    )
  );

  const all = [];
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
  all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const seen = new Set();
  _learnNews = all.filter(item => {
    const k = item.title?.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 60);

  _renderNews();
}

function _sentiment(text) {
  const lw  = (text || '').toLowerCase();
  const pos = SENT_POS.filter(w => lw.includes(w)).length;
  const neg = SENT_NEG.filter(w => lw.includes(w)).length;
  if (pos >= neg + 2) return 'positive';
  if (neg >= pos + 2) return 'negative';
  return 'neutral';
}

function _tags(text) {
  const lw   = (text || '').toLowerCase();
  const tags = [];
  if (lw.match(/\basx\b|\bstock\b|\bshares?\b|\bdividend\b|\bearnings?\b|\blisted\b/)) tags.push('ASX');
  if (lw.match(/\baud\b|\baustralian dollar\b|\baussie\b|\bfx\b|\bexchange rate\b/))   tags.push('AUD');
  if (lw.match(/\brba\b|\breserve bank\b|\binterest rate\b|\binflation\b|\bgdp\b|\bcpi\b|\bcash rate\b/)) tags.push('RBA');
  if (lw.match(/\bfederal reserve\b|\bfed \b|\bchina\b|\btariff\b|\btrade war\b|\bwall street\b|\bnasdaq\b/)) tags.push('Global');
  if (lw.match(/\biron ore\b|\bcopper\b|\bgold\b|\bcoal\b|\boil\b|\bcommodit\b|\bmining\b|\bresource\b/)) tags.push('Commodities');
  return tags;
}

function _keyNote(desc) {
  if (!desc) return '';
  const plain = desc.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > 180 ? plain.slice(0, 177) + '…' : plain;
}

function _timeAgo(str) {
  if (!str) return '';
  const s = (Date.now() - new Date(str)) / 1000;
  if (s < 3600)  return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function _renderNews() {
  const feed = document.getElementById('learn-news-feed');
  if (!feed) return;

  const SENT_ICON  = { positive:'📈', negative:'📉', neutral:'➡️' };
  const SENT_LABEL = { positive:'Bullish',  negative:'Bearish', neutral:'Neutral' };

  let items = _learnNews;
  if (_learnFilter !== 'all') {
    items = _learnNews.filter(item => {
      const combined = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
      if (_learnFilter === 'asx')   return /\basx\b|\bstock\b|\bshares?\b|\bdividend\b/.test(combined);
      if (_learnFilter === 'aud')   return /\baud\b|\baustralian dollar\b|\baussie\b/.test(combined);
      if (_learnFilter === 'macro') return /\brba\b|\breserve bank\b|\binterest rate\b|\binflation\b|\bgdp\b/.test(combined);
      return true;
    });
  }

  if (!items.length) {
    feed.innerHTML = `<div class="learn-empty">No articles match this filter. Try refreshing or selecting All.</div>`;
    return;
  }

  feed.innerHTML = items.map(item => {
    const combined  = (item.title || '') + ' ' + (item.description || '');
    const sentiment = _sentiment(combined);
    const tags      = _tags(combined);
    const keyNote   = _keyNote(item.description);
    const ago       = _timeAgo(item.pubDate);

    return `
      <div class="learn-card learn-sent-${sentiment}">
        <div class="learn-card-hdr">
          <div class="learn-card-meta">
            <span class="learn-src-badge" data-src="${item._src || ''}">${item._src || 'News'}</span>
            <span class="learn-ago">${ago}</span>
            ${tags.map(t => `<span class="learn-tag learn-tag-${t.toLowerCase()}">${t}</span>`).join('')}
          </div>
          <span class="learn-sent-pill learn-sent-${sentiment}">
            ${SENT_ICON[sentiment]} ${SENT_LABEL[sentiment]}
          </span>
        </div>
        <a class="learn-headline" href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">${item.title || 'Untitled'}</a>
        ${keyNote ? `<p class="learn-keynote"><span class="learn-keynote-lbl">Key note:</span> ${keyNote}</p>` : ''}
      </div>`;
  }).join('');
}
