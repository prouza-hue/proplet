(function installAccountUI(global) {
  'use strict';

  function create(deps = {}) {
    const d = deps;
    let leaguesCache = [];
    let teamMembershipMode = 'join';

    function safeGoogleAvatarUrl(value) {
      try {
        const url = new URL(String(value || ''));
        const host = url.hostname.toLowerCase();
        return url.protocol === 'https:' && (host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com'))
          ? url.href
          : '';
      } catch (_) {
        return '';
      }
    }

    function profileAvatarMarkup(profile, css = '') {
      const url = profile?.useGoogleAvatar ? safeGoogleAvatarUrl(profile.googleAvatarUrl) : '';
      return url
        ? `<img class="google-profile-avatar ${d.esc(css)}" src="${d.esc(url)}" alt="" referrerpolicy="no-referrer">`
        : d.esc(profile?.avatar || '🙂');
    }

    function updateProfileChip() {
      const profile = d.getProfile();
      const chip = d.$('#profileChip');
      d.$('#profileChipText').textContent = profile?.name || 'Uložit';
      const avatar = d.$('#profileChipAvatar');
      if (avatar) avatar.innerHTML = profile ? profileAvatarMarkup(profile) : '☁️';
      if (chip) chip.setAttribute('aria-label', profile ? `Profil hráče ${profile.name}` : 'Uložit postup do účtu');
    }

    function normalizeLeagueCode(value) {
      return String(value || '').trim().toLocaleUpperCase('cs-CZ').replace(/\s+/g, '').replace(/[^0-9A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ_-]/g, '').slice(0, 24);
    }

    function selectedLeague() {
      return leaguesCache.find(league => league.code === d.$('#leagueSelect')?.value) || null;
    }

    async function loadLeagues() {
      try {
        const data = await d.api('/api/teams');
        leaguesCache = data.leagues || [];
      } catch (_) {
        leaguesCache = [];
      }
      const select = d.$('#leagueSelect');
      if (select) {
        const previous = select.value;
        const profile = d.getProfile();
        select.innerHTML = [
          '<option value="">Vyber tým…</option>',
          ...leaguesCache.map(league => `<option value="${d.esc(league.code)}">${d.esc(league.name)}${league.members ? ` · ${d.countCz(league.members, 'hráč', 'hráči', 'hráčů')}` : ''}</option>`),
        ].join('');
        if (previous && leaguesCache.some(league => league.code === previous)) select.value = previous;
        else if (profile?.familyCode && leaguesCache.some(league => league.code === profile.familyCode)) select.value = profile.familyCode;
      }
      return leaguesCache;
    }

    function setTeamMembershipMode(mode) {
      teamMembershipMode = mode;
      const join = mode === 'join';
      d.$('#teamMembershipJoinTab').classList.toggle('active', join);
      d.$('#teamMembershipNewTab').classList.toggle('active', !join);
      d.$('#teamMembershipJoinFields').classList.toggle('hidden', !join);
      d.$('#teamMembershipNewFields').classList.toggle('hidden', join);
      d.$('#saveTeamMembershipBtn').textContent = join ? 'Přidat se k týmu' : 'Založit tým';
    }

    async function openTeamMembershipModal() {
      const profile = d.getProfile();
      if (!profile?.token) {
        d.openProfileModal('create');
        return;
      }
      if (profile.familyCode) {
        d.showToast('Už jsi v týmu.');
        return;
      }
      d.$('#teamMembershipError').textContent = '';
      d.$('#teamMembershipJoinPin').value = '';
      d.$('#teamMembershipNewPin').value = '';
      d.$('#teamMembershipName').value = '';
      setTeamMembershipMode('join');
      d.$('#teamMembershipModal').classList.remove('hidden');
      try {
        const leagues = await loadLeagues();
        const select = d.$('#teamMembershipSelect');
        select.innerHTML = [
          '<option value="">Vyber tým…</option>',
          ...leagues.map(league => `<option value="${d.esc(league.code)}">${d.esc(league.name)}${league.members ? ` · ${d.countCz(league.members, 'hráč', 'hráči', 'hráčů')}` : ''}</option>`),
        ].join('');
      } catch (_) {
        // The modal remains usable for creating a new team while offline.
      }
    }

    async function saveTeamMembership() {
      d.$('#teamMembershipError').textContent = '';
      const join = teamMembershipMode === 'join';
      const family_code = join ? normalizeLeagueCode(d.$('#teamMembershipSelect').value) : null;
      const league_name = join ? null : d.$('#teamMembershipName').value.trim();
      const league_pin = join ? d.$('#teamMembershipJoinPin').value : d.$('#teamMembershipNewPin').value;
      if (join && !family_code) {
        d.$('#teamMembershipError').textContent = 'Vyber tým.';
        return;
      }
      if (!join && !league_name) {
        d.$('#teamMembershipError').textContent = 'Pojmenuj nový tým.';
        return;
      }
      if ((league_pin || '').length < 4) {
        d.$('#teamMembershipError').textContent = 'PIN musí mít alespoň 4 znaky.';
        return;
      }
      try {
        const result = await d.api('/api/team-membership', {
          method: 'POST',
          body: JSON.stringify({mode: join ? 'join' : 'new', family_code, league_name, league_pin}),
        });
        d.updateAccountProfile({familyCode: result.familyCode, leagueName: result.leagueName});
        d.$('#teamMembershipModal').classList.add('hidden');
        d.showToast(join ? 'Jsi v týmu ✓' : 'Tým založen ✓');
        d.renderProfile();
        d.renderLeaderboard();
        d.renderDaily();
      } catch (error) {
        d.$('#teamMembershipError').textContent = error.message;
      }
    }

    function renderProfile({focusRoadmap = false} = {}) {
      d.renderInstallUI();
      const profile = d.getProfile();
      const local = d.currentLocalStats();
      const stats = d.effectiveStats();
      const level = d.levelFor(stats.points || 0);
      const queue = d.getQueue();
      if (!profile) {
        d.$('#profileCard').innerHTML = '<h2>Postup je zatím jen tady</h2><p class="muted">Na tomhle zařízení o nic nepřijdeš. Účet navíc uloží XP, výsledky a sérii do cloudu a pustí tě do pořadí.</p><div class="account-actions"><button id="profileCreateBtn" class="primary-btn">☁️ Uložit postup</button><button id="profileLoginBtn" class="secondary-btn">Už účet mám</button></div>';
        setTimeout(() => {
          if (d.$('#profileLoginBtn')) d.$('#profileLoginBtn').onclick = () => d.openProfileModal('login');
          if (d.$('#profileCreateBtn')) d.$('#profileCreateBtn').onclick = () => d.openProfileModal('create');
        }, 0);
      } else {
        const inTeam = !!profile.familyCode;
        const syncState = d.getSyncState();
        const status = syncState.status === 'syncing'
          ? ['Synchronizuji…', '']
          : syncState.status === 'error'
            ? ['Synchronizace čeká', syncState.error || 'Neznámá chyba']
            : queue.length
              ? [[d.countCz(queue.length, 'výsledek', 'výsledky', 'výsledků'), 'čeká'].join(' '), 'Připoj internet a zkus synchronizovat']
              : ['Vše synchronizováno', inTeam ? 'Cloud i týmové pořadí jsou aktuální' : 'Postup je bezpečně v cloudu'];
        const statusClass = syncState.status === 'error' ? 'error' : (!queue.length && syncState.status !== 'syncing' ? 'success' : '');
        const account = profile.hasPassword
          ? `<div class="account-banner account-ok"><strong>☁️ Účet je v cloudu</strong><span>Na dalším zařízení se přihlas jako <b>${d.esc(profile.name)}</b> svým heslem. Tým k přihlášení nepotřebuješ.</span></div>`
          : '<div class="account-banner"><strong>💻 Zapni hraní na více zařízeních</strong><span>Nastav osobní heslo. Výsledky a XP zůstanou přesně tam, kde jsou.</span><button id="setPasswordBtn" class="secondary-btn">Nastavit heslo</button></div>';
        const avatars = d.AVATARS.map(avatar => `<button class="avatar-choice ${avatar === (profile.avatar || '🙂') ? 'selected' : ''}" data-avatar="${avatar}" aria-label="Avatar ${avatar}">${avatar}</button>`).join('');
        const teamAccess = inTeam
          ? `<div class="team-access-card"><div><strong>👥 ${d.esc(profile.leagueName || profile.familyCode)}</strong><span>Týmové pořadí je aktivní. PIN slouží jen jako pozvánka pro další hráče.</span></div><button id="teamPinBtn" class="secondary-btn">Nastavit PIN</button></div>`
          : '<div class="team-access-card team-empty"><div><strong>👥 Tým je volitelný</strong><span>Účet funguje i bez něj. Přidej rodinu nebo partu, až budeš chtít společné pořadí.</span></div><button id="joinTeamBtn" class="secondary-btn">Přidat tým</button></div>';
        d.$('#profileCard').innerHTML = `<div class="profile-summary"><div class="profile-identity"><div class="profile-avatar-big">${d.esc(profile.avatar || '🙂')}</div><div><div class="profile-name">${d.esc(profile.name)}</div><div class="profile-family">${inTeam ? `Tým: ${d.esc(profile.leagueName || profile.familyCode)}` : 'Bez týmu · účet je uložený'}</div></div></div><div class="streak-bubble"><span class="streak-icon">🔥</span><strong>${stats.currentStreak || 0}</strong><small>${d.czPlural(stats.currentStreak || 0, 'den', 'dny', 'dní')}</small></div></div><div class="avatar-picker"><span class="stat-label">TVŮJ AVATAR</span><div class="avatar-grid">${avatars}</div></div><div class="profile-grid"><div class="profile-stat"><span class="stat-label">XP</span><strong>${stats.points ?? local.points}</strong></div><div class="profile-stat profile-rank-stat"><span class="stat-label">Hodnost</span><div class="profile-rank-value"><span class="profile-rank-icon">${level.current.icon}</span><strong>${level.index} · ${d.esc(level.current.name)}</strong></div></div><div class="profile-stat profile-stat-wide"><span class="stat-label">Hotovo</span><div class="profile-completion-grid"><span><b>${stats.freeCompleted?.easy ?? local.freeCompleted?.easy ?? 0}</b><small>🌱 Snadná</small></span><span><b>${stats.freeCompleted?.medium ?? local.freeCompleted?.medium ?? 0}</b><small>🧠 Střední</small></span><span><b>${stats.freeCompleted?.hard ?? local.freeCompleted?.hard ?? 0}</b><small>🔥 Těžká</small></span><span><b>${stats.freeCompleted?.hardcore ?? local.freeCompleted?.hardcore ?? 0}</b><small>🤯 Mozkožrout</small></span></div></div><div class="profile-stat profile-stat-wide profile-daily-highlights"><span><small>Denní výzvy</small><b>${stats.dailyCompleted ?? local.dailyCompleted}</b></span><span><small>Nejdelší série</small><b>${stats.longestStreak ?? local.longestStreak}</b></span><span><small>Nejlepší Daily</small><b>${d.fmtTime(stats.bestDailyMs ?? local.bestDailyMs)}</b></span></div></div>${account}<div class="support-mode-card"><div><span class="stat-label">POMOCNÍK</span><strong>${d.SUPPORT_MODES[profile.supportMode || 'none']?.icon || '🧠'} ${d.esc(d.SUPPORT_MODES[profile.supportMode || 'none']?.label || 'Nenabízet')}</strong><small>${d.esc(d.SUPPORT_MODES[profile.supportMode || 'none']?.desc || '')}</small></div><button id="supportModeBtn" class="secondary-btn">Nastavit</button></div>${teamAccess}<a id="adminEntryBtn" class="admin-entry hidden" href="/admin"><span>🛠</span><div><strong>Proplet Admin</strong><small>Quality, hlášení a uživatelé</small></div><b>→</b></a><div class="sync-panel"><div class="sync-status ${statusClass}"><div><strong>${d.esc(status[0])}</strong><div>${d.esc(status[1])}</div></div><span>${syncState.status === 'syncing' ? '↻' : queue.length ? '☁️' : '✓'}</span></div><button id="syncBtn" class="secondary-btn" ${syncState.status === 'syncing' ? 'disabled' : ''}>${syncState.status === 'syncing' ? 'Synchronizuji…' : `Synchronizovat${queue.length ? ` (${queue.length})` : ''}`}</button></div><button id="logoutBtn" class="logout-btn">Odhlásit hráče z tohoto zařízení</button>`;
        const mainAvatar = d.$('#profileCard .profile-avatar-big');
        if (mainAvatar) mainAvatar.innerHTML = profileAvatarMarkup(profile);
        setTimeout(() => {
          if (d.$('#syncBtn')) d.$('#syncBtn').onclick = () => d.syncQueue({announce: true});
          if (d.$('#setPasswordBtn')) d.$('#setPasswordBtn').onclick = d.openPasswordModal;
          if (d.$('#supportModeBtn')) d.$('#supportModeBtn').onclick = d.openSupportModeModal;
          if (d.$('#teamPinBtn')) d.$('#teamPinBtn').onclick = openTeamPinModal;
          if (d.$('#joinTeamBtn')) d.$('#joinTeamBtn').onclick = openTeamMembershipModal;
          if (d.$('#logoutBtn')) d.$('#logoutBtn').onclick = d.logoutPlayer;
          d.$$('.avatar-choice').forEach(button => button.onclick = () => saveAvatar(button.dataset.avatar));
          d.refreshAdminEntry();
        }, 0);
      }
      const points = stats.points || 0;
      const longest = stats.longestStreak ?? local.longestStreak;
      d.$('#levelRoadmap').innerHTML = d.LEVELS.map((entry, index) => `<div class="level-step ${points >= entry.xp ? 'earned' : ''} ${index === level.index - 1 ? 'current' : ''}"><span class="level-num">${index + 1}</span><span class="level-step-icon">${entry.icon}</span><strong>${entry.name}</strong><small>${entry.xp.toLocaleString('cs-CZ')} XP</small></div>`).join('');
      d.$('#profileBadges').innerHTML = d.BADGES.map(badge => `<div class="profile-badge ${longest >= badge.days ? 'earned' : ''}"><span class="emoji">${badge.icon}</span><strong>${badge.name}</strong><small>${d.countCz(badge.days, 'den', 'dny', 'dní')} v řadě</small></div>`).join('');
      d.updatePushUI();
      const achievementSummary = d.$('#achievementSummary');
      const achievementGrid = d.$('#achievementGrid');
      if (achievementSummary) achievementSummary.innerHTML = d.renderAchievementSummary(stats);
      if (achievementGrid) achievementGrid.innerHTML = d.renderAchievements(stats);
      d.syncAchievementDisclosure();
      const achievementToggle = d.$('#achievementToggleBtn');
      if (achievementToggle) achievementToggle.onclick = () => {
        d.toggleProfileAchievementsExpanded();
        d.syncAchievementDisclosure();
      };
      if (focusRoadmap) d.focusProfileRoadmap();
      d.renderSettings();
      d.renderPrivacyActions();
    }

    async function saveAvatar(avatar) {
      const profile = d.getProfile();
      if (!profile?.token) return;
      try {
        const result = await d.api('/api/avatar', {method: 'POST', body: JSON.stringify({avatar, use_google_avatar: false})});
        d.updateAccountProfile({avatar: result.avatar, useGoogleAvatar: false, googleAvatarUrl: result.googleAvatarUrl || profile.googleAvatarUrl || null});
        updateProfileChip();
        d.renderProfile();
        if (d.getCurrentScreen() === 'leaderboard') d.renderLeaderboard();
        d.showToast('Avatar uložen ✓');
      } catch (error) {
        d.showToast(error.message);
      }
    }

    async function saveGoogleAvatar() {
      const profile = d.getProfile();
      if (!profile?.token || !safeGoogleAvatarUrl(profile.googleAvatarUrl)) return;
      try {
        const result = await d.api('/api/avatar', {method: 'POST', body: JSON.stringify({use_google_avatar: true})});
        d.updateAccountProfile({useGoogleAvatar: true, googleAvatarUrl: result.googleAvatarUrl || profile.googleAvatarUrl});
        updateProfileChip();
        d.renderProfile();
        d.showToast('Google fotka je teď tvůj avatar ✓');
      } catch (error) {
        d.showToast(error.message);
      }
    }

    function openTeamPinModal() {
      const profile = d.getProfile();
      if (!profile?.token) {
        d.openProfileModal('login');
        return;
      }
      d.$('#teamPinInput').value = '';
      d.$('#teamPinInput').type = 'password';
      d.$('#teamPinToggle').textContent = '👁 Zobrazit PIN';
      d.$('#teamPinError').textContent = '';
      d.$('#teamPinModal').classList.remove('hidden');
    }

    async function saveTeamPin() {
      const pin = d.$('#teamPinInput').value;
      d.$('#teamPinError').textContent = '';
      if (pin.length < 4) {
        d.$('#teamPinError').textContent = 'PIN týmu musí mít alespoň 4 znaky.';
        return;
      }
      try {
        await d.api('/api/team-pin', {method: 'POST', body: JSON.stringify({pin})});
        d.$('#teamPinModal').classList.add('hidden');
        d.showToast('PIN týmu uložen ✓');
        await loadLeagues();
      } catch (error) {
        d.$('#teamPinError').textContent = error.message;
      }
    }

    async function openFamilyLeagueModal() {
      const profile = d.getProfile();
      if (!profile?.token) {
        d.openProfileModal('create');
        return;
      }
      if (!profile.familyCode) {
        openTeamMembershipModal();
        return;
      }
      try {
        const data = await d.api('/api/team-settings');
        if (!data.hasTeam) {
          openTeamMembershipModal();
          return;
        }
        d.$('#teamSettingsTitle').textContent = data.leagueName || 'Tvůj tým';
        d.$('#familyLeaguePublicName').value = data.publicName || data.leagueName || '';
        d.$('#familyLeagueModalError').textContent = '';
        d.$('#enableFamilyLeagueBtn').textContent = data.publicEnabled ? 'Uložit veřejný název' : 'Zobrazit tým v pořadí';
        d.$('#disableFamilyLeagueBtn').classList.toggle('hidden', !data.publicEnabled);
        d.$('#familyLeagueModal').classList.remove('hidden');
      } catch (error) {
        d.showToast(error.message);
      }
    }

    async function saveFamilyLeagueSettings(enabled) {
      const name = d.$('#familyLeaguePublicName').value.trim();
      d.$('#familyLeagueModalError').textContent = '';
      if (enabled && name.length < 2) {
        d.$('#familyLeagueModalError').textContent = 'Pojmenuj veřejný tým.';
        return;
      }
      try {
        await d.api('/api/family-league/settings', {method: 'POST', body: JSON.stringify({enabled, public_name: name || null})});
        d.$('#familyLeagueModal').classList.add('hidden');
        d.showToast(enabled ? 'Tým je ve veřejném pořadí 👥' : 'Tým je z veřejného pořadí skrytý');
        await d.renderLeaderboard();
      } catch (error) {
        d.$('#familyLeagueModalError').textContent = error.message;
      }
    }

    async function leaveCurrentTeam() {
      const profile = d.getProfile();
      if (!profile?.familyCode) return;
      if (!d.confirm(`Opravdu opustit tým ${profile.leagueName || profile.familyCode}? Dříve získané týmové XP zůstanou týmu.`)) return;
      try {
        await d.api('/api/team-membership/leave', {method: 'POST', body: '{}'});
        d.updateAccountProfile({familyCode: null, leagueName: null});
        d.$('#familyLeagueModal').classList.add('hidden');
        d.showToast('Tým jsi opustil. Historické XP zůstaly na místě.');
        d.renderProfile();
        await d.renderLeaderboard();
      } catch (error) {
        d.$('#familyLeagueModalError').textContent = error.message;
      }
    }

    return {
      safeGoogleAvatarUrl,
      profileAvatarMarkup,
      updateProfileChip,
      normalizeLeagueCode,
      selectedLeague,
      loadLeagues,
      setTeamMembershipMode,
      openTeamMembershipModal,
      saveTeamMembership,
      renderProfile,
      saveAvatar,
      saveGoogleAvatar,
      openTeamPinModal,
      saveTeamPin,
      openFamilyLeagueModal,
      saveFamilyLeagueSettings,
      leaveCurrentTeam,
    };
  }

  const api = {create};
  if (global) global.PropletAccountUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
