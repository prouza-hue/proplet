(function installProductAnalytics(global) {
  'use strict';

  const DEFAULT_ENDPOINT = '/api/product-event';

  function create(options = {}) {
    const request = typeof options.request === 'function' ? options.request : null;
    const isDisabled = typeof options.isDisabled === 'function' ? options.isDisabled : () => false;
    const endpoint = String(options.endpoint || DEFAULT_ENDPOINT);

    function track(eventType, _properties) {
      if (!request || isDisabled()) return;
      try {
        const pending = request(endpoint, {
          method: 'POST',
          body: JSON.stringify({event_type: eventType}),
        });
        Promise.resolve(pending).catch(() => {});
      } catch (_) {}
    }

    return {track};
  }

  const api = {create, DEFAULT_ENDPOINT};
  if (global) global.PropletAnalytics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
