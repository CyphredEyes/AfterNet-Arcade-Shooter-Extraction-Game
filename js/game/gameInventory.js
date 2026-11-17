/* ===================================================================
   In-game inventory — ship cargo + network explorer tree.
   =================================================================== */

import { mountGrid } from '../systems/grid-core.js';
import { state } from '../core/state.js';
import { NODE_CATEGORIES } from '../modules/config.js';
import { showToast } from '../ui/toast.js';

let mountedGridId = null;
let lastGameState = null;
let currentPath   = [];
let networkRoot   = null;
let gridSeq       = 0;
let refreshTimer  = null;
let lastSignature = null;

/* -----------------------------------------------------------------
   Public entry points
   ----------------------------------------------------------------- */
export function isGameInventoryOpen() {
  return mountedGridId !== null;
}

export function openGameInventory(cdItem, gameState) {
  if (!cdItem || !cdItem.internalItems) {
    console.error('[inv] No CD item / no internalItems.');
    return;
  }
  if (mountedGridId) return;

  lastGameState = gameState || null;

  const overlay  = document.getElementById('gameInventoryOverlay');
  const host     = document.getElementById('gameInvGridHost');
  const title    = document.getElementById('gameInvTitle');
  const closeBtn = document.getElementById('gameInvClose');

  if (!overlay) { console.error('[inv] #gameInventoryOverlay MISSING from DOM.'); return; }
  if (!host)    { console.error('[inv] #gameInvGridHost MISSING from DOM.'); return; }

  host.innerHTML = '';
  title.textContent = `${cdItem.name} — SHIP CARGO`;
  overlay.style.display = 'flex';

  const inv = {
    cols: cdItem.internalCols,
    rows: cdItem.internalRows,
    items: cdItem.internalItems,
  };

  mountedGridId = `game-inv-${cdItem.id}-${Date.now()}`;
  mountGrid(mountedGridId, inv, host);

  networkRoot = buildNetworkRoot(gameState);
  currentPath = [networkRoot];
  renderExplorer();

  startAutoRefresh();

  closeBtn.onclick = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
  };
}

export function closeGameInventory() {
  if (!mountedGridId) return;
  stopAutoRefresh();

  const overlay = document.getElementById('gameInventoryOverlay');
  const host    = document.getElementById('gameInvGridHost');
  const netHost = document.getElementById('gameInvNetworkHost');
  const pathEl  = document.getElementById('gameInvPath');

  if (overlay) overlay.style.display = 'none';
  if (host)    host.innerHTML = '';
  if (netHost) netHost.innerHTML = '';
  if (pathEl)  pathEl.innerHTML = '';

  mountedGridId = null;
  lastGameState = null;
  currentPath = [];
  networkRoot = null;
  lastSignature = null;
}

/* -----------------------------------------------------------------
   Auto-refresh — polls every 500ms; only re-renders on change
   ----------------------------------------------------------------- */
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    if (state.activeOverlay !== 'inventory') { stopAutoRefresh(); return; }
    if (document.querySelector('.item.dragging')) return;
    maybeAutoRefresh();
  }, 500);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function computeSignature() {
  const node = currentPath[currentPath.length - 1];
  if (!node) return null;

  if (node.type === 'spoilsCategory') {
    const { category, server } = node;
    if (category === 'core') {
      return `core:${server.core.broken}:${server.spoils?.core ? 1 : 0}`;
    }
    const nodes = server.nodes.filter(n => n.category === category);
    return nodes.map(n => `${n.id}:${n.broken}:${server.spoils?.[n.id] ? 1 : 0}`).join('|');
  }

  if (node.type !== 'folder') return null;
  let children = node.children;
  if (typeof children !== 'function') return null;
  try { children = children(); } catch { return null; }
  if (!Array.isArray(children)) return null;
  return children.map(c =>
    `${c.type}|${c.name}|${c.blocked ? 'B' : ''}|${c.insecure ? 'I' : ''}`
  ).join('||');
}

function maybeAutoRefresh() {
  const sig = computeSignature();
  if (sig === null) return;
  if (sig === lastSignature) return;
  lastSignature = sig;
  renderExplorer();
}

/* -----------------------------------------------------------------
   Tree builders
   ----------------------------------------------------------------- */
function buildNetworkRoot(gameState) {
  return {
    type: 'folder',
    name: 'network/',
    children: () => {
      const server = gameState?.servers?.[0];
      if (!server) return [];
      return [
        makeSpoilsFolder(server),
        makeNodesFolder(server),
      ];
    },
  };
}

function makeSpoilsFolder(server) {
  const cats = ['core', 'security', 'storage', 'research', 'processing'];
  return {
    type: 'folder',
    name: 'Spoils/',
    children: () => cats.map(cat => ({
      type: 'spoilsCategory',
      name: `${capitalize(cat)}/`,
      category: cat,
      server,
    })),
  };
}

function makeNodesFolder(server) {
  return {
    type: 'folder',
    name: 'Nodes/',
    children: () => {
      const rows = [];
      const coreStatus = server.core.broken
        ? 'DESTROYED'
        : `${server.core.hp.toFixed(0)}/${server.core.maxHp} HP`;
      rows.push({ type: 'statusRow', name: `Core · ${coreStatus}` });

      for (const cat of ['security', 'storage', 'research', 'processing']) {
        const list = server.nodes.filter(n => n.category === cat);
        if (list.length === 0) continue;
        const alive = list.filter(n => !n.broken).length;
        rows.push({
          type: 'statusRow',
          name: `${capitalize(cat)} · ${alive}/${list.length} alive`,
        });
      }
      return rows;
    },
  };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -----------------------------------------------------------------
   Explorer
   ----------------------------------------------------------------- */
function renderExplorer() {
  const pathEl = document.getElementById('gameInvPath');
  const host   = document.getElementById('gameInvNetworkHost');
  if (!pathEl || !host) return;

  const node = currentPath[currentPath.length - 1];

  // Breadcrumb
  pathEl.innerHTML = '';
  if (currentPath.length > 1) {
    const back = document.createElement('button');
    back.className = 'loot-back';
    back.textContent = '<';
    back.title = 'Back';
    back.addEventListener('click', goBack);
    pathEl.appendChild(back);
  }
  const crumb = document.createElement('span');
  crumb.className = 'loot-crumb';
  crumb.textContent = currentPath.map(n => n.name).join(' ');
  pathEl.appendChild(crumb);

  host.innerHTML = '';

  if (node.type === 'folder')              renderFolder(node, host);
  else if (node.type === 'grid')           renderGridNode(node, host);
  else if (node.type === 'spoilsCategory') renderSpoilsCategory(node, host);
  else if (node.type === 'statusRow')      renderStatusRow(node, host);

  lastSignature = computeSignature();
}

function renderFolder(node, host) {
  const list = document.createElement('div');
  list.className = 'loot-file-list';

  let children = node.children;
  if (typeof children === 'function') {
    try { children = children(); } catch (e) { children = []; console.error(e); }
  }
  if (!Array.isArray(children)) children = [];

  if (children.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'loot-empty';
    empty.textContent = 'Nothing here yet.';
    list.appendChild(empty);
  }

  for (const child of children) {
    // Informational row — not navigable
    if (child.type === 'statusRow') {
      const row = document.createElement('div');
      row.className = 'loot-status-row';
      row.textContent = child.name;
      list.appendChild(row);
      continue;
    }

    const isFolderLike =
    child.type === 'folder' ||
    child.type === 'spoilsCategory' ||
    child.type === 'packetsFolder';

    const tile = document.createElement('div');
    tile.className = 'loot-file-tile ' + (isFolderLike ? 'folder' : 'file');
    const icon = isFolderLike ? '📁' : '📄';
    tile.innerHTML = `
      <span class="tile-icon">${icon}</span>
      <span class="tile-name">${escapeHtml(child.name)}</span>
    `;
    tile.addEventListener('click', () => {
      currentPath.push(child);
      renderExplorer();
    });
    list.appendChild(tile);
  }
  host.appendChild(list);
}

function renderGridNode(node, host) {
  const wrap = document.createElement('div');
  host.appendChild(wrap);
  mountGrid(`inv-grid-${++gridSeq}`, node.bag, wrap);
}

function renderStatusRow(node, host) {
  const list = document.createElement('div');
  list.className = 'loot-file-list';
  const row = document.createElement('div');
  row.className = 'loot-status-row';
  row.textContent = node.name;
  list.appendChild(row);
  host.appendChild(list);
}

function renderSpoilsCategory(node, host) {
  const { category, server } = node;
  const container = document.createElement('div');
  container.className = 'spoils-category-list';
  host.appendChild(container);

  let entries;
  if (category === 'core') {
    entries = [{
      key: 'core',
      label: 'Core',
      broken: server.core.broken,
      bag: server.spoils?.core,
      hpLabel: server.core.broken
        ? 'DESTROYED'
        : `${server.core.hp.toFixed(0)} HP`,
    }];
  } else {
    entries = server.nodes
      .filter(n => n.category === category)
      .map(n => ({
        key: n.id,
        label: `${NODE_CATEGORIES[category]?.name || capitalize(category)} Node #${n.id}`,
        broken: n.broken,
        bag: server.spoils?.[n.id],
        hpLabel: n.broken
          ? 'DESTROYED'
          : `${n.hp.toFixed(0)}/${n.maxHp} HP`,
      }));
  }

  if (entries.length === 0) {
    container.innerHTML = `<div class="loot-empty">No ${category} nodes in this sector.</div>`;
    return;
  }

  for (const entry of entries) {
    const card = document.createElement('div');
    card.className = 'spoils-card';

    const header = document.createElement('div');
    header.className = 'spoils-card-header';
    header.innerHTML = `
      <span>${escapeHtml(entry.label)}</span>
      <span class="${entry.broken ? 'spoils-hp-dead' : 'spoils-hp-alive'}">${escapeHtml(entry.hpLabel)}</span>
    `;
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'spoils-card-body';
    card.appendChild(body);

    if (!entry.broken) {
      body.innerHTML = '<div class="spoils-denied">🔒 PERMISSION DENIED</div>';
    } else if (!entry.bag || entry.bag.items.length === 0) {
      body.innerHTML = '<div class="spoils-empty">Empty.</div>';
    } else {
      const wrap = document.createElement('div');
      body.appendChild(wrap);
      mountGrid(`spoils-${server.id}-${entry.key}-${++gridSeq}`, entry.bag, wrap);
    }

    container.appendChild(card);
  }
}

function goBack() {
  if (currentPath.length <= 1) return;
  currentPath.pop();
  renderExplorer();
}

/* -----------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}