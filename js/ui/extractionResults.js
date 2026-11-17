/* ===================================================================
   Extraction results — shown after a successful escape.
   =================================================================== */

import { mountGrid } from '../systems/grid-core.js';

export function computeItemsValue(items) {
  let credits = 0, tokens = 0, chips = 0;
  const scan = (list) => {
    for (const it of list || []) {
      const v = it.value || {};
      const c = it.count || 1;
      credits += (v.credits || 0) * c;
      tokens  += (v.itokens || 0) * c;
      chips   += (v.gchips  || 0) * c;
      if (it.internalItems) scan(it.internalItems);
    }
  };
  scan(items);
  return { credits, tokens, chips };
}

export function showExtractionResults(data, onContinue) {
  const root = document.getElementById('extractionResults');
  if (!root) return;
  root.style.display = 'flex';
  root.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'extraction-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'extraction-header';
  header.innerHTML = `
    <div class="extraction-title">EXTRACTION SUCCESSFUL</div>
    <div class="extraction-subtitle">${data.sector ? data.sector.name : 'Unknown Sector'}</div>
  `;
  panel.appendChild(header);

  // Section title
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'extraction-section-title';
  sectionTitle.textContent = `SECURED CARGO · ${data.items.length} ITEM${data.items.length === 1 ? '' : 'S'}`;
  panel.appendChild(sectionTitle);

  // Grid
  const gridHost = document.createElement('div');
  gridHost.className = 'extraction-grid-host';
  panel.appendChild(gridHost);

  if (data.items.length > 0 && data.itemCols && data.itemRows) {
    const inv = {
      cols: data.itemCols,
      rows: data.itemRows,
      items: data.items,
    };
    const gridId = `extraction-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const wrap = document.createElement('div');
    gridHost.appendChild(wrap);
    mountGrid(gridId, inv, wrap, { readOnly: true });
  } else if (data.items.length > 0) {
    gridHost.innerHTML = '<div class="extraction-empty">Cargo contents unavailable.</div>';
  } else {
    gridHost.innerHTML = '<div class="extraction-empty">No cargo secured.</div>';
  }

  // Stats
  const stats = document.createElement('div');
  stats.className = 'extraction-stats';
  stats.innerHTML = `
    <div class="extraction-stat">
      <div class="extraction-stat-label">Items</div>
      <div class="extraction-stat-value count">${data.items.length}</div>
    </div>
    <div class="extraction-stat">
      <div class="extraction-stat-label">Credits</div>
      <div class="extraction-stat-value credits">${data.value.credits.toLocaleString()}</div>
    </div>
    <div class="extraction-stat">
      <div class="extraction-stat-label">Tokens</div>
      <div class="extraction-stat-value tokens">${data.value.tokens.toLocaleString()}</div>
    </div>
    <div class="extraction-stat">
      <div class="extraction-stat-label">Chips</div>
      <div class="extraction-stat-value chips">${data.value.chips.toLocaleString()}</div>
    </div>
  `;
  panel.appendChild(stats);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'extraction-footer';
  const btn = document.createElement('button');
  btn.className = 'extraction-btn';
  btn.textContent = 'Return to Hangar';
  btn.addEventListener('click', () => {
    root.style.display = 'none';
    root.innerHTML = '';
    if (typeof onContinue === 'function') onContinue();
  });
  footer.appendChild(btn);
  panel.appendChild(footer);

  root.appendChild(panel);
}