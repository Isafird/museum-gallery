-- Jalankan sekali di Supabase (SQL Editor > New query > tempel > Run) kalau database kamu dibuat dari supabase.sql versi lama.
-- Memberi pemilik izin untuk menghapus room-nya (tombol "Hapus room ini" di panel Akses galeri).
grant delete on public.rooms to authenticated;
drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms for delete to authenticated using (owner = auth.uid());
alter table public.rooms replica identity full;

-- OPSIONAL: bersihkan sekaligus room kosong (tanpa satu pun bingkai) yang dibuat lebih dari 30 hari lalu.
-- Hapus tanda -- di depan baris di bawah lalu Run. File di storage hanya ada kalau room punya bingkai berfoto,
-- jadi room kosong aman dihapus lewat SQL.
-- delete from public.rooms r where r.created_at < now() - interval '30 days' and not exists (select 1 from public.frames f where f.room_id = r.id);
