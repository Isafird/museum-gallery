import { renderer } from './scene.js';
import { state } from './state.js';

// Kursor mouse: terkunci (tersembunyi, untuk menoleh) atau bebas (untuk klik tombol).
const canvas = renderer.domElement;
export const isLocked = () => document.pointerLockElement === canvas;
export function lockCursor() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  state.cursorFree = false;
}
export function freeCursor() { if (isLocked()) document.exitPointerLock(); state.cursorFree = true; }
export function toggleCursor() { isLocked() ? freeCursor() : lockCursor(); }
