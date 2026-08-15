const WORLD_SIZE = 80; // tiles per side
const TILE = { GRASS: 0, FOREST: 1, WATER: 2, STONE: 3, SAND: 4 };

// Simple deterministic pseudo-random noise (value noise) so every server
// boot produces the same world layout unless a seed is supplied.
function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

// Blur a raw hash-noise field over a given window radius — bigger windows
// produce lower-frequency, larger-scale features.
function blurField(raw, radius) {
  const out = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < WORLD_SIZE && ny < WORLD_SIZE) {
            sum += raw[ny * WORLD_SIZE + nx];
            count++;
          }
        }
      }
      out[y * WORLD_SIZE + x] = sum / count;
    }
  }
  return out;
}

// Stretch a field back out to the full [0,1] range — averaging/blurring
// collapses values tightly around the mean, which would starve the
// high/low tails (mountains, coastline) of any tiles otherwise.
function normalize01(field) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < field.length; i++) {
    if (field[i] < min) min = field[i];
    if (field[i] > max) max = field[i];
  }
  const range = Math.max(1e-6, max - min);
  const out = new Float32Array(field.length);
  for (let i = 0; i < field.length; i++) out[i] = (field[i] - min) / range;
  return out;
}

function generateWorld(seed = 1337) {
  const rng = makeRng(seed);
  const tiles = new Array(WORLD_SIZE * WORLD_SIZE);

  // Three independent noise fields at different scales: fine detail (small
  // blur radius, for local texture/edges), a coastline field (large blur
  // radius, warps the island's radial falloff into bays/peninsulas), and a
  // separate mountains field (its own large-blur noise, unrelated to where
  // the island's geometric center is) — so highlands can cluster off to
  // one side of the island rather than always sitting at the exact center,
  // leaving the middle of the map (where players/NPCs spawn) as lowland.
  const rawDetail = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  const rawCoast = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  const rawMountains = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  for (let i = 0; i < rawDetail.length; i++) { rawDetail[i] = rng(); rawCoast[i] = rng(); rawMountains[i] = rng(); }
  const detail = normalize01(blurField(rawDetail, 2));
  const coastWarp = normalize01(blurField(rawCoast, 9));
  const mountains = normalize01(blurField(rawMountains, 7));

  // A single landmass surrounded by ocean: start from a radial falloff
  // (high at the center, tapering to 0 at the map edge) and warp its
  // effective radius with the coastline noise field, so the coastline
  // bulges into peninsulas and cuts into bays instead of being a perfect
  // circle. The center is offset off-map-center so the island reads as
  // one asymmetric landmass rather than a bullseye.
  const cx = WORLD_SIZE * 0.47;
  const cy = WORLD_SIZE * 0.55;
  const maxRadius = WORLD_SIZE * 0.46;
  const elevationRaw = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const idx = y * WORLD_SIZE + x;
      const dx = (x - cx) / maxRadius;
      const dy = (y - cy) / maxRadius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const warp = (coastWarp[idx] - 0.5) * 0.7;
      const shapedDist = Math.max(0, dist + warp);
      const islandShape = Math.max(0, 1 - Math.pow(shapedDist, 1.6));
      elevationRaw[idx] = islandShape * 0.78 + detail[idx] * 0.22;
    }
  }
  const elevation = normalize01(elevationRaw);

  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const idx = y * WORLD_SIZE + x;
      const distFromEdge = Math.min(x, y, WORLD_SIZE - 1 - x, WORLD_SIZE - 1 - y);
      const n = elevation[idx];
      let tile;
      if (distFromEdge < 2) {
        tile = TILE.WATER;
      } else if (n < 0.30) {
        tile = TILE.WATER;
      } else if (n < 0.36) {
        tile = TILE.SAND;
      } else if (n < 0.68) {
        tile = TILE.GRASS;
      } else {
        tile = TILE.FOREST;
      }
      // Mountain ranges: an independent noise blob, so they cluster off to
      // one side of the island instead of always crowning the exact
      // center — only on land well clear of the coast, never on sand.
      if (mountains[idx] > 0.66 && n >= 0.42) tile = TILE.STONE;
      tiles[idx] = tile;
    }
  }

  return { size: WORLD_SIZE, tiles };
}

function tileAt(world, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) return TILE.WATER;
  return world.tiles[ty * world.size + tx];
}

function isWalkable(world, x, y) {
  return tileAt(world, x, y) !== TILE.WATER;
}

module.exports = { WORLD_SIZE, TILE, generateWorld, tileAt, isWalkable, makeRng };
