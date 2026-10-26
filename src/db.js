// Penyimpanan foto di browser (IndexedDB). Semua fungsi aman: kalau gagal, game tetap jalan.
// Versi online (Supabase) ada di cloud.js dengan fungsi yang sama.
const NAME = 'museum-foto', STORE = 'frames';
let opened = null;
function open() {
  if (!opened) opened = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return opened;
}
const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
  const tx = db.transaction(STORE, mode), q = fn(tx.objectStore(STORE));
  tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error);
}));

export async function loadAll() { try { return (await run('readonly', s => s.getAll())) || []; } catch (e) { return []; } }
export async function save(rec) { try { await run('readwrite', s => s.put(rec)); return true; } catch (e) { return false; } }
// Denah disimpan sebagai rekaman khusus dengan id -1
export async function loadLayout() { try { const r = await run('readonly', s => s.get(-1)); return r ? r.layout : null; } catch (e) { return null; } }
export async function saveLayout(layout) { try { await run('readwrite', s => s.put({ id: -1, layout })); return true; } catch (e) { return false; } }
export async function remove(id) { try { await run('readwrite', s => s.delete(id)); } catch (e) {} }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
