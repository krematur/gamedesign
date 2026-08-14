// Item definitions and crafting recipes shared conceptually with the client
// (the client has its own copy of display info in public/js/data.js).

const ITEMS = {
  // raw materials
  wood: { stackable: true, max: 99 },
  stone: { stackable: true, max: 99 },
  fiber: { stackable: true, max: 99 },
  berry: { stackable: true, max: 99, food: 8 },
  meat_raw: { stackable: true, max: 99, food: 6 },
  meat_cooked: { stackable: true, max: 99, food: 20 },
  wolf_hide: { stackable: true, max: 99 },
  iron_ore: { stackable: true, max: 99 },
  iron_ingot: { stackable: true, max: 99 },

  // tools/weapons — tier 1 (stone age)
  axe: { stackable: false, tool: 'axe', tier: 1, damage: 8, gatherBonus: { wood: 3 } },
  pickaxe: { stackable: false, tool: 'pickaxe', tier: 1, damage: 6, gatherBonus: { stone: 3 } },
  spear: { stackable: false, tool: 'weapon', tier: 1, damage: 15 },

  // tools/weapons — tier 2 (iron age)
  iron_axe: { stackable: false, tool: 'axe', tier: 2, damage: 16, gatherBonus: { wood: 6 } },
  iron_pickaxe: { stackable: false, tool: 'pickaxe', tier: 2, damage: 13, gatherBonus: { stone: 6 } },
  iron_sword: { stackable: false, tool: 'weapon', tier: 2, damage: 28 },

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

const RECIPES = [
  // basic tools
  { result: 'axe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 } },

  // structures
  { result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { result: 'furnace', count: 1, cost: { stone: 14, wood: 4 } },
  { result: 'wall', count: 1, cost: { wood: 10 } },

  // cooking (needs a campfire or furnace nearby)
  { result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresStructure: 'campfire' },

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
