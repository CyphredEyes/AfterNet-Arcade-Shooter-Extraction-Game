/* ===================================================================
   LOOT DB — Rarity weights, site types, loot tables
   =================================================================== */

// ---- Tier-based rarity weight presets ----
// Higher numbers = more likely. Rarities with 0 are never rolled for that tier.
export const RARITY_WEIGHTS = {
  LOW:       { common: 200, uncommon: 30,  rare: 3,   epic: 0.2,  legendary: 0,    mythic: 0,   unique: 0 },
  MID:       { common: 80,  uncommon: 50,  rare: 15,  epic: 3,    legendary: 0.3,  mythic: 0,   unique: 0 },
  HIGH:      { common: 40,  uncommon: 60,  rare: 30,  epic: 8,    legendary: 1,    mythic: 0.1, unique: 0 },
  EXTREME:   { common: 10,  uncommon: 30,  rare: 40,  epic: 20,   legendary: 5,    mythic: 0.5, unique: 0.05 },
  LEGENDARY: { common: 0,   uncommon: 5,   rare: 20,  epic: 40,   legendary: 20,   mythic: 3,   unique: 1 },
};

// ---- Site types ----
// spawnWeight: relative weight when generating servers (not a probability).
// nodeKinds:   which NODE_KINDS can appear (defaults to all 5).
// lootTable:   pool entries. Each entry:
//   { type: 'item'|'tag'|'category', value, weight, countMin?, countMax? }
export const SITE_TYPES = {
      // ================= PACKETS (not spawnable as servers) =================
  udp: {
    key: 'udp', label: 'UDP Packet', tier: 'LOW',
    spawnWeight: 0,          // ← 0 so pickSiteType() never returns it
    hasWebpage: false,
    lootCountMin: 1, lootCountMax: 2,
    lootTable: [
      { type: 'item', value: 'datapad',    weight: 8, countMin: 1, countMax: 2 },
      { type: 'item', value: 'accesslog',  weight: 6 },
      { type: 'item', value: 'creds',      weight: 3 },
      { type: 'tag',  value: 'low_value',  weight: 5 },
      { type: 'tag',  value: 'data',       weight: 4 },
      { type: 'item', value: 'gchips',     weight: 2, countMin: 1, countMax: 2 },
      { type: 'item', value: 'itokens',    weight: 1, countMin: 1, countMax: 1 },
      { type: 'item', value: 'silicon',    weight: 2 },
      { type: 'item', value: 'copper',     weight: 2 },
    ],
  },

  // ================= LOW RISK =================
  general: {
    key: 'general', label: 'Corporate Info Site', tier: 'LOW', color: 0x8b949e,
    spawnWeight: 100, hasWebpage: true,
    lootCountMin: 1, lootCountMax: 2,
    nodeKinds: ['database', 'cpu', 'storage'],
    lootTable: [
      { type: 'item', value: 'datapad',   weight: 10, countMin: 1, countMax: 2 },
      { type: 'item', value: 'accesslog', weight: 6 },
      { type: 'tag',  value: 'low_value', weight: 4 },
      { type: 'tag',  value: 'data',      weight: 2 },
      { type: 'item', value: 'silicon',   weight: 2 },
      { type: 'item', value: 'plastic',   weight: 2 },
    ],
    extraFoldersPerPage: [0, 2],
    folderTheme: [
      { name: 'bin/',      weight: 30, filter: 'weapon' },
      { name: 'logs/',     weight: 40, filter: 'data' },
      { name: 'uploads/',  weight: 30, filter: 'default' },
      { name: 'cache.zip', weight: 20, filter: 'default' },
    ],
    rootFiles: [
      { name: 'index.db',  weight: 40, filter: 'default' },
    ],
  },
  store: {
    key: 'store', label: 'Store', tier: 'LOW', color: 0x3fb950,
    spawnWeight: 100, hasWebpage: true,
    lootCountMin: 1, lootCountMax: 2,
    nodeKinds: ['money', 'storage', 'user'],
    lootTable: [
      { type: 'item', value: 'datapad',   weight: 6 },
      { type: 'tag',  value: 'currency',  weight: 3 },
      { type: 'item', value: 'gchips',    weight: 3, countMin: 1, countMax: 3 },
      { type: 'item', value: 'itokens',   weight: 1, countMin: 1, countMax: 2 },
      { type: 'tag',  value: 'salvage',   weight: 3 },
      { type: 'item', value: 'plastic',   weight: 2, countMin: 1, countMax: 3 },
    ],
    extraFoldersPerPage: [0, 2],
    folderTheme: [
      { name: 'products/', weight: 40, filter: 'default' },
      { name: 'receipts/', weight: 40, filter: 'currency' },
      { name: 'images/',   weight: 25, filter: 'default' },
    ],
    rootFiles: [
      { name: 'orders.db', weight: 35, filter: 'currency' },
    ],
  },
  forum: {
    key: 'forum', label: 'Forum', tier: 'LOW', color: 0x58a6ff,
    spawnWeight: 100, hasWebpage: true,
    lootCountMin: 1, lootCountMax: 3,
    nodeKinds: ['database', 'cpu', 'user'],
    lootTable: [
      { type: 'item', value: 'datapad',   weight: 8 },
      { type: 'item', value: 'accesslog', weight: 5 },
      { type: 'item', value: 'creds',     weight: 2 },
      { type: 'tag',  value: 'low_value', weight: 4 },
      { type: 'tag',  value: 'data',      weight: 3 },
    ],
    extraFoldersPerPage: [0, 2],
    folderTheme: [
      { name: 'threads/',  weight: 40, filter: 'default' },
      { name: 'logs/',     weight: 35, filter: 'data' },
      { name: 'avatars/',  weight: 25, filter: 'default' },
    ],
    rootFiles: [
      { name: 'users.db',  weight: 35, filter: 'sensitive' },
    ],
  },

  // ================= MID RISK =================
  sensitive: {
    key: 'sensitive', label: 'Sensitive Data Site', tier: 'MID', color: 0x58a6ff,
    spawnWeight: 30, hasWebpage: true,
    lootCountMin: 2, lootCountMax: 3,
    nodeKinds: ['database', 'storage', 'user'],
    lootTable: [
      { type: 'item', value: 'creds',   weight: 10 },
      { type: 'item', value: 'userdb',  weight: 5 },
      { type: 'item', value: 'accesslog', weight: 4 },
      { type: 'tag',  value: 'sensitive', weight: 6 },
      { type: 'tag',  value: 'data',      weight: 3 },
      { type: 'tag',  value: 'credentials', weight: 4 },
    ],
    extraFoldersPerPage: [1, 2],
    folderTheme: [
      { name: 'userdata/', weight: 50, filter: 'sensitive' },
      { name: 'logs/',     weight: 40, filter: 'data' },
      { name: 'exports/',  weight: 35, filter: 'default' },
    ],
    rootFiles: [
      { name: 'leaked.db', weight: 30, filter: 'sensitive' },
    ],
  },
  bank: {
    key: 'bank', label: 'Bank', tier: 'MID', color: 0xd29922,
    spawnWeight: 30, hasWebpage: true,
    lootCountMin: 2, lootCountMax: 3,
    nodeKinds: ['money', 'database', 'user'],
    lootTable: [
      { type: 'item', value: 'gchips',  weight: 10, countMin: 2, countMax: 5 },
      { type: 'item', value: 'itokens', weight: 6,  countMin: 1, countMax: 3 },
      { type: 'item', value: 'gold',    weight: 4,  countMin: 2, countMax: 4 },
      { type: 'item', value: 'creds',   weight: 5 },
      { type: 'tag',  value: 'currency', weight: 3 },
    ],
    extraFoldersPerPage: [1, 3],
    folderTheme: [
      { name: 'transactions/', weight: 50, filter: 'currency' },
      { name: 'vault.zip',     weight: 25, filter: 'valuable' },
      { name: 'crypto.dat',    weight: 45, filter: 'currency' },
      { name: 'audit.log',     weight: 30, filter: 'sensitive' },
    ],
    rootFiles: [
      { name: 'ledger.db',     weight: 30, filter: 'currency' },
    ],
  },
  social: {
    key: 'social', label: 'Social Media', tier: 'MID', color: 0xa371f7,
    spawnWeight: 30, hasWebpage: true,
    lootCountMin: 2, lootCountMax: 3,
    nodeKinds: ['database', 'user', 'storage'],
    lootTable: [
      { type: 'item', value: 'userdb', weight: 6 },
      { type: 'item', value: 'creds',  weight: 5 },
      { type: 'item', value: 'accesslog', weight: 4 },
      { type: 'tag',  value: 'sensitive', weight: 3 },
      { type: 'tag',  value: 'user',     weight: 3 },
    ],
    extraFoldersPerPage: [1, 2],
    folderTheme: [
      { name: 'userdata/', weight: 50, filter: 'sensitive' },
      { name: 'messages/', weight: 35, filter: 'sensitive' },
      { name: 'posts/',    weight: 35, filter: 'default' },
      { name: 'archive.zip', weight: 20, filter: 'data' },
    ],
    rootFiles: [
      { name: 'users.db',  weight: 30, filter: 'sensitive' },
    ],
  },

  // ================= HIGH RISK =================
  blackmarket: {
    key: 'blackmarket', label: 'Black Market', tier: 'HIGH', color: '#f85149',
    spawnWeight: 8, hasWebpage: true,
    lootCountMin: 3, lootCountMax: 4,
    nodeKinds: ['money', 'storage', 'database'],
    lootTable: [
      { type: 'item', value: 'exploit',   weight: 4 },
      { type: 'item', value: 'gchips',    weight: 8, countMin: 3, countMax: 6 },
      { type: 'tag',  value: 'valuable',  weight: 3 },
      { type: 'tag',  value: 'currency',  weight: 3 },
      { type: 'tag',  value: 'dark',      weight: 3 },
    ],
    extraFoldersPerPage: [2, 3],
    folderTheme: [
      { name: 'bin/',      weight: 40, filter: 'weapon' },
      { name: 'orders/',   weight: 40, filter: 'default' },
      { name: 'wallets/',  weight: 50, filter: 'currency' },
      { name: 'drops.zip', weight: 25, filter: 'valuable' },
    ],
    rootFiles: [
      { name: 'market.db', weight: 30, filter: 'currency' },
    ],
  },
  pirate: {
    key: 'pirate', label: 'Piracy Site', tier: 'HIGH', color: 0x58a6ff,
    spawnWeight: 8, hasWebpage: true,
    lootCountMin: 3, lootCountMax: 4,
    nodeKinds: ['storage', 'cpu', 'database'],
    lootTable: [
      { type: 'item', value: 'datapad',   weight: 8 },
      { type: 'item', value: 'creds',     weight: 5 },
      { type: 'item', value: 'exploit',   weight: 2 },
      { type: 'tag',  value: 'data',      weight: 5 },
      { type: 'tag',  value: 'dark',      weight: 3 },
      { type: 'tag',  value: 'crafting',  weight: 2 },
    ],
    extraFoldersPerPage: [2, 3],
    folderTheme: [
      { name: 'downloads/', weight: 40, filter: 'default' },
      { name: 'torrents/',  weight: 40, filter: 'data' },
      { name: 'archive.zip',weight: 30, filter: 'data' },
      { name: 'bin/',       weight: 30, filter: 'weapon' },
    ],
    rootFiles: [
      { name: 'index.db',   weight: 30, filter: 'default' },
    ],
  },
  cracker: {
    key: 'cracker', label: 'Cracker Den', tier: 'HIGH', color: 0xf85149,
    spawnWeight: 8, hasWebpage: true,
    lootCountMin: 3, lootCountMax: 4,
    nodeKinds: ['cpu', 'database', 'user'],
    lootTable: [
      { type: 'item', value: 'exploit',   weight: 6 },
      { type: 'item', value: 'creds',     weight: 6 },
      { type: 'item', value: 'accesslog', weight: 4 },
      { type: 'tag',  value: 'security',  weight: 4 },
      { type: 'tag',  value: 'dark',      weight: 4 },
    ],
  },
  phishing: {
    key: 'phishing', label: 'Phishing Site', tier: 'HIGH', color: 0xd29922,
    spawnWeight: 8, hasWebpage: true,
    lootCountMin: 3, lootCountMax: 4,
    nodeKinds: ['money', 'user', 'database'],
    lootTable: [
      { type: 'item', value: 'creds',     weight: 8 },
      { type: 'item', value: 'userdb',    weight: 4 },
      { type: 'item', value: 'gchips',    weight: 5, countMin: 2, countMax: 4 },
      { type: 'tag',  value: 'credentials', weight: 5 },
      { type: 'tag',  value: 'dark',      weight: 3 },
    ],
    extraFoldersPerPage: [2, 3],
    folderTheme: [
      { name: 'captures/', weight: 50, filter: 'sensitive' },
      { name: 'victims/',  weight: 40, filter: 'sensitive' },
      { name: 'logs/',     weight: 30, filter: 'data' },
    ],
    rootFiles: [
      { name: 'creds.db',  weight: 40, filter: 'sensitive' },
    ],
  },

  // ================= EXTREME RISK =================
  cybersec: {
    key: 'cybersec', label: 'Cybersecurity Firm', tier: 'EXTREME', color: 0x6ee7ff,
    spawnWeight: 2, hasWebpage: true,
    lootCountMin: 4, lootCountMax: 5,
    nodeKinds: ['database', 'cpu', 'storage', 'user'],
    lootTable: [
      { type: 'item', value: 'exploit',   weight: 8 },
      { type: 'item', value: 'masterkey', weight: 3 },
      { type: 'item', value: 'accesslog', weight: 6 },
      { type: 'tag',  value: 'security',  weight: 6 },
      { type: 'tag',  value: 'extreme',   weight: 4 },
      { type: 'tag',  value: 'component', weight: 3 },
      { type: 'item', value: 'quantumcore', weight: 1 },
    ],
    extraFoldersPerPage: [2, 3],
    folderTheme: [
      { name: 'tools/',    weight: 45, filter: 'tech' },
      { name: 'exploits/', weight: 40, filter: 'weapon' },
      { name: 'reports/',  weight: 30, filter: 'default' },
      { name: 'audit.log', weight: 30, filter: 'data' },
    ],
    rootFiles: [
      { name: 'dump.db',   weight: 35, filter: 'valuable' },
    ],
  },
  gov: {
    key: 'gov', label: 'Government Site', tier: 'EXTREME', color: 0xffd900,
    spawnWeight: 2, hasWebpage: true,
    lootCountMin: 4, lootCountMax: 5,
    nodeKinds: ['database', 'user', 'storage', 'money'],
    lootTable: [
      { type: 'item', value: 'satellite',  weight: 3 },
      { type: 'item', value: 'masterkey',  weight: 2 },
      { type: 'item', value: 'userdb',     weight: 6 },
      { type: 'tag',  value: 'gov',        weight: 5 },
      { type: 'tag',  value: 'extreme',    weight: 4 },
      { type: 'tag',  value: 'sensitive',  weight: 3 },
      { type: 'item', value: 'itokens',    weight: 3, countMin: 3, countMax: 6 },
    ],
    extraFoldersPerPage: [2, 3],
    folderTheme: [
      { name: 'classified/', weight: 50, filter: 'valuable' },
      { name: 'userdata/',   weight: 40, filter: 'sensitive' },
      { name: 'logs/',       weight: 30, filter: 'data' },
      { name: 'archives/',   weight: 30, filter: 'default' },
    ],
    rootFiles: [
      { name: 'satellite.db', weight: 30, filter: 'valuable' },
    ],
  },
  datacenter: {
    key: 'datacenter', label: 'Data Center', tier: 'EXTREME', color: 0x8b949e,
    spawnWeight: 2, hasWebpage: false,     // hidden backend — no floating page
    lootCountMin: 4, lootCountMax: 6,
    nodeKinds: ['cpu', 'storage', 'database'],
    lootTable: [
      { type: 'tag',  value: 'component',  weight: 6 },
      { type: 'item', value: 'quantumcore', weight: 2 },
      { type: 'item', value: 'masterkey',  weight: 1 },
      { type: 'tag',  value: 'tech',       weight: 4 },
      { type: 'item', value: 'datacables', weight: 5, countMin: 1, countMax: 2 },
      { type: 'item', value: 'gold',       weight: 3, countMin: 1, countMax: 3 },
    ],
    extraFoldersPerPage: [2, 3],
    folderTheme: [
      { name: 'compressed.zip', weight: 40, filter: 'default' },
      { name: 'cache/',         weight: 40, filter: 'default' },
      { name: 'bin/',           weight: 30, filter: 'tech' },
      { name: 'logs/',          weight: 30, filter: 'data' },
    ],
    rootFiles: [
      { name: 'cluster.db',     weight: 30, filter: 'tech' },
    ],
  },

  // ================= LEGENDARY (1-in-a-million) =================
  hackergroup: {
    key: 'hackergroup', label: 'Hacker Group', tier: 'LEGENDARY', color: 0xa371f7,
    spawnWeight: 0.1, hasWebpage: false,   // truly hidden
    lootCountMin: 5, lootCountMax: 8,
    nodeKinds: ['database', 'cpu', 'user', 'storage', 'money'],
    lootTable: [
      { type: 'item', value: 'servercore',     weight: 2 },
      { type: 'item', value: 'masterkey',  weight: 4 },
      { type: 'item', value: 'exploit',    weight: 6 },
      { type: 'tag',  value: 'unique',     weight: 1 },
      { type: 'tag',  value: 'extreme',    weight: 4 },
      { type: 'tag',  value: 'valuable',   weight: 5 },
      { type: 'item', value: 'gchips',     weight: 6, countMin: 5, countMax: 10 },
    ],
    extraFoldersPerPage: [3, 4],
    folderTheme: [
      { name: 'rootkit.bin',   weight: 40, filter: 'weapon' },
      { name: 'botnet.db',     weight: 40, filter: 'valuable' },
      { name: 'drops.zip',     weight: 40, filter: 'valuable' },
      { name: 'wallets/',      weight: 40, filter: 'currency' },
      { name: 'classified/',   weight: 40, filter: 'valuable' },
    ],
    rootFiles: [
      { name: 'payload.db',    weight: 30, filter: 'weapon' },
      { name: 'identities.db', weight: 30, filter: 'sensitive' },
    ],
  },
};

// Convenience: list of site type keys, weighted by spawnWeight
export function pickSiteType(tierFilter = null) {
  let entries = Object.values(SITE_TYPES);

  if (tierFilter) {
    const filtered = entries.filter(t => t.tier === tierFilter && t.spawnWeight > 0);
    if (filtered.length > 0) entries = filtered;
  }

  let total = 0;
  for (const t of entries) total += t.spawnWeight;
  if (total <= 0) return entries[entries.length - 1];

  let r = Math.random() * total;
  for (const t of entries) {
    r -= t.spawnWeight;
    if (r <= 0) return t;
  }
  return entries[entries.length - 1];
}

export function getSiteType(key) {
  return SITE_TYPES[key] || null;
}