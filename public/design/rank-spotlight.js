/* Isolated, static design review. No game state, account calls or service worker. */
(() => {
  const embedded = new URLSearchParams(location.search).get('card') === '1';
  if (embedded) {
    document.querySelector('.preview-shell').remove();
    document.querySelector('.card-stage').hidden = false;
    const resize = () => parent.postMessage({type:'rank-preview-height',height:document.body.scrollHeight},location.origin);
    new ResizeObserver(resize).observe(document.body);
    addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'rank-preview-theme') return;
      document.documentElement.dataset.theme = event.data.theme === 'light' ? 'light' : 'dark';
    });
    return;
  }
  document.querySelector('.card-stage').remove();
  const frame = document.querySelector('#previewFrame');
  document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
    frame.style.width = button.dataset.size + 'px';
    document.querySelectorAll('[data-size]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  }));
  const sendTheme = () => frame.contentWindow.postMessage({type:'rank-preview-theme',theme:document.documentElement.dataset.theme},location.origin);
  frame.addEventListener('load',sendTheme);
  frame.src = 'rank-spotlight.html?card=1';
  document.querySelector('#themeToggle').addEventListener('click',event => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    event.currentTarget.textContent = light ? 'Tmavý vzhled' : 'Světlý vzhled';
    event.currentTarget.setAttribute('aria-pressed',String(light));
    sendTheme();
  });
  addEventListener('message',event => {
    if (event.origin === location.origin && event.source === frame.contentWindow && event.data?.type === 'rank-preview-height' && Number.isFinite(event.data.height)) frame.style.height = event.data.height + 'px';
  });
})();
