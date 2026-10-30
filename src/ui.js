import { state, saveChar } from './state.js';
import { entries } from './gallery.js';
import { HATS, TOPS, BOTTOMS, BODIES, FACES, HAT_ORN, TOP_ORN, HAT_DEF, HAT_ORN_DEF, TOP_ORN_DEF } from './avatar.js';
import { DEFAULT_LOOK } from './config.js';
import { openEditor } from './editor.js';
import { placeFrameFromView, removeFrameAimed } from './world.js';
import { takeShot } from './download.js';
import { toggleCursor } from './cursor.js';
import { toast } from './toast.js';
import { toggleModal } from './modal.js';
import { openPlan } from './plan.js';
import { openChat, toggleHistory } from './chat.js';
import { initFullscreen } from './fullscreen.js';
import * as cloud from './cloud.js';

const $ = id => document.getElementById(id);
const MODES = {
  local: 'Foto dan denah tersimpan di browser ini saja. Hanya kamu yang melihatnya.',
  online: 'Denah dan foto tersimpan di server dan terlihat oleh semua orang di room yang sama.',
};
let mode = 'local', peekSeq = 0, peekTimer = 0, menuCb = () => {};

// ---------- layar awal ----------
function setMode(m) {
  mode = cloud.cloudEnabled ? m : 'local';
  try { localStorage.setItem('museum-mode', mode); } catch (e) {}
  $('m-local').classList.toggle('on', mode === 'local'); $('m-online').classList.toggle('on', mode === 'online');
  $('m-desc').textContent = cloud.cloudEnabled ? MODES[mode] : 'Foto dan denah tersimpan di browser ini. Untuk galeri online bersama teman, isi src/supabase-config.js.';
  document.querySelectorAll('.onlyonline').forEach(el => { el.style.display = mode === 'online' ? '' : 'none'; });
  $('room-t').textContent = mode === 'online' ? 'Kode room galeri' : 'Kode room multiplayer (opsional)'; say('');
  $('go').textContent = mode === 'online' ? 'Masuk galeri online' : 'Masuk galeri';
  schedulePeek();
}
const recent = () => { try { return JSON.parse(localStorage.getItem('museum-rooms')) || []; } catch (e) { return []; } };
function renderRecent() {
  const box = $('recent'); box.textContent = '';
  recent().forEach(r => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = r; b.onclick = () => { $('room').value = r; schedulePeek(); }; box.append(b); });
}
function remember(code) {
  try { localStorage.setItem('museum-rooms', JSON.stringify([code, ...recent().filter(x => x !== code)].slice(0, 5))); } catch (e) {}
}
const say = (t, cls = '') => { const b = $('peek'); b.textContent = t; b.className = 's ' + cls; };

// Periksa status room yang diketik (ada/tidak, publik/privat, peranmu) sebelum masuk
function schedulePeek() { clearTimeout(peekTimer); peekTimer = setTimeout(peek, 450); }
async function peek() {
  if (mode !== 'online') return;
  const id = cloud.roomId($('room').value); if (!id) return;
  const my = ++peekSeq; say('Memeriksa room...');
  let r; try { r = await Promise.race([cloud.peekRoom(id), new Promise((_, no) => setTimeout(() => no(new Error('server tidak menjawab')), 8000))]); } catch (e) { if (my === peekSeq) say('Tidak bisa memeriksa room: ' + (e.message || e), 'warn'); return; }
  if (my !== peekSeq) return;
  const u = state.user;
  if (!r.exists) return u ? say('Room baru. Kamu akan menjadi pemilik.', 'ok') : say('Room ini belum ada. Masuk dengan Google untuk membuatnya.', 'warn');
  if (r.role === 'owner') return say('Kamu pemilik room ini.', 'ok');
  if (r.role === 'editor') return say('Kamu editor di room ini.', 'ok');
  if (r.role === 'viewer') return say('Kamu bisa melihat room ini.', 'ok');
  if (r.visibility === 'public') return say(u ? 'Room publik. Kamu bisa melihat, belum bisa mengedit.' : 'Room publik. Kamu bisa melihat. Masuk dengan Google kalau sudah diberi akses edit.', 'ok');
  say(u ? `Room privat. Email ${u.email} belum diberi akses.` : 'Room privat. Masuk dengan Google jika kamu sudah diberi akses.', 'warn');
}

export function showStart() {      // dipanggil saat kembali ke menu awal
  document.body.classList.remove('playing');
  $('start').style.display = ''; $('hud').style.display = 'none'; $('badge').style.display = 'none';
  renderRecent(); setMode(mode);
}

export function initUI({ onLook, onStart, onMenu }) {
  menuCb = onMenu;
  [['hat', HATS], ['top', TOPS], ['bottom', BOTTOMS], ['body', BODIES], ['face', FACES], ['hornT', HAT_ORN], ['tornT', TOP_ORN]].forEach(([id, list]) => list.forEach(h => $(id).add(new Option(h.name, h.id))));
  try { $('room').value = localStorage.getItem('museum-room') || ''; mode = localStorage.getItem('museum-mode') || 'online'; } catch (e) {}
  const SEL = ['hat', 'top', 'bottom', 'body', 'face', 'hornT', 'tornT'], COL = { c1: 'skin', c2: 'shirt', c3: 'pants' };
  // warna topi (c4) dan hiasan (c5): kalau belum diubah ikut warna bawaan model yang dipilih (data-set kosong)
  const defHat = () => HAT_DEF[+$('hat').value] || HAT_DEF[1];
  const defOrn = () => +$('hornT').value ? HAT_ORN_DEF[+$('hornT').value] : TOP_ORN_DEF[+$('tornT').value] || '#ffd23f';
  const syncAuto = () => { if (!$('c4').dataset.set) $('c4').value = defHat(); if (!$('c5').dataset.set) $('c5').value = defOrn(); };
  const fill = look => {
    $('c1').value = look.skin; $('c2').value = look.shirt; $('c3').value = look.pants;
    $('c4').dataset.set = look.hatc ? '1' : ''; $('c5').dataset.set = look.ornc ? '1' : '';
    SEL.forEach(id => { $(id).value = look[id] || 0; }); if (look.hatc) $('c4').value = look.hatc; if (look.ornc) $('c5').value = look.ornc; syncAuto();
  };
  fill(state.look); $('nm').value = state.name;
  const read = () => {
    syncAuto();
    state.look = { skin: $('c1').value, shirt: $('c2').value, pants: $('c3').value, hatc: $('c4').dataset.set ? $('c4').value : '', ornc: $('c5').dataset.set ? $('c5').value : '' };
    SEL.forEach(id => { state.look[id] = +$(id).value; });
    state.name = ($('nm').value.trim() || 'Pengunjung').slice(0, 14);
    onLook();
  };
  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(id => $(id).addEventListener('input', () => { if (id === 'c4' || id === 'c5') $(id).dataset.set = '1'; read(); }));
  [...SEL, 'nm'].forEach(id => $(id).addEventListener('input', read));
  document.querySelectorAll('.rs').forEach(b => b.onclick = () => {          // kembalikan satu warna ke bawaan
    const id = b.dataset.r;
    if (id === 'c4' || id === 'c5') $(id).dataset.set = ''; else $(id).value = DEFAULT_LOOK[COL[id]];
    read();
  });
  $('resetlook').onclick = () => { fill(DEFAULT_LOOK); read(); };
  const edit = on => document.body.classList.toggle('charopen', on);
  $('charbtn').onclick = () => edit(true); $('charfab').onclick = () => edit(true); $('charclose').onclick = () => edit(false);
  $('randlook').onclick = () => {                                          // acak penampilan
    const pick = n => Math.floor(Math.random() * n), col = () => '#' + [0, 0, 0].map(() => (40 + pick(190)).toString(16).padStart(2, '0')).join('');
    const skins = ['#f1c9a5', '#e0ac84', '#c68642', '#8d5524', '#f5d7c3', '#6b4423'];
    $('c1').value = skins[pick(skins.length)]; $('c2').value = col(); $('c3').value = col();
    $('c4').value = col(); $('c4').dataset.set = '1'; $('c5').value = col(); $('c5').dataset.set = '1';
    SEL.forEach(id => { $(id).value = pick($(id).options.length); });
    read();
  };

  $('mode').style.display = cloud.cloudEnabled ? '' : 'none';
  $('m-local').onclick = () => setMode('local'); $('m-online').onclick = () => setMode('online');
  $('room').addEventListener('input', () => { say(''); schedulePeek(); });
  $('room').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });
  cloud.onUser(u => { state.user = u; schedulePeek(); });
  renderRecent(); setMode(mode);

  $('go').onclick = () => {
    read(); saveChar();
    const code = cloud.roomId($('room').value), online = mode === 'online';
    if (online && !code) { say('Isi kode room dulu (huruf kecil, angka, atau tanda -).', 'warn'); $('room').focus(); return; }
    $('room').value = code;
    try { localStorage.setItem('museum-room', code); } catch (e) {}
    if (code && online) remember(code);
    $('start').style.display = 'none'; $('hud').style.display = code ? 'block' : 'none';
    document.body.classList.add('playing'); onStart(code, online);
    toast('Tekan H untuk bantuan, Q untuk kembali ke menu');
  };
  $('menubtn').onclick = e => { e.currentTarget.blur(); goMenu(); };
  $('cambtn').onclick = e => { toggleCam(); e.currentTarget.blur(); };
  $('curbtn').onclick = e => { toggleCursor(); e.currentTarget.blur(); };
  $('helpbtn').onclick = e => { toggleHelp(); e.currentTarget.blur(); };
  $('help').onclick = toggleHelp;
  $('plnbtn').onclick = e => { openPlan(); e.currentTarget.blur(); };
  initFullscreen();
  $('addfrbtn').onclick = e => { placeFrameFromView(false); e.currentTarget.blur(); };
  $('addfrvbtn').onclick = e => { placeFrameFromView(true); e.currentTarget.blur(); };
  $('delfrbtn').onclick = e => { removeFrameAimed(); e.currentTarget.blur(); };
  $('shotbtn').onclick = e => { takeShot(); e.currentTarget.blur(); };
  $('chatbtn').onclick = e => { toggleHistory(); e.currentTarget.blur(); };
  $('chatq').onclick = e => { openChat(); e.currentTarget.blur(); };
  $('barbtn').onclick = e => { const b = $('bar'), o = !b.classList.contains('open'); b.classList.toggle('open', o); e.currentTarget.setAttribute('aria-expanded', o); e.currentTarget.blur(); };
  $('barlist').addEventListener('click', () => { $('bar').classList.remove('open'); $('barbtn').setAttribute('aria-expanded', 'false'); });
}

export const goMenu = () => menuCb();
export function toggleCam() {
  state.cam = (state.cam + 1) % 3; state.third = state.cam > 0;
  $('cambtn').textContent = 'Kamera: ' + ['orang pertama', 'orang ketiga', 'dari depan'][state.cam] + ' [V]';
}
export const toggleHelp = () => toggleModal($('help'));

// Klik / E pada foto yang dibidik: buka editor
export function interact() {
  if (state.active && !state.viewing && state.target >= 0) openEditor(state.target);
}

export function setHint() {
  const h = $('hint'), on = state.target >= 0;
  $('dot').classList.toggle('on', on);
  h.style.display = on ? 'block' : 'none';
  if (on) h.textContent = entries[state.target].title + ': klik atau tekan E untuk membuka';
}
