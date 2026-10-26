import * as THREE from 'three';
import { scene } from './scene.js';
import { ROOM, TITLES, DEFAULT_PHOTO } from './config.js';
import { analyze, walkable as walk, inFloor, FRAME_OFF, WALL_T } from './layout.js';

const { H } = ROOM;
export const entries = [];   // entries[id]: { art, canvas, tex, frameMesh, title, data, bmp }  (id = nomor bingkai)
export const pics = [];      // mesh gambar yang bisa dibidik
export const museum = { polys: [], walls: [], bounds: null, layout: null };   // hasil analisis denah
export const defTitle = i => TITLES[i] || `Foto ${i + 1}`;
export const walkable = (x, z, r) => walk(museum, x, z, r);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a4a, .75));
const root = new THREE.Group(); scene.add(root);          // seluruh isi museum, dibangun ulang saat denah berubah

// ---- bahan ----
const wallM = new THREE.MeshStandardMaterial({ color: 0xe4e3df, roughness: .95 });
const ceilM = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, side: THREE.DoubleSide });
const fc = document.createElement('canvas'); fc.width = fc.height = 256;
const fg = fc.getContext('2d');
for (let k = 0; k < 8; k++) { fg.fillStyle = `hsl(25,${35 + Math.random() * 10}%,${24 + Math.random() * 8}%)`; fg.fillRect(0, k * 32, 256, 31); }
const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
const floorM = new THREE.MeshStandardMaterial({ map: ft, roughness: .6 });

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
export function ensureEntry(id) {
  if (!entries[id]) {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 680;
    entries[id] = { art: makeArt(id), canvas, tex: new THREE.CanvasTexture(canvas), frameMesh: null, title: defTitle(id), data: { ...DEFAULT_PHOTO }, bmp: null };
  }
  return entries[id];
}

// ---- bangun ulang museum dari denah ----
function clearRoot() {
  root.children.slice().forEach(o => { root.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.userData.own) c.material.dispose(); }); });
  pics.length = 0;
}
export function buildMuseum(layout) {
  clearRoot();
  const m = analyze(layout); Object.assign(museum, m, { layout });
  m.polys.forEach((poly, i) => {                                   // lantai + langit-langit tiap bentuk
    root.add(new THREE.Mesh(flatGeo(poly, i * .001, true), floorM));
    root.add(new THREE.Mesh(flatGeo(poly, H - i * .001, false), ceilM));
  });
  m.walls.forEach(w => {                                           // dinding
    const dx = w.x2 - w.x1, dz = w.z2 - w.z1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz) + WALL_T, H, WALL_T), wallM);
    mesh.position.set((w.x1 + w.x2) / 2, H / 2, (w.z1 + w.z2) / 2); mesh.rotation.y = -Math.atan2(dz, dx); root.add(mesh);
  });
  const b = m.bounds, lights = [];                                 // lampu tiap ~6 m di dalam lantai
  for (let x = b.minx + 3; x < b.maxx && lights.length < 10; x += 6)
    for (let z = b.minz + 3; z < b.maxz && lights.length < 10; z += 6) if (inFloor(m, x, z)) lights.push([x, z]);
  if (!lights.length) lights.push([(b.minx + b.maxx) / 2, (b.minz + b.maxz) / 2]);
  lights.forEach(([x, z]) => { const p = new THREE.PointLight(0xfff1dc, .5, 14); p.position.set(x, H - .4, z); root.add(p); });
  layout.frames.forEach(f => {                                     // bingkai
    const e = ensureEntry(f.id), g = new THREE.Group();
    g.position.set(f.x + Math.sin(f.a) * FRAME_OFF, 2, f.z + Math.cos(f.a) * FRAME_OFF); g.rotation.y = f.a;
    const fm = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2, .1), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: .5 }));
    fm.material.userData = {}; fm.userData.own = true; g.add(fm);
    const pm = new THREE.MeshBasicMaterial({ map: e.tex }), p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), pm);
    p.position.z = .06; p.userData.i = f.id; p.userData.own = true; g.add(p); root.add(g);
    e.frameMesh = fm; pics.push(p);
  });
}
