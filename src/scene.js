import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

export const sizeLock = { fixed: false };
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1d22);

export const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .1, 500);
camera.rotation.order = 'YXZ';

addEventListener('resize', () => {
  if (sizeLock.fixed) return;          // sedang tur otomatis: ukuran gambar dikunci sesuai video
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
