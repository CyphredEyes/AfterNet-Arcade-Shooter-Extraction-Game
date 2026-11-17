export const WORLD_W = 12000;
export const WORLD_H = 8000;
export const GRID    = 400;

export const FREEZE_FAR_ASTEROIDS = true;

export const PLAYER = {
  radius:            13,
  accel:             700,
  reverseFactor:     0.6,
  maxSpeed:          520,
  dragPerSec:        1.2,
  maxHp:             100,
  invulnTime:        1.2,
  respawnInvuln:     2.5,
  collisionDamage:   0,          // ← packets do no damage now
  knockback:         0,
  startX:            WORLD_W * 0.5,
  startY:            WORLD_H * 0.5,
};

export const BULLET = {
  speed:              780,
  life:               2.5,
  fireRate:           0.11,
  muzzleOffset:       18,
  playerVelInfluence: 0.25,
  damage:             1,
};

export const ASTEROID = {
  sleepRadiusPadding: 900,
  bulletHitPad:       1.2,
};

export const PACKET = {
  // TCP — reliable, multi-leg bursts
  tcpPerNodeMin:   1,
  tcpPerNodeMax:   2,
  tcpLegDuration:  0.8,     // seconds per leg (fast but visible)
  tcpWaitMin:      5.0,
  tcpWaitMax:      8.0,
  tcpSizeMin:      5,
  tcpSizeMax:      9,
  tcpHpMin:        2,
  tcpHpMax:        3,

  // UDP — one-shot, sparse
  udpSpawnChance:  0.6,     // per node
  udpLegDuration:  1.2,     // slower than TCP — single trip
  udpWaitMin:      4.0,
  udpWaitMax:      7.0,
  udpSizeMin:      4,
  udpSizeMax:      8,
  udpHpMin:        1,
  udpHpMax:        2,

  // Shared
  destroyChance:   0.3,     // chance a would-be packet simply isn't spawned
  travelOffset:    0,      // how far off the core→node line packets render
  initialWaitMin:  0.5,
  initialWaitMax:  2.0,
};

// ---- Server group spawning ----
export const SERVER_GROUP = {
  count:      1,
  sizeMin:    4,          // 1 centre + 3 ring minimum
  sizeMax:    8,          // 1 centre + 7 ring maximum
};

export const SERVER = {
  interactRadius: 180,
  promptOffsetY:  -75,
  coreRadius:     52,
  bulletHitPad:   1.0,
};

export const BORDER = {
  bounciness: 0.6,
  glowWidth:  12,
  glowAlpha:  0.12,    // white glows bright — lower alpha
  lineWidth:  3,
  lineAlpha:  0.85,    // slightly dimmer than red version
  gateLength: 300,
  gateMargin: 200,
  gateWidth:  6,
}; 

/* ===================================================================
   SERVER TIERS
   =================================================================== */
export const SERVER_TIER = {
  0: {
    nodes:   { security: 1, storage: 2, research: 1, processing: 2 },
    nodeHp:  2,  coreHp: 20, lootMul: 0.5, corpCare: false,
  },
  1: {
    nodes:   { security: 2, storage: 2, research: 1, processing: 2 },
    nodeHp:  3,  coreHp: 30, lootMul: 1.0, corpCare: true,
  },
  2: {
    nodes:   { security: 2, storage: 3, research: 2, processing: 2 },
    nodeHp:  4,  coreHp: 40, lootMul: 1.0, corpCare: true,
  },
  3: {
    nodes:   { security: 3, storage: 3, research: 2, processing: 3 },
    nodeHp:  5,  coreHp: 50, lootMul: 1.5, corpCare: true,
  },
  4: {
    nodes:   { security: 4, storage: 4, research: 3, processing: 3 },
    nodeHp:  6,  coreHp: 60, lootMul: 2.5, corpCare: true,
  },
};

export const SERVER_RING_RADII = { 4: 300, 3: 500, 2: 700, 1: 900, 0: 1100 };

export const SERVER_STATE = {
  ORDER: ['PASSIVE', 'SUSPICIOUS', 'ALARMED', 'HARDENED', 'DESPERATE', 'DESTROYED'],
  ALARMED_NODE_RATIO: 0.33,
  HARDENED_NODE_RATIO: 0.50,
  DESPERATE_MAIN_RATIO: 0.30,
};

export const CORP_THREAT = {
  MAX: 5,
  DECAY_INTERVAL: 60,          // seconds of session time without damage
  SPAWN_CHECK_INTERVAL: 1,     // ship spawn check cadence
};

export const AI_SHIP_TYPES = {
  auditor: {
    hp: 3, speed: 180, accel: 250, size: 11, color: 0x6ee7ff,
    behavior: 'patrol', weapon: null,
  },
  guardian: {
    hp: 4, speed: 220, accel: 350, size: 13, color: 0xffaa33,
    behavior: 'orbit_server',
    weapon: { damage: 1, fireRate: 1.2, bulletSpeed: 380, range: 450 },
  },
  hunter: {
    hp: 5, speed: 340, accel: 480, size: 13, color: 0xff4444,
    behavior: 'chase_player',
    weapon: { damage: 1, fireRate: 0.7, bulletSpeed: 500, range: 620 },
  },
  purger: {
    hp: 40, speed: 280, accel: 400, size: 20, color: 0xff0044,
    behavior: 'hunt_player',
    weapon: { damage: 2, fireRate: 0.5, bulletSpeed: 550, range: 800 },
  },
};

// What kinds of ships each threat level keeps alive.
// `perAlarmed` scales with currently-alarmed servers, capped at `max`.
export const THREAT_SPAWN_TABLE = {
  0: [],
  1: [
    { kind: 'auditor', count: 1 },
  ],
  2: [
    { kind: 'auditor', count: 1 },
    { kind: 'guardian', perAlarmed: true, max: 2 },
  ],
  3: [
    { kind: 'auditor', count: 1 },
    { kind: 'guardian', perAlarmed: true, max: 3 },
    { kind: 'hunter', count: 1 },
  ],
  4: [
    { kind: 'auditor', count: 1 },
    { kind: 'guardian', perAlarmed: true, max: 4 },
    { kind: 'hunter', count: 3 },
  ],
  5: [
    { kind: 'auditor', count: 1 },
    { kind: 'guardian', perAlarmed: true, max: 4 },
    { kind: 'hunter', count: 3 },
    { kind: 'purger', count: 1 },
  ],
};

/* ===================================================================
   NODE / CORE LAYOUT
   =================================================================== */
export const NODE_LAYOUT = {
  orbitRadiusMin:  260,
  orbitRadiusMax:  440,
  radius:          22,
  radiusJitter:    4,
  minNodePadding:  28,
  wobbleAmp:       3,
  wobbleSpeed:     0.6,
};

export const NODE_CATEGORIES = {
  security: {
    weight: 3.0, color: 0xf85149, icon: 'SEC', name: 'Security',
    iconImg: '/img/items/security_icon.png',
  },
  research: {
    weight: 1.5, color: 0x6ee7ff, icon: 'RES', name: 'Research',
    iconImg: '/img/items/hacker_icon.png',
  },
  processing: {
    weight: 1.5, color: 0xd29922, icon: 'PRC', name: 'Processing',
    iconImg: '/img/items/bank_icon.png',
  },
  storage: {
    weight: 1.0, color: 0x8b949e, icon: 'STR', name: 'Storage',
    iconImg: '/img/items/database_icon.png',
  },
};

export const NODE_CATEGORY_KEYS = ['security', 'storage', 'research', 'processing'];

/* ===================================================================
   MASTER KEY
   =================================================================== */
export const MASTER_KEY_CHANCE = 0.5;

/* ===================================================================
   EXPLOIT INJECTION
   =================================================================== */
export const EXPLOIT_INJECTION = {
  range:       150,
  hpThreshold: 0.25,
  dotDuration: 1.2,
};

/* ===================================================================
   SPOILS UI
   =================================================================== */
export const SPOILS_GRID = {
  cols:     3,
  baseRows: 4,
};

/* ===================================================================
   PACKET CONTAMINATION & EXPLOITS
   =================================================================== */
export const PACKET_TIERS = {
  0: { contamination: 1, lightDamage: 1, encrypted: false },  // LOW
  1: { contamination: 2, lightDamage: 1, encrypted: false },  // MID
  2: { contamination: 2, lightDamage: 1, encrypted: false },  // unused
  3: { contamination: 3, lightDamage: 2, encrypted: true  },  // HIGH
  4: { contamination: 3, lightDamage: 2, encrypted: true  },  // EXTREME
};

export const PACKET_KILL_MULTIPLIER = 3;
export const PACKET_DYING_DURATION  = 0.6;

export const EXPLOIT_TIERS = [
  { tier: 1, name: 'Echo',    cost: 1, packetsPerGroup: 2, intervalBetweenGroups: 4.0, intervalBetweenPackets: 0.30, damagePerPacket: 1, duration: 20 },
  { tier: 2, name: 'Surge',   cost: 2, packetsPerGroup: 3, intervalBetweenGroups: 3.0, intervalBetweenPackets: 0.25, damagePerPacket: 2, duration: 25 },
  { tier: 3, name: 'Cascade', cost: 3, packetsPerGroup: 4, intervalBetweenGroups: 2.5, intervalBetweenPackets: 0.20, damagePerPacket: 3, duration: 30 },
];

export const SECTOR_ENCRYPTION_CHANCE = {
  0: 0.00,   // LOW
  1: 0.25,   // MID
  2: 0.25,   // unused
  3: 0.70,   // HIGH
  4: 1.00,   // EXTREME
};

export const FLARES = {
  count: 8,
  speed: 260,
  velocityInheritance: 0.4,
  lifetime: 5,
  damage: 2,
  damageRadius: 32,
  repulseForce: 320,
  cooldown: 8,
};

export const MISSILE_AI = {
  targetLeadTime: 0.3,
};

export const AI_SQUAD = {
  rotateIntervalMin: 3.0,
  rotateIntervalMax: 5.0,
};