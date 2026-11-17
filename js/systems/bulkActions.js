/* ===================================================================
   Bulk actions — Move All (ship → stash), Sell All (any array → credits)
   All functions take a raw items array so they can operate on stash OR
   on the active CD's cargo.
   =================================================================== */

import { state } from '../core/state.js';
import { findFreeSpot } from './grid-core.js';

/* -------------------------------------------------------------------
   Move All — ship cargo → stash
   ------------------------------------------------------------------- */
export function moveAllShipToStash() {
  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (!cd || !cd.internalItems) return { moved: 0, total: 0 };

  const shipItems = cd.internalItems;
  const total = shipItems.length;
  const remaining = [];
  let moved = 0;

  for (const item of shipItems) {
    const spot = findFreeSpot(state.stash, item.w, item.h);
    if (spot) {
      item.col = spot.col;
      item.row = spot.row;
      item.rotated = spot.rotated;
      state.stash.items.push(item);
      moved++;
    } else {
      remaining.push(item);
    }
  }

  // Mutate in place so references stay valid
  shipItems.length = 0;
  shipItems.push(...remaining);

  if (moved > 0) {
    window.dispatchEvent(new CustomEvent('inventory:changed'));
    window.dispatchEvent(new CustomEvent('storage:changed'));
  }

  return { moved, total };
}

/* -------------------------------------------------------------------
   Sell All — parameterized. Works on any items array.
   Each "stack" is one item object (with .count inside).
   ------------------------------------------------------------------- */
export function previewSellAll(itemsArray) {
  if (!Array.isArray(itemsArray)) return { sellable: [], total: 0, skipped: 0 };

  const sellable = [];
  let totalCredits = 0;
  let skipped = 0;
  const seenRefs = new Set();

  for (const item of itemsArray) {
    // Skip duplicate references (paranoia)
    if (seenRefs.has(item)) continue;
    seenRefs.add(item);

    // Skip containers that still have contents
    const hasContents =
      (item.internalItems && item.internalItems.length > 0) ||
      (item.containerType === 'console' &&
        item.hardware &&
        Object.values(item.hardware).some(s => s.items.length > 0));
    if (hasContents) { skipped++; continue; }

    const baseCredits = item.value?.credits || 0;
    if (baseCredits <= 0) { skipped++; continue; }

    const jitter = state.market?.prices?.[item.key] ?? 1;
    const price  = Math.floor(baseCredits * jitter) * (item.count || 1);
    if (price <= 0) { skipped++; continue; }

    sellable.push({ item, price });
    totalCredits += price;
  }

  return { sellable, total: totalCredits, skipped };
}

export function executeSellAll(itemsArray, preview) {
  if (!Array.isArray(itemsArray) || !preview || !preview.sellable || preview.sellable.length === 0) {
    return 0;
  }

  const toSell = new Set(preview.sellable.map(s => s.item));
  const kept = [];
  let sold = 0;

  for (const it of itemsArray) {
    if (toSell.has(it)) {
      sold++;
    } else {
      kept.push(it);
    }
  }

  // Mutate in place — keep reference stable
  itemsArray.length = 0;
  itemsArray.push(...kept);

  if (sold > 0 && preview.total > 0) {
    state.credits = (state.credits || 0) + preview.total;
    window.dispatchEvent(new CustomEvent('currency:delta', {
      detail: { type: 'credits', delta: preview.total },
    }));
    window.dispatchEvent(new CustomEvent('inventory:changed'));
    window.dispatchEvent(new CustomEvent('storage:changed'));
  }

  return sold;
}