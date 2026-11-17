/* ===================================================================
   HTTP save backend — matches server.py's /saves/ routes.
   Returns the same shape as saveSystem.js so saveBrowser.js
   doesn't need to know which backend is active.
   =================================================================== */

import { serialize, deserialize } from '../core/saveFile.js';

const BASE = '/saves';

/* -------------------------------------------------------------------
   List
   ------------------------------------------------------------------- */
export async function httpListSlots() {
  const res = await fetch(`${BASE}/`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Save list failed (${res.status})`);

  const raw = await res.json();
  const result = [];

  for (const s of raw) {
    if (!s.size || s.size === 0) {
      result.push({ slotId: s.slotId, empty: true });
      continue;
    }

    // Fetch the full save to build a meta object.
    // Falls back to "empty" if the file is corrupt.
    try {
      const loaded = await httpLoadSlot(s.slotId);
      result.push({
        slotId: s.slotId,
        empty: false,
        meta: buildMetaFromState(s.slotId, loaded, s.size, s.mtime),
      });
    } catch (e) {
      console.warn(`[save] Slot ${s.slotId} unreadable:`, e);
      result.push({ slotId: s.slotId, empty: true });
    }
  }

  return result;
}

/* -------------------------------------------------------------------
   Load
   ------------------------------------------------------------------- */
export async function httpLoadSlot(slotId) {
  const res = await fetch(`${BASE}/${slotId}.ghsave`, { cache: 'no-store' });
  if (res.status === 404) throw new Error(`Slot ${slotId + 1} is empty.`);
  if (!res.ok) throw new Error(`Load failed (${res.status})`);
  const buf = await res.arrayBuffer();
  return deserialize(new Uint8Array(buf));
}

/* -------------------------------------------------------------------
   Save
   ------------------------------------------------------------------- */
export async function httpSaveSlot(slotId, state) {
  const bytes = await serialize(state);
  const res = await fetch(`${BASE}/${slotId}.ghsave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Save failed (${res.status})`);
}

/* -------------------------------------------------------------------
   Delete
   ------------------------------------------------------------------- */
export async function httpDeleteSlot(slotId) {
  const res = await fetch(`${BASE}/${slotId}.ghsave`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

/* -------------------------------------------------------------------
   Probe
   ------------------------------------------------------------------- */
export async function httpProbe() {
  try {
    const res = await fetch(`${BASE}/`, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch { return false; }
}

/* -------------------------------------------------------------------
   Helper — mirror saveSystem.js's meta shape
   ------------------------------------------------------------------- */
function buildMetaFromState(slotId, gameState, size, mtime) {
  return {
    slotId,
    name:           `Slot ${slotId + 1}`,
    createdAt:      mtime || Date.now(),
    updatedAt:      mtime || Date.now(),
    credits:        gameState.credits        || 0,
    corpThreat:     gameState.corpThreat     || 0,
    raidsCompleted: gameState.raidsCompleted || 0,
    raidsFailed:    gameState.raidsFailed    || 0,
    sectorsCleared: gameState.sectorsCleared || 0,
    itemCount:      countItems(gameState.stash?.items || []),
    size,
  };
}

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