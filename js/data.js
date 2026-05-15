// ── Persistent Data Store ──
const DB = {
  _key: 'mitchDashboard',

  defaults: {
    tasks: [
      { id: 1, text: 'Review monthly budget', done: false, priority: 'high',  month: new Date().getMonth() },
      { id: 2, text: 'Book dentist appointment', done: false, priority: 'med', month: new Date().getMonth() },
      { id: 3, text: 'Plan weekend meals', done: false, priority: 'low',  month: new Date().getMonth() },
      { id: 4, text: 'Call insurance provider', done: false, priority: 'high', month: new Date().getMonth() },
      { id: 5, text: 'Update investment tracker', done: false, priority: 'med', month: new Date().getMonth() },
    ],
    events: [],
    finance: {
      income: 0, expenses: 0, savings: 0, investments: 0,
      savingsGoal: 0, purchaseGoals: [],
      properties: [],
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
