import * as cloud from './cloud.js';
import { state } from './state.js';
import { entries } from './gallery.js';
import { useStore, clearView, applyRemote } from './photos.js';
import { toast } from './toast.js';
import { toggleModal } from './modal.js';
import { applyLayout } from './world.js';
import { normalizeLayout, defaultLayout } from './layout.js';

const $ = id => document.getElementById(id);

export function initOnline() {
  if (!cloud.cloudEnabled) return;
  document.body.classList.add('cloud');
  cloud.onUser(u => {
    state.user = u;
    $('who').textContent = u ? 'Masuk sebagai ' + u.email : '';
    $('signin').textContent = u ? 'Keluar' : 'Masuk dengan Google';
    $('accbtn').textContent = u ? 'Keluar' : 'Masuk Google';
  });
  const auth = async () => { try { cloud.getUser() ? await cloud.signOutUser() : await cloud.signIn(); } catch (e) { toast('Gagal masuk: ' + (e.code || e.message)); } };
  $('signin').onclick = auth;
  $('accbtn').onclick = e => { auth(); e.currentTarget.blur(); };
  $('membtn').onclick = e => { openMembers(); e.currentTarget.blur(); };
  $('mclose').onclick = () => toggleModal($('members'));
  $('members').onclick = e => { if (e.target.id === 'members') toggleModal($('members')); };
  $('vis').onchange = async () => { try { await cloud.setVisibility($('vis').value); toast('Pengaturan disimpan'); } catch (e) { toast('Gagal menyimpan pengaturan'); } };
  $('madd').onclick = async () => {
    const em = $('memail').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) { toast('Email tidak valid'); return; }
    try { await cloud.setMember(em, $('mrole').value); $('memail').value = ''; renderMembers(); } catch (e) { toast('Gagal menambah anggota'); }
  };
}

// Dipanggil saat masuk dengan kode room: galeri berpindah dari database lokal ke online
export function startOnline(code) {
  if (!cloud.cloudEnabled) return;
  state.online = true; useStore(cloud); entries.forEach((_, i) => clearView(i)); toast('Menghubungkan galeri online...');
  cloud.openRoom(code, {
    onAccess,
    onLayout: l => { const n = normalizeLayout(l); if (JSON.stringify(n) !== JSON.stringify(state.layout)) applyLayout(n); },
    onFrame: (i, rec) => applyRemote(i, rec),
    onRemove: i => applyRemote(i, { ph: 0 }),
    onError: e => toast('Galeri online bermasalah: ' + (e.code || e.message)),
  });
}

function onAccess(a) {
  state.access = { visibility: 'public', ...a };
  const u = state.user, b = $('badge');
  const txt = {
    owner: 'Pemilik', editor: 'Editor', viewer: 'Hanya lihat',
    none: 'Room ini belum ada. Masuk dengan Google untuk membuatnya (kamu jadi pemilik).',
    denied: u ? `Room privat. Email ${u.email} belum diberi akses.` : 'Room privat. Masuk dengan Google jika kamu sudah diberi akses.',
  }[a.role];
  b.textContent = 'Galeri online: ' + txt; b.style.display = 'block';
  $('membtn').style.display = a.canManage ? '' : 'none';
  if (a.created) toast('Galeri baru dibuat. Kamu pemiliknya.');
  $('plnbtn').style.display = a.canManage ? '' : 'none';
  if (a.role === 'none' || a.role === 'denied') { entries.forEach((_, i) => clearView(i)); applyLayout(defaultLayout()); }
}

// ---- panel pengaturan akses (pemilik) ----
export async function openMembers() {
  if (!state.access.canManage || state.access.role === 'local') return;
  $('vis').value = state.access.visibility || 'public';
  toggleModal($('members')); renderMembers();
}
async function renderMembers() {
  const l = $('mlist'); l.textContent = 'Memuat...';
  let ms; try { ms = await cloud.listMembers(); } catch (e) { l.textContent = 'Gagal memuat daftar anggota'; return; }
  l.textContent = ''; if (!ms.length) { l.textContent = 'Belum ada anggota.'; l.className = 's'; return; } l.className = '';
  ms.forEach(m => {
    const row = document.createElement('div'); row.className = 'mrow';
    const t = document.createElement('span'); t.textContent = m.email;
    const sel = document.createElement('select'); [['editor', 'Editor'], ['viewer', 'Hanya lihat']].forEach(([v, n]) => sel.add(new Option(n, v)));
    sel.value = m.role; sel.onchange = () => cloud.setMember(m.email, sel.value).catch(() => toast('Gagal mengubah peran'));
    const del = document.createElement('button'); del.className = 'chip'; del.textContent = 'Hapus';
    del.onclick = async () => { await cloud.removeMember(m.email); renderMembers(); };
    row.append(t, sel, del); l.append(row);
  });
}
