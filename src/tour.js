import * as THREE from 'three';
import { renderer, camera, scene, sizeLock } from './scene.js';
import { state } from './state.js';
import { walkable, museum, fx } from './gallery.js';
import { findSpawn, frameGap, FRAME_OFF, segD } from './layout.js';
import { openModal, toggleModal } from './modal.js';
import { setTimeMode, timeMode } from './daytime.js';
import { audioStream, startAudio } from './audio.js';
import { toast } from './toast.js';

// Tur otomatis: kamera berjalan sendiri melewati semua bingkai (rute dicari lewat denah, tidak menembus dinding),
// berhenti sebentar di tiap bingkai, dan bisa direkam menjadi video (potret atau landscape) untuk diunduh.
const $ = id => document.getElementById(id);
const CELL = .5, CAM_Y = 1.6, LOOK_Y = 1.85, STAND_D = 3.4, MIN_D = 1.4;
const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const lerpA = (a, b, w) => a + wrap(b - a) * w, lerp = (a, b, w) => a + (b - a) * w;

// ---------- peta kotak untuk mencari jalan ----------
let cache = null;
function prepare() {
  const L = museum.layout; if (cache && cache.L === L) return cache;
  const b = museum.bounds, minx = b.minx - CELL, minz = b.minz - CELL;
  const W = Math.ceil((b.maxx - b.minx) / CELL) + 3, H = Math.ceil((b.maxz - b.minz) / CELL) + 3, ok = new Uint8Array(W * H);
  const pen = new Float32Array(W * H);                                            // biaya tambahan di dekat dinding: jalur memilih bagian tengah ruangan/bukaan
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const X = minx + x * CELL, Z = minz + z * CELL, i = z * W + x; ok[i] = walkable(X, Z, .4) ? 1 : 0; if (!ok[i]) continue;
    pen[i] = !walkable(X, Z, .7) ? 4 : !walkable(X, Z, 1.0) ? 2 : !walkable(X, Z, 1.4) ? .6 : 0;
  }
  const c = { L, minx, minz, W, H, ok, pen, stops: [] };
  const cellOf = (x, z) => {
    const cx = Math.round((x - minx) / CELL), cz = Math.round((z - minz) / CELL);
    let best = -1, bd = 1e9;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const X = cx + dx, Z = cz + dz; if (X < 0 || Z < 0 || X >= W || Z >= H || !ok[Z * W + X]) continue;
      const d = Math.hypot(minx + X * CELL - x, minz + Z * CELL - z); if (d < bd) { bd = d; best = Z * W + X; }
    }
    return best;
  };
  c.cellOf = cellOf; c.pos = i => [minx + (i % W) * CELL, minz + Math.floor(i / W) * CELL];
  (L.frames || []).forEach(f => {                                  // titik berdiri di depan tiap bingkai
    const nx = Math.sin(f.a), nz = Math.cos(f.a); let placed = false;
    for (let pass = 0; pass < 2; pass++) for (let d = STAND_D; d >= MIN_D - 1e-6; d -= .2) {          // utamakan titik yang tidak terlalu mepet dinding di seberangnya
      const clearOnly = pass === 0; if (placed) break;
      const x = f.x + nx * d, z = f.z + nz * d;
      if (!walkable(x, z, .4) || (clearOnly && !walkable(x, z, .6))) continue;
      const cell = cellOf(x, z); if (cell < 0) continue;
      c.stops.push({ id: f.id, x, z, a: f.a, d, vert: f.o === 'v', tr: f.tr, cell, dm: null }); placed = true; break;
    }
  });
  return (cache = c);
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() {
    const k = this.k, v = this.v, rv = v[0], lk = k.pop(), lv = v.pop(), n = k.length; if (!n) return rv;
    let i = 0; for (;;) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
    k[i] = lk; v[i] = lv; return rv;
  }
}
const S2 = Math.SQRT2;
function dijkstra(c, src, dst = -1) {
  const { W, H, ok, pen } = c, dist = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), h = new Heap();
  dist[src] = 0; h.push(0, src);
  while (h.size) {
    const u = h.pop(), du = dist[u]; if (u === dst) break;
    const ux = u % W, uz = (u / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const X = ux + dx, Z = uz + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue;
      const v = Z * W + X; if (!ok[v]) continue;
      if (dx && dz && (!ok[uz * W + X] || !ok[Z * W + ux])) continue;      // jangan memotong sudut dinding
      const nd = du + (dx && dz ? S2 : 1) * (1 + pen[v]); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(nd, v); }
    }
  }
  return { dist, prev };
}
const dmap = (c, s) => s.dm || (s.dm = dijkstra(c, s.cell).dist);

// ---------- jalur halus ----------
const clear = (a, b, r = .75) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .2));
  for (let i = 0; i <= n; i++) if (!walkable(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, r)) return false;
  return true;
};
function chaikin(p) { const o = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } o.push(p[p.length - 1]); return o; }
function makePath(c, a, b) {            // a, b: { x, z, cell }
  let pts = [[a.x, a.z]];
  if (a.cell !== b.cell) {
    const { dist, prev } = dijkstra(c, a.cell, b.cell); if (!isFinite(dist[b.cell])) return null;
    const cells = []; for (let i = b.cell; i >= 0; i = prev[i]) cells.push(i); cells.reverse(); cells.forEach(i => pts.push(c.pos(i)));
  }
  pts.push([b.x, b.z]);
  const pulled = [pts[0]]; let i = 0;                                          // tarik lurus selama tidak ada dinding
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i], pts[j])) j--; pulled.push(pts[j]); i = j; }
  let sm2 = pulled;
  if (pulled.length > 2) {
    let t = chaikin(chaikin(pulled)); if (!t.every((q, k) => k === 0 || k === t.length - 1 || walkable(q[0], q[1], .5))) { t = chaikin(pulled); if (!t.every((q, k) => k === 0 || k === t.length - 1 || walkable(q[0], q[1], .5))) t = pulled; }
    sm2 = t;
  }
  const cum = [0]; for (let k = 1; k < sm2.length; k++) cum.push(cum[k - 1] + Math.hypot(sm2[k][0] - sm2[k - 1][0], sm2[k][1] - sm2[k - 1][1]));
  return { pts: sm2, cum, L: cum[cum.length - 1] };
}
function at(p, s) {
  s = Math.max(0, Math.min(p.L, s)); let k = 1; while (k < p.cum.length - 1 && p.cum[k] < s) k++;
  const l = p.cum[k] - p.cum[k - 1] || 1, t = (s - p.cum[k - 1]) / l, a = p.pts[k - 1], b = p.pts[k];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
const headYaw = (p, s) => {
  let a = Math.min(s, p.L - .01), b = Math.min(p.L, s + 1.2); if (b - a < .3) a = Math.max(0, p.L - 1.2);
  const A = at(p, a), B = at(p, b); return Math.atan2(-(B[0] - A[0]), -(B[1] - A[1]));
};

// ---------- menyusun urutan dan jadwal ----------
const SPEEDS = { santai: 1.8, normal: 2.5, cepat: 3.4 };
function frameFov(stop, d, aspect) {     // sudut pandang yang pas supaya satu bingkai (dan papan namanya) penuh terlihat
  const w = stop.vert ? 2.5 : 3.4, h = stop.vert ? 3.5 : 2.9;
  const hf = 2 * Math.atan(w / 2 / d), vw = 2 * Math.atan(Math.tan(hf / 2) / aspect), vh = 2 * Math.atan(h / 2 / d);
  return Math.max(46, Math.min(98, Math.max(vw, vh) * 180 / Math.PI));
}
function turnDelta(fromA, toA, v) {      // sudut putar total; kalau hampir berbalik 180 derajat, arah putarnya mengikuti arah gerak supaya tidak bolak-balik
  let D = wrap(toA - fromA);
  if (Math.abs(D) > Math.PI - .35) { const side = v[0] * -Math.cos(fromA) + v[1] * Math.sin(fromA); if (side > 0 && D < 0) D += Math.PI * 2; else if (side < 0 && D > 0) D -= Math.PI * 2; }
  return D;
}
function plan(o) {
  const c = prepare(); if (!c.stops.length) return null;
  const sx = walkable(state.P.x, state.P.z, .4) ? state.P.x : findSpawn(museum)[0], sz = walkable(state.P.x, state.P.z, .4) ? state.P.z : findSpawn(museum)[1];
  const start = { x: sx, z: sz, cell: c.cellOf(sx, sz) }; if (start.cell < 0) return null;
  const sd = dijkstra(c, start.cell).dist;
  let stops = c.stops.filter(s => s.tr !== 's' && isFinite(sd[s.cell]));        // bingkai yang ditandai "lewati" tidak dikunjungi
  if (!stops.length) return null;
  if (o.order === 'id') stops.sort((p, q) => p.id - q.id);
  else {
    const d = (i, j) => dmap(c, stops[i])[stops[j].cell], rest = stops.map((_, i) => i), ord = []; let cur = -1;
    while (rest.length) {                                                       // terdekat dulu
      let bi = 0, bd = Infinity; rest.forEach((j, k) => { const v = cur < 0 ? sd[stops[j].cell] : d(cur, j); if (v < bd) { bd = v; bi = k; } });
      cur = rest.splice(bi, 1)[0]; ord.push(cur);
    }
    const D = (i, j) => i < 0 ? sd[stops[ord[j]].cell] : d(ord[i], ord[j]), n = ord.length;   // lalu rapikan dengan 2-opt
    for (let pass = 0, imp = true; imp && pass < 40; pass++) {
      imp = false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const delta = D(i - 1, j) + (j < n - 1 ? D(i, j + 1) : 0) - D(i - 1, i) - (j < n - 1 ? D(j, j + 1) : 0);
        if (delta < -1e-3) { for (let a = i, b = j; a < b; a++, b--) [ord[a], ord[b]] = [ord[b], ord[a]]; imp = true; }
      }
    }
    stops = ord.map(i => stops[i]);
  }
  const aspect = o.W / o.H, baseFov = aspect < 1 ? 82 : 64, v = SPEEDS[o.speed] || SPEEDS.normal;
  const doors = (museum.layout && museum.layout.doors) || [], segs = [], dips = []; let t = 0, prev = { ...start, a: state.yaw, fov: baseFov, pitch: 0 };
  stops.forEach(s => {
    const path = makePath(c, prev, s); if (!path) return;
    const fov = frameFov(s, s.d - .2, aspect), pitch = Math.atan2(LOOK_Y - CAM_Y, s.d - .2);
    const ta = Math.min(1.0, Math.max(.4, path.L / v / 3));
    const crab = !!o.crab && prev.id !== undefined && Math.abs(wrap(s.a - prev.a)) < .9 && path.L < 12;      // bingkai berdekatan: geser menyamping, kamera tidak berputar
    const D = turnDelta(prev.a, s.a, [s.x - prev.x, s.z - prev.z]);               // satu putaran mulus dari arah lama ke arah bingkai berikutnya
    const dur = Math.max(1.4, path.L / v + ta, 1.2 + Math.abs(D) / .75);          // cukup lama supaya putarannya pelan (tidak menyentak)
    segs.push({ k: 'go', t0: t, dur, path, ta, crab, D, from: prev, to: { ...s, fov, pitch } });
    if (o.doorfade && doors.length) {                                          // melewati pintu: catat saatnya untuk pudar singkat (tiap pintu yang dilewati)
      const vv = path.L / (dur - ta), sAt = tt => tt < ta ? vv * tt * tt / (2 * ta) : tt > dur - ta ? path.L - vv * (dur - tt) * (dur - tt) / (2 * ta) : vv * (tt - ta / 2);
      doors.forEach(d => {
        const nx = Math.sin(d.a), nz = Math.cos(d.a); let sD = -1, last = null;      // melintasi bidang pintu (lebar bukaan antar ruangan bisa sampai 5 m)
        for (let q = .3; q < path.L - .3 && sD < 0; q += .1) { const [px, pz] = at(path, q), side = (px - d.x) * nx + (pz - d.z) * nz, lat = Math.abs((px - d.x) * nz - (pz - d.z) * nx); if (last !== null && last * side < 0 && lat < 3.2) sD = q; last = side; }
        if (sD < 0) return; let tt = 0; while (tt < dur && sAt(tt) < sD) tt += .03; dips.push(t + tt);
      });
    }
    t += dur;
    const dwell = o.dwell * (s.tr === 'l' ? 2 : s.tr === 'x' ? 3 : 1);        // bingkai yang ditandai berhenti lebih lama
    segs.push({ k: 'stay', t0: t, dur: dwell, s, fov, pitch }); t += dwell;
    prev = { id: s.id, x: s.x, z: s.z, cell: s.cell, a: s.a, fov, pitch };
  });
  if (!segs.length) return null;
  return { segs, dips, T: t + 1.2, n: stops.length, W: o.W, H: o.H, aspect, baseFov, o };
}
function pose(P, t) {       // posisi dan arah kamera pada detik ke-t (+ gerak sinematik: napas langkah dan goyangan halus)
  const p = pose0(P, t); if (P.o.style !== 'cine') return p;
  const mv = p.mv || 0;
  p.y = CAM_Y + Math.sin(t * 7.2) * .022 * mv + Math.sin(t * .9) * .012;
  p.yaw += Math.sin(t * 1.3) * .005 + Math.sin(t * 2.9) * .003; p.pitch += Math.sin(t * 1.7) * .004 + Math.sin(t * 6.1) * .003 * mv;
  p.roll = Math.sin(t * 3.6) * .004 * mv;
  return p;
}
function pose0(P, t) {
  let seg = P.segs[P.segs.length - 1]; for (const s of P.segs) if (t < s.t0 + s.dur) { seg = s; break; }
  const u = t - seg.t0;
  if (seg.k === 'stay') {                         // diam di depan bingkai: hanya goyangan halus yang memudar di awal dan akhir (tidak ada lompatan ke gerakan berikutnya)
    const s = seg.s, nx = Math.sin(s.a), nz = Math.cos(s.a), env = sm(u / 1.0) * sm((seg.dur - u) / 1.0), side = Math.sin(t * .6) * .07 * env;
    return { x: s.x + nz * side, z: s.z - nx * side, yaw: s.a + Math.sin(t * .5) * .012 * env, pitch: seg.pitch, fov: seg.fov, mv: 0 };
  }
  const { path, ta, dur, from, to } = seg, vv = path.L / (dur - ta), tt = Math.min(u, dur);
  const s = tt < ta ? vv * tt * tt / (2 * ta) : tt > dur - ta ? path.L - vv * (dur - tt) * (dur - tt) / (2 * ta) : vv * (tt - ta / 2);
  const [x, z] = at(path, s);
  const mv = Math.min(1, Math.sqrt(Math.max(0, tt < ta ? vv * tt / ta : tt > dur - ta ? vv * (dur - tt) / ta : vv)) / 1.4);   // 0 saat diam, 1 saat berjalan
  const W = sm(tt / dur);                                                      // satu putaran halus sepanjang perjalanan (tanpa wrap, jadi tidak ada lompatan)
  let yaw = from.a + seg.D * W, fov = from.fov + (to.fov - from.fov) * W;
  if (!seg.crab && path.L > 5) {                                               // perjalanan jauh: kamera sedikit condong ke arah jalan, memudar di awal dan akhir
    const b = Math.sin(Math.PI * Math.min(1, s / path.L)) ** 2;
    yaw += Math.sin(headYaw(path, s) - yaw) * .6 * b; fov += (P.baseFov - fov) * .6 * b;
  }
  return { x, z, mv, yaw, pitch: from.pitch + (to.pitch - from.pitch) * W, fov };
}

// ---------- menjalankan tur ----------
let run = null, fade = null, vig = null;
function vignetteMesh() {                                      // bayangan lembut di tepi gambar (ikut terekam)
  if (vig) return vig;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.6, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,.62)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false }));
  vig.position.z = -.29; vig.renderOrder = 9998; vig.frustumCulled = false; scene.add(camera); camera.add(vig); return vig;
}
export const tourActive = () => !!run;
export function togglePauseTour() {              // jeda / lanjutkan: waktu tur berhenti dan rekaman ikut dijeda (bagian jeda tidak masuk video)
  if (!run || run.stopping) return;
  run.paused = !run.paused;
  try { if (run.rec) { if (run.paused && run.rec.state === 'recording') run.rec.pause(); else if (!run.paused && run.rec.state === 'paused') run.rec.resume(); } } catch (e) {}
  $('tr-pause').textContent = run.paused ? 'Lanjut [Spasi]' : 'Jeda [Spasi]'; $('tourbar').classList.toggle('paused', run.paused);
}
function fadeMesh() {
  if (fade) return fade;
  fade = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, depthTest: false, depthWrite: false }));
  fade.position.z = -.3; fade.renderOrder = 9999; fade.frustumCulled = false; scene.add(camera); camera.add(fade); return fade;
}
const mimeList = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const pickMime = () => (window.MediaRecorder && mimeList.find(m => MediaRecorder.isTypeSupported(m))) || '';
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function startTour(opts) {
  if (run || !state.active) return false;
  const [W, H] = opts.size.split('x').map(Number), o = { ...opts, W, H };
  const P = plan(o); if (!P) { toast('Tidak ada bingkai yang bisa dikunjungi'); return false; }
  const canvas = renderer.domElement;
  const prevTime = timeMode(); if (o.time !== 'keep') setTimeMode(o.time);
  const saved = { pr: renderer.getPixelRatio(), time: prevTime, aspect: camera.aspect, fov: camera.fov };
  sizeLock.fixed = true; renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  Object.assign(canvas.style, { width: '100vw', height: '100vh', objectFit: 'contain' }); document.body.style.background = '#000';
  document.body.classList.add('touring'); state.touring = true; if (document.pointerLockElement) document.exitPointerLock();
  fadeMesh().material.opacity = 1;
  if (o.style === 'cine') { vignetteMesh().visible = true; fx.spot = 1.5; fx.lamp = 1.12; }
  $('tr-pause').textContent = 'Jeda [Spasi]'; $('tourbar').classList.remove('paused');
  run = { P, t: 0, paused: false, saved, rec: null, chunks: [], mime: '', stopping: false, shown: -1 };
  if (o.rec) {
    try {
      const mime = pickMime(); if (!mime) throw new Error('Browser tidak mendukung perekaman video');
      const stream = canvas.captureStream(30);
      if (o.audio) { startAudio(); const as = audioStream(); if (as) as.getAudioTracks().forEach(tr => stream.addTrack(tr)); }
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: W * H > 1.5e6 ? 10e6 : 6e6 });
      rec.ondataavailable = e => { if (e.data && e.data.size) run && run.chunks.push(e.data); };
      run.rec = rec; run.mime = mime; rec.start(1000);
    } catch (e) { toast('Perekaman tidak bisa dimulai: ' + (e.message || e)); }
  }
  $('tourbar').querySelector('b').textContent = run.rec ? 'Merekam' : 'Tur';
  $('tourbar').classList.toggle('rec', !!run.rec);
  return true;
}

export function stopTour(done = false) {          // done: selesai sampai akhir (bukan dihentikan manual)
  if (!run || run.stopping) return; run.stopping = true;
  const r = run, finish = () => {
    const canvas = renderer.domElement, s = r.saved;
    sizeLock.fixed = false; renderer.setPixelRatio(s.pr); renderer.setSize(innerWidth, innerHeight);
    Object.assign(canvas.style, { objectFit: '' }); document.body.style.background = '';
    camera.aspect = innerWidth / innerHeight; camera.fov = s.fov; camera.updateProjectionMatrix();
    if (fade) fade.material.opacity = 0; if (vig) vig.visible = false; fx.spot = 1; fx.lamp = 1; camera.rotation.z = 0;
    if (r.P.o.time !== 'keep') setTimeMode(s.time);
    document.body.classList.remove('touring'); state.touring = false; run = null;
    state.pitch = 0;
    const blob = r.chunks.length ? new Blob(r.chunks, { type: r.mime.split(';')[0] }) : null;
    showDone(r, blob, done);
  };
  if (r.rec && r.rec.state !== 'inactive') { r.rec.onstop = finish; try { r.rec.stop(); } catch (e) { finish(); } } else finish();
}

export const tourSeek = t => { if (run) run.t = t; };      // untuk pengujian otomatis
export const tourPose = t => run && pose(run.P, t);
// Pemeriksaan kualitas (untuk pengujian): seberapa penuh/tengah bingkai di layar saat berhenti, dan jarak kamera ke dinding dan bingkai lain
export function tourAudit() {
  if (!run) return null; const P = run.P, frames = museum.layout.frames || [], cam = new THREE.PerspectiveCamera(60, P.aspect, .1, 100), V = new THREE.Vector3(), bad = []; cam.rotation.order = 'YXZ';
  const box = f => { const vert = f.o === 'v', off = FRAME_OFF + frameGap(museum, f, vert), nx = Math.sin(f.a), nz = Math.cos(f.a); return { vert, cx: f.x + nx * off, cz: f.z + nz * off, tx: nz, tz: -nx, hw: vert ? 1.0 : 1.35, hh: vert ? 1.35 : 1.0 }; };
  const stops = [];
  P.segs.filter(s => s.k === 'stay').forEach(seg => {
    const p = pose(P, seg.t0 + seg.dur * .5), f = frames.find(q => q.id === seg.s.id), b = box(f);
    cam.fov = p.fov; cam.position.set(p.x, p.y || CAM_Y, p.z); cam.rotation.set(p.pitch, p.yaw, p.roll || 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { V.set(b.cx + b.tx * b.hw * sx, 2 + b.hh * sy, b.cz + b.tz * b.hw * sx).project(cam); x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); y0 = Math.min(y0, V.y); y1 = Math.max(y1, V.y); });
    stops.push({ id: f.id, vert: b.vert, d: +seg.s.d.toFixed(2), fov: +p.fov.toFixed(0), w: +((x1 - x0) / 2).toFixed(2), h: +((y1 - y0) / 2).toFixed(2), cx: +((x0 + x1) / 2).toFixed(2), cy: +((y0 + y1) / 2).toFixed(2), clip: x0 < -1 || x1 > 1 || y0 < -1 || y1 > 1 });
  });
  let minWall = 9, minFrame = 9, nearFrame = 0, nearWall = 0;
  const bx = frames.map(box);
  for (let t = 0; t < P.T; t += .1) {
    const p = pose(P, t); let w = 9; museum.walls.forEach(q => { w = Math.min(w, segD(p.x, p.z, q.x1, q.z1, q.x2, q.z2)); }); minWall = Math.min(minWall, w); if (w < .6) { nearWall++; if (bad.length < 12) bad.push([+t.toFixed(1), +p.x.toFixed(1), +p.z.toFixed(1), +w.toFixed(2)]); }
    bx.forEach((b, i) => { const seg = P.segs.find(s => s.k === 'stay' && s.s.id === frames[i].id); if (seg && t >= seg.t0 - .5 && t <= seg.t0 + seg.dur + .5) return;
      const u = Math.max(-b.hw, Math.min(b.hw, (p.x - b.cx) * b.tx + (p.z - b.cz) * b.tz)), d = Math.hypot(p.x - (b.cx + b.tx * u), p.z - (b.cz + b.tz * u)); minFrame = Math.min(minFrame, d); if (d < .7) nearFrame++; });
  }
  return { stops, bad, minWall: +minWall.toFixed(2), nearWall, minFrame: +minFrame.toFixed(2), nearFrame };
}
export const tourInfo = () => run && { t: run.t, T: run.P.T, n: run.P.n, segs: run.P.segs.length, dips: run.P.dips };
export function tourUpdate(dt) {                  // dipanggil tiap frame dari loop utama
  if (!run) return;
  if (!run.paused) run.t += Math.min(dt, .1);
  const P = run.P, p = pose(P, Math.min(run.t, P.T));
  state.P.x = p.x; state.P.z = p.z; if (state.me) state.me.visible = false;
  camera.position.set(p.x, p.y || CAM_Y, p.z); camera.rotation.set(p.pitch, p.yaw, p.roll || 0);
  camera.aspect = P.aspect; camera.fov = p.fov; camera.updateProjectionMatrix();
  const f = Math.max(0, 1 - run.t / .9), g = Math.max(0, 1 - (P.T - run.t) / .9); let dip = 0;
  for (const d of P.dips) dip = Math.max(dip, sm(1 - Math.abs(run.t - d) / .45));                 // pudar singkat saat melewati pintu
  fadeMesh().material.opacity = Math.max(f, g, dip);
  if (vig) { const hh = Math.tan(p.fov * Math.PI / 360) * .29 * 2.04; vig.scale.set(hh * P.aspect, hh, 1); }
  const sec = Math.floor(run.t);
  if (sec !== run.shown) { run.shown = sec; $('tr-time').textContent = fmt(run.t) + ' / ' + fmt(P.T); }
  $('tr-bar').style.width = Math.min(100, run.t / P.T * 100) + '%';
  if (run.t >= P.T) stopTour(true);
}

// ---------- tampilan ----------
let objUrl = '';
function showDone(r, blob, done) {
  const m = $('tour'); if (!openModal()) toggleModal(m);
  $('tourset').style.display = 'none'; $('tourdone').style.display = '';
  if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = ''; }
  const vid = $('tr-vid'), dl = $('tr-dl'), note = $('tr-note');
  if (blob) {
    objUrl = URL.createObjectURL(blob); vid.src = objUrl; vid.style.display = '';
    const ext = r.mime.includes('mp4') ? 'mp4' : 'webm', name = 'museum-tur-' + (r.P.aspect < 1 ? 'potret' : 'landscape') + '.' + ext;
    dl.href = objUrl; dl.download = name; dl.style.display = '';
    vid.style.aspectRatio = r.P.W + ' / ' + r.P.H; vid.style.maxHeight = r.P.aspect < 1 ? '60vh' : '';
    note.textContent = (done ? 'Tur selesai. ' : 'Tur dihentikan. ') + 'Video ' + ext.toUpperCase() + ', ' + r.P.W + '×' + r.P.H + ', ' + (blob.size / 1048576).toFixed(1) + ' MB.' + (ext === 'webm' ? ' Format WebM bisa diputar di Chrome, VLC, dan sebagian besar editor video.' : '');
  } else {
    vid.style.display = 'none'; dl.style.display = 'none'; note.textContent = done ? 'Tur selesai.' : 'Tur dihentikan.';
  }
}
function resetModal() {
  $('tourset').style.display = ''; $('tourdone').style.display = 'none';
  const v = $('tr-vid'); v.pause(); v.removeAttribute('src'); v.load(); if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = ''; }
  info();
}
const readOpts = () => ({
  size: $('tr-asp').value, dwell: +$('tr-dwell').value, speed: $('tr-speed').value, order: $('tr-order').value,
  crab: $('tr-crab').checked, style: $('tr-style').value, doorfade: $('tr-door').checked, time: $('tr-time-sel').value, audio: $('tr-aud').checked, rec: $('tr-rec').checked,
});
let infoTimer = 0;
function info() {
  clearTimeout(infoTimer); $('tr-info').textContent = 'Menghitung rute...';
  infoTimer = setTimeout(() => {
    if (!state.active) return;
    const o = readOpts(), [W, H] = o.size.split('x').map(Number);
    let P = null; try { P = plan({ ...o, W, H }); } catch (e) { console.error(e); }
    const total = (museum.layout && museum.layout.frames || []).length;
    $('tr-info').textContent = P ? `${P.n} dari ${total} bingkai, perkiraan ${fmt(P.T)} menit.` : 'Belum ada bingkai yang bisa dikunjungi. Pasang bingkai lewat denah dulu.';
    $('tr-go').disabled = !P;
  }, 60);
}
export function openTour() {
  if (!state.active || run) return;
  const m = $('tour'); if (!m.classList.contains('open')) { if (openModal()) return; resetModal(); toggleModal(m); } else toggleModal(m);
}
export function initTour() {
  ['tr-asp', 'tr-dwell', 'tr-speed', 'tr-order', 'tr-crab', 'tr-style', 'tr-door'].forEach(id => $(id).addEventListener('change', info));
  $('tr-rec').addEventListener('change', () => { $('tr-aud').disabled = !$('tr-rec').checked; });
  $('tr-go').onclick = () => { const o = readOpts(); toggleModal($('tour')); setTimeout(() => startTour(o), 60); };
  $('tr-close').onclick = () => toggleModal($('tour')); $('tr-close2').onclick = () => { toggleModal($('tour')); };
  $('tr-again').onclick = resetModal;
  $('tr-stop').onclick = () => stopTour(false); $('tr-pause').onclick = e => { togglePauseTour(); e.currentTarget.blur(); };
  $('tourbtn').onclick = e => { openTour(); e.currentTarget.blur(); };
}
