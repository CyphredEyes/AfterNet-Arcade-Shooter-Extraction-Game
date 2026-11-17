/* ===================================================================
   Game mode + sector selection flow
   =================================================================== */

import { showToast } from './toast.js';

const GAME_MODES = [
  {
    id: 'breach',
    name: 'BREACH SECTORS',
    icon: '◈',
    description: 'Infiltrate and destroy a sector\'s network.',
    shape: 'breach',
    enabled: true,
  },
  {
    id: 'dungeon',
    name: 'DUNGEON',
    icon: '⬢',
    description: 'Coming soon.',
    shape: 'square',
    enabled: false,
  },
  {
    id: 'contracts',
    name: 'CONTRACTS',
    icon: '⚑',
    description: 'Coming soon.',
    shape: 'square',
    enabled: true,
  },
];

const SECTORS = [
  { id: 'low',     name: 'Low Security',  tier: 'LOW',     difficulty: 1, color: '#3fb950',
    description: 'Residential zones. Weak corp presence.' },
  { id: 'mid',     name: 'Mid Security',  tier: 'MID',     difficulty: 2, color: '#d29922',
    description: 'Commercial hubs. Standard defense.' },
  { id: 'high',    name: 'High Security', tier: 'HIGH',    difficulty: 3, color: '#f85149',
    description: 'Corporate assets. Heavy resistance.' },
  { id: 'extreme', name: 'Extreme',       tier: 'EXTREME', difficulty: 4, color: '#a371f7',
    description: 'Classified facilities. Extreme threat.' },
];

/* -------------------------------------------------------------------
   Open the mission-type modal
   ------------------------------------------------------------------- */
export function openGameModeModal() {
  const body  = document.getElementById('gameModeBody');
  const modal = document.getElementById('gameModeModal');
  if (!body || !modal) return;

  body.innerHTML = '';

  for (const mode of GAME_MODES) {
    const card = document.createElement('div');
    card.className = `gamemode-card ${mode.shape}`;
    if (!mode.enabled) card.classList.add('disabled');

    card.innerHTML = `
      <div class="gamemode-card-icon">${mode.icon}</div>
      <div class="gamemode-card-name">${mode.name}</div>
      <div class="gamemode-card-desc">${mode.description}</div>
    `;

    if (mode.enabled) {
      card.addEventListener('click', () => {
        closeModal('gameModeModal');
        if (mode.id === 'breach')    openSectorSelect();
        if (mode.id === 'contracts') openContractsSelect();
      });
    }

    body.appendChild(card);
  }

  modal.classList.add('open');
}


/* -------------------------------------------------------------------
   Launch
   ------------------------------------------------------------------- */
function launchBreach(sector) {
  import('../core/state.js').then(({ state }) => {
    state.currentSector = sector;
    state.currentContract = null;
    state.actionTarget = null;
  });
  showToast(`Launching into ${sector.name}…`, { type: 'info' });
  setTimeout(() => window.dispatchEvent(new CustomEvent('game:start')), 100);
}

/* -------------------------------------------------------------------
   Modal wiring — attached once
   ------------------------------------------------------------------- */
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    }
  });
});

function openSectorSelect() {
  const grid  = document.getElementById('sectorGridBody');
  const list  = document.getElementById('contractsSelectBody');
  const title = document.getElementById('sectorSelectTitle');
  const modal = document.getElementById('sectorSelectModal');
  if (!grid || !list || !modal) return;

  grid.style.display = '';
  list.style.display = 'none';
  if (title) title.textContent = 'SELECT SECTOR — BREACH';

  grid.innerHTML = '';
  for (const sector of SECTORS) {
    const card = document.createElement('div');
    card.className = 'sector-card';
    card.dataset.tier = sector.tier;
    card.innerHTML = `
      <div class="sector-card-tier">${sector.tier}</div>
      <div class="sector-card-name">${sector.name}</div>
      <div class="sector-card-desc">${sector.description}</div>
    `;
    card.addEventListener('click', () => {
      closeModal('sectorSelectModal');
      launchBreach(sector);
    });
    grid.appendChild(card);
  }

  modal.classList.add('open');
}

function openContractsSelect() {
  import('../core/state.js').then(({ state }) => {
    import('../systems/contractSystem.js').then(({ getActivePrivateContracts, beginPrivateRaid }) => {
      const active = getActivePrivateContracts();
      if (active.length === 0) {
        showToast('No active private contracts. Visit a contact in the Network tab.', { type: 'info', duration: 3500 });
        return;
      }

      const grid  = document.getElementById('sectorGridBody');
      const list  = document.getElementById('contractsSelectBody');
      const title = document.getElementById('sectorSelectTitle');
      const modal = document.getElementById('sectorSelectModal');
      if (!grid || !list || !modal) return;

      grid.style.display = 'none';
      list.style.display = '';
      if (title) title.textContent = 'SELECT CONTRACT — DEPLOY';

      list.innerHTML = '';

      for (const c of active) {
        const card = document.createElement('div');
        card.className = 'contracts-select-card';
        const stage = c.stages[c.currentStage];
        card.innerHTML = `
          <div class="contracts-select-name">${c.name}</div>
          <div class="contracts-select-desc">${c.description}</div>
          <div class="contracts-select-meta">
            <span>${c.sectorTier}</span>
            <span>Stage ${c.currentStage + 1}/${c.stages.length}</span>
            <span>${c.deadlineRemaining} raids left</span>
          </div>
        `;
        card.addEventListener('click', () => {
          if (!beginPrivateRaid(c)) return;
          closeModal('sectorSelectModal');
          state.currentSector = { id: c.id, name: c.name, tier: c.sectorTier, difficulty: 0 };
          showToast(`Deploying: ${c.name}`, { type: 'success' });
          setTimeout(() => window.dispatchEvent(new CustomEvent('game:start')), 100);
        });
        list.appendChild(card);
      }

      modal.classList.add('open');
    });
  });
}