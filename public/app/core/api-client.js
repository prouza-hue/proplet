/* global AbortController */
(function installApiClient(global) {
  'use strict';

  function create(options = {}) {
    const fetchFn = typeof options.fetch === 'function'
      ? options.fetch
      : (...args) => global.fetch(...args);
    const getProfile = typeof options.getProfile === 'function' ? options.getProfile : () => null;
    const getAnonymousId = typeof options.getAnonymousId === 'function' ? options.getAnonymousId : () => '';
    const getVersion = typeof options.getVersion === 'function' ? options.getVersion : () => '';
    const getPreviewDate = typeof options.getPreviewDate === 'function' ? options.getPreviewDate : () => '';
    const isOnline = typeof options.isOnline === 'function' ? options.isOnline : () => global.navigator?.onLine !== false;
    const AbortControllerImpl = options.AbortController || global.AbortController;
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 12000;

    return async function request(path, opts = {}) {
      const hasAuthSnapshot = Object.prototype.hasOwnProperty.call(opts, 'authProfile');
      const profile = hasAuthSnapshot ? opts.authProfile : getProfile();
      const {authProfile: _authProfile, ...requestOptions} = opts;
      const headers = {
        'Content-Type': 'application/json',
        'X-Proplet-Version': getVersion(),
        ...(opts.headers || {}),
      };
      if (profile?.token) headers.Authorization = `Bearer ${profile.token}`;
      else headers['X-Proplet-Anon-ID'] = getAnonymousId();

      const previewDate = getPreviewDate();
      if (previewDate) headers['X-Proplet-Preview-As-Of'] = previewDate;

      const controller = new AbortControllerImpl();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchFn(path, {
          ...requestOptions,
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
      } catch (error) {
        clearTimeout(timeout);
        if (error?.name === 'AbortError') throw new Error('Server se neozval včas');
        throw new Error(isOnline() ? 'Spojení se serverem selhalo' : 'Telefon je offline');
      }

      clearTimeout(timeout);
      if (!response.ok) {
        let message = `Server vrátil chybu ${response.status}`;
        let requestId = '';
        try {
          const body = await response.json();
          message = body.detail || body.message || message;
          requestId = String(body.requestId || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 24);
        } catch (_) {}
        if (requestId) message += ` · kód ${requestId}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      return response.json();
    };
  }

  function createCachedLoader({load, ttlMs = 300000, now = () => Date.now()} = {}) {
    if (typeof load !== 'function') throw new TypeError('load is required');
    let cached = null;
    let inFlight = null;

    async function get({force = false} = {}) {
      const currentTime = Number(now());
      if (!force && cached && currentTime - cached.at < ttlMs) return cached.value;
      if (!force && inFlight) return inFlight;

      const request = Promise.resolve().then(load);
      if (!force) inFlight = request;
      try {
        const value = await request;
        cached = {at: Number(now()), value};
        return value;
      } finally {
        if (inFlight === request) inFlight = null;
      }
    }

    function invalidate() {
      cached = null;
    }

    return {get, invalidate};
  }

  const api = {create, createCachedLoader};
  if (global) global.PropletApiClient = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
