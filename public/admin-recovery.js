(() => {
  if (typeof renderUserDetail !== 'function') return;

  const baseRenderUserDetail = renderUserDetail;

  function recoveryCardShell(user) {
    return `<section class="detail-section recovery-section" id="adminRecoverySection" data-player-id="${esc(user.id)}">
      <div class="recovery-heading">
        <div>
          <p class="eyebrow">SUPPORT · ÚČET</p>
          <h3>Obnova přístupu</h3>
        </div>
        <span class="recovery-lock">🔐 jen vlastník</span>
      </div>
      <p class="muted recovery-copy">Pro legacy účet bez ověřeného e-mailu. Admin pouze pošle ověřovací odkaz na konkrétní <code>player_id</code>; e-mail se připojí až po kliknutí z dané schránky.</p>
      <p class="recovery-player-id">Účet: <code>${esc(user.id)}</code></p>
      <div id="adminRecoveryBody" class="recovery-body muted">Kontroluji stav obnovy…</div>
    </section>`;
  }

  renderUserDetail = function renderUserDetailWithRecovery(data) {
    baseRenderUserDetail(data);
    const root = document.querySelector('#userDetailContent');
    if (!root || !data?.user?.id) return;
    root.insertAdjacentHTML('beforeend', recoveryCardShell(data.user));
    loadRecoveryStatus(data.user).catch(error => {
      const body = document.querySelector('#adminRecoveryBody');
      if (body) body.innerHTML = `<p class="metric-bad">Stav obnovy se nenačetl: ${esc(error.message)}</p>`;
    });
  };

  async function loadRecoveryStatus(user) {
    const body = document.querySelector('#adminRecoveryBody');
    if (!body) return;
    const status = await api(`/api/admin/users/${encodeURIComponent(user.id)}/recovery-email`);
    renderRecoveryStatus(user, status);
  }

  function renderRecoveryStatus(user, status) {
    const body = document.querySelector('#adminRecoveryBody');
    if (!body) return;

    if (status.verified) {
      body.innerHTML = `<div class="recovery-status recovery-ok">
        <strong>✓ E-mail je ověřený</strong>
        <span>${esc(status.emailMasked || '')}</span>
        <small>Běžná funkce „Zapomenuté heslo“ už pro tento účet funguje.</small>
      </div>`;
      return;
    }

    const pending = status.pending
      ? `<div class="recovery-status recovery-pending"><strong>Ověření čeká na kliknutí</strong><span>${esc(status.pendingEmailMasked || '')}</span><small>Platnost do ${fmtDate(status.pendingExpiresAt)}. Nové odeslání starý odkaz zneplatní.</small></div>`
      : '';

    body.innerHTML = `${pending}
      <label class="recovery-label" for="adminRecoveryEmail">E-mail, který má být s účtem propojen</label>
      <div class="recovery-form">
        <input id="adminRecoveryEmail" type="email" inputmode="email" autocomplete="off" placeholder="jmeno@example.com" maxlength="254" />
        <button id="adminRecoverySend" class="primary-button recovery-send">Poslat ověřovací odkaz</button>
      </div>
      <p class="recovery-warning"><b>Důležité:</b> odesláním potvrzuješ, že jsi identitu hráče ověřil mimo Proplet. Držitel této schránky po kliknutí získá přístup k tomuto konkrétnímu účtu.</p>`;

    const input = document.querySelector('#adminRecoveryEmail');
    const button = document.querySelector('#adminRecoverySend');
    button.onclick = () => sendRecoveryEmail(user, input, button);
    input.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        button.click();
      }
    };
  }

  async function sendRecoveryEmail(user, input, button) {
    const email = String(input.value || '').trim();
    if (!email || !email.includes('@')) {
      toast('Zadej platný e-mail.');
      input.focus();
      return;
    }
    const confirmed = window.confirm(
      `Poslat ověřovací odkaz pro hráče „${user.name}“ na ${email}?\n\nPo kliknutí se tato schránka propojí s účtem ${user.id} a bude možné přes ni obnovovat heslo.`
    );
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Odesílám…';
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}/recovery-email`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (typeof state !== 'undefined') state.audit = null;
      toast(result.message || 'Ověřovací odkaz odeslán ✓');
      await loadRecoveryStatus(user);
    } catch (error) {
      toast(error.message);
      button.disabled = false;
      button.textContent = 'Poslat ověřovací odkaz';
    }
  }
})();
