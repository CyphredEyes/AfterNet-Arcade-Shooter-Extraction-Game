/* ===================================================================
   Rarity Database
   Every item has a rarity tier that provides default colors/effects.
   Any item can override parts of its tier via per-item properties.
   =================================================================== */

export const RARITIES = {
  basic: {
    name: 'Basic',
    borderColor: '#4a4a4a',
    bgGradient: 'linear-gradient(135deg, #1c2128, #13151a)',
    glow: null,
  },
  common: {
    name: 'Common',
    borderColor: '#8b949e',
    bgGradient: 'linear-gradient(135deg, #1c2128, #13151a)',
    glow: null,
  },
  uncommon: {
    name: 'Uncommon',
    borderColor: '#3fb950',
    bgGradient: 'linear-gradient(135deg, #1a2e1c, #13151a)',
    glow: '0 0 6px rgba(63, 185, 80, 0.3)',
  },
  rare: {
    name: 'Rare',
    borderColor: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #1a1e2e, #13151a)',
    glow: '0 0 8px rgba(59, 130, 246, 0.4)',
  },
  epic: {
    name: 'Epic',
    borderColor: '#a371f7',
    bgGradient: 'linear-gradient(135deg, #2a1a2e, #13151a)',
    glow: '0 0 10px rgba(163, 113, 247, 0.4)',
  },
  legendary: {
    name: 'Legendary',
    borderColor: '#d29922',
    bgGradient: 'linear-gradient(135deg, #2e2a1a, #13151a)',
    glow: '0 0 12px rgba(210, 153, 34, 0.5)',
  },
  mythic: {
    name: 'Mythic',
    borderColor: '#f85149',
    // Red + molten orange gradient
    bgGradient: 'linear-gradient(135deg, #4a0a0a 0%, #2e0808 40%, #5a1a00 70%, #13151a 100%)',
    glow: '0 0 14px rgba(248, 81, 73, 0.55)',
  },
    unique: {
    name: 'Unique',
    borderColor: '#ffd900',
    bgGradient: 'linear-gradient(135deg, #3a2e1a, #13151a)',
    glow: '0 0 16px rgba(255, 217, 0, 0.6)',
  },
};

/**
 * Get the full visual config for an item, respecting per-item overrides.
 * Priority: item.rarityOverride > item's own explicit fields > rarity defaults
 */
export function getRarityConfig(item) {
  const tier = RARITIES[item.rarity] || RARITIES.common;
  return {
    borderColor: item.borderColor || tier.borderColor,
    bgGradient:  item.bgGradient  || tier.bgGradient,
    glow:        item.glow        || tier.glow,
    rarityName:  tier.name,
  };
}