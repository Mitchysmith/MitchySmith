// ── Finance – Savings Goal Tracker ──

const STAMP_DUTY = {
  NSW: { thresholds:[0,16000,35000,91000,160000,1100000,3000000], rates:[0.0125,0.015,0.0175,0.035,0.045,0.055,0.07] },
  VIC: { thresholds:[0,25000,130000,960000,2000000], rates:[0.014,0.024,0.06,0.055,0.065] },
  QLD: { thresholds:[0,5000,75000,540000,1000000], rates:[0,0.015,0.035,0.0425,0.0575] },
  WA:  { thresholds:[0,120000,150000,360000,725000], rates:[0.019,0.0285,0.03,0.0425,0.0515] },
  SA:  { thresholds:[0,12000,30000,50000,100000,200000,250000,300000,500000], rates:[0.01,0.02,0.03,0.035,0.04,0.045,0.05,0.055,0.057] },
  ACT: { thresholds:[0,200000,300000,500000,750000,1000000,1455000], rates:[0.002,0.0392,0.0414,0.0559,0.0596,0.0638,0.0694] },
  TAS: { thresholds:[0,3000,25000,75000,200000,375000,725000], rates:[0.01875,0.02,0.025,0.03,0.035,0.04,0.045] },
  NT:  { thresholds:[0,525000,3000000], rates:[0.0549,0.059,0.0645] },
};

const CELEBRATE_MSGS = [
  { title: '🎉 Absolutely smashed it!', msg: 'You saved more than planned this month. That\'s the compounding magic starting to work. Keep this up and you\'ll hit your goal ahead of schedule.' },
  { title: '🚀 Legend behaviour!', msg: 'You\'re ahead of target — your future self is doing a happy dance right now. One month like this brings the finish line noticeably closer.' },
  { title: '💪 Killing it!', msg: 'More saved than expected. Every extra dollar is working for you. This is exactly how goals get smashed early.' },
];

const SHAME_MSGS = [
  { title: '😬 Oof. That\'s a bit rough.', msg: 'You came in under target this month. No judgement — but maybe check what slipped. One quiet month is fine; a pattern is not.' },
  { title: '🫠 Your savings goal is not impressed.', msg: 'Less than planned went in this month. The goal hasn\'t changed — just the timeline has stretched. Time to tighten up next month.' },
  { title: '😅 Well… at least you tracked it.', msg: 'Under target this month. Awareness is step one. Step two is doing better next month. You\'ve got this — just requires a bit more discipline.' },
];

function calcStampDuty(price, state) {
  const sd = STAMP_DUTY[state];
  if (!sd) return 0;
  let duty = 0;
  for (let i = sd.thresholds.length - 1; i >= 0; i--) {
    if (price > sd.thresholds[i]) {
      duty = (price - sd.thresholds[i]) * sd.rates[i];
      for (let j = i - 1; j >= 0; j--) {
        duty += (sd.thresholds[j+1] - sd.thresholds[j]) * sd.rates[j];
      }
      break;
    }
  }
  return Math.round(duty);
}

function calcRepayment(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
}

function renderFinance() {
  const el = document.getElementById('section-finance');
  if (!window.state.finance)       window.state.finance = {};
  if (!window.state.plan2027)      window.state.plan2027 = {};
  const f = window.state.finance;
  const p = window.state.plan2027;

  el.innerHTML = `
    <div class="page-header">
      <h1>Finance</h1>
      <p>Your savings goal, progress, and property planning in one place.</p>
    </div>

    <div class="finance-tabs">
      <div class="fin-tab active" data-fin="savings">Savings Goal</div>
      <div class="fin-tab" data-fin="setup">Setup</div>
      <div class="fin-tab" data-fin="plan2027">🏡 2027 Plan</div>
      <div class="fin-tab" data-fin="property">Property Calc</div>
    </div>

    <!-- Savings Goal panel -->
    <div class="fin-panel active" id="fin-savings"></div>

    <!-- Setup panel -->
    <div class="fin-panel" id="fin-setup">
      <div class="card">
        <div class="section-title">Your Numbers</div>
        <div class="form-row">
          <div class="form-group"><label>Goal Name</label><input type="text" id="f-goalname" placeholder="e.g. House Deposit" value="${f.goalName||''}" /></div>
          <div class="form-group"><label>Savings Target ($)</label><input type="number" id="f-target" placeholder="100000" value="${f.target||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Monthly Take-Home Income ($)</label><input type="number" id="f-income" value="${f.income||''}" /></div>
          <div class="form-group"><label>Monthly Outgoings ($)</label><input type="number" id="f-expenses" value="${f.expenses||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Current Savings ($)</label><input type="number" id="f-savings" value="${f.savings||0}" /></div>
          <div class="form-group"><label>Current Investments ($)</label><input type="number" id="f-investments" placeholder="e.g. shares, ETFs, super" value="${f.investments||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Expected Annual Return on Investments (%)</label>
            <input type="number" id="f-roi" step="0.1" min="0" max="50" placeholder="5.5" value="${f.roiRate ?? 5.5}" />
          </div>
        </div>
        <div class="fin-roi-note" id="roi-note">
          &#128200; At <strong>${f.roiRate ?? 5.5}% per year</strong>, your $${(f.investments||0).toLocaleString()} in investments adds <strong>$${Math.round(((f.investments||0) * (f.roiRate ?? 5.5) / 100) / 12).toLocaleString()}/month</strong> towards your goal.
        </div>
        <button class="btn btn-primary" id="save-setup-btn">Save & Update Goal</button>
      </div>
    </div>

    <!-- Property panel -->
    <div class="fin-panel" id="fin-property">
      <div class="card">
        <div class="section-title">Property Calculator</div>
        <div class="form-row">
          <div class="form-group"><label>Purchase Price ($)</label><input type="number" id="prop-price" placeholder="750000" /></div>
          <div class="form-group"><label>Deposit (%)</label><input type="number" id="prop-deposit" value="20" /></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label>Interest Rate (%)</label><input type="number" id="prop-rate" value="6.2" step="0.1" /></div>
          <div class="form-group"><label>Loan Term (yrs)</label><input type="number" id="prop-term" value="30" /></div>
          <div class="form-group"><label>State</label>
            <select id="prop-state">${Object.keys(STAMP_DUTY).map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Rental Income / mo ($)</label><input type="number" id="prop-rent" value="0" /></div>
          <div class="form-group"><label>Gross Annual Income ($)</label><input type="number" id="prop-annual-income" placeholder="For serviceability" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Other Loan Repayments / mo ($)</label><input type="number" id="prop-other-loans" value="0" /></div>
        </div>
        <button class="btn btn-primary" id="calc-prop-btn">Calculate</button>
        <div id="prop-result"></div>
      </div>
    </div>

    <!-- 2027 Property Plan panel -->
    <div class="fin-panel" id="fin-plan2027">${build2027PanelHTML(p)}</div>
  `;

  bindFinanceEvents();
  renderSavingsGoal();
}

function bindFinanceEvents() {
  document.querySelectorAll('.fin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('fin-' + tab.dataset.fin).classList.add('active');
    });
  });

  document.getElementById('save-setup-btn').addEventListener('click', saveSetup);
  document.getElementById('calc-prop-btn').addEventListener('click', calcProperty);
  document.getElementById('save-plan2027-btn')?.addEventListener('click', savePlan2027);
}

function saveSetup() {
  const f = window.state.finance;
  f.goalName    = document.getElementById('f-goalname').value.trim() || 'My Savings Goal';
  f.target      = +document.getElementById('f-target').value      || 0;
  f.income      = +document.getElementById('f-income').value      || 0;
  f.expenses    = +document.getElementById('f-expenses').value    || 0;
  f.savings     = +document.getElementById('f-savings').value     || 0;
  f.investments = +document.getElementById('f-investments').value || 0;
  f.roiRate     = +document.getElementById('f-roi').value ?? 5.5;
  saveState();

  const btn = document.getElementById('save-setup-btn');
  btn.textContent = 'Saved ✓'; btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = 'Save & Update Goal'; btn.style.background = ''; }, 2000);

  renderSavingsGoal();
}

function renderSavingsGoal() {
  const el = document.getElementById('fin-savings');
  if (!el) return;
  const f = window.state.finance;

  const target      = f.target      || 0;
  const current     = f.savings     || 0;
  const investments = f.investments || 0;
  const income      = f.income      || 0;
  const expenses    = f.expenses    || 0;
  const surplus     = Math.max(0, income - expenses);
  const name        = f.goalName    || 'My Savings Goal';
  const remaining   = Math.max(0, target - current);
  const pct         = target ? Math.min(100, Math.round(current / target * 100)) : 0;

  // Variable ROI rate (default 5.5%) spread across 12 months
  const ROI_RATE            = (f.roiRate ?? 5.5) / 100;
  const monthlyInvestReturn = Math.round((investments * ROI_RATE) / 12);
  const totalMonthly        = surplus + monthlyInvestReturn;
  const monthsLeft          = totalMonthly > 0 ? Math.ceil(remaining / totalMonthly) : null;

  // If not set up yet
  if (!target) {
    el.innerHTML = `
      <div class="no-goal-state">
        <div class="big-emoji">🎯</div>
        <h3>Set your savings goal</h3>
        <p>Head to the <strong>Setup</strong> tab and enter your income, outgoings, and target amount — then come back here to track your progress.</p>
        <button class="btn btn-primary" id="goto-setup-btn">Set Up My Goal</button>
      </div>`;
    document.getElementById('goto-setup-btn').addEventListener('click', () => {
      document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-fin="setup"]').classList.add('active');
      document.getElementById('fin-setup').classList.add('active');
    });
    return;
  }

  const timeStr = monthsLeft
    ? monthsLeft <= 1 ? '< 1 month away 🔥'
      : monthsLeft < 12 ? `${monthsLeft} months away`
      : `${(monthsLeft / 12).toFixed(1)} years away`
    : 'Set your surplus to see';

  // Milestones
  const milestones = [
    { pct: 25, emoji: '🌱', label: 'First step' },
    { pct: 50, emoji: '⚡', label: 'Halfway!'  },
    { pct: 75, emoji: '🔥', label: 'So close'  },
    { pct: 100, emoji: '🏆', label: 'Done!'    },
  ];

  const milestonesHtml = milestones.map(m => `
    <div class="milestone ${pct >= m.pct ? 'reached' : ''}">
      <span class="milestone-emoji">${m.emoji}</span>
      <div class="milestone-pct">${m.pct}%</div>
      <div class="milestone-lbl">${m.label}</div>
    </div>`).join('');

  const history = f.history || [];
  const historyHtml = history.length
    ? history.slice().reverse().map(h => {
        const diff   = h.saved - h.expected;
        const cls    = diff > 0 ? 'above' : diff < 0 ? 'below' : 'exact';
        const prefix = diff > 0 ? '+' : '';
        return `
          <div class="history-item ${cls}">
            <div>
              <div style="font-weight:500">${h.note || h.month}</div>
              <div class="history-meta">${h.month} · Expected $${h.expected.toLocaleString()}</div>
            </div>
            <div>
              <div class="history-amount ${cls}">$${h.saved.toLocaleString()}</div>
              <div class="history-meta" style="text-align:right">${prefix}$${Math.abs(diff).toLocaleString()} vs plan</div>
            </div>
          </div>`;
      }).join('')
    : `<p class="text-muted text-sm">No updates yet — log your first month below.</p>`;

  el.innerHTML = `
    <!-- Hero progress card -->
    <div class="goal-hero">
      <div class="goal-hero-top">
        <div>
          <div class="goal-hero-name">${name}</div>
          <div class="goal-hero-target">Target: $${target.toLocaleString()}</div>
        </div>
        <div class="goal-hero-pct">${pct}%</div>
      </div>
      <div class="goal-big-bar">
        <div class="goal-big-fill" id="goal-fill" style="width:0%"></div>
      </div>
      <div class="goal-hero-stats">
        <div class="gh-stat">
          <div class="gh-stat-val" style="color:var(--green)">$${current.toLocaleString()}</div>
          <div class="gh-stat-lbl">Saved</div>
        </div>
        <div class="gh-stat">
          <div class="gh-stat-val" style="color:var(--text-muted)">$${remaining.toLocaleString()}</div>
          <div class="gh-stat-lbl">To Go</div>
        </div>
        <div class="gh-stat">
          <div class="gh-stat-val" style="color:var(--blue)">$${totalMonthly.toLocaleString()}</div>
          <div class="gh-stat-lbl">Monthly Contribution</div>
        </div>
        <div class="gh-stat">
          <div class="gh-stat-val" style="color:var(--orange); font-size:13px">${timeStr}</div>
          <div class="gh-stat-lbl">Est. Timeline</div>
        </div>
      </div>

      ${investments > 0 ? `
      <div class="goal-roi-breakdown">
        <div class="roi-row">
          <span>💰 Monthly surplus</span>
          <span>$${surplus.toLocaleString()}</span>
        </div>
        <div class="roi-row">
          <span>📈 Investment return (${(ROI_RATE * 100).toFixed(1)}% p.a. on $${investments.toLocaleString()})</span>
          <span style="color:var(--green)">+$${monthlyInvestReturn.toLocaleString()}/mo</span>
        </div>
        <div class="roi-row roi-total">
          <span>Total towards goal each month</span>
          <span style="color:var(--green)">$${totalMonthly.toLocaleString()}</span>
        </div>
      </div>` : ''}
    </div>

    <!-- Milestones -->
    <div class="milestones">${milestonesHtml}</div>

    <!-- Monthly update -->
    <div class="update-card">
      <h3>Log This Month</h3>
      <p>Enter what you actually saved this month — be honest. We'll celebrate the wins and call out the shortfalls.</p>
      <div class="update-input-row">
        <div class="form-group">
          <label>Amount Actually Saved ($)</label>
          <input type="number" id="update-amount" placeholder="${totalMonthly}" />
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <input type="text" id="update-note" placeholder="e.g. skipped takeaway all month" />
        </div>
        <button class="btn btn-primary" id="log-update-btn" style="flex-shrink:0;margin-bottom:0">Log It</button>
      </div>
      <div class="reaction-banner" id="reaction-banner"></div>
    </div>

    <!-- History -->
    <div class="card">
      <div class="section-title">Monthly History</div>
      <div id="history-list">${historyHtml}</div>
    </div>
  `;

  // Animate bar in
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = document.getElementById('goal-fill');
      if (fill) fill.style.width = pct + '%';
    }, 100);
  });

  document.getElementById('log-update-btn').addEventListener('click', logMonthlyUpdate);

  // Check milestone celebration on load
  checkNewMilestone(pct);
}

function logMonthlyUpdate() {
  const saved    = +document.getElementById('update-amount').value;
  const note     = document.getElementById('update-note').value.trim();
  if (!saved && saved !== 0) return;

  const f              = window.state.finance;
  const surplus        = Math.max(0, (f.income || 0) - (f.expenses || 0));
  const monthlyReturn  = Math.round(((f.investments || 0) * ((f.roiRate ?? 5.5) / 100)) / 12);
  const totalMonthly   = surplus + monthlyReturn;
  const prevPct        = f.target ? Math.round((f.savings || 0) / f.target * 100) : 0;

  // Update total savings
  f.savings = (f.savings || 0) + saved;
  if (!f.history) f.history = [];

  const now = new Date();
  const monthStr = now.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

  f.history.push({
    month:    monthStr,
    saved,
    expected: totalMonthly,
    note,
  });

  saveState();

  // Show reaction
  const banner   = document.getElementById('reaction-banner');
  const diff     = saved - surplus;
  const newPct   = f.target ? Math.round(f.savings / f.target * 100) : 0;

  if (diff >= 0) {
    const msg = CELEBRATE_MSGS[Math.floor(Math.random() * CELEBRATE_MSGS.length)];
    banner.className = 'reaction-banner celebrate';
    banner.innerHTML = `<div class="reaction-title">${msg.title}</div><div class="reaction-msg">${msg.msg}</div>`;
    launchConfetti();
  } else {
    const msg = SHAME_MSGS[Math.floor(Math.random() * SHAME_MSGS.length)];
    banner.className = 'reaction-banner shame';
    banner.innerHTML = `<div class="reaction-title">${msg.title}</div><div class="reaction-msg">${msg.msg}</div>`;
  }

  document.getElementById('update-amount').value = '';
  document.getElementById('update-note').value   = '';

  // Re-render goal to update stats
  setTimeout(() => renderSavingsGoal(), 400);
}

function checkNewMilestone(pct) {
  const f = window.state.finance;
  const prev = f.lastMilestonePct || 0;
  const milestones = [25, 50, 75, 100];
  for (const m of milestones) {
    if (pct >= m && prev < m) {
      f.lastMilestonePct = m;
      saveState();
      if (m === 100) {
        setTimeout(() => { launchConfetti(); launchConfetti(); }, 200);
      }
    }
  }
}

function launchConfetti() {
  const colours = ['#ffe000','#4caf78','#6aadff','#ff7730','#c084fc','#fff'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: ${Math.random() * -40}px;
      background: ${colours[Math.floor(Math.random() * colours.length)]};
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      animation-delay: ${Math.random() * 0.8}s;
      animation-duration: ${1.8 + Math.random() * 1.2}s;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

function calcProperty() {
  const price      = +document.getElementById('prop-price').value || 0;
  const depositPct = +document.getElementById('prop-deposit').value || 20;
  const rate       = +document.getElementById('prop-rate').value  || 6.2;
  const term       = +document.getElementById('prop-term').value  || 30;
  const state      = document.getElementById('prop-state').value;
  const rent       = +document.getElementById('prop-rent').value  || 0;
  const annualInc  = +document.getElementById('prop-annual-income').value || 0;
  const otherLoans = +document.getElementById('prop-other-loans').value   || 0;

  if (!price) { document.getElementById('prop-result').innerHTML = `<p class="text-muted text-sm mt-12">Enter a purchase price to calculate.</p>`; return; }

  const deposit    = Math.round(price * depositPct / 100);
  const loanAmt    = price - deposit;
  const stampDuty  = calcStampDuty(price, state);
  const conveyance = 2000;
  const inspection = 600;
  const lmi        = depositPct < 20 ? Math.round(loanAmt * 0.02) : 0;
  const totalCash  = deposit + stampDuty + conveyance + inspection + lmi;
  const monthly    = Math.round(calcRepayment(loanAmt, rate, term));
  const afterRent  = Math.max(0, monthly - rent);

  let serviceHtml = '';
  if (annualInc) {
    const testRepay  = Math.round(calcRepayment(loanAmt, rate + 3, term));
    const maxRepay   = (annualInc / 12) * 0.28;
    const totalOblig = testRepay + otherLoans;
    const canService = totalOblig <= maxRepay;
    serviceHtml = `
      <div class="service-result ${canService ? 'service-ok' : 'service-no'}">
        ${canService
          ? `✓ Likely serviceable — test repayments ($${testRepay.toLocaleString()}/mo) are within 28% of your income.`
          : `✗ May be tight — total obligations ($${totalOblig.toLocaleString()}/mo) exceed 28% of income ($${Math.round(maxRepay).toLocaleString()}/mo). Speak to a broker.`}
      </div>`;
  }

  document.getElementById('prop-result').innerHTML = `
    <div class="property-result">
      <h3>${state} — $${price.toLocaleString()}</h3>
      <div class="result-row"><span class="result-label">Deposit (${depositPct}%)</span><span class="result-value highlight">$${deposit.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Loan Amount</span><span class="result-value">$${loanAmt.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Stamp Duty (${state})</span><span class="result-value">$${stampDuty.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Conveyancing (est.)</span><span class="result-value">$${conveyance.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Building Inspection (est.)</span><span class="result-value">$${inspection.toLocaleString()}</span></div>
      ${lmi ? `<div class="result-row"><span class="result-label">LMI (est. &lt;20% deposit)</span><span class="result-value">$${lmi.toLocaleString()}</span></div>` : ''}
      <div class="result-row"><span class="result-label">Total Cash Required</span><span class="result-value highlight">$${totalCash.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Monthly Repayment (P&I)</span><span class="result-value">$${monthly.toLocaleString()}/mo</span></div>
      ${rent ? `<div class="result-row"><span class="result-label">Net Cost After Rent</span><span class="result-value green">$${afterRent.toLocaleString()}/mo</span></div>` : ''}
      ${serviceHtml}
      <div class="scenario-note">Estimates only. Stamp duty concessions may apply. Always confirm with a licensed conveyancer or mortgage broker.</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────
// ── 2027 Property Plan
// ─────────────────────────────────────────────────────────

const AREAS_2027 = {
  'Inner West': {
    icon: '🏘️', color: 'var(--orange)',
    suburbs: 'Newtown · Leichhardt · Balmain · Marrickville · Dulwich Hill',
    house2: 1550000, house3: 1950000,
    town2:  1100000, town3:  1350000,
    source: 'Domain/CoreLogic median estimates, May 2025',
  },
  'Lower North Shore': {
    icon: '🌊', color: 'var(--blue)',
    suburbs: 'Mosman · Neutral Bay · Cremorne · Kirribilli · Waverton',
    house2: 2600000, house3: 3300000,
    town2:  1550000, town3:  1800000,
    source: 'Domain/CoreLogic median estimates, May 2025',
  },
  'North Shore': {
    icon: '🌳', color: 'var(--green)',
    suburbs: 'Chatswood · Lane Cove · Willoughby · Lindfield · Pymble',
    house2: 1800000, house3: 2350000,
    town2:  1250000, town3:  1550000,
    source: 'Domain/CoreLogic median estimates, May 2025',
  },
};

function build2027PanelHTML(p) {
  const fhb        = p.fhb         ?? '';
  const partner    = p.partner     ?? '';
  const income     = p.income      || '';
  const depositPct = p.depositPct  || '20';
  const propType   = p.propType    || 'either';
  const bedrooms   = p.bedrooms    || '3';
  const areasPref  = p.areasPref   || 'all';
  const propSavings= p.propSavings || '';
  const monthlyAdd = p.monthlyAdd  || '';
  const growthRate = p.growthRate  || '3';

  return `
    <div class="plan2027-layout">

      <!-- ── Left: Input form ── -->
      <div class="plan2027-form">
        <div class="card">
          <div class="section-title">About You</div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Are you a first home buyer?</label>
            <div class="toggle-group" id="fhb-toggle">
              <button class="toggle-btn ${fhb==='yes'?'active':''}" data-val="yes">Yes</button>
              <button class="toggle-btn ${fhb==='no'?'active':''}"  data-val="no">No</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Buying alone or with a partner?</label>
            <div class="toggle-group" id="partner-toggle">
              <button class="toggle-btn ${partner==='solo'?'active':''}"    data-val="solo">Just me</button>
              <button class="toggle-btn ${partner==='partner'?'active':''}" data-val="partner">With partner</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label>Combined gross annual income ($)</label>
            <input type="number" id="p27-income" placeholder="e.g. 180000" value="${income}" />
          </div>

          <hr class="divider" />
          <div class="section-title" style="margin-top:4px">Your Target</div>

          <div class="form-group" style="margin-bottom:12px">
            <label>How many bedrooms?</label>
            <div class="toggle-group" id="beds-toggle">
              <button class="toggle-btn ${bedrooms==='2'?'active':''}"      data-val="2">2 bed</button>
              <button class="toggle-btn ${bedrooms==='3'?'active':''}"      data-val="3">3 bed</button>
              <button class="toggle-btn ${bedrooms==='either'?'active':''}" data-val="either">Either</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Property type?</label>
            <div class="toggle-group" id="type-toggle">
              <button class="toggle-btn ${propType==='house'?'active':''}"  data-val="house">House only</button>
              <button class="toggle-btn ${propType==='town'?'active':''}"   data-val="town">Townhouse OK</button>
              <button class="toggle-btn ${propType==='either'?'active':''}" data-val="either">Either</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Which areas? (select to filter)</label>
            <div class="toggle-group" id="area-toggle">
              <button class="toggle-btn ${areasPref==='all'?'active':''}"         data-val="all">All three</button>
              <button class="toggle-btn ${areasPref==='Inner West'?'active':''}"  data-val="Inner West">Inner West</button>
              <button class="toggle-btn ${areasPref==='Lower North Shore'?'active':''}" data-val="Lower North Shore">Lower North</button>
              <button class="toggle-btn ${areasPref==='North Shore'?'active':''}" data-val="North Shore">North Shore</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label>Target deposit</label>
            <div class="toggle-group" id="dep-toggle">
              <button class="toggle-btn ${depositPct==='20'?'active':''}" data-val="20">20% (no LMI)</button>
              <button class="toggle-btn ${depositPct==='10'?'active':''}" data-val="10">10% (with LMI)</button>
            </div>
          </div>

          <hr class="divider" />
          <div class="section-title" style="margin-top:4px">Your Savings</div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Property deposit savings so far ($)</label>
            <input type="number" id="p27-savings" placeholder="e.g. 80000" value="${propSavings}" />
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Monthly contribution to deposit ($)</label>
            <input type="number" id="p27-monthly" placeholder="e.g. 3000" value="${monthlyAdd}" />
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label>Assume property price growth per year (%)</label>
            <div class="toggle-group" id="growth-toggle">
              <button class="toggle-btn ${growthRate==='0'?'active':''}" data-val="0">0% (flat)</button>
              <button class="toggle-btn ${growthRate==='3'?'active':''}" data-val="3">3% p.a.</button>
              <button class="toggle-btn ${growthRate==='5'?'active':''}" data-val="5">5% p.a.</button>
              <button class="toggle-btn ${growthRate==='7'?'active':''}" data-val="7">7% p.a.</button>
            </div>
          </div>

          <button class="btn btn-primary w-full" id="save-plan2027-btn">Update Plan</button>
          <p class="text-xs text-muted" style="margin-top:10px;line-height:1.6">
            Price estimates based on CoreLogic/Domain median data, May 2025. Updated periodically — check
            <a href="https://www.domain.com.au" target="_blank" style="color:var(--blue)">Domain</a> or
            <a href="https://www.realestate.com.au" target="_blank" style="color:var(--blue)">REA</a> for live listings.
          </p>
        </div>
      </div>

      <!-- ── Right: Results ── -->
      <div class="plan2027-results" id="plan2027-results">
        ${render2027Results(p)}
      </div>
    </div>
  `;
}

function savePlan2027() {
  const p = window.state.plan2027;

  // Read toggle selections
  p.fhb        = document.querySelector('#fhb-toggle .toggle-btn.active')?.dataset.val      || '';
  p.partner    = document.querySelector('#partner-toggle .toggle-btn.active')?.dataset.val  || '';
  p.bedrooms   = document.querySelector('#beds-toggle .toggle-btn.active')?.dataset.val     || '3';
  p.propType   = document.querySelector('#type-toggle .toggle-btn.active')?.dataset.val     || 'either';
  p.areasPref  = document.querySelector('#area-toggle .toggle-btn.active')?.dataset.val     || 'all';
  p.depositPct = document.querySelector('#dep-toggle .toggle-btn.active')?.dataset.val      || '20';
  p.growthRate = document.querySelector('#growth-toggle .toggle-btn.active')?.dataset.val   || '3';
  p.income     = +document.getElementById('p27-income')?.value  || 0;
  p.propSavings= +document.getElementById('p27-savings')?.value || 0;
  p.monthlyAdd = +document.getElementById('p27-monthly')?.value || 0;

  saveState();

  // Re-render results
  const res = document.getElementById('plan2027-results');
  if (res) res.innerHTML = render2027Results(p);

  const btn = document.getElementById('save-plan2027-btn');
  btn.textContent = 'Updated ✓'; btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = 'Update Plan'; btn.style.background = ''; }, 2000);
}

function render2027Results(p) {
  const currentSavings = p.propSavings  || 0;
  const monthlyAdd     = p.monthlyAdd   || 0;
  const depositPct     = +(p.depositPct || 20) / 100;
  const bedrooms       = p.bedrooms     || '3';
  const propType       = p.propType     || 'either';
  const growthRate     = +(p.growthRate || 3) / 100;
  const income         = p.income       || 0;
  const areasPref      = p.areasPref    || 'all';
  const deadline2027   = new Date('2027-12-31');

  if (!currentSavings && !monthlyAdd) {
    return `
      <div class="plan2027-empty">
        <div style="font-size:48px;margin-bottom:12px">🏡</div>
        <h3>Fill in your details</h3>
        <p>Complete the form on the left and click <strong>Update Plan</strong> to see how achievable your 2027 property goal is.</p>
      </div>`;
  }

  const areas = areasPref === 'all'
    ? Object.entries(AREAS_2027)
    : Object.entries(AREAS_2027).filter(([name]) => name === areasPref);

  return areas.map(([areaName, area]) => {
    // Pick the right base price
    let basePrice;
    if (bedrooms === '2')      basePrice = propType === 'town' ? area.town2 : propType === 'house' ? area.house2 : Math.min(area.house2, area.town2);
    else if (bedrooms === '3') basePrice = propType === 'town' ? area.town3 : propType === 'house' ? area.house3 : Math.min(area.house3, area.town3);
    else                       basePrice = propType === 'town' ? area.town3 : propType === 'house' ? area.house3 : Math.min(area.house3, area.town3);

    const priceLabel = bedrooms === 'either'
      ? `${bedrooms === 'either' ? '2-3' : bedrooms} bed ${propType === 'either' ? 'house/townhouse' : propType === 'town' ? 'townhouse' : 'house'}`
      : `${bedrooms} bed ${propType === 'either' ? 'house/townhouse' : propType === 'town' ? 'townhouse' : 'house'}`;

    // Calculate time needed iteratively (price grows as time passes)
    let months = 0;
    let savings = currentSavings;
    let price   = basePrice;
    const MAX_MONTHS = 360;

    while (months < MAX_MONTHS) {
      const deposit    = Math.round(price * depositPct);
      const stampDuty  = calcStampDuty(price, 'NSW');
      const lmi        = depositPct < 0.2 ? Math.round((price - deposit) * 0.02) : 0;
      const otherCosts = 8000; // conveyancing + inspection
      const totalNeeded = deposit + stampDuty + lmi + otherCosts;

      if (savings >= totalNeeded) break;

      months++;
      savings += monthlyAdd;
      // Apply monthly price growth
      price = basePrice * Math.pow(1 + growthRate, months / 12);
    }

    // Final figures at the projected month
    const finalPrice    = basePrice * Math.pow(1 + growthRate, months / 12);
    const finalDeposit  = Math.round(finalPrice * depositPct);
    const finalStamp    = calcStampDuty(Math.round(finalPrice), 'NSW');
    const finalLMI      = depositPct < 0.2 ? Math.round((finalPrice - finalDeposit) * 0.02) : 0;
    const finalOther    = 8000;
    const finalTotal    = finalDeposit + finalStamp + finalLMI + finalOther;
    const stillNeeded   = Math.max(0, finalTotal - currentSavings);

    // Ready date
    const readyDate    = new Date();
    readyDate.setMonth(readyDate.getMonth() + months);
    const by2027       = readyDate <= deadline2027;
    const monthsTo2027 = Math.round((deadline2027 - new Date()) / (1000 * 60 * 60 * 24 * 30.4));

    // Progress
    const nowDeposit   = Math.round(basePrice * depositPct);
    const nowStamp     = calcStampDuty(basePrice, 'NSW');
    const nowLMI       = depositPct < 0.2 ? Math.round((basePrice - nowDeposit) * 0.02) : 0;
    const nowTotal     = nowDeposit + nowStamp + nowLMI + 8000;
    const pct          = Math.min(100, Math.round((currentSavings / nowTotal) * 100));

    // Serviceability check
    let serviceHtml = '';
    if (income) {
      const loanNeeded  = Math.round(finalPrice - finalDeposit);
      const testRate    = 6.5 + 3; // current est. + buffer
      const repayment   = Math.round(calcRepayment(loanNeeded, testRate, 30));
      const maxRepay    = Math.round((income / 12) * 0.35);
      const canService  = repayment <= maxRepay;
      serviceHtml = `
        <div class="plan-service ${canService ? 'ok' : 'tight'}">
          ${canService
            ? `✓ Serviceability looks OK — test repayment ~$${repayment.toLocaleString()}/mo is within 35% of income`
            : `⚠ May be tight — test repayment ~$${repayment.toLocaleString()}/mo exceeds 35% of income ($${maxRepay.toLocaleString()}/mo). A broker can advise.`}
        </div>`;
    }

    // Month/year label
    const readyMonthStr = readyDate.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

    // Timeline bar: today → ready date → 2027 end
    const totalSpan    = Math.max(monthsTo2027, months);
    const progressFrac = Math.min(1, months / totalSpan);

    return `
      <div class="area-result-card">
        <div class="area-result-header" style="border-left-color:${area.color}">
          <span class="area-icon">${area.icon}</span>
          <div>
            <div class="area-name">${areaName}</div>
            <div class="area-suburbs">${area.suburbs}</div>
          </div>
          <div class="${by2027 ? 'area-verdict yes' : 'area-verdict no'}">
            ${by2027 ? '✓ 2027 achievable' : '⏳ ' + readyMonthStr}
          </div>
        </div>

        <div class="area-price-row">
          <div class="area-price-box">
            <div class="apb-label">Estimated price today</div>
            <div class="apb-value">$${Math.round(basePrice).toLocaleString()}</div>
            <div class="apb-sub">${priceLabel}</div>
          </div>
          ${growthRate > 0 ? `
          <div class="area-price-box">
            <div class="apb-label">Price by ${readyMonthStr}</div>
            <div class="apb-value" style="color:var(--text-muted)">$${Math.round(finalPrice).toLocaleString()}</div>
            <div class="apb-sub">at ${p.growthRate}% p.a. growth</div>
          </div>` : ''}
          <div class="area-price-box">
            <div class="apb-label">Total cash needed</div>
            <div class="apb-value" style="color:var(--orange)">$${finalTotal.toLocaleString()}</div>
            <div class="apb-sub">deposit + stamp duty + costs</div>
          </div>
        </div>

        <!-- Deposit breakdown -->
        <div class="area-breakdown">
          <div class="abd-row"><span>Deposit (${depositPct * 100}%)</span><span>$${finalDeposit.toLocaleString()}</span></div>
          <div class="abd-row"><span>NSW Stamp Duty</span><span>$${finalStamp.toLocaleString()}</span></div>
          ${finalLMI ? `<div class="abd-row"><span>LMI (est.)</span><span>$${finalLMI.toLocaleString()}</span></div>` : ''}
          <div class="abd-row"><span>Conveyancing + Inspection</span><span>$${finalOther.toLocaleString()}</span></div>
          <div class="abd-row abd-total"><span>Total required</span><span>$${finalTotal.toLocaleString()}</span></div>
        </div>

        <!-- Progress bar -->
        <div class="area-progress">
          <div class="area-progress-label">
            <span>Your current savings</span>
            <span style="color:${pct >= 100 ? 'var(--green)' : 'var(--text-muted)'}">${pct}% of today's target</span>
          </div>
          <div class="progress-track" style="height:8px">
            <div class="progress-fill progress-green" style="width:${pct}%"></div>
          </div>
          <div class="area-progress-sub">$${currentSavings.toLocaleString()} saved · $${stillNeeded.toLocaleString()} still needed</div>
        </div>

        <!-- Timeline -->
        <div class="area-timeline">
          <div class="timeline-label">
            <span>Now</span>
            <span>${by2027 ? '🎯 Ready: ' + readyMonthStr : '📅 Ready: ' + readyMonthStr}</span>
            <span>Dec 2027</span>
          </div>
          <div class="timeline-track">
            <div class="timeline-fill ${by2027 ? 'tl-green' : 'tl-orange'}" style="width:${Math.min(100, Math.round(progressFrac * 100))}%"></div>
            <div class="timeline-marker-2027" style="left:${Math.min(100, Math.round(monthsTo2027/totalSpan*100))}%"></div>
          </div>
          ${!by2027 ? `
          <div class="timeline-callout">
            Based on saving $${monthlyAdd.toLocaleString()}/mo, you'll be ready in <strong>${readyMonthStr}</strong> — about <strong>${months - monthsTo2027} months after</strong> your 2027 target.
            To hit 2027, you'd need to save roughly <strong>$${Math.round(stillNeeded / Math.max(1, monthsTo2027)).toLocaleString()}/mo</strong>.
          </div>` : `
          <div class="timeline-callout ok">
            On track! At $${monthlyAdd.toLocaleString()}/mo you'll have enough by <strong>${readyMonthStr}</strong>. 🎉
          </div>`}
        </div>

        ${serviceHtml}
        <div class="area-source">📊 ${area.source}</div>
      </div>`;
  }).join('');
}

// Bind toggle buttons inside the 2027 panel
document.addEventListener('click', e => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  const group = btn.closest('.toggle-group');
  if (!group) return;
  group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});
