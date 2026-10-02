/* Shared immutable routes. Player history only filters IDs; it never manufactures an order. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PropletSharedFreeOrder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function create(manifest, banks) {
    if (!manifest?.version || !manifest.routes || !manifest.catalogRoutes) throw new Error('Shared route manifest is missing.');
    const routes = new Map(), catalogues = new Map(), boards = new Map();
    const varied = new Set(manifest.variedDifficulties || []);
    if ([...varied].some(diff => !banks[diff])) throw new Error('Unknown difficulty in varied configuration.');
    for (const [diff, bank] of Object.entries(banks)) {
      const byId = new Map(bank.map(p => [p.id, p]));
      const route = manifest.routes[diff], catalogue = manifest.catalogRoutes[diff];
      for (const ids of [route, catalogue]) {
        if (!Array.isArray(ids) || ids.length !== bank.length || byId.size !== bank.length || new Set(ids).size !== bank.length || ids.some(id => !byId.has(id))) throw new Error('Shared route does not match active bank: ' + diff);
      }
      routes.set(diff, Object.freeze([...route]));
      catalogues.set(diff, Object.freeze([...catalogue]));
      boards.set(diff, byId);
    }
    return Object.freeze({
      version: manifest.version,
      supports: diff => routes.has(diff) && varied.has(diff),
      ids: (diff, mode = 'varied') => (mode === 'numeric' ? catalogues : routes).get(diff) || Object.freeze([]),
      next(diff, {completedIds = [], resumeId = null, mode = 'varied'} = {}) {
        if (!['varied', 'numeric'].includes(mode)) throw new Error('Unsupported route mode.');
        const byId = boards.get(diff);
        if (!byId) return null;
        const done = new Set(completedIds);
        if (resumeId && byId.has(resumeId) && !done.has(resumeId)) return byId.get(resumeId);
        const id = (mode === 'numeric' ? catalogues : routes).get(diff).find(id => !done.has(id));
        return byId.get(id) || null;
      }
    });
  }
  return Object.freeze({create});
});
