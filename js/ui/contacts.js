/* ===================================================================
   Contacts UI — market, story missions, global contracts, private contracts
   =================================================================== */

import { state } from '../core/state.js';
import { CONTACTS, CONTACT_LIST } from '../data/contactsDB.js';
import {
  acceptContract, cancelContract,
  getAvailableStoryMissions, getAvailableGlobalContracts, getAvailablePrivateContracts,
  initContractExpiries, tryCompleteMission, tryCompleteContract
} from '../systems/contractSystem.js';
import { getReputation, getReputationTier } from '../systems/reputationSystem.js';
import { BLUEPRINTS, makeItem } from '../data/itemDB.js';
import { findFreeSpot, triggerCurrencyUpdate } from '../systems/grid-core.js';
import { showToast } from './toast.js';

let activeContactId = 'rook';
let activeSubTab    = 'market';

export function renderContacts() {
  initContractExpiries();
  renderContactSidebar();
  renderContactPanel();
}

/* ------------------------------------------------------------------- */
function renderContactSidebar() {
  const host = document.getElementById('contactsListBody');
  if (!host) return;
  host.innerHTML = '';

  for (const id of CONTACT_LIST) {
    const contact = CONTACTS[id];
    const rep = getReputation(id);
    const tier = getReputationTier(id);

    const el = document.createElement('div');
    el.className = 'contact-card' + (id === activeContactId ? ' active' : '');
    el.style.setProperty('--contact-color', contact.color);

    el.innerHTML = `
      <div class="contact-card-avatar" style="color:${contact.color};border-color:${contact.color};">${contact.avatar}</div>
      <div class="contact-card-info">
        <div class="contact-card-name">${contact.name}</div>
        <div class="contact-card-sub">REP ${rep} · TIER ${tier}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      activeContactId = id;
      activeSubTab = 'market';
      renderContacts();
    });
    host.appendChild(el);
  }
}

/* ------------------------------------------------------------------- */
function renderContactPanel() {
  const contact = CONTACTS[activeContactId];
  if (!contact) return;

  document.getElementById('contactName').textContent = contact.name;
  document.getElementById('contactTagline').textContent = contact.tagline;
  document.getElementById('contactDescription').textContent = contact.description;

  const rep = getReputation(activeContactId);
  const tier = getReputationTier(activeContactId);
  document.getElementById('contactRepInfo').innerHTML = `
    <div class="contact-rep-bar">
      <div class="contact-rep-fill" style="width:${rep}%"></div>
    </div>
    <div class="contact-rep-label">REPUTATION ${rep}/100 · TIER ${tier}</div>
  `;

  // Sub-tabs
  const subTabs = document.querySelectorAll('.contact-subtab');
  subTabs.forEach(t => t.classList.toggle('active', t.dataset.subtab === activeSubTab));
  subTabs.forEach(t => {
    if (t.dataset.wired) return;
    t.dataset.wired = '1';
    t.addEventListener('click', () => {
      activeSubTab = t.dataset.subtab;
      renderContacts();
    });
  });

  const host = document.getElementById('contactContentBody');
  if (!host) return;
  host.innerHTML = '';

  if (activeSubTab === 'market')    renderContactMarket(host, contact);
  if (activeSubTab === 'missions')  renderContactMissions(host, contact);
  if (activeSubTab === 'contracts') renderContactContracts(host, contact);
}

/* -------------------------------------------------------------------
   Market
   ------------------------------------------------------------------- */
function renderContactMarket(host, contact) {
  const tier = getReputationTier(contact.id);

  if (!state.contacts[contact.id].market) {
    state.contacts[contact.id].market = { randomItems: [], lastRefreshRaid: -999 };
  }
  const mktState = state.contacts[contact.id].market;
  const defs = contact.market.random;
  const raidsSince = state.raidsCompleted - mktState.lastRefreshRaid;
  if (!mktState.randomItems.length || raidsSince >= defs.refreshRaids) {
    mktState.randomItems = rollRandomMarketItems(defs);
    mktState.lastRefreshRaid = state.raidsCompleted;
  }

  const fixedWrap = document.createElement('div');
  fixedWrap.className = 'contact-market-section';
  fixedWrap.innerHTML = '<div class="contact-market-section-title">FIXED STOCK</div>';
  for (const def of contact.market.fixed) fixedWrap.appendChild(buildMarketRow(def, false));
  host.appendChild(fixedWrap);

  const randomWrap = document.createElement('div');
  randomWrap.className = 'contact-market-section';
  randomWrap.innerHTML = `
    <div class="contact-market-section-title">
      ROTATING STOCK
      <span class="contact-market-refresh">REFRESHES IN ${Math.max(0, defs.refreshRaids - raidsSince)} RAIDS</span>
    </div>
  `;
  for (const def of mktState.randomItems) {
    const locked = (def.repTier || 0) > tier;
    randomWrap.appendChild(buildMarketRow(def, locked));
  }
  host.appendChild(randomWrap);
}

function rollRandomMarketItems(defs) {
  const pool = [...defs.table];
  const picked = [];
  const n = defs.countMin + Math.floor(Math.random() * (defs.countMax - defs.countMin + 1));
  for (let i = 0; i < n && pool.length > 0; i++) {
    const totalW = pool.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * totalW;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= (pool[j].weight || 1);
      if (r <= 0) { idx = j; break; }
    }
    const entry = pool[idx];
    const lo = entry.stock?.[0] ?? 1;
    const hi = entry.stock?.[1] ?? lo;
    picked.push({ ...entry, stock: lo + Math.floor(Math.random() * (hi - lo + 1)) });
    pool.splice(idx, 1);
  }
  return picked;
}

function buildMarketRow(def, locked) {
  const bp = BLUEPRINTS[def.key];
  const row = document.createElement('div');
  row.className = 'contact-market-row' + (locked ? ' locked' : '');

  const imgWrap = document.createElement('div');
  imgWrap.className = 'contact-market-img';
  const img = document.createElement('img');
  img.src = bp?.img !== undefined ? bp.img : `/img/items/${def.key}.png`;
  img.onerror = () => img.remove();
  imgWrap.appendChild(img);
  row.appendChild(imgWrap);

  const info = document.createElement('div');
  info.className = 'contact-market-info';
  info.innerHTML = `
    <div class="contact-market-name">${bp?.name || def.key}</div>
    <div class="contact-market-desc">${bp?.description || ''}</div>
  `;
  row.appendChild(info);

  const price = document.createElement('div');
  price.className = 'contact-market-price';
  price.innerHTML = `
    <span class="price-label ${def.currency}">${abbrev(def.currency)}</span>
    <span class="price-amt">${def.price.toLocaleString()}</span>
  `;
  row.appendChild(price);

  const stockEl = document.createElement('div');
  stockEl.className = 'contact-market-stock';
  stockEl.textContent = `×${def.stock}`;
  row.appendChild(stockEl);

  const btn = document.createElement('button');
  btn.className = 'contact-market-btn';
  if (locked) {
    btn.textContent = `REP ${def.repTier} LOCKED`;
    btn.disabled = true;
  } else if (def.stock <= 0) {
    btn.textContent = 'OUT';
    btn.disabled = true;
  } else {
    btn.textContent = 'BUY';
    btn.addEventListener('click', () => buyFromContact(activeContactId, def));
  }
  row.appendChild(btn);
  return row;
}

function buyFromContact(contactId, def) {
  const bp = BLUEPRINTS[def.key];
  if (!bp) return;
  const total = def.price;

  if (def.currency === 'credits') {
    if ((state.credits || 0) < total) return showToast('Not enough credits.', { type: 'warning' });
    state.credits -= total;
    window.dispatchEvent(new CustomEvent('currency:delta', { detail: { type: 'credits', delta: -total } }));
  } else {
    if (countInStash(def.currency) < total) return showToast('Not enough currency.', { type: 'warning' });
    consumeFromStash(def.currency, total);
  }

  const item = makeItem(def.key);
  item.count = 1;
  const spot = findFreeSpot(state.stash, item.w, item.h);
  if (!spot) return showToast('No space in stash.', { type: 'warning' });
  item.col = spot.col; item.row = spot.row; item.rotated = spot.rotated;
  state.stash.items.push(item);

  def.stock = Math.max(0, def.stock - 1);
  showToast(`Bought ${bp.name}`, { type: 'success', icon: '✓' });
  triggerCurrencyUpdate();
  window.dispatchEvent(new CustomEvent('storage:changed'));
  renderContacts();
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
function abbrev(c) { return { credits: 'CR', itokens: 'IT', gchips: 'GC' }[c] || c.toUpperCase().slice(0, 2); }

/* -------------------------------------------------------------------
   Missions (story)
   ------------------------------------------------------------------- */
function renderContactMissions(host, contact) {
  const available = getAvailableStoryMissions(contact.id);
  const completed = state.contacts[contact.id].completedMissions || [];

  if (contact.missions.length === 0 && (!state.missionHistory?.length)) {
    host.innerHTML = '<div class="contact-empty">No story missions from this contact.</div>';
    return;
  }

  for (const m of contact.missions) {
    const isDone = completed.includes(m.id);
    if (isDone) continue;
    const isAvail = available.some(x => x.id === m.id);
    if (!isAvail) continue;

    const prog = state.storyProgress[m.id] || { currentStage: 0 };
    if (!state.storyProgress[m.id]) {
      state.storyProgress[m.id] = { currentStage: 0, progressThisRaid: 0 };
    }

    host.appendChild(buildContractCard(m, {
      isDone: false,
      isAvail: true,
      isActive: true,
      isStory: true,
      progress: prog,
    }));
  }

  if (host.children.length === 0) {
    host.innerHTML = '<div class="contact-empty">All available missions completed.</div>';
  }

  renderMissionHistory(host, contact);
}

function renderMissionHistory(host, contact) {
  const history = (state.missionHistory || []).filter(h => h.contactId === contact.id);
  if (history.length === 0) return;

  const section = document.createElement('div');
  section.className = 'contract-group';
  section.innerHTML = '<div class="contract-group-title">HISTORY</div>';
  for (const h of history) {
    const card = document.createElement('div');
    card.className = 'mission-card done';
    card.innerHTML = `
      <div class="mission-card-head">
        <div class="mission-card-name">
          <span class="mission-type-badge story">COMPLETED</span>
          ${h.name}
        </div>
      </div>
      <div class="mission-card-desc">${h.description || ''}</div>
      <div class="mission-card-meta">
        <span>Completed at raid ${h.completedRaid}</span>
      </div>
    `;
    section.appendChild(card);
  }
  host.appendChild(section);
}

/* -------------------------------------------------------------------
   Contracts (global + private)
   ------------------------------------------------------------------- */
function renderContactContracts(host, contact) {
  const globals  = getAvailableGlobalContracts(contact.id);
  const privates = getAvailablePrivateContracts(contact.id);
  const activeIds = new Set(state.activeContracts.map(c => c.id));

  if (contact.contracts.length === 0) {
    host.innerHTML = '<div class="contact-empty">No contracts from this contact.</div>';
    return;
  }

  const groups = [
    { label: 'GLOBAL CONTRACTS',  items: contact.contracts.filter(c => c.type === 'global'  && !c.disabled) },
    { label: 'PRIVATE CONTRACTS', items: contact.contracts.filter(c => c.type === 'private' && !c.disabled) },
  ];

  for (const g of groups) {
    if (g.items.length === 0) continue;
    const section = document.createElement('div');
    section.className = 'contract-group';
    section.innerHTML = `<div class="contract-group-title">${g.label}</div>`;

    for (const c of g.items) {
      const runtime = state.activeContracts.find(a => a.id === c.id);
      const view = runtime
        ? { ...c, ...runtime, contactId: activeContactId }
        : { ...c, contactId: activeContactId };

      const isActive = !!runtime;
      const isAvail = isActive ||
        (c.type === 'global'  && globals.some(x => x.id === c.id)) ||
        (c.type === 'private' && privates.some(x => x.id === c.id));

      section.appendChild(buildContractCard(view, {
        isDone: false, isAvail, isActive, isStory: false,
      }));
    }
    host.appendChild(section);
  }
}

/* -------------------------------------------------------------------
   Shared contract card
   ------------------------------------------------------------------- */
function buildContractCard(c, { isDone, isAvail, isActive, isStory, progress }) {
  const card = document.createElement('div');
  card.className = 'mission-card';
  if (isDone) card.classList.add('done');
  if (isActive && !isStory) card.classList.add('active');

  const typeLabel = isStory ? 'STORY'
                  : c.type === 'global' ? 'GLOBAL'
                  : 'PRIVATE';
  const typeClass = isStory ? 'story'
                  : c.type === 'global' ? 'global'
                  : 'private';

  const expiryMap = state.contacts[c.contactId || '']?.contractExpiry;
  const expiresRemaining = (expiryMap && c.id in expiryMap) ? expiryMap[c.id]
                          : c.expiresInRaids ?? null;
  const isStoryType = isStory || c.type === 'story';

  // Stages display
  let stagesHtml = '';
  if (c.stages && c.stages.length > 0) {
    const curStage = isStory ? (progress?.currentStage ?? 0) : (c.currentStage || 0);
    stagesHtml = '<ul class="mission-card-stages">' + c.stages.map((s, i) => {
      const done = i < curStage;
      return `<li class="${done ? 'stage-done' : ''}">${s.label || s.type}</li>`;
    }).join('') + '</ul>';
  } else if (c.globalEffect) {
    const eff = c.globalEffect;
    const lines = [];
    if (eff.type === 'debt')        lines.push(`Debt: ${Math.round(eff.percentage * 100)}% of extracted loot`);
    if (eff.type === 'survival')    lines.push(`Survive ${eff.targetConsecutive} consecutive raids`);
    if (eff.type === 'collection')  lines.push(`Extract ${eff.perExtraction}× ${eff.itemKey} per raid until ${eff.totalTarget} total`);
    if (eff.type === 'stat_mod')    lines.push(`${eff.stat.toUpperCase()} ${Math.round((eff.multiplier - 1) * 100)}% for ${eff.matchesToApply} matches`);
    stagesHtml = '<ul class="mission-card-stages">' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>';
  }

  // Rewards + penalties
  const rewardsHtml = buildRewards(c.rewards);
  const penaltiesHtml = c.penalties && (c.penalties.reputation || (c.penalties.items && c.penalties.items.length))
    ? `<div class="mission-card-penalties"><span class="label">ON FAIL:</span> ${buildRewards(c.penalties, true)}</div>`
    : '';

  // Timers
  const timers = [];
  if (!isStoryType) {
    if (expiresRemaining != null) {
      timers.push(`Expires in ${expiresRemaining} raids`);
    }
    if (isActive && c.deadlineRemaining != null) {
      timers.push(`Deadline: ${c.deadlineRemaining} raids`);
    }
  }

  // Status hint for active private contracts
  let statusLine = '';
  if (isActive && c.type === 'private') {
    if (c.objectiveMet)  statusLine = '<div class="mission-status-hint ready">OBJECTIVE COMPLETE</div>';
    else if (c.delivered) statusLine = '<div class="mission-status-hint progress">DELIVERED — CLAIM TO FINISH</div>';
  }

  card.innerHTML = `
    <div class="mission-card-head">
      <div class="mission-card-name">
        <span class="mission-type-badge ${typeClass}">${typeLabel}</span>
        ${c.name}
      </div>
      ${c.sectorTier ? `<div class="mission-card-tier">${c.sectorTier}</div>` : ''}
    </div>
    <div class="mission-card-desc">${c.description || ''}</div>
    <div class="mission-card-conditions">${c.conditions || ''}</div>
    ${stagesHtml}
    ${timers.length > 0 ? `<div class="mission-card-meta">${timers.map(t => `<span>${t}</span>`).join('')}</div>` : ''}
    <div class="mission-card-rewards"><span class="label">REWARDS:</span> ${rewardsHtml}</div>
    ${penaltiesHtml}
    ${statusLine}
  `;

  const actions = document.createElement('div');
  actions.className = 'mission-card-actions';

  if (isDone) {
    const b = document.createElement('span');
    b.className = 'mission-badge done';
    b.textContent = 'COMPLETED';
    actions.appendChild(b);

  } else if (isStory) {
    if (progress?.objectiveMet) {
      const completeBtn = document.createElement('button');
      completeBtn.className = 'mission-accept-btn';
      completeBtn.textContent = 'COMPLETE';
      completeBtn.addEventListener('click', () => {
        const res = tryCompleteMission(activeContactId, c.id);
        if (res.ok) {
          showToast(`Mission complete: ${c.name}`, { type: 'success', icon: '★' });
          renderContacts();
        } else {
          showToast(res.reason || 'Cannot complete', { type: 'warning' });
        }
      });
      actions.appendChild(completeBtn);
    } else {
      const b = document.createElement('span');
      b.className = 'mission-badge active';
      b.textContent = 'IN PROGRESS';
      actions.appendChild(b);
    }

  } else if (isActive) {
    // COMPLETE for private contracts whose objective is met
    if (c.type === 'private' && c.objectiveMet) {
      const completeBtn = document.createElement('button');
      completeBtn.className = 'mission-accept-btn';
      completeBtn.textContent = 'COMPLETE';
      completeBtn.addEventListener('click', () => {
        const res = tryCompleteContract(c.id);
        if (res.ok) {
          showToast(`Contract complete: ${c.name}`, { type: 'success', icon: '★' });
          renderContacts();
        } else {
          showToast(res.reason || 'Cannot complete', { type: 'warning' });
        }
      });
      actions.appendChild(completeBtn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mission-cancel-btn';
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.disabled = c.cancelable === false;
    cancelBtn.addEventListener('click', () => {
      if (!confirm(`Cancel "${c.name}"? Penalties may apply.`)) return;
      if (cancelContract(c.id)) {
        showToast(`Cancelled: ${c.name}`, { type: 'warning' });
        renderContacts();
      } else {
        showToast('Cannot cancel this contract.', { type: 'warning' });
      }
    });
    actions.appendChild(cancelBtn);

  } else if (isAvail) {
    const btn = document.createElement('button');
    btn.className = 'mission-accept-btn';
    btn.textContent = 'ACCEPT';
    btn.addEventListener('click', () => {
      if (acceptContract(activeContactId, c)) {
        showToast(`Accepted: ${c.name}`, { type: 'success', icon: '✓' });
        renderContacts();
      }
    });
    actions.appendChild(btn);

  } else {
    const b = document.createElement('span');
    b.className = 'mission-badge locked';
    b.textContent = expiresRemaining === 0 ? 'EXPIRED' : 'LOCKED';
    actions.appendChild(b);
  }

  card.appendChild(actions);
  return card;
}

function buildRewards(r, isPenalty) {
  if (!r) return '—';
  const parts = [];
  if (r.credits && r.credits > 0)  parts.push(`${isPenalty ? '-' : '+'}${r.credits} CR`);
  if (r.reputation)                parts.push(`${r.reputation > 0 ? '+' : ''}${r.reputation} REP`);
  if (Array.isArray(r.items)) {
    for (const it of r.items) {
      const bp = BLUEPRINTS[it.key];
      parts.push(`${it.count}× ${bp?.name || it.key}`);
    }
  }
  return parts.length ? parts.join(' · ') : '—';
}

window.addEventListener('contacts:changed', () => {
  const panel = document.getElementById('contactsPanel');
  if (panel && panel.classList.contains('active')) renderContacts();
});