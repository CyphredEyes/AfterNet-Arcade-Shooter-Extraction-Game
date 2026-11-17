/* ===================================================================
   GRID SYSTEM - Core Engine
   =================================================================== */

import { nextItemIdForSplit, getBlueprint } from '../data/itemDB.js';
import { openContainerWindow } from '../ui/containerWindow.js';
import { openItemDescription } from '../ui/itemDescription.js';
import { state } from '../core/state.js';
import { getRarityConfig } from '../data/rarityDB.js';
import { showToast } from '../ui/toast.js';

export const CELL = 60;
const registry = new Map();

export const HARDWARE_SLOT_RULES = {
  cpu:     (item) => item.tags?.includes('cpu'),
  ram:     (item) => item.tags?.includes('ram'),
  gpu:     (item) => item.tags?.includes('gpu'),
  network: (item) => item.tags?.includes('network'),
  cooler:  (item) => item.tags?.includes('cooler'),
  cdSlot:  (item) => item.tags?.includes('ship_data'),
};

export function triggerCurrencyUpdate() {
  window.dispatchEvent(new CustomEvent('inventory:changed'));
}

/* -------------------------------------------------------------------
   Active console lookup
   ------------------------------------------------------------------- */
export function findActiveConsole() {
  return state.activeConsole;
}

export function isCDEquipped(cdItem) {
  if (!cdItem || !cdItem.tags?.includes('ship_data')) return false;
  const consoleItem = state.activeConsole;
  if (!consoleItem || !consoleItem.hardware) return false;
  if (!consoleItem.hardware.cdSlot || !Array.isArray(consoleItem.hardware.cdSlot.items)) return false;
  return consoleItem.hardware.cdSlot.items.some(i => i.id === cdItem.id);
}

export function isCDLocked(cdItem) {
  if (!cdItem || !cdItem.tags?.includes('ship_data')) return false;
  if (!isCDEquipped(cdItem)) return false;
  return cdItem.internalItems && cdItem.internalItems.length > 0;
}

/* -------------------------------------------------------------------
   Lock Helper Functions
   ------------------------------------------------------------------- */

function findKeyInGrids(requiredKey) {
  for (const [, entry] of registry) {
    const keyItem = entry.inventory.items.find(it => it.key === requiredKey);
    if (keyItem) return { item: keyItem, inventory: entry.inventory, gridId: entry.gridId };
  }
  return null;
}

/* -------------------------------------------------------------------
   Decoder search — walks the full player tree (stash, nested containers,
   equipped CD cargo) and consumes one matching item. Returns true on
   success.
   ------------------------------------------------------------------- */
function findAndConsumeDecoder(decoderTier) {
  const key = `decoder_t${decoderTier}`;
  const arrays = [state.stash.items];

  function walk(items) {
    for (const it of items) {
      // Skip contents of locked containers — player can't access them
      if (it.locked) continue;
      if (it.internalItems) {
        arrays.push(it.internalItems);
        walk(it.internalItems);
      }
      if (it.hardware) {
        for (const slot of Object.values(it.hardware)) {
          arrays.push(slot.items);
          walk(slot.items);
        }
      }
    }
  }
  walk(state.stash.items);

  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (cd?.internalItems) {
    arrays.push(cd.internalItems);
    walk(cd.internalItems);
  }

  for (const arr of arrays) {
    const idx = arr.findIndex(it => it.key === key);
    if (idx !== -1) {
      const item = arr[idx];
      item.count = (item.count || 1) - 1;
      if (item.count <= 0) arr.splice(idx, 1);
      return true;
    }
  }
  return false;
}

function unlockContainer(containerItem) {
  if (containerItem.decoderTier != null) {
    const bp = getBlueprint(`decoder_t${containerItem.decoderTier}`);
    const decoderName = bp ? bp.name : `Decoder T${containerItem.decoderTier}`;

    if (!findAndConsumeDecoder(containerItem.decoderTier)) {
      alert(`Locked. Requires a ${decoderName}.`);
      return;
    }

    containerItem.locked = false;
    containerItem.lockResolved = true;

    for (const [gid, entry] of registry) {
      renderGrid(gid, entry.inventory);
    }

    window.dispatchEvent(new CustomEvent('inventory:changed'));
    window.dispatchEvent(new CustomEvent('storage:changed'));

    alert(`Unlocked with ${decoderName}!`);
    return;
  }

  const keyFound = findKeyInGrids(containerItem.requiredKey);

  if (keyFound) {
    const idx = keyFound.inventory.items.indexOf(keyFound.item);
    if (idx !== -1) keyFound.inventory.items.splice(idx, 1);

    containerItem.locked = false;
    containerItem.lockResolved = true;

    renderGrid(keyFound.gridId, keyFound.inventory);

    for (const [gid, entry] of registry) {
      if (entry.inventory.items.includes(containerItem)) {
        renderGrid(gid, entry.inventory);
        break;
      }
    }

    window.dispatchEvent(new CustomEvent('inventory:changed'));
    window.dispatchEvent(new CustomEvent('storage:changed'));

    alert(`Unlocked with ${keyFound.item.name}!`);
  } else {
    const bp = getBlueprint(containerItem.requiredKey);
    const keyName = bp ? bp.name : containerItem.requiredKey;
    alert(`Locked. You need a ${keyName} to open this.`);
  }
}

/* -------------------------------------------------------------------
   Grid Data & Helpers
   ------------------------------------------------------------------- */

export function createInventory(cols, rows) {
  return { cols, rows, items: [] };
}

export function itemDims(item) {
  return item.rotated ? { w: item.h, h: item.w } : { w: item.w, h: item.h };
}

export function overlaps(inv, item, ignoreId = null) {
  const d = itemDims(item);
  for (const other of inv.items) {
    if (other.id === item.id || other.id === ignoreId) continue;
    const od = itemDims(other);
    if (item.col < other.col + od.w && item.col + d.w > other.col &&
        item.row < other.row + od.h && item.row + d.h > other.row) return true;
  }
  return false;
}

export function inBounds(inv, item) {
  const d = itemDims(item);
  return item.col >= 0 && item.row >= 0 && item.col + d.w <= inv.cols && item.row + d.h <= inv.rows;
}

export function findFreeSpot(inv, w, h, ignoreId = null) {
  const temp = { id: '__tmp', col: 0, row: 0, rotated: false, w, h };
  for (const rot of [false, true]) {
    temp.rotated = rot;
    const d = rot ? { w: h, h: w } : { w, h };
    for (let r = 0; r <= inv.rows - d.h; r++) {
      for (let c = 0; c <= inv.cols - d.w; c++) {
        temp.col = c; temp.row = r;
        if (!overlaps(inv, temp, ignoreId)) return { col: c, row: r, rotated: rot };
      }
    }
  }
  return null;
}

export function addItem(inv, item) {
  const spot = findFreeSpot(inv, item.w, item.h);
  if (!spot) return null;
  const placed = { ...item, col: spot.col, row: spot.row, rotated: spot.rotated };
  inv.items.push(placed);
  return placed;
}

export function itemAtCell(inv, col, row) {
  for (const it of inv.items) {
    const d = itemDims(it);
    if (col >= it.col && col < it.col + d.w && row >= it.row && row < it.row + d.h) return it;
  }
  return null;
}

export function tryMergeItems(sourceItem, targetItem) {
  if (!sourceItem || !targetItem) return { merged: 0, leftover: sourceItem?.count || 0 };
  if (sourceItem.key !== targetItem.key) return { merged: 0, leftover: sourceItem.count };
  if (targetItem.stackMax <= 1) return { merged: 0, leftover: sourceItem.count };
  const room = targetItem.stackMax - targetItem.count;
  if (room <= 0) return { merged: 0, leftover: sourceItem.count };
  const moved = Math.min(room, sourceItem.count);
  targetItem.count += moved; sourceItem.count -= moved;
  triggerCurrencyUpdate();
  return { merged: moved, leftover: sourceItem.count };
}

export function prepareSplit(gridId, itemId) {
  const entry = registry.get(gridId);
  if (!entry) return null;
  const inv = entry.inventory;
  const item = inv.items.find(it => it.id === itemId);
  if (!item || item.count <= 1) return null;
  const half = Math.floor(item.count / 2);
  if (half <= 0) return null;

  const piece = { ...item, id: nextItemIdForSplit(), count: half, rotated: item.rotated, col: 0, row: 0 };
  return {
    sourceGridId: gridId,
    sourceItemId: item.id,
    sourceCellSize: entry.cellSize || CELL,
    piece,
    commit() { item.count -= half; renderGrid(gridId, inv); },
  };
}

export function prepareTakeOne(gridId, itemId) {
  const entry = registry.get(gridId);
  if (!entry) return null;
  const inv = entry.inventory;
  const item = inv.items.find(it => it.id === itemId);
  if (!item || item.count <= 1) return null;

  const piece = { ...item, id: nextItemIdForSplit(), count: 1, rotated: item.rotated, col: 0, row: 0 };
  return {
    sourceGridId: gridId,
    sourceItemId: item.id,
    sourceCellSize: entry.cellSize || CELL,
    piece,
    commit() { item.count -= 1; renderGrid(gridId, inv); },
  };
}

/* -------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------- */

export function mountGrid(gridId, inv, mountEl, opts = {}) {
  const cellSize = opts.cellSize || CELL;

  const wrapper = document.createElement('div');
  wrapper.className = 'grid';
  wrapper.style.setProperty('--cell', cellSize + 'px');
  wrapper.style.width  = inv.cols * cellSize + 'px';
  wrapper.style.height = inv.rows * cellSize + 'px';

  for (let r = 0; r < inv.rows; r++) {
    for (let c = 0; c < inv.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.left = c * cellSize + 'px';
      cell.style.top  = r * cellSize + 'px';
      cell.dataset.col = c;
      cell.dataset.row = r;
      wrapper.appendChild(cell);
    }
  }

  mountEl.appendChild(wrapper);
  registry.set(gridId, { inventory: inv, el: wrapper, opts, cellSize });
  renderGrid(gridId, inv);
  return wrapper;
}

/* Dedupe by id. Removes duplicate references AND items with duplicate ids.
   Returns true if anything was removed. */
export function sanitizeInventory(inv) {
  if (!inv || !Array.isArray(inv.items)) return false;
  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const item of inv.items) {
    if (seen.has(item.id)) {
      removed++;
      console.warn(`[grid] Duplicate item id ${item.id} (${item.key}) removed.`);
      continue;
    }
    seen.add(item.id);
    kept.push(item);
  }
  if (removed > 0) {
    inv.items.length = 0;
    inv.items.push(...kept);
    return true;
  }
  return false;
}

function breakCycles(item, ancestors = new Set()) {
  if (!item || !item.internalItems) return;
  if (ancestors.has(item)) return;
  ancestors.add(item);

  const kept = [];
  for (const child of item.internalItems) {
    if (ancestors.has(child)) {
      console.warn(`[grid] Breaking cycle: removed ${child.key} #${child.id} from ${item.key} #${item.id}`);
      continue;
    }
    kept.push(child);
    breakCycles(child, ancestors);
  }

  if (kept.length !== item.internalItems.length) {
    item.internalItems.length = 0;
    item.internalItems.push(...kept);
  }

  ancestors.delete(item);
}

export function sanitizeCycles(inv) {
  if (!inv || !Array.isArray(inv.items)) return;
  for (const item of inv.items) {
    breakCycles(item);
  }
}

export function renderGrid(gridId, inv) {
  const entry = registry.get(gridId);
  if (!entry) return;
  const { el, opts, cellSize } = entry;
  el.querySelectorAll('.item').forEach(n => n.remove());

  const drag = activeDrag;
  for (const item of inv.items) {
    if (drag && drag.item === item) continue;
    el.appendChild(buildItemEl(gridId, inv, item, opts, cellSize));
  }
}

export function syncGrid(gridId, inv) {
  const entry = registry.get(gridId);
  if (!entry) return;
  entry.inventory.cols = inv.cols;
  entry.inventory.rows = inv.rows;
  if (entry.inventory.items !== inv.items) {
    entry.inventory.items.length = 0;
    entry.inventory.items.push(...inv.items);
  }
  renderGrid(gridId, entry.inventory);
}

export function clearGridsByPrefix(prefix) {
  for (const gridId of [...registry.keys()]) {
    if (gridId.startsWith(prefix)) {
      registry.delete(gridId);
    }
  }
}

function buildItemEl(gridId, inv, item, opts = {}, cellSize = CELL) {
  const el = document.createElement('div');
  el.className = 'item';
  el.dataset.id = item.id;
  el.dataset.gridId = gridId;

  let imgSrc = item.img;
  if (item.dynamicImageCategory && item.internalItems && item.internalItems.length > 0) {
    const containedItem = item.internalItems.find(i => i.category === item.dynamicImageCategory);
    if (containedItem) {
      imgSrc = `../../img/items/${containedItem.key}contained.png`;
    }
  }

  const rarity = getRarityConfig(item);
  el.style.borderColor = rarity.borderColor;
  el.style.borderWidth = '2px';
  if (rarity.bgGradient) el.style.background = rarity.bgGradient;
  if (rarity.glow) el.style.boxShadow = rarity.glow;

  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.draggable = false;
    img.onerror = () => { 
      if (imgSrc !== item.img) {
        img.src = item.img; 
      } else {
        img.remove(); 
      }
    };
    el.appendChild(img);
  }

  applyItemVisual(el, item, undefined, undefined, cellSize);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.name || 'Item';
  el.appendChild(name);

  if (item.count > 1) {
    const count = document.createElement('div');
    count.className = 'count';
    count.textContent = item.count;
    el.appendChild(count);
  }

    // CD "blocked" label stays (informational, not interactive)
  if (isCDLocked(item)) {
    const blocked = document.createElement('div');
    blocked.className = 'cd-blocked-label';
    blocked.textContent = 'BLOCKED';
    el.appendChild(blocked);
  }

  if (item._outOfStock) {
    el.classList.add('out-of-stock');
    const oos = document.createElement('div');
    oos.className = 'oos-label';
    oos.textContent = 'OUT OF STOCK';
    el.appendChild(oos);
  }

  if (opts.readOnly) {
    // ---- Read-only: clickable, no drag/rotate/context ----
    el.classList.add('readonly');
    el.style.cursor = 'pointer';

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (opts.onItemClick) opts.onItemClick(item, e);
    };
    el.addEventListener('click', handler);
    el.addEventListener('contextmenu', handler);

    return el;
  }

  // ---- Interactive (unchanged from here down) ----
  const spin = document.createElement('div');
  spin.className = 'spin';
  spin.textContent = '⟳';
  spin.addEventListener('mousedown', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (activeDrag && activeDrag.item.id === item.id) rotateGhost();
    else rotateItem(gridId, item.id);
  });
  el.appendChild(spin);

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.classList.contains('spin')) return;
    e.preventDefault(); e.stopPropagation();
    beginDrag(gridId, item, el, e);
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    openContextMenu(gridId, item.id, e.clientX, e.clientY);
  });

  return el;
}

function applyItemVisual(el, item, overrideCol, overrideRow, cellSize = CELL) {
  const d = itemDims(item);
  const boxW = d.w * cellSize - 2;
  const boxH = d.h * cellSize - 2;

  el.style.left   = overrideCol !== undefined ? overrideCol + 'px' : item.col * cellSize + 'px';
  el.style.top    = overrideRow !== undefined ? overrideRow + 'px' : item.row * cellSize + 'px';
  el.style.width  = boxW + 'px';
  el.style.height = boxH + 'px';

  const img = el.querySelector('img');
  if (img) {
    img.style.width = ''; img.style.height = '';
    img.style.left = ''; img.style.top = ''; img.style.transform = ''; img.style.margin = '';

    if (!item.rotated) {
      if (item.imgWidth || item.imgHeight) {
        img.style.width = item.imgWidth || 'auto';
        img.style.height = item.imgHeight || 'auto';
        img.style.position = 'absolute';
        img.style.left = '50%'; img.style.top = '50%';
        img.style.transform = 'translate(-50%, -50%)';
      } else if (item.imgScale !== undefined && item.imgScale !== 1) {
        img.style.width  = `${item.imgScale * 100}%`;
        img.style.height = `${item.imgScale * 100}%`;
        img.style.position = 'absolute';
        img.style.left = '50%'; img.style.top = '50%';
        img.style.transform = 'translate(-50%, -50%)';
      }
    }

    if (item.rotated) {
      img.style.width  = item.w * cellSize - 2 + 'px';
      img.style.height = item.h * cellSize - 2 + 'px';
      img.style.left = '50%'; img.style.top = '50%';
      let scaleStr = '';
      if (item.imgScale !== undefined && item.imgScale !== 1) {
        scaleStr = ` scale(${item.imgScale})`;
      }
      img.style.transform = `translate(-50%, -50%) rotate(90deg)${scaleStr}`;
    }
  }
}
export function rotateItem(gridId, itemId) {
  const entry = registry.get(gridId);
  if (!entry) return;
  const inv = entry.inventory;
  const item = inv.items.find(it => it.id === itemId);
  if (!item) return;

  const oldRot = item.rotated;
  item.rotated = !item.rotated;

  const d = itemDims(item);
  const test = { ...item, col: item.col, row: item.row };

  if (inBounds(inv, test) && !overlaps(inv, test, item.id)) {
    renderGrid(gridId, inv);
    return;
  }

  let best = null;
  for (let r = 0; r <= inv.rows - d.h; r++) {
    for (let c = 0; c <= inv.cols - d.w; c++) {
      const testSpot = { ...item, col: c, row: r };
      if (!overlaps(inv, testSpot, item.id)) {
        const dist = Math.abs(c - item.col) + Math.abs(r - item.row);
        if (!best || dist < best.dist) best = { c, r, dist };
      }
    }
  }

  if (best) {
    item.col = best.c;
    item.row = best.r;
    renderGrid(gridId, inv);
  } else {
    item.rotated = oldRot;
    renderGrid(gridId, inv);
  }
}

/* -------------------------------------------------------------------
   Drag & Drop
   ------------------------------------------------------------------- */

let activeDrag = null;

function beginDrag(gridId, item, itemEl, startEvent) {
  const entry = registry.get(gridId);
  if (!entry) return;

  if (isCDLocked(item)) {
    return;
  }

  if (entry.inventory.items.indexOf(item) === -1) {
    console.warn('[grid] Stale item element — refreshing grid.');
    renderGrid(gridId, entry.inventory);
    return;
  }

  const cellSize = entry.cellSize || CELL;   // ← must come before any use

  const orig = { inv: entry.inventory, gridId, col: item.col, row: item.row, rotated: item.rotated };
  itemEl.remove();

  const ghost = buildItemEl(gridId, entry.inventory, item, entry.opts, cellSize);
  ghost.classList.add('dragging');

  const gridRect = entry.el.getBoundingClientRect();
  const grabOffsetX = startEvent.clientX - (gridRect.left + item.col * cellSize);
  const grabOffsetY = startEvent.clientY - (gridRect.top  + item.row * cellSize);

  ghost.style.left = (startEvent.clientX - grabOffsetX) + 'px';
  ghost.style.top  = (startEvent.clientY - grabOffsetY) + 'px';

  document.body.appendChild(ghost);

  activeDrag = {
    gridId, item, ghost, orig, grabOffsetX, grabOffsetY,
    lastX: startEvent.clientX, lastY: startEvent.clientY,
    moved: false, cellSize,
  };
  renderGrid(gridId, entry.inventory);

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('keydown', onDragKey);
}

function rerenderAllForInventory(itemsArray) {
  if (!itemsArray) return;
  for (const [gridId, entry] of registry) {
    if (entry.inventory.items === itemsArray) {
      renderGrid(gridId, entry.inventory);
      continue;
    }

    // Also re-render grids that contain an item whose internalItems or
    // hardware-slot items IS the changed array. This makes the CD
    // "BLOCKED" label (and container previews) update immediately when
    // the container's contents change, without needing a tab switch.
    const hasAffectedChild = entry.inventory.items.some(it =>
      it.internalItems === itemsArray ||
      (it.hardware && Object.values(it.hardware).some(s => s.items === itemsArray))
    );
    if (hasAffectedChild) {
      renderGrid(gridId, entry.inventory);
    }
  }
}

function positionGhost(clientX, clientY) {
  if (!activeDrag) return;
  activeDrag.lastX = clientX; activeDrag.lastY = clientY;
  activeDrag.ghost.style.left = (clientX - activeDrag.grabOffsetX) + 'px';
  activeDrag.ghost.style.top = (clientY - activeDrag.grabOffsetY) + 'px';
}

function rotateGhost() {
  if (!activeDrag) return;
  const { ghost, item } = activeDrag;
  const oldW = ghost.offsetWidth, oldH = ghost.offsetHeight;
  const relX = oldW > 0 ? activeDrag.grabOffsetX / oldW : 0.5;
  const relY = oldH > 0 ? activeDrag.grabOffsetY / oldH : 0.5;

  item.rotated = !item.rotated;
  applyItemVisual(ghost, item);

  activeDrag.grabOffsetX = relX * ghost.offsetWidth;
  activeDrag.grabOffsetY = relY * ghost.offsetHeight;
  activeDrag.moved = true;
  
  positionGhost(activeDrag.lastX, activeDrag.lastY);
  updateDropHighlight(activeDrag.lastX, activeDrag.lastY);
}

function onDragMove(e) {
  if (!activeDrag) return;
  activeDrag.moved = true;
  positionGhost(e.clientX, e.clientY);
  updateDropHighlight(e.clientX, e.clientY);
}

function parseHardwareSlotFromGridId(gridId) {
  if (!gridId) return null;
  if (gridId.startsWith('storage-console-grid-')) {
    const parts = gridId.split('-');
    return parts[4] || null;
  }
  if (gridId.startsWith('console-grid-')) {
    const parts = gridId.split('-');
    return parts[3] || null;
  }
  return null;
}

function onDragEnd(e) {
  if (!activeDrag) return;
  const drag = activeDrag;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('keydown', onDragKey);
  activeDrag = null;

  clearHighlights();
  drag.ghost.remove();

  const hit = hitTestGrids(e.clientX, e.clientY);

  /* ---- No movement: re-render source grids, exit ---- */
  if (!drag.moved) {
    rerenderAllForInventory(drag.orig.inv.items);
    return;
  }

  /* ---- Dropped outside any grid ---- */
  if (!hit) {
    const dropEvent = new CustomEvent('item:dragOut', {
      cancelable: true,
      detail: { clientX: e.clientX, clientY: e.clientY, drag },
    });
    const notCancelled = window.dispatchEvent(dropEvent);
    if (notCancelled) commitRevert(drag);
    return;
  }

  /* ---- Hard rule: consoles cannot go inside CDs ---- */
  if (drag.item.containerType === 'console') {
    if (hit.gridId.startsWith('container-')) {
      const targetContainerId = parseInt(hit.gridId.split('-')[1], 10);
      const targetContainer = findContainerItemById(targetContainerId);
      if (targetContainer?.tags?.includes('ship_data')) {
        rerenderAllForInventory(hit.entry.inventory.items);
        commitRevert(drag);
        alert('Cannot place a console inside a CD.');
        return;
      }
    }

    const toInvPeek   = hit.entry.inventory;
    const tgRectPeek  = hit.entry.el.getBoundingClientRect();
    let colPeek = Math.round((e.clientX - tgRectPeek.left - drag.grabOffsetX) / CELL);
    let rowPeek = Math.round((e.clientY - tgRectPeek.top  - drag.grabOffsetY) / CELL);
    colPeek = Math.max(0, Math.min(toInvPeek.cols - 1, colPeek));
    rowPeek = Math.max(0, Math.min(toInvPeek.rows - 1, rowPeek));
    const hoverPeek = itemAtCell(toInvPeek, colPeek, rowPeek);
    if (hoverPeek && hoverPeek.id !== drag.item.id && hoverPeek.tags?.includes('ship_data')) {
      rerenderAllForInventory(toInvPeek.items);
      commitRevert(drag);
      alert('Cannot place a console inside a CD.');
      return;
    }
  }

    /* ---- Resolve drop cell ---- */
  const toInv  = hit.entry.inventory;

  // Cycle guard — cannot drop an item into its own grid or a
  // descendant's grid (would make the item contain itself).
  if (inventoryBelongsTo(drag.item, toInv)) {
    commitRevert(drag);
    alert('Cannot place a container inside itself.');
    return;
  }

  const d      = itemDims(drag.item);
  const tgRect = hit.entry.el.getBoundingClientRect();
  const targetCellSize = hit.entry.cellSize || CELL;

  let col = Math.round((e.clientX - tgRect.left - drag.grabOffsetX) / targetCellSize);
  let row = Math.round((e.clientY - tgRect.top  - drag.grabOffsetY) / targetCellSize);
  col = Math.max(0, Math.min(toInv.cols - d.w, col));
  row = Math.max(0, Math.min(toInv.rows - d.h, row));

  const hoverItem = itemAtCell(toInv, col, row);

  if (hoverItem && hoverItem.id !== drag.item.id) {
    const hoverIsCD               = hoverItem.tags?.includes('ship_data');
    const droppingIntoHardwareSlot = hit.gridId.startsWith('console-grid-');

    if (!hoverIsCD || !droppingIntoHardwareSlot) {

      /* ---- Drop onto a console hardware slot ---- */
      if (hoverItem.containerType === 'console' && hoverItem.hardware) {
        const slotKey = findHardwareSlotFor(hoverItem, drag.item);
        if (!slotKey) {
          rerenderAllForInventory(toInv.items);
          commitRevert(drag);
          alert(`This item doesn't belong in any slot of ${hoverItem.name}.`);
          return;
        }

        const slotInv = hoverItem.hardware[slotKey];
        const spot    = findFreeSpot(slotInv, drag.item.w, drag.item.h);
        if (!spot) {
          rerenderAllForInventory(toInv.items);
          commitRevert(drag);
          alert(`No space in the ${slotKey.toUpperCase()} slot.`);
          return;
        }

        const idx = drag.orig.inv.items.indexOf(drag.item);
        if (idx !== -1) drag.orig.inv.items.splice(idx, 1);

        drag.item.col     = spot.col;
        drag.item.row     = spot.row;
        drag.item.rotated = spot.rotated;
        slotInv.items.push(drag.item);

        rerenderAllForInventory(drag.orig.inv.items);
        rerenderAllForInventory(toInv.items);

        for (const [gid, entry] of registry) {
          if (gid.startsWith(`console-grid-${hoverItem.id}-`)) {
            const sid = gid.replace(`console-grid-${hoverItem.id}-`, '');
            entry.inventory.items = hoverItem.hardware[sid]?.items || [];
            renderGrid(gid, entry.inventory);
          }
        }

        triggerCurrencyUpdate();
        return;
      }

      /* ---- Drop onto a container ---- */
      if (hoverItem.internalItems) {
        const check = canPlaceInside(hoverItem, drag.item);
        if (!check.ok) {
          rerenderAllForInventory(toInv.items);
          commitRevert(drag);
          alert(check.reason);
          return;
        }

        const spot = findFreeSpot(
          { cols: hoverItem.internalCols, rows: hoverItem.internalRows, items: hoverItem.internalItems },
          drag.item.w, drag.item.h,
        );
        if (spot) {
          const idx = drag.orig.inv.items.indexOf(drag.item);
          if (idx !== -1) drag.orig.inv.items.splice(idx, 1);

          drag.item.col     = spot.col;
          drag.item.row     = spot.row;
          drag.item.rotated = spot.rotated;
          hoverItem.internalItems.push(drag.item);

          rerenderAllForInventory(drag.orig.inv.items);
          rerenderAllForInventory(toInv.items);
          if (hit.gridId.startsWith('container-')) updateContainerParents(hit.gridId.split('-')[1]);
          return;
        } else {
          rerenderAllForInventory(toInv.items);
          commitRevert(drag);
          alert('Not enough space inside the container.');
          return;
        }
      }

      /* ---- Stack merge ---- */
      if (hoverItem.key === drag.item.key && hoverItem.stackMax > 1) {
        const { leftover } = tryMergeItems(drag.item, hoverItem);
        if (leftover === 0) {
          const idx = drag.orig.inv.items.indexOf(drag.item);
          if (idx !== -1) drag.orig.inv.items.splice(idx, 1);
          rerenderAllForInventory(drag.orig.inv.items);
          rerenderAllForInventory(toInv.items);
          return;
        }
        rerenderAllForInventory(toInv.items);
        commitRevert(drag);
        return;
      }
    }
  }

  /* ---- CD-in-container side effects ---- */
  if (hit.gridId.startsWith('container-')) {
    const containerId   = parseInt(hit.gridId.split('-')[1], 10);
    const containerItem = findContainerItemById(containerId);

    if (containerItem?.tags?.includes('ship_data') && !isCDEquipped(containerItem)) {
      rerenderAllForInventory(toInv.items);
      commitRevert(drag);
      alert('Equip this CD in a console to add items to its cargo.');
      return;
    }

    if (containerItem?.tags?.includes('ship_data')) {
      const activeConsole = findActiveConsole();
      if (activeConsole?.hardware?.cdSlot?.items?.some(i => i.id === containerItem.id)) {
        for (const [gid, entry] of registry) {
          if (gid.startsWith(`console-grid-${activeConsole.id}-`)) {
            renderGrid(gid, entry.inventory);
          }
        }
      }
      for (const [gid, entry] of registry) {
        if (gid === 'stash-grid') renderGrid(gid, entry.inventory);
      }
    }
  }

  /* ---- Console hardware slot rule check ---- */
  const slotKey = parseHardwareSlotFromGridId(hit.gridId);
  if (slotKey) {
    const rule = HARDWARE_SLOT_RULES[slotKey];
    if (rule && !rule(drag.item)) {
      rerenderAllForInventory(toInv.items);
      commitRevert(drag);
      alert(`This item doesn't belong in the ${slotKey.toUpperCase()} slot.`);
      return;
    }
  }

  /* ---- Bounds + overlap validation ---- */
  const test = { ...drag.item, col, row };
  let valid  = inBounds(toInv, test) && !overlaps(toInv, test, drag.item.id);

  if (!valid) {
    const rotatedItem = { ...drag.item, rotated: !drag.item.rotated };
    const rotatedTest = { ...rotatedItem, col, row };
    if (inBounds(toInv, rotatedTest) && !overlaps(toInv, rotatedTest, drag.item.id)) {
      drag.item.rotated = rotatedItem.rotated;
      valid = true;
    }
  }

  if (!valid) {
    const nudgeOffsets = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dc, dr] of nudgeOffsets) {
      const nc = Math.max(0, Math.min(toInv.cols - d.w, col + dc));
      const nr = Math.max(0, Math.min(toInv.rows - d.h, row + dr));
      const nudgeTest = { ...drag.item, col: nc, row: nr };
      if (inBounds(toInv, nudgeTest) && !overlaps(toInv, nudgeTest, drag.item.id)) {
        col = nc; row = nr; valid = true;
        break;
      }
    }
  }

  if (!valid) {
    rerenderAllForInventory(toInv.items);
    commitRevert(drag);
    return;
  }

  /* ---- Commit move ---- */
  const idx = drag.orig.inv.items.indexOf(drag.item);
  if (idx !== -1) drag.orig.inv.items.splice(idx, 1);
  drag.item.col = col;
  drag.item.row = row;
  toInv.items.push(drag.item);

  rerenderAllForInventory(drag.orig.inv.items);
  rerenderAllForInventory(toInv.items);

  if (hit.gridId.startsWith('container-')) {
    updateContainerParents(hit.gridId.split('-')[1]);
  }

  // If we modified a hardware slot, the loadout changed. Re-render any
  // view (hangar / storage) that mirrors it. CD slot in particular needs
  // to mount/unmount the CD cargo grid on the right column.
  if (slotKey) {
    window.dispatchEvent(new CustomEvent('hangar:changed'));
  }

  triggerCurrencyUpdate();
}


function onDragKey(e) {
  if (e.key === 'Escape' && activeDrag) {
    e.preventDefault();
    const drag = activeDrag;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('keydown', onDragKey);
    activeDrag = null;
    clearHighlights();
    drag.ghost.remove();
    commitRevert(drag);
  }
  if (e.key.toLowerCase() === 'r' && activeDrag) {
    e.preventDefault();
    rotateGhost();
  }
}

function commitRevert(drag) {
  drag.item.col = drag.orig.col;
  drag.item.row = drag.orig.row;
  drag.item.rotated = drag.orig.rotated;

  rerenderAllForInventory(drag.orig.inv.items);

  if (drag.ghost && drag.ghost.parentNode) {
    drag.ghost.remove();
  }
}

function findHardwareSlotFor(consoleItem, item) {
  const slotOrder = ['cdSlot', 'cpu', 'ram', 'gpu', 'network', 'cooler'];
  for (const slotKey of slotOrder) {
    const rule = HARDWARE_SLOT_RULES[slotKey];
    if (rule && rule(item)) {
      const slotInv = consoleItem.hardware[slotKey];
      if (slotInv && findFreeSpot(slotInv, item.w, item.h)) {
        return slotKey;
      }
    }
  }
  return null;
}

/* -------------------------------------------------------------------
   Container Logic
   ------------------------------------------------------------------- */

/* Does `inv.items` belong to the subtree rooted at `item`?
   Used to prevent cycles (placing a container into its own grid or
   into the grid of one of its own descendants). */
function inventoryBelongsTo(item, inv) {
  if (!item || !inv) return false;
  if (item.internalItems === inv.items) return true;

  if (item.internalItems) {
    for (const child of item.internalItems) {
      if (inventoryBelongsTo(child, inv)) return true;
    }
  }

  if (item.hardware) {
    for (const slot of Object.values(item.hardware)) {
      if (!slot || !slot.items) continue;
      if (slot.items === inv.items) return true;
      for (const child of slot.items) {
        if (inventoryBelongsTo(child, inv)) return true;
      }
    }
  }

  return false;
}

function canPlaceInside(containerItem, incomingItem) {
  if (containerItem.locked) {
    return { ok: false, reason: 'This container is locked. Unlock it first.' };
  }
  
  if (containerItem.containerType === 'console') {
    return { ok: false, reason: 'This item cannot be auto-stored in the console. Open it and pick a slot manually.' };
  }

  if (containerItem.tags?.includes('ship_data') && incomingItem.containerType === 'console') {
    return { ok: false, reason: 'Cannot place a console inside a CD.' };
  }

  if (containerItem.tags?.includes('ship_data') && !isCDEquipped(containerItem)) {
    return { ok: false, reason: 'Equip this CD in a console to add items to its cargo.' };
  }

  if (containerItem.id === incomingItem.id) {
    return { ok: false, reason: 'Cannot place a container inside itself.' };
  }

  // Deeper cycle — incoming already contains the target somewhere in its tree
  if (inventoryBelongsTo(incomingItem, { items: containerItem.internalItems })) {
    return { ok: false, reason: 'Cannot place a container inside itself.' };
  }

  const incomingIsContainer = incomingItem.internalItems || incomingItem.containerType === 'console';
  const incomingIsCD = incomingItem.tags?.includes('ship_data');
  
  // Incoming CDs bypass allowedInside — any CD fits inside any container that
  // doesn't restrict via canStore. Non-CD containers still respect allowedInside.
  if (incomingIsContainer && !incomingIsCD) {
    if (Array.isArray(containerItem.allowedInside)) {
      if (containerItem.allowedInside.length === 0) {
        return { ok: false, reason: 'This container cannot hold other containers.' };
      }
      if (!containerItem.allowedInside.includes(incomingItem.key)) {
        return { ok: false, reason: `A ${incomingItem.name} cannot be placed inside.` };
      }
    }
  }
  
  if (containerItem.canStore) {
    const rules = containerItem.canStore;
    let allowed = false;
    if (rules.keys && rules.keys.includes(incomingItem.key)) allowed = true;
    if (!allowed && rules.categories && rules.categories.includes(incomingItem.category)) allowed = true;
    if (!allowed && rules.tags && rules.tags.some(t => incomingItem.tags.includes(t))) allowed = true;
    if (!allowed) return { ok: false, reason: 'This item cannot be stored in this container.' };
  }
  
  return { ok: true, reason: null };
}

function findContainerItemById(containerId) {
  const id = parseInt(containerId, 10);
  if (isNaN(id)) return null;

  function search(items) {
    for (const it of items) {
      if (it.id === id) return it;
      if (it.internalItems) {
        const found = search(it.internalItems);
        if (found) return found;
      }
    }
    return null;
  }

  for (const [gridId, entry] of registry) {
    const found = search(entry.inventory.items);
    if (found) return found;
  }
  return null;
}

function updateContainerParents(containerId) {
  const id = parseInt(containerId, 10);
  for (const [gridId, entry] of registry) {
    if (entry.inventory.items.some(it => it.id === id)) {
      renderGrid(gridId, entry.inventory);
      return;
    }
  }
}

function emptyContainer(containerItem, targetInv, targetGridId) {
  if (containerItem.containerType === 'console') {
    let movedCount = 0;
    const remaining = {};

    for (const [slotKey, slot] of Object.entries(containerItem.hardware)) {
      remaining[slotKey] = [];
      for (const innerItem of slot.items) {
        const spot = findFreeSpot(targetInv, innerItem.w, innerItem.h);
        if (spot) {
          innerItem.col = spot.col;
          innerItem.row = spot.row;
          innerItem.rotated = spot.rotated;
          targetInv.items.push(innerItem);
          movedCount++;
        } else {
          remaining[slotKey].push(innerItem);
        }
      }
    }

    // Mutate in place — never reassign the array
    for (const [slotKey, items] of Object.entries(remaining)) {
      const arr = containerItem.hardware[slotKey].items;
      arr.length = 0;
      arr.push(...items);
    }

    renderGrid(targetGridId, targetInv);
    updateContainerParents(containerItem.id);

    for (const [gid, entry] of registry) {
      if (gid.startsWith(`console-grid-${containerItem.id}-`)) {
        const slotKey = gid.replace(`console-grid-${containerItem.id}-`, '');
        entry.inventory.items = containerItem.hardware[slotKey]?.items || [];
        renderGrid(gid, entry.inventory);
      }
    }

    if (movedCount > 0 && Object.values(remaining).every(r => r.length === 0)) {
      alert(`Moved all ${movedCount} items to inventory.`);
    } else if (movedCount > 0) {
      alert(`Moved ${movedCount} items. Some did not fit and remain inside.`);
    } else {
      alert('No space in inventory to move items out.');
    }
    return;
  }

  if (!containerItem.internalItems || containerItem.internalItems.length === 0) return;

  let movedCount = 0;
  const remainingItems = [];

  for (const innerItem of containerItem.internalItems) {
    const spot = findFreeSpot(targetInv, innerItem.w, innerItem.h);
    if (spot) {
      innerItem.col = spot.col;
      innerItem.row = spot.row;
      innerItem.rotated = spot.rotated;
      targetInv.items.push(innerItem);
      movedCount++;
    } else {
      remainingItems.push(innerItem);
    }
  }

  // Mutate in place — never reassign the array
  containerItem.internalItems.length = 0;
  containerItem.internalItems.push(...remainingItems);

  renderGrid(targetGridId, targetInv);
  updateContainerParents(containerItem.id);

  for (const [gid, entry] of registry) {
    if (gid.startsWith(`container-${containerItem.id}-`)) {
      entry.inventory.items = containerItem.internalItems;
      renderGrid(gid, entry.inventory);
    }
  }
}

/* -------------------------------------------------------------------
   Hit Testing & Highlights
   ------------------------------------------------------------------- */

export function hitTestGrids(clientX, clientY) {
  let bestHit = null;
  for (const [gridId, entry] of registry) {
    const r = entry.el.getBoundingClientRect();
    if (clientX >= r.left - CELL * 0.5 && clientX <= r.right + CELL * 0.5 && 
        clientY >= r.top - CELL * 0.5 && clientY <= r.bottom + CELL * 0.5) {
        if (gridId.startsWith('container-') || gridId.startsWith('console-grid-')) return { gridId, entry };
      if (!bestHit) bestHit = { gridId, entry };
    }
  }
  return bestHit;
}

function updateDropHighlight(clientX, clientY) {
  clearHighlights();
  if (!activeDrag) return;
  const hit = hitTestGrids(clientX, clientY);
  if (!hit) return;
  const toInv = hit.entry.inventory;
  const d = itemDims(activeDrag.item);
  const tgRect = hit.entry.el.getBoundingClientRect();
  const targetCellSize = hit.entry.cellSize || CELL;
  let col = Math.round((clientX - tgRect.left - activeDrag.grabOffsetX) / targetCellSize);
  let row = Math.round((clientY - tgRect.top  - activeDrag.grabOffsetY) / targetCellSize);
  col = Math.max(0, Math.min(toInv.cols - d.w, col));
  row = Math.max(0, Math.min(toInv.rows - d.h, row));
  const valid = inBounds(toInv, { ...activeDrag.item, col, row }) && !overlaps(toInv, { ...activeDrag.item, col, row }, activeDrag.item.id);
  highlightCells(hit.entry.el, col, row, d.w, d.h, valid ? 'valid' : 'invalid');
}

function clearHighlights() { document.querySelectorAll('.cell.valid, .cell.invalid').forEach(c => c.classList.remove('valid', 'invalid')); }
function highlightCells(gridEl, col, row, w, h, cls) {
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) {
    const cell = gridEl.querySelector(`.cell[data-col="${c}"][data-row="${r}"]`);
    if (cell) cell.classList.add(cls);
  }
}

/* -------------------------------------------------------------------
   Context Menu
   ------------------------------------------------------------------- */

let contextMenuEl = null;
let contextMenuCleanup = null;

function openContextMenu(gridId, itemId, clientX, clientY) {
  closeContextMenu();
  const entry = registry.get(gridId);
  if (!entry) return;
  const item = entry.inventory.items.find(it => it.id === itemId);
  if (!item) return;

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  const isContainer = item.internalItems || item.containerType === 'console';
  const isCD = item.tags?.includes('ship_data');
  
  if (isContainer) {
    if (item.locked) {
      const unlockBtn = document.createElement('button');
      unlockBtn.className = 'ctx-item';
      unlockBtn.textContent = 'Unlock';
      unlockBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        closeContextMenu();
        unlockContainer(item);
      });
      menu.appendChild(unlockBtn);
    } else if (!isCD) {
      // Only non-CD containers can open as floating windows.
      // CDs are viewed through the ship cargo grid (storage view) and
      // the in-game inventory — never a separate floating container.
      const openBtn = document.createElement('button');
      openBtn.className = 'ctx-item';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        closeContextMenu();
        openContainerWindow(item);
      });
      menu.appendChild(openBtn);
    }
  }

  if (isContainer && !item.locked && !isCD) {
    const hasItems = item.containerType === 'console'
      ? Object.values(item.hardware || {}).some(s => s.items.length > 0)
      : (item.internalItems && item.internalItems.length > 0);

    if (hasItems) {
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'ctx-item';
      emptyBtn.textContent = 'Empty Container';
      emptyBtn.addEventListener('click', (e) => {
        e.stopPropagation(); closeContextMenu(); emptyContainer(item, entry.inventory, gridId);
      });
      menu.appendChild(emptyBtn);
    }
  }

  if (item.tags?.includes('console')) {
    const equipBtn = document.createElement('button');
    equipBtn.className = 'ctx-item';
    equipBtn.textContent = 'Equip Console';
    equipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContextMenu();
      
      if (state.activeConsole) {
        alert('A console is already equipped. Unload it first from the Hangar.');
        return;
      }
      
      const idx = entry.inventory.items.indexOf(item);
      if (idx !== -1) entry.inventory.items.splice(idx, 1);
      
      function removeFromList(list) {
        if (!Array.isArray(list)) return false;
        const i = list.indexOf(item);
        if (i !== -1) { list.splice(i, 1); return true; }
        for (const it of list) {
          if (it.internalItems && removeFromList(it.internalItems)) return true;
        }
        return false;
      }
      removeFromList(state.stash.items);
      
      state.activeConsole = item;
      window.dispatchEvent(new CustomEvent('hangar:changed'));
      renderGrid(gridId, entry.inventory);
      showToast(`Equipped ${item.name}`, { type: 'success', icon: '✓' });
    });
    menu.appendChild(equipBtn);
  }
  
  if (item.tags?.includes('vr_headset')) {
    const equipBtn = document.createElement('button');
    equipBtn.className = 'ctx-item';
    equipBtn.textContent = 'Equip Headset';
    equipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContextMenu();
      
      if (state.activeVR) {
        alert('A headset is already equipped. Unload it first from the Hangar.');
        return;
      }
      
      const idx = entry.inventory.items.indexOf(item);
      if (idx !== -1) entry.inventory.items.splice(idx, 1);
      
      function removeFromList(list) {
        if (!Array.isArray(list)) return false;
        const i = list.indexOf(item);
        if (i !== -1) { list.splice(i, 1); return true; }
        for (const it of list) {
          if (it.internalItems && removeFromList(it.internalItems)) return true;
        }
        return false;
      }
      removeFromList(state.stash.items);
      
      state.activeVR = item;
      window.dispatchEvent(new CustomEvent('hangar:changed'));
      renderGrid(gridId, entry.inventory);
      showToast(`Equipped ${item.name}`, { type: 'success', icon: '✓' });
    });
    menu.appendChild(equipBtn);
  }

  const descBtn = document.createElement('button');
  descBtn.className = 'ctx-item';
  descBtn.textContent = 'Description';
  descBtn.addEventListener('click', (e) => {
    e.stopPropagation(); closeContextMenu(); openItemDescription(item);
  });
  menu.appendChild(descBtn);

  if (item.count > 1) {
    const splitBtn = document.createElement('button');
    splitBtn.className = 'ctx-item';
    splitBtn.textContent = 'Split in half';
    splitBtn.addEventListener('click', (e) => {
      e.stopPropagation(); closeContextMenu();
      const pending = prepareSplit(gridId, item.id);
      if (pending) holdOnCursor(pending);
    });
    menu.appendChild(splitBtn);

    const takeBtn = document.createElement('button');
    takeBtn.className = 'ctx-item';
    takeBtn.textContent = 'Take one';
    takeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); closeContextMenu();
      const pending = prepareTakeOne(gridId, item.id);
      if (pending) holdOnCursor(pending);
    });
    menu.appendChild(takeBtn);
  }

  // ---- Sell (stash-only) ----
  const sellable =
    gridId === 'stash-grid' &&
    !(item.internalItems && item.internalItems.length > 0) &&
    !(item.containerType === 'console' &&
      Object.values(item.hardware || {}).some(s => s.items.length > 0));

  if (sellable) {
    const baseValue = item.value?.credits || 0;
    const sellPrice = Math.floor(baseValue * (state.market?.prices?.[item.key] ?? 1)) * (item.count || 1);

    const sellBtn = document.createElement('button');
    sellBtn.className = 'ctx-item';

    if (sellPrice <= 0) {
      sellBtn.disabled = true;
      sellBtn.textContent = 'Cannot Sell';
      sellBtn.style.opacity = '0.4';
      sellBtn.style.cursor = 'not-allowed';
    } else {
      const label = item.count > 1 ? `Sell ${item.count}×` : 'Sell';
      sellBtn.textContent = `${label} (${sellPrice.toLocaleString()} CR)`;
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeContextMenu();

        const idx = entry.inventory.items.indexOf(item);
        if (idx !== -1) entry.inventory.items.splice(idx, 1);

        state.credits = (state.credits || 0) + sellPrice;
        window.dispatchEvent(new CustomEvent('currency:delta', {
          detail: { type: 'credits', delta: sellPrice },
        }));
        triggerCurrencyUpdate();

        renderGrid(gridId, entry.inventory);

        showToast(
          `Sold ${item.count}× ${item.name} · +${sellPrice.toLocaleString()} CR`,
          { type: 'success', icon: '＋' },
        );
      });
    }
    menu.appendChild(sellBtn);
  }

  const dropBtn = document.createElement('button');
  dropBtn.className = 'ctx-item ctx-danger';
  dropBtn.textContent = 'Drop Item';
  dropBtn.addEventListener('click', (e) => {
    e.stopPropagation(); closeContextMenu();

    // Contract items can't be dropped without failing the contract
    if (item._contractItem) {
      if (!confirm(`Drop "${item.name}"?\n\nThis is a contract item. Dropping it will FAIL the active delivery contract.`)) return;
      const idx = entry.inventory.items.indexOf(item);
      if (idx !== -1) entry.inventory.items.splice(idx, 1);
      renderGrid(gridId, entry.inventory);
      triggerCurrencyUpdate();
      window.dispatchEvent(new CustomEvent('contract:item-lost', {
        detail: { contractId: item._contractItem },
      }));
      return;
    }

    if (!confirm(`Drop "${item.name}"?`)) return;
    const idx = entry.inventory.items.indexOf(item);
    if (idx !== -1) entry.inventory.items.splice(idx, 1);
    renderGrid(gridId, entry.inventory);
    triggerCurrencyUpdate();

    if (item.tags?.includes('ship_data')) {
      const activeConsole = findActiveConsole();
      if (activeConsole?.hardware?.cdSlot?.items?.some(i => i.id === item.id)) {
        for (const [gid, entry2] of registry) {
          if (gid.startsWith(`console-grid-${activeConsole.id}-`)) renderGrid(gid, entry2.inventory);
          if (gid === 'stash-grid') renderGrid(gid, entry2.inventory);
        }
      }
    }
  });
  menu.appendChild(dropBtn);

  document.body.appendChild(menu);
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.min(clientX, window.innerWidth - mw - 6) + 'px';
  menu.style.top = Math.min(clientY, window.innerHeight - mh - 6) + 'px';
  contextMenuEl = menu;

  setTimeout(() => {
    const onDocMousedown = (ev) => { if (!menu.contains(ev.target)) closeContextMenu(); };
    document.addEventListener('mousedown', onDocMousedown, true);
    contextMenuCleanup = () => document.removeEventListener('mousedown', onDocMousedown, true);
    document.addEventListener('keydown', closeOnEsc, { once: true });
  }, 0);
}

function closeContextMenu() {
  if (contextMenuCleanup) { contextMenuCleanup(); contextMenuCleanup = null; }
  if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; }
}
function closeOnEsc(e) { if (e.key === 'Escape') closeContextMenu(); }

/* -------------------------------------------------------------------
   Cursor-Held Item (Split / Take One)
   ------------------------------------------------------------------- */

let heldItem = null;

export function holdOnCursor(pending) {
  if (heldItem) cancelHeld();
  if (!pending) return;

  const cellSize = pending.sourceCellSize || CELL;

  const ghost = document.createElement('div');
  ghost.className = 'item dragging held';
  ghost.style.position = 'fixed';
  applyItemVisual(ghost, pending.piece, undefined, undefined, cellSize);
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = pending.piece.name;
  ghost.appendChild(name);
  if (pending.piece.count > 1) {
    const c = document.createElement('div');
    c.className = 'count';
    c.textContent = pending.piece.count;
    ghost.appendChild(c);
  }
  document.body.appendChild(ghost);

  heldItem = { ...pending, ghost, cellSize };
  document.addEventListener('mousemove', onHeldMove);
  document.addEventListener('mousedown', onHeldClick, true);
  document.addEventListener('keydown', onHeldKey);
}

function onHeldMove(e) {
  if (!heldItem) return;
  const { ghost, piece, cellSize } = heldItem;
  const w = piece.w * cellSize - 2;
  const h = piece.h * cellSize - 2;
  ghost.style.left = (e.clientX - w / 2) + 'px';
  ghost.style.top  = (e.clientY - h / 2) + 'px';
  clearHighlights();

  const hit = hitTestGrids(e.clientX, e.clientY);
  if (!hit) return;
  const toInv = hit.entry.inventory;
  const targetCellSize = hit.entry.cellSize || CELL;
  const tgRect = hit.entry.el.getBoundingClientRect();
  let col = Math.round((e.clientX - tgRect.left - w / 2) / targetCellSize);
  let row = Math.round((e.clientY - tgRect.top  - h / 2) / targetCellSize);
  col = Math.max(0, Math.min(toInv.cols - piece.w, col));
  row = Math.max(0, Math.min(toInv.rows - piece.h, row));
  const valid = inBounds(toInv, { ...piece, col, row }) && !overlaps(toInv, { ...piece, col, row }, piece.id);
  highlightCells(hit.entry.el, col, row, piece.w, piece.h, valid ? 'valid' : 'invalid');
}

function onHeldClick(e) {
  if (!heldItem) return;

  const hit = hitTestGrids(e.clientX, e.clientY);
  if (!hit) { cancelHeld(); return; }

  const { piece, sourceGridId, commit, cellSize } = heldItem;
  const toInv = hit.entry.inventory;

  // IMPORTANT CHECK, DO NOT REMOVE: Cannot place a container inside itself.
  if (inventoryBelongsTo(piece, toInv)) {
    cancelHeld();
    alert('Cannot place a container inside itself.');
    return;
  }

  const targetCellSize = hit.entry.cellSize || CELL;
  const tgRect = hit.entry.el.getBoundingClientRect();
  const w = piece.w * cellSize - 2;
  const h = piece.h * cellSize - 2;

  let col = Math.round((e.clientX - tgRect.left - w / 2) / targetCellSize);
  let row = Math.round((e.clientY - tgRect.top  - h / 2) / targetCellSize);
  col = Math.max(0, Math.min(toInv.cols - piece.w, col));
  row = Math.max(0, Math.min(toInv.rows - piece.h, row));

  const valid = inBounds(toInv, { ...piece, col, row }) && !overlaps(toInv, { ...piece, col, row }, piece.id);
  if (!valid) return;

  if (hit.gridId.startsWith('container-')) {
    const containerId = parseInt(hit.gridId.split('-')[1], 10);
    const containerItem = findContainerItemById(containerId);
    
    if (containerItem?.tags?.includes('ship_data') && !isCDEquipped(containerItem)) {
      renderGrid(hit.gridId, toInv);
      alert('Equip this CD in a console to add items to its cargo.');
      return;
    }
    
    if (containerItem) {
      const check = canPlaceInside(containerItem, piece);
      if (!check.ok) {
        renderGrid(hit.gridId, toInv);
        alert(check.reason);
        return;
      }
    }
    
    if (containerItem?.tags?.includes('ship_data')) {
      const activeConsole = findActiveConsole();
      if (activeConsole?.hardware?.cdSlot?.items?.some(i => i.id === containerItem.id)) {
        for (const [gid, entry] of registry) {
          if (gid.startsWith(`console-grid-${activeConsole.id}-`)) {
            renderGrid(gid, entry.inventory);
          }
        }
      }
      for (const [gid, entry] of registry) {
        if (gid === 'stash-grid') {
          renderGrid(gid, entry.inventory);
        }
      }
    }
  }

  const slotKey = parseHardwareSlotFromGridId(hit.gridId);
  if (slotKey) {
    const rule = HARDWARE_SLOT_RULES[slotKey];
    if (rule && !rule(piece)) {
      renderGrid(hit.gridId, toInv);
      alert(`This item doesn't belong in the ${slotKey.toUpperCase()} slot.`);
      return;
    }
  }

  clearHeld();
  commit();
  piece.col = col;
  piece.row = row;
  toInv.items.push(piece);

  const srcEntry = registry.get(sourceGridId);
  if (srcEntry) renderGrid(sourceGridId, srcEntry.inventory);
  renderGrid(hit.gridId, toInv);

  if (hit.gridId.startsWith('container-')) {
    const containerId = hit.gridId.split('-')[1];
    updateContainerParents(containerId);
  }
  
  if (hit.gridId.startsWith('console-grid-')) {
    const containerId = hit.gridId.split('-')[2];
    updateContainerParents(containerId);
  }

  if (slotKey) {
    window.dispatchEvent(new CustomEvent('hangar:changed'));
  }

  triggerCurrencyUpdate();
}


function onHeldKey(e) { if (e.key === 'Escape' && heldItem) { e.preventDefault(); cancelHeld(); } }
function cancelHeld() { if (heldItem) clearHeld(); }
function clearHeld() {
  if (!heldItem) return;
  heldItem.ghost.remove();
  document.removeEventListener('mousemove', onHeldMove);
  document.removeEventListener('mousedown', onHeldClick, true);
  document.removeEventListener('keydown', onHeldKey);
  clearHighlights();
  heldItem = null;
}