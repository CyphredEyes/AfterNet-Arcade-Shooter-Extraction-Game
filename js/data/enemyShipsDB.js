export const ENEMY_TYPES = {
  raider: {
    key: 'raider', name: 'Raider',
    hp: 4, speed: 240, accel: 500, size: 12, shape: 'arrow', color: 0xff5533,
    behavior: 'chase', evade: 0,
    weapon: { damage: 1, fireRate: 1.3, bulletSpeed: 400, range: 500 },
    tierMin: 0, threatCost: 1,
  },
  wasp: {
    key: 'wasp', name: 'Wasp',
    hp: 3, speed: 380, accel: 700, size: 10, shape: 'arrow', color: 0xffcc22,
    behavior: 'strafe', evade: 0.3,
    weapon: { damage: 1, fireRate: 0.6, bulletSpeed: 500, range: 420 },
    tierMin: 1, threatCost: 1,
  },
  juggernaut: {
    key: 'juggernaut', name: 'Juggernaut',
    hp: 18, speed: 160, accel: 300, size: 20, shape: 'hex', color: 0x9933ff,
    behavior: 'chase', evade: 0,
    weapon: { damage: 2, fireRate: 0.9, bulletSpeed: 350, range: 620 },
    tierMin: 2, threatCost: 2,
  },
  flarer: {
    key: 'flarer', name: 'Flare-Carrier',
    hp: 6, speed: 300, accel: 550, size: 14, shape: 'arrow', color: 0x33ccff,
    behavior: 'orbit', evade: 0.5,
    weapon: { damage: 1, fireRate: 1.6, bulletSpeed: 400, range: 480 },
    flareCooldown: 6,
    tierMin: 2, threatCost: 2,
  },
  carrier: {
    key: 'carrier', name: 'Missile Carrier',
    hp: 9, speed: 180, accel: 400, size: 16, shape: 'hex', color: 0xff66cc,
    behavior: 'kite', evade: 0,
    weapon: { damage: 3, fireRate: 2.4, bulletSpeed: 300, range: 900, isMissile: true },
    tierMin: 2, threatCost: 2,
  },
  ace: {
    key: 'ace', name: 'Ace',
    hp: 14, speed: 420, accel: 900, size: 13, shape: 'diamond', color: 0xff006e,
    behavior: 'ace', evade: 0.8,
    weapon: { damage: 2, fireRate: 0.75, bulletSpeed: 550, range: 700 },
    tierMin: 3, threatCost: 3,
  },
};

export const SECTOR_SPAWN_POOLS = {
  0: ['raider'],
  1: ['raider', 'wasp'],
  2: ['raider', 'wasp', 'juggernaut', 'flarer', 'carrier'],
  3: ['wasp', 'juggernaut', 'flarer', 'carrier', 'ace'],
};

export const SECTOR_SQUAD_SIZE = {
  0: [1, 1],
  1: [2, 3],
  2: [2, 4],
  3: [3, 5],
};

export const SECTOR_COORDINATION = {
  0: 0.0,
  1: 0.3,
  2: 0.7,
  3: 1.0,
};