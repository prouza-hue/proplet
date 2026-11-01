(function (root) {
  'use strict';
  // Exact offline membership. A failed load rejects, never becomes "unknown word".
  var state = null, pending = null;
  var DATA_URL = '/recognition/bonus-cs-v1.dawg';

  function decode(buffer) {
    var view = new DataView(buffer), magic = '';
    if (view.byteLength < 28) throw new Error('Invalid bonus lexicon header');
    for (var m = 0; m < 8; m += 1) magic += String.fromCharCode(view.getUint8(m));
    if (magic !== 'PRLX0001') throw new Error('Invalid bonus lexicon format');
    var nodes = view.getUint32(8, true), edges = view.getUint32(12, true);
    var rootId = view.getUint32(16, true), alphabetLength = view.getUint32(24, true);
    if (!nodes || rootId >= nodes || alphabetLength < 1 || alphabetLength > 64) {
      throw new Error('Invalid bonus lexicon dimensions');
    }
    var letters = Object.create(null);
    for (var i = 0; i < alphabetLength; i += 1) {
      var letter = String.fromCharCode(view.getUint16(28 + i * 2, true));
      if (Object.prototype.hasOwnProperty.call(letters, letter)) throw new Error('Invalid bonus lexicon alphabet');
      letters[letter] = i;
    }
    var nodeOffset = 28 + alphabetLength * 2;
    var edgeOffset = nodeOffset + (nodes + 1) * 4;
    if (view.byteLength !== edgeOffset + edges * 4) throw new Error('Invalid bonus lexicon byte length');
    var previous = 0;
    for (var n = 0; n <= nodes; n += 1) {
      var offset = view.getUint32(nodeOffset + n * 4, true) & 0x7fffffff;
      if (offset < previous || offset > edges) throw new Error('Invalid bonus lexicon node offsets');
      previous = offset;
    }
    if (previous !== edges) throw new Error('Invalid bonus lexicon final offset');
    for (var e = 0; e < edges; e += 1) {
      var edge = view.getUint32(edgeOffset + e * 4, true);
      if ((edge >>> 6) >= nodes || (edge & 63) >= alphabetLength) throw new Error('Invalid bonus lexicon edge');
    }
    return { view: view, letters: letters, root: rootId, nodeOffset: nodeOffset, edgeOffset: edgeOffset };
  }

  function has(word) {
    if (!state) return null;
    if (typeof word !== 'string') return false;
    word = word.normalize('NFC').toLowerCase();
    if (word.length < 4 || word.length > 24) return false;
    var node = state.root, view = state.view;
    for (var i = 0; i < word.length; i += 1) {
      var label = state.letters[word[i]];
      if (label === undefined) return false;
      var low = view.getUint32(state.nodeOffset + node * 4, true) & 0x7fffffff;
      var high = (view.getUint32(state.nodeOffset + (node + 1) * 4, true) & 0x7fffffff) - 1;
      var found = false;
      while (low <= high) {
        var middle = (low + high) >>> 1;
        var edge = view.getUint32(state.edgeOffset + middle * 4, true), candidate = edge & 63;
        if (candidate < label) low = middle + 1;
        else if (candidate > label) high = middle - 1;
        else { node = edge >>> 6; found = true; break; }
      }
      if (!found) return false;
    }
    return !!(view.getUint32(state.nodeOffset + node * 4, true) & 0x80000000);
  }

  function load() {
    if (state) return Promise.resolve(api);
    if (pending) return pending;
    pending = fetch(DATA_URL, { cache: 'force-cache', credentials: 'omit' }).then(function (response) {
      if (!response.ok) throw new Error('Bonus lexicon unavailable: ' + response.status);
      return response.arrayBuffer();
    }).then(function (buffer) {
      state = decode(buffer);
      return api;
    }).catch(function (error) {
      pending = null;
      throw error;
    });
    return pending;
  }

  var api = { load: load, has: has, recognizes: function (word) {
    return load().then(function () { return has(word); });
  } };
  root.PropletBonusLexicon = api;
}(typeof window !== 'undefined' ? window : globalThis));
