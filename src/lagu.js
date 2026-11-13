import { toggleModal, openModal } from './modal.js';
import { musicNode, setCustomMusic, onMusic, audioState, startAudio } from './audio.js';
import { parseLink } from './lagulink.js';
import { toast } from './toast.js';

// Lagu sendiri: (1) file dari perangkat, masuk ke jalur suara museum sehingga ikut terekam di video tur;
// (2) link YouTube / Spotify lewat pemutar resmi (mini) di pojok layar, tidak ikut terekam.
const $ = id => document.getElementById(id), LSK = 'museum-lagu-link';
let mode = 'none', list = [], idx = 0, el = null, gain = null, yt = null, vol = .8, ytApi = null;

function fileSetup() {
  if (el) return true;
  const n = musicNode(); if (!n) return false;
  el = new Audio(); el.preload = 'auto'; el.addEventListener('ended', () => step(1));
  const src = n.ctx.createMediaElementSource(el); gain = n.ctx.createGain(); gain.gain.value = vol * 1.6; src.connect(gain); gain.connect(n.bus);
  return true;
}
function stopAll() {
  if (el) { el.pause(); }
  if (yt) { try { yt.destroy(); } catch (e) {} yt = null; }
  $('lagudock').style.display = 'none'; $('lg-dock-body').innerHTML = '';
}
function setMode(m) { mode = m; setCustomMusic(m !== 'none'); render(); }
function render() {
  const L = $('lg-list'); L.innerHTML = '';
  list.forEach((f, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lgit' + (mode === 'file' && i === idx ? ' on' : ''); b.textContent = (i + 1) + '. ' + f.name; b.onclick = () => playFile(i); L.appendChild(b); });
  $('lg-state').textContent = mode === 'file' ? 'Memutar dari file: ' + (list[idx] ? list[idx].name : '') : mode === 'yt' ? 'Memutar dari YouTube (pemutar kecil di pojok kiri bawah).' : mode === 'sp' ? 'Spotify aktif (tekan putar di pemutar kecil di pojok kiri bawah).' : 'Memakai musik otomatis bawaan museum.';
  $('lg-file-ctl').style.display = list.length ? '' : 'none';
}
function playFile(i) {
  if (!list.length || !fileSetup()) return; startAudio(); stopAll(); idx = (i + list.length) % list.length;
  el.src = list[idx].url; setMode('file');
  if (audioState().music) el.play().catch(() => toast('Browser menolak memutar otomatis. Tekan tombol putar.', 2500));
}
function step(d) { if (mode === 'file') playFile(idx + d); }
function addFiles(files) {
  const ok = [...files].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|opus|flac|webm)$/i.test(f.name));
  if (!ok.length) { toast('File harus berupa audio (mp3, m4a, wav, ogg, ...)', 2600); return; }
  const first = list.length; ok.forEach(f => list.push({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
  playFile(first);
}
function loadYT() {
  if (ytApi) return ytApi;
  return ytApi = new Promise((res, rej) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { ytApi = null; rej(new Error('yt')); }; document.head.appendChild(s);
  });
}
async function playLink(raw) {
  const p = parseLink(raw); if (!p) { toast('Link tidak dikenali. Pakai link YouTube atau Spotify.', 2800); return; }
  try { localStorage.setItem(LSK, raw.trim()); } catch (e) {}
  startAudio(); stopAll(); const dock = $('lagudock'), body = $('lg-dock-body'); dock.style.display = 'flex';
  if (p.t === 'sp') {
    const f = document.createElement('iframe'); f.allow = 'autoplay; encrypted-media; clipboard-write'; f.loading = 'lazy'; f.style.cssText = 'border:0;width:300px;height:' + (p.kind === 'track' || p.kind === 'episode' ? 152 : 232) + 'px;border-radius:12px';
    f.src = 'https://open.spotify.com/embed/' + p.kind + '/' + p.id + '?theme=0'; body.appendChild(f); setMode('sp');
    toast('Tekan tombol putar di pemutar Spotify. Tanpa login Spotify hanya terputar cuplikan 30 detik.', 4200); return;
  }
  body.innerHTML = '<div id="ytp"></div>'; setMode('yt');
  try {
    const YT = await loadYT(), vars = { playsinline: 1, rel: 0, loop: 1, controls: 1 };
    if (p.list) { vars.listType = 'playlist'; vars.list = p.list; } else vars.playlist = p.id;
    yt = new YT.Player('ytp', { width: 260, height: 146, videoId: p.id || undefined, playerVars: vars, events: { onReady: e => { e.target.setVolume(Math.round(vol * 100)); if (audioState().music) e.target.playVideo(); else e.target.pauseVideo(); } } });
  } catch (e) { stopAll(); setMode('none'); toast('YouTube tidak bisa dimuat (periksa koneksi internet). Coba impor file saja.', 3600); }
}
function auto() { stopAll(); setMode('none'); }
function applyVol() {
  if (gain) gain.gain.value = vol * 1.6;
  if (yt && yt.setVolume) { try { yt.setVolume(Math.round(vol * 100)); } catch (e) {} }
}
export function openLagu() {
  const m = $('lagu'); if (!m.classList.contains('open')) { if (openModal()) return; render(); toggleModal(m); } else toggleModal(m);
}
export function initLagu() {
  try { $('lg-url').value = localStorage.getItem(LSK) || ''; } catch (e) {}
  $('lg-file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('lg-play').onclick = () => playLink($('lg-url').value);
  $('lg-url').addEventListener('keydown', e => { if (e.code === 'Enter') playLink($('lg-url').value); });
  $('lg-auto').onclick = auto; $('lg-prev').onclick = () => step(-1); $('lg-next').onclick = () => step(1);
  $('lg-vol').oninput = e => { vol = +e.target.value / 100; applyVol(); };
  $('lg-close').onclick = () => toggleModal($('lagu')); $('lg-dock-x').onclick = auto;
  $('lagubtn').onclick = e => { openLagu(); e.currentTarget.blur(); };
  onMusic(on => {                                          // tombol Musik [N]: jeda / lanjutkan lagu pilihan
    if (mode === 'file' && el) { if (on) el.play().catch(() => {}); else el.pause(); }
    else if (mode === 'yt' && yt && yt.playVideo) { try { on ? yt.playVideo() : yt.pauseVideo(); } catch (e) {} }
  });
  render();
}
