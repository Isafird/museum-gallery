let t;
export function toast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(t); t = setTimeout(() => el.classList.remove('on'), ms);
}
