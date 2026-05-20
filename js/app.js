// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initClock();
  renderHome();
  renderTasks();
  renderCalendar();
  renderFinance();
  renderLearn();
  renderMail();
  renderPerplexity();
  renderWork();

  // Pac-Man score counter — fast, dramatic
  const scoreEl = document.getElementById('pac-score');
  if (scoreEl) {
    let sc = 0;
    const scoreTimer = setInterval(() => {
      sc += Math.floor(Math.random() * 300 + 100);
      scoreEl.textContent = sc.toString().padStart(5, '0');
    }, 70);
    setTimeout(() => clearInterval(scoreTimer), 2200);
  }

  // Hide Pac-Man loader
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
    setTimeout(() => { if (loader) loader.remove(); }, 500);
  }, 2200);
});
