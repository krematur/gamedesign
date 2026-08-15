// Material/output quality tiers. Gathering yields a random tier; crafting
// with higher-tier materials produces a better-than-baseline item than the
// recipe's plain (normal) output — e.g. Fine Wood + Fine Stone crafts a
// Fine Axe with higher damage than a normal recipe could ever produce.

const QUALITY_TIERS = ['crude', 'normal', 'fine'];

const QUALITY_MULT = { crude: 0.72, normal: 1, fine: 1.35 };
const QUALITY_LABEL = { crude: 'Crude', normal: '', fine: 'Fine' };

function qualifiedId(baseId, quality) {
  return quality === 'normal' ? baseId : `${baseId}_${quality}`;
}

function baseIdOf(itemId) {
  for (const q of QUALITY_TIERS) {
    if (q === 'normal') continue;
    const suffix = `_${q}`;
    if (itemId.endsWith(suffix)) return { base: itemId.slice(0, -suffix.length), quality: q };
  }
  return { base: itemId, quality: 'normal' };
}

// toolMatch: 'iron' (tier-2+ tool used correctly), 'basic' (tier-1 tool or
// hand-gathering), 'none' (wrong/no tool at all).
const TOOL_BONUS = { iron: 0.12, basic: 0.05, none: 0 };

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// The dominant factor is fieldBias (0..1): whether this gather happened
// inside an active, rich resource field (see resourceFields.js) — that's
// what should send a player scouting the map, the way a slightly-better
// tool never could on its own. Tool tier only nudges the odds a little.
function rollGatherQuality(rng, toolMatch, fieldBias = 0) {
  const toolBonus = TOOL_BONUS[toolMatch] ?? 0;
  const fineChance = clamp01(0.03 + fieldBias * 0.55 + toolBonus);
  const crudeChance = clamp01(0.6 - fieldBias * 0.45 - toolBonus * 0.6);
  const normalChance = Math.max(0, 1 - fineChance - crudeChance);
  const r = rng();
  if (r < crudeChance) return 'crude';
  if (r < crudeChance + normalChance) return 'normal';
  return 'fine';
}

module.exports = { QUALITY_TIERS, QUALITY_MULT, QUALITY_LABEL, qualifiedId, baseIdOf, rollGatherQuality };
