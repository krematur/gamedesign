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

function generateWorld(seed = 1337) {
  const rng = makeRng(seed);
  const tiles = new Array(WORLD_SIZE * WORLD_SIZE);

  // Generate smooth-ish noise by blurring random values.
  const raw = new Float32Array(WORLD_SIZE * WORLD_SIZE);
  for (let i = 0; i < raw.length; i++) raw[i] = rng();

  function blurredAt(x, y) {
    let sum = 0, count = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < WORLD_SIZE && ny < WORLD_SIZE) {
          sum += raw[ny * WORLD_SIZE + nx];
          count++;
        }
      }
    }
    return sum / count;
  }

  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const idx = y * WORLD_SIZE + x;
      const distFromEdge = Math.min(x, y, WORLD_SIZE - 1 - x, WORLD_SIZE - 1 - y);
      const n = blurredAt(x, y);
      let tile;
      if (distFromEdge < 2) {
        tile = TILE.WATER;
      } else if (n < 0.32) {
        tile = TILE.WATER;
      } else if (n < 0.38) {
        tile = TILE.SAND;
      } else if (n < 0.62) {
        tile = TILE.GRASS;
      } else if (n < 0.8) {
        tile = TILE.FOREST;
      } else {
        tile = TILE.STONE;
      }
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
