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

// toolMatch: 'iron' (tier-2 tool used correctly), 'basic' (tier-1 tool or
// hand-gathering), 'none' (wrong/no tool at all — rarely used since most
// nodes just require the right tool category to interact).
const GATHER_WEIGHTS = {
  iron: { crude: 0.10, normal: 0.55, fine: 0.35 },
  basic: { crude: 0.20, normal: 0.60, fine: 0.20 },
  none: { crude: 0.45, normal: 0.50, fine: 0.05 },
};

function rollGatherQuality(rng, toolMatch) {
  const weights = GATHER_WEIGHTS[toolMatch] || GATHER_WEIGHTS.none;
  const r = rng();
  if (r < weights.crude) return 'crude';
  if (r < weights.crude + weights.normal) return 'normal';
  return 'fine';
}

module.exports = { QUALITY_TIERS, QUALITY_MULT, QUALITY_LABEL, qualifiedId, baseIdOf, rollGatherQuality };
