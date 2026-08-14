// Display metadata for items (kept in sync conceptually with server/items.js).
const ITEM_INFO = {
  wood: { icon: '🪵', label: 'Wood' },
  stone: { icon: '🪨', label: 'Stone' },
  fiber: { icon: '🌾', label: 'Fiber' },
  berry: { icon: '🍓', label: 'Berry', edible: true },
  meat_raw: { icon: '🥩', label: 'Raw Meat', edible: true },
  meat_cooked: { icon: '🍖', label: 'Cooked Meat', edible: true },
  axe: { icon: '🪓', label: 'Axe', equip: true },
  pickaxe: { icon: '⛏️', label: 'Pickaxe', equip: true },
  spear: { icon: '🔱', label: 'Spear', equip: true },
  campfire: { icon: '🔥', label: 'Campfire', placeable: true },
  wall: { icon: '🧱', label: 'Wall', placeable: true },
};

const RECIPES = [
  { result: 'axe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 } },
  { result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { result: 'wall', count: 1, cost: { wood: 10 } },
  { result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresFire: true },
];

const TILE_COLORS = {
  0: '#4c7a3a', // grass
  1: '#2f5a2c', // forest
  2: '#2a5f8a', // water
  3: '#7d7d72', // stone
  4: '#d8c98a', // sand
};
