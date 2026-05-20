// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {

  // Wrap every render call so one failure can't block the others or the loader hide
  const go = (fn, name) => { try { fn(); } catch (e) { console.error('[' + name + ']', e); } };

  go(initNav,         'initNav');
  go(initClock,       'initClock');
  go(renderHome,      'renderHome');
  go(renderTasks,     'renderTasks');
  go(renderCalendar,  'renderCalendar');
  go(renderFinance,   'renderFinance');
  go(renderLearn,     'renderLearn');
  go(renderMail,      'renderMail');
  go(renderPerplexity,'renderPerplexity');
  go(renderWork,      'renderWork');

  // Hide bird loader — always runs regardless of render errors
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
    setTimeout(() => { if (loader) loader.remove(); }, 500);
  }, 1800);
});
