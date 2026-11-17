import { getShipBlueprint } from '../data/spaceshipDB.js';
import { calculateStats } from '../ui/hangar.js';
import { createGameState } from '../modules/entities.js';
import { initInput, input } from '../modules/input.js';
import { updatePlayer } from '../systems/playerSystem.js';
import { updateAsteroids, resolvePlayerDamage } from '../systems/asteroidSystem.js';
import { updateBullets } from '../systems/bulletSystem.js';
import { updateServers, getShieldPct } from '../systems/serverSystem.js';
import { RenderSystem } from '../systems/renderSystem.js';
import { openGameInventory, closeGameInventory } from './gameInventory.js';

import { BORDER, WORLD_W, WORLD_H, EXPLOIT_INJECTION, EXPLOIT_TIERS, PACKET_DYING_DURATION } from '../modules/config.js';
import {
  switchWeapon, fireCurrentWeapon, fireFlares, updateWeaponCooldowns,
} from '../systems/weaponSystem.js';
import { updateDefense, resetDefenseState } from '../systems/defenseSystem.js';
import { state, saveRaidStats, saveMarket, saveCorpThreat } from '../core/state.js';
import { advanceMarketAfterRaid } from '../systems/marketSystem.js';
import { showExtractionResults, computeItemsValue } from '../ui/extractionResults.js';
import { forceAutoSave } from '../systems/saveBackend.js';
import { initSpoilsSystem } from '../systems/spoilsSystem.js';
import { wrapPos, wrapDelta } from '../modules/world.js';
import { showToast } from '../ui/toast.js';



import {
  onNodeKilled, onCoreKilled, onDelivery,
  checkExtractionStoryProgress, handleStoryMissionDeath,
  resolvePrivateContractOnExtraction, resolvePrivateContractOnDeath,
  computeGlobalStatsModifiers, resolveGlobalContractsOnExtraction, resolveGlobalContractsOnDeath,
  tickContractTimers, initContractExpiries,
} from '../systems/contractSystem.js';

let app = null;
let gameState = null;
let renderer = null;
let tickerHandle = null;
let inputBound = false;
let actionMenuOpen = false;

function hexToInt(hex) {
  if (typeof hex === 'number') return hex;
  return parseInt(String(hex).replace('#', ''), 16);
}

function mapShipStatsToGame(shipBp, finalStats) {
  return {
    maxSpeed:     400 + finalStats.speed * 10,
    bulletDamage: Math.max(1, Math.round(finalStats.attack / 25)),
    defenseMul:   Math.max(0.25, 1 - finalStats.defense / 150),
    fireRate:     Math.max(0.05, 1.2 / Math.max(0.1, finalStats.firerate)),
    invulnTime:   Math.max(0.5, finalStats.shieldDelay),
    shipColor:    hexToInt(shipBp.color),
    shipImg:      shipBp.img || null, 
    bulletColor:  hexToInt(shipBp.bulletColor),
    accentColor:  hexToInt(shipBp.accentColor),
  };
}

let deliveryLock = false;

function updateContractDelivery(gs, screen) {
  const c = state.currentContract;
  if (!c || !c.delivery || c.delivered) {
    state.deliveryPrompt = null;
    return;
  }

  const server = gs.servers[0];
  if (!server) { state.deliveryPrompt = null; return; }

  const target = getDeliveryTarget(c, server, gs.player);
  if (!target) { state.deliveryPrompt = null; return; }

  const dx = wrapDelta(target.x - gs.player.x, WORLD_W);
  const dy = wrapDelta(target.y - gs.player.y, WORLD_H);
  const range = (target.radius || 20) + 60;
  const dist2 = dx * dx + dy * dy;
  if (dist2 > range * range) { state.deliveryPrompt = null; return; }

  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  const hasItems = cd?.internalItems?.some(it => it._contractItem === c.id);
  if (!hasItems) { state.deliveryPrompt = null; return; }

  state.deliveryPrompt = {
    label: `[E] Deliver to ${target === server.core ? 'Core' : target.category?.toUpperCase() + ' Node'}`,
    target,
  };
}

function getDeliveryTarget(contract, server, player) {
  const d = contract.delivery;
  if (!d) return null;
  if (d.target === 'core') return server.core.broken ? null : server.core;

  const isNode = d.target === 'node' || d.target === 'any_node';
  if (!isNode) return null;

  const candidates = server.nodes.filter(n =>
    !n.broken &&
    (d.target === 'any_node' || !d.targetCategory || n.category === d.targetCategory)
  );
  if (candidates.length === 0) return null;

  let nearest = null, nearestDist = Infinity;
  for (const n of candidates) {
    const dx = wrapDelta(n.x - player.x, WORLD_W);
    const dy = wrapDelta(n.y - player.y, WORLD_H);
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestDist) { nearest = n; nearestDist = d2; }
  }
  return nearest;
}

export async function startGame() {
  const vr          = state.activeVR;
  const consoleItem = state.activeConsole;
  const cd          = consoleItem?.hardware?.cdSlot?.items?.[0];

  initContractExpiries();

  if (!vr || !consoleItem || !cd) throw new Error('Missing VR / console / CD.');

  const shipBp = getShipBlueprint(cd.shipKey);
  if (!shipBp) throw new Error(`Unknown ship blueprint: ${cd.shipKey}`);

  const finalStats = calculateStats(consoleItem, shipBp.baseStats, state.activeVR);
  const shipConfig = mapShipStatsToGame(shipBp, finalStats);

  if (!app) {
    app = new PIXI.Application();
    await app.init({
      resizeTo: window,
      background: '#000000',
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    document.getElementById('gameHost').appendChild(app.canvas);

    app.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.error('WebGL context lost. Reloading...');
      window.location.reload();
    });
  }

  gameState = createGameState(shipConfig, state.currentSector?.tier || null);
  gameState.cdItem = cd;
  gameState.shipConfig = shipConfig;
  gameState.inventoryOpen = false;

  // Reset session-scoped state
  gameState.aiShips = [];
  gameState.aiBullets = [];
  gameState.sectorClearedFired = false;
  resetDefenseState();
  gameState.gate = null;
  initSpoilsSystem();
  gameState.deathHandled = false;
    // Initialize player weapons from ship blueprint
  const shipBpForWeapons = getShipBlueprint(cd.shipKey);
  const weaponKeys = shipBpForWeapons?.weapons || ['pulse'];
  gameState.playerWeapons = weaponKeys.map(k => ({ key: k, cooldown: 0 }));
  gameState.currentWeaponSlot = 0;
  gameState.specialCooldown = 0;
  gameState.projectiles = gameState.projectiles || [];
  state.actionTarget = null;
  state.hasMasterKey = false;
  ensureGateButton();
  actionMenuOpen = false;
  state.nearInteractive = false;
  state.menuVisible = false;
  

  if (renderer) renderer.destroy?.();
  renderer = new RenderSystem(app);

  if (!inputBound) {
    initInput(app.canvas);
    app.canvas.addEventListener('pointerdown', onGamePointerDown);
    window.addEventListener('keydown', onGameKeyDown);
    window.addEventListener('game:death', handleDeath);
    window.addEventListener('game:escape', handleEscape);
    window.addEventListener('sector:core-killed', () => {
      onCoreKilled();
    });
    window.addEventListener('sector:node-killed', (e) => {
      const detail = e.detail || {};
      const node = detail.node;
      if (node?.category === 'security' && !state.hasMasterKey) {
        state.hasMasterKey = true;
        showToast('Master Key acquired from Security node', {
          type: 'success', icon: '🔑', duration: 3500,
        });
      }
      if (state.corpThreat < 5) {
        state.corpThreat++;
        saveCorpThreat();
      }
      onNodeKilled(node?.category || null);
    });
    window.addEventListener('sector:core-killed', () => {
      onCoreKilled();
    });
    window.addEventListener('contract:delivery-failed', (e) => {
      showToast(`Cannot deploy: ${e.detail.reason}`, { type: 'warning', duration: 4000 });
    });
    const toggle = document.getElementById('sidebarToggle');
    if (toggle && !toggle.dataset.wired) {
      toggle.dataset.wired = '1';
      toggle.addEventListener('click', () => {
        const sb = document.getElementById('gameSidebar');
        if (!sb) return;
        const collapsed = sb.classList.toggle('collapsed');
        toggle.textContent = collapsed ? '›' : '‹';
      });
    }
    window.addEventListener('sector:node-killed', onNodeKilledPropagate);
    window.addEventListener('sector:core-killed', onCoreKilledPropagate);
    inputBound = true;
  }

  document.getElementById('navBar').style.display = 'none';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('uiRoot').style.display = 'none';
  document.getElementById('gameHost').style.display = 'block';

  const sidebar = document.getElementById('gameSidebar');
  if (sidebar) {
    sidebar.style.display = 'flex';
    sidebar.classList.remove('collapsed');
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) toggle.textContent = '‹';
  }

  app.renderer.resize(window.innerWidth, window.innerHeight);

  state.raidActive = true;
  try { await forceAutoSave(); } catch (e) { console.warn('[game] pre-raid save failed:', e); }

  // Robust ticker registration — always remove-then-add by function reference.
  app.ticker.remove(tick);
  app.ticker.add(tick);
  tickerHandle = tick;
}

function tick(ticker) {
  if (!gameState) return;
  let dt = ticker.deltaMS / 1000;
  if (dt > 0.05) dt = 0.05;

  const gs = gameState;

  updatePlayer(gs, dt, app.screen);
  if (gameState !== gs) return;

  updateWeaponCooldowns(gs, dt);
  updateProjectiles(gs, dt);

  updateAsteroids(gs, dt, app.screen);
  if (gameState !== gs) return;

  updateBullets(gs, dt);
  if (gameState !== gs) return;

  resolvePlayerDamage(gs, dt);
  if (gameState !== gs) return;

  updateServers(gs, dt);
  if (gameState !== gs) return;

  updateContractDelivery(gs, app.screen);
  if (gameState !== gs) return;

  updateDefense(gs, dt);
  if (gameState !== gs) return;

  computeGameActions();
  state.menuVisible = actionMenuOpen;
  renderGameActionMenu();
  updateSidebar();
  if (gameState !== gs) return;

  renderer.sync(gs, app.screen);
}

function onGameKeyDown(e) {
  if (!gameState) return;
  if (e.repeat) return;
  const k = e.key.toLowerCase();

    // Weapon slot switch (1-4)
  if (k >= '1' && k <= '4') {
    e.preventDefault();
    const idx = parseInt(k, 10) - 1;
    switchWeapon(gameState, idx);
    return;
  }

  // Flares (F key)
  if (k === 'f' && !state.activeOverlay) {
    e.preventDefault();
    fireFlares(gameState);
    return;
  }

  if (state.activeOverlay === 'inventory') {
    if (k === 'e' || k === 'f') { e.preventDefault(); return; }
    if (k === 'i') { e.preventDefault(); toggleInventory(); return; }
    if (e.key === 'Escape') { e.preventDefault(); toggleInventory(); }
    return;
  }
  if (state.activeOverlay) return;

  if (k === 'i') { e.preventDefault(); toggleInventory(); return; }

  if (e.key === 'Escape' && actionMenuOpen) {
    e.preventDefault();
    actionMenuOpen = false;
    state.actionTarget = null;
  }

  if (e.key === 'Escape' && actionMenuOpen) {
    e.preventDefault();
    actionMenuOpen = false;
  }
}

function toggleInventory() {
  if (state.activeOverlay === 'inventory') {
    closeGameInventory();
    state.activeOverlay = null;
    state.inventoryOpen = false;
    input.mouseDown = false;
  } else if (!state.activeOverlay) {
    state.activeOverlay = 'inventory';
    state.inventoryOpen = true;
    openGameInventory(gameState.cdItem, gameState);
  }
}

/* -------------------------------------------------------------------
   Gate button
   ------------------------------------------------------------------- */
function ensureGateButton() {
  const btn = document.getElementById('openGateBtn');
  if (!btn) return;
  btn.textContent = 'OPEN GATE';
  btn.disabled = false;
  btn.style.opacity = '';
  btn.style.cursor = '';
  if (!btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', onOpenGate);
  }
} 

function onOpenGate() {
  if (!gameState || gameState.gate) return;

  const sides = ['left', 'right', 'top', 'bottom'];
  const side  = sides[Math.floor(Math.random() * 4)];

  const margin = BORDER.gateMargin;
  const length = BORDER.gateLength;

  let start, end;
  if (side === 'left' || side === 'right') {
    start = margin + Math.random() * (WORLD_H - margin * 2 - length);
    end   = start + length;
  } else {
    start = margin + Math.random() * (WORLD_W - margin * 2 - length);
    end   = start + length;
  }

  gameState.gate = { side, start, end };

  const btn = document.getElementById('openGateBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = `GATE: ${side.toUpperCase()}`;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
  }
}

/* -------------------------------------------------------------------
   Death & escape
   ------------------------------------------------------------------- */
async function handleEscape() {
  setTimeout(async () => {
    const cd    = state.activeConsole?.hardware?.cdSlot?.items?.[0];
    const items = cd?.internalItems || [];

    /* ---- Contract resolution (NEW system only) ---- */
    // Story progress
    checkExtractionStoryProgress(items);

    // Global contracts (debt / survival / collection / stat_mod)
    const extractedValue = {
      credits: items.reduce((s, it) => s + ((it.value?.credits || 0) * (it.count || 1)), 0),
    };
    const globalMessages = resolveGlobalContractsOnExtraction(extractedValue, items);
    for (const msg of globalMessages) {
      showToast(msg, { type: 'info', duration: 3000 });
    }

    // Private contract
    if (state.currentContract) {
      const result = resolvePrivateContractOnExtraction();
      if (result) {
        const contract = result.contract;
        if (result.result === 'objective_met') {
          showToast(`Objective complete: ${contract.name}. Return to the contact to claim.`, { type: 'success', icon: '★', duration: 4000 });
        } else if (result.result === 'fail') {
          showToast(`Contract failed: ${contract.name} (${contract.failReason || ''})`, { type: 'danger', duration: 4000 });
        } else {
          showToast(`Progress on ${contract.name}`, { type: 'info', duration: 3000 });
        }
      }
    }
    state.currentContract = null;

    // Tick all OTHER contracts' expiry + deadline timers
    tickContractTimers(state.currentContract?.id || null);

    /* ---- Extraction result snapshot ---- */
    const snapshot = JSON.parse(JSON.stringify(items));
    const data = {
      items: snapshot,
      itemCols: cd?.internalCols || 6,
      itemRows: cd?.internalRows || 5,
      value: computeItemsValue(snapshot),
      sector: state.currentSector,
    };
    state.lastExtraction = data;

    state.raidsCompleted += 1;
    saveRaidStats();
    advanceMarketAfterRaid(state.market);
    saveMarket();

    state.raidActive = false;
    await forceAutoSave();

    if (app && tickerHandle) {
      app.ticker.remove(tick);
      tickerHandle = null;
    }
    document.getElementById('gameHost').style.display = 'none';

    showExtractionResults(data, () => returnToMenu());
  }, 0);
}

async function handleDeath() {
  const consoleItem = state.activeConsole;
  const cd = consoleItem?.hardware?.cdSlot?.items?.[0];
  const cdName = cd?.name || 'Unknown CD';

  if (consoleItem?.hardware?.cdSlot) {
    consoleItem.hardware.cdSlot.items = [];
  }

  state.raidsFailed += 1;
  saveRaidStats();
  advanceMarketAfterRaid(state.market);
  saveMarket();

  /* ---- Contract resolution (NEW system only) ---- */
  resolveGlobalContractsOnDeath();
  handleStoryMissionDeath();
  if (state.currentContract) {
    const result = resolvePrivateContractOnDeath();
    if (result) {
      const contract = result.contract;
      if (result.result === 'objective_met') {
        showToast(`Objective complete: ${contract.name}. Return to claim.`, { type: 'success', icon: '★', duration: 4000 });
      } else {
        showToast(`Contract failed: ${contract.name}`, { type: 'danger', duration: 4000 });
      }
    }
  }
  state.currentContract = null;

  tickContractTimers(state.currentContract?.id || null);

  state.raidActive = false;
  await forceAutoSave();

  const msg = document.createElement('div');
  msg.textContent = `SHIP DESTROYED — ${cdName} LOST`;
  msg.style.cssText = `
    position: fixed; top: 40%; left: 50%;
    transform: translate(-50%, -50%);
    background: #4a0a0a; color: #ff8080;
    padding: 20px 40px;
    border: 2px solid #f85149;
    font-family: monospace; font-size: 18px;
    font-weight: bold; letter-spacing: 2px;
    z-index: 20000; border-radius: 6px;
    box-shadow: 0 0 24px rgba(248, 81, 73, 0.6);
  `;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2600);

  setTimeout(returnToMenu, 2700);
}

function returnToMenu() {
  state.raidActive = false;
  if (app && tickerHandle) {
    app.ticker.remove(tick);
    tickerHandle = null;
  }

  

  if (state.activeOverlay === 'inventory') closeGameInventory();
  state.activeOverlay = null;
  state.inventoryOpen = false;
  state.currentContract = null;
  state.currentSector = null;
  state.currentContract = null;
  state.deliveryPrompt = null;

  document.getElementById('gameHost').style.display = 'none';
  document.getElementById('uiRoot').style.display   = '';
  document.getElementById('navBar').style.display   = '';

  const sidebar = document.getElementById('gameSidebar');
  if (sidebar) sidebar.style.display = 'none';

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-hangar')?.classList.add('active');

  actionMenuOpen = false;
  const am = document.getElementById('gameActionMenu');
  if (am) { am.style.display = 'none'; am.dataset.sig = ''; }

  gameState = null;
  state.currentSector = null;
  window.dispatchEvent(new CustomEvent('hangar:changed'));
}

/* -------------------------------------------------------------------
   Exploit injection
   ------------------------------------------------------------------- */
function tryInjectExploit(targetNode = null) {
  const server = gameState?.servers?.[0];
  if (!server) return;
  const player = gameState.player;

  let nearest = targetNode;

  if (!nearest) {
    let nearestDist = Infinity;
    const range = EXPLOIT_INJECTION.range;
    for (const node of server.nodes) {
      if (node.broken) continue;
      const dx = wrapDelta(node.x - player.x, WORLD_W);
      const dy = wrapDelta(node.y - player.y, WORLD_H);
      const d2 = dx * dx + dy * dy;
      if (d2 < range * range && d2 < nearestDist) {
        nearest = node;
        nearestDist = d2;
      }
    }
  }

  if (!nearest) {
    showToast('No node in range to inject.', { type: 'warning' });
    return;
  }

  const hpPct = nearest.hp / nearest.maxHp;
  if (hpPct > EXPLOIT_INJECTION.hpThreshold) {
    const pct = Math.round(EXPLOIT_INJECTION.hpThreshold * 100);
    showToast(`Node must be exposed (≤${pct}% HP) to inject.`, { type: 'warning' });
    return;
  }

  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (!cd || !cd.internalItems) {
    showToast('No CD equipped.', { type: 'warning' });
    return;
  }
  const exploit = cd.internalItems.find(i => i.key === 'exploit');
  if (!exploit) {
    showToast('Requires 1× Exploit Kit in cargo.', { type: 'warning' });
    return;
  }

  exploit.count = (exploit.count || 1) - 1;
  if (exploit.count <= 0) {
    const idx = cd.internalItems.indexOf(exploit);
    if (idx !== -1) cd.internalItems.splice(idx, 1);
  }

  nearest.injectTimer = EXPLOIT_INJECTION.dotDuration;
  nearest.injectDps   = nearest.maxHp / EXPLOIT_INJECTION.dotDuration;
  nearest.compromised = true;

  showToast(`Exploit injected into ${nearest.category.toUpperCase()} node.`, {
    type: 'success', icon: '⚡',
  });
  window.dispatchEvent(new CustomEvent('inventory:changed'));
}

/* -------------------------------------------------------------------
   Contextual action menu
   ------------------------------------------------------------------- */
function computeGameActions() {
  const actions = [];
  const gs = gameState;
  if (!gs) { state.gameActions = []; state.nearInteractive = false; return; }
  const server = gs.servers?.[0];
  if (!server) { state.gameActions = []; state.nearInteractive = false; return; }

  const player = gs.player;
  const injR2 = EXPLOIT_INJECTION.range * EXPLOIT_INJECTION.range;

  let nearInteractive = false;
  if (!server.core.broken) {
    const dx = wrapDelta(server.core.x - player.x, WORLD_W);
    const dy = wrapDelta(server.core.y - player.y, WORLD_H);
    if (dx * dx + dy * dy < injR2) nearInteractive = true;
  }
  for (const node of server.nodes) {
    if (node.broken) continue;
    const dx = wrapDelta(node.x - player.x, WORLD_W);
    const dy = wrapDelta(node.y - player.y, WORLD_H);
    if (dx * dx + dy * dy < injR2) { nearInteractive = true; break; }
  }
  state.nearInteractive = nearInteractive;

  const target = state.actionTarget;
  if (!target || !target.ref) { state.gameActions = []; return; }

  if (target.ref.broken) {
    state.actionTarget = null;
    actionMenuOpen = false;
    state.gameActions = [];
    return;
  }

  const tx = wrapDelta(target.ref.x - player.x, WORLD_W);
  const ty = wrapDelta(target.ref.y - player.y, WORLD_H);
  if (tx * tx + ty * ty > injR2) {
    actions.push({
      label: 'Move closer to interact',
      enabled: false, reason: 'Out of range', run: () => {},
    });
    state.gameActions = actions;
    return;
  }

  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];

  // Delivery
  const c = state.currentContract;
  if (c?.delivery && !c.delivered) {
    const matches =
      (c.delivery.target === 'core'      && target.type === 'core') ||
      (c.delivery.target === 'any_node'  && target.type === 'node') ||
      (c.delivery.target === 'node'      && target.type === 'node' &&
        (!c.delivery.targetCategory || c.delivery.targetCategory === target.ref.category));

    if (matches) {
      const hasItems = cd?.internalItems?.some(it => it._contractItem === c.id);
      const isCore = target.type === 'core';
      actions.push({
        label: isCore ? 'Deliver to Core' : `Deliver to ${target.ref.category?.toUpperCase()} Node`,
        enabled: !!hasItems,
        reason: hasItems ? null : 'No delivery items in cargo',
        run: () => {
          if (!hasItems) return;
          for (let i = cd.internalItems.length - 1; i >= 0; i--) {
            if (cd.internalItems[i]._contractItem === c.id) cd.internalItems.splice(i, 1);
          }
          onDelivery(c);
          showToast(`Delivered: ${c.name}`, { type: 'success', icon: '✓' });
          window.dispatchEvent(new CustomEvent('inventory:changed'));
          state.actionTarget = null;
          actionMenuOpen = false;
        },
      });
    }
  }

  // Exploit injection (nodes only)
  if (target.type === 'node') {
    const node = target.ref;

    if (node.exploited) {
      const tierCfg = EXPLOIT_TIERS.find(t => t.tier === node.exploitTier);
      actions.push({
        label: `Exploit Active · ${tierCfg?.name || '?'}`,
        enabled: false,
        reason: `${Math.ceil(node.exploitRemaining)}s remaining`,
        run: () => {},
      });
    } else if (!state.hasMasterKey) {
      actions.push({
        label: 'Inject Exploit — locked',
        enabled: false,
        reason: 'Requires Master Key (kill a Security node)',
        variant: 'locked',
        run: () => {},
      });
    } else {
      const kits = cd?.internalItems
        ?.filter(i => i.key === 'exploit')
        .reduce((s, i) => s + (i.count || 1), 0) || 0;

      for (const tierCfg of EXPLOIT_TIERS) {
        const canAfford = kits >= tierCfg.cost;
        actions.push({
          label: `Inject Exploit · ${tierCfg.name} (${tierCfg.cost} kit${tierCfg.cost > 1 ? 's' : ''})`,
          enabled: canAfford,
          reason: canAfford ? null : `Requires ${tierCfg.cost}× Exploit Kit`,
          run: () => {
            injectExploit(node, tierCfg);
            state.actionTarget = null;
            actionMenuOpen = false;
          },
        });
      }
    }
  }

  if (actions.length === 0) {
    actions.push({ label: 'No actions available', enabled: false, reason: null, run: () => {} });
  }

  state.gameActions = actions;
}

function renderGameActionMenu() {
  const menu = document.getElementById('gameActionMenu');
  const list = document.getElementById('gameActionList');
  if (!menu || !list) return;

  const actions = state.gameActions || [];

  if (!actionMenuOpen) {
    menu.style.display = 'none';
    return;
  }
  menu.style.display = 'block';

  const headerEl = menu.querySelector('.game-action-header');
  if (headerEl) {
    let txt = 'ACTIONS';
    if (state.actionTarget) {
      if (state.actionTarget.type === 'core') txt = 'ACTIONS · CORE';
      else {
        const cat = state.actionTarget.ref.category?.toUpperCase() || '';
        txt = `ACTIONS · ${cat} NODE`;
      }
    }
    headerEl.textContent = txt;
  }

  const sig = actions.map(a => `${a.label}|${a.enabled}|${a.reason || ''}`).join('||');
  if (menu.dataset.sig === sig) return;
  menu.dataset.sig = sig;

  list.innerHTML = '';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = 'game-action-btn';
    btn.disabled = !action.enabled;
    btn.textContent = action.label;
    if (action.reason) btn.title = action.reason;
    if (action.variant === 'locked') btn.classList.add('game-action-btn--locked');
    btn.addEventListener('click', () => {
      if (!action.enabled) return;
      action.run();
    });
    list.appendChild(btn);
  }
}

function updateSidebar() {
  if (!gameState) return;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('sbHp', gameState.player.hp.toFixed(0));
  set('sbThreat', `${state.corpThreat}/5`);
  set('sbSector', state.currentSector?.name || '—');
  set('sbPos', `${gameState.player.x.toFixed(0)}, ${gameState.player.y.toFixed(0)}`);
  const srv = gameState.servers?.[0];
  if (srv) {
    import('../systems/serverSystem.js').then(({ getShieldPct }) => {
      set('sbShield', `${getShieldPct(srv).toFixed(0)}%`);
    });
  }
}

function onGamePointerDown(e) {
  if (e.button !== 2) return;
  if (!gameState || state.activeOverlay) return;

  const rect = app.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const cx = app.screen.width  / 2;
  const cy = app.screen.height / 2;
  const worldX = gameState.player.x + (mx - cx);
  const worldY = gameState.player.y + (my - cy);

  const server = gameState.servers?.[0];
  if (!server) return;

  let target = null;

  if (!server.core.broken) {
    const ddx = wrapDelta(server.core.x - worldX, WORLD_W);
    const ddy = wrapDelta(server.core.y - worldY, WORLD_H);
    const r = server.core.radius + 12;
    if (ddx * ddx + ddy * ddy < r * r) {
      target = { type: 'core', ref: server.core };
    }
  }

  if (!target) {
    for (const node of server.nodes) {
      if (node.broken) continue;
      const ddx = wrapDelta(node.x - worldX, WORLD_W);
      const ddy = wrapDelta(node.y - worldY, WORLD_H);
      const r = node.radius + 12;
      if (ddx * ddx + ddy * ddy < r * r) {
        target = { type: 'node', ref: node };
        break;
      }
    }
  }

  if (!target) {
    state.actionTarget = null;
    actionMenuOpen = false;
    return;
  }

  const ddx = wrapDelta(target.ref.x - gameState.player.x, WORLD_W);
  const ddy = wrapDelta(target.ref.y - gameState.player.y, WORLD_H);
  const dist2 = ddx * ddx + ddy * ddy;
  const range2 = EXPLOIT_INJECTION.range * EXPLOIT_INJECTION.range;

  if (dist2 > range2) {
    showToast('Too far to interact.', { type: 'warning' });
    return;
  }

  state.actionTarget = target;
  actionMenuOpen = true;
}

function injectExploit(node, tierCfg) {
  const cd = state.activeConsole?.hardware?.cdSlot?.items?.[0];
  if (!cd || !cd.internalItems) return;

  let needed = tierCfg.cost;
  for (let i = cd.internalItems.length - 1; i >= 0 && needed > 0; i--) {
    const it = cd.internalItems[i];
    if (it.key !== 'exploit') continue;
    const take = Math.min(needed, it.count || 1);
    it.count -= take;
    needed -= take;
    if (it.count <= 0) cd.internalItems.splice(i, 1);
  }

  node.exploited = true;
  node.exploitTier = tierCfg.tier;
  node.exploitRemaining = tierCfg.duration;
  node.exploitGroupTimer = 0.6;
  node.exploitPacketsQueue = [];

  showToast(`Exploit ${tierCfg.name} injected into ${node.category.toUpperCase()} node.`, {
    type: 'success', icon: '⚡', duration: 3000,
  });
  window.dispatchEvent(new CustomEvent('inventory:changed'));
}

function onNodeKilledPropagate(e) {
  const node = e.detail?.node;
  if (!node || !gameState) return;
  for (const a of gameState.asteroids) {
    if (a.nodeRef === node && !a.dying && a.state === 'waiting') {
      a.broken = true;
      a.dying = true;
      a.dyingTimer = PACKET_DYING_DURATION;
      a.transit = null;
      a.state = 'waiting';
    }
  }
}

function onCoreKilledPropagate(e) {
  const server = e.detail?.server;
  if (!server || !gameState) return;
  if (renderer) renderer.triggerAlert(server.x, server.y);

  // Kill all packets (they die in place, blink, vanish)
  for (const a of gameState.asteroids) {
    if (!a.dying) {
      a.broken = true;
      a.dying = true;
      a.dyingTimer = PACKET_DYING_DURATION;
      a.transit = null;
      a.state = 'waiting';
    }
  }

  // Kill all remaining nodes — fires their own sector:node-killed events
  // (so spoils generate + contracts progress + master key checks run)
  for (const node of server.nodes) {
    if (!node.broken) {
      node.hp = 0;
      node.broken = true;
      window.dispatchEvent(new CustomEvent('sector:node-killed', {
        detail: { server, node },
      }));
    }
  }
}

function updateProjectiles(gs, dt) {
  const player = gs.player;

  for (let i = gs.projectiles.length - 1; i >= 0; i--) {
    const p = gs.projectiles[i];
    p.lifetime -= dt;
    if (p.lifetime <= 0) { gs.projectiles.splice(i, 1); continue; }

    if (p.kind === 'missile') {
      updateMissile(p, gs, dt);
    } else if (p.kind === 'flare') {
      updateFlare(p, gs, dt);
    }
  }
}

function updateMissile(p, gs, dt) {
  // Drop dead / broken targets
  if (p.target && (p.target.hp <= 0 || p.target.broken)) p.target = null;

  // ---- Steering: rotate heading toward target ----
  if (p.target) {
    const dx = wrapDelta(p.target.x - p.x, WORLD_W);
    const dy = wrapDelta(p.target.y - p.y, WORLD_H);
    const targetAngle = Math.atan2(dy, dx);

    let diff = targetAngle - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-p.turnRate * dt, Math.min(p.turnRate * dt, diff));
    p.angle += turn;
  }

  // ---- Thrust along heading ----
  p.vx += Math.cos(p.angle) * p.accel * dt;
  p.vy += Math.sin(p.angle) * p.accel * dt;

  // ---- Drag ----
  const dragFactor = Math.max(0, 1 - p.drag * dt);
  p.vx *= dragFactor;
  p.vy *= dragFactor;

  // ---- Speed cap ----
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > p.maxSpeed) {
    p.vx = p.vx / speed * p.maxSpeed;
    p.vy = p.vy / speed * p.maxSpeed;
  }

  // ---- Move ----
  p.x = wrapPos(p.x + p.vx * dt, WORLD_W);
  p.y = wrapPos(p.y + p.vy * dt, WORLD_H);

  // ---- Collision ----
  if (p.owner === 'player') {
    for (const ship of gs.aiShips) {
      const dx = wrapDelta(ship.x - p.x, WORLD_W);
      const dy = wrapDelta(ship.y - p.y, WORLD_H);
      const r = ship.size + 6;
      if (dx * dx + dy * dy < r * r) {
        applyMissileHit(p, ship, gs);
        return;
      }
    }
  } else {
    const dx = wrapDelta(gs.player.x - p.x, WORLD_W);
    const dy = wrapDelta(gs.player.y - p.y, WORLD_H);
    const r = gs.player.r + 6;
    if (dx * dx + dy * dy < r * r && gs.player.invuln <= 0) {
      gs.player.hp -= p.damage * (gs.player.defenseMul || 1);
      gs.player.invuln = 0.4;
      const idx = gs.projectiles.indexOf(p);
      if (idx !== -1) gs.projectiles.splice(idx, 1);
    }
  }
}

function applyMissileHit(p, hitShip, gs) {
  hitShip.hp -= p.damage;
  if (hitShip.hp <= 0) hitShip.hp = 0;

  // Splash to nearby enemies
  if (p.splashRadius > 0) {
    for (const other of gs.aiShips) {
      if (other === hitShip) continue;
      const dx = wrapDelta(other.x - p.x, WORLD_W);
      const dy = wrapDelta(other.y - p.y, WORLD_H);
      if (dx * dx + dy * dy < p.splashRadius * p.splashRadius) {
        other.hp -= p.splashDamage;
        if (other.hp <= 0) other.hp = 0;
      }
    }
  }

  const idx = gs.projectiles.indexOf(p);
  if (idx !== -1) gs.projectiles.splice(idx, 1);
}

function updateFlare(p, gs, dt) {
  p.x = wrapPos(p.x + p.vx * dt, WORLD_W);
  p.y = wrapPos(p.y + p.vy * dt, WORLD_H);

  p.vx *= 0.97;
  p.vy *= 0.97;

  if (p.owner !== 'player') return;

  /* ---- Destroy enemy bullets ---- */
  for (let i = gs.aiBullets.length - 1; i >= 0; i--) {
    const b = gs.aiBullets[i];
    const dx = wrapDelta(b.x - p.x, WORLD_W);
    const dy = wrapDelta(b.y - p.y, WORLD_H);
    const r = p.damageRadius + 4;
    if (dx * dx + dy * dy < r * r) {
      gs.aiBullets.splice(i, 1);
    }
  }

  /* ---- Destroy enemy missiles ---- */
  for (let i = gs.projectiles.length - 1; i >= 0; i--) {
    const other = gs.projectiles[i];
    if (other === p) continue;
    if (other.kind !== 'missile') continue;
    if (other.owner === 'player') continue;
    const dx = wrapDelta(other.x - p.x, WORLD_W);
    const dy = wrapDelta(other.y - p.y, WORLD_H);
    const r = p.damageRadius + (other.size || 4) + 4;
    if (dx * dx + dy * dy < r * r) {
      gs.projectiles.splice(i, 1);
      // Flare also consumed
      const idx = gs.projectiles.indexOf(p);
      if (idx !== -1) gs.projectiles.splice(idx, 1);
      return;
    }
  }

  const server = gs.servers?.[0];

  /* ---- Damage nodes ---- */
  if (server) {
    for (const node of server.nodes) {
      if (node.broken) continue;
      const dx = wrapDelta(node.x - p.x, WORLD_W);
      const dy = wrapDelta(node.y - p.y, WORLD_H);
      const r = node.radius + p.damageRadius;
      if (dx * dx + dy * dy < r * r) {
        node.hp -= p.damage;
        if (node.hp <= 0) {
          node.hp = 0;
          node.broken = true;
          window.dispatchEvent(new CustomEvent('sector:node-killed', {
            detail: { server, node },
          }));
        }
        const idx = gs.projectiles.indexOf(p);
        if (idx !== -1) gs.projectiles.splice(idx, 1);
        return;
      }
    }
  }

  /* ---- Damage core (only when shield is down) ---- */
  if (server && !server.core.broken) {
    const dx = wrapDelta(server.core.x - p.x, WORLD_W);
    const dy = wrapDelta(server.core.y - p.y, WORLD_H);
    const r = server.core.radius + p.damageRadius;
    if (dx * dx + dy * dy < r * r) {
      const shieldPct = getShieldPct(server);
      if (shieldPct <= 0) {
        server.core.hp -= p.damage;
        if (server.core.hp <= 0) {
          server.core.hp = 0;
          server.core.broken = true;
          window.dispatchEvent(new CustomEvent('sector:core-killed', {
            detail: { server },
          }));
        }
      }
      const idx = gs.projectiles.indexOf(p);
      if (idx !== -1) gs.projectiles.splice(idx, 1);
      return;
    }
  }

  /* ---- Damage packets ---- */
  for (const a of gs.asteroids) {
    if (a.broken || a.dying) continue;
    const dx = wrapDelta(a.x - p.x, WORLD_W);
    const dy = wrapDelta(a.y - p.y, WORLD_H);
    const r = a.s + p.damageRadius;
    if (dx * dx + dy * dy < r * r) {
      a.contamination += p.damage;
      if (!a.encrypted && a.contaminationState === 'clean' && a.contamination >= a.maxContamination) {
        a.contaminationState = 'light';
        a.damage = a.tierLightDamage || 1;
      }
      if (a.contamination >= a.maxKill) {
        a.broken = true;
        a.dying = true;
        a.dyingTimer = PACKET_DYING_DURATION;
        a.transit = null;
        a.state = 'waiting';
      }
      const idx = gs.projectiles.indexOf(p);
      if (idx !== -1) gs.projectiles.splice(idx, 1);
      return;
    }
  }

  /* ---- Damage AI ships ---- */
  for (const ship of gs.aiShips) {
    const dx = wrapDelta(ship.x - p.x, WORLD_W);
    const dy = wrapDelta(ship.y - p.y, WORLD_H);
    const r = ship.size + p.damageRadius;
    if (dx * dx + dy * dy < r * r) {
      ship.hp -= p.damage;
      if (ship.hp <= 0) ship.hp = 0;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      ship.vx -= (dx / d) * p.repulseForce;
      ship.vy -= (dy / d) * p.repulseForce;
      const idx = gs.projectiles.indexOf(p);
      if (idx !== -1) gs.projectiles.splice(idx, 1);
      return;
    }
  }
}

/* -------------------------------------------------------------------
   Inventory close-for-loot event (kept for networkPanel compat)
   ------------------------------------------------------------------- */
window.addEventListener('inventory:closeForLoot', () => {
  closeGameInventory();
  state.activeOverlay = null;
  state.inventoryOpen = false;
});