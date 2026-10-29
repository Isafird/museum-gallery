import * as THREE from 'three';
import './style.css';
import { renderer, scene, camera } from './scene.js';
import { state } from './state.js';
import { ROOM, SPEED } from './config.js';
import { pics, walkable, museum } from './gallery.js';
import { makeAvatar, animateAvatar, sayOver, tickBubble } from './avatar.js';
import { connect, disconnect, updateOthers, sendChat } from './network.js';
import { initChat, clearChat, closeChat } from './chat.js';
import { keys, mv } from './controls.js';
import { initUI, setHint, showStart } from './ui.js';
import { closeEditor } from './editor.js';
import { openModal, toggleModal } from './modal.js';
import { toast } from './toast.js';
import { findSpawn } from './layout.js';
import { flushSaves } from './photos.js';
import { lockCursor } from './cursor.js';
import { initOnline, startOnline, stopOnline } from './online.js';
import { applyLayout, loadLocal } from './world.js';
import { defaultLayout } from './layout.js';

const { H } = ROOM;
const JUMP_V = 5.6, GRAV = 16;   // loncat setinggi ±1 m
const { P } = state;
let me = null;   // karakter milik sendiri

function rebuildMe() { if (me) scene.remove(me); me = makeAvatar(state.look); scene.add(me); }
applyLayout(defaultLayout());          // denah bawaan dulu, denah tersimpan dimuat sesudahnya
rebuildMe();
initUI({
  onLook: rebuildMe,
  onStart: (code, online) => { state.active = true; camera.clearViewOffset(); lockCursor(); clearChat(); if (code) connect(code); if (online) startOnline(code); },
  onMenu: backToMenu,
});
initOnline();
initChat({ onSend: text => { sayOver(me, text); return sendChat(text); } });
loadLocal();                           // mode lokal: muat denah dan foto tersimpan di browser

// Kembali ke menu awal: simpan dulu, tutup semua panel, keluar dari room
async function backToMenu() {
  if (!state.active) return;
  await flushSaves();
  closeChat(); closeEditor(); const md = openModal(); if (md) toggleModal(md);
  if (document.pointerLockElement) document.exitPointerLock();
  Object.keys(keys).forEach(k => { keys[k] = 0; }); mv.x = mv.y = 0;
  state.active = false; state.viewing = false; state.target = -1; state.cursorFree = false;
  disconnect(); await stopOnline();
  P.y = 0; P.vy = 0; P.x = -12; P.z = 7; if (!walkable(P.x, P.z, .45)) { const s = findSpawn(museum); P.x = s[0]; P.z = s[1]; }
  showStart(); toast('Kembali ke menu awal');
}

if (location.search.includes('debug')) window.__s = { state, walkable };   // hook untuk pengujian otomatis (tambahkan ?debug ke alamat)
if (new URLSearchParams(location.search).has('cek')) import('./diagnose.js').then(m => m.run());   // halaman diagnosis Supabase
const ray = new THREE.Raycaster(), clock = new THREE.Clock();

function move(dt) {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - mv.y;
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + mv.x;
  const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  const sp = SPEED * (keys.ShiftLeft || keys.ShiftRight ? 1.8 : 1) * dt, { yaw } = state;
  const nx = P.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, nz = P.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
  if (walkable(nx, nz)) { P.x = nx; P.z = nz; }          // geser di sepanjang dinding kalau menabrak
  else if (walkable(nx, P.z)) P.x = nx;
  else if (walkable(P.x, nz)) P.z = nz;
  return Math.min(1, l);
}

// Loncat: spasi (atau tombol di layar sentuh). Bisa menahan tombol untuk loncat terus.
function jumpStep(dt) {
  if (!state.viewing && !state.typing && keys.Space && P.y === 0 && P.vy === 0) P.vy = JUMP_V;
  if (P.y > 0 || P.vy > 0) { P.vy -= GRAV * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) P.vy = 0; }
}

function placeCamera(t) {
  const { yaw, pitch } = state;
  if (!state.active) {                 // layar awal: kamera memandang karakter
    me.visible = true; me.rotation.y = t * .7;
    camera.position.set(P.x, 1.35, P.z - 3); camera.lookAt(P.x, 1.05, P.z);
    if (innerWidth > 700) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * .2, 0, innerWidth, innerHeight);
    return;
  }
  me.rotation.y = yaw; me.visible = state.third;
  if (!state.third) { camera.position.set(P.x, 1.65 + P.y, P.z); camera.rotation.set(pitch, yaw, 0); return; }
  const cp = Math.cos(pitch); let d = 3.2, cx = P.x, cz = P.z;   // orang ketiga: mundur sampai kamera tidak tembus dinding
  for (; d > .4; d -= .4) { cx = P.x + Math.sin(yaw) * cp * d; cz = P.z + Math.cos(yaw) * cp * d; if (walkable(cx, cz, .25)) break; }
  camera.position.set(cx, Math.max(.4, Math.min(H - .2, 1.65 + P.y - Math.sin(pitch) * d + .4)), cz);
  camera.lookAt(P.x, 1.55 + P.y, P.z);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  if (state.active && state.viewing) return;      // editor denah / foto / bantuan menutupi layar: tidak perlu menggambar museum
  const amt = state.active && !state.viewing ? move(dt) : 0;
  if (state.active) jumpStep(dt);
  me.position.set(P.x, P.y, P.z); animateAvatar(me, P.y > 0 ? .25 : amt, t); tickBubble(me);
  placeCamera(t); updateOthers(dt, t);

  state.target = -1;
  if (state.active && !state.viewing) {
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const h = ray.intersectObjects(pics)[0];
    if (h && h.distance < (state.third ? 9 : 6)) state.target = h.object.userData.i;
  }
  setHint();
  renderer.render(scene, camera);
}
loop();
