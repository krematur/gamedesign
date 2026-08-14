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
  wolf_hide: { icon: '🐾', label: 'Wolf Hide' },
  iron_ore: { icon: '⛰️', label: 'Iron Ore', tierable: true },
  iron_ingot: { icon: '🔩', label: 'Iron Ingot', tierable: true },
  raw_fish: { icon: '🐟', label: 'Raw Fish', edible: true, tierable: true },
  cooked_fish: { icon: '🍤', label: 'Cooked Fish', edible: true, tierable: true },

  axe: { icon: '🪓', label: 'Axe', equip: true, tierable: true },
  pickaxe: { icon: '⛏️', label: 'Pickaxe', equip: true, tierable: true },
  spear: { icon: '🔱', label: 'Spear', equip: true, tierable: true },
  fishing_rod: { icon: '🎣', label: 'Fishing Rod', equip: true },
  iron_axe: { icon: '🪓', label: 'Iron Axe', equip: true, tierable: true },
  iron_pickaxe: { icon: '⛏️', label: 'Iron Pickaxe', equip: true, tierable: true },
  iron_sword: { icon: '⚔️', label: 'Iron Sword', equip: true, tierable: true },

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
const TIERABLE_MATERIALS = new Set(['wood', 'stone', 'fiber', 'iron_ore', 'iron_ingot', 'raw_fish']);

function recipeCostForQuality(recipe, quality) {
  const out = {};
  for (const [material, amt] of Object.entries(recipe.cost)) {
    const id = quality !== 'normal' && TIERABLE_MATERIALS.has(material) ? `${material}_${quality}` : material;
    out[id] = (out[id] || 0) + amt;
  }
  return out;
}

const RECIPES = [
  { result: 'axe', count: 1, cost: { wood: 5, stone: 3 }, qualityCraftable: true },
  { result: 'pickaxe', count: 1, cost: { wood: 5, stone: 3 }, qualityCraftable: true },
  { result: 'spear', count: 1, cost: { wood: 6, stone: 2, fiber: 2 }, qualityCraftable: true },
  { result: 'fishing_rod', count: 1, cost: { wood: 6, fiber: 4 } },

  { result: 'campfire', count: 1, cost: { wood: 8, stone: 5 } },
  { result: 'furnace', count: 1, cost: { stone: 14, wood: 4 } },
  { result: 'wall', count: 1, cost: { wood: 10 } },

  { result: 'meat_cooked', count: 1, cost: { meat_raw: 1, wood: 1 }, requiresStructure: 'campfire', qualityCraftable: true },
  { result: 'cooked_fish', count: 1, cost: { raw_fish: 1, wood: 1 }, requiresStructure: 'campfire', qualityCraftable: true },

  { result: 'iron_ingot', count: 1, cost: { iron_ore: 2, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { result: 'iron_axe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { result: 'iron_pickaxe', count: 1, cost: { iron_ingot: 3, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },
  { result: 'iron_sword', count: 1, cost: { iron_ingot: 4, wood: 2 }, requiresStructure: 'furnace', requiresQuest: 'blacksmithing', qualityCraftable: true },

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
