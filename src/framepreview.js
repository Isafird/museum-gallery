import * as THREE from 'three';
import { buildFrame } from './frames3d.js';

// Pratinjau bingkai di editor foto: bingkai 3D yang sama dengan di galeri + foto (sudah berisi matte dan filter),
// digambar sekali ke kanvas terpisah lalu ditampilkan di editor. Kalau WebGL gagal, mengembalikan null.
let R, scene, cam, holder, wall, pic, tex, texFor, texW = 0, texH = 0;
function init() {
  R = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setClearColor(0x16181d);
  scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 20); cam.position.set(0, 0, 8);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, .85));
  const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(-2, 3, 5); scene.add(sun);
  holder = new THREE.Group(); scene.add(holder);
  wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xdcdad4 })); wall.position.z = -.05; scene.add(wall);
  pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()); pic.position.z = .06; scene.add(pic);
}

// e = entri bingkai (gallery.js): e.canvas = foto + matte + filter, e.data.frame = gaya, e.vert = tegak
export function renderFramed(e, maxPx = 1500) {
  try {
    if (!R) init();
    holder.children.slice().forEach(o => { holder.remove(o); if (o.geometry) o.geometry.dispose(); });
    buildFrame(holder, e.data.frame, e.vert);
    const bw = e.vert ? 1.7 : 2.4, bh = e.vert ? 2.4 : 1.7;
    pic.geometry.dispose(); pic.geometry = new THREE.PlaneGeometry(bw, bh);
    if (!tex || texFor !== e.canvas || texW !== e.canvas.width || texH !== e.canvas.height) { if (tex) tex.dispose(); tex = new THREE.CanvasTexture(e.canvas); texFor = e.canvas; texW = e.canvas.width; texH = e.canvas.height; }
    tex.needsUpdate = true; pic.material.map = tex; pic.material.needsUpdate = true;
    const box = new THREE.Box3().setFromObject(holder); box.expandByVector(new THREE.Vector3(.12, .12, 0));
    const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2, w = box.max.x - box.min.x, h = box.max.y - box.min.y;
    wall.scale.set(w + .5, h + .5, 1); wall.position.x = cx; wall.position.y = cy;
    cam.left = cx - (w + .5) / 2; cam.right = cx + (w + .5) / 2; cam.top = cy + (h + .5) / 2; cam.bottom = cy - (h + .5) / 2; cam.updateProjectionMatrix();
    const k = maxPx / Math.max(w, h); R.setSize(Math.round((w + .5) * k), Math.round((h + .5) * k), false);
    R.render(scene, cam);
    return R.domElement;
  } catch (err) { console.warn('pratinjau bingkai gagal', err); return null; }
}
