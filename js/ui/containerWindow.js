/* ===================================================================
   Floating Container Windows
   =================================================================== */
import { HARDWARE_SLOT_RULES, mountGrid, syncGrid } from '../systems/grid-core.js';


const openWindows = new Map();
let nextGridId = 0;
let zCounter = 5000;

function nextZIndex() { return ++zCounter; }

export function openContainerWindow(item) {
  // Is this a console (multi-grid) or a normal container?
  if (item.containerType === 'console') {
    openConsoleWindow(item);
    return; 
  }

  if (item.tags?.includes('ship_data') && !isCDEquipped(item)) {
    alert('Equip this CD in a console to access its cargo.');
    return;
  }

  // --- Normal container (single grid) ---
  if (!item.internalItems) return;

  if (openWindows.has(item.id)) { 
    openWindows.get(item.id).el.style.zIndex = String(nextZIndex()); 
    return; 
  }

  const el = document.createElement('div');
  el.className = 'container-window';
  el.style.position = 'fixed';
  el.style.zIndex = String(nextZIndex());
  el.style.pointerEvents = 'none'; 
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.background = '#13151a';
  el.style.border = '1px solid #30363d';
  el.style.borderRadius = '6px';
  el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';

  const header = document.createElement('div');
  header.className = 'container-window-header';
  header.style.pointerEvents = 'auto'; 
  header.style.height = '28px';
  header.style.background = '#1c2128';
  header.style.borderBottom = '1px solid #30363d';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '0 8px 0 10px';
  header.style.fontSize = '11px';
  header.style.fontWeight = '700';
  header.style.letterSpacing = '1.5px';
  header.style.textTransform = 'uppercase';
  header.style.color = '#3fb950';
  header.style.cursor = 'move';
  header.innerHTML = `<span>${item.name}</span>`;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'container-window-close';
  closeBtn.textContent = '✕';
  closeBtn.style.background = '#1c2128';
  closeBtn.style.border = '1px solid #30363d';
  closeBtn.style.color = '#8b949e';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => closeContainerWindow(item.id));
  
  header.appendChild(closeBtn);
  el.appendChild(header);

  const body = document.createElement('div');
  body.className = 'container-window-body';
  body.style.pointerEvents = 'auto'; 
  body.style.padding = '8px';
  el.appendChild(body);
  
  document.body.appendChild(el);

  const inv = { 
    cols: item.internalCols, 
    rows: item.internalRows, 
    items: item.internalItems 
  };
  
  const gridId = `container-${item.id}-${nextGridId++}`;
  mountGrid(gridId, inv, body, { color: item.color || '#3a434d' });
  
  openWindows.set(item.id, { el, gridId, item });
  makeDraggable(el, header);

  const offset = openWindows.size * 24;
  el.style.left = (window.innerWidth / 2 - 100 + offset) + 'px';
  el.style.top = (window.innerHeight / 2 - 100 + offset) + 'px';
}

/* -------------------------------------------------------------------
   Console Window (Multi-Grid)
   ------------------------------------------------------------------- */
function openConsoleWindow(item) {
  if (openWindows.has(item.id)) { 
    openWindows.get(item.id).el.style.zIndex = String(nextZIndex()); 
    return; 
  }

  const el = document.createElement('div');
  el.className = 'container-window';
  el.style.position = 'fixed';
  el.style.zIndex = String(nextZIndex());
  el.style.pointerEvents = 'none'; 
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.background = '#13151a';
  el.style.border = '1px solid #30363d';
  el.style.borderRadius = '6px';
  el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
  el.style.width = '600px';

  const header = document.createElement('div');
  header.className = 'container-window-header';
  header.style.pointerEvents = 'auto'; 
  header.style.height = '28px';
  header.style.background = '#1c2128';
  header.style.borderBottom = '1px solid #30363d';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '0 8px 0 10px';
  header.style.fontSize = '11px';
  header.style.fontWeight = '700';
  header.style.letterSpacing = '1.5px';
  header.style.textTransform = 'uppercase';
  header.style.color = '#3fb950';
  header.style.cursor = 'move';
  header.innerHTML = `<span>${item.name}</span>`;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'container-window-close';
  closeBtn.textContent = '✕';
  closeBtn.style.background = '#1c2128';
  closeBtn.style.border = '1px solid #30363d';
  closeBtn.style.color = '#8b949e';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => closeContainerWindow(item.id));
  
  header.appendChild(closeBtn);
  el.appendChild(header);

  const body = document.createElement('div');
  body.className = 'container-window-body';
  body.style.pointerEvents = 'auto'; 
  body.style.padding = '16px';
  body.style.display = 'grid';
  body.style.gridTemplateColumns = 'repeat(2, 1fr)';
  body.style.gap = '16px';
  el.appendChild(body);
  
  document.body.appendChild(el);

  // Render each hardware grid
  const slots = [
    { key: 'cdSlot',  label: 'CD SLOT' },
    { key: 'cpu',     label: 'CPU' },
    { key: 'ram',     label: 'RAM' },
    { key: 'gpu',     label: 'GPU' },
    { key: 'network', label: 'NETWORK' },
    { key: 'cooler',  label: 'COOLER' },
  ];

  for (const slot of slots) {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    wrap.innerHTML = `<div style="font-size:11px; color:#8b949e; letter-spacing:1.5px; font-weight:700;">${slot.label}</div>`;
    if (!item.hardware[slot.key]) continue;
    const gridHost = document.createElement('div');
    wrap.appendChild(gridHost);
    body.appendChild(wrap);

    const gridId = `console-grid-${item.id}-${slot.key}`;
    mountGrid(gridId, item.hardware[slot.key], gridHost, { color: '#3a434d' });
  }
  
  openWindows.set(item.id, { el, gridId: null, item });
  makeDraggable(el, header);

  const offset = openWindows.size * 24;
  el.style.left = (window.innerWidth / 2 - 300 + offset) + 'px';
  el.style.top = (window.innerHeight / 2 - 200 + offset) + 'px';
}

function makeDraggable(el, header) {
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('container-window-close')) return;
    dragging = true;
    const rect = el.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = rect.left; oy = rect.top;
    el.style.zIndex = String(nextZIndex());
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    el.style.left = (ox + e.clientX - sx) + 'px';
    el.style.top = (oy + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

export function closeContainerWindow(itemId) {
  const w = openWindows.get(itemId);
  if (w) { 
    w.el.remove(); 
    openWindows.delete(itemId); 
  }
}

window.addEventListener('hangar:changed', () => {
  for (const [, entry] of openWindows) {
    const item = entry.item;
    if (!item) continue;

    if (item.containerType === 'console' && item.hardware) {
      for (const [slotKey, slotInv] of Object.entries(item.hardware)) {
        syncGrid(`console-grid-${item.id}-${slotKey}`, slotInv);
      }
    } else if (item.internalItems && entry.gridId) {
      syncGrid(entry.gridId, {
        cols: item.internalCols,
        rows: item.internalRows,
        items: item.internalItems,
      });
    }
  }
});