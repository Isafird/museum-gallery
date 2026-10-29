import * as THREE from 'three';
import { scene } from './scene.js';
import { ROOM, TITLES, DEFAULT_PHOTO, FRAME_STYLES } from './config.js';
import { analyze, walkable as walk, inFloor, FRAME_OFF, WALL_T, DOOR_W, MAX_LIGHTS } from './layout.js';
import { buildFrame } from './frames3d.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const { H } = ROOM;
export const entries = [];   // entries[id]: { art, canvas, tex, frameMesh, title, data, bmp }  (id = nomor bingkai)
export const pics = [];      // mesh gambar yang bisa dibidik
export const museum = { polys: [], walls: [], bounds: null, layout: null };   // hasil analisis denah
export const defTitle = i => TITLES[i] || `Foto ${i + 1}`;
export const walkable = (x, z, r) => walk(museum, x, z, r);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a4a, .45));   // cahaya dasar; sisanya dari lampu ruangan di denah
const root = new THREE.Group(); scene.add(root);          // seluruh isi museum, dibangun ulang saat denah berubah

// ---- bahan ----
// Dinding / langit-langit / lantai memakai Lambert: tampilannya hampir sama (permukaan buram) tetapi jauh lebih ringan di GPU saat ada banyak lampu
const wallM = new THREE.MeshLambertMaterial({ color: 0xe4e3df });
const ceilM = new THREE.MeshLambertMaterial({ color: 0xf3f2ee, side: THREE.DoubleSide });
const fc = document.createElement('canvas'); fc.width = fc.height = 256;
const fg = fc.getContext('2d');
for (let k = 0; k < 8; k++) { fg.fillStyle = `hsl(25,${35 + Math.random() * 10}%,${24 + Math.random() * 8}%)`; fg.fillRect(0, k * 32, 256, 31); }
const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
const floorM = new THREE.MeshLambertMaterial({ map: ft });

// Lantai/langit-langit datar dari poligon (y = tinggi, up = menghadap atas)
function flatGeo(poly, y, up) {
  const tri = THREE.ShapeUtils.triangulateShape(poly.map(p => new THREE.Vector2(p[0], p[1])), []);
  const pos = [], uv = [], idx = [];
  poly.forEach(p => { pos.push(p[0], y, p[1]); uv.push(p[0] / 4, p[1] / 4); });
  tri.forEach(([a, b, c]) => {
    const ny = (poly[b][1] - poly[a][1]) * (poly[c][0] - poly[a][0]) - (poly[b][0] - poly[a][0]) * (poly[c][1] - poly[a][1]);
    (ny > 0) === up ? idx.push(a, b, c) : idx.push(a, c, b);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ---- lukisan bawaan (tetap sama untuk nomor bingkai yang sama) ----
function makeArt(i) {
  let seed = i * 7919 + 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const c = document.createElement('canvas'); c.width = 960; c.height = 680;
  const g = c.getContext('2d'), h = (i * 37 + 200) % 360;
  const s = g.createLinearGradient(0, 0, 0, 680);
  s.addColorStop(0, `hsl(${h},55%,28%)`); s.addColorStop(.6, `hsl(${(h + 40) % 360},70%,62%)`); s.addColorStop(1, `hsl(${(h + 20) % 360},50%,80%)`);
  g.fillStyle = s; g.fillRect(0, 0, 960, 680);
  g.fillStyle = `hsla(${(h + 60) % 360},90%,85%,.9)`; g.beginPath(); g.arc(180 + rnd() * 600, 150 + rnd() * 100, 40 + rnd() * 40, 0, 7); g.fill();
  for (let k = 0; k < 4; k++) {
    g.fillStyle = `hsl(${(h + k * 18) % 360},${35 + k * 6}%,${34 - k * 7}%)`; g.beginPath(); g.moveTo(0, 680);
    const y = 380 + k * 60;
    for (let x = 0; x <= 960; x += 60) g.lineTo(x, y + Math.sin(x * .01 + k * 2 + i) * 50 * rnd() + rnd() * 30);
    g.lineTo(960, 680); g.closePath(); g.fill();
  }
  return c;
}
// Bingkai tegak: kanvas foto 680 x 960 (mendatar 960 x 680). Tekstur dibuat ulang karena ukurannya berubah.
function setOrient(e, vert) {
  if (e.vert === vert) return;
  e.vert = vert; e.canvas.width = vert ? 680 : 960; e.canvas.height = vert ? 960 : 680;
  e.tex.dispose(); e.tex = new THREE.CanvasTexture(e.canvas); e.rendered = false;
}
export function ensureEntry(id) {
  if (!entries[id]) {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 680;
    entries[id] = { art: makeArt(id), canvas, tex: new THREE.CanvasTexture(canvas), vert: false, frameMesh: null, title: defTitle(id), data: { ...DEFAULT_PHOTO }, bmp: null };
  }
  return entries[id];
}

// ---- bangun ulang museum dari denah ----
function clearRoot() {
  root.children.slice().forEach(o => { root.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.userData.own) c.material.dispose(); }); });
  pics.length = 0;
}
const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: .5, roughness: .4 });
const fixOn = new THREE.MeshBasicMaterial({ color: 0xfff3d6 }), fixOff = new THREE.MeshStandardMaterial({ color: 0x4a4e56, roughness: .8 });
const metalDark = new THREE.MeshStandardMaterial({ color: 0x2b2d33, metalness: .6, roughness: .4 });
let glowTex;
function glow() {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.6, 'rgba(255,230,170,.35)'); gr.addColorStop(1, 'rgba(255,230,170,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(c);
  }
  return glowTex;
}

// ---- papan nama ----
function addPlaque(g, e) {
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, .32, .04), brass));
  if (!e.plq) { const c = document.createElement('canvas'); c.width = 512; c.height = 80; e.plq = { c, tex: new THREE.CanvasTexture(c) }; }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .25), new THREE.MeshBasicMaterial({ map: e.plq.tex })); face.position.z = .022; face.userData.own = true; grp.add(face);
  g.add(grp); e.plaque = grp;
}
export function drawPlaque(i) {
  const e = entries[i]; if (!e || !e.plq) return;
  const c = e.plq.c, x = c.getContext('2d'); x.fillStyle = '#efe6cf'; x.fillRect(0, 0, c.width, c.height);
  let size = 50; x.font = `600 ${size}px Georgia, serif`;
  while (x.measureText(e.title).width > c.width - 40 && size > 18) { size -= 2; x.font = `600 ${size}px Georgia, serif`; }
  x.fillStyle = '#2a2418'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e.title, c.width / 2, c.height / 2 + 2); e.plq.tex.needsUpdate = true;
}

// ---- gaya bingkai ----
export function setFrameStyle(i) {
  const e = entries[i]; if (!e || !e.frameMesh) return;
  const h = e.frameMesh; h.children.slice().forEach(c => { h.remove(c); if (c.geometry) c.geometry.dispose(); });
  buildFrame(h, e.data.frame, e.vert);
  const s = FRAME_STYLES.find(x => x.id === e.data.frame) || FRAME_STYLES[0];
  const extra = e.vert ? .35 : 0;                      // bingkai tegak lebih tinggi: papan nama dan lampu sorot ikut naik / turun
  e.ey = s.ey + extra; e.eyt = (s.eyt || s.ey) + extra;
  if (e.plaque) e.plaque.position.set(0, e.plSide === 't' ? e.eyt + .2 : -(e.ey + .2), .03);
}

// ---- lampu sorot: lampu di langit-langit, berkas cahaya, dan bercak terang di dinding ----
function addSpot(g, ey) {
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.2), new THREE.MeshBasicMaterial({ map: glow(), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.position.set(0, 0, -.044); pool.userData.own = true; g.add(pool);
  const lampY = Math.min(2.2, ey + .9), lp = new THREE.Vector3(0, lampY, .85), tg = new THREE.Vector3(0, -.05, .05), up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(tg, lp, up));   // sumbu +z menuju lukisan
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .9), metalDark); arm.position.set(0, lampY + .1, .4); g.add(arm);
  const head = new THREE.Group(); head.position.copy(lp); head.quaternion.copy(q); g.add(head);
  head.add(new THREE.Mesh(new THREE.CylinderGeometry(.1, .07, .22, 16).rotateX(Math.PI / 2), metalDark));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.085, 16), fixOn); lens.position.z = .112; head.add(lens);
  const L = lp.distanceTo(tg), beamG = new THREE.CylinderGeometry(.03, 1.2, L, 28, 1, true); beamG.translate(0, -L / 2, 0); beamG.rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.userData.own = true; head.add(beam);
}

// ---- lampu ruangan: jumlah cahaya asli (PointLight) dibatasi POOL, karena tiap lampu menambah beban di setiap piksel.
// Kalau lampu <= POOL semuanya menyala seperti biasa. Kalau lebih banyak, cahaya dipakai bergantian untuk lampu yang paling dekat
// dengan pemain, dan berpindah dengan memudar halus (tidak ada kedipan). Fitting lampu tetap terlihat semua.
const LIGHT_I = .9, POOLS = [12, 8, 6, 4];     // mulai 12 (sama seperti sebelumnya); turun otomatis kalau FPS rendah
let POOL = POOLS[0], lamps = [], slots = [];
export function lowerLamps() {                  // dipanggil kualitas otomatis: kurangi jumlah cahaya asli. true kalau ada yang berubah
  const n = POOLS.find(p => p < POOL); if (n === undefined || lamps.length <= n) return false;
  POOL = n; setupLamps(lamps); return true;
}
function setupLamps(list) {
  slots.forEach(s => root.remove(s.light)); lamps = list; slots = [];
  for (let i = 0; i < Math.min(POOL, list.length); i++) {
    const light = new THREE.PointLight(0xfff1dc, LIGHT_I, 16); root.add(light);
    slots.push({ light, lamp: i, level: 1 }); light.position.set(list[i].x, H - .4, list[i].z);
  }
}
let acc = 1;
export function updateLamps(dt, px, pz) {
  if (lamps.length <= POOL) return;
  const fade = dt * 3; let want = null;
  acc += dt; if (acc > .25) {                                      // pilih lampu terdekat 4x per detik
    acc = 0; want = new Set(lamps.map((l, i) => [Math.hypot(l.x - px, l.z - pz), i]).sort((a, b) => a[0] - b[0]).slice(0, POOL).map(a => a[1]));
    slots.forEach(s => { s.keep = want.has(s.lamp); if (s.keep) want.delete(s.lamp); });
    slots.forEach(s => { if (!s.keep && s.next === undefined && want.size) { s.next = want.values().next().value; want.delete(s.next); } });
  }
  slots.forEach(s => {
    if (s.next !== undefined && !s.keep) {                         // memudar dulu, pindah saat gelap, lalu menyala lagi
      s.level = Math.max(0, s.level - fade);
      if (s.level === 0) { s.lamp = s.next; s.next = undefined; s.keep = true; const l = lamps[s.lamp]; s.light.position.set(l.x, H - .4, l.z); }
    } else s.level = Math.min(1, s.level + fade);
    s.light.intensity = LIGHT_I * s.level;
  });
}

export function buildMuseum(layout) {
  clearRoot();
  const m = analyze(layout); Object.assign(museum, m, { layout });
  const merged = (list, mat) => { if (list.length) root.add(new THREE.Mesh(list.length > 1 ? mergeBufferGeometries(list) : list[0], mat)); };
  merged(m.polys.map((poly, i) => flatGeo(poly, i * .001, true)), floorM);       // lantai + langit-langit: satu mesh per jenis
  merged(m.polys.map((poly, i) => flatGeo(poly, H - i * .001, false)), ceilM);
  const solid = (w, h, y, x, z, ry) => { const g = new THREE.BoxGeometry(w, h, WALL_T); g.rotateY(ry); g.translate(x, y, z); return g; };
  const boxes = m.walls.map(w => { const dx = w.x2 - w.x1, dz = w.z2 - w.z1; return solid(Math.hypot(dx, dz) + WALL_T, H, H / 2, (w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2, -Math.atan2(dz, dx)); });
  (layout.doors || []).forEach(d => boxes.push(solid(DOOR_W, H - 2.5, 2.5 + (H - 2.5) / 2, d.x, d.z, d.a)));   // ambang atas pintu
  merged(boxes, wallM);                                            // semua dinding + ambang pintu jadi satu mesh
  const lamps = [];                                                // lampu ruangan (yang mati tetap terlihat sebagai fitting gelap)
  m.lights.forEach(L => {
    if (!inFloor(m, L.x, L.z)) return;
    const fx = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .06, 20), L.on ? fixOn : fixOff); fx.position.set(L.x, H - .03, L.z); root.add(fx);
    if (L.on && lamps.length < MAX_LIGHTS) lamps.push({ x: L.x, z: L.z });
  });
  setupLamps(lamps);
  layout.frames.forEach(f => {                                     // bingkai + papan nama + lampu sorot
    const e = ensureEntry(f.id), g = new THREE.Group(); setOrient(e, f.o === 'v');
    g.position.set(f.x + Math.sin(f.a) * FRAME_OFF, 2, f.z + Math.cos(f.a) * FRAME_OFF); g.rotation.y = f.a;
    const holder = new THREE.Group(); g.add(holder); e.frameMesh = holder;
    const p = new THREE.Mesh(e.vert ? new THREE.PlaneGeometry(1.7, 2.4) : new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshBasicMaterial({ map: e.tex }));
    p.position.z = .06; p.userData.i = f.id; p.userData.own = true; g.add(p);
    e.plSide = f.pl || 'b'; e.plaque = null; if (e.plSide !== 'n') addPlaque(g, e);
    setFrameStyle(f.id); drawPlaque(f.id);
    if (f.sp) addSpot(g, e.ey);
    root.add(g); pics.push(p);
  });
}
