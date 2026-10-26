import { state } from './state.js';
import { isLocked, lockCursor } from './cursor.js';

// Kotak dialog (bantuan, anggota): kursor otomatis ditampilkan lalu dikunci lagi saat ditutup.
const wasLocked = new Map();
export const openModal = () => document.querySelector('.modal.open');
export function toggleModal(el) {
  const open = !el.classList.contains('open');
  if (open) { wasLocked.set(el, isLocked()); if (isLocked()) document.exitPointerLock(); }
  el.classList.toggle('open', open); state.viewing = open;
  if (!open && wasLocked.get(el)) lockCursor();
}
