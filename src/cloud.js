import { createClient } from '@supabase/supabase-js';
import { supabaseConfig as C, cloudEnabled, loginMethods } from './supabase-config.js';
export { cloudEnabled, loginMethods };

// Galeri online (Supabase). Tabel: rooms (pemilik, publik/privat, denah), members, frames. Foto di Storage bucket "photos".
// Siapa boleh apa ditentukan oleh aturan RLS di supabase.sql.
const BUCKET = 'photos';
let sb, user = null, S = null, seq = 0, lastUid;
const mine = new Map();      // id bingkai -> waktu tulis terakhir milik kita (untuk mengabaikan gema realtime)
const userCbs = new Set();

export const roomId = code => code.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
export const getUser = () => user;
export function onUser(cb) { userCbs.add(cb); cb(user); }
export const signIn = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
// Login tanpa password: Supabase mengirim link masuk ke email (email terbukti milik pengguna setelah link diklik)
export const signInEmail = email => sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
export const signOutUser = () => sb.auth.signOut();
const canEdit = () => !!(S && S.access && S.access.canEdit);

if (cloudEnabled) {
  // Ambil hanya alamat dasarnya (https://xxxx.supabase.co). Kalau terlanjur ditempel dengan /rest/v1 atau garis miring, dibuang.
  sb = createClient(new URL(C.url.trim()).origin, C.anonKey.trim());
  sb.auth.onAuthStateChange((_e, session) => {
    const u = session && session.user;
    user = u ? { uid: u.id, email: (u.email || '').toLowerCase(), name: (u.user_metadata && u.user_metadata.full_name) || u.email } : null;
    if ((u ? u.id : null) === lastUid) return;                 // abaikan pembaruan token
    lastUid = u ? u.id : null; userCbs.forEach(f => f(user)); evaluate();
  });
}

function teardown(s) { if (s && s.ch) { sb.removeChannel(s.ch); s.ch = null; } }
export function openRoom(code, handlers) { closeRoom(); S = { id: roomId(code), h: handlers, ch: null, access: null }; evaluate(); }
export function closeRoom() { teardown(S); S = null; }

// Intip status room tanpa membuat atau mengubah apa pun (untuk layar awal)
export async function peekRoom(code) {
  const id = roomId(code); if (!id) return null;
  const { data: room, error } = await sb.from('rooms').select('id,owner,visibility').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!room) return { exists: false };
  let role = 'none';
  if (user && room.owner === user.uid) role = 'owner';
  else if (user) { const { data: m } = await sb.from('members').select('role').eq('room_id', id).eq('email', user.email).maybeSingle(); if (m) role = m.role; }
  return { exists: true, visibility: room.visibility, role };
}

async function evaluate() {
  if (!S) return;
  const s = S, my = ++seq; teardown(s);
  const finish = a => { s.access = a; s.h.onAccess(a); };
  try {
    let { data: room, error } = await sb.from('rooms').select('*').eq('id', s.id).maybeSingle();
    if (error) throw error;
    let created = false;
    if (!room) {
      if (!user) { finish({ role: 'none', canEdit: false, canManage: false }); return; }   // belum ada: perlu masuk untuk membuat
      ({ data: room, error } = await sb.from('rooms').insert({ id: s.id }).select().single());
      if (error) throw error; created = true;
    }
    let role = 'none';
    if (user && room.owner === user.uid) role = 'owner';
    else if (user) { const { data: m } = await sb.from('members').select('role').eq('room_id', s.id).eq('email', user.email).maybeSingle(); if (m) role = m.role; }
    if (role === 'none' && room.visibility !== 'public') { finish({ role: 'denied', canEdit: false, canManage: false }); return; }
    if (role === 'none') role = 'viewer';
    finish({ role, created, canEdit: role === 'owner' || role === 'editor', canManage: role === 'owner', visibility: room.visibility });
    s.h.onLayout(room.layout);
    const { data: frames } = await sb.from('frames').select('*').eq('room_id', s.id);
    (frames || []).forEach(r => s.h.onFrame(r.id, r));
    if (my !== seq || S !== s) return;
    s.ch = sb.channel(`room-${s.id}-${my}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'frames', filter: `room_id=eq.${s.id}` },
        p => {
          if (p.eventType === 'DELETE') s.h.onRemove(p.old.id);
          else if (mine.get(p.new.id) !== Date.parse(p.new.updated_at)) s.h.onFrame(p.new.id, p.new);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${s.id}` },
        p => { if (s.access) s.access.visibility = p.new.visibility; s.h.onLayout(p.new.layout); })
      .subscribe();
  } catch (e) { s.h.onError(e); }
}

// ---- dipakai photos.js (antarmuka sama dengan db.js) ----
export async function save(rec) {
  if (!canEdit()) return false;
  try {
    if (rec.photoChanged && rec.blob) {
      const up = await sb.storage.from(BUCKET).upload(`${S.id}/${rec.id}-${rec.ph}.${rec.ext}`, rec.blob, { contentType: rec.ext === 'jpg' ? 'image/jpeg' : (rec.blob.type || 'video/mp4'), upsert: false });
      if (up.error) throw up.error;
      if (rec.oldPh) sb.storage.from(BUCKET).remove([`${S.id}/${rec.id}-${rec.oldPh}.${rec.oldExt || 'jpg'}`]);     // hapus versi lama
    }
    const ts = new Date().toISOString(); mine.set(rec.id, Date.parse(ts));
    const { error } = await sb.from('frames').upsert({
      room_id: S.id, id: rec.id, ph: rec.blob ? rec.ph : 0, crop: rec.crop || null, filter: rec.filter, frame: rec.frame,
      title: rec.title, by: user ? user.email : '', updated_at: ts,
    });
    if (error) throw error; return true;
  } catch (e) { console.warn(e); return false; }
}
export async function remove(id) {
  if (!canEdit()) return;
  try {
    await sb.from('frames').delete().eq('room_id', S.id).eq('id', id);
    const { data } = await sb.storage.from(BUCKET).list(S.id, { search: `${id}-` });
    const names = (data || []).filter(f => f.name.startsWith(`${id}-`)).map(f => `${S.id}/${f.name}`);
    if (names.length) await sb.storage.from(BUCKET).remove(names);
  } catch (e) {}
}
export async function loadPhoto(id, ph, ext = 'jpg') {
  const { data, error } = await sb.storage.from(BUCKET).download(`${S.id}/${id}-${ph}.${ext}`);
  if (error) throw error; return data;
}
export async function saveLayout(layout) {
  if (!S || !S.access || !S.access.canManage) return false;
  const { data, error } = await sb.from('rooms').update({ layout }).eq('id', S.id).select('id');
  return !error && !!(data && data.length);
}

// ---- pengaturan akses (hanya pemilik) ----
async function must(q) { const { data, error } = await q; if (error) throw error; return data; }
export const listMembers = async () => (await must(sb.from('members').select('email,role').eq('room_id', S.id))).map(r => ({ email: r.email, role: r.role }));
export const setMember = (email, role) => must(sb.from('members').upsert({ room_id: S.id, email: email.trim().toLowerCase(), role }));
export const removeMember = email => must(sb.from('members').delete().eq('room_id', S.id).eq('email', email));
export async function setVisibility(v) {
  const d = await must(sb.from('rooms').update({ visibility: v }).eq('id', S.id).select('id'));
  if (!d.length) throw new Error('ditolak'); if (S.access) S.access.visibility = v;
}
