/* ===================================================================
   Hangar UI
   =================================================================== */

import { state, getExtractionRate } from '../core/state.js';
import { getShipBlueprint } from '../data/spaceshipDB.js';
import { findFreeSpot, triggerCurrencyUpdate } from '../systems/grid-core.js';
import { showToast } from './toast.js';
import { openGameModeModal } from './gameMode.js';

export function renderHangar() {
  renderPilotPanel();
  renderInformationSystems();
}

/* -------------------------------------------------------------------
   Pilot panel
   ------------------------------------------------------------------- */
function renderPilotPanel() {
    const readyBtn = document.getElementById('readyBtn');
  if (readyBtn) {
    readyBtn.onclick = () => {
      const vr          = state.activeVR;
      const consoleItem = state.activeConsole;
      const cd          = consoleItem?.hardware?.cdSlot?.items?.[0];

      if (!vr)          return showToast('Equip a VR headset before launching.', { type: 'warning' });
      if (!consoleItem) return showToast('Equip a console before launching.', { type: 'warning' });
      if (!cd)          return showToast('Slot a CD into the console before launching.', { type: 'warning' });

      openGameModeModal();
    };
  }

  const statsEl = document.getElementById('pilotStats');
  if (!statsEl) return;

  statsEl.innerHTML = '';

  const addRow = (label, value, cls = '') => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML =
      `<span class="stat-label">${label}</span>` +
      `<span class="stat-value ${cls}">${value}</span>`;
    statsEl.appendChild(row);
  };

  addRow('Raids Completed',  state.raidsCompleted, 'text-green');
  addRow('Raids Failed',     state.raidsFailed,    'text-danger');
  addRow('Extraction Rate',  getExtractionRate(),  'text-green');
  addRow('Sectors Cleared',  state.sectorsCleared, 'text-green');
  addRow('Corp Threat',      `${state.corpThreat} / 5`,
         state.corpThreat >= 3 ? 'text-danger' : '');
}

/* -------------------------------------------------------------------
   Information systems (slots + stats + preview)
   ------------------------------------------------------------------- */
function renderInformationSystems() {
  const container = document.getElementById('informationSystemsHost');
  if (!container) return;
  container.innerHTML = '';

  const consoleItem = state.activeConsole;
  const vrItem      = state.activeVR;
  const cdItem      = consoleItem?.hardware?.cdSlot?.items?.[0] || null;

  let shipBlueprint = null;
  let unknownShip = false;
  if (cdItem && cdItem.shipKey) {
    shipBlueprint = getShipBlueprint(cdItem.shipKey);
    if (!shipBlueprint) unknownShip = true;
  }

  /* ---- Slot row ---- */
  const slotsRow = document.createElement('div');
  slotsRow.className = 'info-slots-row';

  slotsRow.appendChild(buildSlot({
    label: 'VR HEADSET',
    item: vrItem,
    onSwap: () => openSwapModal('vr'),
    onUnload: () => unloadVR(),
    color: '#8b949e',
  }));

  slotsRow.appendChild(buildSlot({
    label: 'CONSOLE',
    item: consoleItem,
    onSwap: () => openSwapModal('console'),
    onUnload: () => unloadConsole(),
    color: '#3fb950',
  }));

  slotsRow.appendChild(buildSlot({
    label: 'ACTIVE CD',
    item: cdItem,
    onSwap: () => openSwapModal('cd'),
    onUnload: () => unloadCD(),
    color: '#be00af',
  }));

  container.appendChild(slotsRow);

  /* ---- Stats block ---- */
  const statsBlock = document.createElement('div');
  statsBlock.className = 'info-stats-block';

  const baseStats = shipBlueprint
    ? shipBlueprint.baseStats
    : { attack: 0, defense: 0, speed: 0, firerate: 0, shieldDelay: 0, gunOverloadDelay: 0 };
  const finalStats = calculateStats(consoleItem, baseStats, vrItem);

  statsBlock.innerHTML = `
    <div class="stats-grid">
      <div class="stat-row"><span>Attack Power</span><span class="val">${finalStats.attack.toFixed(1)}</span></div>
      <div class="stat-row"><span>Defense</span><span class="val">${finalStats.defense.toFixed(1)}</span></div>
      <div class="stat-row"><span>Speed</span><span class="val">${finalStats.speed.toFixed(1)}</span></div>
      <div class="stat-row"><span>Fire Rate</span><span class="val">${finalStats.firerate.toFixed(1)}</span></div>
      <div class="stat-row"><span>Shield Delay</span><span class="val">${finalStats.shieldDelay.toFixed(2)}</span></div>
      <div class="stat-row"><span>Gun Overload Delay</span><span class="val">${finalStats.gunOverloadDelay.toFixed(2)}</span></div>
    </div>
  `;
  container.appendChild(statsBlock);

    // ===== BOTTOM: SHIP PREVIEW =====
  const previewText = shipBlueprint
    ? shipBlueprint.name.toUpperCase()
    : unknownShip
      ? 'UNKNOWN SHIP DATA'
      : 'NO CD SLOTTED';

  const preview = document.createElement('div');
  preview.className = 'info-ship-preview';

  if (shipBlueprint?.img) {
    preview.innerHTML = `
      <img class="ship-preview-img" src="${shipBlueprint.img}" alt="${previewText}"
           onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'ship-placeholder\\'>${previewText}</div>';">
    `;
  } else {
    preview.innerHTML = `
      <div class="ship-placeholder">
        ${previewText}
      </div>
    `;
  }
  container.appendChild(preview);
}

/* -------------------------------------------------------------------
   Slot card
   ------------------------------------------------------------------- */
function buildSlot({ label, item, onSwap, onUnload, color }) {
  const el = document.createElement('div');
  el.className = 'info-slot';

  const header = document.createElement('div');
  header.className = 'info-slot-header';
  header.innerHTML = `<span>${label}</span>`;

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '4px';

  if (item && onUnload) {
    const unloadBtn = document.createElement('button');
    unloadBtn.className = 'swap-btn';
    unloadBtn.textContent = 'UNLOAD';
    unloadBtn.addEventListener('click', onUnload);
    btnGroup.appendChild(unloadBtn);
  }

  if (onSwap) {
    const swapBtn = document.createElement('button');
    swapBtn.className = 'swap-btn';
    swapBtn.textContent = 'SWAP';
    swapBtn.addEventListener('click', onSwap);
    btnGroup.appendChild(swapBtn);
  }

  header.appendChild(btnGroup);
  el.appendChild(header);

  const body = document.createElement('div');
  body.className = 'info-slot-body';

  if (item) {
    body.style.borderLeftColor = item.color || color;
    const baseColor = item.color || color || '#3fb950';
    body.style.background = `radial-gradient(circle at center, ${baseColor}22 0%, transparent 70%)`;

    const img = document.createElement('img');
    img.className = 'info-slot-img';
    img.src = item.img || '/img/items/placeholder.png';
    img.alt = item.name;
    img.onerror = () => { img.style.display = 'none'; };
    body.appendChild(img);

    const name = document.createElement('div');
    name.className = 'info-slot-name';
    name.textContent = item.name;
    body.appendChild(name);
  } else {
    body.style.borderLeftColor = color;
    body.innerHTML = '<span class="empty-text">EMPTY</span>';
  }

  el.appendChild(body);
  return el;
}

/* -------------------------------------------------------------------
   Stat math
   ------------------------------------------------------------------- */
export function calculateStats(consoleItem, base, vrItem = null) {
  const stats = { ...base };

  // VR multipliers first
  if (vrItem?.stats?.multipliers) {
    for (const [key, value] of Object.entries(vrItem.stats.multipliers)) {
      if (stats[key] === undefined) continue;
      stats[key] *= value;
    }
  }

  if (!consoleItem || !consoleItem.hardware) return stats;

  const mult = {
    attack: 1, defense: 1, speed: 1,
    firerate: 1, shieldDelay: 1, gunOverloadDelay: 1,
  };

  for (const slot of Object.values(consoleItem.hardware)) {
    for (const item of slot.items) {
      if (!item.stats?.multipliers) continue;
      const count = item.count || 1;
      for (const [key, value] of Object.entries(item.stats.multipliers)) {
        if (mult[key] === undefined) continue;
        mult[key] *= Math.pow(value, count);
      }
    }
  }

  stats.attack           *= mult.attack;
  stats.defense          *= mult.defense;
  stats.speed            *= mult.speed;
  stats.firerate         *= mult.firerate;
  stats.shieldDelay      *= mult.shieldDelay;
  stats.gunOverloadDelay *= mult.gunOverloadDelay;

  return stats;
}

/* -------------------------------------------------------------------
   Stash helpers
   ------------------------------------------------------------------- */
function stashItem(item) {
  const spot = findFreeSpot(state.stash, item.w, item.h);
  if (!spot) return false;
  item.col = spot.col;
  item.row = spot.row;
  item.rotated = spot.rotated;
  state.stash.items.push(item);
  return true;
}

/* -------------------------------------------------------------------
   Unload
   ------------------------------------------------------------------- */
function unloadConsole() {
  const consoleItem = state.activeConsole;
  if (!consoleItem) return;

  const cdItem = consoleItem.hardware?.cdSlot?.items?.[0];
  if (cdItem && cdItem.internalItems && cdItem.internalItems.length > 0) {
    showToast('Cannot unload — the slotted CD still has cargo. Empty it first.', { type: 'warning' });
    return;
  }

  const spot = findFreeSpot(state.stash, consoleItem.w, consoleItem.h);
  if (!spot) {
    showToast('Cannot unload — no room in storage for the console.', { type: 'warning' });
    return;
  }

  consoleItem.col = spot.col;
  consoleItem.row = spot.row;
  consoleItem.rotated = spot.rotated;
  state.stash.items.push(consoleItem);

  state.activeConsole = null;

  window.dispatchEvent(new CustomEvent('hangar:changed'));
  triggerCurrencyUpdate();
  renderHangar();

  showToast(`Unloaded ${consoleItem.name}`, { type: 'success', icon: '✓' });
}

function unloadCD() {
  const consoleItem = state.activeConsole;
  if (!consoleItem) return;

  const cdItem = consoleItem.hardware?.cdSlot?.items?.[0];
  if (!cdItem) return;

  if (cdItem.internalItems && cdItem.internalItems.length > 0) {
    showToast('Cannot unload — the CD still has cargo. Empty it first.', { type: 'warning' });
    return;
  }

  if (!stashItem(cdItem)) {
    showToast('Cannot unload — no room in storage for the CD.', { type: 'warning' });
    return;
  }

  consoleItem.hardware.cdSlot.items.length = 0;

  window.dispatchEvent(new CustomEvent('hangar:changed'));
  triggerCurrencyUpdate();
  renderHangar();

  showToast(`Unloaded ${cdItem.name}`, { type: 'success', icon: '✓' });
}

function unloadVR() {
  const vrItem = state.activeVR;
  if (!vrItem) return;

  if (!stashItem(vrItem)) {
    showToast('Cannot unload — no room in storage for the headset.', { type: 'warning' });
    return;
  }

  state.activeVR = null;

  window.dispatchEvent(new CustomEvent('hangar:changed'));
  triggerCurrencyUpdate();
  renderHangar();

  showToast(`Unloaded ${vrItem.name}`, { type: 'success', icon: '✓' });
}

/* -------------------------------------------------------------------
   Swap modal
   ------------------------------------------------------------------- */
function openSwapModal(type) {
  const modal = document.getElementById('swapModal');
  const body  = document.getElementById('swapModalBody');
  const title = document.getElementById('swapModalTitle');
  body.innerHTML = '';

  title.textContent = `SELECT ${type.toUpperCase()}`;

  /* ---- Guards ---- */
  if (type === 'cd') {
    const consoleItem = state.activeConsole;
    if (!consoleItem || !consoleItem.hardware) {
      body.innerHTML = '<div class="empty-msg">Equip a console first to slot a CD.</div>';
      modal.classList.add('open');
      return;
    }
  }

  if (type === 'console') {
    const currentCD = state.activeConsole?.hardware?.cdSlot?.items?.[0];
    if (currentCD && currentCD.internalItems && currentCD.internalItems.length > 0) {
      body.innerHTML = '<div class="empty-msg">Cannot swap consoles while the slotted CD has cargo. Empty it first.</div>';
      modal.classList.add('open');
      return;
    }
  }

  /* ---- Candidate discovery ---- */
  const allStashItems = [];
  function scanItems(items) {
    if (!items) return;
    for (const it of items) {
      allStashItems.push(it);
      if (it.internalItems?.length) scanItems(it.internalItems);
    }
  }
  scanItems(state.stash.items);

  if (type === 'cd') {
    const active = state.activeConsole;
    for (const item of allStashItems) {
      if (item.tags?.includes('console') && item.hardware?.cdSlot?.items) {
        for (const cdItem of item.hardware.cdSlot.items) {
          if (active && item.id === active.id) continue;
          allStashItems.push(cdItem);
        }
      }
    }
  }

  const candidates = allStashItems.filter(item => {
    if (type === 'console') return item.tags?.includes('console');
    if (type === 'cd')      return item.tags?.includes('ship_data');
    if (type === 'vr')      return item.tags?.includes('vr_headset');
    return false;
  });

  if (candidates.length === 0) {
    body.innerHTML = '<div class="empty-msg">No compatible items found.</div>';
    modal.classList.add('open');
    return;
  }

  /* ---- Render cards ---- */
  const grid = document.createElement('div');
  grid.className = 'swap-grid';

  for (const item of candidates) {
    const card = document.createElement('div');
    card.className = 'swap-card';

    const img = document.createElement('img');
    img.src = item.img;
    img.onerror = () => img.style.display = 'none';
    card.appendChild(img);

    const name = document.createElement('div');
    name.className = 'swap-card-name';
    name.textContent = item.name;
    card.appendChild(name);

    if (type === 'cd' && item.shipKey) {
      const shipBp = getShipBlueprint(item.shipKey);
      if (shipBp) {
        const sub = document.createElement('div');
        sub.className = 'swap-card-sub';
        sub.textContent = shipBp.name;
        card.appendChild(sub);
      }
    }

    if (type === 'console') {
      const equippedCD = item.hardware?.cdSlot?.items?.[0];
      const sub = document.createElement('div');
      sub.className = 'swap-card-sub';
      sub.textContent = equippedCD ? `CD: ${equippedCD.name}` : 'No CD';
      card.appendChild(sub);
    }

    card.addEventListener('click', () => {
      if (type === 'vr')      doSwapVR(item);
      if (type === 'console') doSwapConsole(item);
      if (type === 'cd')      doSwapCD(item);

      closeSwapModal();
      renderHangar();
      triggerCurrencyUpdate();
    });

    grid.appendChild(card);
  }

  body.appendChild(grid);
  modal.classList.add('open');
}

/* -------------------------------------------------------------------
   Swap operations
   ------------------------------------------------------------------- */
function doSwapVR(item) {
  if (state.activeVR) {
    const spot = findFreeSpot(state.stash, state.activeVR.w, state.activeVR.h);
    if (!spot) {
      showToast('Cannot swap — no room in storage for the current headset.', { type: 'warning' });
      return;
    }
    state.activeVR.col = spot.col;
    state.activeVR.row = spot.row;
    state.activeVR.rotated = spot.rotated;
    state.stash.items.push(state.activeVR);
    state.activeVR = null;
  }

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
  showToast(`Equipped ${item.name}`, { type: 'success', icon: '✓' });
}

function doSwapConsole(item) {
  const currentConsole = state.activeConsole;
  if (currentConsole) {
    const currentCD = currentConsole.hardware?.cdSlot?.items?.[0];
    if (currentCD && currentCD.internalItems && currentCD.internalItems.length > 0) {
      showToast('Cannot swap consoles while the slotted CD has cargo. Empty it first.', { type: 'warning' });
      return;
    }

    const spot = findFreeSpot(state.stash, currentConsole.w, currentConsole.h);
    if (!spot) {
      showToast('Cannot swap — no room in storage for the current console.', { type: 'warning' });
      return;
    }

    currentConsole.col = spot.col;
    currentConsole.row = spot.row;
    currentConsole.rotated = spot.rotated;
    state.stash.items.push(currentConsole);
  }

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
  showToast(`Equipped ${item.name}`, { type: 'success', icon: '✓' });
}

function doSwapCD(item) {
  const consoleItem = state.activeConsole;
  if (!consoleItem || !consoleItem.hardware) return;

  const currentCD = consoleItem.hardware.cdSlot.items[0];
  if (currentCD && currentCD.internalItems && currentCD.internalItems.length > 0) {
    showToast('Cannot swap CDs while the current CD has cargo. Empty it first.', { type: 'warning' });
    return;
  }

  if (currentCD) {
    if (!stashItem(currentCD)) {
      showToast('Cannot swap — no room in storage for the current CD.', { type: 'warning' });
      return;
    }
    consoleItem.hardware.cdSlot.items.length = 0;
  }

  function removeFromList(list) {
    if (!Array.isArray(list)) return false;
    const i = list.indexOf(item);
    if (i !== -1) { list.splice(i, 1); return true; }
    for (const it of list) {
      if (it.internalItems && removeFromList(it.internalItems)) return true;
      if (it.hardware) {
        for (const slot of Object.values(it.hardware)) {
          if (removeFromList(slot.items)) return true;
        }
      }
    }
    return false;
  }
  removeFromList(state.stash.items);

  item.col = 0;
  item.row = 0;
  item.rotated = false;
  consoleItem.hardware.cdSlot.items.push(item);

  showToast(`Slotted ${item.name}`, { type: 'success', icon: '✓' });
}

/* -------------------------------------------------------------------
   Modal wiring
   ------------------------------------------------------------------- */
function closeSwapModal() {
  document.getElementById('swapModal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('swapModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeSwapModal);
});

window.addEventListener('hangar:changed', () => {
  const view = document.getElementById('view-hangar');
  if (view && view.classList.contains('active')) {
    setTimeout(() => renderHangar(), 0);
  }
});