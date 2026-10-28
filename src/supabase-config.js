// Isi dari Supabase > Project Settings > API Keys: "Project URL" dan kunci "Publishable key" (sb_publishable_...).
// Kunci anon lama (eyJ...) juga masih bisa dipakai. JANGAN pakai secret key atau service_role.
// Kunci publishable/anon memang publik. Keamanan data dijaga oleh aturan RLS di supabase.sql, bukan oleh kerahasiaan kunci ini.
// Biarkan kosong untuk memakai mode lokal saja (tanpa galeri online).
// Cara login yang ditampilkan. Matikan yang tidak kamu siapkan di Supabase (Authentication > Providers).
export const loginMethods = { google: true, email: false };   // email: true menampilkan login lewat link email
export const supabaseConfig = {
  url: '',
  anonKey: '',
};
export const cloudEnabled = !!(supabaseConfig.url && supabaseConfig.anonKey);
