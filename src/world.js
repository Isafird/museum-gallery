import { state } from './state.js';
import { buildMuseum, museum, walkable, entries } from './gallery.js';
import { applyFrame, render, saveLayout, dropFrames, useStore, clearView, initPhotos } from './photos.js';
import { normalizeLayout, findSpawn, defaultLayout } from './layout.js';
import * as db from './db.js';
import { toast } from './toast.js';

// Pasang denah baru ke dunia 3D
export function applyLayout(l) {
  const layout = normalizeLayout(l); state.layout = layout; buildMuseum(layout);
  layout.frames.forEach(f => { applyFrame(f.id); if (!entries[f.id].rendered) render(f.id); });
  if (!walkable(state.P.x, state.P.z, .45)) { const s = findSpawn(museum); state.P.x = s[0]; state.P.z = s[1]; }   // pemain di dalam dinding? pindahkan
}

// Simpan denah (lokal atau online), lalu hapus foto bingkai yang dibuang dari denah
export async function commitLayout(next) {
  const gone = state.layout.frames.filter(f => !next.frames.some(n => n.id === f.id)).map(f => f.id);
  if (!(await saveLayout(next))) { toast('Gagal menyimpan denah (periksa koneksi atau hak akses)'); return false; }
  if (gone.length) dropFrames(gone);
  applyLayout(next); toast('Denah tersimpan'); return true;
}

// Ubah orientasi bingkai (mendatar / tegak). Disimpan di denah, jadi hanya yang boleh mengatur denah.
export async function setFrameOrient(id, vertical) {
  const next = JSON.parse(JSON.stringify(state.layout)), f = next.frames.find(x => x.id === id); if (!f) return false;
  if (vertical) f.o = 'v'; else delete f.o;
  return commitLayout(next);
}

// Galeri lokal: denah dan foto dari database di browser
export async function loadLocal() {
  useStore(db); state.online = false;
  state.access = { role: 'local', canEdit: true, canManage: true, visibility: 'public' };
  entries.forEach((_, i) => clearView(i));
  const l = await db.loadLayout();
  if (state.online) return;                     // sementara itu sudah pindah ke galeri online
  applyLayout(l || defaultLayout());
  await initPhotos();
}
