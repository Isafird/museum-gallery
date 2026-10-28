import { Peer } from 'peerjs';
import { scene } from './scene.js';
import { state } from './state.js';
import { PEER_PREFIX } from './config.js';
import { makeAvatar, nameTag, animateAvatar } from './avatar.js';

// Multiplayer: pemain pertama di sebuah room jadi host, yang lain konek ke host.
// Host meneruskan (relay) posisi tiap pemain ke pemain lain.
const others = new Map();   // id -> { g, key, x, z, yaw, seen }
let conns = [], hostConn = null, isHost = false, myId = 'me', selfPeer = null, room = '';

function upsert(d) {
  let o = others.get(d.id);
  if (!o) { o = { g: null, key: '', x: d.x, z: d.z, yaw: d.yaw, seen: 0 }; others.set(d.id, o); }
  const key = JSON.stringify(d.look) + d.name;
  if (o.key !== key) {                       // tampilan/nama berubah: bangun ulang karakter
    if (o.g) scene.remove(o.g);
    o.g = makeAvatar(d.look); o.g.add(nameTag(d.name)); o.g.position.set(o.x, 0, o.z); scene.add(o.g); o.key = key;
  }
  o.x = d.x; o.z = d.z; o.yaw = d.yaw; o.seen = performance.now();
}
function remove(id) { const o = others.get(id); if (o) { if (o.g) scene.remove(o.g); others.delete(id); } }

function onData(d, from) {
  if (d.t === 's') { upsert(d); if (isHost) conns.forEach(c => { if (c !== from && c.open) c.send(d); }); }
  else if (d.t === 'l') remove(d.id);
}

export function connect(code) {
  room = code;
  const hid = PEER_PREFIX + code.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const p = new Peer(hid); selfPeer = p;                      // coba jadi host
  p.on('open', id => { isHost = true; myId = id; });
  p.on('connection', c => {
    conns.push(c);
    c.on('data', d => { c.pid = d.id || c.pid; onData(d, c); });
    c.on('close', () => { conns = conns.filter(x => x !== c); if (c.pid) { remove(c.pid); conns.forEach(x => x.open && x.send({ t: 'l', id: c.pid })); } });
  });
  p.on('error', e => {
    if (e.type !== 'unavailable-id') { room = ''; return; }
    const q = new Peer(); selfPeer = q;                        // ID sudah dipakai: gabung sebagai pemain
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
  const m = { t: 's', id: myId, name: state.name, look: state.look, x: state.P.x, z: state.P.z, yaw: state.yaw };
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
    g.position.x += dx * k; g.position.z += dz * k;
    const a = ((o.yaw - g.rotation.y + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    g.rotation.y += a * k;
    animateAvatar(g, Math.min(1, Math.hypot(dx, dz) * 6), t);
  });
}
