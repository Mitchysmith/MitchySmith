// ── Finance ──
const STAMP_DUTY = {
  NSW: { thresholds:[0,16000,35000,91000,160000,1100000,3000000], rates:[0.0125,0.015,0.0175,0.035,0.045,0.055,0.07], fhbExempt:800000 },
  VIC: { thresholds:[0,25000,130000,960000,2000000], rates:[0.014,0.024,0.06,0.055,0.065], fhbExempt:600000 },
  QLD: { thresholds:[0,5000,75000,540000,1000000], rates:[0,0.015,0.035,0.0425,0.0575], fhbExempt:500000 },
  WA:  { thresholds:[0,120000,150000,360000,725000], rates:[0.019,0.0285,0.03,0.0425,0.0515], fhbExempt:430000 },
  SA:  { thresholds:[0,12000,30000,50000,100000,200000,250000,300000,500000], rates:[0.01,0.02,0.03,0.035,0.04,0.045,0.05,0.055,0.057], fhbExempt:650000 },
  ACT: { thresholds:[0,200000,300000,500000,750000,1000000,1455000], rates:[0.002,0.0392,0.0414,0.0559,0.0596,0.0638,0.0694], fhbExempt:0 },
  TAS: { thresholds:[0,3000,25000,75000,200000,375000,725000], rates:[0.01875,0.02,0.025,0.03,0.035,0.04,0.045], fhbExempt:600000 },
  NT:  { thresholds:[0,525000,3000000], rates:[0.0549,0.059,0.0645], fhbExempt:650000 },
};

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
  const f  = window.state.finance || {};

  el.innerHTML = `
    <div class="page-header">
      <h1>Finance</h1>
      <p>Clarity on your money — income, goals, and property planning.</p>
    </div>

    <div class="finance-tabs">
      <div class="fin-tab active" data-fin="overview">Overview</div>
      <div class="fin-tab" data-fin="goals">Goals</div>
      <div class="fin-tab" data-fin="property">Property</div>
      <div class="fin-tab" data-fin="purchases">Purchases</div>
    </div>

    <!-- Overview panel -->
    <div class="fin-panel active" id="fin-overview">
      <div class="fin-summary">
        <div class="fin-stat">
          <div class="fin-stat-label">Monthly Income</div>
          <div class="fin-stat-value income" id="disp-income">$${(f.income||0).toLocaleString()}</div>
        </div>
        <div class="fin-stat">
          <div class="fin-stat-label">Monthly Expenses</div>
          <div class="fin-stat-value expense" id="disp-expense">$${(f.expenses||0).toLocaleString()}</div>
        </div>
        <div class="fin-stat">
          <div class="fin-stat-label">Investments</div>
          <div class="fin-stat-value neutral" id="disp-invest">$${(f.investments||0).toLocaleString()}</div>
        </div>
        <div class="fin-stat">
          <div class="fin-stat-label">Savings</div>
          <div class="fin-stat-value neutral" id="disp-savings">$${(f.savings||0).toLocaleString()}</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Update Figures</div>
        <div class="form-row">
          <div class="form-group"><label>Monthly Income ($)</label><input type="number" id="f-income" value="${f.income||0}" /></div>
          <div class="form-group"><label>Monthly Expenses ($)</label><input type="number" id="f-expenses" value="${f.expenses||0}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Total Savings ($)</label><input type="number" id="f-savings" value="${f.savings||0}" /></div>
          <div class="form-group"><label>Total Investments ($)</label><input type="number" id="f-invest" value="${f.investments||0}" /></div>
        </div>
        <button class="btn btn-primary" id="save-finance-btn">Save</button>
      </div>
    </div>

    <!-- Goals panel -->
    <div class="fin-panel" id="fin-goals">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title">Add Savings Goal</div>
        <div class="form-row">
          <div class="form-group"><label>Goal Name</label><input type="text" id="goal-name" placeholder="e.g. House Deposit" /></div>
          <div class="form-group"><label>Target Amount ($)</label><input type="number" id="goal-target" placeholder="100000" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Current Amount ($)</label><input type="number" id="goal-current" placeholder="0" /></div>
        </div>
        <button class="btn btn-primary" id="add-goal-btn">Add Goal</button>
      </div>
      <div id="goals-list"></div>
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
          <div class="form-group"><label>Loan Term (years)</label><input type="number" id="prop-term" value="30" /></div>
          <div class="form-group"><label>State</label>
            <select id="prop-state">
              ${Object.keys(STAMP_DUTY).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Rental Income / month ($)</label><input type="number" id="prop-rent" value="0" placeholder="Optional" /></div>
          <div class="form-group"><label>Other Monthly Income ($)</label><input type="number" id="prop-other-income" value="0" placeholder="Optional" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Gross Annual Income ($)</label><input type="number" id="prop-annual-income" placeholder="For serviceability" /></div>
          <div class="form-group"><label>Other Monthly Loan Repayments ($)</label><input type="number" id="prop-other-loans" value="0" /></div>
        </div>
        <button class="btn btn-primary" id="calc-prop-btn">Calculate</button>

        <div id="prop-result"></div>
      </div>
    </div>

    <!-- Purchases panel -->
    <div class="fin-panel" id="fin-purchases">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title">Add Purchase Goal</div>
        <div class="form-row">
          <div class="form-group"><label>Item</label><input type="text" id="pur-name" placeholder="e.g. New Car" /></div>
          <div class="form-group"><label>Estimated Cost ($)</label><input type="number" id="pur-cost" /></div>
        </div>
        <button class="btn btn-primary" id="add-pur-btn">Add</button>
      </div>
      <div id="purchases-list"></div>
    </div>
  `;

  bindFinanceEvents();
  renderGoals();
  renderPurchases();
}

function bindFinanceEvents() {
  // Tab switching
  document.querySelectorAll('.fin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('fin-' + tab.dataset.fin).classList.add('active');
    });
  });

  document.getElementById('save-finance-btn').addEventListener('click', saveFinanceOverview);
  document.getElementById('add-goal-btn').addEventListener('click', addGoal);
  document.getElementById('calc-prop-btn').addEventListener('click', calcProperty);
  document.getElementById('add-pur-btn').addEventListener('click', addPurchase);
}

function saveFinanceOverview() {
  window.state.finance.income      = +document.getElementById('f-income').value   || 0;
  window.state.finance.expenses    = +document.getElementById('f-expenses').value  || 0;
  window.state.finance.savings     = +document.getElementById('f-savings').value   || 0;
  window.state.finance.investments = +document.getElementById('f-invest').value    || 0;
  saveState();

  document.getElementById('disp-income').textContent  = '$' + window.state.finance.income.toLocaleString();
  document.getElementById('disp-expense').textContent = '$' + window.state.finance.expenses.toLocaleString();
  document.getElementById('disp-invest').textContent  = '$' + window.state.finance.investments.toLocaleString();
  document.getElementById('disp-savings').textContent = '$' + window.state.finance.savings.toLocaleString();

  const btn = document.getElementById('save-finance-btn');
  btn.textContent = 'Saved ✓'; btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; }, 2000);
}

function addGoal() {
  const name    = document.getElementById('goal-name').value.trim();
  const target  = +document.getElementById('goal-target').value || 0;
  const current = +document.getElementById('goal-current').value || 0;
  if (!name || !target) return;

  if (!window.state.finance.savingsGoals) window.state.finance.savingsGoals = [];
  window.state.finance.savingsGoals.push({ id: Date.now(), name, target, current });
  saveState();
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-current').value = '';
  renderGoals();
}

function renderGoals() {
  const el = document.getElementById('goals-list');
  if (!el) return;
  const goals = window.state.finance.savingsGoals || [];
  if (!goals.length) { el.innerHTML = `<p class="text-muted text-sm">No goals yet — add one above.</p>`; return; }

  el.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    return `
      <div class="goal-item">
        <div class="goal-header">
          <span class="goal-name">${g.name}</span>
          <span class="goal-pct">${pct}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill progress-green" style="width:${pct}%"></div></div>
        <div class="goal-sub">$${g.current.toLocaleString()} of $${g.target.toLocaleString()} saved</div>
      </div>`;
  }).join('');
}

function calcProperty() {
  const price      = +document.getElementById('prop-price').value      || 0;
  const depositPct = +document.getElementById('prop-deposit').value    || 20;
  const rate       = +document.getElementById('prop-rate').value       || 6.2;
  const term       = +document.getElementById('prop-term').value       || 30;
  const state      = document.getElementById('prop-state').value;
  const rent       = +document.getElementById('prop-rent').value       || 0;
  const otherInc   = +document.getElementById('prop-other-income').value || 0;
  const annualInc  = +document.getElementById('prop-annual-income').value || 0;
  const otherLoans = +document.getElementById('prop-other-loans').value || 0;

  if (!price) { document.getElementById('prop-result').innerHTML = `<p class="text-muted text-sm mt-12">Enter a purchase price to calculate.</p>`; return; }

  const deposit     = Math.round(price * depositPct / 100);
  const loanAmt     = price - deposit;
  const stampDuty   = calcStampDuty(price, state);
  const conveyance  = 2000;
  const inspection  = 600;
  const lmi         = depositPct < 20 ? Math.round(loanAmt * 0.02) : 0;
  const totalCash   = deposit + stampDuty + conveyance + inspection + lmi;
  const monthly     = Math.round(calcRepayment(loanAmt, rate, term));
  const afterRent   = Math.max(0, monthly - rent - otherInc);

  // Serviceability: bank typically uses buffer rate +3%
  let serviceHtml = '';
  if (annualInc) {
    const bufferRate = rate + 3;
    const testRepay  = Math.round(calcRepayment(loanAmt, bufferRate, term));
    const monthlyInc = annualInc / 12;
    const maxRepay   = monthlyInc * 0.28;
    const totalOblig = testRepay + otherLoans;
    const canService = totalOblig <= maxRepay;

    serviceHtml = `
      <div class="service-result ${canService ? 'service-ok' : 'service-no'}">
        ${canService
          ? `✓ Likely serviceable — estimated repayments ($${testRepay.toLocaleString()}/mo at buffer rate) are within 28% of your income ($${Math.round(maxRepay).toLocaleString()}/mo).`
          : `✗ May be tight — total obligations at buffer rate ($${totalOblig.toLocaleString()}/mo) exceed 28% of income ($${Math.round(maxRepay).toLocaleString()}/mo). Speak to a broker.`
        }
      </div>`;
  }

  document.getElementById('prop-result').innerHTML = `
    <div class="property-result">
      <h3>Estimate for ${state} — $${price.toLocaleString()}</h3>
      <div class="result-row"><span class="result-label">Deposit (${depositPct}%)</span><span class="result-value highlight">$${deposit.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Loan Amount</span><span class="result-value">$${loanAmt.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Stamp Duty (${state})</span><span class="result-value">$${stampDuty.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Conveyancing (est.)</span><span class="result-value">$${conveyance.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Building Inspection (est.)</span><span class="result-value">$${inspection.toLocaleString()}</span></div>
      ${lmi ? `<div class="result-row"><span class="result-label">LMI (est. &lt;20% deposit)</span><span class="result-value">$${lmi.toLocaleString()}</span></div>` : ''}
      <div class="result-row"><span class="result-label">Total Cash Required</span><span class="result-value highlight">$${totalCash.toLocaleString()}</span></div>
      <div class="result-row"><span class="result-label">Monthly Repayment (P&I)</span><span class="result-value">$${monthly.toLocaleString()}/mo</span></div>
      ${rent || otherInc ? `<div class="result-row"><span class="result-label">Net Cost After Rental / Other Income</span><span class="result-value green">$${afterRent.toLocaleString()}/mo</span></div>` : ''}
      ${serviceHtml}
      <div class="scenario-note">
        These are estimates only. Stamp duty concessions (e.g. first-home buyer) may apply. Always confirm with a licensed conveyancer or mortgage broker.
      </div>
    </div>`;
}

function addPurchase() {
  const name = document.getElementById('pur-name').value.trim();
  const cost = +document.getElementById('pur-cost').value || 0;
  if (!name) return;
  if (!window.state.finance.purchaseGoals) window.state.finance.purchaseGoals = [];
  window.state.finance.purchaseGoals.push({ id: Date.now(), name, cost });
  saveState();
  document.getElementById('pur-name').value = '';
  document.getElementById('pur-cost').value = '';
  renderPurchases();
}

function renderPurchases() {
  const el = document.getElementById('purchases-list');
  if (!el) return;
  const items = window.state.finance.purchaseGoals || [];
  if (!items.length) { el.innerHTML = `<p class="text-muted text-sm">No purchase goals yet.</p>`; return; }

  el.innerHTML = items.map(p => `
    <div class="purchase-item">
      <span class="p-name">${p.name}</span>
      <span class="p-cost">$${p.cost.toLocaleString()}</span>
      <span class="p-del" data-id="${p.id}">✕</span>
    </div>`).join('');

  el.querySelectorAll('.p-del').forEach(btn => {
    btn.addEventListener('click', () => {
      window.state.finance.purchaseGoals = window.state.finance.purchaseGoals.filter(p => p.id !== +btn.dataset.id);
      saveState(); renderPurchases();
    });
  });
}
