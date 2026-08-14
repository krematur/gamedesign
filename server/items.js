// Item definitions and crafting recipes shared conceptually with the client
// (the client has its own copy of display info in public/js/data.js).

const { QUALITY_TIERS, QUALITY_MULT, qualifiedId } = require('./quality');

// Base (normal-tier) item definitions. Any item marked `tierable: true` gets
// a Crude and a Fine variant auto-generated below, with damage/food/gather
// bonus values scaled by the quality multiplier. Gathering a resource can
// yield any tier; crafting with higher-tier materials produces the matching
// higher-tier (better) output — a Fine Axe hits harder than any axe a plain
// "normal" recipe could ever produce.
const BASE_ITEMS = {
  // raw materials
  wood: { stackable: true, max: 99, tierable: true },
  stone: { stackable: true, max: 99, tierable: true },
  fiber: { stackable: true, max: 99, tierable: true },
  berry: { stackable: true, max: 99, food: 8 },
  meat_raw: { stackable: true, max: 99, food: 6 },
  meat_cooked: { stackable: true, max: 99, food: 20, tierable: true },
  iron_ore: { stackable: true, max: 99, tierable: true },
  iron_ingot: { stackable: true, max: 99, tierable: true },
  raw_fish: { stackable: true, max: 99, food: 10, tierable: true },
  cooked_fish: { stackable: true, max: 99, food: 28, tierable: true },
  coal: { stackable: true, max: 99, tierable: true },
  gold_ore: { stackable: true, max: 99, tierable: true },
  gold_ingot: { stackable: true, max: 99, tierable: true },
  steel_ingot: { stackable: true, max: 99, tierable: true },
  clay: { stackable: true, max: 99, tierable: true },
  brick: { stackable: true, max: 99 },

  // animal trophies (hunting drops; not gathered with tools, so no quality tiers)
  wolf_hide: { stackable: true, max: 99 },
  rabbit_fur: { stackable: true, max: 99 },
  deer_hide: { stackable: true, max: 99 },
  boar_tusk: { stackable: true, max: 99 },
  bear_hide: { stackable: true, max: 99 },
  bear_claw: { stackable: true, max: 99 },

  // tools/weapons — tier 1 (stone age)
  axe: { stackable: false, tool: 'axe', tier: 1, damage: 8, gatherBonus: { wood: 3 }, tierable: true },
  pickaxe: { stackable: false, tool: 'pickaxe', tier: 1, damage: 6, gatherBonus: { stone: 3 }, tierable: true },
  spear: { stackable: false, tool: 'weapon', tier: 1, damage: 15, tierable: true },
  fishing_rod: { stackable: false, tool: 'fishing_rod', tier: 1, damage: 2 },

  // tools/weapons — tier 2 (iron age)
  iron_axe: { stackable: false, tool: 'axe', tier: 2, damage: 16, gatherBonus: { wood: 6 }, tierable: true },
  iron_pickaxe: { stackable: false, tool: 'pickaxe', tier: 2, damage: 13, gatherBonus: { stone: 6 }, tierable: true },
  iron_sword: { stackable: false, tool: 'weapon', tier: 2, damage: 28, tierable: true },

  // tools/weapons — tier 3 (steel age, the current endgame tier)
  steel_axe: { stackable: false, tool: 'axe', tier: 3, damage: 24, gatherBonus: { wood: 9 }, tierable: true },
  steel_pickaxe: { stackable: false, tool: 'pickaxe', tier: 3, damage: 20, gatherBonus: { stone: 9 }, tierable: true },
  steel_sword: { stackable: false, tool: 'weapon', tier: 3, damage: 40, tierable: true },

  // situational weapons — trade raw damage for attack speed (or the reverse)
  tusk_dagger: { stackable: false, tool: 'weapon', tier: 1, damage: 10, attackCooldownMs: 300 },
  claw_gauntlets: { stackable: false, tool: 'weapon', tier: 2, damage: 34, attackCooldownMs: 950 },

  // armor — material tiers x three slots
  cloth_head: { stackable: false, armorSlot: 'head', tier: 1, defense: 0.04 },
  cloth_chest: { stackable: false, armorSlot: 'chest', tier: 1, defense: 0.06 },
  cloth_legs: { stackable: false, armorSlot: 'legs', tier: 1, defense: 0.05 },
  leather_head: { stackable: false, armorSlot: 'head', tier: 2, defense: 0.07 },
  leather_chest: { stackable: false, armorSlot: 'chest', tier: 2, defense: 0.1 },
  leather_legs: { stackable: false, armorSlot: 'legs', tier: 2, defense: 0.08 },
  heavy_hide_head: { stackable: false, armorSlot: 'head', tier: 3, defense: 0.09 },
  heavy_hide_chest: { stackable: false, armorSlot: 'chest', tier: 3, defense: 0.13 },
  heavy_hide_legs: { stackable: false, armorSlot: 'legs', tier: 3, defense: 0.1 },
  iron_head: { stackable: false, armorSlot: 'head', tier: 4, defense: 0.11 },
  iron_chest: { stackable: false, armorSlot: 'chest', tier: 4, defense: 0.16 },
  iron_legs: { stackable: false, armorSlot: 'legs', tier: 4, defense: 0.13 },
  steel_head: { stackable: false, armorSlot: 'head', tier: 5, defense: 0.14 },
  steel_chest: { stackable: false, armorSlot: 'chest', tier: 5, defense: 0.2 },
  steel_legs: { stackable: false, armorSlot: 'legs', tier: 5, defense: 0.16 },

  // accessories — a fourth equip slot with small passive perks
  gold_ring: { stackable: false, accessorySlot: true, gatherYieldBonus: 1 },

  // structures
  campfire: { stackable: false, placeable: true },
  furnace: { stackable: false, placeable: true },
  wall: { stackable: false, placeable: true },
  reinforced_wall: { stackable: false, placeable: true },
  torch: { stackable: false, placeable: true },
};

function scaleStats(def, mult) {
  const out = { ...def };
  delete out.tierable;
  if (typeof out.damage === 'number') out.damage = Math.max(1, Math.round(out.damage * mult));
  if (typeof out.food === 'number') out.food = Math.max(1, Math.round(out.food * mult));
  if (out.gatherBonus) {
    out.gatherBonus = Object.fromEntries(
      Object.entries(out.gatherBonus).map(([k, v]) => [k, Math.max(1, Math.round(v * mult))])
    );
  }
  return out;
}

const ITEMS = {};
for (const [id, def] of Object.entries(BASE_ITEMS)) {
  ITEMS[id] = { ...def };
  if (def.tierable) {
    for (const quality of QUALITY_TIERS) {
      if (quality === 'normal') continue;
      const variant = scaleStats(def, QUALITY_MULT[quality]);
      variant.baseItem = id;
      variant.quality = quality;
      ITEMS[qualifiedId(id, quality)] = variant;
    }
  }
}

// Every recipe has a unique `id` (what the client crafts by) and a `result`
// (the item it produces). Multiple recipes can share a `result` — e.g. a
// Leather Cap can be made from wolf hide or deer hide — letting hunters
// choose which animal to pursue without duplicating the output item.
const RECIPES = [
  // basic tools
  { id: 'axe', result: 'axe', count: 1, cost: { wood: 5, stone: 3 }, qualityCraftable: true },
  { id: 'pickaxe', result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 }, qualityCraftable: true },
  { id: 'spear', result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 }, qualityCraftable: true },
  { id: 'fishing_rod', result: 'fishing_rod', count: 1, cost: { wood: 6, fiber: 4 } },
  { id: 'tusk_dagger', result: 'tusk_dagger', count: 1, cost: { boar_tusk: 2, wood: 3, fiber: 2 } },
  { id: 'claw_gauntlets', result: 'claw_gauntlets', count: 1, cost: { bear_claw: 2, fiber: 3 } },

  // structures
  { id: 'campfire', result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { id: 'furnace', result: 'furnace', count: 1, cost: { stone: 14, wood: 4 } },
  { id: 'wall', result: 'wall', count: 1, cost: { wood: 10 } },
  { id: 'reinforced_wall', result: 'reinforced_wall', count: 1, cost: { brick: 8 } },
  { id: 'torch', result: 'torch', count: 1, cost: { wood: 2, fiber: 1 } },

  // firing bricks (needs a campfire or furnace nearby)
  { id: 'brick', result: 'brick', count: 1, cost: { clay: 2, wood: 1 }, requiresStructure: 'campfire' },

  // cooking (needs a campfire or furnace nearby)
  { id: 'meat_cooked', result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresStructure: 'campfire', qualityCraftable: true },
  { id: 'cooked_fish', result: 'cooked_fish', count: 1, cost: { raw_fish: 1, wood: 1 }, requiresStructure: 'campfire', qualityCraftable: true },

  // smelting (needs a furnace; gated behind the Blacksmithing quest)
  { id: 'iron_ingot', result: 'iron_ingot', count: 1, cost: { iron_ore: 2, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { id: 'gold_ingot', result: 'gold_ingot', count: 1, cost: { gold_ore: 2, coal: 1 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },

  // iron tools (gated behind the Blacksmithing quest)
  { id: 'iron_axe', result: 'iron_axe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { id: 'iron_pickaxe', result: 'iron_pickaxe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { id: 'iron_sword', result: 'iron_sword', count: 1, cost: { iron_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },

  // steel: smelted from iron + coal, gated behind the Master Smith quest
  { id: 'steel_ingot', result: 'steel_ingot', count: 1, cost: { iron_ingot: 2, coal: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },
  { id: 'steel_axe', result: 'steel_axe', count: 1, cost: { steel_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },
  { id: 'steel_pickaxe', result: 'steel_pickaxe', count: 1, cost: { steel_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },
  { id: 'steel_sword', result: 'steel_sword', count: 1, cost: { steel_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },

  // cloth armor (tier 1, always available)
  { id: 'cloth_head', result: 'cloth_head', count: 1, cost: { fiber: 6 } },
  { id: 'cloth_chest', result: 'cloth_chest', count: 1, cost: { fiber: 10 } },
  { id: 'cloth_legs', result: 'cloth_legs', count: 1, cost: { fiber: 8 } },

  // leather armor (tier 2, gated behind the Hunter quest) — wolf or deer hide
  { id: 'leather_head_wolf', result: 'leather_head', labelSuffix: ' (Wolf)', count: 1, cost: { wolf_hide: 2, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_chest_wolf', result: 'leather_chest', labelSuffix: ' (Wolf)', count: 1, cost: { wolf_hide: 4, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_legs_wolf', result: 'leather_legs', labelSuffix: ' (Wolf)', count: 1, cost: { wolf_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_head_deer', result: 'leather_head', labelSuffix: ' (Deer)', count: 1, cost: { deer_hide: 2, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_chest_deer', result: 'leather_chest', labelSuffix: ' (Deer)', count: 1, cost: { deer_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_legs_deer', result: 'leather_legs', labelSuffix: ' (Deer)', count: 1, cost: { deer_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },

  // heavy hide armor (tier 3, bear-hunting reward — no structure/quest gate,
  // the scarcity of bear hide is the gate)
  { id: 'heavy_hide_head', result: 'heavy_hide_head', count: 1, cost: { bear_hide: 1, fiber: 3 } },
  { id: 'heavy_hide_chest', result: 'heavy_hide_chest', count: 1, cost: { bear_hide: 2, fiber: 3 } },
  { id: 'heavy_hide_legs', result: 'heavy_hide_legs', count: 1, cost: { bear_hide: 2, fiber: 2 } },

  // iron armor (tier 4, gated behind the Blacksmithing quest)
  { id: 'iron_head', result: 'iron_head', count: 1, cost: { iron_ingot: 2, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { id: 'iron_chest', result: 'iron_chest', count: 1, cost: { iron_ingot: 4, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { id: 'iron_legs', result: 'iron_legs', count: 1, cost: { iron_ingot: 3, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },

  // steel armor (tier 5, gated behind the Master Smith quest)
  { id: 'steel_head', result: 'steel_head', count: 1, cost: { steel_ingot: 2, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith' },
  { id: 'steel_chest', result: 'steel_chest', count: 1, cost: { steel_ingot: 4, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith' },
  { id: 'steel_legs', result: 'steel_legs', count: 1, cost: { steel_ingot: 3, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith' },

  // accessories
  { id: 'gold_ring', result: 'gold_ring', count: 1, cost: { gold_ingot: 2, fiber: 1 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
];

module.exports = { ITEMS, RECIPES };
