import { state } from './state.js';
import { EMOTES, playEmote } from './avatar.js';
import { sendEmote } from './network.js';
import { sfx } from './audio.js';
import { toast } from './toast.js';

// Emote: tombol 1-7, panel (B), atau tombol di layar sentuh. Terlihat oleh pemain lain di room yang sama.
let last = 0, tipped = false;
export function doEmote(i) {
  if (!state.active || !state.me || !EMOTES[i]) return;
  const now = performance.now(); if (now - last < 900) return; last = now;
  playEmote(state.me, i); sendEmote(i); sfx('emote', i);
  if (!state.third && !tipped) { tipped = true; toast('Ganti kamera dengan V untuk melihat emote-mu sendiri', 3500); }
}
export function buildEmotePanel() {
  const box = document.getElementById('emotes'); box.textContent = '';
  EMOTES.forEach((e, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.title = e.name; b.setAttribute('aria-label', e.name);
    b.innerHTML = '<span class="ei"></span><small></small>'; b.firstChild.textContent = e.ic; b.lastChild.textContent = i + 1;
    b.onclick = () => { doEmote(i); toggleEmotePanel(false); }; box.append(b);
  });
}
export function toggleEmotePanel(on) {
  const box = document.getElementById('emotes'); const o = on === undefined ? !box.classList.contains('open') : on;
  box.classList.toggle('open', o); document.body.classList.toggle('emoteopen', o);
}
