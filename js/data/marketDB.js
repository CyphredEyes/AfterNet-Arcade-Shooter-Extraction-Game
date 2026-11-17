/* ===================================================================
   Market data — trader definitions, weighted tables, jitter rules.
   =================================================================== */

export const MARKET_TABLES = {
  supply_basic: [
    { key: 'plastic',    price:  15, currency: 'credits', stock: [30, 50], weight: 10 },
    { key: 'silicon',    price:  20, currency: 'credits', stock: [15, 35], weight: 10 },
    { key: 'copper',     price:  25, currency: 'credits', stock: [10, 25], weight:  9 },
    { key: 'wire',       price:  15, currency: 'credits', stock: [20, 40], weight:  8 },
    { key: 'datacables', price:  60, currency: 'credits', stock: [ 5, 15], weight:  5 },
  ],
  tech_core: [
    { key: 'ram_t1',    price:  180, currency: 'credits', stock: [3, 6], weight: 9 },
    { key: 'cpu_t1',    price:  220, currency: 'credits', stock: [3, 6], weight: 8 },
    { key: 'gpu_t1',    price:  210, currency: 'credits', stock: [3, 5], weight: 8 },
    { key: 'net_t1',    price:  200, currency: 'credits', stock: [3, 6], weight: 8 },
    { key: 'cooler_t1', price:  160, currency: 'credits', stock: [3, 6], weight: 7 },
    { key: 'ram_t2',    price:  400, currency: 'credits', stock: [2, 4], weight: 5 },
    { key: 'cpu_t2',    price:  550, currency: 'credits', stock: [2, 4], weight: 5 },
  ],

  tech_advanced: [
    { key: 'ram_t3',     price: 1200, currency: 'credits', stock: [1, 3], weight: 6 },
    { key: 'cpu_t3',     price: 1400, currency: 'credits', stock: [1, 3], weight: 6 },
    { key: 'gpu_t2',     price: 1000, currency: 'credits', stock: [1, 3], weight: 6 },
    { key: 'net_t2',     price:  900, currency: 'credits', stock: [1, 3], weight: 6 },
    { key: 'cooler_t2',  price:  900, currency: 'credits', stock: [1, 3], weight: 5 },
    { key: 'ram_t4',     price: 3000, currency: 'itokens', stock: [1, 2], weight: 3 },
    { key: 'cpu_t4',     price: 3200, currency: 'itokens', stock: [1, 2], weight: 3 },
    { key: 'gpu_t3',     price: 3500, currency: 'itokens', stock: [1, 2], weight: 3 },
    { key: 'net_t3',     price: 3200, currency: 'itokens', stock: [1, 2], weight: 3 },
    { key: 'ram_t5',     price:  800, currency: 'gchips',  stock: [1, 1], weight: 1 },
    { key: 'cpu_t5',     price: 1000, currency: 'gchips',  stock: [1, 1], weight: 1 },
    { key: 'decoder_t3',     price:  800, currency: 'credits', stock: [1, 3], weight: 4 },
  ],
  broker_rare: [
    { key: 'quantumcore', stock: [1, 2], weight: 6,
      requires: [{ key: 'electronics', count: 5 }, { key: 'gold', count: 3 }] },
    { key: 'aicore', stock: [1, 1], weight: 3,
      requires: [{ key: 'datacables', count: 8 }, { key: 'memory2', count: 4 }, { key: 'electronics', count: 12 }] },
    { key: 'energycrystal', stock: [1, 2], weight: 5,
      requires: [{ key: 'gold', count: 6 }, { key: 'itokens', count: 20 }] },
  ],
  gambler_any: [
    { key: 'creds',   price: 320, currency: 'credits', stock: [1, 4], weight: 8 },
    { key: 'userdb',  price: 800, currency: 'credits', stock: [1, 3], weight: 5 },
    { key: 'gchips',  price: 400, currency: 'credits', stock: [3, 6], weight: 6 },
    { key: 'exploit', price:   5, currency: 'gchips',  stock: [1, 2], weight: 4 },
  ],
  // ---- Black market tables ----
  bm_common: [
    { key: 'creds',           price:   5, currency: 'gchips', stock: [2, 5], weight: 10 },
    { key: 'userdb',          price:  20, currency: 'gchips', stock: [1, 3], weight:  8 },
    { key: 'exploit',         price:   8, currency: 'gchips', stock: [1, 3], weight:  8 },
    { key: 'energycrystal',   price:  30, currency: 'gchips', stock: [1, 3], weight:  6 },
    { key: 'accesslog',       price:   3, currency: 'gchips', stock: [3, 6], weight:  7 },
    { key: 'datapad',         price:   2, currency: 'gchips', stock: [3, 8], weight:  6 },
    { key: 'alienplant',      price:  15, currency: 'gchips', stock: [1, 3], weight:  5 },
  ],
  bm_rare: [
    { key: 'satellite',       price:  60, currency: 'itokens', stock: [1, 1], weight: 4 },
    { key: 'quantumcore',     price:  40, currency: 'gchips',  stock: [1, 2], weight: 5 },
    { key: 'atomiccore',      price:  25, currency: 'itokens', stock: [1, 2], weight: 5 },
    { key: 'datadisk3',       price:  50, currency: 'gchips',  stock: [1, 1], weight: 3 },
    { key: 'sectortwentykey', price:  15, currency: 'gchips',  stock: [1, 2], weight: 4 },
    { key: 'decoder_t4',     price:  150, currency: 'gchips',  stock: [1, 2], weight: 4 },
    { key: 'decoder_t5',     price:  500, currency: 'gchips',  stock: [1, 1], weight: 2 },
  ],
  bm_exotic: [
    { key: 'servercore',    price: 3000, currency: 'gchips', stock: [1, 1], weight: 2 },
    { key: 'vr_advanced',   price:  400, currency: 'gchips', stock: [1, 1], weight: 4 },
    { key: 'console_t2',    price: 1200, currency: 'gchips', stock: [1, 1], weight: 3 },
    { key: 'datadisk3',     price:  300, currency: 'gchips', stock: [1, 1], weight: 4 },
    { key: 'datadisk2',     price:  400, currency: 'gchips', stock: [1, 1], weight: 2 },
    { key: 'datadisk5',     price: 1500, currency: 'gchips', stock: [1, 1], weight: 1 },
    { key: 'datadisk4',     price: 2000, currency: 'gchips', stock: [1, 1], weight: 1 },
    { key: 'decoder_t6',    price:  800, currency: 'gchips', stock: [1, 1], weight: 3 },
    { key: 'decoder_t7',    price: 2500, currency: 'gchips', stock: [1, 1], weight: 1 },
  ],
};

export const TRADER_DEFINITIONS = [
  { id: 'supply',   name: 'Supply Depot',    avatar: '⚙', tagline: 'Everyday goods. Stable stock.',
    mode: 'fixed',  table: 'supply_basic',   restockRaids: 3  },
  { id: 'tech',     name: 'Tech Emporium',   avatar: '⚡', tagline: 'Components for the ambitious.',
    mode: 'random', table: 'tech_core',      itemCountMin: 4, itemCountMax: 5, restockRaids: 5 },
  { id: 'tech_adv', name: 'High-Tier Tech',  avatar: '◈', tagline: 'For when the basics aren\'t enough.',
    mode: 'random', table: 'tech_advanced',  itemCountMin: 2, itemCountMax: 4, restockRaids: 8 },
  { id: 'broker',   name: 'The Broker',      avatar: '◇', tagline: 'Rare goods. Unusual payment.',
    mode: 'random', table: 'broker_rare',    itemCountMin: 1, itemCountMax: 3, restockRaids: 10 },
  { id: 'gambler',  name: "Lucky Jack's",    avatar: '🎲', tagline: 'Fresh stock every few minutes.',
    mode: 'random', table: 'gambler_any',    itemCountMin: 3, itemCountMax: 5, restockRaids: 1,
    refreshMinutes: 10 },
];

export const BLACK_MARKET_TABLES = [
  { table: 'bm_common', weight: 60, itemCountMin: 3, itemCountMax: 5 },
  { table: 'bm_rare',   weight: 30, itemCountMin: 2, itemCountMax: 3 },
  { table: 'bm_exotic', weight: 10, itemCountMin: 1, itemCountMax: 2 },
];

export const BLACK_MARKET_LIFECYCLE = {
  initialChance: 100,      // new game: black market starts active
  cooldownChance: 5,       // chance after a visit expires
  chanceGrowthPerRaid: 5,  // grows while inactive
  durationRaids: [1, 2],
};

/* Price jitter — re-rolls every cycleRaids raids.
   Rarer / more expensive items get tighter bands. */
export const PRICE_JITTER = {
  cycleRaids: 3,
  tiers: [
    { maxBase:    200, min: 0.85, max: 1.20 },   // common
    { maxBase:   2000, min: 0.95, max: 1.15 },   // mid
    { maxBase: Infinity, min: 1.00, max: 1.10 }, // rare+
  ],
};