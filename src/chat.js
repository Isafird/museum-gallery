import { state } from './state.js';
import { isLocked, lockCursor } from './cursor.js';

// Chat: kotak ketik + riwayat. Gelembung di atas kepala digambar oleh avatar.js (sayOver),
// pengiriman lewat network.js (sendChat). Modul ini hanya mengurus tampilan dan input.
const $ = id => document.getElementById(id);
const MAX_LINES = 100, FADE_MS = 9000, GAP_MS = 600;
export const CHAT_LEN = 120;
const box = $('chat'), log = $('chlog'), inp = $('chin');
const lines = [];
let onSend = () => true, wasLocked = false, last = 0, warned = false;

const clock = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

// Tambah satu baris ke riwayat. kind: '' (pemain lain) | 'self' | 'sys'
export function logChat(name, text, kind = '') {
  const el = document.createElement('div'); el.className = 'cl ' + kind;
  if (name) { const b = document.createElement('b'); b.textContent = name; el.append(b); }
  el.append(document.createTextNode(text));
  const t = document.createElement('i'); t.textContent = clock(); el.append(t);
  log.append(el); lines.push({ el, ts: performance.now() });
  while (lines.length > MAX_LINES) lines.shift().el.remove();
  log.scrollTop = log.scrollHeight;
}
export function clearChat() { lines.length = 0; log.textContent = ''; warned = false; }
setInterval(() => { const now = performance.now(); lines.forEach(l => l.el.classList.toggle('old', now - l.ts > FADE_MS)); }, 1000);

export const isChatOpen = () => box.classList.contains('open');
export function openChat(focus = true) {
  if (!state.active || state.viewing) return;
  box.classList.add('open'); document.body.classList.add('chatopen');
  log.scrollTop = log.scrollHeight;
  if (focus) inp.focus();
}
export function closeChat() {
  box.classList.remove('open'); document.body.classList.remove('chatopen');
  inp.value = ''; inp.blur();
  if (wasLocked) { wasLocked = false; if (state.active) lockCursor(); }
}
export const toggleHistory = () => (isChatOpen() && !state.typing ? closeChat() : openChat(false));

function send() {
  const text = inp.value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, CHAT_LEN);
  const now = performance.now();
  if (!text) { closeChat(); return; }
  if (now - last < GAP_MS) return;               // jangan terlalu cepat
  last = now;
  const delivered = onSend(text);
  logChat(state.name, text, 'self');
  if (!delivered && !warned) { warned = true; logChat('', 'Belum ada pemain lain yang tersambung: pesanmu hanya terlihat olehmu.', 'sys'); }
  if (delivered) warned = false;
  closeChat();
}

export function initChat(o) {
  onSend = o.onSend;
  inp.maxLength = CHAT_LEN;
  inp.addEventListener('focus', () => { if (isLocked()) { wasLocked = true; document.exitPointerLock(); } state.typing = true; document.body.classList.add('typing'); });
  inp.addEventListener('blur', () => { state.typing = false; document.body.classList.remove('typing'); });
  inp.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.code === 'Enter') { e.preventDefault(); send(); }
    else if (e.code === 'Escape') { e.preventDefault(); closeChat(); }
  });
  $('chform').addEventListener('submit', e => { e.preventDefault(); send(); });
  $('chclose').onclick = closeChat;
}
