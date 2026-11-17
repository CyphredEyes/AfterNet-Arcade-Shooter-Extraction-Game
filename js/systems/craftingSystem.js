/* ===================================================================
   Crafting system — ingredient checking, space validation, execution.
   Only counts top-level stash items. Contained items are ignored.
   =================================================================== */

import { state } from '../core/state.js';
import { BLUEPRINTS, makeItem } from '../data/itemDB.js';
import { findFreeSpot } from './grid-core.js';
import { RECIPES } from '../data/recipesDB.js';

/* -------------------------------------------------------------------
   Stash scanning
   ------------------------------------------------------------------- */
export function countInStash(key) {
  let total = 0;
  for (const item of state.stash.items) {
    if (item.key === key) total += (item.count || 1);
  }
  return total;
}

export function consumeFromStash(key, amount) {
  let remaining = amount;
  for (let i = state.stash.items.length - 1; i >= 0 && remaining > 0; i--) {
    const it = state.stash.items[i];
    if (it.key !== key) continue;
    const take = Math.min(remaining, it.count || 1);
    it.count = (it.count || 1) - take;
    remaining -= take;
    if (it.count <= 0) state.stash.items.splice(i, 1);
  }
  return remaining === 0;
}

/* -------------------------------------------------------------------
   Space simulation
   ------------------------------------------------------------------- */
function simulateSpaceForOutput(itemKey, quantity, simItems) {
  const bp = BLUEPRINTS[itemKey];
  if (!bp) return false;
  const stackMax = bp.stackMax || 1;

  let remaining = quantity;

  // Merge into existing stacks first
  for (const it of simItems) {
    if (it.key !== itemKey) continue;
    const room = stackMax - (it.count || 1);
    if (room <= 0) continue;
    const take = Math.min(room, remaining);
    it.count = (it.count || 1) + take;
    remaining -= take;
    if (remaining === 0) return true;
  }

  // Place new stacks
  const simStash = { cols: state.stash.cols, rows: state.stash.rows, items: simItems };
  while (remaining > 0) {
    const stackSize = Math.min(remaining, stackMax);
    const spot = findFreeSpot(simStash, bp.w, bp.h);
    if (!spot) return false;
    simItems.push({
      id: `__sim_${simItems.length}__`,
      key: itemKey,
      w: bp.w, h: bp.h,
      col: spot.col, row: spot.row, rotated: spot.rotated,
      count: stackSize,
    });
    remaining -= stackSize;
  }
  return true;
}

/* -------------------------------------------------------------------
   Query
   ------------------------------------------------------------------- */
export function getMaxCraftable(recipeKey) {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return 0;
  const bp = BLUEPRINTS[recipe.key];
  if (!bp) return 0;

  // Ingredient limit
  let maxByIngredients = Infinity;
  for (const ing of recipe.ingredients) {
    const have = countInStash(ing.key);
    const can = Math.floor(have / ing.count);
    if (can < maxByIngredients) maxByIngredients = can;
    if (maxByIngredients === 0) return 0;
  }
  if (!Number.isFinite(maxByIngredients)) return 0;

  // Space limit
  const produces = recipe.produces || 1;
  const simItems = state.stash.items.map(it => ({ ...it }));
  let craftable = 0;

  for (let i = 0; i < maxByIngredients; i++) {
    if (!simulateSpaceForOutput(recipe.key, produces, simItems)) break;
    craftable++;
  }
  return craftable;
}

export function canCraftOne(recipeKey) {
  return getMaxCraftable(recipeKey) > 0;
}

/* -------------------------------------------------------------------
   Execute
   ------------------------------------------------------------------- */
export function craftRecipe(recipeKey, quantity = 1) {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return { ok: false, reason: 'Unknown recipe.' };

  const bp = BLUEPRINTS[recipe.key];
  if (!bp) return { ok: false, reason: 'Unknown output item.' };

  const qty = Math.max(1, Math.floor(quantity));
  const max = getMaxCraftable(recipeKey);
  if (qty > max) return { ok: false, reason: `Can only craft ${max}.` };
  if (max === 0) return { ok: false, reason: 'Missing ingredients or no space.' };

  // Consume ingredients
  for (const ing of recipe.ingredients) {
    consumeFromStash(ing.key, ing.count * qty);
  }

  // Produce output
  const produces = recipe.produces || 1;
  const totalOutput = produces * qty;
  const stackMax = bp.stackMax || 1;
  let remaining = totalOutput;

  // Merge into existing stacks
  for (const it of state.stash.items) {
    if (remaining <= 0) break;
    if (it.key !== recipe.key) continue;
    const room = stackMax - (it.count || 1);
    if (room <= 0) continue;
    const take = Math.min(room, remaining);
    it.count = (it.count || 1) + take;
    remaining -= take;
  }

  // Place new stacks
  while (remaining > 0) {
    const stackSize = Math.min(remaining, stackMax);
    const spot = findFreeSpot(state.stash, bp.w, bp.h);
    if (!spot) break;
    const item = makeItem(recipe.key);
    item.count = stackSize;
    item.col = spot.col;
    item.row = spot.row;
    item.rotated = spot.rotated;
    state.stash.items.push(item);
    remaining -= stackSize;
  }

  window.dispatchEvent(new CustomEvent('inventory:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));

  return { ok: true, crafted: qty, produced: totalOutput };
}