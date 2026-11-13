import { museum } from './gallery.js';
import { segD, floorArea } from './layout.js';
import { hourNow } from './daytime.js';

// Suara: semuanya dibuat langsung oleh browser (WebAudio), tanpa file suara.
//  - suara ruangan: langkah kaki di lantai kayu, pendaratan setelah loncat, dengung ruangan, gema yang mengikuti luas museum
//  - suara luar jendela: burung di siang hari, jangkrik di malam hari, makin jelas kalau dekat dinding luar
//  - musik latar: dibuat otomatis, berbeda tiap room (nada, tempo, dan bunyi dipilih dari kode room) dan ikut suasana waktu
const LS = { music: 'museum-music', sfx: 'museum-sfx' };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
let musicOn = load(LS.music, true), sfxOn = load(LS.sfx, true);
export const audioState = () => ({ music: musicOn, sfx: sfxOn });

let ctx = null, gate, musicBus, sfxBus, ambBus, outBus, verb, verbSend, noiseBuf;
let seed = 'lokal', alive = false;

function ir(ctx, sec) {                          // gema: derau yang meluruh
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}
function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  gate = ctx.createGain(); gate.gain.value = 0; gate.connect(ctx.destination);
  musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain(); outBus = ctx.createGain();
  musicBus.gain.value = musicOn ? .5 : 0; sfxBus.gain.value = sfxOn ? 1 : 0; ambBus.gain.value = sfxOn ? 1 : 0; outBus.gain.value = 0;
  verb = ctx.createConvolver(); verb.buffer = ir(ctx, 2.8); verbSend = ctx.createGain(); verbSend.gain.value = .25;
  [musicBus, sfxBus, ambBus, outBus].forEach(b => { b.connect(gate); b.connect(verbSend); });
  verbSend.connect(verb); verb.connect(gate);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startHum(); return ctx;
}
let recDest = null;
export function audioStream() {                 // suara untuk ikut direkam ke video (tur otomatis)
  const c = ensure(); if (!c) return null;
  if (!recDest) { recDest = c.createMediaStreamDestination(); gate.connect(recDest); }
  return recDest.stream;
}
export function startAudio() {
  const c = ensure(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  alive = true;
}
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, () => { if (!ctx || ctx.state !== 'running') startAudio(); }, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (alive) ctx.resume(); });

let customOn = false; const musicCbs = [];
export const setCustomMusic = v => { customOn = !!v; };                 // lagu pilihan sendiri sedang dipakai: musik otomatis diam
export const onMusic = f => musicCbs.push(f);
export function musicNode() { const c = ensure(); return c ? { ctx: c, bus: musicBus } : null; }
export function toggleMusic() { musicOn = !musicOn; save(LS.music, musicOn); startAudio(); musicCbs.forEach(f => f(musicOn)); if (ctx) musicBus.gain.setTargetAtTime(musicOn ? .5 : 0, ctx.currentTime, .3); return musicOn; }
export function toggleSfx() { sfxOn = !sfxOn; save(LS.sfx, sfxOn); startAudio(); if (ctx) { sfxBus.gain.setTargetAtTime(sfxOn ? 1 : 0, ctx.currentTime, .1); ambBus.gain.setTargetAtTime(sfxOn ? 1 : 0, ctx.currentTime, .3); if (!sfxOn) outBus.gain.setTargetAtTime(0, ctx.currentTime, .2); } return sfxOn; }
export function setMusicSeed(code) { seed = String(code || 'lokal').toLowerCase(); songKey = ''; }

// gema mengikuti luas museum: ruang besar = gema lebih terasa
export function setRoomSize() { if (!ctx || !museum.polys.length) return; const a = floorArea(museum); verbSend.gain.setTargetAtTime(Math.max(.12, Math.min(.5, .1 + a / 1400)), ctx.currentTime, .2); }

// ---------- bahan bunyi ----------
const noise = (dur, lo, hi, q, vol, dest, t0, pan = 0) => {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loopStart = Math.random(); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = lo + Math.random() * (hi - lo); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .006); g.gain.exponentialRampToValueAtTime(.0005, t0 + dur);
  let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  src.connect(f); f.connect(g); out.connect(dest); src.start(t0, Math.random()); src.stop(t0 + dur + .05);
};
const tone = (freq, dur, vol, type, dest, t0, opt = {}) => {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur * (opt.at || 1));
  const a = opt.attack || .005; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(.0004, t0 + dur);
  let node = g; if (opt.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.lp; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(dest); o.start(t0); o.stop(t0 + dur + .05);
};
let humSrc;
function startHum() {                              // dengung halus ruangan
  humSrc = ctx.createBufferSource(); humSrc.buffer = noiseBuf; humSrc.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; const g = ctx.createGain(); g.gain.value = .018;
  humSrc.connect(f); f.connect(g); g.connect(ambBus); humSrc.start();
  const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 520; wf.Q.value = .6;
  const wg = ctx.createGain(); wg.gain.value = .05; wind.connect(wf); wf.connect(wg); wg.connect(outBus); wind.start();
}

// ---------- langkah kaki ----------
let stepT = 0, wasAir = false, foot = 1;
function footstep(vol = 1) {
  const t = ctx.currentTime; foot = -foot;
  noise(.11, 160, 360, 1.4, .34 * vol, sfxBus, t, foot * .25);
  tone(95 + Math.random() * 12, .09, .22 * vol, 'sine', sfxBus, t, { to: 60 });
  noise(.03, 1800, 3200, 2, .05 * vol, sfxBus, t);            // ketukan sepatu
}

// ---------- efek singkat (emote dll.) ----------
export function sfx(kind, id = 0, x, z) {
  if (!ctx || !alive || !sfxOn || ctx.state !== 'running') return;
  let v = 1; if (x !== undefined) { v = 1 / (1 + Math.hypot(x - cur.x, z - cur.z) * .35); if (v < .08) return; }
  const t = ctx.currentTime, B = sfxBus;
  if (kind !== 'emote') return;
  switch (id) {
    case 0: tone(660, .16, .12 * v, 'sine', B, t); tone(880, .22, .12 * v, 'sine', B, t + .12); break;                       // lambai
    case 1: for (let i = 0; i < 4; i++) noise(.05, 1400, 2600, .8, .3 * v, B, t + i * .26); break;                           // tepuk tangan
    case 2: [523, 659, 784].forEach((f, i) => tone(f, .7, .1 * v, 'triangle', B, t + i * .09, { lp: 3000 })); break;         // cinta
    case 3: for (let i = 0; i < 4; i++) tone(520 - i * 40, .1, .1 * v, 'square', B, t + i * .12, { lp: 1400 }); break;       // tertawa
    case 4: tone(300, .35, .12 * v, 'sine', B, t, { to: 900 }); break;                                                       // kaget
    case 5: tone(440, .08, .14 * v, 'sine', B, t); tone(660, .18, .14 * v, 'sine', B, t + .08); break;                       // jempol
    case 6: [392, 494, 587, 784].forEach((f, i) => tone(f, .35, .09 * v, 'triangle', B, t + i * .13, { lp: 3500 })); break;  // menari
  }
}

// ---------- suara luar jendela ----------
let outT = 0, nextBird = 0, nextCricket = 0;
function bird(t) {
  const n = 2 + (Math.random() * 3 | 0), f0 = 2200 + Math.random() * 1400, pan = Math.random() * 1.6 - .8;
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, s = t + i * .13;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, s + .05); o.frequency.exponentialRampToValueAtTime(f0 * 1.1, s + .1);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.06, s + .015); g.gain.exponentialRampToValueAtTime(.0005, s + .11);
    o.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(outBus); } else g.connect(outBus); o.start(s); o.stop(s + .13);
  }
}
function cricket(t) {
  const f = 4100 + Math.random() * 500;
  for (let i = 0; i < 4; i++) tone(f, .05, .025, 'sine', outBus, t + i * .07);
}

// ---------- musik otomatis ----------
const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 6, 7, 9, 11], [0, 2, 3, 5, 7, 9, 10]];
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
let songKey = '', song, nextBeat = 0, beat = 0, degree = 0, prng;
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function pickSong() {
  const h = hash(seed), r = rng(h), hr = hourNow(), night = hr < 5.5 || hr >= 19.5;
  song = { scale: SCALES[h % SCALES.length], root: 45 + (h >> 3) % 9, bpm: (58 + (h >> 7) % 28) * (night ? .85 : 1), timbre: (h >> 11) % 3, prog: [0, 3, 4, 2, 5, 1].map((d, i, a) => a[(i + (h >> 13)) % a.length]), night };
  prng = r; beat = 0; degree = 2; nextBeat = ctx.currentTime + .3; songKey = seed + (night ? 'n' : 'd');
}
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const noteOf = (deg, oct = 0) => { const sc = song.scale, n = sc.length, o = Math.floor(deg / n); return song.root + 12 * (o + oct) + sc[((deg % n) + n) % n]; };
function pluck(f, t, vol, len) {
  const T = song.timbre;
  if (T === 0) { tone(f, len, vol, 'triangle', musicBus, t, { lp: 2600 }); tone(f * 2, len * .5, vol * .3, 'sine', musicBus, t); }       // kalimba
  else if (T === 1) { tone(f, len * 1.3, vol, 'sine', musicBus, t, { attack: .01 }); tone(f * 3, len * .35, vol * .18, 'sine', musicBus, t); }   // denting
  else { tone(f, len * 1.6, vol * .8, 'triangle', musicBus, t, { attack: .06, lp: 1800 }); }                                             // lembut
}
function pad(deg, t, len) {
  [0, 2, 4].forEach(k => { const f = midi(noteOf(deg + k, 0)); tone(f, len, .035, 'sine', musicBus, t, { attack: len * .35 }); tone(f * 1.005, len, .02, 'triangle', musicBus, t, { attack: len * .35, lp: 900 }); });
  tone(midi(noteOf(deg, -1)), len * .9, .06, 'sine', musicBus, t, { attack: .08 });
}
function scheduleMusic() {
  if (songKey !== seed + ((hourNow() < 5.5 || hourNow() >= 19.5) ? 'n' : 'd')) pickSong();
  const b = 60 / song.bpm, horizon = ctx.currentTime + 1.2;
  if (nextBeat < ctx.currentTime - .3) nextBeat = ctx.currentTime + .1;     // setelah jeda (tab disembunyikan): mulai lagi tanpa memutar nada yang tertinggal
  while (nextBeat < horizon) {
    const t = nextBeat, bar = Math.floor(beat / 8), pos = beat % 8;
    if (pos === 0) { degree = song.prog[bar % song.prog.length]; pad(degree, t, b * 8.5); }
    if (prng() < (pos % 2 === 0 ? .8 : .5)) {                          // melodi: berjalan naik-turun pelan, sesekali melompat
      const step = prng(); degree += step < .4 ? 1 : step < .8 ? -1 : (prng() < .5 ? 2 : -2);
      degree = Math.max(song.prog[bar % song.prog.length] - 3, Math.min(song.prog[bar % song.prog.length] + 5, degree));
      pluck(midi(noteOf(degree, 1)), t, .09 + prng() * .04, b * 2.2);
    }
    beat++; nextBeat += b;
  }
}

// ---------- dipanggil tiap frame ----------
const cur = { x: 0, z: 0 };
let near = 0, nearT = 0, sched = 0, lastLayout = null;
export function updateAudio(dt, active, amt, air, x, z) {
  if (!ctx || !alive) return;
  cur.x = x; cur.z = z; if (museum.layout !== lastLayout) { lastLayout = museum.layout; setRoomSize(); }
  gate.gain.setTargetAtTime(active ? .9 : 0, ctx.currentTime, .25);
  if (!active || ctx.state !== 'running') return;
  if (sfxOn) {
    if (amt > .15 && !air) { stepT += dt; if (stepT > .5 - .14 * amt) { stepT = 0; footstep(.6 + .4 * amt); } } else stepT = amt > .15 ? stepT : .3;
    if (wasAir && !air) { footstep(1.5); }
    wasAir = air;
    nearT -= dt; if (nearT < 0) {                                       // seberapa dekat dengan dinding luar (tempat jendela)
      nearT = .3; let d = 99; museum.walls.forEach(w => { if (!w.div) { const k = segD(x, z, w.x1, w.z1, w.x2, w.z2); if (k < d) d = k; } });
      near = Math.max(.12, Math.min(1, 1.15 - d / 7)); outBus.gain.setTargetAtTime(near * .9, ctx.currentTime, .4);
    }
    const hr = hourNow(), t = ctx.currentTime, day = hr > 6.2 && hr < 17.8, night = hr > 19.3 || hr < 5;
    if (day && t > nextBird) { bird(t + .05); nextBird = t + 2.5 + Math.random() * 6; }
    if (night && t > nextCricket) { cricket(t + .05); nextCricket = t + .5 + Math.random() * 1.1; }
  }
  if (musicOn && !customOn) { sched -= dt; if (sched < 0) { sched = .25; scheduleMusic(); } }
}
