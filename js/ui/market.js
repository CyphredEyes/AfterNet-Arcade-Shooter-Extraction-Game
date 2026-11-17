/* ===================================================================
   Market UI — reads from state.market, price jitter, toasts.
   =================================================================== */

import { TRADER_DEFINITIONS, BLACK_MARKET_TABLES } from '../data/marketDB.js';
import { state, saveMarket, changeCredits } from '../core/state.js';
import { makeItem, getBlueprint } from '../data/itemDB.js';
import {
  mountGrid, findFreeSpot, triggerCurrencyUpdate,
} from '../systems/grid-core.js';
import { openItemDescription } from './itemDescription.js';
import { showToast } from './toast.js';
import { getBuyPrice } from '../systems/marketSystem.js';
import { renderCrafting } from './crafting.js';
import { renderContacts } from './contacts.js';

import { getActiveGlobalContracts, getActivePrivateContracts, cancelContract } from '../systems/contractSystem.js';

let activeMarket   = 'market';
let activeTraderId = TRADER_DEFINITIONS[0].id;
let traderGridSeq  = 0;

export function renderMarket() {
  wireTabs();
}

/* ------------------------------------------------------------------- */
function renderTraders() {
  const host = document.getElementById('traderListBody');
  if (!host) return;
  host.innerHTML = '';

  for (const def of TRADER_DEFINITIONS) {
    const slot = state.market.traders[def.id];
    const metaText = def.refreshMinutes
      ? `REFRESH IN ${formatCountdown(slot.refreshAt)}`
      : `RESTOCK IN ${slot.restockIn} RAIDS`;

    const el = document.createElement('div');
    el.className = 'trader-card' + (def.id === activeTraderId ? ' active' : '');
    el.innerHTML = `
      <div class="trader-card-avatar">${def.avatar}</div>
      <div class="trader-card-info">
        <div class="trader-card-name">${escapeHtml(def.name)}</div>
        <div class="trader-card-sub">${escapeHtml(metaText)}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      if (activeTraderId === def.id) return;
      activeTraderId = def.id;
      renderTraders();
      renderTraderPanel();
      triggerSwapAnim();
    });
    host.appendChild(el);
  }
}

/* ------------------------------------------------------------------- */
function renderTraderPanel() {
  const def = TRADER_DEFINITIONS.find(d => d.id === activeTraderId);
  if (!def) return;
  const slot = state.market.traders[def.id];
  if (!slot) return;

  document.getElementById('traderName').textContent   = def.name;
  document.getElementById('traderTagline').textContent = def.tagline;
  document.getElementById('traderAvatar').textContent  = def.avatar;

  document.getElementById('traderMeta').innerHTML = def.refreshMinutes
    ? `<div style="font-size:10px;color:#6b7785;letter-spacing:1px;">REFRESH IN</div>
       <div style="font-size:14px;font-weight:700;color:#3fb950;font-family:monospace;">${formatCountdown(slot.refreshAt)}</div>`
    : `<div style="font-size:10px;color:#6b7785;letter-spacing:1px;">RESTOCK</div>
       <div style="font-size:12px;font-weight:700;color:#8b949e;">IN ${slot.restockIn} RAIDS</div>`;

  const host = document.getElementById('traderItems');
  host.innerHTML = '';
  const gridHost = document.createElement('div');
  gridHost.className = 'market-grid-host';
  host.appendChild(gridHost);

  const inv = packMarketItems(slot.items);
  mountGrid(`market-grid-${def.id}-${++traderGridSeq}`, inv, gridHost, {
    readOnly: true,
    onItemClick: (item) => openMarketItem(item, 'market'),
  });
}

/* ------------------------------------------------------------------- */
function renderBlackMarket() {
  const bm = state.market.blackMarket;
  const itemsHost = document.getElementById('blackMarketItems');
  const timerEl   = document.getElementById('blackMarketTimer');
  if (!itemsHost) return;

  if (timerEl) {
    timerEl.textContent = bm.active ? `${bm.raidsLeft} RAID${bm.raidsLeft === 1 ? '' : 'S'}` : 'HIDDEN';
  }

  itemsHost.innerHTML = '';
  if (!bm.active) {
    itemsHost.innerHTML = '<div class="market-empty">The black market has moved on.</div>';
    return;
  }
  const gridHost = document.createElement('div');
  gridHost.className = 'market-grid-host blackmarket-grid-host';
  itemsHost.appendChild(gridHost);

  const inv = packMarketItems(bm.items);
  mountGrid(`market-grid-black-${++traderGridSeq}`, inv, gridHost, {
    readOnly: true,
    onItemClick: (item) => openMarketItem(item, 'black'),
  });
}

/* ------------------------------------------------------------------- */
function packMarketItems(entries) {
  const inv = { cols: 6, rows: 4, items: [] };
  for (const mkt of entries) {
    const item = makeItem(mkt.key);
    item.count = Math.max(1, mkt.stock || 1);
    item._market = mkt;
    item._outOfStock = (mkt.stock || 0) <= 0;
    const spot = findFreeSpot(inv, item.w, item.h);
    if (!spot) continue;
    item.col = spot.col;
    item.row = spot.row;
    item.rotated = spot.rotated;
    inv.items.push(item);
  }
  return inv;
}

/* ------------------------------------------------------------------- */
function openMarketItem(item, source) {
  const mkt = item._market;
  if (!mkt) return;

  const livePrice = mkt.price !== undefined
    ? getBuyPrice(mkt.price, mkt.key, state.market)
    : undefined;

  openItemDescription(item, {
    market: {
      price:    livePrice,
      currency: mkt.currency,
      stock:    mkt.stock,
      requires: mkt.requires,

      availableFn: (key) => countInStash(key),
      maxQtyFn:    () => computeMaxQty(item, mkt),
      canBuy:      (qty) => canBuyQty(item, mkt, qty),
      onBuy:       (qty) => executePurchase(item, mkt, qty),
    },
  });
}

/* ------------------------------------------------------------------- */
function countInStash(key) {
  let total = 0;
  const scan = (items) => {
    for (const it of items || []) {
      if (it.key === key) total += it.count || 1;
      if (it.internalItems) scan(it.internalItems);
    }
  };
  scan(state.stash.items);
  return total;
}

function consumeFromStash(key, amount) {
  let remaining = amount;
  const scan = (items) => {
    for (let i = items.length - 1; i >= 0 && remaining > 0; i--) {
      const it = items[i];
      if (it.key === key) {
        const take = Math.min(remaining, it.count || 1);
        it.count -= take;
        remaining -= take;
        if (it.count <= 0) items.splice(i, 1);
      } else if (it.internalItems && remaining > 0) {
        scan(it.internalItems);
      }
    }
  };
  scan(state.stash.items);
  return remaining === 0;
}

/* ------------------------------------------------------------------- */
function computeMaxQty(item, mkt) {
  const bp = getBlueprint(item.key);
  if (!bp) return 0;
  const stackMax = bp.stackMax || 1;

  const placed = [];
  let capacity = 0;
  for (let i = 0; i < 100; i++) {
    const spot = findFreeSpot(state.stash, bp.w, bp.h);
    if (!spot) break;
    const fake = {
      id: `__mkt_${i}_${Date.now()}_${Math.random()}__`,
      col: spot.col, row: spot.row, rotated: spot.rotated,
      w: bp.w, h: bp.h,
    };
    state.stash.items.push(fake);
    placed.push(fake);
    capacity += stackMax;
  }
  for (const f of placed) {
    const idx = state.stash.items.indexOf(f);
    if (idx !== -1) state.stash.items.splice(idx, 1);
  }

  return Math.min(mkt.stock || 0, capacity);
}

/* ------------------------------------------------------------------- */
function canBuyQty(item, mkt, qty) {
  if (qty < 1 || qty > (mkt.stock || 0)) return false;

  if (mkt.requires) {
    for (const req of mkt.requires) {
      if (countInStash(req.key) < req.count * qty) return false;
    }
    return true;
  }

  const livePrice = getBuyPrice(mkt.price, mkt.key, state.market);
  const total = livePrice * qty;
  if (mkt.currency === 'credits') return (state.credits || 0) >= total;
  return countInStash(mkt.currency) >= total;
}

/* ------------------------------------------------------------------- */
function executePurchase(item, mkt, qty) {
  if (!canBuyQty(item, mkt, qty)) {
    return { success: false, reason: 'Cannot complete purchase.' };
  }

  const livePrice = mkt.price !== undefined
    ? getBuyPrice(mkt.price, mkt.key, state.market)
    : 0;
  const total = livePrice * qty;

  // Pay
  if (mkt.requires) {
    for (const req of mkt.requires) {
      if (!consumeFromStash(req.key, req.count * qty)) {
        return { success: false, reason: 'Missing required items.' };
      }
    }
  } else if (livePrice > 0) {
    if (mkt.currency === 'credits') {
      changeCredits(-total);
    } else if (!consumeFromStash(mkt.currency, total)) {
      return { success: false, reason: 'Missing currency.' };
    }
  }

  // Deliver
  const bp = getBlueprint(item.key);
  const stackMax = bp.stackMax || 1;
  let remaining = qty;
  while (remaining > 0) {
    const stackSize = Math.min(remaining, stackMax);
    const newItem = makeItem(item.key);
    newItem.count = stackSize;
    const spot = findFreeSpot(state.stash, newItem.w, newItem.h);
    if (!spot) break;
    newItem.col = spot.col;
    newItem.row = spot.row;
    newItem.rotated = spot.rotated;
    state.stash.items.push(newItem);
    remaining -= stackSize;
  }

  mkt.stock = Math.max(0, (mkt.stock || 0) - qty);
  saveMarket();
  triggerCurrencyUpdate();
  window.dispatchEvent(new CustomEvent('storage:changed'));

  showToast(
    `Bought ${qty}× ${item.name}${total ? ' · −' + total.toLocaleString() + ' ' + abbrev(mkt.currency) : ''}`,
    { type: 'success', icon: '✓' },
  );

  renderMarket();
  window.dispatchEvent(new CustomEvent('market:changed'));
  return { success: true };
}

/* ------------------------------------------------------------------- */
function formatCountdown(ts) {
  if (!ts) return '—';
  const ms = Math.max(0, ts - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function triggerSwapAnim() {
  const el = document.querySelector('.trader-inventory');
  if (!el) return;
  el.classList.remove('swap-anim');
  void el.offsetWidth;
  el.classList.add('swap-anim');
}

function abbrev(cur) {
  return { credits: 'CR', itokens: 'IT', gchips: 'GC' }[cur] || String(cur).toUpperCase().slice(0, 2);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function wireTabs() {
  const tabs   = document.querySelectorAll('.market-tab');
  const panels = {
    market:    document.getElementById('contactsPanel'),
    black:     document.getElementById('blackMarketPanel'),
    crafting:  document.getElementById('craftingPanel'),
  };

  if (!panels.market || !panels.black) return;

  const applyState = () => {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.market === activeMarket));
    for (const [key, el] of Object.entries(panels)) {
      if (el) el.classList.toggle('active', key === activeMarket);
    }
    if (activeMarket === 'market')   renderContacts();
    if (activeMarket === 'crafting') renderCrafting();
    if (activeMarket === 'black')    renderBlackMarket();
  };

  tabs.forEach(tab => {
    if (tab.dataset.wired) return;
    tab.dataset.wired = '1';
    tab.addEventListener('click', () => {
      activeMarket = tab.dataset.market;
      applyState();
    });
  });

  applyState();
}

function renderAcceptedContracts() {
  const host = document.getElementById('contractsContentBody');
  if (!host) return;
  host.innerHTML = '';

  const globals  = getActiveGlobalContracts();
  const privates = getActivePrivateContracts();

  if (globals.length === 0 && privates.length === 0) {
    host.innerHTML = '<div class="contact-empty">No accepted contracts. Visit a contact to accept one.</div>';
    return;
  }

  const renderGroup = (title, list, typeLabel) => {
    if (list.length === 0) return;
    const section = document.createElement('div');
    section.className = 'contract-group';
    section.innerHTML = `<div class="contract-group-title">${title}</div>`;
    for (const c of list) {
      const card = document.createElement('div');
      card.className = 'mission-card active';

      let body = '';
      if (c.type === 'private') {
        const stage = c.stages?.[c.currentStage];
        body = `
          <div class="mission-card-meta">
            <span>Stage ${c.currentStage + 1}/${c.stages.length}: ${stage?.label || ''}</span>
            <span>Deadline: ${c.deadlineRemaining} raids</span>
          </div>
        `;
      } else if (c.type === 'global') {
        const es = c.effectState || {};
        let progress = '';
        if (c.globalEffect?.type === 'survival') progress = `Streak: ${es.consecutiveSurvivals || 0}/${c.globalEffect.targetConsecutive}`;
        if (c.globalEffect?.type === 'debt')     progress = `Matches left: ${es.matchesRemaining}`;
        if (c.globalEffect?.type === 'collection') progress = `${es.collected || 0}/${c.globalEffect.totalTarget} collected`;
        if (c.globalEffect?.type === 'stat_mod') progress = `Matches left: ${es.matchesRemaining}`;
        body = `
          <div class="mission-card-meta">
            <span>${progress}</span>
            <span>Deadline: ${c.deadlineRemaining} raids</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="mission-card-head">
          <div class="mission-card-name">
            <span class="mission-type-badge ${c.type === 'global' ? 'global' : 'private'}">${c.type === 'global' ? 'GLOBAL' : 'PRIVATE'}</span>
            ${c.name}
          </div>
          ${c.sectorTier ? `<div class="mission-card-tier">${c.sectorTier}</div>` : ''}
        </div>
        <div class="mission-card-desc">${c.description}</div>
        ${body}
      `;

      const actions = document.createElement('div');
      actions.className = 'mission-card-actions';

      const completeBtn = document.createElement('button');
      completeBtn.className = 'mission-accept-btn';
      completeBtn.textContent = 'COMPLETE';
      completeBtn.style.display = c.objectiveMet ? 'inline-block' : 'none';
      completeBtn.disabled = !c.objectiveMet;
      completeBtn.addEventListener('click', () => {
        const res = tryCompleteContract(c.id);
        if (res.ok) {
          showToast(`Contract complete: ${c.name}`, { type: 'success', icon: '★' });
          renderAcceptedContracts();
        } else {
          showToast(res.reason || 'Cannot complete', { type: 'warning' });
        }
      });
      actions.appendChild(completeBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'mission-cancel-btn';
      cancelBtn.textContent = 'CANCEL';
      cancelBtn.disabled = c.cancelable === false;
      cancelBtn.addEventListener('click', () => {
        if (!confirm(`Cancel "${c.name}"?`)) return;
        if (cancelContract(c.id)) renderAcceptedContracts();
      });
      actions.appendChild(cancelBtn);
      card.appendChild(actions);

      section.appendChild(card);
    }
    host.appendChild(section);
  };

  renderGroup('GLOBAL CONTRACTS',  globals,  'GLOBAL');
  renderGroup('PRIVATE CONTRACTS', privates, 'PRIVATE');
}