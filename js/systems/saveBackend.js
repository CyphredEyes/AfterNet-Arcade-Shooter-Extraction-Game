/* ===================================================================
   Save router — picks HTTP or IDB, owns session + autosave.
   All app code calls into THIS file, never into saveSystem.js directly.
   =================================================================== */

import { state } from '../core/state.js';
import { createInitialMarketState } from './marketSystem.js';

import * as idb  from './saveSystem.js';
import * as http from './saveSystemHttp.js';

const SLOT_COUNT = 3;

let mode = 'detect';
let currentSlotId = null;
let autoSaveTimer = null;

/* -------------------------------------------------------------------
   Init
   ------------------------------------------------------------------- */
export async function initSaveSystem() {
  // 1. Detect backend
  if (await http.httpProbe()) {
    mode = 'http';
  } else if (typeof indexedDB !== 'undefined') {
    try { await idb.initIdb(); mode = 'idb'; }
    catch { mode = 'none'; }
  } else {
    mode = 'none';
  }
  console.log(`[save] backend: ${mode}`);

  // 2. Migration from legacy localStorage (only runs once)
  await migrateLegacy();

  // 3. Autosave listeners
  const events = [
    'inventory:changed',
    'currency:delta',
    'hangar:changed',
    'market:changed',
    'save:request',
  ];
  for (const ev of events) {
    window.addEventListener(ev, queueAutoSave);
  }

  // 4. Safety net every 30 s while a slot is active
  setInterval(() => {
    if (currentSlotId !== null && !autoSaveTimer) {
      forceAutoSave().catch(() => {});
    }
  }, 30_000);
}

export function getBackendMode() { return mode; }

/* -------------------------------------------------------------------
   Router — the app talks to this
   ------------------------------------------------------------------- */
export const saveBackend = {
  listSlots:  ()          => mode === 'http' ? http.httpListSlots()        : idb.listSlots(),
  loadSlot:   (slotId)    => mode === 'http' ? http.httpLoadSlot(slotId)   : idb.loadSlot(slotId),
  saveSlot:   (slotId, s) => mode === 'http' ? http.httpSaveSlot(slotId, s): idb.saveSlot(slotId, s),
  deleteSlot: (slotId)    => mode === 'http' ? http.httpDeleteSlot(slotId) : idb.deleteSlot(slotId),
};

/* -------------------------------------------------------------------
   Session slot — where autosaves go
   ------------------------------------------------------------------- */
export function setCurrentSlot(slotId) { currentSlotId = slotId; }
export function getCurrentSlot()       { return currentSlotId; }
export function clearCurrentSlot()     { currentSlotId = null; }

/* -------------------------------------------------------------------
   Autosave
   ------------------------------------------------------------------- */
export function queueAutoSave() {
  if (currentSlotId === null || mode === 'none') return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    autoSaveTimer = null;
    try { await saveBackend.saveSlot(currentSlotId, state); }
    catch (e) { console.error('[save] autosave failed:', e); }
  }, 500);
}

export async function forceAutoSave() {
  if (currentSlotId === null || mode === 'none') return;
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
  try { await saveBackend.saveSlot(currentSlotId, state); }
  catch (e) { console.error('[save] force-save failed:', e); }
}

/* -------------------------------------------------------------------
   Latest slot helper
   ------------------------------------------------------------------- */
export async function getLatestSlot() {
  const slots = await saveBackend.listSlots();
  const occupied = slots.filter(s => !s.empty);
  if (occupied.length === 0) return null;
  return occupied.reduce((a, b) =>
    b.meta.updatedAt > a.meta.updatedAt ? b : a,
  );
}

/* -------------------------------------------------------------------
   Legacy migration — runs at init, uses the ROUTER so it targets
   whichever backend was chosen
   ------------------------------------------------------------------- */
async function migrateLegacy() {
  const legacyKeys = [
    'gh_corp_threat', 'gh_sectors_cleared',
    'gh_raids_completed', 'gh_raids_failed', 'gh_market',
  ];
  const hasLegacy = legacyKeys.some(k => localStorage.getItem(k) !== null);
  if (!hasLegacy) return;

  const slots = await saveBackend.listSlots();
  const slot0Empty = slots.find(s => s.slotId === 0)?.empty;
  if (!slot0Empty) {
    legacyKeys.forEach(k => localStorage.removeItem(k));
    console.log('[save] Legacy localStorage cleared (slot 0 already used).');
    return;
  }

  let legacyMarket = null;
  try { legacyMarket = JSON.parse(localStorage.getItem('gh_market') || 'null'); } catch {}
  if (!legacyMarket) legacyMarket = createInitialMarketState();

  const legacy = {
    credits:        0,
    corpThreat:     parseInt(localStorage.getItem('gh_corp_threat')     || '0', 10),
    sectorsCleared: parseInt(localStorage.getItem('gh_sectors_cleared') || '0', 10),
    raidsCompleted: parseInt(localStorage.getItem('gh_raids_completed') || '0', 10),
    raidsFailed:    parseInt(localStorage.getItem('gh_raids_failed')    || '0', 10),
    stash:          { cols: 22, rows: 9, items: [] },
    ships:          [{ id: 1, name: 'Scout Frigate', class: 'Light Recon', color: '#3fb950' }],
    activeShipId:   1,
    activeConsole:  null,
    activeVR:       null,
    activeOverlay:  null,
    pendingLoot:    null,
    market:         legacyMarket,
    currentSector:  null,
    lastExtraction: null,
  };

  try {
    await saveBackend.saveSlot(0, legacy);
    legacyKeys.forEach(k => localStorage.removeItem(k));
    console.log('[save] Legacy progress migrated to slot 0.');
  } catch (e) {
    console.error('[save] Legacy migration failed:', e);
  }
}