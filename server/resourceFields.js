// Star Wars Galaxies-style resource fields: for every harvestable raw
// material, exactly one "deposit" is active on the map at a time — a
// circular hotspot with its own randomly-rolled richness. Gathering that
// material *inside* the hotspot has a much better chance of coming out
// Fine quality; gathering the same resource node "in the wild" (outside any
// active field) is mostly Crude/Normal. Deposits drain as players harvest
// from them and expire after a while either way, then a fresh one spawns
// at a new random location — so the best spot to mine iron this hour won't
// be the best spot tomorrow, and players have to scout for it rather than
// camp one tile forever.
const { TILE, tileAt } = require('./world');

// Which biome a material's deposits can appear in, mirroring where its
// resource nodes spawn (see game.js spawnResources).
const MATERIAL_BIOME = {
  wood: 'FOREST',
  fiber: 'GRASS',
  stone: 'STONE',
  iron_ore: 'STONE',
  coal: 'STONE',
  gold_ore: 'STONE',
  clay: 'SAND',
  raw_fish: 'WATER',
};

const DEPOSIT_RADIUS = 9;
const MIN_LIFETIME_MS = 8 * 60 * 1000;
const MAX_LIFETIME_MS = 15 * 60 * 1000;
const MIN_CAPACITY = 250;
const MAX_CAPACITY = 550;

class ResourceFieldManager {
  constructor(world, rng, tickMs) {
    this.world = world;
    this.rng = rng;
    this.tickMs = tickMs;
    this.deposits = new Map(); // material -> deposit
    for (const material of Object.keys(MATERIAL_BIOME)) this.respawn(material, 0);
  }

  ticksFor(ms) {
    return Math.max(1, Math.round(ms / this.tickMs));
  }

  validCenter(material, x, y) {
    return tileAt(this.world, x, y) === TILE[MATERIAL_BIOME[material]];
  }

  respawn(material, tick) {
    let x = this.world.size / 2, y = this.world.size / 2, tries = 0;
    do {
      x = this.rng() * this.world.size;
      y = this.rng() * this.world.size;
      tries++;
    } while (!this.validCenter(material, x, y) && tries < 200);

    const richness = this.rng(); // 0 (poor) .. 1 (exceptional) — the deposit's overall luck
    const lifetimeMs = MIN_LIFETIME_MS + this.rng() * (MAX_LIFETIME_MS - MIN_LIFETIME_MS);
    const capacity = Math.round(MIN_CAPACITY + this.rng() * (MAX_CAPACITY - MIN_CAPACITY));

    this.deposits.set(material, {
      material, x, y, radius: DEPOSIT_RADIUS,
      richness, capacity, remaining: capacity,
      expiresAt: tick + this.ticksFor(lifetimeMs),
    });
  }

  // Call once per tick; cheap (8 materials) so no throttling needed.
  update(tick) {
    for (const [material, dep] of this.deposits) {
      if (tick >= dep.expiresAt || dep.remaining <= 0) this.respawn(material, tick);
    }
  }

  // Returns a 0..1 quality bias for gathering `material` at (x,y) right
  // now: 0 if outside any active deposit (wild — poor odds), otherwise the
  // deposit's richness softened by a falloff toward the edge of its radius.
  biasAt(material, x, y) {
    const dep = this.deposits.get(material);
    if (!dep) return 0;
    const dist = Math.hypot(dep.x - x, dep.y - y);
    if (dist > dep.radius) return 0;
    const falloff = 1 - (dist / dep.radius) * 0.4;
    return dep.richness * falloff;
  }

  // Draws down the active deposit's remaining capacity when a harvest
  // benefited from it — mining out a hotspot is what forces it to move on.
  deplete(material, x, y, amount) {
    const dep = this.deposits.get(material);
    if (!dep) return;
    const dist = Math.hypot(dep.x - x, dep.y - y);
    if (dist > dep.radius) return;
    dep.remaining = Math.max(0, dep.remaining - amount);
  }

  snapshot() {
    return Array.from(this.deposits.values()).map(d => ({
      material: d.material, x: d.x, y: d.y, radius: d.radius, richness: d.richness,
    }));
  }
}

module.exports = { ResourceFieldManager, MATERIAL_BIOME };
