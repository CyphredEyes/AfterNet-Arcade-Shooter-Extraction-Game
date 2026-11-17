/* ===================================================================
   Contract system — story, global, private. Two-timer model.
   =================================================================== */

import { state } from '../core/state.js';
import { CONTACTS } from '../data/contactsDB.js';
import { adjustReputation } from './reputationSystem.js';
import { BLUEPRINTS, makeItem } from '../data/itemDB.js';
import { findFreeSpot } from './grid-core.js';

window.addEventListener('contract:item-lost', (e) => {
  const id = e.detail?.contractId;
  if (!id) return;
  const c = state.activeContracts.find(x => x.id === id);
  if (!c || c.state !== 'accepted') return;
  failContract(c, 'Contract item lost');
  stripContractItems(c);
});

window.addEventListener('contract:delivery-failed', (e) => {
  import('../ui/toast.js').then(({ showToast }) => {
    showToast(`Cannot deploy: ${e.detail.reason}`, { type: 'warning', duration: 4000 });
  });
});

/* ===================================================================
   INITIALIZATION — populate expiry timers on first access
   =================================================================== */
export function initContractExpiries() {
  for (const cid of Object.keys(CONTACTS)) {
    const contact = CONTACTS[cid];
    if (!state.contacts[cid].contractExpiry) state.contacts[cid].contractExpiry = {};

    for (const c of contact.contracts) {
      if (c.expiresInRaids == null) continue;
      if (!(c.id in state.contacts[cid].contractExpiry)) {
        state.contacts[cid].contractExpiry[c.id] = c.expiresInRaids;
      }
    }
  }
}

/* ===================================================================
   AVAILABILITY — story, global, private
   =================================================================== */
export function getAvailableStoryMissions(contactId) {
  const contact = CONTACTS[contactId];
  if (!contact) return [];
  const completed = state.contacts[contactId].completedMissions || [];

  return contact.missions
    .filter(m => !completed.includes(m.id))
    .filter(m => {
      const order = m.order || 0;
      return contact.missions
        .filter(x => (x.order || 0) < order)
        .every(x => completed.includes(x.id));
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getAvailableGlobalContracts(contactId) {
  const contact = CONTACTS[contactId];
  if (!contact) return [];
  const activeIds = new Set(state.activeContracts.map(c => c.id));
  const expiryMap = state.contacts[contactId].contractExpiry || {};

  return contact.contracts
    .filter(c => c.type === 'global')
    .filter(c => !activeIds.has(c.id))
    .filter(c => {
      if (c.expiresInRaids == null) return true;
      return (expiryMap[c.id] ?? c.expiresInRaids) > 0;
    });
}

export function getAvailablePrivateContracts(contactId) {
  const contact = CONTACTS[contactId];
  if (!contact) return [];
  const activeIds = new Set(state.activeContracts.map(c => c.id));
  const expiryMap = state.contacts[contactId].contractExpiry || {};

  return contact.contracts
    .filter(c => c.type === 'private')
    .filter(c => !activeIds.has(c.id))
    .filter(c => {
      if (c.expiresInRaids == null) return true;
      return (expiryMap[c.id] ?? c.expiresInRaids) > 0;
    });
}

export function getAllActiveContracts() {
  return state.activeContracts;
}

export function getActiveGlobalContracts() {
  return state.activeContracts.filter(c => c.type === 'global');
}

export function getActivePrivateContracts() {
  return state.activeContracts.filter(c => c.type === 'private');
}

/* ===================================================================
   ACCEPT / CANCEL
   =================================================================== */
export function acceptContract(contactId, template) {
  if (state.activeContracts.some(c => c.id === template.id)) return false;

  const runtime = JSON.parse(JSON.stringify(template));
  runtime.contactId = contactId;
  runtime.acceptedAtRaid = state.raidsCompleted;
  runtime.deadlineRemaining = template.deadlineRaids ?? Infinity;

  if (template.type === 'global') {
    const eff = template.globalEffect || {};
    runtime.effectState = {
      matchesRemaining: eff.matchesToApply || eff.totalTarget || 1,
      consecutiveSurvivals: 0,
      collected: 0,
      debtApplied: 0,
    };
  }

  if (template.type === 'private') {
    runtime.currentStage = 0;
    runtime.progressThisRaid = 0;
    runtime.stageAtRaidStart = 0;
    runtime.delivered = false;
  }

  runtime.state = 'accepted';
  state.activeContracts.push(runtime);

  // Remove this contract from the expiry map (it's no longer "available")
  if (state.contacts[contactId].contractExpiry) {
    delete state.contacts[contactId].contractExpiry[runtime.id];
  }

  window.dispatchEvent(new CustomEvent('contacts:changed'));
  return true;
}

export function cancelContract(contractId) {
  const idx = state.activeContracts.findIndex(c => c.id === contractId);
  if (idx === -1) return false;

  const c = state.activeContracts[idx];
  if (c.cancelable === false) return false;

  // Penalty for abandoning
  if (c.penalties?.reputation) {
    adjustReputation(c.contactId, c.penalties.reputation);
  }

  state.activeContracts.splice(idx, 1);
  if (state.currentContract?.id === contractId) {
    state.currentContract = null;
  }

  window.dispatchEvent(new CustomEvent('contacts:changed'));
  return true;
}

/* ===================================================================
   EVENT HOOKS — called from game systems
   Called for ALL active contracts AND all story progress
   =================================================================== */
export function onNodeKilled(nodeCategory) {
  for (const cid of Object.keys(CONTACTS)) {
    for (const m of CONTACTS[cid].missions) {
      const prog = state.storyProgress[m.id];
      if (!prog || prog.objectiveMet) continue;
      const stage = m.stages[prog.currentStage];
      if (!stage || stage.type !== 'destroy_nodes') continue;
      if (stage.nodeCategory && stage.nodeCategory !== nodeCategory) continue;

      prog.progressThisRaid = (prog.progressThisRaid || 0) + 1;
      if (prog.progressThisRaid >= stage.count) {
        prog.currentStage++;
        prog.progressThisRaid = 0;
        if (prog.currentStage >= m.stages.length) {
          prog.objectiveMet = true;
          window.dispatchEvent(new CustomEvent('contacts:changed'));
        }
      }
    }
  }

  const c = state.currentContract;
  if (c && !c.objectiveMet) {
    const stage = c.stages[c.currentStage];
    if (stage?.type === 'destroy_nodes') {
      if (!stage.nodeCategory || stage.nodeCategory === nodeCategory) {
        c.progressThisRaid = (c.progressThisRaid || 0) + 1;
        if (c.progressThisRaid >= stage.count) {
          c.currentStage++;
          c.progressThisRaid = 0;
          if (c.currentStage >= c.stages.length) c.objectiveMet = true;
        }
      }
    }
  }
}

export function onCoreKilled() {
  for (const cid of Object.keys(CONTACTS)) {
    for (const m of CONTACTS[cid].missions) {
      const prog = state.storyProgress[m.id];
      if (!prog || prog.objectiveMet) continue;
      const stage = m.stages[prog.currentStage];
      if (stage?.type === 'destroy_core') {
        prog.currentStage++;
        if (prog.currentStage >= m.stages.length) {
          prog.objectiveMet = true;
          window.dispatchEvent(new CustomEvent('contacts:changed'));
        }
      }
    }
  }

  const c = state.currentContract;
  if (c && !c.objectiveMet) {
    const stage = c.stages[c.currentStage];
    if (stage?.type === 'destroy_core') {
      c.currentStage++;
      if (c.currentStage >= c.stages.length) c.objectiveMet = true;
    }
  }
}

export function onDelivery(contract) {
  if (!contract) return;
  const stage = contract.stages[contract.currentStage];
  if (stage?.type === 'deliver') {
    contract.currentStage++;
    contract.delivered = true;
    if (contract.currentStage >= contract.stages.length) {
      contract.objectiveMet = true;
    }
    window.dispatchEvent(new CustomEvent('contacts:changed'));
  }
}

/* Called at extraction, before cargo wipe */
export function checkExtractionStoryProgress(cargoItems) {
  for (const cid of Object.keys(CONTACTS)) {
    for (const m of CONTACTS[cid].missions) {
      const prog = state.storyProgress[m.id];
      if (!prog || prog.objectiveMet) continue;
      const stage = m.stages[prog.currentStage];
      if (!stage) continue;

      // --- Existing: extract_items / extract_with (cargo-based) ---
      if (stage.type === 'extract_items') {
        if (countAll(cargoItems) >= stage.count) {
          prog.currentStage++;
          if (prog.currentStage >= m.stages.length) {
            prog.objectiveMet = true;
            window.dispatchEvent(new CustomEvent('contacts:changed'));
          }
        }
      } else if (stage.type === 'extract_with') {
        let n = 0;
        for (const it of cargoItems) if (it.key === stage.itemKey) n += (it.count || 1);
        if (n >= stage.count) {
          prog.currentStage++;
          if (prog.currentStage >= m.stages.length) {
            prog.objectiveMet = true;
            window.dispatchEvent(new CustomEvent('contacts:changed'));
          }
        }
      }

      // --- New: survive_raids (consecutive extractions, resets on death) ---
      else if (stage.type === 'survive_raids') {
        prog.consecutiveSurvivals = (prog.consecutiveSurvivals || 0) + 1;
        if (prog.consecutiveSurvivals >= stage.count) {
          prog.objectiveMet = true;
          window.dispatchEvent(new CustomEvent('contacts:changed'));
        }
      }

      // --- New: collect_items (accumulate from stash per extraction) ---
      else if (stage.type === 'collect_items') {
        const have = countInStash(stage.itemKey);
        const take = Math.min(have, stage.perExtraction || 1);
        if (take > 0) {
          consumeFromStash(stage.itemKey, take);
          prog.collected = (prog.collected || 0) + take;
        }
        if (prog.collected >= stage.count) {
          prog.objectiveMet = true;
          window.dispatchEvent(new CustomEvent('contacts:changed'));
        }
      }
    }
  }
}

export function handleStoryMissionDeath() {
  for (const cid of Object.keys(CONTACTS)) {
    for (const m of CONTACTS[cid].missions) {
      const prog = state.storyProgress[m.id];
      if (!prog || prog.objectiveMet) continue;
      const stage = m.stages[prog.currentStage];
      if (stage?.type === 'survive_raids') {
        prog.consecutiveSurvivals = 0;
      }
    }
  }
}

function countAll(items) {
  let n = 0;
  for (const it of items || []) {
    n += it.count || 1;
    if (it.internalItems) n += countAll(it.internalItems);
  }
  return n;
}

/* ===================================================================
   STORY COMPLETION
   =================================================================== */
function completeStory(contactId, mission) {
  if (!state.contacts[contactId].completedMissions) {
    state.contacts[contactId].completedMissions = [];
  }
  state.contacts[contactId].completedMissions.push(mission.id);
  delete state.storyProgress[mission.id];

  grantRewards(mission.rewards, contactId, mission.name);
  window.dispatchEvent(new CustomEvent('contacts:changed'));
}

/* ===================================================================
   PRIVATE CONTRACT RESOLUTION (on extraction / death)
   =================================================================== */
export function resolvePrivateContractOnExtraction() {
  const c = state.currentContract;
  if (!c) return null;

  const allDone = c.currentStage >= c.stages.length;

  if (allDone) {
    c.objectiveMet = true;
    window.dispatchEvent(new CustomEvent('contacts:changed'));
    return { result: 'objective_met', contract: c };
  }

  // Delivery theft
  if (c.delivery && !c.delivered && !c.objectiveMet) {
    failContract(c, 'Delivered items stolen');
    stripContractItems(c);
    return { result: 'fail', contract: c };
  }

  c.stageAtRaidStart = c.currentStage;
  return { result: 'progress', contract: c };
}

export function resolvePrivateContractOnDeath() {
  const c = state.currentContract;
  if (!c) return null;

  const allDone = c.currentStage >= c.stages.length;

  if (c.delivered || allDone || c.objectiveMet) {
    c.objectiveMet = true;
    window.dispatchEvent(new CustomEvent('contacts:changed'));
    return { result: 'objective_met', contract: c };
  }

  if (c.failOnDeath) {
    failContract(c, 'Operator lost');
    stripContractItems(c);
    return { result: 'fail', contract: c };
  }

  failContract(c, 'Operator lost before completion');
  stripContractItems(c);
  return { result: 'fail', contract: c };
}



function completePrivate(c) {
  grantRewards(c.rewards, c.contactId, c.name);
  removeActive(c.id);
  state.currentContract = null;
  window.dispatchEvent(new CustomEvent('contacts:changed'));
}

function failContract(c, reason) {
  c.state = 'failed';
  c.failReason = reason;
  removeActive(c.id);
  if (c.penalties?.reputation) {
    adjustReputation(c.contactId, c.penalties.reputation);
  }
  if (state.currentContract?.id === c.id) {
    state.currentContract = null;
  }
  window.dispatchEvent(new CustomEvent('contacts:changed'));
}

function removeActive(id) {
  const i = state.activeContracts.findIndex(x => x.id === id);
  if (i !== -1) state.activeContracts.splice(i, 1);
}

/* Remove any delivery items that came from a contract from stash */
function stripContractItems(contract) {
  for (let i = state.stash.items.length - 1; i >= 0; i--) {
    const it = state.stash.items[i];
    if (it._contractItem === contract.id) state.stash.items.splice(i, 1);
  }
  // Also strip from active CD cargo
  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (cd?.internalItems) {
    for (let i = cd.internalItems.length - 1; i >= 0; i--) {
      if (cd.internalItems[i]._contractItem === contract.id) {
        cd.internalItems.splice(i, 1);
      }
    }
  }
}

function grantRewards(rewards, contactId, sourceName) {
  if (!rewards) return;
  if (rewards.credits) {
    state.credits = (state.credits || 0) + rewards.credits;
    window.dispatchEvent(new CustomEvent('currency:delta', {
      detail: { type: 'credits', delta: rewards.credits },
    }));
  }
  if (rewards.reputation) adjustReputation(contactId, rewards.reputation);

  if (Array.isArray(rewards.items)) {
    for (const r of rewards.items) {
      const bp = BLUEPRINTS[r.key];
      if (!bp) continue;
      const item = makeItem(r.key);
      item.count = r.count || 1;
      const spot = findFreeSpot(state.stash, item.w, item.h);
      if (spot) {
        item.col = spot.col; item.row = spot.row; item.rotated = spot.rotated;
        state.stash.items.push(item);
      }
    }
  }

  window.dispatchEvent(new CustomEvent('inventory:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));
}

/* ===================================================================
   GLOBAL CONTRACTS — effect application
   =================================================================== */

/* Called at raid start — returns modifier object for calculateStats */
export function computeGlobalStatsModifiers() {
  const mods = {};   // { stat: multiplier } — e.g. { attack: 0.85 }
  for (const c of state.activeContracts) {
    if (c.type !== 'global') continue;
    const eff = c.globalEffect;
    if (eff?.type === 'stat_mod') {
      const key = eff.stat;
      mods[key] = (mods[key] || 1) * (eff.multiplier ?? 1);
    }
  }
  return mods;
}

/* Called at raid start — do setup that must happen before gameplay */
export function beginRaidWithGlobalContracts() {
  // The stat modifiers are read by calculateStats via computeGlobalStatsModifiers()
  // Nothing else to do here for stat_mod.
}

/* Called at extraction — resolve debt/collection/survival per global contract */
export function resolveGlobalContractsOnExtraction(extractedValue, extractedItems) {
  const messages = [];

  for (const c of [...state.activeContracts]) {
    if (c.type !== 'global') continue;
    const eff = c.globalEffect;
    const es  = c.effectState;
    if (!eff || !es) continue;

    if (eff.type === 'debt') {
      const take = Math.floor((extractedValue?.credits || 0) * eff.percentage);
      if (take > 0 && state.credits >= take) {
        state.credits -= take;
        window.dispatchEvent(new CustomEvent('currency:delta', { detail: { type: 'credits', delta: -take } }));
        es.debtApplied = (es.debtApplied || 0) + take;
        messages.push(`Debt: −${take} CR to ${c.contactId}`);
      }
      es.matchesRemaining -= 1;
      if (es.matchesRemaining <= 0) completeGlobal(c, messages);
    }

    else if (eff.type === 'survival') {
      es.consecutiveSurvivals = (es.consecutiveSurvivals || 0) + 1;
      if (es.consecutiveSurvivals >= (eff.targetConsecutive || 1)) {
        completeGlobal(c, messages);
      }
    }

    else if (eff.type === 'collection') {
      const have = countInStash(eff.itemKey);
      const take = Math.min(have, eff.perExtraction || 1);
      if (take > 0) {
        consumeFromStash(eff.itemKey, take);
        es.collected = (es.collected || 0) + take;
      }
      if (es.collected >= eff.totalTarget) completeGlobal(c, messages);
    }

    else if (eff.type === 'stat_mod') {
      es.matchesRemaining -= 1;
      if (es.matchesRemaining <= 0) completeGlobal(c, messages);
    }
  }

  return messages;
}

/* Called at death — resolve per global contract */
export function resolveGlobalContractsOnDeath() {
  for (const c of [...state.activeContracts]) {
    if (c.type !== 'global') continue;
    const eff = c.globalEffect;
    const es  = c.effectState;

    if (eff?.type === 'survival') {
      es.consecutiveSurvivals = 0;    // reset streak
    }

    // Debt/collection/stat_mod don't advance on death — deadline already ticks elsewhere
  }
}

function completeGlobal(c, messages) {
  grantRewards(c.rewards, c.contactId, c.name);
  removeActive(c.id);
  messages.push(`Completed: ${c.name}`);
}

function countInStash(key) {
  let t = 0;
  for (const it of state.stash.items) if (it.key === key) t += (it.count || 1);
  return t;
}

function consumeFromStash(key, amt) {
  let rem = amt;
  for (let i = state.stash.items.length - 1; i >= 0 && rem > 0; i--) {
    const it = state.stash.items[i];
    if (it.key !== key) continue;
    const take = Math.min(rem, it.count || 1);
    it.count -= take; rem -= take;
    if (it.count <= 0) state.stash.items.splice(i, 1);
  }
}

export function beginPrivateRaid(contract) {
  if (!contract) return false;
  if (contract.objectiveMet || contract.delivered) {
    state.currentContract = null;
    return false;
  }

  contract.stageAtRaidStart = contract.currentStage;
  contract.progressThisRaid = 0;
  state.currentContract = contract;

  if (contract.delivery) {
    const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
    if (!cd || !cd.internalItems) {
      window.dispatchEvent(new CustomEvent('contract:delivery-failed', {
        detail: { reason: 'No CD equipped. Cannot provision delivery items.' },
      }));
      state.currentContract = null;
      return false;
    }

    const def = contract.delivery;
    const bp = BLUEPRINTS[def.itemKey];
    if (!bp) { state.currentContract = null; return false; }

    let remaining = def.itemCount;
    while (remaining > 0) {
      const stackSize = Math.min(remaining, bp.stackMax || 1);
      const item = makeItem(def.itemKey);
      item.count = stackSize;
      item._contractItem = contract.id;
      const spot = findFreeSpot(
        { cols: cd.internalCols, rows: cd.internalRows, items: cd.internalItems },
        item.w, item.h,
      );
      if (!spot) {
        for (let i = cd.internalItems.length - 1; i >= 0; i--) {
          if (cd.internalItems[i]._contractItem === contract.id) cd.internalItems.splice(i, 1);
        }
        window.dispatchEvent(new CustomEvent('contract:delivery-failed', {
          detail: { reason: 'Not enough CD cargo space for delivery items.' },
        }));
        state.currentContract = null;
        return false;
      }
      item.col = spot.col; item.row = spot.row; item.rotated = spot.rotated;
      cd.internalItems.push(item);
      remaining -= stackSize;
    }
  }
  return true;
}

/* ===================================================================
   MANUAL COMPLETION — mission and contract
   =================================================================== */
export function tryCompleteMission(contactId, missionId) {
  const contact = CONTACTS[contactId];
  if (!contact) return { ok: false, reason: 'Unknown contact' };
  const mission = contact.missions.find(m => m.id === missionId);
  if (!mission) return { ok: false, reason: 'Unknown mission' };

  const progress = state.storyProgress[missionId];
  if (!progress || !progress.objectiveMet) {
    return { ok: false, reason: 'Objective not met yet' };
  }

  // Verify + consume bringItems
  if (Array.isArray(mission.bringItems)) {
    for (const req of mission.bringItems) {
      if (countInStash(req.key) < req.count) {
        return { ok: false, reason: `Need ${req.count}× ${req.key} in stash` };
      }
    }
    for (const req of mission.bringItems) {
      consumeFromStash(req.key, req.count);
    }
  }

  grantRewards(mission.rewards, contactId, mission.name);

  if (!state.missionHistory) state.missionHistory = [];
  state.missionHistory.push({
    id: mission.id,
    name: mission.name,
    description: mission.description,
    contactId,
    completedAt: Date.now(),
    completedRaid: state.raidsCompleted,
    rewards: mission.rewards,
  });

  if (!state.contacts[contactId].completedMissions) {
    state.contacts[contactId].completedMissions = [];
  }
  if (!state.contacts[contactId].completedMissions.includes(missionId)) {
    state.contacts[contactId].completedMissions.push(missionId);
  }
  delete state.storyProgress[missionId];

  window.dispatchEvent(new CustomEvent('contacts:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));
  return { ok: true };
}

export function tryCompleteContract(contractId) {
  const c = state.activeContracts.find(x => x.id === contractId);
  if (!c) return { ok: false, reason: 'Contract not found' };
  if (!c.objectiveMet) return { ok: false, reason: 'Objective not met' };

  if (Array.isArray(c.bringItems)) {
    for (const req of c.bringItems) {
      if (countInStash(req.key) < req.count) {
        return { ok: false, reason: `Need ${req.count}× ${req.key} in stash` };
      }
    }
    for (const req of c.bringItems) {
      consumeFromStash(req.key, req.count);
    }
  }

  grantRewards(c.rewards, c.contactId, c.name);

  if (c.storyRelated) {
    if (!state.contractHistory) state.contractHistory = [];
    state.contractHistory.push({
      ...c,
      completedAt: Date.now(),
      completedRaid: state.raidsCompleted,
    });
  }
  removeActive(c.id);
  if (state.currentContract?.id === c.id) state.currentContract = null;

  window.dispatchEvent(new CustomEvent('contacts:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));
  return { ok: true };
}

/* Freeze timer while objective is met and awaiting Complete click */
export function tickContractTimers(excludeActiveId = null) {
  for (const cid of Object.keys(CONTACTS)) {
    const expiryMap = state.contacts[cid].contractExpiry || {};
    for (const key of Object.keys(expiryMap)) {
      expiryMap[key] -= 1;
      if (expiryMap[key] <= 0) delete expiryMap[key];
    }
  }

  const failed = [];
  for (const c of state.activeContracts) {
    if (c.id === excludeActiveId) continue;
    if (c.objectiveMet) continue;             // frozen until user completes
    if (c.deadlineRemaining === Infinity) continue;
    c.deadlineRemaining -= 1;
    if (c.deadlineRemaining <= 0) failed.push(c);
  }
  for (const c of failed) failContract(c, 'Deadline expired');
}

