-- Jalankan SEKALI di SQL Editor kalau project Supabase kamu dibuat sebelum fitur video.
-- Mengizinkan video pendek (mp4 / webm / mov, maks 12 MB) di bucket foto. Aman dijalankan berulang.
update storage.buckets
   set file_size_limit = 12582912,
       allowed_mime_types = array['image/jpeg', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'photos';
