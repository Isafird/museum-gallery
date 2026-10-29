import { Peer } from 'peerjs';
import { scene } from './scene.js';
import { state } from './state.js';
import { PEER_PREFIX } from './config.js';
import { makeAvatar, nameTag, animateAvatar, sayOver, tickBubble } from './avatar.js';
import { logChat, CHAT_LEN } from './chat.js';

// Multiplayer: pemain pertama di sebuah room jadi host, yang lain konek ke host.
// Host meneruskan (relay) posisi tiap pemain ke pemain lain.
const others = new Map();   // id -> { g, key, x, z, yaw, seen }
let conns = [], hostConn = null, isHost = false, myId = 'me', selfPeer = null, room = '';

function upsert(d) {
  let o = others.get(d.id);
  if (!o) { o = { g: null, key: '', x: d.x, z: d.z, y: +d.y || 0, yaw: d.yaw, seen: 0 }; others.set(d.id, o); }
  const key = JSON.stringify(d.look) + d.name;
  if (o.key !== key) {                       // tampilan/nama berubah: bangun ulang karakter
    if (o.g) scene.remove(o.g);
    o.g = makeAvatar(d.look); o.g.add(nameTag(d.name)); o.g.position.set(o.x, o.y, o.z); scene.add(o.g); o.key = key;
  }
  o.x = d.x; o.z = d.z; o.y = +d.y || 0; o.yaw = d.yaw; o.seen = performance.now();
}
function remove(id) { const o = others.get(id); if (o) { if (o.g) scene.remove(o.g); others.delete(id); } }

function onData(d, from) {
  if (d.t === 's') { upsert(d); if (isHost) conns.forEach(c => { if (c !== from && c.open) c.send(d); }); }
  else if (d.t === 'c') { onChat(d); if (isHost) conns.forEach(c => { if (c !== from && c.open) c.send(d); }); }
  else if (d.t === 'l') remove(d.id);
}

// Pesan chat dari pemain lain: gelembung di atas kepalanya + riwayat
function onChat(d) {
  if (typeof d.text !== 'string') return;
  const text = d.text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, CHAT_LEN); if (!text) return;
  const name = String(d.name || 'Pemain').slice(0, 14), o = others.get(d.id);
  if (o && o.g) sayOver(o.g, text);
  logChat(name, text);
}
// Kirim chat ke semua pemain. Mengembalikan true kalau ada pemain lain yang tersambung.
export function sendChat(text) {
  const m = { t: 'c', id: myId, name: state.name, text };
  if (isHost) { let n = 0; conns.forEach(c => { if (c.open) { c.send(m); n++; } }); return n > 0; }
  if (hostConn && hostConn.open) { hostConn.send(m); return true; }
  return false;
}

// Server relay (TURN) supaya pemain di jaringan berbeda (mis. iPhone di data seluler) tetap bisa tersambung
const ICE = { config: { iceServers: [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: '5ea49240394fd8231d0e251e', credential: 'VOs3KJVGXN8I4hXZ' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '5ea49240394fd8231d0e251e', credential: 'VOs3KJVGXN8I4hXZ' },
  { urls: 'turn:global.relay.metered.ca:443', username: '5ea49240394fd8231d0e251e', credential: 'VOs3KJVGXN8I4hXZ' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '5ea49240394fd8231d0e251e', credential: 'VOs3KJVGXN8I4hXZ' },
] } };

export function connect(code) {
  room = code;
  const hid = PEER_PREFIX + code.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const p = new Peer(hid, ICE); selfPeer = p;                      // coba jadi host
  p.on('open', id => { isHost = true; myId = id; });
  p.on('connection', c => {
    conns.push(c);
    c.on('data', d => { c.pid = d.id || c.pid; onData(d, c); });
    c.on('close', () => { conns = conns.filter(x => x !== c); if (c.pid) { remove(c.pid); conns.forEach(x => x.open && x.send({ t: 'l', id: c.pid })); } });
  });
  p.on('error', e => {
    if (e.type !== 'unavailable-id') { room = ''; return; }
    const q = new Peer(undefined, ICE); selfPeer = q;                        // ID sudah dipakai: gabung sebagai pemain
    q.on('open', id => {
      myId = id; hostConn = q.connect(hid);
      hostConn.on('data', d => onData(d));
      hostConn.on('close', () => { hostConn = null; [...others.keys()].forEach(remove); room = ''; });
    });
    q.on('error', () => { room = ''; });
  });
}

// Keluar dari room (kembali ke menu): tutup koneksi dan hapus pemain lain dari layar
export function disconnect() {
  try { selfPeer && selfPeer.destroy(); } catch (e) {}
  selfPeer = null; conns = []; hostConn = null; isHost = false; room = '';
  [...others.keys()].forEach(remove); document.getElementById('hud').textContent = '';
}

// Kirim posisi 10x per detik + bersihkan pemain yang diam > 6 detik + update HUD
setInterval(() => {
  const now = performance.now();
  others.forEach((o, k) => { if (now - o.seen > 6000) remove(k); });
  if (!room) return;
  const m = { t: 's', id: myId, name: state.name, look: state.look, x: state.P.x, z: state.P.z, y: +state.P.y.toFixed(2), yaw: state.yaw };
  if (isHost) conns.forEach(c => c.open && c.send(m)); else if (hostConn && hostConn.open) hostConn.send(m);
  const ok = isHost || (hostConn && hostConn.open);
  document.getElementById('hud').textContent = ok
    ? `Room ${room}: ${others.size + 1} pemain` + (isHost ? ' (host)' : '') : `Room ${room}: menghubungkan...`;
}, 100);
addEventListener('pagehide', () => { try { selfPeer && selfPeer.destroy(); } catch (e) {} });

// Dipanggil tiap frame: gerakkan pemain lain dengan halus
export function updateOthers(dt, t) {
  const k = Math.min(1, dt * 10);
  others.forEach(o => {
    if (!o.g) return;
    const g = o.g, dx = o.x - g.position.x, dz = o.z - g.position.z;
    g.position.x += dx * k; g.position.z += dz * k; g.position.y += (o.y - g.position.y) * Math.min(1, dt * 18); tickBubble(g);
    const a = ((o.yaw - g.rotation.y + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    g.rotation.y += a * k;
    animateAvatar(g, g.position.y > .05 ? .25 : Math.min(1, Math.hypot(dx, dz) * 6), t);
  });
}
