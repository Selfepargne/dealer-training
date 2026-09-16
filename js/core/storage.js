(function (DT) {
  'use strict';

  const KEY = 'dealer-training:v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[storage] unreadable data, starting fresh', err);
      return null;
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn('[storage] could not persist', err);
      return false;
    }
  }

  function remove() {
    try { localStorage.removeItem(KEY); } catch (err) { /* storage unavailable */ }
  }

  DT.core.storage = { KEY, load, save, remove };
})(window.DT);
