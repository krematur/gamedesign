// Wildlife definitions. Each type declares its stats, AI behavior, where it
// spawns, and what it drops when killed. game.js drives the actual
// simulation generically off these tables instead of hardcoding per-animal
// logic, so adding a new animal is just adding an entry here.
//
// behavior:
//   'aggressive' — always hunts the nearest player within aggroRange
//   'flee'       — passive; runs away from any player within aggroRange
//   'neutral'    — wanders peacefully, but turns aggressive at whoever
//                  attacks it (and stays that way until it dies)

const MOB_TYPES = {
  wolf: {
    label: 'Wolf', hp: 30, damage: 8, chaseSpeed: 2.6, wanderSpeed: 0.8,
    aggroRange: 6, behavior: 'aggressive', spawnBiomes: ['GRASS', 'FOREST'],
    nightBias: 3, // relative spawn weight multiplier at night
    drops: [
      { item: 'meat_raw', min: 2, max: 4, chance: 1 },
      { item: 'wolf_hide', min: 1, max: 1, chance: 1 },
    ],
  },
  rabbit: {
    label: 'Rabbit', hp: 8, damage: 0, chaseSpeed: 0, wanderSpeed: 1.1,
    aggroRange: 4, behavior: 'flee', fleeSpeed: 3.4, spawnBiomes: ['GRASS'],
    drops: [
      { item: 'meat_raw', min: 1, max: 2, chance: 1 },
      { item: 'rabbit_fur', min: 1, max: 1, chance: 0.8 },
    ],
  },
  deer: {
    label: 'Deer', hp: 22, damage: 0, chaseSpeed: 0, wanderSpeed: 1.0,
    aggroRange: 6, behavior: 'flee', fleeSpeed: 3.0, spawnBiomes: ['GRASS', 'FOREST'],
    drops: [
      { item: 'meat_raw', min: 3, max: 5, chance: 1 },
      { item: 'deer_hide', min: 1, max: 1, chance: 0.9 },
    ],
  },
  boar: {
    label: 'Boar', hp: 26, damage: 10, chaseSpeed: 2.4, wanderSpeed: 0.9,
    aggroRange: 3, behavior: 'neutral', spawnBiomes: ['FOREST'],
    drops: [
      { item: 'meat_raw', min: 2, max: 4, chance: 1 },
      { item: 'boar_tusk', min: 1, max: 2, chance: 0.7 },
    ],
  },
  bear: {
    label: 'Bear', hp: 70, damage: 18, chaseSpeed: 2.2, wanderSpeed: 0.7,
    aggroRange: 5, behavior: 'aggressive', spawnBiomes: ['FOREST', 'STONE'],
    rarityWeight: 0.25, // spawned less often than other animals
    drops: [
      { item: 'meat_raw', min: 4, max: 7, chance: 1 },
      { item: 'bear_hide', min: 1, max: 1, chance: 0.9 },
      { item: 'bear_claw', min: 1, max: 2, chance: 0.6 },
    ],
  },
};

function rollDrops(rng, mobType) {
  const def = MOB_TYPES[mobType];
  const results = [];
  if (!def) return results;
  for (const drop of def.drops) {
    if (rng() > (drop.chance ?? 1)) continue;
    const amount = drop.min + Math.floor(rng() * (drop.max - drop.min + 1));
    if (amount > 0) results.push({ item: drop.item, amount });
  }
  return results;
}

module.exports = { MOB_TYPES, rollDrops };
