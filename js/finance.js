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
  if (!window.state.finance) window.state.finance = {};
  const f = window.state.finance;

  el.innerHTML = `
    <div class="page-header">
      <h1>Finance</h1>
      <p>Your savings goal, progress, and property planning in one place.</p>
    </div>

    <div class="finance-tabs">
      <div class="fin-tab active" data-fin="savings">Savings Goal</div>
      <div class="fin-tab" data-fin="setup">Setup</div>
      <div class="fin-tab" data-fin="property">Property</div>
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
