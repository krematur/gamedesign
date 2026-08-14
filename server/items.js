// Item definitions and crafting recipes shared conceptually with the client
// (the client has its own copy of display info in public/js/data.js).

const ITEMS = {
  wood: { stackable: true, max: 99 },
  stone: { stackable: true, max: 99 },
  fiber: { stackable: true, max: 99 },
  berry: { stackable: true, max: 99, food: 8 },
  meat_raw: { stackable: true, max: 99, food: 6 },
  meat_cooked: { stackable: true, max: 99, food: 20 },
  axe: { stackable: false, tool: 'axe', damage: 8, gatherBonus: { wood: 3 } },
  pickaxe: { stackable: false, tool: 'pickaxe', damage: 6, gatherBonus: { stone: 3 } },
  spear: { stackable: false, tool: 'weapon', damage: 15 },
  campfire: { stackable: false, placeable: true },
  wall: { stackable: false, placeable: true },
};

const RECIPES = [
  { result: 'axe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 } },
  { result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 } },
  { result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { result: 'wall', count: 1, cost: { wood: 10 } },
  { result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresFire: true },
];

module.exports = { ITEMS, RECIPES };
