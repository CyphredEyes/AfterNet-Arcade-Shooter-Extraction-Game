/* ===================================================================
   IDB save backend — pure.

   This file has ZERO awareness of:
     - which slot is "current"
     - autosave timing
     - legacy migration
     - HTTP vs IDB choice

   Those concerns live in saveBackend.js, which is the only file
   the app talks to. This file is importable by saveBackend.js alone.
   =================================================================== */

import { serialize, deserialize } from '../core/saveFile.js';

const DB_NAME    = 'greenhorizon_saves';
const DB_VERSION = 1;
const STORE      = 'slots';
const SLOT_COUNT = 3;

let db = null;

/* -------------------------------------------------------------------
   Init
   ------------------------------------------------------------------- */
export async function initIdb() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'slotId' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror   = () => reject(req.error);
  });
}

/* -------------------------------------------------------------------
   List
   ------------------------------------------------------------------- */
export async function listSlots() {
  if (!db) {
    return Array.from({ length: SLOT_COUNT }, (_, id) => ({ slotId: id, empty: true }));
  }

  const all = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });

  const byId = Object.fromEntries(all.map(s => [s.slotId, s]));
  return Array.from({ length: SLOT_COUNT }, (_, id) => {
    const rec = byId[id];
    // A slot is only "occupied" if it has both bytes and meta.
    // Stale records from previous versions (missing meta) are treated
    // as empty so the UI can't crash on them.
    if (!rec || !rec.meta || !rec.bytes) return { slotId: id, empty: true };
    return { slotId: id, empty: false, meta: rec.meta };
  });
}

/* -------------------------------------------------------------------
   Load
   ------------------------------------------------------------------- */
export async function loadSlot(slotId) {
  if (!db) throw new Error('Save system unavailable.');

  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(slotId);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });

  if (!record) throw new Error(`Slot ${slotId + 1} is empty.`);
  return deserialize(record.bytes);
}

/* -------------------------------------------------------------------
   Save
   ------------------------------------------------------------------- */
export async function saveSlot(slotId, gameState) {
  if (!db) throw new Error('Save system unavailable.');

  const bytes = await serialize(gameState);

  const prev = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(slotId);
    req.onsuccess = () => resolve(req.result);
  });

  const now = Date.now();
  const meta = {
    slotId,
    name:           `Slot ${slotId + 1}`,
    createdAt:      prev?.meta?.createdAt || now,
    updatedAt:      now,
    credits:        gameState.credits        || 0,
    corpThreat:     gameState.corpThreat     || 0,
    raidsCompleted: gameState.raidsCompleted || 0,
    raidsFailed:    gameState.raidsFailed    || 0,
    sectorsCleared: gameState.sectorsCleared || 0,
    itemCount:      countItems(gameState.stash?.items || []),
    size:           bytes.length,
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ slotId, bytes, meta });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });

  return meta;
}

/* -------------------------------------------------------------------
   Delete
   ------------------------------------------------------------------- */
export async function deleteSlot(slotId) {
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(slotId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/* -------------------------------------------------------------------
   Helper
   ------------------------------------------------------------------- */
function countItems(items) {
  let n = 0;
  for (const it of items) {
    n += it.count || 1;
    if (it.internalItems) n += countItems(it.internalItems);
    if (it.hardware) {
      for (const slot of Object.values(it.hardware)) {
        n += countItems(slot.items || []);
      }
    }
  }
  return n;
}