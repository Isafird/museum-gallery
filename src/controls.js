import { state } from './state.js';
import { renderer } from './scene.js';
import { interact, toggleCam, toggleHelp, goMenu } from './ui.js';
import { saveAll } from './photos.js';
import { openMembers } from './online.js';
import { openPlan, planKey } from './plan.js';
import { openModal, toggleModal } from './modal.js';
import { editorKey } from './editor.js';
import { isLocked, lockCursor, toggleCursor } from './cursor.js';
import { openChat, closeChat, isChatOpen } from './chat.js';
import { toggleFullscreen } from './fullscreen.js';
import { placeFrameFromView, removeFrameAimed } from './world.js';
import { takeShot } from './download.js';

export const keys = {};            // tombol yang sedang ditekan
export const mv = { x: 0, y: 0 };  // joystick sentuh (-1..1)

const turn = (dx, dy) => {
  state.yaw -= dx * .0025;
  state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch - dy * .0025));
};
const canvas = renderer.domElement;

// ---- Keyboard (daftar shortcut ada di bantuan [H] dan README) ----
addEventListener('keydown', e => {
  if (!state.active) return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); saveAll(); return; }   // Ctrl+S: simpan semua
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {          // sedang mengetik
    if (e.code === 'Escape' || (e.code === 'Enter' && e.target.id === 'ttl')) e.target.blur();
    return;
  }
  if (e.code === 'Escape' && isChatOpen()) { closeChat(); return; }
  if (e.code === 'Tab' && !state.viewing) e.preventDefault();
  const m = openModal();                                          // bantuan / anggota sedang terbuka
  if (m && m.id === 'plan') { planKey(e); return; }
  if (m) { if (e.code === 'Escape' || (e.code === 'KeyH' && m.id === 'help') || (e.code === 'KeyM' && m.id === 'members')) toggleModal(m); return; }
  if (state.viewing) { editorKey(e); return; }
  if (e.code === 'KeyT' || (e.code === 'Enter' && state.target < 0)) {   // chat (Enter dipakai untuk membuka foto kalau sedang membidik)
    e.preventDefault(); Object.keys(keys).forEach(k => { keys[k] = 0; }); mv.x = mv.y = 0; openChat(); return;
  }
  keys[e.code] = 1;
  if (e.code === 'Space') e.preventDefault();                  // loncat: jangan menggulung halaman / menekan tombol yang fokus
  if (e.code === 'KeyE' || e.code === 'Enter') interact();
  else if (e.code === 'KeyV') toggleCam();
  else if (e.code === 'KeyF') toggleFullscreen();
  else if (e.code === 'Tab') toggleCursor();
  else if (e.code === 'KeyH') toggleHelp();
  else if (e.code === 'KeyM') openMembers();
  else if (e.code === 'KeyL') openPlan();
  else if (e.code === 'KeyQ') goMenu();
  else if (e.code === 'KeyG') placeFrameFromView(e.shiftKey);
  else if (e.code === 'KeyX') removeFrameAimed();
  else if (e.code === 'KeyO') takeShot();
});
addEventListener('keyup', e => {
  keys[e.code] = 0;
  if (e.code === 'Space' && state.active && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) e.preventDefault();
});
// Tombol loncat di layar sentuh (tahan = loncat terus)
const jb = document.getElementById('jumpbtn');
if (jb) {
  const up = () => { keys.Space = 0; };
  jb.addEventListener('pointerdown', e => { e.preventDefault(); if (state.active && !state.viewing) keys.Space = 1; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => jb.addEventListener(n, up));
}

// ---- Mouse: kursor terkunci, atau geser sambil klik kalau kursor tampil ----
let down = null;
canvas.addEventListener('mousedown', () => { down = { moved: 0 }; });
addEventListener('mousemove', e => {
  if (!state.active || state.viewing) return;
  if (isLocked()) turn(e.movementX, e.movementY);
  else if (down && e.buttons) { turn(e.movementX, e.movementY); down.moved += Math.abs(e.movementX) + Math.abs(e.movementY); }
});
addEventListener('mouseup', () => {
  if (down && state.active && !state.viewing && (isLocked() || down.moved < 4)) {
    if (state.target >= 0) interact();
    else if (!isLocked() && !state.cursorFree) lockCursor();     // klik di ruang kosong: kunci kursor lagi
  }
  down = null;
});

// ---- Sentuh: kiri layar = jalan, kanan layar = menoleh (ketuk foto = buka) ----
const touches = {};
canvas.addEventListener('touchstart', e => {
  for (const t of e.changedTouches)
    touches[t.identifier] = { x: t.clientX, y: t.clientY, ox: t.clientX, oy: t.clientY, side: t.clientX < innerWidth / 2 ? 'move' : 'look', moved: 0 };
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    const o = touches[t.identifier]; if (!o || !state.active || state.viewing) continue;
    if (o.side === 'look') turn(t.clientX - o.x, t.clientY - o.y);
    else { mv.x = Math.max(-1, Math.min(1, (t.clientX - o.ox) / 50)); mv.y = Math.max(-1, Math.min(1, (t.clientY - o.oy) / 50)); }
    o.moved += Math.abs(t.clientX - o.x) + Math.abs(t.clientY - o.y); o.x = t.clientX; o.y = t.clientY;
  }
}, { passive: true });
canvas.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    const o = touches[t.identifier];
    if (o && o.moved < 8 && state.active && !state.viewing) interact();
    if (o && o.side === 'move') { mv.x = 0; mv.y = 0; }
    delete touches[t.identifier];
  }
});
