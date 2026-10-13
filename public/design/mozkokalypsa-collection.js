(() => {
  'use strict';
  const dialog = document.getElementById('achievementDetail');
  const stories = window.PropletAchievementStories || {};
  document.querySelectorAll('.achievement').forEach(card => {
    const story = stories[`mozkokalypsa-${card.dataset.stage}`];
    if (story) card.querySelector('.story').textContent = story;
    card.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      const source = card.querySelector('img');
      const image = document.getElementById('detailImage');
      image.src = source.src;
      image.alt = source.alt;
      document.getElementById('detailTitle').textContent = card.querySelector('h2').textContent;
      document.getElementById('detailStory').textContent = card.querySelector('.story').textContent;
      document.getElementById('detailMilestone').textContent = card.querySelector('.milestone').textContent;
      dialog.showModal();
    });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
    document.getElementById('backToGame').href = '/?archive-preview=1&review=profile';
  }
})();
