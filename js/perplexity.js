// ── Perplexity Ideas ──
const IDEAS = [
  {
    id: 1, icon: '🌤️', tag: 'blue', category: 'Daily Life',
    title: 'Morning Brief',
    desc: 'A daily summary card that appears each morning: weather, top tasks, calendar events, and one motivating thought — all in one glance before your day starts.',
  },
  {
    id: 2, icon: '💧', tag: 'blue', category: 'Health',
    title: 'Hydration Tracker',
    desc: 'Log your water intake throughout the day with a simple tap. Set a daily goal and get a gentle visual nudge when you\'re behind. Pairs with the exercise tab.',
  },
  {
    id: 3, icon: '💸', tag: 'green', category: 'Finance',
    title: 'Quick Expense Logger',
    desc: 'One-tap expense entry with categories (food, fuel, entertainment). See your spending clearly at a glance without needing a separate app.',
  },
  {
    id: 4, icon: '🛒', tag: 'orange', category: 'Home',
    title: 'Smart Shopping List',
    desc: 'Based on your pantry items and chosen recipes, automatically suggest what you need to buy. Tick off as you shop, and your pantry updates itself.',
  },
  {
    id: 5, icon: '😴', tag: 'blue', category: 'Health',
    title: 'Sleep Log',
    desc: 'Track your sleep hours each night with a quick entry. See trends weekly and monthly. Link poor sleep to low-exercise days to spot patterns.',
  },
  {
    id: 6, icon: '🎯', tag: 'orange', category: 'Goals',
    title: 'Focus Timer (Pomodoro)',
    desc: 'Built-in 25-minute focus sessions. Pick a task, start the timer, and stay in the zone. After four sessions, you get a longer break nudge.',
  },
  {
    id: 7, icon: '🏡', tag: 'green', category: 'Property',
    title: 'Suburb Research Tool',
    desc: 'Enter a suburb and get a snapshot: median price trends, rental yield, growth history. Helps you shortlist properties faster without opening 10 tabs.',
  },
  {
    id: 8, icon: '📊', tag: 'green', category: 'Finance',
    title: 'Net Worth Tracker',
    desc: 'Combine your savings, investments, property equity, and subtract debts to see your total net worth. Update monthly and watch it grow over time.',
  },
  {
    id: 9, icon: '🧘', tag: 'blue', category: 'Wellbeing',
    title: 'Daily Mood Check-In',
    desc: 'A quick 5-second mood rating at the end of each day. Over time, see which weeks felt best and what habits were linked to your best days.',
  },
  {
    id: 10, icon: '📦', tag: 'orange', category: 'Home',
    title: 'Home Maintenance Log',
    desc: 'Track when you last serviced the car, cleaned the gutters, or replaced filters. Get reminders so nothing gets forgotten until it becomes expensive.',
  },
  {
    id: 11, icon: '💬', tag: 'blue', category: 'Relationships',
    title: 'Stay in Touch Reminders',
    desc: 'Add people you want to stay connected with and how often you\'d like to check in. A gentle nudge appears when it\'s been a while since you caught up.',
  },
  {
    id: 12, icon: '📚', tag: 'orange', category: 'Growth',
    title: 'Reading & Learning Log',
    desc: 'Track books you\'re reading, podcasts you\'ve listened to, and things you\'ve learned. A quiet record of your personal growth over the year.',
  },
];

function renderPerplexity() {
  const el = document.getElementById('section-perplexity');
  if (!window.state.ideaVotes) window.state.ideaVotes = {};

  const cardsHtml = IDEAS.map(idea => {
    const votes = window.state.ideaVotes[idea.id] || 0;
    const voted = !!window.state.ideaVotes[`voted_${idea.id}`];
    return `
      <div class="idea-card">
        <div class="idea-icon">${idea.icon}</div>
        <div class="idea-title">${idea.title}</div>
        <p class="idea-desc">${idea.desc}</p>
        <div class="idea-tag">
          <span class="badge badge-${idea.tag}">${idea.category}</span>
        </div>
        <div class="idea-status">
          <span class="text-xs text-muted">Want this built?</span>
          <button class="idea-vote ${voted ? 'voted' : ''}" data-id="${idea.id}">
            ${voted ? '★' : '☆'} ${votes + (voted ? 0 : 0)} vote${votes !== 1 ? 's' : ''}
          </button>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="page-header">
      <h1>Ideas</h1>
      <p>Smart additions that could make your daily life even smoother.</p>
    </div>

    <div class="perplexity-header-band">
      <h2>✨ Perplexity Ideas</h2>
      <p>These are features that would genuinely improve your day-to-day — practical, life-enhancing additions for someone managing work, health, money, and home. Vote for the ones you'd like built next.</p>
    </div>

    <div class="ideas-grid">${cardsHtml}</div>
  `;

  el.querySelectorAll('.idea-vote').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = +btn.dataset.id;
      const key = `voted_${id}`;
      if (window.state.ideaVotes[key]) return;
      window.state.ideaVotes[id]  = (window.state.ideaVotes[id] || 0) + 1;
      window.state.ideaVotes[key] = true;
      saveState();
      renderPerplexity();
    });
  });
}
