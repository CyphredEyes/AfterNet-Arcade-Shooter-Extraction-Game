/* ===================================================================
   Spoils system — generates loot when nodes / core die, stores it
   in server.spoils. Also provides the master-key consumption helper.
   =================================================================== */

import { state } from '../core/state.js';
import {
  generateNodeLootItems, generateCoreLootItems,
} from './lootSystem.js';
import { findFreeSpot, triggerCurrencyUpdate } from './grid-core.js';
import { SPOILS_GRID } from '../modules/config.js';

/* -------------------------------------------------------------------
   Bag packing — grows rows until everything fits
   ------------------------------------------------------------------- */
function packItemsGrowable(items, cols, minRows) {
  const bag = { cols, rows: minRows, items: [] };
  for (const item of items) {
    let placed = false;
    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      const spot = findFreeSpot(bag, item.w, item.h);
      if (spot) {
        item.col = spot.col;
        item.row = spot.row;
        item.rotated = spot.rotated;
        bag.items.push(item);
        placed = true;
      } else {
        bag.rows += 1;
      }
    }
    if (!placed) console.warn('[spoils] Could not fit item', item.name);
  }
  return bag;
}

/* -------------------------------------------------------------------
   Event handlers
   ------------------------------------------------------------------- */
function onNodeKilled(e) {
  const { server, node } = e.detail || {};
  if (!server || !node) return;
  if (!server.spoils) server.spoils = {};
  if (server.spoils[node.id]) return; // already generated

  const items = generateNodeLootItems(node.category, server.tier, {
    lootMul: server.tierDef?.lootMul ?? 1,
  });

  server.spoils[node.id] = packItemsGrowable(items, SPOILS_GRID.cols, SPOILS_GRID.baseRows);

  window.dispatchEvent(new CustomEvent('inventory:changed'));
}

function onCoreKilled(e) {
  const { server } = e.detail || {};
  if (!server) return;
  if (!server.spoils) server.spoils = {};
  if (server.spoils.core) return;

  const items = generateCoreLootItems(server.tier);
  server.spoils.core = packItemsGrowable(items, SPOILS_GRID.cols, SPOILS_GRID.baseRows);
  window.dispatchEvent(new CustomEvent('inventory:changed'));
}

/* -------------------------------------------------------------------
   Master key helpers
   ------------------------------------------------------------------- */
export function hasMasterKeyInCargo() {
  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (!cd || !cd.internalItems) return false;
  return cd.internalItems.some(i => i.key === 'masterkey');
}

export function consumeOneMasterKey() {
  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (!cd || !cd.internalItems) return false;
  const idx = cd.internalItems.findIndex(i => i.key === 'masterkey');
  if (idx === -1) return false;

  const item = cd.internalItems[idx];
  item.count = (item.count || 1) - 1;
  if (item.count <= 0) cd.internalItems.splice(idx, 1);

  triggerCurrencyUpdate();
  window.dispatchEvent(new CustomEvent('inventory:changed'));
  return true;
}

/* -------------------------------------------------------------------
   Install
   ------------------------------------------------------------------- */
let installed = false;
export function initSpoilsSystem() {
  if (installed) return;
  window.addEventListener('sector:node-killed', onNodeKilled);
  window.addEventListener('sector:core-killed', onCoreKilled);
  installed = true;
}