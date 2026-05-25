// ── Persistent Data Store ──
const DB = {
  _key: 'mitchDashboard',

  defaults: {
    tasks: [],
    shopping: [],
    householdMembers: [],
    events: [],
    finance: {
      goalName: '', target: 0, history: [], lastMilestonePct: 0,
      inputMode: 'monthly',
      mitchIncome: 0, samIncome: 0,
      savings: 0, investments: 0, roiRate: 5.5,
      expHomeLoan: 0, expJoint: 0, expMitch: 0, expSam: 0,
      loans: [],
      propPrice: 0, propDepositPct: 20, propRate: 6.2, propTerm: 30,
      propState: 'NSW', propGrowthRate: 3,
      // legacy
      income: 0, expenses: 0, savingsGoal: 0, purchaseGoals: [], properties: [],
    },
    pantry: [],
    exercise: {
      Sam:  { log: [] },
      Mitch: { log: [] },
    },
    calendarColors: {
      work: '#6aadff', personal: '#ff7730', finance: '#4caf78',
      family: '#c084fc', health: '#f472b6', social: '#facc15',
    },
    work: {
      daily:      [],
      longterm:   [],
      onboarding: [],
      panel:      [],
      personal:   [],
      reminders:  [],
      onboardees: [],
    },
  },

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? { ...this.defaults, ...JSON.parse(raw) } : { ...this.defaults };
    } catch { return { ...this.defaults }; }
  },

  save(data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  },
};

// Global state — everything reads/writes here
window.state = DB.load();

function saveState() { DB.save(window.state); }
