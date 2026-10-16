/* Tiny IndexedDB store for attached scans (Blobs). Keys are "<caseId>:<docId>". Everything stays in this browser. */
(function (root) {
  'use strict';
  const DB = 'sutro', STORE = 'scans';
  function open() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in root)) return rej(new Error('indexeddb-unavailable'));
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => { if (!q.result.objectStoreNames.contains(STORE)) q.result.createObjectStore(STORE); };
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error || new Error('indexeddb-open-failed'));
    });
  }
  function tx(mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE));
      t.oncomplete = () => { db.close(); res(r ? r.result : undefined); };
      t.onerror = () => { db.close(); rej(t.error || new Error('indexeddb-tx-failed')); };
      t.onabort = () => { db.close(); rej(t.error || new Error('indexeddb-tx-aborted')); };
    }));
  }
  const api = {
    put: (key, blob) => tx('readwrite', (s) => s.put(blob, key)),
    get: (key) => tx('readonly', (s) => s.get(key)),
    del: (key) => tx('readwrite', (s) => s.delete(key)),
    keys: (prefix) => tx('readonly', (s) => s.getAllKeys()).then((ks) => (ks || []).filter((k) => String(k).startsWith(prefix))),
    delPrefix: (prefix) => api.keys(prefix).then((ks) => Promise.all(ks.map(api.del)))
  };
  root.Sutro = Object.assign(root.Sutro || {}, { idb: api });
})(window);
