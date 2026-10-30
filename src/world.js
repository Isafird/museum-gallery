import { state } from './state.js';
import { buildMuseum, museum, walkable, entries } from './gallery.js';
import { applyFrame, render, saveLayout, dropFrames, useStore, clearView, initPhotos } from './photos.js';
import { normalizeLayout, findSpawn, defaultLayout, snapToWall, frameOnWall, MAX_FRAMES, FRAME_W, FRAME_OFF } from './layout.js';
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

// Titik di dinding yang sedang dibidik (sinar mendatar dari mata). Mengembalikan { sp } atau { err }.
function aimWall() {
  const { x: px, z: pz } = state.P, dx = -Math.sin(state.yaw), dz = -Math.cos(state.yaw); let best = null;
  museum.walls.forEach(w => {
    const ex = w.x2 - w.x1, ez = w.z2 - w.z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-6) return;
    const t = ((w.x1 - px) * ez - (w.z1 - pz) * ex) / den, s = ((w.x1 - px) * dz - (w.z1 - pz) * dx) / den;
    if (t > .2 && t < 9 && s >= 0 && s <= 1 && (!best || t < best.t)) best = { t, x: px + dx * t, z: pz + dz * t };
  });
  if (!best) return { err: 'Bidik dinding (maksimal 9 m)' };
  const sp = snapToWall(museum, best.x - dx * .25, best.z - dz * .25, .5);   // titik sedikit di sisi pemain, supaya dinding pembatas memilih sisi yang benar
  if (!sp || Math.hypot(sp.x - best.x, sp.z - best.z) > 1.6 || Math.sin(sp.a) * dx + Math.cos(sp.a) * dz > -.3) return { err: 'Dinding ini tidak bisa dipasangi bingkai (terlalu pendek atau melengkung)' };
  if (!frameOnWall(sp, museum)) return { err: 'Bingkai tidak menempel di dinding ini' };
  return { sp: { x: sp.x, z: sp.z, a: sp.a } };
}
const crowded = (layout, f, skipId) => layout.frames.some(o => o.id !== skipId && Math.hypot(o.x - f.x, o.z - f.z) < FRAME_W * .9 && Math.cos(o.a - f.a) > .5);

// Pasang bingkai baru di dinding yang sedang dibidik (dari sudut pandang orang pertama). vertical = bingkai tegak.
export async function placeFrameFromView(vertical = false) {
  if (!state.access.canManage) { toast('Hanya pemilik yang bisa menambah bingkai'); return false; }
  const layout = state.layout; if (!layout) return false;
  if (layout.frames.length >= MAX_FRAMES) { toast(`Maksimal ${MAX_FRAMES} bingkai`); return false; }
  const r = aimWall(); if (r.err) { toast(r.err); return false; }
  if (crowded(layout, r.sp, -1)) { toast('Sudah ada bingkai di sini. Geser sedikit ke samping'); return false; }
  const next = JSON.parse(JSON.stringify(layout)); let id = 0; while (next.frames.some(o => o.id === id)) id++;
  next.frames.push({ id, ...r.sp, pl: 'b', sp: false, ...(vertical ? { o: 'v' } : {}) });
  if (await commitLayout(next)) { toast(`Bingkai ${id + 1} dipasang. Bidik lalu tekan E untuk mengisi foto`); return true; }
  return false;
}

// ---- geser bingkai: tahan klik / sentuh pada bingkai yang dibidik, arahkan ke tempat lain di dinding, lalu lepas ----
let drag = null;
export const isDraggingFrame = () => !!drag;
export function beginFrameDrag(id) {
  if (!state.access.canManage || drag || id < 0) return false;
  const e = entries[id], f = state.layout && state.layout.frames.find(x => x.id === id); if (!e || !e.frameMesh || !f) return false;
  drag = { id, g: e.frameMesh.parent, orig: { x: f.x, z: f.z, a: f.a }, cur: null };
  toast('Gerakkan bidikan ke tempat lain di dinding, lepas untuk menaruh', 2500); return true;
}
const putGroup = (g, f) => { g.position.set(f.x + Math.sin(f.a) * FRAME_OFF, 2, f.z + Math.cos(f.a) * FRAME_OFF); g.rotation.y = f.a; };
export function updateFrameDrag() {            // dipanggil tiap frame: bingkai mengikuti bidikan (belum disimpan)
  if (!drag) return; const r = aimWall(); if (r.err) return;
  drag.cur = r.sp; putGroup(drag.g, r.sp);
}
export async function endFrameDrag() {
  if (!drag) return false; const d = drag; drag = null; const f = d.cur;
  if (!f || (Math.abs(f.x - d.orig.x) < .01 && Math.abs(f.z - d.orig.z) < .01 && Math.abs(f.a - d.orig.a) < .01)) { putGroup(d.g, d.orig); return false; }
  if (crowded(state.layout, f, d.id)) { putGroup(d.g, d.orig); toast('Sudah ada bingkai di sini, dikembalikan'); return false; }
  const next = JSON.parse(JSON.stringify(state.layout)), t = next.frames.find(x => x.id === d.id); t.x = f.x; t.z = f.z; t.a = f.a;
  if (await commitLayout(next)) return true;
  putGroup(d.g, d.orig); return false;
}
// Hapus bingkai yang sedang dibidik beserta fotonya
export async function removeFrameAimed() {
  if (!state.access.canManage) { toast('Hanya pemilik yang bisa menghapus bingkai'); return false; }
  const id = state.target; if (id < 0) { toast('Bidik bingkai yang ingin dihapus'); return false; }
  if (!confirm(`Hapus bingkai ${id + 1} beserta foto/videonya?`)) return false;
  const next = JSON.parse(JSON.stringify(state.layout)); next.frames = next.frames.filter(f => f.id !== id);
  return commitLayout(next);
}
