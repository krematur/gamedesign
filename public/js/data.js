// Display metadata for base items (kept in sync with server/items.js). Quality
// variants (e.g. "wood_fine") are not listed here individually — getItemInfo()
// derives their icon/label/stat text from the base entry + quality suffix.
const ITEM_INFO_BASE = {
  wood: { icon: '🪵', label: 'Wood', tierable: true },
  stone: { icon: '🪨', label: 'Stone', tierable: true },
  fiber: { icon: '🌾', label: 'Fiber', tierable: true },
  berry: { icon: '🍓', label: 'Berry', edible: true },
  meat_raw: { icon: '🥩', label: 'Raw Meat', edible: true },
  meat_cooked: { icon: '🍖', label: 'Cooked Meat', edible: true, tierable: true },
  iron_ore: { icon: '⛰️', label: 'Iron Ore', tierable: true },
  iron_ingot: { icon: '🔩', label: 'Iron Ingot', tierable: true },
  raw_fish: { icon: '🐟', label: 'Raw Fish', edible: true, tierable: true },
  cooked_fish: { icon: '🍤', label: 'Cooked Fish', edible: true, tierable: true },
  coal: { icon: '⚫', label: 'Coal', tierable: true },
  gold_ore: { icon: '🌕', label: 'Gold Ore', tierable: true },
  gold_ingot: { icon: '🟡', label: 'Gold Ingot', tierable: true },
  steel_ingot: { icon: '🔗', label: 'Steel Ingot', tierable: true },
  clay: { icon: '🧱', label: 'Clay', tierable: true },
  brick: { icon: '🟥', label: 'Brick' },

  wolf_hide: { icon: '🐾', label: 'Wolf Hide' },
  rabbit_fur: { icon: '🐇', label: 'Rabbit Fur' },
  deer_hide: { icon: '🦌', label: 'Deer Hide' },
  boar_tusk: { icon: '🐗', label: 'Boar Tusk' },
  bear_hide: { icon: '🐻', label: 'Bear Hide' },
  bear_claw: { icon: '🐾', label: 'Bear Claw' },

  axe: { icon: '🪓', label: 'Axe', equip: true, tierable: true },
  pickaxe: { icon: '⛏️', label: 'Pickaxe', equip: true, tierable: true },
  spear: { icon: '🔱', label: 'Spear', equip: true, tierable: true },
  fishing_rod: { icon: '🎣', label: 'Fishing Rod', equip: true },
  tusk_dagger: { icon: '🗡️', label: 'Tusk Dagger', equip: true },
  claw_gauntlets: { icon: '🥊', label: 'Claw Gauntlets', equip: true },
  iron_axe: { icon: '🪓', label: 'Iron Axe', equip: true, tierable: true },
  iron_pickaxe: { icon: '⛏️', label: 'Iron Pickaxe', equip: true, tierable: true },
  iron_sword: { icon: '⚔️', label: 'Iron Sword', equip: true, tierable: true },
  steel_axe: { icon: '🪓', label: 'Steel Axe', equip: true, tierable: true },
  steel_pickaxe: { icon: '⛏️', label: 'Steel Pickaxe', equip: true, tierable: true },
  steel_sword: { icon: '⚔️', label: 'Steel Sword', equip: true, tierable: true },

  cloth_head: { icon: '🧢', label: 'Cloth Hood', armorSlot: 'head' },
  cloth_chest: { icon: '👕', label: 'Cloth Tunic', armorSlot: 'chest' },
  cloth_legs: { icon: '🩳', label: 'Cloth Pants', armorSlot: 'legs' },
  leather_head: { icon: '🎩', label: 'Leather Cap', armorSlot: 'head' },
  leather_chest: { icon: '🥼', label: 'Leather Vest', armorSlot: 'chest' },
  leather_legs: { icon: '👖', label: 'Leather Pants', armorSlot: 'legs' },
  heavy_hide_head: { icon: '🪖', label: 'Heavy Hide Cap', armorSlot: 'head' },
  heavy_hide_chest: { icon: '🦺', label: 'Heavy Hide Vest', armorSlot: 'chest' },
  heavy_hide_legs: { icon: '🥾', label: 'Heavy Hide Pants', armorSlot: 'legs' },
  iron_head: { icon: '⛑️', label: 'Iron Helm', armorSlot: 'head' },
  iron_chest: { icon: '🛡️', label: 'Iron Chestplate', armorSlot: 'chest' },
  iron_legs: { icon: '🦿', label: 'Iron Greaves', armorSlot: 'legs' },
  steel_head: { icon: '⛑️', label: 'Steel Helm', armorSlot: 'head' },
  steel_chest: { icon: '🛡️', label: 'Steel Chestplate', armorSlot: 'chest' },
  steel_legs: { icon: '🦿', label: 'Steel Greaves', armorSlot: 'legs' },

  gold_ring: { icon: '💍', label: 'Gold Ring', accessorySlot: true },

  campfire: { icon: '🔥', label: 'Campfire', placeable: true },
  furnace: { icon: '🏭', label: 'Furnace', placeable: true },
  wall: { icon: '🧱', label: 'Wall', placeable: true },
  reinforced_wall: { icon: '🧱', label: 'Reinforced Wall', placeable: true },
  torch: { icon: '🕯️', label: 'Torch', placeable: true },
};

const QUALITY_TIERS = ['crude', 'normal', 'fine'];
const QUALITY_PREFIX = { crude: 'Crude ', normal: '', fine: 'Fine ' };
const QUALITY_COLOR = { crude: '#b08968', normal: '#cccccc', fine: '#5fd1e0' };

// Resolves display info for any item id, including quality variants like
// "wood_fine" or "axe_crude" — the suffix maps back to the base entry above.
function getItemInfo(itemId) {
  if (ITEM_INFO_BASE[itemId]) return { ...ITEM_INFO_BASE[itemId], quality: 'normal', baseItem: itemId };
  for (const q of QUALITY_TIERS) {
    if (q === 'normal') continue;
    const suffix = '_' + q;
    if (itemId.endsWith(suffix)) {
      const base = itemId.slice(0, -suffix.length);
      const info = ITEM_INFO_BASE[base];
      if (info) {
        return { ...info, label: `${QUALITY_PREFIX[q]}${info.label}`, quality: q, baseItem: base };
      }
    }
  }
  return { icon: '❔', label: itemId, quality: 'normal', baseItem: itemId };
}

// Materials that can appear as recipe cost keys and are tierable (used to
// resolve the correct quality-suffixed cost id when quality-crafting).
const TIERABLE_MATERIALS = new Set([
  'wood', 'stone', 'fiber', 'iron_ore', 'iron_ingot', 'raw_fish',
  'coal', 'gold_ore', 'steel_ingot', 'clay',
]);

function recipeCostForQuality(recipe, quality) {
  const out = {};
  for (const [material, amt] of Object.entries(recipe.cost)) {
    const id = quality !== 'normal' && TIERABLE_MATERIALS.has(material) ? `${material}_${quality}` : material;
    out[id] = (out[id] || 0) + amt;
  }
  return out;
}

// Mirrors server/items.js RECIPES: every entry has a unique `id` (what gets
// crafted) and a `result` (the item produced) — multiple recipes can share
// a result to offer alternate ingredient paths (e.g. wolf vs deer leather).
const RECIPES = [
  { id: 'axe', result: 'axe', count: 1, cost: { wood: 5, stone: 3 }, qualityCraftable: true },
  { id: 'pickaxe', result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 }, qualityCraftable: true },
  { id: 'spear', result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 }, qualityCraftable: true },
  { id: 'fishing_rod', result: 'fishing_rod', count: 1, cost: { wood: 6, fiber: 4 } },
  { id: 'tusk_dagger', result: 'tusk_dagger', count: 1, cost: { boar_tusk: 2, wood: 3, fiber: 2 } },
  { id: 'claw_gauntlets', result: 'claw_gauntlets', count: 1, cost: { bear_claw: 2, fiber: 3 } },

  { id: 'campfire', result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { id: 'furnace', result: 'furnace', count: 1, cost: { stone: 14, wood: 4 } },
  { id: 'wall', result: 'wall', count: 1, cost: { wood: 10 } },
  { id: 'reinforced_wall', result: 'reinforced_wall', count: 1, cost: { brick: 8 } },
  { id: 'torch', result: 'torch', count: 1, cost: { wood: 2, fiber: 1 } },

  { id: 'brick', result: 'brick', count: 1, cost: { clay: 2, wood: 1 }, requiresStructure: 'campfire' },

  { id: 'meat_cooked', result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresStructure: 'campfire', qualityCraftable: true },
  { id: 'cooked_fish', result: 'cooked_fish', count: 1, cost: { raw_fish: 1, wood: 1 }, requiresStructure: 'campfire', qualityCraftable: true },

  { id: 'iron_ingot', result: 'iron_ingot', count: 1, cost: { iron_ore: 2, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { id: 'gold_ingot', result: 'gold_ingot', count: 1, cost: { gold_ore: 2, coal: 1 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },

  { id: 'iron_axe', result: 'iron_axe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { id: 'iron_pickaxe', result: 'iron_pickaxe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { id: 'iron_sword', result: 'iron_sword', count: 1, cost: { iron_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },

  { id: 'steel_ingot', result: 'steel_ingot', count: 1, cost: { iron_ingot: 2, coal: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },
  { id: 'steel_axe', result: 'steel_axe', count: 1, cost: { steel_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },
  { id: 'steel_pickaxe', result: 'steel_pickaxe', count: 1, cost: { steel_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },
  { id: 'steel_sword', result: 'steel_sword', count: 1, cost: { steel_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith', qualityCraftable: true },

  { id: 'cloth_head', result: 'cloth_head', count: 1, cost: { fiber: 6 } },
  { id: 'cloth_chest', result: 'cloth_chest', count: 1, cost: { fiber: 10 } },
  { id: 'cloth_legs', result: 'cloth_legs', count: 1, cost: { fiber: 8 } },

  { id: 'leather_head_wolf', result: 'leather_head', labelSuffix: ' (Wolf)', count: 1, cost: { wolf_hide: 2, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_chest_wolf', result: 'leather_chest', labelSuffix: ' (Wolf)', count: 1, cost: { wolf_hide: 4, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_legs_wolf', result: 'leather_legs', labelSuffix: ' (Wolf)', count: 1, cost: { wolf_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_head_deer', result: 'leather_head', labelSuffix: ' (Deer)', count: 1, cost: { deer_hide: 2, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_chest_deer', result: 'leather_chest', labelSuffix: ' (Deer)', count: 1, cost: { deer_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },
  { id: 'leather_legs_deer', result: 'leather_legs', labelSuffix: ' (Deer)', count: 1, cost: { deer_hide: 3, fiber: 2 }, requiresQuest: 'hunter' },

  { id: 'heavy_hide_head', result: 'heavy_hide_head', count: 1, cost: { bear_hide: 1, fiber: 3 } },
  { id: 'heavy_hide_chest', result: 'heavy_hide_chest', count: 1, cost: { bear_hide: 2, fiber: 3 } },
  { id: 'heavy_hide_legs', result: 'heavy_hide_legs', count: 1, cost: { bear_hide: 2, fiber: 2 } },

  { id: 'iron_head', result: 'iron_head', count: 1, cost: { iron_ingot: 2, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { id: 'iron_chest', result: 'iron_chest', count: 1, cost: { iron_ingot: 4, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
  { id: 'iron_legs', result: 'iron_legs', count: 1, cost: { iron_ingot: 3, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },

  { id: 'steel_head', result: 'steel_head', count: 1, cost: { steel_ingot: 2, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith' },
  { id: 'steel_chest', result: 'steel_chest', count: 1, cost: { steel_ingot: 4, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith' },
  { id: 'steel_legs', result: 'steel_legs', count: 1, cost: { steel_ingot: 3, fiber: 2 }, requiresStructure: 'furnace', requiresQuest: 'mastersmith' },

  { id: 'gold_ring', result: 'gold_ring', count: 1, cost: { gold_ingot: 2, fiber: 1 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing' },
];

const ARMOR_SLOTS = ['head', 'chest', 'legs'];
const ARMOR_SLOT_ICON = { head: '⛑️', chest: '🛡️', legs: '🦵' };
