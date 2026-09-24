(function(global) {
  'use strict';
  const KEY = 'proplet-acquisition-v1';
  const TTL = 7 * 86400000;
  const FIELDS = {utm_source:'source', utm_campaign:'campaign', utm_content:'ad', utm_term:'adset'};
  function parse(url) {
    try {
      const params = new URL(url).searchParams;
      if (!['facebook','instagram','fb','ig'].includes(params.get('utm_source')) || params.get('utm_medium') !== 'paid_social') return null;
      const values = {};
      for (const [param, field] of Object.entries(FIELDS)) {
        const value = params.get(param) || '';
        if (field !== 'source' && !/^\d{5,30}$/.test(value)) return null;
        values[field] = value;
      }
      return values;
    } catch {return null;}
  }
  function create({storage, url, allowed, now = Date.now}) {
    const incoming = parse(url);
    function headers() {
      // Marketing attribution is opt-in; never persist full URLs or fbclid.
      if (!allowed()) {try {storage.removeItem(KEY);} catch {} return {};}
      let row;
      try {row = JSON.parse(storage.getItem(KEY) || 'null');} catch {}
      if (incoming && (!row || JSON.stringify(row.values) !== JSON.stringify(incoming))) {
        row = {at:now(), values:incoming};
        try {storage.setItem(KEY, JSON.stringify(row));} catch {}
      }
      if (!row || !Number.isFinite(row.at) || row.at > now() || now() - row.at >= TTL) return {};
      const v = row.values;
      if (!v || !['facebook','instagram','fb','ig'].includes(v.source) || !['campaign','ad','adset'].every(k => /^\d{5,30}$/.test(v[k] || ''))) return {};
      return Object.fromEntries(Object.entries(v).map(([k,value]) => [`X-Proplet-Acquisition-${k}`,value]));
    }
    function filterHeaders(captured = {}) {
      if (allowed()) return {...captured};
      headers(); // Clear stored attribution after consent withdrawal.
      return Object.fromEntries(Object.entries(captured).filter(([key]) => !key.toLowerCase().startsWith('x-proplet-acquisition-')));
    }
    return {headers, filterHeaders};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {create, parse, KEY};
  if (!global?.document) return;
  let storage;
  try {storage = global.sessionStorage;} catch {storage = {getItem(){},setItem(){},removeItem(){}};}
  global.PropletAcquisition = create({storage, url:global.location.href,
    allowed:() => global.PropletMarketing?.consented() === true && global.location.hostname === 'hrajproplet.cz' && global.PROPLET_RUNTIME_ENV !== 'preview' && !global.PROPLET_RUNTIME_META?.gen5CandidatePreview});
})(typeof window !== 'undefined' ? window : null);
