// ── Finance – Home Purchase Planner ──

const STAMP_DUTY = {
  NSW: { thresholds:[0,16000,35000,91000,160000,1100000,3000000], rates:[0.0125,0.015,0.0175,0.035,0.045,0.055,0.07] },
  VIC: { thresholds:[0,25000,130000,960000,2000000],               rates:[0.014,0.024,0.06,0.055,0.065] },
  QLD: { thresholds:[0,5000,75000,540000,1000000],                 rates:[0,0.015,0.035,0.0425,0.0575] },
  WA:  { thresholds:[0,120000,150000,360000,725000],               rates:[0.019,0.0285,0.03,0.0425,0.0515] },
  SA:  { thresholds:[0,12000,30000,50000,100000,200000,250000,300000,500000], rates:[0.01,0.02,0.03,0.035,0.04,0.045,0.05,0.055,0.057] },
  ACT: { thresholds:[0,200000,300000,500000,750000,1000000,1455000], rates:[0.002,0.0392,0.0414,0.0559,0.0596,0.0638,0.0694] },
  TAS: { thresholds:[0,3000,25000,75000,200000,375000,725000],     rates:[0.01875,0.02,0.025,0.03,0.035,0.04,0.045] },
  NT:  { thresholds:[0,525000,3000000],                            rates:[0.0549,0.059,0.0645] },
};

const CELEBRATE_MSGS = [
  { title: '🎉 Absolutely smashed it!',   msg: 'You saved more than planned this month. That\'s the compounding magic starting to work. Keep this up and you\'ll hit your goal ahead of schedule.' },
  { title: '🚀 Legend behaviour!',         msg: 'You\'re ahead of target — your future self is doing a happy dance right now. One month like this brings the finish line noticeably closer.' },
  { title: '💪 Killing it!',              msg: 'More saved than expected. Every extra dollar is working for you. This is exactly how goals get smashed early.' },
];

const SHAME_MSGS = [
  { title: '😬 Oof. That\'s a bit rough.',          msg: 'You came in under target this month. No judgement — but maybe check what slipped. One quiet month is fine; a pattern is not.' },
  { title: '🫠 Your savings goal is not impressed.', msg: 'Less than planned went in this month. The goal hasn\'t changed — just the timeline has stretched. Time to tighten up next month.' },
  { title: '😅 Well… at least you tracked it.',     msg: 'Under target this month. Awareness is step one. Step two is doing better next month. You\'ve got this — just requires a bit more discipline.' },
];

// ── Pure helpers ──

function calcStampDuty(price, state) {
  const sd = STAMP_DUTY[state];
  if (!sd) return 0;
  let duty = 0;
  for (let i = sd.thresholds.length - 1; i >= 0; i--) {
    if (price > sd.thresholds[i]) {
      duty = (price - sd.thresholds[i]) * sd.rates[i];
      for (let j = i - 1; j >= 0; j--) duty += (sd.thresholds[j+1] - sd.thresholds[j]) * sd.rates[j];
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

function calcTotalCashNeeded(f) {
  const price = +(f.propPrice || 0);
  if (!price) return f.target || 0;
  const depPct  = (f.propDepositPct || 20) / 100;
  const deposit = Math.round(price * depPct);
  const loan    = price - deposit;
  const stamp   = calcStampDuty(price, f.propState || 'NSW');
  const lmi     = depPct < 0.2 ? Math.round(loan * 0.02) : 0;
  return deposit + stamp + lmi + 2600; // conveyancing $2000 + inspection $600
}

function runTimelineSimulation(f) {
  const loanRep     = (f.loans||[]).reduce((s,l) => s+(l.balance&&l.rate&&l.term?Math.round(calcRepayment(l.balance,l.rate,l.term)):0), 0);
  const loanStrata  = (f.loans||[]).reduce((s,l) => s+(l.strata||0), 0);
  const loanRental  = (f.loans||[]).reduce((s,l) => s+(l.rentalIncome||0), 0);
  const totalIncome    = (f.mitchIncome||0) + (f.samIncome||0) + loanRental;
  const totalExpenses  = (f.expHomeLoan||0) + (f.expJoint||0) + (f.expMitch||0) + (f.expSam||0) + loanRep + loanStrata;
  const surplus        = Math.max(0, totalIncome - totalExpenses);
  const roiMonthly     = ((f.investments||0) * ((f.roiRate||5.5) / 100)) / 12;
  const monthlyContrib = surplus + roiMonthly;
  const growthRate     = (f.propGrowthRate || 0) / 100;
  const basePrice      = f.propPrice || 0;

  let months  = 0;
  let savings = (f.savings || 0) + (f.investments || 0);
  const MAX   = 480;

  while (months < MAX) {
    const projPrice = basePrice > 0 ? basePrice * Math.pow(1 + growthRate, months / 12) : 0;
    const needed    = calcTotalCashNeeded({ ...f, propPrice: projPrice });
    if (savings >= needed) break;
    months++;
    savings += monthlyContrib;
  }

  const finalPrice   = basePrice > 0 ? basePrice * Math.pow(1 + growthRate, months / 12) : 0;
  const finalDepPct  = (f.propDepositPct || 20) / 100;
  const finalDeposit = Math.round(finalPrice * finalDepPct);
  const finalLoan    = finalPrice - finalDeposit;
  const newRepayment = finalLoan > 0 ? Math.round(calcRepayment(finalLoan, f.propRate || 6.2, f.propTerm || 30)) : 0;
  const expAfterBuy  = (f.expJoint||0) + (f.expMitch||0) + (f.expSam||0) + newRepayment + loanRep + loanStrata;
  const surplusAfter = totalIncome - expAfterBuy;

  const readyDate = new Date();
  readyDate.setMonth(readyDate.getMonth() + months);
  return { months: months < MAX ? months : null, readyDate, surplusAfter, newRepayment, finalPrice };
}

// ─────────────────────────────────────────────────────────
// ROOT RENDER
// ─────────────────────────────────────────────────────────

function renderFinance() {
  const el = document.getElementById('section-finance');
  if (!window.state.finance)  window.state.finance  = {};
  if (!window.state.plan2027) window.state.plan2027 = {};
  _initFinanceDefaults();

  const f   = window.state.finance;
  const p   = window.state.plan2027;
  const tab = f._activeFinTab || 'savings';

  el.innerHTML = `
    <div class="page-header">
      <h1>Finance</h1>
      <p>Savings goal, home planning, and property areas in one place.</p>
    </div>

    <div class="finance-tabs">
      <div class="fin-tab ${tab==='savings' ?'active':''}" data-fin="savings">Savings Goal</div>
      <div class="fin-tab ${tab==='homeplan'?'active':''}" data-fin="homeplan">🏠 Home Planning</div>
      <div class="fin-tab ${tab==='plan2027'?'active':''}" data-fin="plan2027">🏡 2027 Areas</div>
    </div>

    <div class="fin-panel ${tab==='savings' ?'active':''}" id="fin-savings"></div>
    <div class="fin-panel ${tab==='homeplan'?'active':''}" id="fin-homeplan"></div>
    <div class="fin-panel ${tab==='plan2027'?'active':''}" id="fin-plan2027">${build2027PanelHTML(p)}</div>
  `;

  bindFinanceEvents();
  renderSavingsGoal();
  renderHomePlanningPanel();
}

function _initFinanceDefaults() {
  const f    = window.state.finance;
  const defs = {
    goalName: '', target: 0, history: [], lastMilestonePct: 0,
    inputMode: 'monthly',
    mitchIncome: 0, samIncome: 0,
    savings: 0, investments: 0, roiRate: 5.5,
    expHomeLoan: 0, expJoint: 0, expMitch: 0, expSam: 0,
    propPrice: 0, propDepositPct: 20, propRate: 6.2, propTerm: 30,
    propState: 'NSW', propGrowthRate: 3,
    loans: [],
  };
  Object.entries(defs).forEach(([k, v]) => { if (f[k] === undefined) f[k] = v; });
  // Migrate old single-field income/expenses
  if (!f.mitchIncome && !f.samIncome && f.income)   f.mitchIncome = f.income;
  if (!f.expJoint && !f.expMitch && !f.expSam && f.expenses) f.expJoint = f.expenses;
  if (!Array.isArray(f.loans)) f.loans = [];
}

function bindFinanceEvents() {
  document.querySelectorAll('.fin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('fin-' + tab.dataset.fin).classList.add('active');
      window.state.finance._activeFinTab = tab.dataset.fin;
      saveState();
    });
  });
  document.getElementById('save-plan2027-btn')?.addEventListener('click', savePlan2027);
}

// ─────────────────────────────────────────────────────────
// SAVINGS GOAL TAB
// ─────────────────────────────────────────────────────────

function renderSavingsGoal() {
  const el = document.getElementById('fin-savings');
  if (!el) return;
  const f = window.state.finance;

  const mitchIncome    = f.mitchIncome  || 0;
  const samIncome      = f.samIncome    || 0;
  const _loanRep       = (f.loans||[]).reduce((s,l) => s+(l.balance&&l.rate&&l.term?Math.round(calcRepayment(l.balance,l.rate,l.term)):0), 0);
  const _loanStrata    = (f.loans||[]).reduce((s,l) => s+(l.strata||0), 0);
  const _loanRental    = (f.loans||[]).reduce((s,l) => s+(l.rentalIncome||0), 0);
  const totalIncome    = (mitchIncome + samIncome + _loanRental) || f.income || 0;
  const totalExpenses  = (f.expHomeLoan||0)+(f.expJoint||0)+(f.expMitch||0)+(f.expSam||0)+_loanRep+_loanStrata || f.expenses || 0;
  const surplus        = Math.max(0, totalIncome - totalExpenses);
  const investments    = f.investments || 0;
  const target         = calcTotalCashNeeded(f) || 0;
  const current        = f.savings || 0;
  const name           = f.propPrice > 0
    ? (f.goalName || `${f.propDepositPct||20}% deposit + costs — $${(f.propPrice).toLocaleString()} target`)
    : (f.goalName || 'My Savings Goal');
  const remaining      = Math.max(0, target - current);
  const pct            = target ? Math.min(100, Math.round(current / target * 100)) : 0;
  const ROI_RATE       = (f.roiRate ?? 5.5) / 100;
  const roiMonthly     = Math.round((investments * ROI_RATE) / 12);
  const totalMonthly   = surplus + roiMonthly;
  const monthsLeft     = totalMonthly > 0 ? Math.ceil(remaining / totalMonthly) : null;

  if (!target) {
    el.innerHTML = `
      <div class="no-goal-state">
        <div class="big-emoji">🎯</div>
        <h3>Set your savings goal</h3>
        <p>Head to <strong>Home Planning</strong> and enter a target house price — we'll calculate exactly how much cash you need and track your progress here.</p>
        <button class="btn btn-primary" id="goto-homeplan-btn">Set Up Home Plan</button>
      </div>`;
    document.getElementById('goto-homeplan-btn').addEventListener('click', () => {
      document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-fin="homeplan"]').classList.add('active');
      document.getElementById('fin-homeplan').classList.add('active');
    });
    return;
  }

  const timeStr = monthsLeft
    ? monthsLeft <= 1 ? '< 1 month away 🔥'
      : monthsLeft < 12 ? `${monthsLeft} months away`
      : `${Math.floor(monthsLeft/12)}y ${monthsLeft%12}m away`
    : 'Set your surplus to see';

  const milestones = [
    { pct: 25, emoji: '🌱', label: 'First step' },
    { pct: 50, emoji: '⚡', label: 'Halfway!'   },
    { pct: 75, emoji: '🔥', label: 'So close'   },
    { pct: 100, emoji: '🏆', label: 'Done!'     },
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
        <div class="roi-row"><span>💰 Monthly surplus</span><span>$${surplus.toLocaleString()}</span></div>
        <div class="roi-row">
          <span>📈 Investment return (${(ROI_RATE*100).toFixed(1)}% p.a. on $${investments.toLocaleString()})</span>
          <span style="color:var(--green)">+$${roiMonthly.toLocaleString()}/mo</span>
        </div>
        <div class="roi-row roi-total">
          <span>Total towards goal each month</span>
          <span style="color:var(--green)">$${totalMonthly.toLocaleString()}</span>
        </div>
      </div>` : ''}
    </div>

    <div class="milestones">${milestonesHtml}</div>

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

    <div class="card">
      <div class="section-title">Monthly History</div>
      <div id="history-list">${historyHtml}</div>
    </div>
  `;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = document.getElementById('goal-fill');
      if (fill) fill.style.width = pct + '%';
    }, 100);
  });

  document.getElementById('log-update-btn').addEventListener('click', logMonthlyUpdate);
  checkNewMilestone(pct);
}

function logMonthlyUpdate() {
  const saved = +document.getElementById('update-amount').value;
  const note  = document.getElementById('update-note').value.trim();
  if (!saved && saved !== 0) return;

  const f             = window.state.finance;
  const _lr  = (f.loans||[]).reduce((s,l) => s+(l.balance&&l.rate&&l.term?Math.round(calcRepayment(l.balance,l.rate,l.term)):0), 0);
  const _ls  = (f.loans||[]).reduce((s,l) => s+(l.strata||0), 0);
  const _lri = (f.loans||[]).reduce((s,l) => s+(l.rentalIncome||0), 0);
  const totalIncome   = (f.mitchIncome||0)+(f.samIncome||0)+_lri || f.income || 0;
  const totalExpenses = (f.expHomeLoan||0)+(f.expJoint||0)+(f.expMitch||0)+(f.expSam||0)+_lr+_ls || f.expenses || 0;
  const surplus       = Math.max(0, totalIncome - totalExpenses);
  const roiMonthly    = Math.round(((f.investments||0)*((f.roiRate??5.5)/100))/12);
  const totalMonthly  = surplus + roiMonthly;

  f.savings = (f.savings || 0) + saved;
  if (!f.history) f.history = [];
  const monthStr = new Date().toLocaleString('en-AU', { month: 'long', year: 'numeric' });
  f.history.push({ month: monthStr, saved, expected: totalMonthly, note });
  saveState();

  const banner        = document.getElementById('reaction-banner');
  const isCelebration = saved >= surplus;

  if (isCelebration) {
    const msg = CELEBRATE_MSGS[Math.floor(Math.random() * CELEBRATE_MSGS.length)];
    banner.className = 'reaction-banner celebrate';
    banner.innerHTML = `<div class="reaction-title">${msg.title}</div><div class="reaction-msg">${msg.msg}</div>`;
    launchConfetti();
    setTimeout(launchConfetti, 2200);
    setTimeout(launchConfetti, 5000);
  } else {
    const msg = SHAME_MSGS[Math.floor(Math.random() * SHAME_MSGS.length)];
    banner.className = 'reaction-banner shame';
    banner.innerHTML = `<div class="reaction-title">${msg.title}</div><div class="reaction-msg">${msg.msg}</div>`;
  }

  document.getElementById('update-amount').value = '';
  document.getElementById('update-note').value   = '';

  // Auto-fade after 11 seconds, then re-render
  clearTimeout(window._bannerTimer);
  window._bannerTimer = setTimeout(() => {
    const b = document.getElementById('reaction-banner');
    if (!b) return;
    b.style.transition = 'opacity 0.8s ease';
    b.style.opacity    = '0';
    setTimeout(() => renderSavingsGoal(), 900);
  }, 11000);
}

function checkNewMilestone(pct) {
  const f = window.state.finance;
  const prev = f.lastMilestonePct || 0;
  for (const m of [25, 50, 75, 100]) {
    if (pct >= m && prev < m) {
      f.lastMilestonePct = m;
      saveState();
      if (m === 100) setTimeout(() => { launchConfetti(); launchConfetti(); }, 200);
    }
  }
}

function launchConfetti() {
  const colours = ['#ffe000','#4caf78','#6aadff','#ff7730','#c084fc','#fff'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random()*100}vw; top:${Math.random()*-40}px;
      background:${colours[Math.floor(Math.random()*colours.length)]};
      width:${4+Math.random()*8}px; height:${4+Math.random()*8}px;
      animation-delay:${Math.random()*0.8}s;
      animation-duration:${1.8+Math.random()*1.2}s;`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ─────────────────────────────────────────────────────────
// HOME PLANNING TAB
// ─────────────────────────────────────────────────────────

function _renderAffordabilityTable(f, isAnnual) {
  const show  = v => isAnnual ? (Math.round((v||0)*12) || '') : ((v||0) || '');
  const fmt   = v => v > 0 ? '$' + Math.round(v).toLocaleString() : '—';
  const unit  = isAnnual ? '/yr' : '/mo';

  const mitchIncome = f.mitchIncome || 0;
  const samIncome   = f.samIncome   || 0;
  const empIncome   = mitchIncome + samIncome;
  const loanRental  = (f.loans||[]).reduce((s,l) => s + (l.rentalIncome||0), 0);
  const grossIncome = empIncome + loanRental;
  const loanRep     = (f.loans||[]).reduce((s,l) => l.balance&&l.rate&&l.term ? s+Math.round(calcRepayment(l.balance,l.rate,l.term)) : s, 0);
  const loanStrata  = (f.loans||[]).reduce((s,l) => s + (l.strata||0), 0);
  const totalExp    = (f.expHomeLoan||0) + (f.expJoint||0) + (f.expMitch||0) + (f.expSam||0);
  const totalOut    = loanRep + loanStrata + totalExp;
  const net         = grossIncome - totalOut;

  const loanRows = (f.loans||[]).map(loan => {
    const rep     = loan.balance && loan.rate && loan.term ? Math.round(calcRepayment(loan.balance, loan.rate, loan.term)) : 0;
    const netCost = rep + (loan.strata||0) - (loan.rentalIncome||0);
    return `
      <div class="afford-loan-row">
        <input class="loan-label-input afford-loan-label" data-id="${loan.id}" data-field="label"
               value="${loan.label||''}" placeholder="Property or loan name" />
        <div class="afford-loan-fields">
          <div class="afford-loan-field">
            <span class="alf-label">Balance $</span>
            <input type="number" class="loan-field afford-loan-input" data-id="${loan.id}" data-field="balance"
                   value="${loan.balance||''}" placeholder="500000" />
          </div>
          <div class="afford-loan-field">
            <span class="alf-label">Rate %</span>
            <input type="number" class="loan-field afford-loan-input" step="0.1" data-id="${loan.id}" data-field="rate"
                   value="${loan.rate||6.2}" />
          </div>
          <div class="afford-loan-field">
            <span class="alf-label">Years</span>
            <input type="number" class="loan-field afford-loan-input" data-id="${loan.id}" data-field="term"
                   value="${loan.term||30}" />
          </div>
          <div class="afford-loan-field">
            <span class="alf-label" style="color:var(--green)">Rental /mo</span>
            <input type="number" class="loan-field afford-loan-input" data-id="${loan.id}" data-field="rentalIncome"
                   value="${show(loan.rentalIncome)||''}" placeholder="0" />
          </div>
          <div class="afford-loan-field">
            <span class="alf-label" style="color:var(--orange)">Strata /mo</span>
            <input type="number" class="loan-field afford-loan-input" data-id="${loan.id}" data-field="strata"
                   value="${show(loan.strata)||''}" placeholder="0" />
          </div>
        </div>
        <div class="afford-loan-calc">
          ${rep > 0 ? `<span class="alc-rep">$${rep.toLocaleString()}/mo</span>
          <span class="alc-net ${netCost >= 0 ? 'expense' : 'income'}">net $${Math.abs(netCost).toLocaleString()}/mo ${netCost<0?'surplus':''}</span>`
          : '<span class="alc-empty">enter fields →</span>'}
        </div>
        <button class="loan-delete-btn" data-id="${loan.id}" title="Remove loan">×</button>
      </div>`;
  }).join('');

  return `
    <div class="card afford-card" style="margin-bottom:14px">
      <div class="hp-section-title">📊 Affordability</div>

      <div class="afford-group">
        <div class="afford-group-hdr income-hdr">Income</div>
        <div class="afford-row">
          <span class="afford-label">Mitch's take-home</span>
          <input type="number" id="hp-mitch-income" class="afford-input" value="${show(mitchIncome)}" placeholder="${isAnnual?'120000':'10000'}" />
          <span class="afford-value income-val" id="afford-mitch-val">${mitchIncome ? fmt(mitchIncome) : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
        <div class="afford-row">
          <span class="afford-label">Sam's take-home</span>
          <input type="number" id="hp-sam-income" class="afford-input" value="${show(samIncome)}" placeholder="${isAnnual?'80000':'6500'}" />
          <span class="afford-value income-val" id="afford-sam-val">${samIncome ? fmt(samIncome) : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
        <div class="afford-total-row">
          <span>Total Employment Income</span>
          <span class="income-val" id="afford-emp-total">${empIncome ? '$'+empIncome.toLocaleString() : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
      </div>

      <div class="afford-group">
        <div class="afford-group-hdr income-hdr">Rental Income</div>
        ${(f.loans||[]).filter(l => l.rentalIncome > 0).map(l => `
          <div class="afford-row afford-readonly-row">
            <span class="afford-label">${l.label || 'Investment property'}</span>
            <span></span>
            <span class="afford-value income-val">$${(l.rentalIncome||0).toLocaleString()}<span class="afford-unit">/mo</span></span>
          </div>`).join('') || `<div class="afford-row afford-readonly-row" style="color:var(--text-dim);font-size:12px"><span class="afford-label">No rental income — add loans below with rental income set</span></div>`}
        <div class="afford-total-row">
          <span>Total Rental Income</span>
          <span class="income-val" id="afford-rental-total">${loanRental ? '$'+loanRental.toLocaleString() : '—'}<span class="afford-unit">/mo</span></span>
        </div>
        <div class="afford-gross-row">
          <span>Gross Monthly Income</span>
          <span id="afford-gross-val">$${grossIncome.toLocaleString()}<span class="afford-unit">/mo</span></span>
        </div>
      </div>

      <div class="afford-group">
        <div class="afford-group-hdr expense-hdr">Mortgages &amp; Loans</div>
        ${loanRows || '<div style="font-size:12px;color:var(--text-dim);padding:8px 0">No loans added. Click below to add one.</div>'}
        <button class="btn add-loan-btn" id="add-loan-btn" style="margin:10px 0 6px">+ Add Loan</button>
        ${loanRep > 0 ? `<div class="afford-total-row">
          <span>Total Repayments</span>
          <span class="expense-val" id="afford-loan-total">−$${loanRep.toLocaleString()}<span class="afford-unit">/mo</span></span>
        </div>` : `<div class="afford-total-row"><span>Total Repayments</span><span class="expense-val" id="afford-loan-total">—</span></div>`}
        ${loanStrata > 0 ? `<div class="afford-row afford-readonly-row"><span class="afford-label">Strata / body corp (total)</span><span></span><span class="afford-value expense-val">−$${loanStrata.toLocaleString()}<span class="afford-unit">/mo</span></span></div>` : ''}
      </div>

      <div class="afford-group">
        <div class="afford-group-hdr expense-hdr">Expenses</div>
        <div class="afford-row">
          <span class="afford-label">Rent / current housing</span>
          <input type="number" id="hp-exp-homeloan" class="afford-input" value="${show(f.expHomeLoan)}" placeholder="${isAnnual?'48000':'4000'}" />
          <span class="afford-value expense-val">${f.expHomeLoan ? '−$'+Math.round(f.expHomeLoan).toLocaleString() : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
        <div class="afford-row">
          <span class="afford-label">Joint — food, bills, subscriptions</span>
          <input type="number" id="hp-exp-joint" class="afford-input" value="${show(f.expJoint)}" placeholder="${isAnnual?'36000':'3000'}" />
          <span class="afford-value expense-val">${f.expJoint ? '−$'+Math.round(f.expJoint).toLocaleString() : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
        <div class="afford-row">
          <span class="afford-label">Mitch's personal expenses</span>
          <input type="number" id="hp-exp-mitch" class="afford-input" value="${show(f.expMitch)}" placeholder="${isAnnual?'12000':'1000'}" />
          <span class="afford-value expense-val">${f.expMitch ? '−$'+Math.round(f.expMitch).toLocaleString() : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
        <div class="afford-row">
          <span class="afford-label">Sam's personal expenses</span>
          <input type="number" id="hp-exp-sam" class="afford-input" value="${show(f.expSam)}" placeholder="${isAnnual?'12000':'1000'}" />
          <span class="afford-value expense-val">${f.expSam ? '−$'+Math.round(f.expSam).toLocaleString() : '—'}<span class="afford-unit">${unit}</span></span>
        </div>
        <div class="afford-total-row">
          <span>Total Expenses</span>
          <span class="expense-val" id="afford-exp-total">−$${totalExp.toLocaleString()}<span class="afford-unit">${unit}</span></span>
        </div>
      </div>

      <div class="afford-net ${net >= 0 ? 'positive' : 'negative'}" id="afford-net-row">
        <span>Net Monthly Position</span>
        <span id="afford-net-val">${net >= 0 ? '+' : '−'}$${Math.abs(Math.round(net)).toLocaleString()}<span style="font-size:13px;font-weight:500;margin-left:4px">${net >= 0 ? 'surplus' : 'deficit'}</span></span>
      </div>
    </div>`;
}

function renderHomePlanningPanel() {
  const el = document.getElementById('fin-homeplan');
  if (!el) return;
  const f        = window.state.finance;
  const isAnnual = f.inputMode === 'annual';
  const show     = v => isAnnual ? (Math.round((v||0)*12) || '') : (v||'');
  const depPct   = f.propDepositPct || 20;
  const gr       = f.propGrowthRate || 3;
  const stateOpts = Object.keys(STAMP_DUTY).map(s =>
    `<option value="${s}" ${(f.propState||'NSW')===s?'selected':''}>${s}</option>`).join('');

  el.innerHTML = `
    <div class="homeplan-layout">

      <!-- ── Left: Inputs ── -->
      <div class="homeplan-form">

        <div class="input-mode-toggle">
          <button class="imt-btn ${!isAnnual?'active':''}" data-mode="monthly">Monthly</button>
          <button class="imt-btn ${isAnnual?'active':''}"  data-mode="annual">Annual</button>
        </div>

        ${_renderAffordabilityTable(f, isAnnual)}

        <div class="card" style="margin-bottom:14px">
          <div class="hp-section-title">💰 Savings & Investments</div>
          <div class="form-row">
            <div class="form-group">
              <label>Current savings ($)</label>
              <input type="number" id="hp-savings" value="${f.savings||''}" placeholder="150000" />
            </div>
            <div class="form-group">
              <label>Current investments ($)</label>
              <input type="number" id="hp-investments" value="${f.investments||''}" placeholder="Shares, ETFs…" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Investment growth rate (% p.a.)</label>
              <input type="number" id="hp-roi" step="0.5" value="${f.roiRate||5.5}" />
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:14px">
          <div class="hp-section-title">🏠 Target Property</div>
          <div class="form-row">
            <div class="form-group">
              <label>Target house price ($)</label>
              <input type="number" id="hp-prop-price" value="${f.propPrice||''}" placeholder="2000000" />
            </div>
            <div class="form-group">
              <label>State</label>
              <select id="hp-prop-state">${stateOpts}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Deposit target</label>
              <div class="toggle-group" id="hp-dep-toggle">
                <button class="toggle-btn ${depPct===20?'active':''}" data-val="20">20% (no LMI)</button>
                <button class="toggle-btn ${depPct===10?'active':''}" data-val="10">10% + LMI</button>
              </div>
            </div>
            <div class="form-group">
              <label>Expected property growth (% p.a.)</label>
              <div class="toggle-group" id="hp-growth-toggle">
                <button class="toggle-btn ${gr===0?'active':''}" data-val="0">0%</button>
                <button class="toggle-btn ${gr===3?'active':''}" data-val="3">3%</button>
                <button class="toggle-btn ${gr===5?'active':''}" data-val="5">5%</button>
                <button class="toggle-btn ${gr===7?'active':''}" data-val="7">7%</button>
              </div>
            </div>
          </div>
          <div id="hp-cost-breakdown"></div>
        </div>

        <div class="card" style="margin-bottom:14px">
          <div class="hp-section-title">🏦 Serviceability — After Purchase</div>
          <div class="form-row">
            <div class="form-group">
              <label>Mortgage interest rate (%)</label>
              <input type="number" id="hp-prop-rate" step="0.1" value="${f.propRate||6.2}" />
            </div>
            <div class="form-group">
              <label>Loan term (years)</label>
              <input type="number" id="hp-prop-term" value="${f.propTerm||30}" />
            </div>
          </div>
          <div id="hp-serviceability"></div>
        </div>

        <button class="btn btn-primary w-full" id="hp-save-btn">Save & Update</button>
        <p class="text-xs text-muted" style="margin-top:10px;line-height:1.6">Summary always shows monthly figures regardless of input mode. All estimates only — confirm with a mortgage broker.</p>
      </div>

      <!-- ── Right: Live Summary ── -->
      <div class="homeplan-summary">
        <div id="hp-summary"></div>
      </div>

    </div>
  `;

  _bindHomePlanEvents(el);
  _updateHomeLivePreview();
}

function _bindHomePlanEvents(el) {
  el.querySelectorAll('.imt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _autoSaveHomePlanInputs();
      window.state.finance.inputMode = btn.dataset.mode;
      saveState();
      renderHomePlanningPanel();
    });
  });

  el.querySelectorAll('#hp-dep-toggle .toggle-btn, #hp-growth-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.toggle-group').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _updateHomeLivePreview();
    });
  });

  let _debounce;
  el.addEventListener('input', e => {
    if (e.target.classList.contains('loan-field') || e.target.classList.contains('loan-label-input')) {
      const isAnnual = window.state.finance.inputMode === 'annual';
      saveLoanField(e.target.dataset.id, e.target.dataset.field, e.target.value, isAnnual);
    }
    clearTimeout(_debounce);
    _debounce = setTimeout(_updateHomeLivePreview, 200);
  });

  el.addEventListener('click', e => {
    if (e.target.closest('#add-loan-btn')) { _autoSaveHomePlanInputs(); addLoan(); return; }
    const del = e.target.closest('.loan-delete-btn');
    if (del) { _autoSaveHomePlanInputs(); deleteLoan(del.dataset.id); }
  });

  document.getElementById('hp-save-btn').addEventListener('click', saveHomePlanning);
}

function _readHomePlanInputs() {
  const isAnnual = document.querySelector('.imt-btn[data-mode="annual"]')?.classList.contains('active');
  const mo = id => { const v = +document.getElementById(id)?.value||0; return isAnnual ? Math.round(v/12) : v; };

  return {
    mitchIncome:    mo('hp-mitch-income'),
    samIncome:      mo('hp-sam-income'),
    savings:        +document.getElementById('hp-savings')?.value     || 0,
    investments:    +document.getElementById('hp-investments')?.value || 0,
    roiRate:        +document.getElementById('hp-roi')?.value          || 5.5,
    expHomeLoan:    mo('hp-exp-homeloan'),
    expJoint:       mo('hp-exp-joint'),
    expMitch:       mo('hp-exp-mitch'),
    expSam:         mo('hp-exp-sam'),
    propPrice:      +document.getElementById('hp-prop-price')?.value  || 0,
    propState:      document.getElementById('hp-prop-state')?.value   || 'NSW',
    propDepositPct: +(document.querySelector('#hp-dep-toggle .toggle-btn.active')?.dataset.val   || 20),
    propGrowthRate: +(document.querySelector('#hp-growth-toggle .toggle-btn.active')?.dataset.val || 3),
    propRate:       +document.getElementById('hp-prop-rate')?.value   || 6.2,
    propTerm:       +document.getElementById('hp-prop-term')?.value   || 30,
    loans:          window.state.finance.loans || [],
  };
}

function _autoSaveHomePlanInputs() {
  const d = _readHomePlanInputs();
  Object.assign(window.state.finance, d);
  window.state.finance.income   = d.mitchIncome + d.samIncome;
  window.state.finance.expenses = d.expHomeLoan + d.expJoint + d.expMitch + d.expSam;
  window.state.finance.target   = calcTotalCashNeeded(window.state.finance);
  saveState();
}

function _updateHomeLivePreview() {
  const d             = _readHomePlanInputs();
  const loanRepayments  = (d.loans||[]).reduce((s,l) => s+(l.balance&&l.rate&&l.term?Math.round(calcRepayment(l.balance,l.rate,l.term)):0), 0);
  const totalStrata     = (d.loans||[]).reduce((s,l) => s+(l.strata||0), 0);
  const totalRental     = (d.loans||[]).reduce((s,l) => s+(l.rentalIncome||0), 0);
  const totalIncome   = d.mitchIncome + d.samIncome + totalRental;
  const totalExpenses = d.expHomeLoan + d.expJoint + d.expMitch + d.expSam + loanRepayments + totalStrata;
  const surplus       = Math.max(0, totalIncome - totalExpenses);
  const roiMonthly    = Math.round((d.investments * d.roiRate / 100) / 12);
  const target        = calcTotalCashNeeded(d);

  // Live-update affordability table totals
  const grossIncome = d.mitchIncome + d.samIncome + totalRental;
  const totalOut    = loanRepayments + totalStrata + d.expHomeLoan + d.expJoint + d.expMitch + d.expSam;
  const netPos      = grossIncome - totalOut;

  const setEl = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
  const unit  = window.state.finance.inputMode === 'annual' ? '/yr' : '/mo';
  setEl('afford-emp-total',   grossIncome > 0 ? `$${(d.mitchIncome+d.samIncome).toLocaleString()}<span class="afford-unit">${unit}</span>` : '—');
  setEl('afford-rental-total', totalRental > 0 ? `$${totalRental.toLocaleString()}<span class="afford-unit">/mo</span>` : '—');
  setEl('afford-gross-val',   grossIncome > 0 ? `$${grossIncome.toLocaleString()}<span class="afford-unit">/mo</span>` : '—');
  setEl('afford-loan-total',  loanRepayments > 0 ? `−$${loanRepayments.toLocaleString()}<span class="afford-unit">/mo</span>` : '—');
  setEl('afford-exp-total',   `−$${(d.expHomeLoan+d.expJoint+d.expMitch+d.expSam).toLocaleString()}<span class="afford-unit">${unit}</span>`);
  setEl('afford-net-val',     `${netPos>=0?'+':'−'}$${Math.abs(Math.round(netPos)).toLocaleString()}<span style="font-size:13px;font-weight:500;margin-left:4px">${netPos>=0?'surplus':'deficit'}</span>`);
  const netRow = document.getElementById('afford-net-row');
  if (netRow) { netRow.className = 'afford-net ' + (netPos >= 0 ? 'positive' : 'negative'); }

  // Cost breakdown panel
  if (d.propPrice > 0) {
    const deposit = Math.round(d.propPrice * d.propDepositPct / 100);
    const stamp   = calcStampDuty(d.propPrice, d.propState);
    const lmi     = d.propDepositPct < 20 ? Math.round((d.propPrice - deposit) * 0.02) : 0;
    const el = document.getElementById('hp-cost-breakdown');
    if (el) el.innerHTML = `
      <div class="hp-cost-box">
        <div class="hp-cb-row"><span>Deposit (${d.propDepositPct}%)</span><span>$${deposit.toLocaleString()}</span></div>
        <div class="hp-cb-row"><span>Stamp duty (${d.propState})</span><span>$${stamp.toLocaleString()}</span></div>
        ${lmi ? `<div class="hp-cb-row"><span>LMI (est. &lt;20% deposit)</span><span>$${lmi.toLocaleString()}</span></div>` : ''}
        <div class="hp-cb-row"><span>Conveyancing (est.)</span><span>$2,000</span></div>
        <div class="hp-cb-row"><span>Building inspection (est.)</span><span>$600</span></div>
        <div class="hp-cb-row hp-cb-total"><span>Total cash required</span><span>$${target.toLocaleString()}</span></div>
        <div class="hp-cb-note">↑ This is your savings target on the Savings Goal tab</div>
      </div>`;
  } else {
    const el = document.getElementById('hp-cost-breakdown');
    if (el) el.innerHTML = '';
  }

  // Serviceability panel
  if (d.propPrice > 0 && totalIncome > 0) {
    const deposit     = Math.round(d.propPrice * d.propDepositPct / 100);
    const loanAmt     = d.propPrice - deposit;
    const monthly     = Math.round(calcRepayment(loanAmt, d.propRate, d.propTerm));
    const testMonthly = Math.round(calcRepayment(loanAmt, d.propRate + 3, d.propTerm));
    const testExisting= (d.loans||[]).reduce((s,l) => s+(l.balance&&l.rate&&l.term?Math.round(calcRepayment(l.balance,l.rate+3,l.term)):0), 0);
    const expAfterBuy = d.expJoint + d.expMitch + d.expSam + monthly + loanRepayments + totalStrata;
    const afterSurp   = totalIncome - expAfterBuy;
    const canService  = (testMonthly + testExisting) <= totalIncome * 0.4;
    const existingLoansHtml = (d.loans||[]).filter(l=>l.balance&&l.rate&&l.term).map(l => {
      const rep = Math.round(calcRepayment(l.balance, l.rate, l.term));
      return `<div class="hp-sr-row"><span>${l.label||'Existing loan'}</span><span>−$${rep.toLocaleString()}</span></div>`;
    }).join('');
    const svcEl = document.getElementById('hp-serviceability');
    if (svcEl) svcEl.innerHTML = `
      <div class="hp-service ${canService?'hp-service-ok':'hp-service-risk'}">
        <div class="hp-service-title">${canService ? '✓ Looks serviceable' : '⚠ May be tight'}</div>
        <div class="hp-sr-row"><span>Combined income (incl. rental)</span><span>$${totalIncome.toLocaleString()}</span></div>
        <div class="hp-sr-row"><span>New mortgage (P&I, ${d.propRate}%)</span><span>−$${monthly.toLocaleString()}</span></div>
        ${existingLoansHtml}
        ${totalStrata > 0 ? `<div class="hp-sr-row"><span>Strata / body corp</span><span>−$${totalStrata.toLocaleString()}</span></div>` : ''}
        <div class="hp-sr-row"><span>Joint + personal expenses</span><span>−$${(d.expJoint+d.expMitch+d.expSam).toLocaleString()}</span></div>
        <div class="hp-sr-row hp-sr-result ${afterSurp>=0?'positive':'negative'}">
          <span>Monthly surplus after purchase</span>
          <span>${afterSurp>=0?'+':''}$${Math.round(afterSurp).toLocaleString()}</span>
        </div>
        <div class="hp-sr-note">Buffer-rate test (all loans +3%): $${(testMonthly+testExisting).toLocaleString()}/mo vs 40% income cap $${Math.round(totalIncome*0.4).toLocaleString()}/mo</div>
      </div>`;
  } else {
    const svcEl = document.getElementById('hp-serviceability');
    if (svcEl) svcEl.innerHTML = '';
  }

  const sim        = runTimelineSimulation({ ...d });
  const summaryEl  = document.getElementById('hp-summary');
  if (summaryEl) summaryEl.innerHTML = _buildHomePlanSummaryHTML({
    ...d, totalIncome, totalExpenses, surplus, roiMonthly, target, sim,
    currentSavings: d.savings, loanRepayments, totalStrata, totalRental,
    netMonthly: totalIncome - totalExpenses,
  });
}

function _buildHomePlanSummaryHTML(d) {
  const { totalIncome, totalExpenses, surplus, roiMonthly, target, sim, currentSavings,
          mitchIncome, samIncome, expHomeLoan, expJoint, expMitch, expSam,
          investments, roiRate, propGrowthRate, loans, netMonthly,
          loanRepayments, totalStrata, totalRental } = d;

  // Recompute net from raw values to guarantee correctness
  const _loanReps   = (loans||[]).filter(l=>l.balance&&l.rate&&l.term)
                        .reduce((s,l) => s + Math.round(calcRepayment(l.balance, l.rate, l.term)), 0);
  const _strata     = (loans||[]).reduce((s,l) => s + (l.strata||0), 0);
  const _rental     = (loans||[]).reduce((s,l) => s + (l.rentalIncome||0), 0);
  const _grossIn    = (mitchIncome||0) + (samIncome||0) + _rental;
  const _grossOut   = (expHomeLoan||0) + (expJoint||0) + (expMitch||0) + (expSam||0) + _loanReps + _strata;
  const net         = _grossIn - _grossOut;

  const totalMonthly = Math.max(0, net) + (roiMonthly || 0);
  const remaining    = Math.max(0, target - currentSavings);
  const pct          = target > 0 ? Math.min(100, Math.round(currentSavings / target * 100)) : 0;

  if (!totalIncome && !totalExpenses && !target) return `
    <div class="hp-empty-state">
      <div style="font-size:40px;margin-bottom:12px">📊</div>
      <h3>Your summary will appear here</h3>
      <p>Fill in income, expenses, and a target house price to see your monthly cash flow and timeline.</p>
    </div>`;

  let timelineHtml = '';
  if (sim && sim.months !== null && target > 0) {
    const yrs    = Math.floor(sim.months / 12);
    const mos    = sim.months % 12;
    const yrsStr = yrs > 0 ? `${yrs} yr${yrs>1?'s':''} ${mos > 0 ? `${mos} mo` : ''}`.trim() : `${mos} months`;
    const dateStr = sim.readyDate.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
    timelineHtml = `
      <div class="hp-timeline-box">
        <div class="hp-tl-label">At current rate, ready to buy in</div>
        <div class="hp-tl-value">${yrsStr}</div>
        <div class="hp-tl-date">Est. ready: ${dateStr}</div>
        ${propGrowthRate > 0 ? `<div class="hp-tl-note">Property growing at ${propGrowthRate}% p.a. — target increases over time</div>` : ''}
      </div>`;
  } else if (target > 0 && currentSavings >= target) {
    timelineHtml = `<div class="hp-timeline-box hp-tl-done"><div class="hp-tl-label">🏆 Goal reached! Ready to buy.</div></div>`;
  }

  const mortgageTotal  = _loanReps + _strata;
  const expensesTotal  = (expHomeLoan||0) + (expJoint||0) + (expMitch||0) + (expSam||0);
  const maxBar         = Math.max(_grossIn, _grossOut, 1);
  const incomeBarW     = Math.round(_grossIn  / maxBar * 100);
  const outBarW        = Math.round(_grossOut / maxBar * 100);
  const mortPct        = _grossOut > 0 ? Math.round(mortgageTotal / _grossOut * 100) : 0;
  const expPct         = _grossOut > 0 ? Math.round(expensesTotal / _grossOut * 100) : 0;

  return `
    <div class="summary-panel">
      <div class="summary-panel-title">Monthly Summary</div>

      <div class="sp-compare">
        <div class="sp-cmp-row">
          <span class="sp-cmp-label">Income</span>
          <div class="sp-cmp-track"><div class="sp-cmp-fill income-fill" style="width:${incomeBarW}%"></div></div>
          <span class="sp-cmp-val income-val">$${_grossIn.toLocaleString()}</span>
        </div>
        <div class="sp-cmp-row">
          <span class="sp-cmp-label">Outgoings</span>
          <div class="sp-cmp-track"><div class="sp-cmp-fill expense-fill" style="width:${outBarW}%"></div></div>
          <span class="sp-cmp-val expense-val">$${_grossOut.toLocaleString()}</span>
        </div>
      </div>

      ${(mortgageTotal > 0 || expensesTotal > 0) ? `
      <div class="sp-bk-block">
        <div class="sp-bk-title">Outgoings breakdown</div>
        ${mortgageTotal > 0 ? `
        <div class="sp-bk-row">
          <div class="sp-bk-bar mortgage-bar" style="width:${mortPct}%"></div>
          <span class="sp-bk-label">Mortgages</span>
          <span class="sp-bk-right"><span class="sp-bk-pct">${mortPct}%</span> · $${mortgageTotal.toLocaleString()}</span>
        </div>` : ''}
        ${expensesTotal > 0 ? `
        <div class="sp-bk-row">
          <div class="sp-bk-bar expense-bar" style="width:${expPct}%"></div>
          <span class="sp-bk-label">Expenses</span>
          <span class="sp-bk-right"><span class="sp-bk-pct">${expPct}%</span> · $${expensesTotal.toLocaleString()}</span>
        </div>` : ''}
      </div>` : ''}

      <div class="sp-section">
        <div class="sp-row"><span class="sp-row-label">Mitch's income</span><span class="sp-row-val" style="color:var(--green)">$${(mitchIncome||0).toLocaleString()}</span></div>
        <div class="sp-row"><span class="sp-row-label">Sam's income</span><span class="sp-row-val" style="color:var(--green)">$${(samIncome||0).toLocaleString()}</span></div>
        ${(totalRental||0)>0?`<div class="sp-row"><span class="sp-row-label">Rental income</span><span class="sp-row-val" style="color:var(--green)">+$${totalRental.toLocaleString()}</span></div>`:''}
        <div class="sp-total-row"><span>Total income</span><span style="color:var(--green)">$${totalIncome.toLocaleString()}/mo</span></div>
      </div>

      <div class="sp-section">
        ${(expHomeLoan||0)>0?`<div class="sp-row"><span class="sp-row-label">Rent / other housing</span><span class="sp-row-val" style="color:var(--orange)">−$${expHomeLoan.toLocaleString()}</span></div>`:''}
        ${(loans||[]).filter(l=>l.balance&&l.rate&&l.term).map(l=>{
          const rep=Math.round(calcRepayment(l.balance,l.rate,l.term));
          return `<div class="sp-row"><span class="sp-row-label">${l.label||'Loan'}</span><span class="sp-row-val" style="color:var(--orange)">−$${rep.toLocaleString()}</span></div>`;
        }).join('')}
        ${(totalStrata||0)>0?`<div class="sp-row"><span class="sp-row-label">Strata / body corp</span><span class="sp-row-val" style="color:var(--orange)">−$${totalStrata.toLocaleString()}</span></div>`:''}
        <div class="sp-row"><span class="sp-row-label">Joint expenses</span><span class="sp-row-val" style="color:var(--orange)">−$${(expJoint||0).toLocaleString()}</span></div>
        <div class="sp-row"><span class="sp-row-label">Mitch personal</span><span class="sp-row-val" style="color:var(--orange)">−$${(expMitch||0).toLocaleString()}</span></div>
        <div class="sp-row"><span class="sp-row-label">Sam personal</span><span class="sp-row-val" style="color:var(--orange)">−$${(expSam||0).toLocaleString()}</span></div>
        <div class="sp-total-row"><span>Total expenses</span><span style="color:var(--orange)">−$${totalExpenses.toLocaleString()}/mo</span></div>
      </div>

      <div class="sp-net-label">Net Monthly Income</div>
      <div class="sp-surplus-big ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : '−'}$${Math.abs(Math.round(net)).toLocaleString()}</div>
      <div class="sp-surplus-label">${net >= 0 ? 'surplus — you\'re ahead' : 'deficit — outgoings exceed income'}</div>

      ${roiMonthly > 0 ? `
      <div class="sp-section">
        <div class="sp-row"><span class="sp-row-label">📈 Investment returns (${roiRate||5.5}% p.a.)</span><span class="sp-row-val" style="color:var(--green)">+$${roiMonthly.toLocaleString()}/mo</span></div>
        <div class="sp-total-row"><span>Total toward goal /mo</span><span style="color:var(--blue)">$${totalMonthly.toLocaleString()}</span></div>
      </div>` : ''}

      ${target > 0 ? `
      <div class="sp-section">
        <div class="sp-row"><span class="sp-row-label">Cash target</span><span class="sp-row-val">$${target.toLocaleString()}</span></div>
        <div class="sp-row"><span class="sp-row-label">Saved so far</span><span class="sp-row-val" style="color:var(--green)">$${currentSavings.toLocaleString()}</span></div>
        <div class="sp-row"><span class="sp-row-label">Still needed</span><span class="sp-row-val" style="color:var(--orange)">$${remaining.toLocaleString()}</span></div>
        <div class="hp-prog-track"><div class="hp-prog-fill" style="width:${pct}%"></div></div>
        <div class="hp-prog-lbl">${pct}% of target saved</div>
      </div>
      ${timelineHtml}` : ''}
    </div>
  `;
}

function saveHomePlanning() {
  _autoSaveHomePlanInputs();
  const btn = document.getElementById('hp-save-btn');
  if (btn) {
    btn.textContent = 'Saved ✓';
    btn.style.background = 'var(--green)';
    setTimeout(() => { btn.textContent = 'Save & Update'; btn.style.background = ''; }, 2000);
  }
  renderSavingsGoal();
}

// ─────────────────────────────────────────────────────────
// LOAN MANAGEMENT
// ─────────────────────────────────────────────────────────

function addLoan() {
  const f = window.state.finance;
  if (!Array.isArray(f.loans)) f.loans = [];
  f.loans.push({ id: String(Date.now()), label: '', balance: 0, rate: 6.2, term: 30, rentalIncome: 0, strata: 0 });
  saveState();
  renderHomePlanningPanel();
}

function deleteLoan(id) {
  const f = window.state.finance;
  f.loans = (f.loans || []).filter(l => String(l.id) !== String(id));
  saveState();
  renderHomePlanningPanel();
}

function saveLoanField(id, field, value, isAnnual) {
  const f    = window.state.finance;
  const loan = (f.loans || []).find(l => String(l.id) === String(id));
  if (!loan) return;
  if (field === 'label') {
    loan.label = value;
  } else if (['rentalIncome', 'strata'].includes(field)) {
    loan[field] = isAnnual ? Math.round((+value || 0) / 12) : (+value || 0);
  } else {
    loan[field] = +value || 0;
  }
  saveState();
}

function _renderLoansSection(loans, isAnnual) {
  const show = v => isAnnual ? (Math.round((v||0)*12)||'') : ((v||0)||'');

  const loanCards = (loans || []).map(loan => {
    const rep = loan.balance && loan.rate && loan.term
      ? Math.round(calcRepayment(loan.balance, loan.rate, loan.term)) : 0;
    const netCost = rep + (loan.strata||0) - (loan.rentalIncome||0);
    const calcRow = rep > 0 ? `
      <div class="loan-calc-row">
        <span>Repayment <strong>$${rep.toLocaleString()}/mo</strong></span>
        ${(loan.strata||0)>0 ? `<span style="color:var(--orange)">+ strata $${loan.strata.toLocaleString()}</span>` : ''}
        ${(loan.rentalIncome||0)>0 ? `<span style="color:var(--green)">− rental $${loan.rentalIncome.toLocaleString()}</span>` : ''}
        <span class="${netCost>=0?'':'loan-calc-positive'}">Net <strong>$${netCost.toLocaleString()}/mo</strong></span>
      </div>` : '';

    return `
      <div class="loan-card">
        <div class="loan-card-header">
          <input class="loan-label-input" type="text" value="${loan.label||''}" placeholder="e.g. Investment Property — Parramatta" data-field="label" data-id="${loan.id}" />
          <button class="loan-delete-btn" data-id="${loan.id}" title="Remove">✕</button>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Balance outstanding ($)</label>
            <input type="number" class="loan-field" data-field="balance" data-id="${loan.id}" value="${loan.balance||''}" placeholder="450000" />
          </div>
          <div class="form-group">
            <label>Interest rate (%)</label>
            <input type="number" step="0.1" class="loan-field" data-field="rate" data-id="${loan.id}" value="${loan.rate||6.2}" />
          </div>
          <div class="form-group">
            <label>Years remaining</label>
            <input type="number" class="loan-field" data-field="term" data-id="${loan.id}" value="${loan.term||30}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Rental income (${isAnnual?'annual':'monthly'}, if any)</label>
            <input type="number" class="loan-field" data-field="rentalIncome" data-id="${loan.id}" value="${show(loan.rentalIncome)}" placeholder="0" />
          </div>
          <div class="form-group">
            <label>Strata / body corp (${isAnnual?'annual':'monthly'}, if any)</label>
            <input type="number" class="loan-field" data-field="strata" data-id="${loan.id}" value="${show(loan.strata)}" placeholder="0" />
          </div>
        </div>
        ${calcRow}
      </div>`;
  }).join('');

  return `
    <div class="loans-list">${loanCards}</div>
    <button class="btn w-full add-loan-btn" id="add-loan-btn">+ Add Loan</button>`;
}

// ─────────────────────────────────────────────────────────
// 2027 AREAS TAB
// ─────────────────────────────────────────────────────────

const AREAS_2027 = {
  'Inner West': {
    icon: '🏘️', color: 'var(--orange)',
    suburbs: 'Newtown · Leichhardt · Balmain · Marrickville · Dulwich Hill',
    house2: 1550000, house3: 1950000, town2: 1100000, town3: 1350000,
    source: 'Domain/CoreLogic median estimates, May 2025',
  },
  'Lower North Shore': {
    icon: '🌊', color: 'var(--blue)',
    suburbs: 'Mosman · Neutral Bay · Cremorne · Kirribilli · Waverton',
    house2: 2600000, house3: 3300000, town2: 1550000, town3: 1800000,
    source: 'Domain/CoreLogic median estimates, May 2025',
  },
  'North Shore': {
    icon: '🌳', color: 'var(--green)',
    suburbs: 'Chatswood · Lane Cove · Willoughby · Lindfield · Pymble',
    house2: 1800000, house3: 2350000, town2: 1250000, town3: 1550000,
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
            <label>Which areas?</label>
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
            Price estimates based on CoreLogic/Domain median data, May 2025. Check
            <a href="https://www.domain.com.au" target="_blank" style="color:var(--blue)">Domain</a> or
            <a href="https://www.realestate.com.au" target="_blank" style="color:var(--blue)">REA</a> for live listings.
          </p>
        </div>
      </div>
      <div class="plan2027-results" id="plan2027-results">${render2027Results(p)}</div>
    </div>
  `;
}

function savePlan2027() {
  const p = window.state.plan2027;
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
  const res = document.getElementById('plan2027-results');
  if (res) res.innerHTML = render2027Results(p);
  const btn = document.getElementById('save-plan2027-btn');
  btn.textContent = 'Updated ✓'; btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = 'Update Plan'; btn.style.background = ''; }, 2000);
}

function renderSavingsTimelineCard(p) {
  const currentSavings = p.propSavings || 0;
  const monthlyAdd     = p.monthlyAdd  || 0;
  if (!monthlyAdd && !currentSavings) return '';

  const allPrices    = Object.values(AREAS_2027).flatMap(a => [a.house3, a.town3]);
  const cheapest     = Math.min(...allPrices);
  const depPct       = +(p.depositPct || 20) / 100;
  const growthRate   = +(p.growthRate  || 3)  / 100;
  const cheapestArea = Object.entries(AREAS_2027).find(([,a]) => a.house3 === cheapest || a.town3 === cheapest)?.[0] || '';

  let months = 0, savings = currentSavings, price = cheapest;
  const MAX  = 360;
  while (months < MAX) {
    const dep    = Math.round(price * depPct);
    const stamp  = calcStampDuty(Math.round(price), 'NSW');
    const lmi    = depPct < 0.2 ? Math.round((price - dep) * 0.02) : 0;
    if (savings >= dep + stamp + lmi + 8000) break;
    months++;
    savings += monthlyAdd;
    price = cheapest * Math.pow(1 + growthRate, months / 12);
  }

  const readyDate = new Date();
  readyDate.setMonth(readyDate.getMonth() + months);
  const yrs    = Math.floor(months / 12), mos = months % 12;
  const timeStr = months >= MAX ? 'over 30 years — consider increasing savings'
    : yrs > 0 ? `${yrs} year${yrs>1?'s':''} ${mos > 0 ? mos+' months' : ''}`.trim()
    : `${mos} months`;
  const dateStr = readyDate.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

  return `
    <div class="savings-timeline-card">
      <div class="stc-icon">📅</div>
      <div class="stc-body">
        <div class="stc-headline">At <strong>$${monthlyAdd.toLocaleString()}/mo</strong>, ready to buy in <strong>${timeStr}</strong></div>
        <div class="stc-sub">Est. ready: ${dateStr} · Cheapest option (${cheapestArea}) · ${p.growthRate||3}% annual growth assumed</div>
      </div>
    </div>`;
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

  if (!currentSavings && !monthlyAdd) return `
    <div class="plan2027-empty">
      <div style="font-size:48px;margin-bottom:12px">🏡</div>
      <h3>Fill in your details</h3>
      <p>Complete the form on the left and click <strong>Update Plan</strong> to see how achievable your 2027 property goal is.</p>
    </div>`;

  const areas = areasPref === 'all'
    ? Object.entries(AREAS_2027)
    : Object.entries(AREAS_2027).filter(([name]) => name === areasPref);

  const areaCards = areas.map(([areaName, area]) => {
    let basePrice;
    if (bedrooms === '2')      basePrice = propType==='town' ? area.town2 : propType==='house' ? area.house2 : Math.min(area.house2, area.town2);
    else if (bedrooms === '3') basePrice = propType==='town' ? area.town3 : propType==='house' ? area.house3 : Math.min(area.house3, area.town3);
    else                       basePrice = propType==='town' ? area.town3 : propType==='house' ? area.house3 : Math.min(area.house3, area.town3);

    const priceLabel = `${bedrooms==='either'?'2-3':bedrooms} bed ${propType==='either'?'house/townhouse':propType==='town'?'townhouse':'house'}`;

    let months = 0, savings = currentSavings, price = basePrice;
    const MAX_MONTHS = 360;
    while (months < MAX_MONTHS) {
      const deposit    = Math.round(price * depositPct);
      const stampDuty  = calcStampDuty(price, 'NSW');
      const lmi        = depositPct < 0.2 ? Math.round((price - deposit) * 0.02) : 0;
      if (savings >= deposit + stampDuty + lmi + 8000) break;
      months++;
      savings += monthlyAdd;
      price = basePrice * Math.pow(1 + growthRate, months / 12);
    }

    const finalPrice   = basePrice * Math.pow(1 + growthRate, months / 12);
    const finalDeposit = Math.round(finalPrice * depositPct);
    const finalStamp   = calcStampDuty(Math.round(finalPrice), 'NSW');
    const finalLMI     = depositPct < 0.2 ? Math.round((finalPrice - finalDeposit) * 0.02) : 0;
    const finalOther   = 8000;
    const finalTotal   = finalDeposit + finalStamp + finalLMI + finalOther;
    const stillNeeded  = Math.max(0, finalTotal - currentSavings);

    const readyDate    = new Date();
    readyDate.setMonth(readyDate.getMonth() + months);
    const by2027       = readyDate <= deadline2027;
    const monthsTo2027 = Math.round((deadline2027 - new Date()) / (1000 * 60 * 60 * 24 * 30.4));
    const readyMonthStr = readyDate.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

    const nowDeposit  = Math.round(basePrice * depositPct);
    const nowStamp    = calcStampDuty(basePrice, 'NSW');
    const nowLMI      = depositPct < 0.2 ? Math.round((basePrice - nowDeposit) * 0.02) : 0;
    const nowTotal    = nowDeposit + nowStamp + nowLMI + 8000;
    const pct         = Math.min(100, Math.round((currentSavings / nowTotal) * 100));

    let serviceHtml = '';
    if (income) {
      const loanNeeded = Math.round(finalPrice - finalDeposit);
      const repayment  = Math.round(calcRepayment(loanNeeded, 9.5, 30));
      const maxRepay   = Math.round((income / 12) * 0.35);
      const canService = repayment <= maxRepay;
      serviceHtml = `
        <div class="plan-service ${canService ? 'ok' : 'tight'}">
          ${canService
            ? `✓ Serviceability looks OK — test repayment ~$${repayment.toLocaleString()}/mo is within 35% of income`
            : `⚠ May be tight — test repayment ~$${repayment.toLocaleString()}/mo exceeds 35% of income ($${maxRepay.toLocaleString()}/mo). A broker can advise.`}
        </div>`;
    }

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

        <div class="area-breakdown">
          <div class="abd-row"><span>Deposit (${depositPct * 100}%)</span><span>$${finalDeposit.toLocaleString()}</span></div>
          <div class="abd-row"><span>NSW Stamp Duty</span><span>$${finalStamp.toLocaleString()}</span></div>
          ${finalLMI ? `<div class="abd-row"><span>LMI (est.)</span><span>$${finalLMI.toLocaleString()}</span></div>` : ''}
          <div class="abd-row"><span>Conveyancing + Inspection</span><span>$${finalOther.toLocaleString()}</span></div>
          <div class="abd-row abd-total"><span>Total required</span><span>$${finalTotal.toLocaleString()}</span></div>
        </div>

        <div class="area-progress">
          <div class="area-progress-label">
            <span>Your current savings</span>
            <span style="color:${pct>=100?'var(--green)':'var(--text-muted)'}">${pct}% of today's target</span>
          </div>
          <div class="progress-track" style="height:8px">
            <div class="progress-fill progress-green" style="width:${pct}%"></div>
          </div>
          <div class="area-progress-sub">$${currentSavings.toLocaleString()} saved · $${stillNeeded.toLocaleString()} still needed</div>
        </div>

        <div class="area-timeline">
          <div class="timeline-label">
            <span>Now</span>
            <span>${by2027 ? '🎯 Ready: '+readyMonthStr : '📅 Ready: '+readyMonthStr}</span>
            <span>Dec 2027</span>
          </div>
          <div class="timeline-track">
            <div class="timeline-fill ${by2027 ? 'tl-green' : 'tl-orange'}" style="width:${Math.min(100, Math.round(progressFrac*100))}%"></div>
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

  return renderSavingsTimelineCard(p) + areaCards;
}

// Toggle buttons (shared)
document.addEventListener('click', e => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  const group = btn.closest('.toggle-group');
  if (!group) return;
  group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});
