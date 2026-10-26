import { state, saveChar } from './state.js';
import { entries } from './gallery.js';
import { HATS } from './avatar.js';
import { openEditor } from './editor.js';
import { toggleCursor } from './cursor.js';
import { toast } from './toast.js';
import { toggleModal } from './modal.js';
import { openPlan } from './plan.js';

const $ = id => document.getElementById(id);

export function initUI({ onLook, onStart }) {
  HATS.forEach(h => $('hat').add(new Option(h.name, h.id)));
  try { $('room').value = localStorage.getItem('museum-room') || ''; } catch (e) {}
  $('nm').value = state.name; $('c1').value = state.look.skin; $('c2').value = state.look.shirt;
  $('c3').value = state.look.pants; $('hat').value = state.look.hat;
  const read = () => {
    state.look = { skin: $('c1').value, shirt: $('c2').value, pants: $('c3').value, hat: +$('hat').value };
    state.name = ($('nm').value.trim() || 'Pengunjung').slice(0, 14);
    onLook();
  };
  ['c1', 'c2', 'c3', 'hat'].forEach(id => $(id).addEventListener('input', read));
  $('go').onclick = () => {
    read(); saveChar();
    const code = $('room').value.trim();
    try { localStorage.setItem('museum-room', code); } catch (e) {}
    $('start').style.display = 'none'; $('hud').style.display = code ? 'block' : 'none';
    onStart(code);
    toast('Tekan H untuk bantuan, Tab untuk menampilkan kursor');
  };
  $('cambtn').onclick = e => { toggleCam(); e.currentTarget.blur(); };
  $('curbtn').onclick = e => { toggleCursor(); e.currentTarget.blur(); };
  $('helpbtn').onclick = e => { toggleHelp(); e.currentTarget.blur(); };
  $('help').onclick = toggleHelp;
  $('plnbtn').onclick = e => { openPlan(); e.currentTarget.blur(); };
}

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
