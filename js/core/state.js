import { createInventory } from '../systems/grid-core.js';
import { createInitialMarketState, advanceMarketAfterRaid } from '../systems/marketSystem.js';
import { ensureNextItemIdAbove } from '../data/itemDB.js';
import { BLUEPRINTS } from '../data/itemDB.js';



export const state = {
  stash: createInventory(22, 15), // MUST CHANGE EVERY CREATE INVENTORY OCURRENCE WHEN MAKING BIGGER
  ships: [],
  activeShipId: null,
  credits: 0,
  activeConsole: null,
  activeVR: null,
  activeOverlay: null,
  pendingLoot: null,
  viewedPacketId: null,

  corpThreat:     0,
  sectorsCleared: 0,
  raidsCompleted: 0,
  raidsFailed:    0,

  market:         createInitialMarketState(),
  currentSector:  null,
  lastExtraction: null,

  raidActive:     false,
  hasMasterKey: false,

  market:         createInitialMarketState(),

  contacts:        null,
  activeContracts: [],    // global + private, NOT story
  currentContract: null,  // private contract being played
  storyProgress:   {},    // { missionId: { currentStage, progressThisRaid } }
  globalEffects:   [],    // recomputed per raid — not persisted

  missionHistory:  [],
  contractHistory: [],


};

// Initialize contacts state
if (!state.contacts) {
  state.contacts = {
    rook: { reputation: 0, market: null, completedMissions: [] },
    volt: { reputation: 0, market: null, completedMissions: [] },
    iris: { reputation: 0, market: null, completedMissions: [] },
  };
}

function makeDefaultContactsState() {
  return {
    rook: { reputation: 0, market: null, completedMissions: [], contractExpiry: {} },
    volt: { reputation: 0, market: null, completedMissions: [], contractExpiry: {} },
    iris: { reputation: 0, market: null, completedMissions: [], contractExpiry: {} },
  };
}

if (!state.contacts) state.contacts = makeDefaultContactsState();
if (!state.storyProgress) state.storyProgress = {};

export function getActiveShip() {
  return state.ships.find(s => s.id === state.activeShipId) || null;
}

/* -------------------------------------------------------------------
   Item-tree walker — for advancing nextItemId on load
   ------------------------------------------------------------------- */
function walkItemTree(rootItem, visit) {
  if (!rootItem || typeof rootItem !== 'object') return;
  visit(rootItem);
  if (Array.isArray(rootItem.internalItems)) {
    for (const child of rootItem.internalItems) walkItemTree(child, visit);
  }
  if (rootItem.hardware && typeof rootItem.hardware === 'object') {
    for (const slot of Object.values(rootItem.hardware)) {
      if (slot && Array.isArray(slot.items)) {
        for (const child of slot.items) walkItemTree(child, visit);
      }
    }
  }
}

function advanceItemIdsFromState(s) {
  let maxId = 0;
  const visit = (it) => { if (it.id > maxId) maxId = it.id; };

  if (s.stash?.items) for (const it of s.stash.items) walkItemTree(it, visit);
  walkItemTree(s.activeConsole, visit);
  walkItemTree(s.activeVR, visit);

  if (maxId > 0) ensureNextItemIdAbove(maxId);
}

/* -------------------------------------------------------------------
   Apply a loaded save.

   Returns { recoveredFromRaid: boolean }. If true, the caller should
   show a "raid failed" message and trigger an immediate save — the
   save the player was mid-raid is treated as death: the equipped CD
   is destroyed (all loot wiped) and raidsFailed is incremented.
   ------------------------------------------------------------------- */
export function applyLoadedState(loaded) {
  // --- Contacts migration ---
  if (!loaded.contacts) {
    loaded.contacts = makeDefaultContactsState();
  }
  // Ensure contractExpiry exists on each contact
  for (const cid of Object.keys(loaded.contacts)) {
    if (!loaded.contacts[cid].contractExpiry) loaded.contacts[cid].contractExpiry = {};
    if (!Array.isArray(loaded.contacts[cid].completedMissions)) loaded.contacts[cid].completedMissions = [];
  }
  state.contacts = loaded.contacts;
  state.activeContracts = loaded.activeContracts || [];
  state.currentContract = loaded.currentContract || null;
  state.storyProgress = loaded.storyProgress || {};
  state.globalEffects = [];
  state.missionHistory  = loaded.missionHistory  || [];
  state.contractHistory = loaded.contractHistory || [];

  //

  state.credits        = loaded.credits        ?? 0;
  state.corpThreat     = loaded.corpThreat     ?? 0;
  state.sectorsCleared = loaded.sectorsCleared ?? 0;
  state.raidsCompleted = loaded.raidsCompleted ?? 0;
  state.raidsFailed    = loaded.raidsFailed    ?? 0;

  state.stash          = loaded.stash || createInventory(22, 15);
  state.ships          = loaded.ships || [];
  state.activeShipId   = loaded.activeShipId   ?? null;
  state.activeConsole  = loaded.activeConsole  ?? null;
  state.activeVR       = loaded.activeVR       ?? null;
  state.activeOverlay  = null;
  state.pendingLoot    = null;
  state.viewedPacketId = null;
  state.market         = loaded.market || createInitialMarketState();
  state.currentSector  = null;
  state.lastExtraction = null;
  

  // Advance item id counter past everything in the save — prevents
  // ID collisions with future makeItem() calls.
  advanceItemIdsFromState(state);

  // Mid-raid reload = death. Wipe the equipped CD and its cargo.
  const recoveredFromRaid = loaded.raidActive === true;
  if (recoveredFromRaid) {
    const consoleItem = state.activeConsole;
    if (consoleItem?.hardware?.cdSlot?.items) {
      consoleItem.hardware.cdSlot.items.length = 0;
    }
    state.raidsFailed += 1;
    advanceMarketAfterRaid(state.market);
  }

  state.raidActive = false;
  state.hasMasterKey = false;

  return { recoveredFromRaid };
}

export function resetToFreshState() {
  state.contacts = {
    rook: { reputation: 0, market: null, completedMissions: [] },
    volt: { reputation: 0, market: null, completedMissions: [] },
    iris: { reputation: 0, market: null, completedMissions: [] },
  };

  state.contacts = makeDefaultContactsState();
  state.activeContracts = [];
  state.currentContract = null;
  state.storyProgress = {};
  state.globalEffects = [];
  state.missionHistory  = [];
  state.contractHistory = [];

  state.stash          = createInventory(22, 15);
  state.ships          = [{ id: 1, name: 'Scout Frigate', class: 'Light Recon', color: '#3fb950' }];
  state.activeShipId   = 1;
  state.credits        = 0;
  state.activeConsole  = null;
  state.activeVR       = null;
  state.activeOverlay  = null;
  state.pendingLoot    = null;
  state.viewedPacketId = null;
  state.corpThreat     = 0;
  state.sectorsCleared = 0;
  state.raidsCompleted = 0;
  state.raidsFailed    = 0;
  state.market         = createInitialMarketState();
  state.currentSector  = null;
  state.lastExtraction = null;
  state.raidActive     = false;
  state.hasMasterKey = false;
  
}

export function getExtractionRate() {
  const total = state.raidsCompleted + state.raidsFailed;
  if (total === 0) return '—';
  return `${Math.round((state.raidsCompleted / total) * 100)}%`;
}

export function changeCredits(delta) {
  if (!delta) return;
  state.credits = Math.max(0, (state.credits || 0) + delta);
  window.dispatchEvent(new CustomEvent('currency:delta', { detail: { type: 'credits', delta } }));
  window.dispatchEvent(new CustomEvent('inventory:changed'));
}

export function saveCorpThreat()     { window.dispatchEvent(new CustomEvent('save:request')); }
export function saveSectorsCleared() { window.dispatchEvent(new CustomEvent('save:request')); }
export function saveRaidStats()      { window.dispatchEvent(new CustomEvent('save:request')); }
export function saveMarket()         { window.dispatchEvent(new CustomEvent('save:request')); }