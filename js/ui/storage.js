/* ===================================================================
   Storage UI — console + CD two-column loadout, stash below
   =================================================================== */

import { state } from '../core/state.js';
import {
  mountGrid, renderGrid, clearGridsByPrefix,
  findFreeSpot, triggerCurrencyUpdate,
} from '../systems/grid-core.js';
import { organizeInventory } from '../systems/grid-organize.js';
import {
  moveAllShipToStash,
  previewSellAll,
  executeSellAll,
} from '../systems/bulkActions.js';
import { showToast } from './toast.js';

const CONSOLE_SLOT_LABELS = {
  cdSlot:  'CD SLOT',
  cpu:     'CPU',
  ram:     'RAM',
  gpu:     'GPU',
  network: 'NETWORK',
  cooler:  'COOLER',
};

const CONSOLE_SLOT_ORDER = ['cdSlot', 'cpu', 'ram', 'gpu', 'network', 'cooler'];

export function renderStorage() {
  renderShipSection();
  renderStashSection();
}

/* -------------------------------------------------------------------
   Ship section — console (left) + CD cargo (right)
   ------------------------------------------------------------------- */
function renderShipSection() {
  const nameEl        = document.getElementById('selectedShipName');
  const consoleHost   = document.getElementById('consoleGridHost');
  const consoleActs   = document.getElementById('consoleColumnActions');
  const cdHost        = document.getElementById('shipGridHost');
  const cdTitleEl     = document.getElementById('cdColumnTitle');
  const cdActs        = document.getElementById('cdColumnActions');

  if (!consoleHost || !cdHost || !nameEl || !cdTitleEl) return;

  clearGridsByPrefix('storage-console-grid-');
  clearGridsByPrefix('cd-grid-');

  const consoleItem = state.activeConsole;
  const cdItem      = consoleItem?.hardware?.cdSlot?.items?.[0] || null;

  nameEl.textContent = 'LOADOUT';

  /* ---- Console column header buttons ---- */
  if (consoleActs) {
    consoleActs.innerHTML = '';
    if (consoleItem) {
      const unequipBtn = document.createElement('button');
      unequipBtn.className = 'action-btn';
      unequipBtn.textContent = 'UNEQUIP';
      unequipBtn.addEventListener('click', unequipConsole);
      consoleActs.appendChild(unequipBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'action-btn';
      removeBtn.textContent = 'REMOVE ALL';
      removeBtn.addEventListener('click', removeAllComponents);
      consoleActs.appendChild(removeBtn);
    }
  }

  /* ---- Console column body ---- */
  consoleHost.innerHTML = '';

  if (!consoleItem) {
    consoleHost.innerHTML = '<div class="empty-msg">No console equipped.</div>';
  } else if (!consoleItem.hardware) {
    consoleHost.innerHTML = '<div class="empty-msg">Console has no hardware slots.</div>';
  } else {
    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'console-slots-grid';
    consoleHost.appendChild(slotsWrap);

    const slotEntries = [];
    for (const slotKey of CONSOLE_SLOT_ORDER) {
      const slotInv = consoleItem.hardware[slotKey];
      if (!slotInv) continue;
      slotEntries.push({ slotKey, slotInv });
    }
    // Sort by cell-height so small slots pack on top, tall ones on bottom
    slotEntries.sort((a, b) => {
      if (a.slotInv.rows !== b.slotInv.rows) return a.slotInv.rows - b.slotInv.rows;
      return a.slotInv.cols - b.slotInv.cols;
    });

    for (const { slotKey, slotInv } of slotEntries) {
      const wrap = document.createElement('div');
      wrap.className = 'console-slot-wrap';

      const label = document.createElement('div');
      label.className = 'console-slot-label';
      label.textContent = CONSOLE_SLOT_LABELS[slotKey] || slotKey.toUpperCase();
      wrap.appendChild(label);

      const host = document.createElement('div');
      wrap.appendChild(host);
      slotsWrap.appendChild(wrap);

      mountGrid(
        `storage-console-grid-${consoleItem.id}-${slotKey}`,
        slotInv,
        host,
      );
    }
  }

  /* ---- CD column header buttons ---- */
  if (cdActs) {
    cdActs.innerHTML = '';
  }

  /* ---- CD column body ---- */
  cdHost.innerHTML = '';

  if (!cdItem) {
    cdTitleEl.textContent = 'CD CARGO';
    cdHost.innerHTML = '<div class="empty-msg">No CD slotted. Drag a CD into the CD SLOT on the left.</div>';
    return;
  }

  cdTitleEl.textContent = `CD CARGO · ${cdItem.name}`;

  const cdInv = {
    cols:  cdItem.internalCols,
    rows:  cdItem.internalRows,
    items: cdItem.internalItems,
  };

  if (cdActs) {
    const orgBtn = document.createElement('button');
    orgBtn.className = 'action-btn';
    orgBtn.textContent = 'ORGANIZE';
    orgBtn.addEventListener('click', () => {
      if (organizeInventory(cdInv)) {
        renderGrid(`cd-grid-${cdItem.id}`, cdInv);
      } else {
        showToast('Could not fit all items.', { type: 'warning' });
      }
    });
    cdActs.appendChild(orgBtn);

    const moveBtn = document.createElement('button');
    moveBtn.className = 'action-btn';
    moveBtn.textContent = 'MOVE ALL';
    moveBtn.addEventListener('click', onMoveAll);
    cdActs.appendChild(moveBtn);

    const sellBtn = document.createElement('button');
    sellBtn.className = 'action-btn';
    sellBtn.textContent = 'SELL ALL';
    sellBtn.addEventListener('click', onSellAllShip);
    cdActs.appendChild(sellBtn);
  }

  mountGrid(`cd-grid-${cdItem.id}`, cdInv, cdHost);
}

/* -------------------------------------------------------------------
   Stash section
   ------------------------------------------------------------------- */
function renderStashSection() {
  const gridHost = document.getElementById('stashGridHost');
  const orgBtn   = document.getElementById('organizeStashBtn');

  if (!gridHost) return;

  gridHost.innerHTML = '';
  const gridWrap = document.createElement('div');
  gridHost.appendChild(gridWrap);

  mountGrid('stash-grid', state.stash, gridWrap, { cellSize: 48 });

  if (orgBtn) {
    orgBtn.onclick = () => {
      if (organizeInventory(state.stash)) {
        renderGrid('stash-grid', state.stash);
      } else {
        showToast('Could not fit all items.', { type: 'warning' });
      }
    };
  }
}

/* -------------------------------------------------------------------
   Console actions
   ------------------------------------------------------------------- */
function unequipConsole() {
  const consoleItem = state.activeConsole;
  if (!consoleItem) return;

  const cdItem = consoleItem.hardware?.cdSlot?.items?.[0];
  if (cdItem && cdItem.internalItems && cdItem.internalItems.length > 0) {
    showToast('Cannot unequip — the slotted CD still has cargo. Empty it first.', { type: 'warning' });
    return;
  }

  const spot = findFreeSpot(state.stash, consoleItem.w, consoleItem.h);
  if (!spot) {
    showToast('Cannot unequip — no room in storage for the console.', { type: 'warning' });
    return;
  }

  consoleItem.col = spot.col;
  consoleItem.row = spot.row;
  consoleItem.rotated = spot.rotated;
  state.stash.items.push(consoleItem);
  state.activeConsole = null;

  showToast(`Unequipped ${consoleItem.name}`, { type: 'success', icon: '✓' });

  window.dispatchEvent(new CustomEvent('hangar:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));
  triggerCurrencyUpdate();
}

function removeAllComponents() {
  const consoleItem = state.activeConsole;
  if (!consoleItem?.hardware) return;

  let moved = 0;
  let remaining = 0;

  for (const slotKey of CONSOLE_SLOT_ORDER) {
    if (slotKey === 'cdSlot') continue;               // CD is handled separately
    const slot = consoleItem.hardware[slotKey];
    if (!slot || !Array.isArray(slot.items)) continue;

    const kept = [];
    for (const item of slot.items) {
      const spot = findFreeSpot(state.stash, item.w, item.h);
      if (spot) {
        item.col = spot.col;
        item.row = spot.row;
        item.rotated = spot.rotated;
        state.stash.items.push(item);
        moved++;
      } else {
        kept.push(item);
        remaining++;
      }
    }
    slot.items.length = 0;
    slot.items.push(...kept);
  }

  if (moved === 0 && remaining === 0) {
    showToast('No components to remove.', { type: 'info' });
    return;
  }

  if (remaining > 0) {
    showToast(
      `Moved ${moved} component${moved === 1 ? '' : 's'}. ${remaining} remained (stash full).`,
      { type: 'warning', icon: '⚠' },
    );
  } else {
    showToast(
      `Removed all ${moved} component${moved === 1 ? '' : 's'}.`,
      { type: 'success', icon: '✓' },
    );
  }

  window.dispatchEvent(new CustomEvent('hangar:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));
  triggerCurrencyUpdate();
}

/* -------------------------------------------------------------------
   CD actions
   ------------------------------------------------------------------- */
function onMoveAll() {
  const result = moveAllShipToStash();
  if (result.total === 0) {
    showToast('Ship cargo is empty.', { type: 'info' });
    return;
  }
  if (result.moved === 0) {
    showToast('No space in stash for any items.', { type: 'warning' });
    return;
  }
  if (result.moved < result.total) {
    showToast(`Moved ${result.moved} of ${result.total} — stash full.`, {
      type: 'warning', icon: '⚠',
    });
  } else {
    showToast(`Moved all ${result.moved} item${result.moved === 1 ? '' : 's'} to stash.`, {
      type: 'success', icon: '✓',
    });
  }
}

function onSellAllShip() {
  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (!cd || !cd.internalItems || cd.internalItems.length === 0) {
    showToast('Ship cargo is empty.', { type: 'info' });
    return;
  }

  const preview = previewSellAll(cd.internalItems);
  if (preview.sellable.length === 0) {
    showToast('No sellable items in ship cargo.', { type: 'warning' });
    return;
  }

  const count = preview.sellable.length;
  const total = preview.total.toLocaleString();
  const skippedLine = preview.skipped > 0
    ? `\n\n(${preview.skipped} item${preview.skipped === 1 ? '' : 's'} not sold: no credit value, or container has contents.)`
    : '';

  const ok = confirm(
    `Sell ${count} item stack${count === 1 ? '' : 's'} from ship cargo for ${total} CR?${skippedLine}`,
  );
  if (!ok) return;

  const sold = executeSellAll(cd.internalItems, preview);
  if (sold > 0) {
    showToast(`Sold ${sold} stack${sold === 1 ? '' : 's'} for ${total} CR.`, {
      type: 'success', icon: '+', duration: 2400,
    });
  }
}

/* -------------------------------------------------------------------
   Re-render on equipment / storage changes
   ------------------------------------------------------------------- */
function onStorageInvalidate() {
  const view = document.getElementById('view-storage');
  if (view && view.classList.contains('active')) {
    setTimeout(() => renderStorage(), 0);
  }
}

window.addEventListener('storage:changed', onStorageInvalidate);
window.addEventListener('hangar:changed',  onStorageInvalidate);