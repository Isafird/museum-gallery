import { state } from './state.js';
import { buildMuseum, museum, walkable } from './gallery.js';
import { applyFrame, render, saveLayout, dropFrames } from './photos.js';
import { normalizeLayout, findSpawn } from './layout.js';
import { toast } from './toast.js';

// Pasang denah baru ke dunia 3D
export function applyLayout(l) {
  const layout = normalizeLayout(l); state.layout = layout; buildMuseum(layout);
  layout.frames.forEach(f => { applyFrame(f.id); render(f.id); });
  if (!walkable(state.P.x, state.P.z, .45)) { const s = findSpawn(museum); state.P.x = s[0]; state.P.z = s[1]; }   // pemain di dalam dinding? pindahkan
}

// Simpan denah (lokal atau online), lalu hapus foto bingkai yang dibuang dari denah
export async function commitLayout(next) {
  const gone = state.layout.frames.filter(f => !next.frames.some(n => n.id === f.id)).map(f => f.id);
  if (!(await saveLayout(next))) { toast('Gagal menyimpan denah (periksa koneksi atau hak akses)'); return false; }
  if (gone.length) dropFrames(gone);
  applyLayout(next); toast('Denah tersimpan'); return true;
}
