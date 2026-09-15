/* Isolated design review: no game state, accounts or service worker. */
(() => {
  const stage = document.querySelector('.card-stage');
  document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
    stage.style.width = button.dataset.size + 'px';
    document.querySelectorAll('[data-size]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  }));
  document.querySelector('#themeToggle').addEventListener('click',event => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    event.currentTarget.textContent = light ? 'Tmavý vzhled' : 'Světlý vzhled';
    event.currentTarget.setAttribute('aria-pressed',String(light));
  });
})();
