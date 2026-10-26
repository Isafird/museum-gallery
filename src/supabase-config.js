// Isi dari Supabase > Project Settings > API: "Project URL" dan kunci "anon public".
// Kunci anon memang publik. Keamanan data dijaga oleh aturan RLS di supabase.sql, bukan oleh kerahasiaan kunci ini.
// Biarkan kosong untuk memakai mode lokal saja (tanpa galeri online).
export const supabaseConfig = {
  url: '',
  anonKey: '',
};
export const cloudEnabled = !!(supabaseConfig.url && supabaseConfig.anonKey);
