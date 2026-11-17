/* ===================================================================
   LOOT SYSTEM — Weighted rolls + per-server base children + key helper.
   =================================================================== */

import { BLUEPRINTS, makeItem } from '../data/itemDB.js';
import { RARITY_WEIGHTS } from '../data/lootDB.js';

/* ---------------- candidate pool ---------------- */

export function buildCandidatePool(siteType) {
  const pool = new Map();

  for (const entry of siteType.lootTable || []) {
    const matched = [];

    if (entry.type === 'item') {
      const bp = BLUEPRINTS[entry.value];
      if (bp) matched.push(bp);
    } else if (entry.type === 'tag') {
      for (const key in BLUEPRINTS) {
        const bp = BLUEPRINTS[key];
        if (bp.tags && bp.tags.includes(entry.value)) matched.push(bp);
      }
    } else if (entry.type === 'category') {
      for (const key in BLUEPRINTS) {
        const bp = BLUEPRINTS[key];
        if (bp.category === entry.value) matched.push(bp);
      }
    }

    for (const bp of matched) {
      const existing = pool.get(bp.key);
      if (existing) {
        existing.weight   = Math.max(existing.weight, entry.weight);
        existing.countMin = Math.max(existing.countMin, entry.countMin || 1);
        existing.countMax = Math.max(existing.countMax, entry.countMax || existing.countMax);
      } else {
        pool.set(bp.key, {
          key: bp.key,
          rarity: bp.rarity || 'common',
          weight: entry.weight,
          countMin: entry.countMin || 1,
          countMax: entry.countMax || (bp.stackMax > 1 ? 5 : 1),
        });
      }
    }
  }

  return [...pool.values()];
}

/* ---------------- filter matcher ---------------- */

export function matchesFilter(candidate, filter) {
  if (!filter || filter === 'default') return true;
  const tags = BLUEPRINTS[candidate.key]?.tags || [];
  switch (filter) {
    case 'weapon':    return tags.includes('weapon') || tags.includes('dark');
    case 'currency':  return tags.includes('currency');
    case 'sensitive': return tags.includes('sensitive') || tags.includes('user') || tags.includes('credentials');
    case 'tech':      return tags.includes('component') || tags.includes('tech');
    case 'valuable':  return tags.includes('valuable') || tags.includes('extreme');
    case 'data':      return tags.includes('data');
    default:          return true;
  }
}

/* ---------------- bag generation ---------------- */

export function generateThemedBag(siteType, filter, minItems, maxItems) {
  const bag = { cols: 4, rows: 3, items: [] };

  const fullPool = buildCandidatePool(siteType);
  let pool = fullPool;
  if (filter && filter !== 'default') {
    pool = fullPool.filter(c => matchesFilter(c, filter));
    if (pool.length === 0) pool = fullPool;
  }
  if (pool.length === 0) return bag;

  const byRarity = new Map();
  for (const c of pool) {
    if (!byRarity.has(c.rarity)) byRarity.set(c.rarity, []);
    byRarity.get(c.rarity).push(c);
  }

  const rawWeights = RARITY_WEIGHTS[siteType.tier] || RARITY_WEIGHTS.MID;
  const effective = {};
  let totalW = 0;
  for (const [rarity, list] of byRarity) {
    const w = rawWeights[rarity] || 0;
    if (w > 0 && list.length > 0) { effective[rarity] = w; totalW += w; }
  }
  if (totalW === 0) return bag;

  const count = minItems + Math.floor(Math.random() * (maxItems - minItems + 1));

  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalW;
    let chosenRarity = null;
    for (const rarity in effective) {
      r -= effective[rarity];
      if (r <= 0) { chosenRarity = rarity; break; }
    }
    if (!chosenRarity) chosenRarity = Object.keys(effective)[0];

    const candidates = byRarity.get(chosenRarity);
    const totalCW = candidates.reduce((s, c) => s + c.weight, 0);
    let rr = Math.random() * totalCW;
    let picked = null;
    for (const c of candidates) {
      rr -= c.weight;
      if (rr <= 0) { picked = c; break; }
    }
    if (!picked) picked = candidates[0];

    const bp = BLUEPRINTS[picked.key];
    let qty = 1;
    if (bp && bp.stackMax > 1) {
      const lo = picked.countMin || 1;
      const hi = Math.min(picked.countMax || bp.stackMax, bp.stackMax);
      qty = lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    const item = makeItem(picked.key);
    item.count = qty;
    if (!packInto(bag, item)) break;
  }

  return bag;
}

export function packInto(bag, item) {
  for (const rotated of [false, true]) {
    const w = rotated ? item.h : item.w;
    const h = rotated ? item.w : item.h;
    if (w > bag.cols || h > bag.rows) continue;
    for (let r = 0; r <= bag.rows - h; r++) {
      for (let c = 0; c <= bag.cols - w; c++) {
        if (areaFree(bag, c, r, w, h)) {
          item.col = c;
          item.row = r;
          item.rotated = rotated;
          bag.items.push(item);
          return true;
        }
      }
    }
  }
  return false;
}

function areaFree(bag, c, r, w, h) {
  for (const o of bag.items) {
    const ow = o.rotated ? o.h : o.w;
    const oh = o.rotated ? o.w : o.h;
    if (c < o.col + ow && c + w > o.col && r < o.row + oh && r + h > o.row) return false;
  }
  return true;
}

/* ---------------- base children builder ---------------- */

export function buildBaseChildren(server) {
  const type = server.type;
  const children = [];

  children.push({
    type: 'folder',
    name: 'main_page/',
    children: buildPageContents(type, 'main'),
  });

  let subIdx = 0;
  for (const node of server.nodes) {
    if (!node.leafPage) continue;
    subIdx++;
    children.push({
      type: 'folder',
      name: `subpage_${subIdx}_${node.kind}/`,
      children: buildPageContents(type, 'leaf'),
    });
  }

  for (const def of type.rootFiles || []) {
    const chance = (def.weight || 20) / 100;
    if (Math.random() >= chance) continue;

    const probe = buildCandidatePool(type).filter(c => matchesFilter(c, def.filter));
    if (probe.length === 0 && def.filter && def.filter !== 'default') continue;

    children.push({
      type: 'grid',
      name: def.name,
      bag: generateThemedBag(type, def.filter, def.sizeMin || 1, def.sizeMax || 2),
    });
  }

  return children;
}

function buildPageContents(type, pageKind) {
  const children = [];

  const dfMin = pageKind === 'main'
    ? Math.max(2, Math.floor(type.lootCountMin / 2) + 1)
    : Math.max(1, Math.floor(type.lootCountMin / 2));
  const dfMax = pageKind === 'main'
    ? type.lootCountMax
    : Math.max(1, Math.floor(type.lootCountMax / 2));

  children.push({
    type: 'grid',
    name: 'data_files',
    bag: generateThemedBag(type, 'default', dfMin, dfMax),
  });

  const theme = type.folderTheme || [];
  if (theme.length === 0) return children;

  const [minE, maxE] = type.extraFoldersPerPage || [0, 1];
  const wantedCount = minE + Math.floor(Math.random() * (maxE - minE + 1));

  const remaining = [...theme];
  const added = [];

  for (let i = 0; i < wantedCount && remaining.length > 0; i++) {
    const totalW = remaining.reduce((s, x) => s + x.weight, 0);
    if (totalW <= 0) break;

    let r = Math.random() * totalW;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j].weight;
      if (r <= 0) { idx = j; break; }
    }
    const def = remaining[idx];
    remaining.splice(idx, 1);

    const probe = buildCandidatePool(type).filter(c => matchesFilter(c, def.filter));
    if (probe.length === 0 && def.filter !== 'default') continue;
    if (added.some(a => a.name === def.name)) continue;
    added.push(def);

    children.push({
      type: 'grid',
      name: def.name,
      bag: generateThemedBag(type, def.filter, def.sizeMin || 1, def.sizeMax || 2),
    });
  }

  return children;
}

/* Packet loot bag — unchanged, used by entities.js. */
export function generateLootBag(siteType, size = 'main') {
  const lo = size === 'leaf'
    ? Math.max(1, Math.floor(siteType.lootCountMin / 2))
    : siteType.lootCountMin;
  const hi = size === 'leaf'
    ? Math.max(lo, Math.floor(siteType.lootCountMax / 2))
    : siteType.lootCountMax;
  return generateThemedBag(siteType, 'default', lo, hi);
}

/* ===================================================================
   SPOILS LOOT GENERATORS — category-specific
   =================================================================== */

import { SPOILS_GRID } from '../modules/config.js';

const CATEGORY_TAGS = {
  security:   ['weapon', 'dark', 'security', 'extreme'],
  storage:    ['metal', 'plastic', 'crafting', 'salvage', 'container'],
  research:   ['data', 'tech', 'component', 'vr_headset', 'sensitive'],
  processing: ['currency', 'trade', 'valuable'],
};

function pickRarity(weights, byRarity) {
  const entries = [];
  let total = 0;
  for (const [r, list] of byRarity) {
    const w = weights[r] || 0;
    if (w > 0 && list.length > 0) { entries.push([r, w]); total += w; }
  }
  if (total === 0) return null;
  let r = Math.random() * total;
  for (const [rar, w] of entries) {
    r -= w;
    if (r <= 0) return rar;
  }
  return entries[entries.length - 1][0];
}

/* Returns an array of item instances (unpacked) for a single node kill. */
export function generateNodeLootItems(category, tier, opts = {}) {
  const { lootMul = 1 } = opts;
  const tags = CATEGORY_TAGS[category] || [];

  const byRarity = new Map();
  for (const key in BLUEPRINTS) {
    const bp = BLUEPRINTS[key];
    if (!bp.tags || !bp.tags.some(t => tags.includes(t))) continue;
    const r = bp.rarity || 'common';
    if (!byRarity.has(r)) byRarity.set(r, []);
    byRarity.get(r).push(bp);
  }

  const weights = RARITY_WEIGHTS[tier] || RARITY_WEIGHTS.MID;
  const count = Math.max(1, Math.round(lootMul) + Math.floor(Math.random() * 2));

  const items = [];
  for (let i = 0; i < count; i++) {
    const r = pickRarity(weights, byRarity);
    if (!r) continue;
    const pool = byRarity.get(r);
    const bp   = pool[Math.floor(Math.random() * pool.length)];
    const item = makeItem(bp.key);
    item.count = 1;
    items.push(item);
  }

  if (Math.random() < 0.03) {
    const containerKeys = ['sectortwentysafe', 'secure_container_epic'];
    const key = containerKeys[Math.floor(Math.random() * containerKeys.length)];
    const container = makeItem(key, { foundInWorld: true });
    const rarity = key === 'sectortwentysafe' ? 'rare' : 'epic';
    const lootItems = generateContainerLoot(rarity);
    const bag = {
      cols: container.internalCols,
      rows: container.internalRows,
      items: container.internalItems,
    };
    for (const lootItem of lootItems) {
      packInto(bag, lootItem);
    }
    items.push(container);
  }
  
  if (category === 'security' && Math.random() < 0.20) {
    const decoder = rollDecoder();
    if (decoder) items.push(decoder);
  }

  return items;
}

/* Core loot — legendary+ only. */
export function generateCoreLootItems(tier) {
  const items = [];

  /* ---- 1. Regular legendary+ loot (excluding CDs) ---- */
  const CD_KEYS = ['datadisk1', 'datadisk2', 'datadisk3', 'datadisk4', 'datadisk5'];
  const weights = { legendary: 50, mythic: 15, unique: 3 };
  const candidates = [];
  for (const key in BLUEPRINTS) {
    if (CD_KEYS.includes(key)) continue;
    const bp = BLUEPRINTS[key];
    if (bp.rarity === 'legendary' || bp.rarity === 'mythic' || bp.rarity === 'unique') {
      candidates.push({ bp, rarity: bp.rarity });
    }
  }

  if (candidates.length > 0) {
    const totalW = candidates.reduce((s, c) => s + (weights[c.rarity] || 0), 0);
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      let r = Math.random() * totalW;
      let picked = candidates[0];
      for (const c of candidates) {
        r -= weights[c.rarity] || 0;
        if (r <= 0) { picked = c; break; }
      }
      const item = makeItem(picked.bp.key);
      item.count = 1;
      items.push(item);
    }
  }

  /* ---- 2. CD drop — 15% chance, weighted by ship rarity ---- */
  if (Math.random() < 0.15) {
    const cd = rollCDDrop();
    if (cd) items.push(cd);
  }

  /* ---- 3. Container drop — 20% chance, weighted by container rarity ---- */
  if (Math.random() < 0.20) {
    const container = rollContainerDrop();
    if (container) items.push(container);
  }

  if (Math.random() < 0.40) {
    const decoder = rollDecoder();
    if (decoder) items.push(decoder);
  }

  return items;
}

/* -------------------------------------------------------------------
   CD drop — weighted by ship rarity
   ------------------------------------------------------------------- */
function rollCDDrop() {
  const table = [
    { key: 'datadisk1', weight: 45 },  // scout — Common
    { key: 'datadisk3', weight: 30 },  // interceptor — Rare
    { key: 'datadisk2', weight: 15 },  // freighter — Legendary
    { key: 'datadisk5', weight:  8 },  // phantom — Mythic
    { key: 'datadisk4', weight:  2 },  // prototype — Unique
  ];
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) {
      const item = makeItem(e.key);
      item.count = 1;
      return item;
    }
  }
  return null;
}

/* -------------------------------------------------------------------
   Container drop — weighted by container rarity, pre-populated loot
   ------------------------------------------------------------------- */
function rollContainerDrop() {
  const table = [
    { rarity: 'rare',      key: 'sectortwentysafe',          weight: 70  },
    { rarity: 'epic',      key: 'secure_container_epic',     weight: 20  },
    { rarity: 'legendary', key: 'secure_container_legendary',weight: 7   },
    { rarity: 'mythic',    key: 'secure_container_mythic',   weight: 2.5 },
    { rarity: 'unique',    key: 'secure_container_unique',   weight: 0.5 },
  ];
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) {
      const container = makeItem(e.key, { foundInWorld: true });
      const lootItems = generateContainerLoot(e.rarity);
      const bag = {
        cols: container.internalCols,
        rows: container.internalRows,
        items: container.internalItems,
      };
      for (const lootItem of lootItems) {
        packInto(bag, lootItem);
      }
      return container;
    }
  }
  return null;
}

/* -------------------------------------------------------------------
   Container loot generation — weights per container rarity
   ------------------------------------------------------------------- */
function generateContainerLoot(containerRarity) {
  const tables = {
    rare: {
      countMin: 2, countMax: 3,
      weights: { rare: 70, epic: 25, legendary: 5 },
    },
    epic: {
      countMin: 3, countMax: 4,
      weights: { rare: 40, epic: 45, legendary: 13, mythic: 2 },
    },
    legendary: {
      countMin: 3, countMax: 5,
      weights: { epic: 70, legendary: 25, mythic: 5 },
    },
    mythic: {
      countMin: 4, countMax: 6,
      weights: { legendary: 40, mythic: 50, unique: 10 },
    },
    unique: {
      countMin: 5, countMax: 7,
      weights: { legendary: 25, mythic: 58, unique: 17 },
    },
  };

  const table = tables[containerRarity];
  if (!table) return [];

  // Pool of items by rarity (exclude containers, exclude CDs, exclude currency/keys)
  const byRarity = {};
  const EXCLUDE_KEYS = [
    'datadisk1', 'datadisk2', 'datadisk3', 'datadisk4', 'datadisk5',
    'sectortwentysafe', 'secure_container_epic', 'secure_container_legendary',
    'secure_container_mythic', 'secure_container_unique',
  ];
  for (const key in BLUEPRINTS) {
    if (EXCLUDE_KEYS.includes(key)) continue;
    const bp = BLUEPRINTS[key];
    if (bp.category === 'containers') continue;
    if (bp.tags?.includes('currency')) continue;
    const r = bp.rarity || 'common';
    if (!byRarity[r]) byRarity[r] = [];
    byRarity[r].push(bp);
  }

  const items = [];
  const count = table.countMin +
    Math.floor(Math.random() * (table.countMax - table.countMin + 1));

  for (let i = 0; i < count; i++) {
    const totalW = Object.entries(table.weights)
      .filter(([r]) => byRarity[r] && byRarity[r].length > 0)
      .reduce((s, [, w]) => s + w, 0);
    if (totalW === 0) break;

    let r = Math.random() * totalW;
    let chosen = null;
    for (const [rarity, w] of Object.entries(table.weights)) {
      const pool = byRarity[rarity];
      if (!pool || pool.length === 0) continue;
      r -= w;
      if (r <= 0) { chosen = rarity; break; }
    }
    if (!chosen) chosen = Object.keys(byRarity).find(r => byRarity[r].length > 0);
    if (!chosen) break;

    const pool = byRarity[chosen];
    const bp = pool[Math.floor(Math.random() * pool.length)];
    const item = makeItem(bp.key);
    item.count = 1;
    items.push(item);
  }

  return items;
}

function rollDecoder() {
  const table = [
    { key: 'decoder_t3', weight: 55 },
    { key: 'decoder_t4', weight: 28 },
    { key: 'decoder_t5', weight: 12 },
    { key: 'decoder_t6', weight: 4 },
    { key: 'decoder_t7', weight: 1 },
  ];
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) {
      const item = makeItem(e.key);
      item.count = 1;
      return item;
    }
  }
  return null;
}