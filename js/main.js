/* ===================================================================
   Main Entry Point - Green Horizon
   =================================================================== */
import { state, applyLoadedState, resetToFreshState } from './core/state.js';
import { createInventory, addItem } from './systems/grid-core.js';
import { makeItem } from './data/itemDB.js';
import { renderStorage } from './ui/storage.js';
import { renderHangar } from './ui/hangar.js';
import { renderMarket } from './ui/market.js';
import { startGame } from './game/gameBootstrap.js';
import { showToast } from './ui/toast.js';
import {
  initSaveSystem, getLatestSlot, saveBackend, setCurrentSlot, forceAutoSave,
} from './systems/saveBackend.js';
import { openSaveBrowser } from './ui/saveBrowser.js';
import { checkGamblerTimer } from './systems/marketSystem.js';
import { installDevCommands } from './dev/dev.js';


export function refreshCurrencies() {
  let tokens = 0;
  let chips = 0;

  function scanInventory(inv) {
    if (!inv || !inv.items) return;
    for (const item of inv.items) {
      if (item.key === 'itokens') tokens += item.count;
      if (item.key === 'gchips') chips += item.count;
      if (item.internalItems) scanInventory({ items: item.internalItems });
    }
  }

  scanInventory(state.stash);

  // Also scan active console + active VR? They aren't "storage" — skip.

  const crEl = document.getElementById('currency-credits');
  const itEl = document.getElementById('currency-tokens');
  const gcEl = document.getElementById('currency-chips');

  if (crEl) crEl.textContent = (state.credits || 0).toLocaleString();
  if (itEl) itEl.textContent = tokens.toLocaleString();
  if (gcEl) gcEl.textContent = chips.toLocaleString();
}

async function init() {
  await initSaveSystem();

  /* ---- Main menu ---- */
  document.body.classList.add('menu-open');
  document.querySelectorAll('#mainMenu .mainmenu-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMenuAction(btn.dataset.action));
  });

  /* ---- Nav ---- */
  const navBtns = document.querySelectorAll('.nav-btn[data-view]');
  const views   = document.querySelectorAll('.view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      views.forEach(v => v.classList.remove('active'));
      const view = document.getElementById(`view-${btn.dataset.view}`);
      if (view) view.classList.add('active');

      if (btn.dataset.view === 'storage') renderStorage();
      if (btn.dataset.view === 'hangar')  renderHangar();
      if (btn.dataset.view === 'market')  renderMarket();
    });
  });

  /* ---- Launch handler ---- */
  window.addEventListener('game:start', async () => {
    const vr          = state.activeVR;
    const consoleItem = state.activeConsole;
    const cd          = consoleItem?.hardware?.cdSlot?.items?.[0];

    if (!vr)          return showToast('Equip a VR headset before launching.', { type: 'warning' });
    if (!consoleItem) return showToast('Equip a console before launching.', { type: 'warning' });
    if (!cd)          return showToast('Slot a CD into the console before launching.', { type: 'warning' });

    try {
      await startGame();
    } catch (err) {
      console.error(err);
      showToast('Launch failed: ' + (err?.message || err), { type: 'danger' });
    }
  });

  /* ---- Currency float ---- */
  window.addEventListener('currency:delta', (e) => {
    const { type, delta } = e.detail || {};
    if (!delta) return;
    const abbrevMap = { credits: 'cr', itokens: 'it', gchips: 'gc' };
    const iconEl = document.querySelector(`.currency-icon.${abbrevMap[type]}`);
    if (!iconEl) return;
    const parent = iconEl.closest('.currency-item');
    if (!parent) return;
    const float = document.createElement('span');
    float.className = `currency-float ${delta > 0 ? 'positive' : 'negative'}`;
    float.textContent = (delta > 0 ? '+' : '') + delta.toLocaleString();
    parent.appendChild(float);
    setTimeout(() => float.remove(), 1300);
  });

  /* ---- Gambler timer ---- */
  setInterval(() => {
    if (!state.market) return;
    if (checkGamblerTimer(state.market)) {
      window.dispatchEvent(new CustomEvent('save:request'));
      const mv = document.getElementById('view-market');
      if (mv?.classList.contains('active')) renderMarket();
    }
  }, 5000);

  window.addEventListener('inventory:changed', refreshCurrencies);
  installDevCommands();
  refreshCurrencies();
}

/* ------------------------------------------------------------------- */
async function handleMenuAction(action) {
  if (action === 'new') {
    await openSaveBrowser({
      mode: 'new',
      onLoad: () => showHangar(),
    });
    return;
  }

  if (action === 'continue') {
    const latest = await getLatestSlot();
    if (!latest) {
      showToast('No saves found. Start a new game.', { type: 'info' });
      return;
    }
    try {
      const loaded = await saveBackend.loadSlot(latest.slotId);
      const info   = applyLoadedState(loaded);
      setCurrentSlot(latest.slotId);

      if (info?.recoveredFromRaid) {
        await forceAutoSave();
        showToast(
          'Raid failed — connection lost. Loaded CD destroyed.',
          { type: 'danger', duration: 4500 },
        );
      } else {
        showToast(`Continuing Slot ${latest.slotId + 1}`, { type: 'success', icon: '✓' });
      }

      showHangar();
    } catch (e) {
      showToast(`Load failed: ${e.message}`, { type: 'danger' });
    }
    return;
  }

  if (action === 'load') {
    await openSaveBrowser({
      mode: 'load',
      onLoad: () => showHangar(),
    });
    return;
  }

  showToast('Coming soon.', { type: 'info' });
}

/* ------------------------------------------------------------------- */
function showHangar() {
  document.body.classList.remove('menu-open');
  document.getElementById('mainMenu')?.classList.add('hidden');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-hangar')?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === 'hangar'),
  );

  renderHangar();
  renderStorage();
  refreshCurrencies();
}

init();