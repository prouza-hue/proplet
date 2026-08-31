(function installAccountSession(global) {
  'use strict';

  function create(options = {}) {
    const storage = options.storage || global?.localStorage;
    const profileKey = options.profileKey || 'proplet-v2-profile';
    const adoptGuestData = typeof options.adoptGuestData === 'function'
      ? options.adoptGuestData
      : () => {};
    const onChange = typeof options.onChange === 'function'
      ? options.onChange
      : () => {};

    function get() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(profileKey);
        return raw == null ? null : JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    function notify(next, previous) {
      try {
        onChange(next, previous);
      } catch (_) {
        // A UI observer must not break account persistence.
      }
    }

    function clear() {
      const previous = get();
      if (storage) storage.removeItem(profileKey);
      notify(null, previous);
      return null;
    }

    function save(profile) {
      if (profile == null) return clear();
      const previous = get();
      if (!storage) {
        notify(profile, previous);
        return profile;
      }
      storage.setItem(profileKey, JSON.stringify(profile));
      notify(profile, previous);
      return profile;
    }

    function update(patch) {
      const current = get();
      if (!current) return null;
      return save({...current, ...(patch || {})});
    }

    function hasIdentity(profile) {
      return !!profile?.id && !!profile?.token;
    }

    function accept(profile) {
      if (!hasIdentity(profile)) return null;
      const previous = get();
      if (!previous) adoptGuestData(profile.id);
      return save(profile);
    }

    function persistResponseProfile(incoming) {
      if (!hasIdentity(incoming)) return null;
      const current = get();
      return save({...current, ...incoming});
    }

    function authHeaders() {
      const profile = get();
      return profile?.token ? {Authorization: `Bearer ${profile.token}`} : {};
    }

    return {get, save, update, clear, accept, persistResponseProfile, authHeaders};
  }

  const api = {create};
  if (global) global.PropletAccountSession = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
