// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initClock();
  renderHome();
  renderTasks();
  renderCalendar();
  renderFinance();
  renderExercise();
  renderMail();
  renderPerplexity();
  renderWork();

  // Pac-Man score counter
  const scoreEl = document.getElementById('pac-score');
  if (scoreEl) {
    let sc = 0;
    const scoreTimer = setInterval(() => {
      sc += Math.floor(Math.random() * 80 + 30);
      scoreEl.textContent = sc.toString().padStart(4, '0');
    }, 160);
    setTimeout(() => clearInterval(scoreTimer), 1200);
  }

  // Hide Pac-Man loader
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
    setTimeout(() => { if (loader) loader.remove(); }, 500);
  }, 1200);
});
