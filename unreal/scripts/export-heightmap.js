#!/usr/bin/env node
// Exports the existing procedural world (server/world.js) as a heightmap
// PNG + biome-mask PNG + path-mask PNG, for import into an Unreal
// Landscape as a starting point (see unreal/Wildholm/DESIGN_PORT.md).
//
// Usage: node unreal/scripts/export-heightmap.js [seed] [outDir]

const fs = require('fs');
const path = require('path');
const { generateWorld, TILE } = require('../../server/world');
const { encodeGrayscalePNG } = require('./png');

const seed = process.argv[2] ? Number(process.argv[2]) : 1337;
const outDir = process.argv[3] || path.join(__dirname, '..', 'exports');

// Mirrors TILE_HEIGHT in public/js/render3d.js so the exported heightmap
// matches what the browser version actually renders.
const TILE_HEIGHT = { 0: 0, 1: 0.08, 2: -0.6, 3: 0.55, 4: -0.05 }; // grass, forest, water, stone, sand

function buildHeightmap(world) {
  const size = world.size;
  const verts = size + 1;
  const tileAt = (x, y) => {
    x = Math.max(0, Math.min(size - 1, x));
    y = Math.max(0, Math.min(size - 1, y));
    return world.tiles[y * size + x];
  };

  // Same per-vertex "average the up-to-4 tiles sharing this corner" smoothing
  // render3d.js uses, so the exported heightmap isn't a blocky per-tile stair-step.
  const raw = new Float32Array(verts * verts);
  let min = Infinity, max = -Infinity;
  for (let vy = 0; vy < verts; vy++) {
    for (let vx = 0; vx < verts; vx++) {
      const tiles = [tileAt(vx - 1, vy - 1), tileAt(vx, vy - 1), tileAt(vx - 1, vy), tileAt(vx, vy)];
      const h = tiles.reduce((s, t) => s + TILE_HEIGHT[t], 0) / tiles.length;
      raw[vy * verts + vx] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }

  const range = Math.max(1e-6, max - min);
  return { verts, getPixel: (x, y) => Math.round(((raw[y * verts + x] - min) / range) * 65535) };
}

function main() {
  const world = generateWorld(seed);
  fs.mkdirSync(outDir, { recursive: true });

  const { verts, getPixel } = buildHeightmap(world);
  const heightmapPng = encodeGrayscalePNG(verts, verts, 16, getPixel);
  fs.writeFileSync(path.join(outDir, `heightmap_seed${seed}.png`), heightmapPng);

  // Biome mask: one 8-bit value per tile (0=grass,1=forest,2=water,3=stone,4=sand),
  // scaled up so it's visually distinguishable when eyeballed, not just for import.
  const biomeScale = Math.floor(255 / 4);
  const biomePng = encodeGrayscalePNG(world.size, world.size, 8, (x, y) => world.tiles[y * world.size + x] * biomeScale);
  fs.writeFileSync(path.join(outDir, `biomemask_seed${seed}.png`), biomePng);

  const pathPng = encodeGrayscalePNG(world.size, world.size, 8, (x, y) => (world.paths[y * world.size + x] ? 255 : 0));
  fs.writeFileSync(path.join(outDir, `pathmask_seed${seed}.png`), pathPng);

  const counts = { grass: 0, forest: 0, water: 0, stone: 0, sand: 0 };
  const names = ['grass', 'forest', 'water', 'stone', 'sand'];
  for (const t of world.tiles) counts[names[t]]++;

  console.log(`Exported world (seed ${seed}, ${world.size}x${world.size}) to ${outDir}`);
  console.log('Biome tile counts:', counts);
}

main();
