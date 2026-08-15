// Three.js scene management for the Wildholm 3D world. This module owns the
// WebGL scene/camera/lighting and per-entity meshes; it knows nothing about
// game rules — client.js feeds it snapshots and reads back projected screen
// points (for HUD overlays) and ground-raycast points (for click targeting).
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { SSAOPass } from '../vendor/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from '../vendor/postprocessing/FXAAPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { ASSET_MANIFEST } from './assets.js';
import { TERRAIN_TEXTURES } from './terrainTextures.js';

const TILE_HEIGHT = { 0: 0, 1: 0.08, 2: -0.6, 3: 0.55, 4: -0.05 }; // grass, forest, water, stone, sand
const TILE_COLOR3 = {
  0: new THREE.Color('#4c7a3a'),
  1: new THREE.Color('#2f5a2c'),
  2: new THREE.Color('#245a86'),
  3: new THREE.Color('#8a8a80'),
  4: new THREE.Color('#d8c98a'),
};

// Resource field (hotspot) aura colors, one per harvestable material.
const FIELD_COLORS = {
  wood: '#7a5230', fiber: '#c9b84a', stone: '#a8a8a0', iron_ore: '#c96b3a',
  coal: '#7a5ccf', gold_ore: '#f5c542', clay: '#c2703f', raw_fish: '#3fb8d9',
};

let renderer, scene, camera, composer, ssaoPass, bloomPass, fxaaPass;
let groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let raycaster = new THREE.Raycaster();
let worldSize = 80;
let sun, hemi, fog;
let waterMesh = null;

const entityMeshes = new Map(); // entityId -> Object3D
const nameSprites = new Map(); // entityId -> Sprite (for players/npcs)
const fieldAuras = new Map(); // material -> ring mesh (resource hotspot indicator)

// ---------- Real-art asset loading (sprites & glTF models) ----------
// See assets.js for the manifest that opts entities into these instead of
// the built-in procedural geometry. Loading is async; builders return a
// placeholder immediately and swap in the real art once it arrives (or
// silently keep the placeholder if the asset fails to load).
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const textureCache = new Map();
const modelCache = new Map();

function loadTexture(url) {
  if (!textureCache.has(url)) {
    textureCache.set(url, new Promise((resolve, reject) => {
      textureLoader.load(url, resolve, undefined, reject);
    }));
  }
  return textureCache.get(url);
}

function loadModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, new Promise((resolve, reject) => {
      gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return modelCache.get(url);
}

// A billboard is a flat textured plane that rotates to face the camera
// around the vertical axis only (so the character still reads as "standing"
// from any viewing angle, rather than facing the camera dead-on like a UI
// sprite). Used for 2D/illustrated character art.
function buildBillboard(asset) {
  const width = asset.width || 1.4;
  const height = asset.height || 2.2;
  const mat = new THREE.MeshStandardMaterial({
    transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.y = height / 2;
  mesh.userData.isBillboard = true;
  loadTexture(asset.url).then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
  }).catch(() => { /* keep the blank placeholder if the art is missing */ });
  return mesh;
}

// A model placeholder shows a faint wireframe capsule until the real glTF
// model finishes loading (or forever, if it fails — better than nothing).
function buildModelPlaceholder(asset) {
  const group = new THREE.Group();
  const placeholder = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.5, 4, 8),
    new THREE.MeshBasicMaterial({ color: '#8899aa', wireframe: true })
  );
  placeholder.position.y = 0.55;
  group.add(placeholder);
  loadModel(asset.url).then((modelScene) => {
    group.remove(placeholder);
    const model = modelScene.clone(true);
    if (asset.scale) model.scale.setScalar(asset.scale);
    group.add(model);
  }).catch(() => { /* keep the wireframe placeholder if the model is missing */ });
  return group;
}

function assetBuilder(asset) {
  if (asset.type === 'sprite') return () => buildBillboard(asset);
  if (asset.type === 'model') return () => buildModelPlaceholder(asset);
  return null;
}

// Returns a real-art builder if the manifest opts this entity in, else the
// given procedural fallback builder — the normal path when no art exists.
function resolveBuilder(kind, key, fallback) {
  const table = ASSET_MANIFEST[kind];
  const asset = table && (table[key] || table.default);
  if (!asset) return fallback;
  return assetBuilder(asset) || fallback;
}

let cameraYawOffset = 0; // radians, adjustable later for camera orbit
const CAMERA_HEIGHT = 7.5;
const CAMERA_BACK = 8.5;
const CAMERA_LERP = 0.12;
const camCurrent = new THREE.Vector3();
let camInitialized = false;

// The sun's shadow frustum is a fixed-size box that follows the player
// (see updateCamera) rather than trying to cover the whole 80x80 world —
// that keeps the shadow map resolution tight and sharp close to the
// player, which is what's actually visible, instead of stretched thin
// over terrain that's mostly off in the fog anyway.
const SUN_OFFSET = new THREE.Vector3(24, 36, 16);
const SHADOW_FRUSTUM = 26;

export function init(canvasEl) {
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  fog = new THREE.Fog('#8fc9e8', 35, 70);
  scene.fog = fog;
  buildSky();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

  hemi = new THREE.HemisphereLight('#bcd6ea', '#3a4a2a', 0.9);
  scene.add(hemi);

  sun = new THREE.DirectionalLight('#fff3d6', 1.1);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -SHADOW_FRUSTUM;
  sun.shadow.camera.right = SHADOW_FRUSTUM;
  sun.shadow.camera.top = SHADOW_FRUSTUM;
  sun.shadow.camera.bottom = -SHADOW_FRUSTUM;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.02;
  sun.target = new THREE.Object3D();
  scene.add(sun.target);
  scene.add(sun);

  scene.add(new THREE.AmbientLight('#404050', 0.25));

  setupComposer();
  resize();
  window.addEventListener('resize', resize);
}

// Post-processing chain: render -> SSAO (contact shadowing in creases/
// corners flat lighting misses) -> bloom (fire/emissive glow) -> FXAA
// (post-process antialiasing, since MSAA doesn't apply through a composer)
// -> output (ACES tone mapping + correct color space on the final blit).
function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssaoPass.kernelRadius = 0.5;
  ssaoPass.minDistance = 0.0015;
  ssaoPass.maxDistance = 0.08;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);

  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.55, 0.86);
  composer.addPass(bloomPass);
  fxaaPass = new FXAAPass();
  composer.addPass(fxaaPass);
  composer.addPass(new OutputPass());
}

export function resize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

// ---------- Terrain ----------
const BIOME_NAMES = { 0: 'grass', 1: 'forest', 2: 'water', 3: 'stone', 4: 'sand' };
// Land biomes get merged into one mesh with a per-vertex weight blend, so
// biome boundaries fade smoothly instead of showing a hard tile-grid edge.
// Water keeps its own separate (untextured) mesh — it's hidden under the
// translucent water plane anyway.
const LAND_BIOMES = ['grass', 'forest', 'sand', 'stone'];
const terrainMeshes = [];

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
  const uvs = new Float32Array(verts * verts * 2);
  // Per-vertex blend weight toward each land biome (grass/forest/sand/stone),
  // derived from the up-to-4 tiles touching that vertex corner. Interpolated
  // across triangles by the GPU, this is what turns hard per-tile biome
  // squares into a smooth gradient a little over a tile wide.
  const biomeWeights = new Float32Array(verts * verts * 4);

  // Cheap deterministic hash -> [0,1), used to jitter color/height per
  // vertex so the terrain doesn't read as flat, uniform biome blocks.
  const hash2 = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let vy = 0; vy < verts; vy++) {
    for (let vx = 0; vx < verts; vx++) {
      // Smooth height: average the up-to-4 tiles sharing this vertex corner.
      const tiles = [tileAt(vx - 1, vy - 1), tileAt(vx, vy - 1), tileAt(vx - 1, vy), tileAt(vx, vy)];
      const h = tiles.reduce((s, t) => s + TILE_HEIGHT[t], 0) / tiles.length;
      const bump = (hash2(vx, vy) - 0.5) * 0.06;
      // Crisp color: nearest tile (biome boundaries stay readable).
      const nearest = tileAt(Math.min(vx, worldSize - 1), Math.min(vy, worldSize - 1));
      const c = TILE_COLOR3[nearest];
      const shade = 0.92 + hash2(vx + 91.7, vy + 13.3) * 0.16;
      const i3 = (vy * verts + vx) * 3;
      const i2 = (vy * verts + vx) * 2;
      const i4 = (vy * verts + vx) * 4;
      positions[i3] = vx; positions[i3 + 1] = h + bump; positions[i3 + 2] = vy;
      colors[i3] = c.r * shade; colors[i3 + 1] = c.g * shade; colors[i3 + 2] = c.b * shade;
      // Raw world-position UVs; each material scales these via its own
      // texture.repeat rather than baking density into the UV data, so
      // one shared buffer works for every biome's tiling density.
      uvs[i2] = vx; uvs[i2 + 1] = vy;
      for (const t of tiles) {
        const idx = LAND_BIOMES.indexOf(BIOME_NAMES[t]);
        if (idx >= 0) biomeWeights[i4 + idx] += 0.25;
      }
    }
  }

  // Bucket each tile's two triangles into "land" (grass/forest/sand/stone,
  // one shared blended mesh) or "water" (its own untextured mesh). Every
  // mesh shares the exact same position data, so they stitch together with
  // no gaps or z-fighting at biome boundaries.
  const indicesByGroup = { land: [], water: [] };
  for (let ty = 0; ty < worldSize; ty++) {
    for (let tx = 0; tx < worldSize; tx++) {
      const biome = BIOME_NAMES[world.tiles[ty * worldSize + tx]];
      const group = biome === 'water' ? 'water' : 'land';
      const a = ty * verts + tx, b = a + 1, c = a + verts, d = c + 1;
      indicesByGroup[group].push(a, c, b, b, c, d);
    }
  }

  terrainMeshes.length = 0;
  for (const [group, indices] of Object.entries(indicesByGroup)) {
    if (!indices.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (group === 'land') geo.setAttribute('biomeWeight', new THREE.BufferAttribute(biomeWeights, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
    terrainMeshes.push(mesh);

    if (group === 'land') applyBlendedTerrainTextures(mesh);
  }

  // Translucent water plane sitting above the sunken water terrain.
  const waterGeo = new THREE.PlaneGeometry(worldSize, worldSize);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(worldSize / 2, -0.25, worldSize / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#2f7fb8', transparent: true, opacity: 0.7, roughness: 0.12, metalness: 0.15 });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);
}

// Loads every land biome's diffuse/roughness maps (whichever are
// configured in TERRAIN_TEXTURES) and, once ready, swaps the land mesh's
// material for one that blends between them per-vertex using the
// `biomeWeight` attribute — smooth transitions instead of hard tile edges.
// (Normal maps are intentionally not used here — see the comment below.)
// Async and best-effort: the mesh already has the flat vertex-color
// fallback material, so slow/missing textures just mean it stays flat.
async function applyBlendedTerrainTextures(mesh) {
  const configured = LAND_BIOMES.filter((b) => TERRAIN_TEXTURES[b]);
  if (!configured.length) return;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const configureTexture = (tex, repeat, isColor) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    return tex;
  };
  let loaded;
  try {
    loaded = await Promise.all(configured.map(async (biome) => {
      const config = TERRAIN_TEXTURES[biome];
      const repeat = config.repeat ?? 0.35;
      const [diffuse, roughness] = await Promise.all([
        loadTexture(config.diffuse),
        config.roughness ? loadTexture(config.roughness) : Promise.resolve(null),
      ]);
      configureTexture(diffuse, repeat, true);
      if (roughness) configureTexture(roughness, repeat, false);
      return { biome, diffuse, roughness };
    }));
  } catch (err) {
    return; // one or more textures failed — keep the flat fallback material.
  }

  // Fall back to a 1x1 white/neutral texture for any land biome that has no
  // pack entry yet, so the shader's fixed 4-texture blend always has
  // something valid to sample (its weight there may still be > 0).
  const whiteTex = solidColorTexture('#ffffff');
  const midRoughTex = solidColorTexture('#808080');
  const byBiome = new Map(loaded.map((l) => [l.biome, l]));
  const sample = (biome, which, fallback) => byBiome.get(biome)?.[which] || fallback;

  // Normal-map blending is deliberately skipped: perturbing the surface
  // normal per-fragment via a hand-rolled tangent frame on this large,
  // raw-world-scale-UV mesh produced degenerate normals (direct sun/hemi
  // light contributed ~nothing, leaving only flat ambient light — the
  // ground stayed dark no matter how bright the lights were). The smooth
  // per-vertex geometric normal from computeVertexNormals() lights
  // correctly and still looks good with the diffuse/roughness blend.
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  mat.defines = { USE_UV: '' };
  mat.onBeforeCompile = (shader) => {
    for (const biome of LAND_BIOMES) {
      const cap = biome[0].toUpperCase() + biome.slice(1);
      shader.uniforms[`t${cap}Diffuse`] = { value: sample(biome, 'diffuse', whiteTex) };
      shader.uniforms[`t${cap}Roughness`] = { value: sample(biome, 'roughness', midRoughTex) };
      shader.uniforms[`u${cap}Repeat`] = { value: TERRAIN_TEXTURES[biome]?.repeat ?? 0.35 };
    }
    const biomeDecls = LAND_BIOMES.map((b) => {
      const cap = b[0].toUpperCase() + b.slice(1);
      return `uniform sampler2D t${cap}Diffuse;\nuniform sampler2D t${cap}Roughness;\nuniform float u${cap}Repeat;`;
    }).join('\n');
    const weightNorm = 'vec4 bw = vBiomeWeight / max(vBiomeWeight.x + vBiomeWeight.y + vBiomeWeight.z + vBiomeWeight.w, 0.0001);';

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 biomeWeight;\nvarying vec4 vBiomeWeight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBiomeWeight = biomeWeight;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vBiomeWeight;\n${biomeDecls}`)
      .replace('#include <map_fragment>', `{\n\t${weightNorm}\n\tvec3 blendedDiffuse =
    texture2D( tGrassDiffuse, vUv * uGrassRepeat ).rgb * bw.x +
    texture2D( tForestDiffuse, vUv * uForestRepeat ).rgb * bw.y +
    texture2D( tSandDiffuse, vUv * uSandRepeat ).rgb * bw.z +
    texture2D( tStoneDiffuse, vUv * uStoneRepeat ).rgb * bw.w;
	diffuseColor.rgb *= blendedDiffuse;\n}`)
      .replace('#include <roughnessmap_fragment>', `${weightNorm}\nfloat roughnessFactor =
    texture2D( tGrassRoughness, vUv * uGrassRepeat ).g * bw.x +
    texture2D( tForestRoughness, vUv * uForestRepeat ).g * bw.y +
    texture2D( tSandRoughness, vUv * uSandRepeat ).g * bw.z +
    texture2D( tStoneRoughness, vUv * uStoneRepeat ).g * bw.w;`);
  };
  mesh.material.dispose();
  mesh.material = mat;
}

// 1x1 solid-color texture, used as a harmless sampler fallback for any land
// biome that doesn't have a real texture in TERRAIN_TEXTURES yet.
const solidTextureCache = new Map();
function solidColorTexture(hex) {
  if (solidTextureCache.has(hex)) return solidTextureCache.get(hex);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  canvas.getContext('2d').fillStyle = hex;
  canvas.getContext('2d').fillRect(0, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  solidTextureCache.set(hex, tex);
  return tex;
}

// ---------- Sky ----------
let skyMaterial = null;
const SKY_DAY = { top: new THREE.Color('#3a7bd5'), bottom: new THREE.Color('#bcd6ea') };
const SKY_NIGHT = { top: new THREE.Color('#020617'), bottom: new THREE.Color('#0b1330') };

function buildSky() {
  skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: SKY_DAY.top.clone() },
      bottomColor: { value: SKY_DAY.bottom.clone() },
      offset: { value: 20 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(350, 24, 16), skyMaterial);
  scene.add(sky);
}

// ---------- Lighting / atmosphere ----------
export function setDayPhase(dayPhase, isNight) {
  // dayPhase in [0,1); darken sun/hemi and thicken fog through the night.
  const darkness = nightDarkness(dayPhase);
  const t = 1 - darkness;
  sun.intensity = 0.25 + 0.85 * t;
  hemi.intensity = 0.35 + 0.55 * t;

  const top = SKY_DAY.top.clone().lerp(SKY_NIGHT.top, darkness);
  const bottom = SKY_DAY.bottom.clone().lerp(SKY_NIGHT.bottom, darkness);
  skyMaterial.uniforms.topColor.value.copy(top);
  skyMaterial.uniforms.bottomColor.value.copy(bottom);

  fog.color = bottom;
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
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05 }));
  m.position.y = 0.28;
  m.rotation.set(Math.random(), Math.random(), Math.random());
  return m;
}
function buildIronVein() {
  const g = buildRock('#8a8a84');
  const speck = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), new THREE.MeshStandardMaterial({ color: '#c96b3a', emissive: '#5a2a10', flatShading: true, roughness: 0.4, metalness: 0.7 }));
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
    const speck = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ color: speckColor, emissive: speckEmissive, emissiveIntensity: 0.5, flatShading: true, roughness: 0.35, metalness: 0.75 }));
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

// A resource field (hotspot) aura: a soft glowing ring on the ground
// showing where the current best deposit of a material is. Players have to
// physically explore into render/fog range to spot one — there's no
// map-wide list — so finding the richest current spot for what they need
// is real scouting, the way it is in the game this is modeled on.
function buildFieldAura(material) {
  const color = FIELD_COLORS[material] || '#ffffff';
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.6, 9, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(9, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.055;
  group.add(ring, fill);
  group.userData.ring = ring;
  group.userData.fill = fill;
  group.userData.baseColor = color;
  return group;
}

// Resource fields never come and go in the snapshot (there's always exactly
// one per material) so this just updates position/intensity in place.
export function syncFields(fields) {
  for (const f of fields || []) {
    let aura = fieldAuras.get(f.material);
    if (!aura) {
      aura = buildFieldAura(f.material);
      scene.add(aura);
      fieldAuras.set(f.material, aura);
    }
    aura.position.set(f.x, 0, f.y);
    // Richer deposits glow more strongly — a visual cue for "is this worth mining".
    aura.userData.ring.material.opacity = 0.15 + f.richness * 0.35;
    aura.userData.fill.material.opacity = 0.03 + f.richness * 0.1;
  }
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

// ---------- Equipment visuals (held weapons, worn armor) ----------
// Material tier reads straight off the item id prefix — the same
// wood/stone -> iron -> steel progression used throughout crafting.
function gearTierMaterials(itemId) {
  if (itemId.startsWith('steel_')) {
    return {
      main: new THREE.MeshStandardMaterial({ color: '#7d93ab', roughness: 0.3, metalness: 0.85 }),
      grip: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7 }),
    };
  }
  if (itemId.startsWith('iron_')) {
    return {
      main: new THREE.MeshStandardMaterial({ color: '#9a9a9a', roughness: 0.35, metalness: 0.8 }),
      grip: new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.8 }),
    };
  }
  if (itemId === 'tusk_dagger') {
    return {
      main: new THREE.MeshStandardMaterial({ color: '#f2ecd8', roughness: 0.4 }),
      grip: new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 0.8 }),
    };
  }
  if (itemId === 'claw_gauntlets') {
    return {
      main: new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: 0.4 }),
      grip: new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.85 }),
    };
  }
  return { // stone/wood tier default
    main: new THREE.MeshStandardMaterial({ color: '#8a8a84', roughness: 0.8, flatShading: true }),
    grip: new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 0.85 }),
  };
}

function buildHeldWeapon(baseItem) {
  const mat = gearTierMaterials(baseItem);
  const g = new THREE.Group();

  if (baseItem === 'axe' || baseItem === 'iron_axe' || baseItem === 'steel_axe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 5), mat.grip);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat.main);
    blade.rotation.z = Math.PI / 2;
    blade.position.set(0, 0.22, 0.02);
    g.add(handle, blade);
  } else if (baseItem === 'pickaxe' || baseItem === 'iron_pickaxe' || baseItem === 'steel_pickaxe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 5), mat.grip);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.09, 0.28, 4), mat.main);
    head.rotation.z = Math.PI / 2;
    head.position.y = 0.22;
    g.add(handle, head);
  } else if (baseItem === 'fishing_rod') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 0.9, 5), mat.grip);
    rod.position.y = 0.2;
    g.add(rod);
  } else if (baseItem === 'spear') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), mat.grip);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), mat.main);
    tip.position.y = 0.48;
    g.add(handle, tip);
  } else if (baseItem === 'claw_gauntlets') {
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.13, 3), mat.main);
      claw.position.set(side * 0.035, 0.02, 0.08);
      claw.rotation.x = Math.PI / 2.3;
      g.add(claw);
    }
  } else if (baseItem === 'iron_sword' || baseItem === 'steel_sword' || baseItem === 'tusk_dagger') {
    const long = baseItem.endsWith('sword');
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, long ? 0.46 : 0.24, 0.012), mat.main);
    blade.position.y = long ? 0.28 : 0.15;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 5), mat.grip);
    g.add(blade, grip);
  } else {
    return null;
  }

  g.position.set(0.3, 0.58, 0.14);
  g.rotation.z = -0.35;
  return g;
}

function buildArmorPiece(slot, itemId) {
  let color = '#c9b896', metal = false; // cloth default
  if (itemId.startsWith('leather_')) color = '#7a5230';
  else if (itemId.startsWith('heavy_hide_')) color = '#3a2a1c';
  else if (itemId.startsWith('iron_')) { color = '#9a9a9a'; metal = true; }
  else if (itemId.startsWith('steel_')) { color = '#7d93ab'; metal = true; }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.35 : 0.85, metalness: metal ? 0.75 : 0.05, flatShading: true });

  if (slot === 'head') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), mat);
    helm.position.y = 1.07;
    return helm;
  }
  if (slot === 'chest') {
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.42, 8), mat);
    vest.position.y = 0.6;
    return vest;
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.16, 8), mat);
  band.position.y = 0.28;
  return band;
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
// A small upward-drifting, looping ember particle system, parented under a
// fire's flame position. Each particle resets to the base once it reaches
// the top of its life rather than being destroyed/recreated, so this is
// just a few floats mutated per frame — cheap even with many fires lit.
function buildEmbers(count, spread) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const ages = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    ages[i] = Math.random();
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = ages[i] * 0.7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffb066', size: 0.06, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.ages = ages;
  points.userData.spread = spread;
  points.frustumCulled = false;
  return points;
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
    const embers = buildEmbers(16, 0.22);
    embers.position.y = 0.3;
    g.add(logs, flame, light, embers);
    g.userData.embers = embers;
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
    const embers = buildEmbers(10, 0.1);
    embers.position.y = 0.85;
    g.add(pole, flame, light, embers);
    g.userData.embers = embers;
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
function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });
}

function upsert(id, buildFn, x, y, scaleFn) {
  let obj = entityMeshes.get(id);
  if (!obj) {
    obj = buildFn();
    enableShadows(obj);
    scene.add(obj);
    entityMeshes.set(id, obj);
  }
  obj.position.x = x; obj.position.z = y;
  if (scaleFn) scaleFn(obj);
  return obj;
}

// Rebuilds a player's held-weapon/worn-armor meshes only when their
// equipped loadout actually changed (equip state is compared by a cheap
// string key, not deep-diffed every tick — the snapshot arrives ~6.6x/sec
// and rebuilding a handful of primitive meshes each time would be wasteful
// for something that changes maybe once every few seconds).
function updateEquipment(obj, p) {
  const equipKey = p.equipped || '';
  if (obj.userData.equipKey !== equipKey) {
    obj.userData.equipKey = equipKey;
    if (obj.userData.weaponMesh) { obj.remove(obj.userData.weaponMesh); obj.userData.weaponMesh = null; }
    if (equipKey) {
      const info = getItemInfo(equipKey);
      const mesh = buildHeldWeapon(info.baseItem);
      if (mesh) {
        enableShadows(mesh);
        obj.add(mesh);
        obj.userData.weaponMesh = mesh;
      }
    }
  }

  const armor = p.armor || {};
  const armorKey = `${armor.head || ''}|${armor.chest || ''}|${armor.legs || ''}`;
  if (obj.userData.armorKey !== armorKey) {
    obj.userData.armorKey = armorKey;
    for (const slot of ['head', 'chest', 'legs']) {
      const key = 'armorMesh_' + slot;
      if (obj.userData[key]) { obj.remove(obj.userData[key]); obj.userData[key] = null; }
      const itemId = armor[slot];
      if (itemId) {
        const mesh = buildArmorPiece(slot, itemId);
        enableShadows(mesh);
        obj.add(mesh);
        obj.userData[key] = mesh;
      }
    }
  }
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
    const npcAsset = ASSET_MANIFEST.npc && (ASSET_MANIFEST.npc[n.id] || ASSET_MANIFEST.npc.default);
    upsert('n:' + n.id, resolveBuilder('npc', n.id, buildNpc), n.x, n.y);
    if (!nameSprites.has('n:' + n.id)) {
      const sprite = makeNameSprite(n.name, '#f5c542');
      sprite.position.y = npcAsset && npcAsset.height ? npcAsset.height + 0.3 : 1.9;
      entityMeshes.get('n:' + n.id).add(sprite);
      nameSprites.set('n:' + n.id, sprite);
    }
  }

  for (const m of state.mobs) {
    seen.add('m:' + m.id);
    const builder = resolveBuilder('mob', m.type, MOB_BUILDERS[m.type] || MOB_BUILDERS.wolf);
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
    const playerAsset = ASSET_MANIFEST.player && ASSET_MANIFEST.player.default;
    const fallback = () => buildPerson(isMe ? '#5ba848' : '#4586c9');
    const obj = upsert('p:' + p.id, resolveBuilder('player', 'default', fallback), p.x, p.y);
    obj.visible = p.alive;
    if (p.dir && (p.dir.x || p.dir.y) && !obj.userData.isBillboard) {
      obj.rotation.y = Math.atan2(p.dir.x, p.dir.y);
    }
    if (!nameSprites.has('p:' + p.id)) {
      const sprite = makeNameSprite(p.name, isMe ? '#9be564' : '#bcd6ff');
      sprite.position.y = playerAsset && playerAsset.height ? playerAsset.height + 0.3 : 1.55;
      obj.add(sprite);
      nameSprites.set('p:' + p.id, sprite);
    }
    if (!obj.userData.isBillboard) updateEquipment(obj, p);
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

  // Keep the sun (and its shadow frustum) centered on the player rather
  // than fixed in world space, so shadow resolution stays sharp wherever
  // the player roams on the 80x80 map.
  sun.position.set(playerPos.x + SUN_OFFSET.x, SUN_OFFSET.y, playerPos.y + SUN_OFFSET.z);
  sun.target.position.set(playerPos.x, 0, playerPos.y);
  sun.target.updateMatrixWorld();
}

let lastFrameTime = performance.now();

function updateEmbers(embers, dt) {
  const ages = embers.userData.ages;
  const spread = embers.userData.spread;
  const pos = embers.geometry.attributes.position;
  for (let i = 0; i < ages.length; i++) {
    ages[i] += dt * 0.5;
    if (ages[i] > 1) {
      ages[i] -= 1;
      pos.array[i * 3] = (Math.random() - 0.5) * spread;
      pos.array[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    pos.array[i * 3 + 1] = ages[i] * 0.7;
  }
  pos.needsUpdate = true;
  embers.material.opacity = 0.8;
}

export function render() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  for (const obj of entityMeshes.values()) {
    if (obj.userData.isBillboard) {
      const dx = camera.position.x - obj.position.x;
      const dz = camera.position.z - obj.position.z;
      obj.rotation.y = Math.atan2(dx, dz);
    }
    if (obj.userData.embers) updateEmbers(obj.userData.embers, dt);
  }
  const pulse = 0.85 + Math.sin(now / 900) * 0.15;
  for (const aura of fieldAuras.values()) {
    aura.userData.ring.scale.setScalar(pulse);
  }
  composer.render();
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
