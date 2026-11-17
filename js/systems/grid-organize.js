/* ===================================================================
   Inventory Organizer
   Sorts by Category -> Key -> Tags.
   Packs row-by-row (line-by-line).
   =================================================================== */

import { makeItem, getBlueprint } from '../data/itemDB.js';

export function organizeInventory(inv) {
  // Track every real item instance so we can preserve container contents.
  const instances = new Map(); // key -> array of real instances
  for (const it of inv.items) {
    if (!instances.has(it.key)) instances.set(it.key, []);
    instances.get(it.key).push(it);
  }

  const byKey = new Map();
  for (const it of inv.items) {
    if (!byKey.has(it.key)) {
      const bp = getBlueprint(it.key);
      byKey.set(it.key, { 
        key: it.key, 
        total: 0, 
        proto: it, 
        rotated: it.rotated, 
        category: bp?.category || 'misc', 
        tags: bp?.tags || [], 
        name: bp?.name || it.key 
      });
    }
    byKey.get(it.key).total += it.count;
  }

  const stacks = [];
  for (const [, data] of byKey) {
    let remaining = data.total;
    while (remaining > 0) {
      const take = Math.min(remaining, data.proto.stackMax);
      stacks.push({ 
        key: data.key, 
        count: take, 
        w: data.proto.w, 
        h: data.proto.h, 
        rotated: data.rotated, 
        stackMax: data.proto.stackMax, 
        category: data.category, 
        tags: data.tags,
        name: data.name
      });
      remaining -= take;
    }
  }

  stacks.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.key !== b.key) return a.key.localeCompare(b.key);
    return a.tags.join(',').localeCompare(b.tags.join(','));
  });

  const grid = Array.from({ length: inv.rows }, () => Array(inv.cols).fill(false));
  const placements = [];

  for (const stack of stacks) {
    const spot = findSpot(grid, stack.w, stack.h, stack.rotated);
    if (!spot) return false;
    placeInGrid(grid, spot, stack.w, stack.h);
    placements.push({ ...stack, col: spot.col, row: spot.row, rotated: spot.rotated });
  }

  // Rebuild inventory, REUSING existing instances when the count matches.
  const usedInstances = new Set();
  const newItems = [];

  for (const p of placements) {
    // Try to find a matching real instance with the same key and count that hasn't been used yet
    const candidates = instances.get(p.key) || [];
    let matched = null;
    for (const inst of candidates) {
      if (usedInstances.has(inst)) continue;
      if (inst.count === p.count && inst.rotated === p.rotated) {
        matched = inst;
        usedInstances.add(inst);
        break;
      }
    }

    // If no matching instance (because the stack was split/merged), create a new one
    if (!matched) {
      matched = makeItem(p.key);
      matched.count = p.count;
      matched.rotated = p.rotated;
    }

    matched.col = p.col;
    matched.row = p.row;
    newItems.push(matched);
  }

  // Mutate in place so callers holding a reference (cdItem.internalItems,
  // state.stash.items) see the update. Reassigning `inv.items` breaks
  // those references and the mutation is lost on the next re-render.
  inv.items.length = 0;
  inv.items.push(...newItems);
  return true;
}

/* -------------------------------------------------------------------
   Packing Helpers (Row-by-Row Scan)
   ------------------------------------------------------------------- */

function findSpot(grid, w, h, preferRotated) {
  const rows = grid.length, cols = grid[0].length;
  const orders = preferRotated ? [true, false] : [false, true];
  
  for (const rot of orders) {
    const effW = rot ? h : w, effH = rot ? w : h;
    for (let r = 0; r <= rows - effH; r++) {
      for (let c = 0; c <= cols - effW; c++) {
        if (fits(grid, c, r, effW, effH)) {
          return { col: c, row: r, rotated: rot };
        }
      }
    }
  }
  return null;
}

function fits(grid, c, r, w, h) {
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (grid[y][x]) return false;
  return true;
}

function placeInGrid(grid, spot, w, h) {
  const effW = spot.rotated ? h : w, effH = spot.rotated ? w : h;
  for (let y = spot.row; y < spot.row + effH; y++) for (let x = spot.col; x < spot.col + effW; x++) grid[y][x] = true;
}