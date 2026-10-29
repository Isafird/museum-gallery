import { state, saveChar } from './state.js';
import { entries } from './gallery.js';
import { HATS } from './avatar.js';
import { openEditor } from './editor.js';
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
  HATS.forEach(h => $('hat').add(new Option(h.name, h.id)));
  try { $('room').value = localStorage.getItem('museum-room') || ''; mode = localStorage.getItem('museum-mode') || 'online'; } catch (e) {}
  $('nm').value = state.name; $('c1').value = state.look.skin; $('c2').value = state.look.shirt;
  $('c3').value = state.look.pants; $('hat').value = state.look.hat;
  const read = () => {
    state.look = { skin: $('c1').value, shirt: $('c2').value, pants: $('c3').value, hat: +$('hat').value };
    state.name = ($('nm').value.trim() || 'Pengunjung').slice(0, 14);
    onLook();
  };
  ['c1', 'c2', 'c3', 'hat'].forEach(id => $(id).addEventListener('input', read));

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
  $('chatbtn').onclick = e => { toggleHistory(); e.currentTarget.blur(); };
  $('chatq').onclick = e => { openChat(); e.currentTarget.blur(); };
  $('barbtn').onclick = e => { const b = $('bar'), o = !b.classList.contains('open'); b.classList.toggle('open', o); e.currentTarget.setAttribute('aria-expanded', o); e.currentTarget.blur(); };
  $('barlist').addEventListener('click', () => { $('bar').classList.remove('open'); $('barbtn').setAttribute('aria-expanded', 'false'); });
}

export const goMenu = () => menuCb();
export function toggleCam() {
  state.third = !state.third;
  $('cambtn').textContent = 'Kamera: ' + (state.third ? 'orang ketiga' : 'orang pertama') + ' [V]';
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
