-- Jalankan sekali di Supabase: SQL Editor > New query > tempel semua > Run.

-- ========== Tabel ==========
create table public.rooms (
  id text primary key check (id ~ '^[a-z0-9-]{1,30}$'),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  layout jsonb check (layout is null or pg_column_size(layout) < 100000),   -- denah museum
  created_at timestamptz not null default now()
);
create table public.members (
  room_id text not null references public.rooms(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('editor', 'viewer')),
  primary key (room_id, email)
);
create table public.frames (
  room_id text not null references public.rooms(id) on delete cascade,
  id int not null check (id between 0 and 99),
  ph bigint not null default 0,              -- versi foto (dipakai sebagai nama file)
  crop jsonb,
  filter text not null default 'none',
  frame text not null default 'kayu',
  title text check (char_length(title) <= 40),
  by text,
  updated_at timestamptz not null default now(),
  primary key (room_id, id)
);

-- ========== Fungsi bantu ==========
create function public.my_email() returns text language sql stable
  as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;
create function public.my_role(r text) returns text language sql stable security definer set search_path = public
  as $$ select case when exists (select 1 from rooms where id = r and owner = auth.uid()) then 'owner'
       else (select role from members where room_id = r and email = public.my_email()) end $$;
create function public.can_view(r text) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from rooms where id = r and visibility = 'public') or public.my_role(r) is not null $$;
create function public.can_edit(r text) returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce(public.my_role(r) in ('owner', 'editor'), false) $$;
create function public.is_owner(r text) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from rooms where id = r and owner = auth.uid()) $$;

-- ========== Aturan akses (RLS) ==========
alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.frames enable row level security;

-- Room: semua orang boleh membaca (hanya berisi pemilik, publik/privat, denah). Orang pertama yang membuat jadi pemilik.
create policy rooms_read on public.rooms for select using (true);
create policy rooms_create on public.rooms for insert to authenticated with check (owner = auth.uid());
create policy rooms_update on public.rooms for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- Anggota: hanya pemilik yang mengatur; anggota boleh membaca catatannya sendiri.
create policy members_read on public.members for select using (public.is_owner(room_id) or email = public.my_email());
create policy members_write on public.members for insert to authenticated with check (public.is_owner(room_id));
create policy members_update on public.members for update to authenticated using (public.is_owner(room_id)) with check (public.is_owner(room_id));
create policy members_delete on public.members for delete to authenticated using (public.is_owner(room_id));

-- Bingkai: lihat = publik atau anggota; ubah = pemilik atau editor.
create policy frames_read on public.frames for select using (public.can_view(room_id));
create policy frames_insert on public.frames for insert to authenticated with check (public.can_edit(room_id));
create policy frames_update on public.frames for update to authenticated using (public.can_edit(room_id)) with check (public.can_edit(room_id));
create policy frames_delete on public.frames for delete to authenticated using (public.can_edit(room_id));

-- ========== Penyimpanan foto ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg']) on conflict (id) do nothing;
-- nama file: {kode-room}/{id-bingkai}-{versi}.jpg
create policy photos_read on storage.objects for select using (bucket_id = 'photos' and public.can_view((storage.foldername(name))[1]));
create policy photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.can_edit((storage.foldername(name))[1]));
create policy photos_delete on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.can_edit((storage.foldername(name))[1]));

-- ========== Realtime (perubahan langsung muncul di semua pemain) ==========
alter publication supabase_realtime add table public.rooms, public.frames;
