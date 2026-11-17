export const SHIP_BLUEPRINTS = {
  scout: {
    key: 'scout',
    name: 'Scout Frigate',
    class: 'Light Recon',
    baseStats: { attack: 40, defense: 20, speed: 12, firerate: 8, shieldDelay: 3, gunOverloadDelay: 1.5 },
    color: '#3fb950', bulletColor: '#6ee7ff', accentColor: '#1a4a58',
    img: '/img/items/SHIP_1.png',
    weapons: ['pulse', 'missile'],
    special: 'flares',
  },
  freighter: {
    key: 'freighter',
    name: 'Heavy Freighter',
    class: 'Cargo Hauler',
    baseStats: {
      attack: 20, defense: 60, speed: 6, firerate: 4,
      shieldDelay: 5, gunOverloadDelay: 3,
    },
    color: '#d29922', bulletColor: '#ffd36e', accentColor: '#4a3a10',
    img: '/img/items/SHIP_2.png',
    weapons: ['pulse', 'missile'],
    special: 'flares',
  },
  interceptor: {
    key: 'interceptor',
    name: 'Interceptor',
    class: 'Strike Fighter',
    baseStats: {
      attack: 55, defense: 15, speed: 16, firerate: 12,
      shieldDelay: 2, gunOverloadDelay: 1,
    },
    color: '#a371f7', bulletColor: '#d4a4ff', accentColor: '#2a1a4e',
    img: '/img/items/SHIP_3.png',
    weapons: ['pulse', 'missile'],
    special: 'flares',
  },
  prototype: {
    key: 'prototype',
    name: 'Prototype Vessel',
    class: 'Classified',
    baseStats: {
      attack: 70, defense: 40, speed: 14, firerate: 10,
      shieldDelay: 2.5, gunOverloadDelay: 1.2,
    },
    color: '#f85149', bulletColor: '#ff8080', accentColor: '#4a0a0a',
    img: '/img/items/SHIP_4.png',
    weapons: ['pulse', 'missile'],
    special: 'flares',
  },
  phantom: {
    key: 'phantom',
    name: 'Phantom',
    class: 'Stealth',
    baseStats: {
      attack: 60, defense: 35, speed: 14, firerate: 10,
      shieldDelay: 2.0, gunOverloadDelay: 1.2,
    },
    color: '#6ee7ff', bulletColor: '#c8f0ff', accentColor: '#0a2530',
    img: '/img/items/SHIP_5.png',
    weapons: ['pulse', 'missile'],
    special: 'flares',
  },
};

export function getShipBlueprint(key) {
  return SHIP_BLUEPRINTS[key] || null;
}