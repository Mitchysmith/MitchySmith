// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initClock();
  renderHome();
  renderTasks();
  renderCalendar();
  renderFinance();
  renderCooking();
  renderExercise();
  renderPerplexity();

  // Hide Pac-Man loader
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
    setTimeout(() => { if (loader) loader.remove(); }, 500);
  }, 1200);
});
