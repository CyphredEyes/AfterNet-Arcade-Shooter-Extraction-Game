import {
  MARKET_TABLES, TRADER_DEFINITIONS, BLACK_MARKET_TABLES,
  BLACK_MARKET_LIFECYCLE, PRICE_JITTER,
} from '../data/marketDB.js';
import { BLUEPRINTS } from '../data/itemDB.js';

/* ---- helpers ---- */
function weightedSample(pool, count) {
  const remaining = [...pool];
  const picked = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * total;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      r -= (remaining[i].weight || 1);
      if (r <= 0) { idx = i; break; }
    }
    picked.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return picked;
}

function rollStock(entry) {
  const lo = entry.stock?.[0] ?? 1;
  const hi = entry.stock?.[1] ?? lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function estimateValue(bp) {
  const v = bp?.value || {};
  return (v.credits || 0) + (v.itokens || 0) * 100 + (v.gchips || 0) * 1000;
}

export function rollPriceJitter(itemKey) {
  const bp = BLUEPRINTS[itemKey];
  const value = estimateValue(bp) || 10;
  const tier = PRICE_JITTER.tiers.find(t => value <= t.maxBase);
  return tier.min + Math.random() * (tier.max - tier.min);
}

export function rollAllPrices() {
  const prices = {};
  for (const key of Object.keys(BLUEPRINTS)) {
    prices[key] = rollPriceJitter(key);
  }
  return prices;
}

/* ---- trader stock ---- */
export function generateTraderStock(def) {
  const table = MARKET_TABLES[def.table];
  if (!table) return [];

  let entries;
  if (def.mode === 'fixed') {
    entries = table;
  } else {
    const min = def.itemCountMin ?? 1;
    const max = def.itemCountMax ?? min;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    entries = weightedSample(table, Math.min(n, table.length));
  }

  return entries.map(e => ({
    key: e.key,
    price: e.price,
    currency: e.currency,
    requires: e.requires,
    stock: rollStock(e),
  }));
}

export function generateBlackMarketStock() {
  const totalW = BLACK_MARKET_TABLES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalW;
  let chosen = BLACK_MARKET_TABLES[0];
  for (const t of BLACK_MARKET_TABLES) {
    r -= t.weight;
    if (r <= 0) { chosen = t; break; }
  }
  const table = MARKET_TABLES[chosen.table];
  const n = chosen.itemCountMin +
    Math.floor(Math.random() * (chosen.itemCountMax - chosen.itemCountMin + 1));
  const entries = weightedSample(table, Math.min(n, table.length));

  // ── Black market invariant: currency-only ──
  // Any entry with `requires` (a trade item) is filtered out — the black
  // market does not barter. Log once so the developer notices a bad table.
  const currencyOnly = entries.filter(e => {
    if (e.requires || e.price === undefined || !e.currency) {
      console.warn(
        `[market] Black market table "${chosen.table}" contains a non-currency entry (${e.key}); skipping.`,
      );
      return false;
    }
    return true;
  });

  return currencyOnly.map(e => ({
    key: e.key,
    price: e.price,
    currency: e.currency,
    stock: rollStock(e),
    // No `requires` — always undefined on black market items.
  }));
}

/* ---- initial state ---- */
export function createInitialMarketState() {
  const traders = {};
  for (const def of TRADER_DEFINITIONS) {
    const slot = {
      items: generateTraderStock(def),
      restockIn: def.restockRaids,
    };
    if (def.refreshMinutes) {
      slot.refreshAt = Date.now() + def.refreshMinutes * 60_000;
    }
    traders[def.id] = slot;
  }
  return {
    traders,
    blackMarket: {
      active: true,
      items: generateBlackMarketStock(),
      raidsLeft: 2,
      chance: BLACK_MARKET_LIFECYCLE.initialChance,
    },
    prices: rollAllPrices(),
    raidsSinceJitter: 0,
  };
}

/* ---- per-raid advance ---- */
export function advanceMarketAfterRaid(marketState) {
  // Trader raid counters
  for (const def of TRADER_DEFINITIONS) {
    const slot = marketState.traders[def.id];
    if (!slot) continue;
    slot.restockIn -= 1;
    if (slot.restockIn <= 0) {
      slot.items = generateTraderStock(def);
      slot.restockIn = def.restockRaids;
      if (def.refreshMinutes) {
        slot.refreshAt = Date.now() + def.refreshMinutes * 60_000;
      }
    }
  }

  // Black market lifecycle
  const bm = marketState.blackMarket;
  if (bm.active) {
    bm.raidsLeft -= 1;
    if (bm.raidsLeft <= 0) {
      bm.active = false;
      bm.items = [];
      bm.chance = BLACK_MARKET_LIFECYCLE.cooldownChance;   // ← proper reset
    }
  } else {
    bm.chance = Math.min(100, bm.chance + BLACK_MARKET_LIFECYCLE.chanceGrowthPerRaid);
    if (Math.random() * 100 < bm.chance) {
      const [lo, hi] = BLACK_MARKET_LIFECYCLE.durationRaids;
      bm.active = true;
      bm.items = generateBlackMarketStock();
      bm.raidsLeft = lo + Math.floor(Math.random() * (hi - lo + 1));
      // Do NOT reset chance here — resets only when the visit expires
    }
  }

  // Price jitter cycle
  marketState.raidsSinceJitter += 1;
  if (marketState.raidsSinceJitter >= PRICE_JITTER.cycleRaids) {
    marketState.raidsSinceJitter = 0;
    marketState.prices = rollAllPrices();
  }
  window.dispatchEvent(new CustomEvent('market:changed'));
  return marketState;
}

/* ---- wall-clock gambler refresh ---- */
export function checkGamblerTimer(marketState, now = Date.now()) {
  const g = marketState.traders.gambler;
  if (!g || !g.refreshAt) return false;
  if (now < g.refreshAt) return false;
  const def = TRADER_DEFINITIONS.find(d => d.id === 'gambler');
  g.items = generateTraderStock(def);
  g.refreshAt = now + def.refreshMinutes * 60_000;
  return true;
}

/* ---- price lookups ---- */
export function getBuyPrice(basePrice, itemKey, marketState) {
  const j = marketState?.prices?.[itemKey] ?? 1;
  return Math.max(1, Math.round(basePrice * j));
}

export function getSellPrice(baseSellValue, itemKey, marketState) {
  const j = marketState?.prices?.[itemKey] ?? 1;
  return Math.max(0, Math.floor((baseSellValue || 0) * j));
}