// Display metadata for items (kept in sync with server/items.js).
const ITEM_INFO = {
  wood: { icon: '🪵', label: 'Wood' },
  stone: { icon: '🪨', label: 'Stone' },
  fiber: { icon: '🌾', label: 'Fiber' },
  berry: { icon: '🍓', label: 'Berry', edible: true },
  meat_raw: { icon: '🥩', label: 'Raw Meat', edible: true },
  meat_cooked: { icon: '🍖', label: 'Cooked Meat', edible: true },
  wolf_hide: { icon: '🐾', label: 'Wolf Hide' },
  iron_ore: { icon: '⛰️', label: 'Iron Ore' },
  iron_ingot: { icon: '🔩', label: 'Iron Ingot' },

  axe: { icon: '🪓', label: 'Axe', equip: true },
  pickaxe: { icon: '⛏️', label: 'Pickaxe', equip: true },
  spear: { icon: '🔱', label: 'Spear', equip: true },
  iron_axe: { icon: '🪓', label: 'Iron Axe', equip: true },
  iron_pickaxe: { icon: '⛏️', label: 'Iron Pickaxe', equip: true },
  iron_sword: { icon: '⚔️', label: 'Iron Sword', equip: true },

  cloth_head: { icon: '🧢', label: 'Cloth Hood', armorSlot: 'head' },
  cloth_chest: { icon: '👕', label: 'Cloth Tunic', armorSlot: 'chest' },
  cloth_legs: { icon: '🩳', label: 'Cloth Pants', armorSlot: 'legs' },
  leather_head: { icon: '🎩', label: 'Leather Cap', armorSlot: 'head' },
  leather_chest: { icon: '🥼', label: 'Leather Vest', armorSlot: 'chest' },
  leather_legs: { icon: '👖', label: 'Leather Pants', armorSlot: 'legs' },
  iron_head: { icon: '⛑️', label: 'Iron Helm', armorSlot: 'head' },
  iron_chest: { icon: '🛡️', label: 'Iron Chestplate', armorSlot: 'chest' },
  iron_legs: { icon: '🦿', label: 'Iron Greaves', armorSlot: 'legs' },

  campfire: { icon: '🔥', label: 'Campfire', placeable: true },
  furnace: { icon: '🏭', label: 'Furnace', placeable: true },
  wall: { icon: '🧱', label: 'Wall', placeable: true },
};

const RECIPES = [
  { result: 'axe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 } },

  { result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { result: 'furnace', count: 1, cost: { stone: 14, wood: 4 } },
  { result: 'wall', count: 1, cost: { wood: 10 } },

  { result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresStructure: 'campfire' },

  { result: 'iron_ingot', count: 1, cost: { iron_ore: 2, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_axe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_pickaxe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_sword', count: 1, cost: { iron_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },

  { result: 'cloth_head', count: 1, cost: { fiber: 6 } },
  { result: 'cloth_chest', count: 1, cost: { fiber: 10 } },
  { result: 'cloth_legs', count: 1, cost: { fiber: 8 } },

  { result: 'leather_head', count: 1, cost: { wolf_hide: 2, fiber: 2 }, requiresQuest: 'hunter' },
  { result: 'leather_chest', count: 1, cost: { wolf_hide: 4, fiber: 2 }, requiresQuest: 'hunter' },
  { result: 'leather_legs', count: 1, cost: { wolf_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },

  { result: 'iron_head', count: 1, cost: { iron_ingot: 2, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_chest', count: 1, cost: { iron_ingot: 4, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { result: 'iron_legs', count: 1, cost: { iron_ingot: 3, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
];

const TILE_COLORS = {
  0: '#4c7a3a', // grass
  1: '#2f5a2c', // forest
  2: '#2a5f8a', // water
  3: '#7d7d72', // stone
  4: '#d8c98a', // sand
};

const ARMOR_SLOTS = ['head', 'chest', 'legs'];
const ARMOR_SLOT_ICON = { head: '⛑️', chest: '🛡️', legs: '🦵' };
