// Membaca link YouTube / Spotify. Mengembalikan null kalau bukan link yang dikenal.
export function parseLink(raw) {
  let u; try { u = new URL(String(raw).trim()); } catch (e) { return null; }
  const h = u.hostname.replace(/^(www|m|music)\./, '');
  if (h === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; return /^[\w-]{11}$/.test(id) ? { t: 'yt', id, list: u.searchParams.get('list') || '' } : null; }
  if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    const list = u.searchParams.get('list') || '', v = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1] || '';
    if (/^[\w-]{11}$/.test(v)) return { t: 'yt', id: v, list };
    if (list && /^[\w-]{10,}$/.test(list)) return { t: 'yt', id: '', list };
    return null;
  }
  if (h === 'open.spotify.com') {
    const m = u.pathname.match(/\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,30})/);
    return m ? { t: 'sp', kind: m[1], id: m[2] } : null;
  }
  return null;
}
