/* ===================================================================
   Save browser — Load Game / New Game slot picker
   =================================================================== */

import { state, applyLoadedState, resetToFreshState } from '../core/state.js';
import { saveBackend, setCurrentSlot, forceAutoSave } from '../systems/saveBackend.js';
import { showToast } from './toast.js';

let pendingMode = 'load';
let onComplete  = null;

/* -------------------------------------------------------------------
   Public entry
   ------------------------------------------------------------------- */
export async function openSaveBrowser({ mode = 'load', onLoad } = {}) {
  pendingMode = mode;
  onComplete  = onLoad || null;

  const modal = document.getElementById('saveBrowserModal');
  const title = document.getElementById('saveBrowserTitle');
  const body  = document.getElementById('slotListBody');
  if (!modal || !title || !body) return;

  title.textContent = mode === 'new' ? 'SELECT SLOT — NEW GAME' : 'LOAD SAVE';

  body.innerHTML = '<div class="slot-loading">Reading slots…</div>';

  modal.classList.add('open');

  let slots;
  try { slots = await saveBackend.listSlots(); }
  catch (e) {
    body.innerHTML = '<div class="slot-loading">Could not read saves.</div>';
    console.error(e);
    return;
  }

  body.innerHTML = '';

  for (const slot of slots) {
    body.appendChild(buildSlotCard(slot, mode));
  }
}

/* -------------------------------------------------------------------
   Slot card
   ------------------------------------------------------------------- */
function buildSlotCard(slot, mode) {
  const card = document.createElement('div');
  card.className = 'slot-card' + (slot.empty ? ' empty' : '');

  if (slot.empty) {
    if (mode === 'load') {
      card.innerHTML = `
        <div class="slot-head">
          <span class="slot-name">SLOT ${slot.slotId + 1}</span>
          <span class="slot-status empty">EMPTY</span>
        </div>
        <div class="slot-preview">No save data.</div>
      `;
      card.classList.add('disabled');
      return card;
    }

    card.innerHTML = `
      <div class="slot-head">
        <span class="slot-name">SLOT ${slot.slotId + 1}</span>
        <span class="slot-status new">NEW GAME</span>
      </div>
      <div class="slot-preview">Start a fresh run in this slot.</div>
    `;
    card.addEventListener('click', () => startNewGameInSlot(slot.slotId));
    return card;
  }

  // Occupied
  const m = slot.meta;
  const updated = formatAgo(m.updatedAt);
  const sizeKb  = (m.size / 1024).toFixed(1);

  card.innerHTML = `
    <div class="slot-head">
      <span class="slot-name">SLOT ${slot.slotId + 1}</span>
      <span class="slot-status ${mode === 'new' ? 'overwrite' : 'ready'}">
        ${mode === 'new' ? 'OVERWRITE' : 'READY'}
      </span>
    </div>
    <div class="slot-stats">
      <span><b>${m.credits.toLocaleString()}</b> CR</span>
      <span><b>${m.raidsCompleted}</b> raids</span>
      <span><b>${m.sectorsCleared}</b> sectors</span>
      <span><b>${m.itemCount}</b> items</span>
    </div>
    <div class="slot-meta">${sizeKb} KB · ${updated}</div>
  `;

  card.addEventListener('click', () => {
    if (mode === 'new') {
      const ok = confirm(
        `Slot ${slot.slotId + 1} already contains a save. Overwrite it with a new game?\n\nThis cannot be undone.`,
      );
      if (!ok) return;
      startNewGameInSlot(slot.slotId);
    } else {
      loadSlotIntoState(slot.slotId);
    }
  });

  return card;
}

/* -------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------- */
async function startNewGameInSlot(slotId) {
  resetToFreshState();
  setCurrentSlot(slotId);

  try {
    await saveBackend.saveSlot(slotId, state);
    showToast(`Started new game in Slot ${slotId + 1}`, { type: 'success', icon: '✓' });
  } catch (e) {
    showToast('Could not save initial state.', { type: 'danger' });
  }

  closeBrowser();
  if (onComplete) onComplete();
}

async function loadSlotIntoState(slotId) {
  try {
    const loaded = await saveBackend.loadSlot(slotId);
    const info   = applyLoadedState(loaded);
    setCurrentSlot(slotId);

    if (info?.recoveredFromRaid) {
      // Mid-raid save → treated as death. CD already wiped by
      // applyLoadedState; force-save so the wipe persists immediately.
      await forceAutoSave();
      showToast(
        'Raid failed — connection lost. Loaded CD destroyed.',
        { type: 'danger', duration: 4500 },
      );
    } else {
      showToast(`Loaded Slot ${slotId + 1}`, { type: 'success', icon: '✓' });
    }

    closeBrowser();
    if (onComplete) onComplete();
  } catch (e) {
    showToast(`Load failed: ${e.message}`, { type: 'danger' });
    console.error(e);
  }
}

function closeBrowser() {
  document.getElementById('saveBrowserModal')?.classList.remove('open');
}

/* -------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------- */
function formatAgo(ts) {
  if (!ts) return '—';
  const ms = Date.now() - ts;
  const min = Math.floor(ms / 60_000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/* -------------------------------------------------------------------
   Modal close wiring
   ------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-close="saveBrowserModal"]').forEach(btn => {
    btn.addEventListener('click', closeBrowser);
  });
});