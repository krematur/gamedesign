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
  wolf_hide: { stackable: true, max: 99 },
  iron_ore: { stackable: true, max: 99, tierable: true },
  iron_ingot: { stackable: true, max: 99, tierable: true },
  raw_fish: { stackable: true, max: 99, food: 10, tierable: true },
  cooked_fish: { stackable: true, max: 99, food: 28, tierable: true },

  // tools/weapons — tier 1 (stone age)
  axe: { stackable: false, tool: 'axe', tier: 1, damage: 8, gatherBonus: { wood: 3 }, tierable: true },
  pickaxe: { stackable: false, tool: 'pickaxe', tier: 1, damage: 6, gatherBonus: { stone: 3 }, tierable: true },
  spear: { stackable: false, tool: 'weapon', tier: 1, damage: 15, tierable: true },
  fishing_rod: { stackable: false, tool: 'fishing_rod', tier: 1, damage: 2 },

  // tools/weapons — tier 2 (iron age)
  iron_axe: { stackable: false, tool: 'axe', tier: 2, damage: 16, gatherBonus: { wood: 6 }, tierable: true },
  iron_pickaxe: { stackable: false, tool: 'pickaxe', tier: 2, damage: 13, gatherBonus: { stone: 6 }, tierable: true },
  iron_sword: { stackable: false, tool: 'weapon', tier: 2, damage: 28, tierable: true },

  // armor — three material tiers x three slots
  cloth_head: { stackable: false, armorSlot: 'head', tier: 1, defense: 0.04 },
  cloth_chest: { stackable: false, armorSlot: 'chest', tier: 1, defense: 0.06 },
  cloth_legs: { stackable: false, armorSlot: 'legs', tier: 1, defense: 0.05 },
  leather_head: { stackable: false, armorSlot: 'head', tier: 2, defense: 0.07 },
  leather_chest: { stackable: false, armorSlot: 'chest', tier: 2, defense: 0.1 },
  leather_legs: { stackable: false, armorSlot: 'legs', tier: 2, defense: 0.08 },
  iron_head: { stackable: false, armorSlot: 'head', tier: 3, defense: 0.11 },
  iron_chest: { stackable: false, armorSlot: 'chest', tier: 3, defense: 0.16 },
  iron_legs: { stackable: false, armorSlot: 'legs', tier: 3, defense: 0.13 },

  // structures
  campfire: { stackable: false, placeable: true },
  furnace: { stackable: false, placeable: true },
  wall: { stackable: false, placeable: true },
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

const RECIPES = [
  // basic tools
  { result: 'axe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 } },
  { result: 'fishing_rod', count: 1, cost: { wood: 6, fiber: 4 } },

  // structures
  { result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { result: 'furnace', count: 1, cost: { stone: 14, wood: 4 } },
  { result: 'wall', count: 1, cost: { wood: 10 } },

  // cooking (needs a campfire or furnace nearby)
  { result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresStructure: 'campfire' },
  { result: 'cooked_fish', count: 1, cost: { raw_fish: 1, wood: 1 }, requiresStructure: 'campfire' },

  // smelting (needs a furnace; gated behind the Blacksmithing quest)
  { result: 'iron_ingot', count: 1, cost: { iron_ore: 2, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },

  // iron tools (gated behind the Blacksmithing quest)
  { result: 'iron_axe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_pickaxe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_sword', count: 1, cost: { iron_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },

  // cloth armor (tier 1, always available)
  { result: 'cloth_head', count: 1, cost: { fiber: 6 } },
  { result: 'cloth_chest', count: 1, cost: { fiber: 10 } },
  { result: 'cloth_legs', count: 1, cost: { fiber: 8 } },

  // leather armor (tier 2, gated behind the Hunter quest)
  { result: 'leather_head', count: 1, cost: { wolf_hide: 2, fiber: 2 }, requiresQuest: 'hunter' },
  { result: 'leather_chest', count: 1, cost: { wolf_hide: 4, fiber: 2 }, requiresQuest: 'hunter' },
  { result: 'leather_legs', count: 1, cost: { wolf_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },

  // iron armor (tier 3, gated behind the Blacksmithing quest)
  { result: 'iron_head', count: 1, cost: { iron_ingot: 2, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_chest', count: 1, cost: { iron_ingot: 4, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_legs', count: 1, cost: { iron_ingot: 3, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
];

module.exports = { ITEMS, RECIPES };
