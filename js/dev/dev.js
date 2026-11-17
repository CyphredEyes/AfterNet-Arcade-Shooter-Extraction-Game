/* ===================================================================
   Dev commands — window.dev.* for testing.
   Safe to ship; nothing runs unless you call a command.
   =================================================================== */

import { state } from '../core/state.js';
import { makeItem, getBlueprint, BLUEPRINTS } from '../data/itemDB.js';
import { addItem, triggerCurrencyUpdate } from '../systems/grid-core.js';

function refresh() {
  triggerCurrencyUpdate();
  window.dispatchEvent(new CustomEvent('storage:changed'));
  window.dispatchEvent(new CustomEvent('hangar:changed'));
  window.dispatchEvent(new CustomEvent('save:request'));
}

/* ---- spawn one item type ---- */
export function spawn(key, count = 1) {
  const bp = getBlueprint(key);
  if (!bp) { console.error(`[dev] Unknown item: ${key}`); return 0; }

  const stackMax = bp.stackMax || 1;
  let remaining = count;
  let placed = 0;

  while (remaining > 0) {
    const batch = Math.min(remaining, stackMax);
    const item = makeItem(key);
    item.count = batch;
    if (!addItem(state.stash, item)) {
      console.warn(`[dev] Storage full after ${placed} of ${count}`);
      break;
    }
    placed += batch;
    remaining -= batch;
  }

  if (placed > 0) {
    refresh();
    console.log(`[dev] +${placed}× ${bp.name}`);
  }
  return placed;
}

/* ---- give currency ---- */
export function give(currency, amount) {
  if (currency === 'credits') {
    state.credits += amount;
    refresh();
    console.log(`[dev] +${amount} CR (total: ${state.credits})`);
  } else {
    spawn(currency, amount);
  }
}

/* ---- populate stash with a full test loadout ---- */
export function fill() {
  // Every blueprint in the game — no hardcoded list to maintain
  const allKeys = Object.keys(BLUEPRINTS);

  // Sort by area descending — big items (consoles, crates) get placed
  // first while the grid is still open. Small items fill gaps after.
  const sorted = [...allKeys].sort((a, b) => {
    const A = BLUEPRINTS[a];
    const B = BLUEPRINTS[b];
    return (B.w * B.h) - (A.w * A.h);
  });

  const failed = [];
  for (const key of sorted) {
    const item = makeItem(key);
    item.count = 1;
    if (!addItem(state.stash, item)) failed.push(key);
  }

  refresh();

  const placed = sorted.length - failed.length;

  if (failed.length === 0) {
    console.log(`[dev] Added all ${sorted.length} items to stash.`);
  } else {
    console.warn(
      `[dev] Added ${placed}/${sorted.length} items. ` +
      `${failed.length} didn't fit:`,
      failed,
    );
    console.warn('[dev] Tip: run dev.clear() first, then dev.fill() again for best results.');
  }

  return { placed, failed };
}

/* ---- wipe stash ---- */
export function clear() {
  state.stash.items.length = 0;
  refresh();
  console.log('[dev] Stash cleared');
}

/* ---- one-shot playable loadout ---- */
export function quickSetup() {
  // Wipe
  state.stash.items.length = 0;
  state.activeConsole = null;
  state.activeVR = null;

  // Console with CD already slotted
  const consoleItem = makeItem('console_t2');
  const cd          = makeItem('datadisk1');
  consoleItem.hardware.cdSlot.items = [cd];
  state.activeConsole = consoleItem;

  // VR
  state.activeVR = makeItem('vr_advanced');

  // Starting funds and stash
  state.credits = 10000;
  spawn('gold', 25);
  spawn('silicon', 25);
  spawn('electronics', 15);
  spawn('gchips', 10);
  spawn('itokens', 10);

  refresh();
  console.log('[dev] Ready: Console Mk.II + VR Advanced + Fighter CD equipped, 10,000 CR');
}

/* ---- equip a CD by key ---- */
export function equipCD(key) {
  const cd = makeItem(key);
  if (!cd.tags?.includes('ship_data')) {
    return console.error(`[dev] ${key} is not a ship CD`);
  }
  if (!state.activeConsole) {
    return console.error('[dev] Equip a console first (dev.quickSetup())');
  }
  state.activeConsole.hardware.cdSlot.items = [cd];
  refresh();
  console.log(`[dev] Equipped ${cd.name}`);
}

/* ---- install ---- */
export function installDevCommands() {
  window.dev = { spawn, give, fill, clear, quickSetup, equipCD, state };
  console.log(
    '%c[dev] Commands ready — dev.spawn(key, n) | dev.give(cur, n) | dev.fill() | dev.clear() | dev.quickSetup() | dev.equipCD(key)',
    'color:#3fb950;font-weight:bold',
  );
}