import * as THREE from 'three';
import { pics, entries } from './gallery.js';
import { drawVideoFrame } from './photos.js';

// Video di bingkai: hanya video yang dekat dan sedang terlihat yang diputar (paling banyak MAX_PLAY sekaligus),
// sisanya dijeda dan menampilkan bingkai terakhirnya. Video tanpa suara, berulang terus.
const MAX_PLAY = 2, RANGE = 14, STEP_MS = 40;
const fr = new THREE.Frustum(), m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), sph = new THREE.Sphere(v3, 1.6);
let list = [];
export function updateVideos(camera) {
  if (!entries.some(e => e && e.vid)) return;
  camera.updateMatrixWorld(); m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(m4);
  list.length = 0;
  pics.forEach(p => {
    const e = entries[p.userData.i]; if (!e || !e.vid) return;
    p.getWorldPosition(v3); const d = v3.distanceTo(camera.position);
    if (d < RANGE && fr.intersectsSphere(sph)) list.push({ e, d, i: p.userData.i });
  });
  list.sort((a, b) => a.d - b.d);
  const want = new Set(list.slice(0, MAX_PLAY).map(o => o.e)), now = performance.now();
  entries.forEach(e => { if (e && e.vid && !want.has(e) && !e.vid.paused) e.vid.pause(); });
  list.slice(0, MAX_PLAY).forEach(({ e, i }) => {
    if (e.vid.paused) e.vid.play().catch(() => {});
    if (now - (e.vt || 0) > STEP_MS && e.vid.readyState >= 2) { e.vt = now; drawVideoFrame(i); }
  });
}
// Hentikan semua video (dipakai saat editor / menu menutupi layar)
export const pauseVideos = () => entries.forEach(e => { if (e && e.vid && !e.vid.paused) e.vid.pause(); });
