import * as THREE from 'three';
import { scene, camera } from './scene.js';

// Waktu dalam sehari: langit, matahari/bulan/bintang di luar jendela, cahaya dasar museum, dan terang lampu ruangan.
// Pemandangan luar: tanah, bukit, dan pohon di sekeliling museum (dibangun ulang saat denah berubah, lihat buildOutdoor).
export const TIME_MODES = [
  { id: 'auto', name: 'Otomatis (ikut jam HP)' },
  { id: 'pagi', name: 'Pagi', h: 7 }, { id: 'siang', name: 'Siang', h: 12.5 },
  { id: 'sore', name: 'Sore', h: 17.9 }, { id: 'malam', name: 'Malam', h: 22 },
];
// jam, langit atas, langit di cakrawala, warna cahaya dasar, kuat cahaya dasar, tanah, bukit, pohon, pengali lampu, matahari
const K = [
  [0,    '#050813', '#0e1730', '#6f7fb0', .2,  '#0c1710', '#0a1220', '#08140f', 1.25, '#000000'],
  [5,    '#0d1530', '#3c3a62', '#8b8fc0', .22, '#101c14', '#10182c', '#0b1a12', 1.2,  '#000000'],
  [6.3,  '#47709f', '#f5b783', '#ffd9b8', .36, '#4a6a3a', '#6d7f93', '#355a33', 1.05, '#ffb36b'],
  [8.5,  '#3d86d4', '#c3e2f6', '#ffffff', .45, '#5a8a3e', '#7d9bb0', '#3f7a3a', 1,    '#fff1c9'],
  [13,   '#2c76cf', '#b0daf5', '#ffffff', .45, '#5c8f3f', '#7b9db6', '#3f7d3a', 1,    '#fffbe6'],
  [16.3, '#4880c4', '#f6d8a6', '#fff0d8', .42, '#5a853c', '#8c9aa5', '#3d7237', 1,    '#ffe0a0'],
  [17.8, '#44508f', '#ff9a58', '#ffcca0', .34, '#4b6a34', '#8a7389', '#34552f', 1.1,  '#ff9b50'],
  [19,   '#1a2250', '#7b4b70', '#9ba6d8', .26, '#2a3a2a', '#40395a', '#1c3025', 1.2,  '#ff7d4a'],
  [20.6, '#080d22', '#1b2548', '#7f8fc4', .2,  '#14221a', '#141b34', '#0f2018', 1.25, '#000000'],
  [24,   '#050813', '#0e1730', '#6f7fb0', .2,  '#0c1710', '#0a1220', '#08140f', 1.25, '#000000'],
];
const col = s => new THREE.Color(s);
const KS = K.map(r => ({ h: r[0], top: col(r[1]), hor: col(r[2]), amb: col(r[3]), ai: r[4], gnd: col(r[5]), hill: col(r[6]), tree: col(r[7]), lamp: r[8], sun: col(r[9]) }));

export const hemi = new THREE.HemisphereLight(0xffffff, 0x6b5a4a, .45); scene.add(hemi);   // cahaya dasar museum
let lampK = 1; export const lampScale = () => lampK;
export const spotLevel = { v: .5 };      // seberapa terlihat berkas lampu sorot: samar di siang hari, jelas di malam hari (0.3 .. 1)                                     // pengali terang lampu ruangan (dipakai gallery.js)
export const outdoor = new THREE.Group(); scene.add(outdoor);
const gndM = new THREE.MeshBasicMaterial({ color: 0x5c8f3f, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 }),   // didorong ke belakang supaya tidak berebut kedalaman dengan lantai museum
   hillM = new THREE.MeshBasicMaterial({ color: 0x7b9db6 }), leafM = new THREE.MeshBasicMaterial({ color: 0x3f7d3a }), trunkM = new THREE.MeshBasicMaterial({ color: 0x4a3524 });
const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec3 vD; uniform vec3 top, hor, sunDir, moonDir, sunCol; uniform float night;
  void main(){
    vec3 d = normalize(vD); float y = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(hor, top, pow(y, 0.5));
    float sd = max(dot(d, sunDir), 0.0);
    c += sunCol * (smoothstep(0.9987, 0.9992, sd) * 2.2 + pow(sd, 36.0) * 0.45);
    float md = max(dot(d, moonDir), 0.0);
    c = mix(c, vec3(0.93, 0.95, 1.0), smoothstep(0.9993, 0.9996, md) * night);
    c += vec3(0.45, 0.55, 0.9) * pow(md, 60.0) * 0.22 * night;
    vec3 p = floor(d * 230.0); float h = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    c += vec3(1.0) * step(0.9972, h) * night * smoothstep(0.02, 0.3, d.y);
    gl_FragColor = vec4(c, 1.0);
  }`,
}));
sky.renderOrder = 1000; sky.frustumCulled = false; scene.add(sky);       // digambar paling akhir: hanya piksel yang tidak tertutup dinding yang dihitung

// ---- pemandangan sekeliling ----
let built = null;
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function buildOutdoor(b) {
  const key = [b.minx, b.maxx, b.minz, b.maxz].map(v => Math.round(v)).join(','); if (key === built) return; built = key;
  outdoor.children.slice().forEach(o => { outdoor.remove(o); if (o.geometry) o.geometry.dispose(); });
  const cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2, hw = (b.maxx - b.minx) / 2, hd = (b.maxz - b.minz) / 2, R = Math.hypot(hw, hd);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), gndM); ground.position.set(cx, -.25, cz); outdoor.add(ground);
  const r = rnd(Math.round(cx * 31 + cz * 17 + R * 7) % 2147483646 + 1), hills = [], leaves = [], trunks = [];
  for (let i = 0; i < 18; i++) {                                       // bukit rendah di kejauhan
    const a = i / 18 * Math.PI * 2 + r() * .3, d = R + 95 + r() * 60, h = 14 + r() * 26, rad = 30 + r() * 30;
    hills.push(new THREE.ConeGeometry(rad, h, 5 + (r() * 3 | 0)).translate(cx + Math.cos(a) * d, h / 2 - .5, cz + Math.sin(a) * d));
  }
  let tries = 0;
  while (leaves.length < 90 && tries++ < 600) {                         // pohon di luar museum
    const a = r() * Math.PI * 2, d = R + 6 + r() * 55, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (Math.abs(x - cx) < hw + 6 && Math.abs(z - cz) < hd + 6) continue;
    const s = .8 + r() * .9;
    trunks.push(new THREE.CylinderGeometry(.25 * s, .32 * s, 2 * s, 6).translate(x, s - .05, z));
    leaves.push(new THREE.ConeGeometry(1.5 * s, 3.4 * s, 7).translate(x, 3 * s, z), new THREE.ConeGeometry(1.15 * s, 2.7 * s, 7).translate(x, 4.5 * s, z));
  }
  const add = (list, mat) => { if (list.length) { const g = list.length > 1 ? mergeGeos(list) : list[0]; outdoor.add(new THREE.Mesh(g, mat)); } };
  add(hills, hillM); add(trunks, trunkM); add(leaves, leafM);
}
import { mergeBufferGeometries as mergeGeos } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---- waktu ----
const LS = 'museum-time';
let mode = 'auto', curH = null, lastApplied = -1;
try { const m = localStorage.getItem(LS); if (TIME_MODES.some(x => x.id === m)) mode = m; } catch (e) {}
export const timeMode = () => mode;
export const hourNow = () => curH == null ? realHour() : curH;
const realHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
const targetHour = () => mode === 'auto' ? realHour() : TIME_MODES.find(x => x.id === mode).h;
export function setTimeMode(id) {
  if (!TIME_MODES.some(x => x.id === id)) return; mode = id;
  try { localStorage.setItem(LS, id); } catch (e) {}
}
export function nextTimeMode() { setTimeMode(TIME_MODES[(TIME_MODES.findIndex(x => x.id === mode) + 1) % TIME_MODES.length].id); return TIME_MODES.find(x => x.id === mode); }
export const hourLabel = h => { const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

const tmp = { top: new THREE.Color(), hor: new THREE.Color(), amb: new THREE.Color(), gnd: new THREE.Color(), hill: new THREE.Color(), tree: new THREE.Color(), sun: new THREE.Color() };
function sample(h) {
  let i = KS.findIndex((k, j) => h >= k.h && h <= KS[j + 1].h); if (i < 0) i = KS.length - 2;
  const a = KS[i], b = KS[i + 1], f = (h - a.h) / (b.h - a.h), s = f * f * (3 - 2 * f);
  ['top', 'hor', 'amb', 'gnd', 'hill', 'tree', 'sun'].forEach(k => tmp[k].copy(a[k]).lerp(b[k], s));
  return { ai: a.ai + (b.ai - a.ai) * s, lamp: a.lamp + (b.lamp - a.lamp) * s };
}
const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
export function applyHour(h) {
  const v = sample(h), U = sky.material.uniforms;
  U.top.value.copy(tmp.top); U.hor.value.copy(tmp.hor); U.sunCol.value.copy(tmp.sun);
  const th = (h - 6) / 12 * Math.PI; sunDir.set(Math.cos(th), Math.sin(th), -.32).normalize(); moonDir.copy(sunDir).negate();
  U.sunDir.value.copy(sunDir); U.moonDir.value.copy(moonDir);
  U.night.value = Math.max(0, Math.min(1, (.12 - sunDir.y) / .3));
  gndM.color.copy(tmp.gnd); hillM.color.copy(tmp.hill).lerp(tmp.hor, .35); leafM.color.copy(tmp.tree); trunkM.color.copy(tmp.tree).multiplyScalar(.7).add(new THREE.Color(.08, .05, .02));
  hemi.color.copy(tmp.amb); hemi.intensity = v.ai; lampK = v.lamp; spotLevel.v = .3 + .7 * Math.max(0, Math.min(1, (.45 - v.ai) / .25));
  scene.background = tmp.hor;
}
// dipanggil tiap frame: langit mengikuti kamera; jam bergeser halus menuju tujuan (tanpa lompatan saat ganti waktu)
export function updateDaytime(dt) {
  sky.position.copy(camera.position);
  const tg = targetHour();
  if (curH == null) curH = tg;
  else { let d = ((tg - curH + 36) % 24) - 12; if (Math.abs(d) > 1e-3) { const step = mode === 'auto' ? Math.abs(d) : Math.min(Math.abs(d), dt * 9); curH = (curH + Math.sign(d) * step + 24) % 24; } }
  if (Math.abs(curH - lastApplied) > .004) { lastApplied = curH; applyHour(curH); }
}
applyHour(targetHour()); curH = targetHour();
