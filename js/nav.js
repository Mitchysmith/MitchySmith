// ── Navigation ──
function initNav() {
  const items = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');

  items.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.section;
      items.forEach(i => i.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const sec = document.getElementById('section-' + target);
      if (sec) sec.classList.add('active');
    });
  });
}
