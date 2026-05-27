// ── Stocks – Investment Research ──

const STOCK_DEFS = {
  revenueGrowth: [0.08, 0.07, 0.06, 0.05, 0.05],
  ebitdaMargin:  [0.30, 0.31, 0.31, 0.32, 0.32],
  daPct:         [0.04, 0.04, 0.04, 0.04, 0.04],
  capexPct:      [0.05, 0.05, 0.05, 0.05, 0.05],
  nwcPct:        [0.01, 0.01, 0.01, 0.01, 0.01],
  taxRate:       0.25,
  wacc:          0.09,
  terminalGrowth:0.025,
  exitMultiple:  10,
};

let _activeStockId  = null;
let _activeStockTab = 'model';
let _debounce       = null;

// ── Helpers ──

function escS(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(val, dp) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toFixed(dp !== undefined ? dp : 1);
}

function fmtPct(val, dp) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return (Number(val) * 100).toFixed(dp !== undefined ? dp : 1) + '%';
}

function fmtCcy(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const n = Number(val);
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2) + 'B';
  return n.toFixed(0) + 'M';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fileSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── State init ──

function initStocks() {
  if (!window.state.stocks) window.state.stocks = [];
}

// ── CRUD ──

function createStock(ticker, name, sector, exchange, currency) {
  initStocks();
  const stock = {
    id:       String(Date.now()),
    ticker:   ticker.toUpperCase().trim(),
    name:     name.trim(),
    sector:   sector.trim(),
    exchange: exchange.trim() || 'ASX',
    currency: currency.trim() || 'AUD',
    created:  today(),
    notes:    '',
    links:    [],
    actuals: {
      revenue:      0,
      ebitda:       0,
      da:           0,
      capex:        0,
      netDebt:      0,
      sharesOut:    0,
      currentPrice: 0,
    },
    assumptions: {
      revenueGrowth:  [...STOCK_DEFS.revenueGrowth],
      ebitdaMargin:   [...STOCK_DEFS.ebitdaMargin],
      daPct:          [...STOCK_DEFS.daPct],
      capexPct:       [...STOCK_DEFS.capexPct],
      nwcPct:         [...STOCK_DEFS.nwcPct],
      taxRate:        STOCK_DEFS.taxRate,
      wacc:           STOCK_DEFS.wacc,
      terminalGrowth: STOCK_DEFS.terminalGrowth,
      exitMultiple:   STOCK_DEFS.exitMultiple,
      scenario:       'base',
    },
    documents: [],
    history:   [],
  };
  window.state.stocks.push(stock);
  saveState();
  return stock;
}

function deleteStock(id) {
  window.state.stocks = (window.state.stocks || []).filter(s => s.id !== id);
  if (_activeStockId === id) {
    _activeStockId  = null;
    _activeStockTab = 'model';
  }
  saveState();
}

function getStock(id) {
  return (window.state.stocks || []).find(s => s.id === id) || null;
}

function saveStockField(id, path, value) {
  const stock = getStock(id);
  if (!stock) return;
  const parts = path.split('.');
  let obj = stock;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] === undefined) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  saveState();
}

// ── DCF Engine ──

function calcDCF(stock, scenarioOverride) {
  const a    = stock.actuals;
  const base = stock.assumptions;
  const sc   = scenarioOverride || base.scenario || 'base';

  // Apply scenario deltas
  const rg = base.revenueGrowth.map((v, i) => {
    if (sc === 'bear') return v - 0.02;
    if (sc === 'bull') return v + 0.02;
    return v;
  });
  const em = base.ebitdaMargin.map((v, i) => {
    if (sc === 'bear') return v - 0.02;
    if (sc === 'bull') return v + 0.01;
    return v;
  });
  const dp    = base.daPct;
  const cp    = base.capexPct;
  const nwc   = base.nwcPct;
  const tax   = base.taxRate;
  const waccR = sc === 'bear' ? base.wacc + 0.01 : sc === 'bull' ? base.wacc - 0.01 : base.wacc;
  const tgr   = base.terminalGrowth;
  const exitM = base.exitMultiple;

  const years    = [1, 2, 3, 4, 5];
  const revenues = [];
  const ebitdas  = [];
  const das      = [];
  const ebits    = [];
  const taxes    = [];
  const nopats   = [];
  const capexs   = [];
  const dnwcs    = [];
  const fcfs     = [];
  const dfs      = [];
  const pvFcfs   = [];

  let prevRev = a.revenue || 0;

  years.forEach((yr, i) => {
    const rev    = prevRev * (1 + rg[i]);
    const ebitda = rev * em[i];
    const da     = rev * dp[i];
    const ebit   = ebitda - da;
    const txAmt  = Math.max(0, ebit) * tax;
    const nopat  = ebit - txAmt;
    const capex  = rev * cp[i];
    const dnwc   = (rev - prevRev) * nwc[i];
    const fcf    = nopat + da - capex - dnwc;
    const df     = 1 / Math.pow(1 + waccR, yr);
    const pvFcf  = fcf * df;

    revenues.push(rev);
    ebitdas.push(ebitda);
    das.push(da);
    ebits.push(ebit);
    taxes.push(txAmt);
    nopats.push(nopat);
    capexs.push(capex);
    dnwcs.push(dnwc);
    fcfs.push(fcf);
    dfs.push(df);
    pvFcfs.push(pvFcf);

    prevRev = rev;
  });

  const fcf5    = fcfs[4];
  const ebitda5 = ebitdas[4];
  const tvGGM   = (waccR - tgr) > 0 ? (fcf5 * (1 + tgr)) / (waccR - tgr) : 0;
  const tvMult  = ebitda5 * exitM;
  const tv      = (tvGGM + tvMult) / 2;
  const pvTV    = tv / Math.pow(1 + waccR, 5);

  const sumPvFcf   = pvFcfs.reduce((s, v) => s + v, 0);
  const ev         = sumPvFcf + pvTV;
  const equityVal  = ev - (a.netDebt || 0);
  const shares     = a.sharesOut || 0;
  const intrinsic  = shares > 0 ? equityVal / shares : 0;
  const curPrice   = a.currentPrice || 0;
  const upside     = curPrice > 0 ? (intrinsic - curPrice) / curPrice : null;

  let rating = 'N/D';
  if (upside !== null) {
    if (upside > 0.15)       rating = 'BUY';
    else if (upside < -0.05) rating = 'SELL';
    else                     rating = 'HOLD';
  }

  return {
    scenario: sc,
    years, revenues, ebitdas, das, ebits, taxes, nopats,
    capexs, dnwcs, fcfs, dfs, pvFcfs,
    tvGGM, tvMult, tv, pvTV,
    sumPvFcf, ev, equityVal, intrinsic,
    upside, rating,
    rg, em, dp, cp, nwc, tax, wacc: waccR, tgr, exitM,
  };
}

// ── Entry Point ──

function renderStocks() {
  initStocks();
  const el = document.getElementById('section-stocks');
  if (!el) return;

  const stocks = window.state.stocks || [];

  // Re-select first if active stock deleted
  if (_activeStockId && !getStock(_activeStockId)) {
    _activeStockId = null;
  }
  if (!_activeStockId && stocks.length > 0) {
    _activeStockId = stocks[0].id;
  }

  el.innerHTML = `
    <div class="stocks-layout">
      <div class="stocks-sidebar">
        <div class="stocks-sidebar-header">
          <span class="stocks-sidebar-title">Watchlist</span>
          <button class="stocks-new-btn" data-action="new-stock">+ New</button>
        </div>
        <div class="stocks-list" id="stocks-list">
          ${_renderSidebarList(stocks)}
        </div>
      </div>
      <div class="stocks-main" id="stocks-main">
        ${_activeStockId ? _renderStockDetail(getStock(_activeStockId)) : _renderEmptyState()}
      </div>
    </div>`;

  _bindStocksEvents(el);
}

function _renderSidebarList(stocks) {
  if (!stocks.length) {
    return `<div class="stocks-sidebar-empty">No stocks yet.<br>Click "+ New" to add your first.</div>`;
  }
  return stocks.map(s => {
    const res    = calcDCF(s, s.assumptions.scenario);
    const active = s.id === _activeStockId;
    const rCls   = res.rating === 'BUY' ? 'buy' : res.rating === 'SELL' ? 'sell' : res.rating === 'HOLD' ? 'hold' : 'nd';
    return `
      <div class="stock-list-item ${active ? 'active' : ''}" data-action="select-stock" data-id="${s.id}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="sli-ticker">${escS(s.ticker)}</span>
          <span class="sdh-rating ${rCls}" style="font-size:10px;padding:2px 8px">${res.rating}</span>
        </div>
        <div class="sli-name">${escS(s.name)}</div>
        <div class="sli-meta">
          <span>${escS(s.exchange)}</span>
          <span>${escS(s.sector)}</span>
        </div>
      </div>`;
  }).join('');
}

function _renderEmptyState() {
  return `
    <div class="stocks-empty">
      <div class="stocks-empty-icon">📈</div>
      <h3>No Stock Selected</h3>
      <p>Create a new stock from the sidebar or select an existing one to begin your research.</p>
    </div>`;
}

function _renderStockDetail(stock) {
  if (!stock) return _renderEmptyState();
  const res  = calcDCF(stock, stock.assumptions.scenario);
  const rCls = res.rating === 'BUY' ? 'buy' : res.rating === 'SELL' ? 'sell' : res.rating === 'HOLD' ? 'hold' : 'nd';

  const tabs = [
    { key: 'model',   label: 'DCF Model' },
    { key: 'history', label: 'Snapshots' },
    { key: 'docs',    label: 'Documents' },
    { key: 'notes',   label: 'Notes' },
  ];

  const tabBtns = tabs.map(t =>
    `<button class="stock-tab ${_activeStockTab === t.key ? 'active' : ''}"
             data-action="switch-tab" data-tab="${t.key}">${t.label}</button>`
  ).join('');

  const panels = tabs.map(t => {
    let content = '';
    if (t.key === 'model')   content = _renderModelTab(stock, res);
    if (t.key === 'history') content = _renderHistoryTab(stock);
    if (t.key === 'docs')    content = _renderDocsTab(stock);
    if (t.key === 'notes')   content = _renderNotesTab(stock);
    return `<div class="stock-tab-panel ${_activeStockTab === t.key ? 'active' : ''}" data-panel="${t.key}">${content}</div>`;
  }).join('');

  return `
    <div class="stock-detail-header">
      <div class="sdh-left">
        <div class="sdh-ticker">${escS(stock.ticker)}</div>
        <div class="sdh-meta">
          <span class="sdh-name">${escS(stock.name)}</span>
          <span class="sdh-badge">${escS(stock.exchange)}</span>
          <span class="sdh-badge">${escS(stock.sector)}</span>
          <span class="sdh-badge">${escS(stock.currency)}</span>
        </div>
      </div>
      <div class="sdh-actions">
        <span class="sdh-rating ${rCls}">${res.rating}</span>
        <button class="sdh-export-btn" data-action="export-excel" data-id="${stock.id}">Export Excel</button>
        <button class="sdh-action-btn danger" data-action="delete-stock" data-id="${stock.id}">Delete</button>
      </div>
    </div>
    <div class="stock-tabs">${tabBtns}</div>
    ${panels}`;
}

// ── Model Tab ──

function _renderModelTab(stock, res) {
  const a    = stock.actuals;
  const base = stock.assumptions;
  const sc   = res.scenario;

  const scenarioBtns = ['bear', 'base', 'bull'].map(s =>
    `<button class="scenario-btn ${sc === s ? 'active ' + s : ''}" data-action="set-scenario" data-scenario="${s}">
      ${s.charAt(0).toUpperCase() + s.slice(1)}
    </button>`
  ).join('');

  const pctRows = [
    { key: 'revenueGrowth', label: 'Revenue Growth %', vals: base.revenueGrowth },
    { key: 'ebitdaMargin',  label: 'EBITDA Margin %',  vals: base.ebitdaMargin  },
    { key: 'daPct',         label: 'D&A % Revenue',    vals: base.daPct         },
    { key: 'capexPct',      label: 'CapEx % Revenue',  vals: base.capexPct      },
    { key: 'nwcPct',        label: 'NWC Delta % Rev',  vals: base.nwcPct        },
  ];

  const assumptionRows = pctRows.map(row => {
    const cells = row.vals.map((v, i) =>
      `<td><input type="number" step="0.01" class="assumption-input"
         data-stock="${stock.id}" data-field="assumptions.${row.key}.${i}"
         value="${fmtNum(v * 100, 2)}" /></td>`
    ).join('');
    return `<tr><td>${row.label}</td><td style="color:var(--text-dim)">—</td>${cells}</tr>`;
  }).join('');

  const actualsInputs = [
    { key: 'revenue',      label: 'Revenue ($M)',    val: a.revenue      },
    { key: 'ebitda',       label: 'EBITDA ($M)',     val: a.ebitda       },
    { key: 'da',           label: 'D&A ($M)',        val: a.da           },
    { key: 'capex',        label: 'CapEx ($M)',      val: a.capex        },
    { key: 'netDebt',      label: 'Net Debt ($M)',   val: a.netDebt      },
    { key: 'sharesOut',    label: 'Shares Out (M)',  val: a.sharesOut    },
    { key: 'currentPrice', label: 'Current Price',   val: a.currentPrice },
  ].map(f => `
    <div class="actual-field">
      <label>${f.label}</label>
      <input type="number" step="any" class="stock-actual"
             data-stock="${stock.id}" data-field="actuals.${f.key}"
             value="${f.val || 0}" />
    </div>`).join('');

  const cols = ['LTM', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5'];

  const modelRowData = [
    {
      label:   'Revenue ($M)',
      cls:     'model-output-row',
      vals:    [a.revenue, ...res.revenues],
      fmt:     v => fmtNum(v, 0),
    },
    {
      label:   'Growth %',
      cls:     'model-output-row',
      vals:    ['—', ...res.rg.map(v => fmtPct(v, 1))],
      raw:     true,
    },
    {
      label:   'EBITDA ($M)',
      cls:     'model-output-row',
      vals:    [a.ebitda, ...res.ebitdas],
      fmt:     v => fmtNum(v, 0),
    },
    {
      label:   'EBITDA Margin %',
      cls:     'model-output-row',
      vals:    [
        a.revenue > 0 ? fmtPct(a.ebitda / a.revenue, 1) : '—',
        ...res.em.map(v => fmtPct(v, 1)),
      ],
      raw:     true,
    },
    {
      label:   'D&A ($M)',
      cls:     'model-output-row',
      vals:    [a.da, ...res.das],
      fmt:     v => fmtNum(v, 0),
    },
    {
      label:   'EBIT ($M)',
      cls:     'model-output-row',
      vals:    ['—', ...res.ebits],
      fmt:     v => fmtNum(v, 0),
      skipLTM: true,
    },
    {
      label:   'Tax ($M)',
      cls:     'model-output-row',
      vals:    ['—', ...res.taxes],
      fmt:     v => fmtNum(v, 0),
      skipLTM: true,
    },
    {
      label:   'NOPAT ($M)',
      cls:     'model-highlight-row model-output-row',
      vals:    ['—', ...res.nopats],
      fmt:     v => fmtNum(v, 0),
      skipLTM: true,
    },
    {
      label:   'CapEx ($M)',
      cls:     'model-output-row',
      vals:    [a.capex, ...res.capexs],
      fmt:     v => '(' + fmtNum(v, 0) + ')',
    },
    {
      label:   'Delta NWC ($M)',
      cls:     'model-output-row',
      vals:    ['—', ...res.dnwcs],
      fmt:     v => '(' + fmtNum(v, 0) + ')',
      skipLTM: true,
    },
    {
      label:   'Free Cash Flow ($M)',
      cls:     'model-fcf-row model-output-row',
      vals:    ['—', ...res.fcfs],
      fmt:     v => fmtNum(v, 0),
      skipLTM: true,
    },
    {
      label:   'Discount Factor',
      cls:     'model-output-row',
      vals:    ['—', ...res.dfs],
      fmt:     v => fmtNum(v, 4),
      skipLTM: true,
    },
    {
      label:   'PV of FCF ($M)',
      cls:     'model-output-row',
      vals:    ['—', ...res.pvFcfs],
      fmt:     v => fmtNum(v, 0),
      skipLTM: true,
    },
  ];

  function buildModelRow(row) {
    const cells = cols.map((col, i) => {
      const val = row.vals[i];
      if (i === 0 && row.skipLTM) return '<td style="color:var(--text-dim)">—</td>';
      if (row.raw)    return `<td>${val}</td>`;
      if (val === '—') return '<td style="color:var(--text-dim)">—</td>';
      return `<td>${row.fmt(val)}</td>`;
    }).join('');
    return `<tr class="${row.cls}"><td>${row.label}</td>${cells}</tr>`;
  }

  const colHeaders = cols.map(c => `<th>${c}</th>`).join('');
  const modelRows  = modelRowData.map(buildModelRow).join('');

  // Valuation block
  const upside    = res.upside;
  const upsideStr = upside !== null ? (upside >= 0 ? '+' : '') + fmtPct(upside, 1) : '—';
  const rCls      = res.rating === 'BUY' ? 'buy' : res.rating === 'SELL' ? 'sell' : 'hold';
  const curPrice  = a.currentPrice || 0;

  return `
    <div class="scenario-bar">
      <span class="scenario-label">Scenario</span>
      ${scenarioBtns}
      <span class="assumption-badge">Edit yellow cells to update model</span>
    </div>

    <div class="assumptions-section-title">
      Base Year Actuals <span class="assumption-badge">LTM</span>
    </div>
    <div class="actuals-block">${actualsInputs}</div>

    <div class="assumptions-section-title">
      Forecast Assumptions <span class="assumption-badge">Editable</span>
    </div>
    <div class="model-scroll">
      <table class="assumptions-table">
        <thead>
          <tr>
            <th style="text-align:left">Metric</th>
            <th>LTM</th>
            <th>Y1</th><th>Y2</th><th>Y3</th><th>Y4</th><th>Y5</th>
          </tr>
        </thead>
        <tbody>${assumptionRows}</tbody>
      </table>
    </div>

    <div class="dcf-params">
      <div class="dcf-param">
        <label>WACC (%)</label>
        <input type="number" step="0.01" class="dcf-input"
               data-stock="${stock.id}" data-field="assumptions.wacc"
               value="${fmtNum(base.wacc * 100, 2)}" />
      </div>
      <div class="dcf-param">
        <label>Terminal Growth (%)</label>
        <input type="number" step="0.01" class="dcf-input"
               data-stock="${stock.id}" data-field="assumptions.terminalGrowth"
               value="${fmtNum(base.terminalGrowth * 100, 2)}" />
      </div>
      <div class="dcf-param">
        <label>Exit Multiple (x)</label>
        <input type="number" step="0.1" class="dcf-input"
               data-stock="${stock.id}" data-field="assumptions.exitMultiple"
               value="${fmtNum(base.exitMultiple, 1)}" />
      </div>
      <div class="dcf-param">
        <label>Tax Rate (%)</label>
        <input type="number" step="0.1" class="dcf-input"
               data-stock="${stock.id}" data-field="assumptions.taxRate"
               value="${fmtNum(base.taxRate * 100, 1)}" />
      </div>
    </div>

    <div style="margin-top:20px;margin-bottom:8px" class="assumptions-section-title">
      DCF Output
    </div>
    <div class="model-scroll">
      <table class="model-table">
        <thead>
          <tr>
            <th style="text-align:left">Metric</th>
            ${colHeaders}
          </tr>
        </thead>
        <tbody>
          <tr class="model-section-header"><td colspan="7">Income Statement & Cash Flow</td></tr>
          ${modelRows}
        </tbody>
      </table>
    </div>

    <div class="valuation-block">
      <div class="val-col">
        <div class="val-label">Sum PV FCFs</div>
        <div class="val-num">${fmtNum(res.sumPvFcf, 0)}M</div>
      </div>
      <div class="val-col">
        <div class="val-label">Terminal Value (avg)</div>
        <div class="val-num">${fmtNum(res.tv, 0)}M</div>
      </div>
      <div class="val-col">
        <div class="val-label">PV Terminal Value</div>
        <div class="val-num">${fmtNum(res.pvTV, 0)}M</div>
      </div>
      <div class="val-col">
        <div class="val-label">Enterprise Value</div>
        <div class="val-num">${fmtNum(res.ev, 0)}M</div>
      </div>
      <div class="val-col">
        <div class="val-label">Equity Value</div>
        <div class="val-num">${fmtNum(res.equityVal, 0)}M</div>
      </div>
      <div class="val-col">
        <div class="val-label">Current Price</div>
        <div class="val-num">${curPrice > 0 ? curPrice.toFixed(2) : '—'}</div>
      </div>
      <div class="val-col val-col-big">
        <div class="val-label">Intrinsic Value / Share</div>
        <div class="val-num-big">${res.intrinsic > 0 ? res.intrinsic.toFixed(2) : '—'}</div>
        <div class="val-label" style="margin-top:4px">Upside: <strong style="color:${upside !== null && upside > 0 ? 'var(--green)' : 'var(--orange)'}">${upsideStr}</strong></div>
        <div class="val-rating ${rCls}">${res.rating}</div>
      </div>
    </div>`;
}

// ── History Tab ──

function _renderHistoryTab(stock) {
  const history = [...(stock.history || [])].reverse();

  const rows = history.length
    ? history.map(snap => {
        const upside = snap.marketPrice > 0
          ? (snap.targetPrice - snap.marketPrice) / snap.marketPrice
          : null;
        const upStr  = upside !== null
          ? (upside >= 0 ? '+' : '') + (upside * 100).toFixed(1) + '%'
          : '—';
        const uCls   = upside !== null && upside >= 0 ? 'positive' : 'negative';
        return `
          <div class="snapshot-row">
            <span class="snap-date">${snap.date}</span>
            <span class="snap-target">${escS(stock.currency)} ${Number(snap.targetPrice).toFixed(2)}</span>
            <span class="snap-market">mkt ${Number(snap.marketPrice).toFixed(2)}</span>
            <span class="snap-upside ${uCls}">${upStr}</span>
            <span class="snap-notes">${escS(snap.notes || '')}</span>
            <button class="snap-del-btn" data-action="delete-snapshot" data-id="${stock.id}" data-snapid="${snap.id}">✕</button>
          </div>`;
      }).join('')
    : '<div style="color:var(--text-dim);font-size:13px;padding:16px 0">No snapshots yet.</div>';

  return `
    <div class="snapshot-add-row">
      <div class="snap-field">
        <label>Date</label>
        <input type="date" id="snap-date" value="${today()}" />
      </div>
      <div class="snap-field">
        <label>Target Price</label>
        <input type="number" step="0.01" id="snap-target" placeholder="e.g. 12.50" />
      </div>
      <div class="snap-field">
        <label>Market Price</label>
        <input type="number" step="0.01" id="snap-market" placeholder="e.g. 10.20" />
      </div>
      <div class="snap-field" style="flex:2">
        <label>Notes</label>
        <input type="text" id="snap-notes" placeholder="Optional note…" />
      </div>
      <button class="btn btn-primary" style="flex-shrink:0;align-self:flex-end"
              data-action="add-snapshot" data-id="${stock.id}">Save Snapshot</button>
    </div>
    <div class="snapshot-list">${rows}</div>`;
}

// ── Docs Tab ──

function _renderDocsTab(stock) {
  const docs = stock.documents || [];

  const docCards = docs.length
    ? docs.map(doc => `
        <div class="doc-card">
          <div class="doc-card-header">
            <span class="doc-card-name">${escS(doc.name)}</span>
            <span class="doc-card-meta">${fileSize(doc.size)} · ${doc.uploadedAt}</span>
            <button class="doc-card-del" data-action="delete-doc" data-id="${stock.id}" data-docid="${doc.id}">✕</button>
          </div>
          ${doc.extractedText
            ? `<div class="doc-card-preview" data-action="toggle-preview">${escS(doc.extractedText.slice(0, 800))}</div>`
            : ''}
        </div>`).join('')
    : '<div style="color:var(--text-dim);font-size:13px">No documents uploaded yet.</div>';

  return `
    <div class="doc-drop-zone" id="doc-drop-zone-${stock.id}" data-action="open-file-picker" data-id="${stock.id}">
      <div class="drop-icon">&#128196;</div>
      <p>Drop files here or click to upload</p>
      <p style="font-size:11px;color:var(--text-dim);margin-top:4px">PDF, TXT, DOCX, XLSX, images</p>
      <input type="file" id="doc-file-input-${stock.id}" style="display:none" multiple
             data-action="file-selected" data-id="${stock.id}" />
    </div>
    <div class="doc-list">${docCards}</div>`;
}

// ── Notes Tab ──

function _renderNotesTab(stock) {
  const links = stock.links || [];

  const linkChips = links.map(l => `
    <a class="research-link" href="${escS(l.url)}" target="_blank" rel="noopener">
      ${escS(l.label || l.url)}
      <button class="doc-card-del" style="margin-left:4px;color:inherit"
              data-action="delete-link" data-id="${stock.id}" data-url="${escS(l.url)}">✕</button>
    </a>`).join('');

  return `
    <textarea class="notes-area" id="notes-area-${stock.id}"
              placeholder="Write your investment thesis, key risks, catalysts…"
              data-stock="${stock.id}">${escS(stock.notes || '')}</textarea>
    <div class="notes-save-row">
      <button class="btn btn-primary" data-action="save-notes" data-id="${stock.id}">Save Notes</button>
      <span class="notes-saved-badge" id="notes-saved-${stock.id}">Saved</span>
    </div>

    <div class="research-links-title">Research Links</div>
    <div class="research-links" id="research-links-${stock.id}">${linkChips}</div>
    <div class="research-link-add">
      <input type="text" id="link-label-${stock.id}" placeholder="Label (optional)" style="max-width:180px" />
      <input type="url"  id="link-url-${stock.id}"   placeholder="https://…" />
      <button class="btn btn-primary" style="flex-shrink:0"
              data-action="add-link" data-id="${stock.id}">Add Link</button>
    </div>`;
}

// ── Event Delegation ──

function _bindStocksEvents(el) {
  // Click delegation
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'new-stock') {
      _showCreateModal(el);
      return;
    }

    if (action === 'select-stock') {
      _activeStockId  = btn.dataset.id;
      _activeStockTab = 'model';
      _reRenderAll(el);
      return;
    }

    if (action === 'switch-tab') {
      _activeStockTab = btn.dataset.tab;
      // toggle panels without full re-render
      el.querySelectorAll('.stock-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === _activeStockTab));
      el.querySelectorAll('.stock-tab-panel').forEach(p =>
        p.classList.toggle('active', p.dataset.panel === _activeStockTab));
      return;
    }

    if (action === 'set-scenario') {
      const stock = getStock(_activeStockId);
      if (!stock) return;
      stock.assumptions.scenario = btn.dataset.scenario;
      saveState();
      _reRenderDetail(el);
      return;
    }

    if (action === 'delete-stock') {
      if (!confirm('Delete this stock and all its data?')) return;
      deleteStock(id);
      _reRenderAll(el);
      return;
    }

    if (action === 'export-excel') {
      exportToExcel(id);
      return;
    }

    if (action === 'add-snapshot') {
      _addSnapshot(id, el);
      return;
    }

    if (action === 'delete-snapshot') {
      const stock = getStock(id);
      if (!stock) return;
      stock.history = (stock.history || []).filter(s => s.id !== btn.dataset.snapid);
      saveState();
      _reRenderDetail(el);
      return;
    }

    if (action === 'delete-doc') {
      const stock = getStock(id);
      if (!stock) return;
      stock.documents = (stock.documents || []).filter(d => d.id !== btn.dataset.docid);
      saveState();
      _reRenderDetail(el);
      return;
    }

    if (action === 'toggle-preview') {
      btn.classList.toggle('expanded');
      return;
    }

    if (action === 'open-file-picker') {
      const inp = document.getElementById(`doc-file-input-${id}`);
      if (inp) inp.click();
      return;
    }

    if (action === 'save-notes') {
      const area  = document.getElementById(`notes-area-${id}`);
      const stock = getStock(id);
      if (!stock || !area) return;
      stock.notes = area.value;
      saveState();
      const badge = document.getElementById(`notes-saved-${id}`);
      if (badge) {
        badge.classList.add('visible');
        setTimeout(() => badge.classList.remove('visible'), 2000);
      }
      return;
    }

    if (action === 'add-link') {
      _addLink(id, el);
      return;
    }

    if (action === 'delete-link') {
      const stock = getStock(id);
      if (!stock) return;
      const url = btn.dataset.url;
      stock.links = (stock.links || []).filter(l => l.url !== url);
      saveState();
      _reRenderDetail(el);
      return;
    }
  });

  // Input delegation — assumption/actual inputs with debounce
  el.addEventListener('input', e => {
    const inp = e.target.closest('.assumption-input, .dcf-input, .stock-actual');
    if (!inp) return;
    const stockId = inp.dataset.stock;
    const field   = inp.dataset.field;
    if (!stockId || !field) return;

    clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      _applyInputChange(stockId, field, inp.value, el);
    }, 200);
  });

  // File input change
  el.addEventListener('change', e => {
    const inp = e.target.closest('input[type="file"]');
    if (!inp) return;
    const id = inp.dataset.id;
    if (!id) return;
    _handleFileUpload(id, inp.files, el);
  });

  // Drag-and-drop on drop zones
  el.addEventListener('dragover', e => {
    const zone = e.target.closest('.doc-drop-zone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  el.addEventListener('dragleave', e => {
    const zone = e.target.closest('.doc-drop-zone');
    if (!zone) return;
    zone.classList.remove('drag-over');
  });
  el.addEventListener('drop', e => {
    const zone = e.target.closest('.doc-drop-zone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('drag-over');
    const id = zone.dataset.id;
    if (!id) return;
    _handleFileUpload(id, e.dataTransfer.files, el);
  });

  // Enter key on snapshot/link inputs
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'snap-notes' || e.target.id === 'snap-market') {
      const addBtn = el.querySelector('[data-action="add-snapshot"]');
      if (addBtn) addBtn.click();
    }
  });
}

function _applyInputChange(stockId, field, rawVal, el) {
  const stock = getStock(stockId);
  if (!stock) return;

  const parts = field.split('.');
  let obj     = stock;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] === undefined) return;
    obj = obj[parts[i]];
  }
  const lastKey = parts[parts.length - 1];

  let parsed = parseFloat(rawVal);
  if (isNaN(parsed)) return;

  // Convert percentages back to decimals for assumption fields
  const pctFields = ['revenueGrowth', 'ebitdaMargin', 'daPct', 'capexPct', 'nwcPct',
                     'wacc', 'taxRate', 'terminalGrowth'];
  const parentKey = parts.length >= 2 ? parts[parts.length - 2] : '';
  if (pctFields.includes(parentKey) || pctFields.includes(lastKey)) {
    parsed = parsed / 100;
  }

  if (Array.isArray(obj)) {
    obj[parseInt(lastKey, 10)] = parsed;
  } else {
    obj[lastKey] = parsed;
  }

  saveState();
  _reRenderDetail(el);
}

function _addSnapshot(stockId, el) {
  const stock     = getStock(stockId);
  if (!stock) return;
  const dateEl   = document.getElementById('snap-date');
  const targetEl = document.getElementById('snap-target');
  const marketEl = document.getElementById('snap-market');
  const notesEl  = document.getElementById('snap-notes');

  const tp = parseFloat(targetEl?.value);
  const mp = parseFloat(marketEl?.value);
  if (isNaN(tp)) { targetEl?.focus(); return; }

  if (!stock.history) stock.history = [];
  stock.history.push({
    id:          's_' + Date.now(),
    date:        dateEl?.value || today(),
    targetPrice: tp,
    marketPrice: isNaN(mp) ? 0 : mp,
    notes:       notesEl?.value.trim() || '',
  });
  saveState();
  _reRenderDetail(el);
}

function _addLink(stockId, el) {
  const stock    = getStock(stockId);
  if (!stock) return;
  const labelEl = document.getElementById(`link-label-${stockId}`);
  const urlEl   = document.getElementById(`link-url-${stockId}`);
  const url     = urlEl?.value.trim();
  if (!url) { urlEl?.focus(); return; }

  if (!stock.links) stock.links = [];
  stock.links.push({ url, label: labelEl?.value.trim() || url });
  saveState();
  _reRenderDetail(el);
}

function _handleFileUpload(stockId, files, el) {
  const stock = getStock(stockId);
  if (!stock || !files || !files.length) return;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    const isText = file.type.startsWith('text/') ||
                   /\.(txt|csv|md|json|xml|html|htm|js|ts|py|rb|java|c|cpp|h)$/i.test(file.name);

    reader.onload = evt => {
      let extracted = '';
      if (isText) {
        extracted = (evt.target.result || '').slice(0, 5000);
      } else {
        // Try to extract printable ASCII from binary
        const buf  = evt.target.result;
        const arr  = new Uint8Array(buf);
        let text   = '';
        for (let i = 0; i < Math.min(arr.length, 20000); i++) {
          const c = arr[i];
          if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13) {
            text += String.fromCharCode(c);
          }
        }
        // Filter to runs of printable text 4+ chars long
        const runs = text.match(/[ -~\t\r\n]{4,}/g) || [];
        extracted  = runs.join(' ').slice(0, 5000);
      }

      if (!stock.documents) stock.documents = [];
      stock.documents.push({
        id:            'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name:          file.name,
        size:          file.size,
        type:          file.type,
        extractedText: extracted,
        uploadedAt:    today(),
      });
      saveState();
      _reRenderDetail(el);
    };

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

// ── Re-render helpers ──

function _reRenderAll(el) {
  // Re-render sidebar + main
  const sidebarList = el.querySelector('#stocks-list');
  if (sidebarList) sidebarList.innerHTML = _renderSidebarList(window.state.stocks || []);

  const main = el.querySelector('#stocks-main');
  if (main) {
    main.innerHTML = _activeStockId
      ? _renderStockDetail(getStock(_activeStockId))
      : _renderEmptyState();
  }
}

function _reRenderDetail(el) {
  const main  = el.querySelector('#stocks-main');
  const stock = getStock(_activeStockId);
  if (!main || !stock) return;
  main.innerHTML = _renderStockDetail(stock);

  // Update sidebar item rating too
  const sidebarList = el.querySelector('#stocks-list');
  if (sidebarList) sidebarList.innerHTML = _renderSidebarList(window.state.stocks || []);
}

// ── Create Stock Modal ──

function _showCreateModal(el) {
  const overlay = document.createElement('div');
  overlay.className = 'stock-modal-overlay';
  overlay.innerHTML = `
    <div class="stock-modal">
      <h3>Add Stock</h3>
      <div class="form-group">
        <label>Ticker Symbol *</label>
        <input type="text" id="sm-ticker" placeholder="e.g. CBA" style="text-transform:uppercase" />
      </div>
      <div class="form-group">
        <label>Company Name *</label>
        <input type="text" id="sm-name" placeholder="e.g. Commonwealth Bank" />
      </div>
      <div class="form-group">
        <label>Sector</label>
        <input type="text" id="sm-sector" placeholder="e.g. Financials" />
      </div>
      <div class="stock-modal-row">
        <div class="form-group">
          <label>Exchange</label>
          <input type="text" id="sm-exchange" placeholder="ASX" value="ASX" />
        </div>
        <div class="form-group">
          <label>Currency</label>
          <input type="text" id="sm-currency" placeholder="AUD" value="AUD" />
        </div>
      </div>
      <div class="stock-modal-actions">
        <button class="btn btn-ghost" id="sm-cancel">Cancel</button>
        <button class="btn btn-primary" id="sm-submit">Add Stock</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const tickerInp = overlay.querySelector('#sm-ticker');
  if (tickerInp) tickerInp.focus();

  overlay.querySelector('#sm-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#sm-submit').addEventListener('click', () => {
    const ticker   = overlay.querySelector('#sm-ticker')?.value.trim();
    const name     = overlay.querySelector('#sm-name')?.value.trim();
    const sector   = overlay.querySelector('#sm-sector')?.value.trim() || 'Unknown';
    const exchange = overlay.querySelector('#sm-exchange')?.value.trim() || 'ASX';
    const currency = overlay.querySelector('#sm-currency')?.value.trim() || 'AUD';

    if (!ticker) { overlay.querySelector('#sm-ticker').focus(); return; }
    if (!name)   { overlay.querySelector('#sm-name').focus();   return; }

    const stock      = createStock(ticker, name, sector, exchange, currency);
    _activeStockId   = stock.id;
    _activeStockTab  = 'model';
    overlay.remove();
    _reRenderAll(el);
  });

  // Allow Enter to submit
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('#sm-submit').click();
    if (e.key === 'Escape') overlay.remove();
  });
}

// ── Excel Export ──

function exportToExcel(stockId) {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS (XLSX) library not loaded. Please check your internet connection.');
    return;
  }

  const stock = getStock(stockId);
  if (!stock) return;

  const res = calcDCF(stock, stock.assumptions.scenario);
  const a   = stock.actuals;
  const b   = stock.assumptions;
  const sc  = res.scenario;

  const wb = XLSX.utils.book_new();

  // Build AOA (array of arrays) for static layout
  // Row indices are 0-based here, but Excel rows are 1-based in comments
  const aoa = [];

  // Row 0 (Excel row 1): Title
  aoa.push([`${stock.ticker} — ${stock.name} — DCF Model (${sc.toUpperCase()} scenario)`]);
  // Row 1 (Excel row 2): Note
  aoa.push(['NOTE: Edit the yellow assumption cells (rows 6-16). The model below recalculates automatically.']);
  // Row 2 (Excel row 3): blank
  aoa.push([]);
  // Row 3 (Excel row 4): section header
  aoa.push(['── ASSUMPTIONS (EDIT THESE) ──']);
  // Row 4 (Excel row 5): column headers
  aoa.push(['Metric', 'LTM', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']);
  // Row 5 (Excel row 6): Revenue Growth
  aoa.push(['Revenue Growth %', '—',
    b.revenueGrowth[0] * 100, b.revenueGrowth[1] * 100,
    b.revenueGrowth[2] * 100, b.revenueGrowth[3] * 100, b.revenueGrowth[4] * 100]);
  // Row 6 (Excel row 7): EBITDA Margin
  aoa.push(['EBITDA Margin %', '—',
    b.ebitdaMargin[0] * 100, b.ebitdaMargin[1] * 100,
    b.ebitdaMargin[2] * 100, b.ebitdaMargin[3] * 100, b.ebitdaMargin[4] * 100]);
  // Row 7 (Excel row 8): D&A %
  aoa.push(['D&A % Revenue', '—',
    b.daPct[0] * 100, b.daPct[1] * 100,
    b.daPct[2] * 100, b.daPct[3] * 100, b.daPct[4] * 100]);
  // Row 8 (Excel row 9): CapEx %
  aoa.push(['CapEx % Revenue', '—',
    b.capexPct[0] * 100, b.capexPct[1] * 100,
    b.capexPct[2] * 100, b.capexPct[3] * 100, b.capexPct[4] * 100]);
  // Row 9 (Excel row 10): NWC %
  aoa.push(['NWC Delta % Revenue', '—',
    b.nwcPct[0] * 100, b.nwcPct[1] * 100,
    b.nwcPct[2] * 100, b.nwcPct[3] * 100, b.nwcPct[4] * 100]);
  // Row 10 (Excel row 11): blank
  aoa.push([]);
  // Row 11 (Excel row 12): scalar assumptions
  aoa.push(['WACC (%)', b.wacc * 100, 'Terminal Growth (%)', b.terminalGrowth * 100,
            'Exit Multiple (x)', b.exitMultiple, 'Tax Rate (%)', b.taxRate * 100]);
  // Row 12 (Excel row 13): blank
  aoa.push([]);
  // Row 13 (Excel row 14): actuals header
  aoa.push(['── BASE YEAR ACTUALS (EDIT THESE) ──']);
  // Row 14 (Excel row 15): actuals col headers
  aoa.push(['Revenue ($M)', 'EBITDA ($M)', 'D&A ($M)', 'CapEx ($M)',
            'Net Debt ($M)', 'Shares Out (M)', 'Current Price']);
  // Row 15 (Excel row 16): actuals values
  aoa.push([a.revenue, a.ebitda, a.da, a.capex, a.netDebt, a.sharesOut, a.currentPrice]);
  // Row 16 (Excel row 17): blank
  aoa.push([]);
  // Row 17 (Excel row 18): model section header
  aoa.push(['── DCF MODEL (CALCULATED — DO NOT EDIT) ──']);
  // Row 18 (Excel row 19): model col headers
  aoa.push(['Metric', 'LTM', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']);

  // Rows 19-31 (Excel rows 20-32): model output — we add placeholders and patch formulas
  // Row 19 (Excel 20): Revenue
  aoa.push(['Revenue ($M)', a.revenue,
    res.revenues[0], res.revenues[1], res.revenues[2], res.revenues[3], res.revenues[4]]);
  // Row 20 (Excel 21): Growth %
  aoa.push(['Growth %', '—',
    fmtPct(res.rg[0], 1), fmtPct(res.rg[1], 1), fmtPct(res.rg[2], 1),
    fmtPct(res.rg[3], 1), fmtPct(res.rg[4], 1)]);
  // Row 21 (Excel 22): EBITDA
  aoa.push(['EBITDA ($M)', a.ebitda,
    res.ebitdas[0], res.ebitdas[1], res.ebitdas[2], res.ebitdas[3], res.ebitdas[4]]);
  // Row 22 (Excel 23): EBITDA Margin %
  aoa.push(['EBITDA Margin %',
    a.revenue > 0 ? parseFloat((a.ebitda / a.revenue * 100).toFixed(2)) : 0,
    b.ebitdaMargin[0] * 100, b.ebitdaMargin[1] * 100,
    b.ebitdaMargin[2] * 100, b.ebitdaMargin[3] * 100, b.ebitdaMargin[4] * 100]);
  // Row 23 (Excel 24): D&A
  aoa.push(['D&A ($M)', a.da,
    res.das[0], res.das[1], res.das[2], res.das[3], res.das[4]]);
  // Row 24 (Excel 25): EBIT
  aoa.push(['EBIT ($M)', '—',
    res.ebits[0], res.ebits[1], res.ebits[2], res.ebits[3], res.ebits[4]]);
  // Row 25 (Excel 26): Tax
  aoa.push(['Tax ($M)', '—',
    res.taxes[0], res.taxes[1], res.taxes[2], res.taxes[3], res.taxes[4]]);
  // Row 26 (Excel 27): NOPAT
  aoa.push(['NOPAT ($M)', '—',
    res.nopats[0], res.nopats[1], res.nopats[2], res.nopats[3], res.nopats[4]]);
  // Row 27 (Excel 28): CapEx
  aoa.push(['CapEx ($M)', a.capex,
    res.capexs[0], res.capexs[1], res.capexs[2], res.capexs[3], res.capexs[4]]);
  // Row 28 (Excel 29): Delta NWC
  aoa.push(['Delta NWC ($M)', '—',
    res.dnwcs[0], res.dnwcs[1], res.dnwcs[2], res.dnwcs[3], res.dnwcs[4]]);
  // Row 29 (Excel 30): FCF
  aoa.push(['Free Cash Flow ($M)', '—',
    res.fcfs[0], res.fcfs[1], res.fcfs[2], res.fcfs[3], res.fcfs[4]]);
  // Row 30 (Excel 31): Discount Factor
  aoa.push(['Discount Factor', '—',
    res.dfs[0], res.dfs[1], res.dfs[2], res.dfs[3], res.dfs[4]]);
  // Row 31 (Excel 32): PV of FCF
  aoa.push(['PV of FCF ($M)', '—',
    res.pvFcfs[0], res.pvFcfs[1], res.pvFcfs[2], res.pvFcfs[3], res.pvFcfs[4]]);
  // Row 32 (Excel 33): blank
  aoa.push([]);
  // Row 33 (Excel 34): valuation header
  aoa.push(['── VALUATION SUMMARY ──']);
  // Row 34 (Excel 35): valuation labels
  aoa.push(['Sum PV FCFs ($M)', 'Terminal Value GGM ($M)', 'Terminal Value Exit Mult ($M)',
            'Avg Terminal Value ($M)', 'PV Terminal Value ($M)', 'Enterprise Value ($M)',
            'Net Debt ($M)', 'Equity Value ($M)', 'Shares Out (M)', 'Intrinsic Value / Share',
            'Current Price', 'Upside %', 'Rating']);
  // Row 35 (Excel 36): valuation values
  aoa.push([
    res.sumPvFcf,
    res.tvGGM,
    res.tvMult,
    res.tv,
    res.pvTV,
    res.ev,
    a.netDebt,
    res.equityVal,
    a.sharesOut,
    res.intrinsic,
    a.currentPrice,
    res.upside !== null ? res.upside * 100 : null,
    res.rating,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Patch formula cells ──
  // Convention: cols A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7
  // Excel row mapping (1-indexed): aoa row 0 = Excel row 1
  // Assumption rows: aoa rows 5-9 = Excel rows 6-10 (cols C-G = Excel C-G, 0-indexed 2-6)
  // Scalar row: aoa row 11 = Excel row 12
  //   B12=WACC%, D12=TGR%, F12=exitMult, H12=taxRate%
  // Actuals row: aoa row 15 = Excel row 16 (cols A-G = B-H 0-indexed 0-6)
  // Model revenue row: aoa row 19 = Excel row 20
  //   B20=actuals revenue (=B16), C20=B20*(1+C6/100), etc.

  const enc = XLSX.utils.encode_cell;

  // Revenue growth assumption cols C-G, Excel row 6 (aoa row 5)
  // Already set as values but patch as formula-value cells
  const rgRow = 5; // aoa index
  [2, 3, 4, 5, 6].forEach((col, yi) => {
    const ref = enc({ r: rgRow, c: col });
    ws[ref] = { t: 'n', v: b.revenueGrowth[yi] * 100, f: `${b.revenueGrowth[yi] * 100}` };
  });

  // Scalar assumptions — B12, D12, F12, H12 (aoa row 11)
  const scRow = 11;
  ws[enc({ r: scRow, c: 1 })] = { t: 'n', v: b.wacc * 100,           f: `${b.wacc * 100}` };
  ws[enc({ r: scRow, c: 3 })] = { t: 'n', v: b.terminalGrowth * 100, f: `${b.terminalGrowth * 100}` };
  ws[enc({ r: scRow, c: 5 })] = { t: 'n', v: b.exitMultiple,         f: `${b.exitMultiple}` };
  ws[enc({ r: scRow, c: 7 })] = { t: 'n', v: b.taxRate * 100,        f: `${b.taxRate * 100}` };

  // Actuals row — aoa row 15 = Excel row 16
  const actRow = 15;
  ['revenue','ebitda','da','capex','netDebt','sharesOut','currentPrice'].forEach((k, ci) => {
    ws[enc({ r: actRow, c: ci })] = { t: 'n', v: a[k] || 0, f: `${a[k] || 0}` };
  });

  // Model Revenue row — aoa row 19 = Excel row 20
  // B20=LTM revenue = B16 (actuals row A col 0 = Excel col B? No — actuals aoa row 15, col 0 = Excel A16)
  // Actuals: aoa[15][0]=revenue => Excel A16
  // Let's use absolute refs. Excel col letters: A=0,B=1,C=2 ...
  // aoa[15][0] => XLSX encode_cell(r=15,c=0) = A16
  const modelRevRow = 19; // aoa index, Excel row 20
  ws[enc({ r: modelRevRow, c: 1 })] = { t: 'n', v: a.revenue || 0, f: 'A16' };
  // Y1 = B20*(1+C6/100) — B20=col1, C6=enc(r=5,c=2)
  ws[enc({ r: modelRevRow, c: 2 })] = { t: 'n', v: res.revenues[0], f: 'B20*(1+C6/100)' };
  ws[enc({ r: modelRevRow, c: 3 })] = { t: 'n', v: res.revenues[1], f: 'C20*(1+D6/100)' };
  ws[enc({ r: modelRevRow, c: 4 })] = { t: 'n', v: res.revenues[2], f: 'D20*(1+E6/100)' };
  ws[enc({ r: modelRevRow, c: 5 })] = { t: 'n', v: res.revenues[3], f: 'E20*(1+F6/100)' };
  ws[enc({ r: modelRevRow, c: 6 })] = { t: 'n', v: res.revenues[4], f: 'F20*(1+G6/100)' };

  // EBITDA row — aoa row 21 = Excel row 22
  const ebitdaRow = 21;
  ws[enc({ r: ebitdaRow, c: 1 })] = { t: 'n', v: a.ebitda || 0, f: 'B16' };
  ws[enc({ r: ebitdaRow, c: 2 })] = { t: 'n', v: res.ebitdas[0], f: 'C20*C7/100' };
  ws[enc({ r: ebitdaRow, c: 3 })] = { t: 'n', v: res.ebitdas[1], f: 'D20*D7/100' };
  ws[enc({ r: ebitdaRow, c: 4 })] = { t: 'n', v: res.ebitdas[2], f: 'E20*E7/100' };
  ws[enc({ r: ebitdaRow, c: 5 })] = { t: 'n', v: res.ebitdas[3], f: 'F20*F7/100' };
  ws[enc({ r: ebitdaRow, c: 6 })] = { t: 'n', v: res.ebitdas[4], f: 'G20*G7/100' };

  // EBITDA Margin % — aoa row 22 = Excel row 23
  const emRow = 22;
  ws[enc({ r: emRow, c: 1 })] = { t: 'n', v: a.revenue > 0 ? a.ebitda / a.revenue * 100 : 0, f: 'IF(A16>0,B16/A16*100,0)' };
  ws[enc({ r: emRow, c: 2 })] = { t: 'n', v: b.ebitdaMargin[0] * 100, f: 'C7' };
  ws[enc({ r: emRow, c: 3 })] = { t: 'n', v: b.ebitdaMargin[1] * 100, f: 'D7' };
  ws[enc({ r: emRow, c: 4 })] = { t: 'n', v: b.ebitdaMargin[2] * 100, f: 'E7' };
  ws[enc({ r: emRow, c: 5 })] = { t: 'n', v: b.ebitdaMargin[3] * 100, f: 'F7' };
  ws[enc({ r: emRow, c: 6 })] = { t: 'n', v: b.ebitdaMargin[4] * 100, f: 'G7' };

  // D&A row — aoa row 23 = Excel row 24
  const daRow = 23;
  ws[enc({ r: daRow, c: 1 })] = { t: 'n', v: a.da || 0, f: 'C16' };
  ws[enc({ r: daRow, c: 2 })] = { t: 'n', v: res.das[0], f: 'C20*C8/100' };
  ws[enc({ r: daRow, c: 3 })] = { t: 'n', v: res.das[1], f: 'D20*D8/100' };
  ws[enc({ r: daRow, c: 4 })] = { t: 'n', v: res.das[2], f: 'E20*E8/100' };
  ws[enc({ r: daRow, c: 5 })] = { t: 'n', v: res.das[3], f: 'F20*F8/100' };
  ws[enc({ r: daRow, c: 6 })] = { t: 'n', v: res.das[4], f: 'G20*G8/100' };

  // EBIT row — aoa row 24 = Excel row 25
  const ebitRow = 24;
  ws[enc({ r: ebitRow, c: 2 })] = { t: 'n', v: res.ebits[0], f: 'C22-C24' };
  ws[enc({ r: ebitRow, c: 3 })] = { t: 'n', v: res.ebits[1], f: 'D22-D24' };
  ws[enc({ r: ebitRow, c: 4 })] = { t: 'n', v: res.ebits[2], f: 'E22-E24' };
  ws[enc({ r: ebitRow, c: 5 })] = { t: 'n', v: res.ebits[3], f: 'F22-F24' };
  ws[enc({ r: ebitRow, c: 6 })] = { t: 'n', v: res.ebits[4], f: 'G22-G24' };

  // Tax row — aoa row 25 = Excel row 26; tax rate = $H$12
  const taxRow = 25;
  ws[enc({ r: taxRow, c: 2 })] = { t: 'n', v: res.taxes[0], f: 'MAX(0,C25)*$H$12/100' };
  ws[enc({ r: taxRow, c: 3 })] = { t: 'n', v: res.taxes[1], f: 'MAX(0,D25)*$H$12/100' };
  ws[enc({ r: taxRow, c: 4 })] = { t: 'n', v: res.taxes[2], f: 'MAX(0,E25)*$H$12/100' };
  ws[enc({ r: taxRow, c: 5 })] = { t: 'n', v: res.taxes[3], f: 'MAX(0,F25)*$H$12/100' };
  ws[enc({ r: taxRow, c: 6 })] = { t: 'n', v: res.taxes[4], f: 'MAX(0,G25)*$H$12/100' };

  // NOPAT row — aoa row 26 = Excel row 27
  const nopatRow = 26;
  ws[enc({ r: nopatRow, c: 2 })] = { t: 'n', v: res.nopats[0], f: 'C25-C26' };
  ws[enc({ r: nopatRow, c: 3 })] = { t: 'n', v: res.nopats[1], f: 'D25-D26' };
  ws[enc({ r: nopatRow, c: 4 })] = { t: 'n', v: res.nopats[2], f: 'E25-E26' };
  ws[enc({ r: nopatRow, c: 5 })] = { t: 'n', v: res.nopats[3], f: 'F25-F26' };
  ws[enc({ r: nopatRow, c: 6 })] = { t: 'n', v: res.nopats[4], f: 'G25-G26' };

  // CapEx row — aoa row 27 = Excel row 28
  const capexRow = 27;
  ws[enc({ r: capexRow, c: 1 })] = { t: 'n', v: a.capex || 0, f: 'D16' };
  ws[enc({ r: capexRow, c: 2 })] = { t: 'n', v: res.capexs[0], f: 'C20*C9/100' };
  ws[enc({ r: capexRow, c: 3 })] = { t: 'n', v: res.capexs[1], f: 'D20*D9/100' };
  ws[enc({ r: capexRow, c: 4 })] = { t: 'n', v: res.capexs[2], f: 'E20*E9/100' };
  ws[enc({ r: capexRow, c: 5 })] = { t: 'n', v: res.capexs[3], f: 'F20*F9/100' };
  ws[enc({ r: capexRow, c: 6 })] = { t: 'n', v: res.capexs[4], f: 'G20*G9/100' };

  // Delta NWC row — aoa row 28 = Excel row 29
  // DNWC_n = (Rev_n - Rev_(n-1)) * nwcPct_n (nwcPct in C10:G10)
  const nwcRow = 28;
  ws[enc({ r: nwcRow, c: 2 })] = { t: 'n', v: res.dnwcs[0], f: '(C20-B20)*C10/100' };
  ws[enc({ r: nwcRow, c: 3 })] = { t: 'n', v: res.dnwcs[1], f: '(D20-C20)*D10/100' };
  ws[enc({ r: nwcRow, c: 4 })] = { t: 'n', v: res.dnwcs[2], f: '(E20-D20)*E10/100' };
  ws[enc({ r: nwcRow, c: 5 })] = { t: 'n', v: res.dnwcs[3], f: '(F20-E20)*F10/100' };
  ws[enc({ r: nwcRow, c: 6 })] = { t: 'n', v: res.dnwcs[4], f: '(G20-F20)*G10/100' };

  // FCF row — aoa row 29 = Excel row 30
  // FCF = NOPAT + DA - CapEx - DNWC
  const fcfRow = 29;
  ws[enc({ r: fcfRow, c: 2 })] = { t: 'n', v: res.fcfs[0], f: 'C27+C24-C28-C29' };
  ws[enc({ r: fcfRow, c: 3 })] = { t: 'n', v: res.fcfs[1], f: 'D27+D24-D28-D29' };
  ws[enc({ r: fcfRow, c: 4 })] = { t: 'n', v: res.fcfs[2], f: 'E27+E24-E28-E29' };
  ws[enc({ r: fcfRow, c: 5 })] = { t: 'n', v: res.fcfs[3], f: 'F27+F24-F28-F29' };
  ws[enc({ r: fcfRow, c: 6 })] = { t: 'n', v: res.fcfs[4], f: 'G27+G24-G28-G29' };

  // Discount Factor row — aoa row 30 = Excel row 31; WACC in B12
  const dfRow = 30;
  ws[enc({ r: dfRow, c: 2 })] = { t: 'n', v: res.dfs[0], f: '1/(1+$B$12/100)^1' };
  ws[enc({ r: dfRow, c: 3 })] = { t: 'n', v: res.dfs[1], f: '1/(1+$B$12/100)^2' };
  ws[enc({ r: dfRow, c: 4 })] = { t: 'n', v: res.dfs[2], f: '1/(1+$B$12/100)^3' };
  ws[enc({ r: dfRow, c: 5 })] = { t: 'n', v: res.dfs[3], f: '1/(1+$B$12/100)^4' };
  ws[enc({ r: dfRow, c: 6 })] = { t: 'n', v: res.dfs[4], f: '1/(1+$B$12/100)^5' };

  // PV FCF row — aoa row 31 = Excel row 32
  const pvFcfRow = 31;
  ws[enc({ r: pvFcfRow, c: 2 })] = { t: 'n', v: res.pvFcfs[0], f: 'C30*C31' };
  ws[enc({ r: pvFcfRow, c: 3 })] = { t: 'n', v: res.pvFcfs[1], f: 'D30*D31' };
  ws[enc({ r: pvFcfRow, c: 4 })] = { t: 'n', v: res.pvFcfs[2], f: 'E30*E31' };
  ws[enc({ r: pvFcfRow, c: 5 })] = { t: 'n', v: res.pvFcfs[3], f: 'F30*F31' };
  ws[enc({ r: pvFcfRow, c: 6 })] = { t: 'n', v: res.pvFcfs[4], f: 'G30*G31' };

  // Valuation row — aoa row 35 = Excel row 36
  // Col A = Sum PV FCFs = SUM(C32:G32)
  const valRow = 35;
  ws[enc({ r: valRow, c: 0  })] = { t: 'n', v: res.sumPvFcf,     f: 'SUM(C32:G32)' };
  ws[enc({ r: valRow, c: 1  })] = { t: 'n', v: res.tvGGM,        f: `G30*(1+$D$12/100)/($B$12/100-$D$12/100)` };
  ws[enc({ r: valRow, c: 2  })] = { t: 'n', v: res.tvMult,       f: `G22*$F$12` };
  ws[enc({ r: valRow, c: 3  })] = { t: 'n', v: res.tv,           f: '(B36+C36)/2' };
  ws[enc({ r: valRow, c: 4  })] = { t: 'n', v: res.pvTV,         f: 'D36/(1+$B$12/100)^5' };
  ws[enc({ r: valRow, c: 5  })] = { t: 'n', v: res.ev,           f: 'A36+E36' };
  ws[enc({ r: valRow, c: 6  })] = { t: 'n', v: a.netDebt || 0,   f: `${a.netDebt || 0}` };
  ws[enc({ r: valRow, c: 7  })] = { t: 'n', v: res.equityVal,    f: 'F36-G36' };
  ws[enc({ r: valRow, c: 8  })] = { t: 'n', v: a.sharesOut || 0, f: `${a.sharesOut || 0}` };
  ws[enc({ r: valRow, c: 9  })] = { t: 'n', v: res.intrinsic,    f: 'IF(I36>0,H36/I36,0)' };
  ws[enc({ r: valRow, c: 10 })] = { t: 'n', v: a.currentPrice || 0, f: `${a.currentPrice || 0}` };
  ws[enc({ r: valRow, c: 11 })] = {
    t: 'n',
    v: res.upside !== null ? res.upside * 100 : 0,
    f: 'IF(K36>0,(J36-K36)/K36*100,0)',
  };
  ws[enc({ r: valRow, c: 12 })] = {
    t: 's',
    v: res.rating,
    f: 'IF(L36>15,"BUY",IF(L36<-5,"SELL","HOLD"))',
  };

  // Set column widths
  ws['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'DCF Model');

  const fileName = `${stock.ticker}_DCF_${sc}_${today()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
