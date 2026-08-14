// Three.js scene management for the Wildholm 3D world. This module owns the
// WebGL scene/camera/lighting and per-entity meshes; it knows nothing about
// game rules — client.js feeds it snapshots and reads back projected screen
// points (for HUD overlays) and ground-raycast points (for click targeting).
import * as THREE from '../vendor/three.module.js';

const TILE_HEIGHT = { 0: 0, 1: 0.08, 2: -0.6, 3: 0.55, 4: -0.05 }; // grass, forest, water, stone, sand
const TILE_COLOR3 = {
  0: new THREE.Color('#4c7a3a'),
  1: new THREE.Color('#2f5a2c'),
  2: new THREE.Color('#245a86'),
  3: new THREE.Color('#8a8a80'),
  4: new THREE.Color('#d8c98a'),
};

let renderer, scene, camera;
let groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let raycaster = new THREE.Raycaster();
let worldSize = 80;
let sun, hemi, fog;
let waterMesh = null;

const entityMeshes = new Map(); // entityId -> Object3D
const nameSprites = new Map(); // entityId -> Sprite (for players/npcs)

let cameraYawOffset = 0; // radians, adjustable later for camera orbit
const CAMERA_HEIGHT = 7.5;
const CAMERA_BACK = 8.5;
const CAMERA_LERP = 0.12;
const camCurrent = new THREE.Vector3();
let camInitialized = false;

export function init(canvasEl) {
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fc9e8');
  fog = new THREE.Fog(scene.background.getHex(), 35, 70);
  scene.fog = fog;

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

  hemi = new THREE.HemisphereLight('#bcd6ea', '#3a4a2a', 0.9);
  scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff3d6', 1.1);
  sun.position.set(20, 30, 10);
  scene.add(sun);
  scene.add(new THREE.AmbientLight('#404050', 0.25));

  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// ---------- Terrain ----------
export function setWorld(world) {
  worldSize = world.size;
  const tileAt = (x, y) => {
    x = Math.max(0, Math.min(world.size - 1, x));
    y = Math.max(0, Math.min(world.size - 1, y));
    return world.tiles[y * world.size + x];
  };

  const verts = worldSize + 1;
  const positions = new Float32Array(verts * verts * 3);
  const colors = new Float32Array(verts * verts * 3);

  for (let vy = 0; vy < verts; vy++) {
    for (let vx = 0; vx < verts; vx++) {
      // Smooth height: average the up-to-4 tiles sharing this vertex corner.
      const tiles = [tileAt(vx - 1, vy - 1), tileAt(vx, vy - 1), tileAt(vx - 1, vy), tileAt(vx, vy)];
      const h = tiles.reduce((s, t) => s + TILE_HEIGHT[t], 0) / tiles.length;
      // Crisp color: nearest tile (biome boundaries stay readable).
      const nearest = tileAt(Math.min(vx, worldSize - 1), Math.min(vy, worldSize - 1));
      const c = TILE_COLOR3[nearest];
      const i = (vy * verts + vx) * 3;
      positions[i] = vx; positions[i + 1] = h; positions[i + 2] = vy;
      colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b;
    }
  }

  const indices = [];
  for (let ty = 0; ty < worldSize; ty++) {
    for (let tx = 0; tx < worldSize; tx++) {
      const a = ty * verts + tx, b = a + 1, c = a + verts, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // Translucent water plane sitting above the sunken water terrain.
  const waterGeo = new THREE.PlaneGeometry(worldSize, worldSize);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(worldSize / 2, -0.25, worldSize / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#2f7fb8', transparent: true, opacity: 0.65, roughness: 0.2 });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  scene.add(waterMesh);
}

// ---------- Lighting / atmosphere ----------
export function setDayPhase(dayPhase, isNight) {
  // dayPhase in [0,1); darken sun/hemi and thicken fog through the night.
  const darkness = nightDarkness(dayPhase);
  const t = 1 - darkness;
  sun.intensity = 0.25 + 0.85 * t;
  hemi.intensity = 0.35 + 0.55 * t;
  const skyDay = new THREE.Color('#8fc9e8');
  const skyNight = new THREE.Color('#0b1330');
  const sky = skyDay.clone().lerp(skyNight, darkness);
  scene.background = sky;
  fog.color = sky;
  fog.near = 20 + 20 * t;
  fog.far = 45 + 30 * t;
}

function nightDarkness(phase) {
  const inStart = 0.45, inEnd = 0.6, outStart = 0.9, outEnd = 1.0;
  if (phase < inStart) return 0;
  if (phase < inEnd) return (phase - inStart) / (inEnd - inStart);
  if (phase < outStart) return 1;
  if (phase < outEnd) return 1 - (phase - outStart) / (outEnd - outStart);
  return 0;
}

// ---------- Entity builders ----------
function makeNameSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(2.6, 0.65, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function buildTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#6b4a2c' }));
  trunk.position.y = 0.3;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 7), new THREE.MeshStandardMaterial({ color: '#2f6b34', flatShading: true }));
  leaves.position.y = 1.1;
  g.add(trunk, leaves);
  return g;
}
function buildRock(color = '#8a8a84') {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  m.position.y = 0.28;
  m.rotation.set(Math.random(), Math.random(), Math.random());
  return m;
}
function buildIronVein() {
  const g = buildRock('#8a8a84');
  const speck = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), new THREE.MeshStandardMaterial({ color: '#c96b3a', emissive: '#5a2a10', flatShading: true }));
  speck.position.set(0.2, 0.5, 0.1);
  g.add(speck);
  return g;
}
function buildBush() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), new THREE.MeshStandardMaterial({ color: '#4a8f3a', flatShading: true }));
  m.position.y = 0.25;
  return m;
}
function buildShrub() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), new THREE.MeshStandardMaterial({ color: '#c9b84a', flatShading: true }));
    blade.position.set((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3);
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    g.add(blade);
  }
  return g;
}
function buildFishingSpot() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.35, 12), new THREE.MeshStandardMaterial({ color: '#dfefff', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.24;
  return m;
}
function buildOreVein(speckColor, speckEmissive) {
  const g = buildRock('#8a8a84');
  for (let i = 0; i < 3; i++) {
    const speck = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ color: speckColor, emissive: speckEmissive, emissiveIntensity: 0.5, flatShading: true }));
    speck.position.set((Math.random() - 0.5) * 0.4, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4);
    g.add(speck);
  }
  return g;
}
function buildClayPit() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#a8643a', flatShading: true }));
  m.position.y = -0.05;
  return m;
}
function buildPerson(bodyColor, headColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: bodyColor }));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: headColor || '#e8c39e' }));
  head.position.y = 1.05;
  g.add(body, head);
  return g;
}

// Quadruped builder shared by all animal mobs — a body box + head + four
// stub legs, parameterized so each species reads as visually distinct.
function buildQuadruped({ bodyColor, headColor, bodyScale = 1, headScale = 1, earType = 'round', tusks = false }) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45 * bodyScale, 0.32 * bodyScale, 0.7 * bodyScale), bodyMat);
  body.position.y = 0.22 * bodyScale + 0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28 * headScale, 0.26 * headScale, 0.3 * headScale), new THREE.MeshStandardMaterial({ color: headColor || bodyColor, flatShading: true }));
  head.position.set(0, 0.3 * bodyScale + 0.12, 0.45 * bodyScale);
  g.add(body, head);

  const earGeo = earType === 'long'
    ? new THREE.ConeGeometry(0.05, 0.28, 4)
    : new THREE.ConeGeometry(0.07, 0.14, 4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.position.set(side * 0.1 * headScale, head.position.y + 0.16 * headScale, head.position.z - 0.02);
    g.add(ear);
  }
  if (tusks) {
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4), new THREE.MeshStandardMaterial({ color: '#f2ecd8' }));
      tusk.rotation.x = Math.PI / 2.4;
      tusk.position.set(side * 0.08, head.position.y - 0.08, head.position.z + 0.14);
      g.add(tusk);
    }
  }
  const legGeo = new THREE.CylinderGeometry(0.05 * bodyScale, 0.05 * bodyScale, 0.24 * bodyScale, 5);
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(dx * 0.15 * bodyScale, 0.12 * bodyScale, dz * 0.25 * bodyScale);
      g.add(leg);
    }
  }
  return g;
}

const MOB_BUILDERS = {
  wolf: () => buildQuadruped({ bodyColor: '#5b5b5b', headColor: '#4a4a4a', earType: 'round' }),
  rabbit: () => buildQuadruped({ bodyColor: '#c9b896', bodyScale: 0.55, headScale: 0.8, earType: 'long' }),
  deer: () => buildQuadruped({ bodyColor: '#a9773f', bodyScale: 1.1, headScale: 0.9, earType: 'long' }),
  boar: () => buildQuadruped({ bodyColor: '#4a3a2a', bodyScale: 1.05, headScale: 1.0, earType: 'round', tusks: true }),
  bear: () => buildQuadruped({ bodyColor: '#3a2a1c', bodyScale: 1.6, headScale: 1.2, earType: 'round' }),
};

function buildNpc() {
  const g = buildPerson('#3a5fa0', '#e8c39e');
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#f5c542', flatShading: true }));
  hat.position.y = 1.35;
  g.add(hat);
  return g;
}
function buildStructure(type) {
  if (type === 'campfire') {
    const g = new THREE.Group();
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#5a3a20' }));
    logs.position.y = 0.06;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 6), new THREE.MeshStandardMaterial({ color: '#ff8c2a', emissive: '#c9410a', emissiveIntensity: 0.8 }));
    flame.position.y = 0.35;
    const light = new THREE.PointLight('#ff9c42', 1.2, 5);
    light.position.y = 0.5;
    g.add(logs, flame, light);
    return g;
  }
  if (type === 'torch') {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#6b4a2c' }));
    pole.position.y = 0.4;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), new THREE.MeshStandardMaterial({ color: '#ff9c42', emissive: '#c9410a', emissiveIntensity: 0.9 }));
    flame.position.y = 0.9;
    const light = new THREE.PointLight('#ffab5c', 0.9, 4);
    light.position.y = 0.9;
    g.add(pole, flame, light);
    return g;
  }
  if (type === 'furnace') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: '#4a4a48', flatShading: true }));
    m.position.y = 0.45;
    return m;
  }
  if (type === 'reinforced_wall') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: '#a85c42', flatShading: true }));
    m.position.y = 0.55;
    return m;
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.2), new THREE.MeshStandardMaterial({ color: '#8a6b42', flatShading: true }));
  m.position.y = 0.55;
  return m;
}

const RESOURCE_BUILDERS = {
  tree: buildTree, rock: () => buildRock(), iron_vein: buildIronVein,
  bush: buildBush, shrub: buildShrub, fishing_spot: buildFishingSpot,
  coal_vein: () => buildOreVein('#1a1a1a', '#000000'),
  gold_vein: () => buildOreVein('#f5c542', '#8a6a10'),
  clay_pit: buildClayPit,
};

// ---------- Per-frame sync ----------
function upsert(id, buildFn, x, y, scaleFn) {
  let obj = entityMeshes.get(id);
  if (!obj) {
    obj = buildFn();
    scene.add(obj);
    entityMeshes.set(id, obj);
  }
  obj.position.x = x; obj.position.z = y;
  if (scaleFn) scaleFn(obj);
  return obj;
}

export function syncState(state, myId) {
  const seen = new Set();

  for (const r of state.resources) {
    seen.add('r:' + r.id);
    const builder = RESOURCE_BUILDERS[r.type] || buildBush;
    upsert('r:' + r.id, builder, r.x, r.y, (obj) => {
      const scale = 0.6 + 0.4 * (r.hp / r.maxHp);
      obj.scale.setScalar(scale);
    });
  }

  for (const s of state.structures) {
    seen.add('s:' + s.id);
    upsert('s:' + s.id, () => buildStructure(s.type), s.x, s.y);
  }

  for (const n of state.npcs || []) {
    seen.add('n:' + n.id);
    upsert('n:' + n.id, buildNpc, n.x, n.y);
    if (!nameSprites.has('n:' + n.id)) {
      const sprite = makeNameSprite(n.name, '#f5c542');
      sprite.position.y = 1.9;
      entityMeshes.get('n:' + n.id).add(sprite);
      nameSprites.set('n:' + n.id, sprite);
    }
  }

  for (const m of state.mobs) {
    seen.add('m:' + m.id);
    const builder = MOB_BUILDERS[m.type] || MOB_BUILDERS.wolf;
    const obj = upsert('m:' + m.id, builder, m.x, m.y);
    if (obj._lastX !== undefined) {
      const dx = m.x - obj._lastX, dy = m.y - obj._lastY;
      if (dx || dy) obj.rotation.y = Math.atan2(dx, dy);
    }
    obj._lastX = m.x; obj._lastY = m.y;
  }

  for (const p of state.players) {
    seen.add('p:' + p.id);
    const isMe = p.id === myId;
    const obj = upsert('p:' + p.id, () => buildPerson(isMe ? '#5ba848' : '#4586c9'), p.x, p.y);
    obj.visible = p.alive;
    if (p.dir && (p.dir.x || p.dir.y)) {
      obj.rotation.y = Math.atan2(p.dir.x, p.dir.y);
    }
    if (!nameSprites.has('p:' + p.id)) {
      const sprite = makeNameSprite(p.name, isMe ? '#9be564' : '#bcd6ff');
      sprite.position.y = 1.55;
      obj.add(sprite);
      nameSprites.set('p:' + p.id, sprite);
    }
  }

  for (const [id, obj] of entityMeshes) {
    if (!seen.has(id)) {
      scene.remove(obj);
      entityMeshes.delete(id);
      nameSprites.delete(id);
    }
  }
}

// ---------- Camera ----------
export function updateCamera(playerPos, aimDir) {
  const lookDir = (aimDir && (aimDir.x || aimDir.y)) ? aimDir : { x: 0, y: 1 };
  const targetPos = new THREE.Vector3(
    playerPos.x - lookDir.x * CAMERA_BACK,
    CAMERA_HEIGHT,
    playerPos.y - lookDir.y * CAMERA_BACK
  );
  if (!camInitialized) { camCurrent.copy(targetPos); camInitialized = true; }
  camCurrent.lerp(targetPos, CAMERA_LERP);
  camera.position.copy(camCurrent);
  camera.lookAt(playerPos.x, 0.8, playerPos.y);
}

export function render() {
  renderer.render(scene, camera);
}

// ---------- Input helpers ----------
export function groundPointFromMouse(clientX, clientY, canvasEl) {
  const rect = canvasEl.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const point = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(groundPlane, point);
  if (!hit) return null;
  return { x: point.x, y: point.z };
}

// Projects a world (x,y) ground point [+ optional world-space yOffset] to
// screen pixel coordinates, for HTML/2D-overlay HUD elements (name tags,
// health bars, floating text) anchored to 3D entities.
export function projectToScreen(x, y, yOffset, canvasEl) {
  const v = new THREE.Vector3(x, yOffset || 0, y);
  v.project(camera);
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
    behind: v.z > 1,
  };
}
