/* ===================================================================
   Item Description Window
   =================================================================== */

let currentWindow = null;


const STAT_LABELS = {
  attack:           'Attack',
  defense:          'Defense',
  speed:            'Speed',
  firerate:         'Fire Rate',
  shieldDelay:      'Shield Delay',
  gunOverloadDelay: 'Gun Overload Delay',
};

// For each stat, which direction of change is an improvement?
// Higher is better for combat stats. Lower is better for delay timers.
const STAT_BETTER_DIRECTION = {
  attack:           'higher',
  defense:          'higher',
  speed:            'higher',
  firerate:         'higher',
  shieldDelay:      'lower',
  gunOverloadDelay: 'lower',
};

/* -------------------------------------------------------------------
   Properties section — stats, grid sizes, special constraints
   ------------------------------------------------------------------- */
function buildPropertiesSection(item) {
  const rows = [];

  /* ---- Stat multipliers (components) ---- */
  if (item.stats?.multipliers) {
    for (const [key, value] of Object.entries(item.stats.multipliers)) {
      if (value === 1) continue;
      const label = STAT_LABELS[key] || key;
      const dir   = STAT_BETTER_DIRECTION[key] || 'higher';
      const pct   = Math.round((value - 1) * 100);
      const improved = dir === 'higher' ? value > 1 : value < 1;
      const sign = pct > 0 ? '+' : '';
      rows.push({
        label,
        value: `${sign}${pct}%`,
        sub:   `×${value.toFixed(2)}`,
        positive: improved,
        negative: !improved,
      });
    }
  }

  /* ---- Additive stats (future-proof — no current data uses this) ---- */
  if (item.stats?.additive) {
    for (const [key, value] of Object.entries(item.stats.additive)) {
      if (value === 0) continue;
      const label = STAT_LABELS[key] || key;
      const dir   = STAT_BETTER_DIRECTION[key] || 'higher';
      const improved = dir === 'higher' ? value > 0 : value < 0;
      const sign = value > 0 ? '+' : '';
      rows.push({
        label,
        value: `${sign}${value}`,
        sub:   null,
        positive: improved,
        negative: !improved,
      });
    }
  }

  /* ---- Container / CD grid ---- */
  if (item.internalCols && item.internalRows) {
    const cells = item.internalCols * item.internalRows;
    rows.push({
      label: 'Grid',
      value: `${item.internalCols} × ${item.internalRows}`,
      sub:   `${cells} cell${cells === 1 ? '' : 's'}`,
      info:  true,
    });
  }

  /* ---- Console slot breakdown ---- */
  if (item.hardware) {
    const slots = Object.values(item.hardware);
    let totalCells = 0;
    for (const slot of slots) {
      totalCells += (slot.cols || 0) * (slot.rows || 0);
    }
    rows.push({
      label: 'Slots',
      value: String(slots.length),
      sub:   null,
      info:  true,
    });
    rows.push({
      label: 'Capacity',
      value: `${totalCells} cells`,
      sub:   null,
      info:  true,
    });
  }

  /* ---- CD → ship binding ---- */
  if (item.shipKey) {
    rows.push({
      label: 'Ship',
      value: item.shipKey,
      sub:   null,
      info:  true,
    });
  }

  /* ---- Container content restrictions ---- */
  if (item.canStore) {
    const accepts = [];
    if (item.canStore.categories) accepts.push(...item.canStore.categories);
    if (item.canStore.keys)       accepts.push(...item.canStore.keys);
    if (item.canStore.tags)       accepts.push(...item.canStore.tags);
    if (accepts.length > 0) {
      rows.push({
        label: 'Accepts',
        value: accepts.join(', '),
        sub:   null,
        info:  true,
        small: true,
      });
    }
  }

  /* ---- Stack max (only when meaningful) ---- */
  if (item.stackMax > 1) {
    rows.push({
      label: 'Stack Max',
      value: String(item.stackMax),
      sub:   null,
      info:  true,
    });
  }

  if (rows.length === 0) return null;

  /* ---- Build DOM ---- */
  const host = document.createElement('div');
  host.className = 'description-properties';

  const header = document.createElement('div');
  header.className = 'description-properties-header';
  header.textContent = 'PROPERTIES';
  host.appendChild(header);

  for (const row of rows) {
    const el = document.createElement('div');
    el.className = 'property-row';
    if (row.small) el.classList.add('small');

    const label = document.createElement('span');
    label.className = 'property-label';
    label.textContent = row.label;
    el.appendChild(label);

    const valueWrap = document.createElement('span');
    valueWrap.className = 'property-value-wrap';

    const value = document.createElement('span');
    value.className = 'property-value';
    if (row.positive) value.classList.add('positive');
    else if (row.negative) value.classList.add('negative');
    else if (row.info) value.classList.add('info');
    value.textContent = row.value;
    valueWrap.appendChild(value);

    if (row.sub) {
      const sub = document.createElement('span');
      sub.className = 'property-sub';
      sub.textContent = row.sub;
      valueWrap.appendChild(sub);
    }

    el.appendChild(valueWrap);
    host.appendChild(el);
  }

  return host;
}

export function openItemDescription(item, options = {}) {
  closeDescription();

  const mkt = options.market || null;

  const backdrop = document.createElement('div');
  backdrop.className = 'popup-backdrop';
  backdrop.style.zIndex = '9000';

  const win = document.createElement('div');
  win.className = 'popup-window description-window';
  if (mkt) win.classList.add('description-market-mode');

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'popup-header';
  const title = document.createElement('span');
  title.textContent = item.name;
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'description-close';
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', closeDescription);
  header.appendChild(closeBtn);
  win.appendChild(header);

  if (item._contractItem) {
    const banner = document.createElement('div');
    banner.className = 'description-contract-banner';
    banner.textContent = '⚠ CONTRACT ITEM — DO NOT LOSE';
    win.appendChild(banner);
  }

  const rawScale = item.descScale || 1;
  const scale = Math.max(0.8, Math.min(2, rawScale));
  win.style.setProperty('--desc-scale', scale);
  win.style.setProperty('--item-color', item.color || '#3fb950');

  // --- Image ---
  const imgWrap = document.createElement('div');
  imgWrap.className = 'description-image-wrap';
  let imgSrc = item.img;
  if (item.state > 0 && item.stateImages && item.stateImages[item.state]) {
    imgSrc = item.stateImages[item.state];
  }
  if (item.dynamicImageCategory && item.internalItems && item.internalItems.length > 0) {
    const contained = item.internalItems.find(i => i.category === item.dynamicImageCategory);
    if (contained) imgSrc = `/img/items/${contained.key}contained.png`;
  }
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.onerror = () => { img.style.display = 'none'; };
    imgWrap.appendChild(img);
  }
  win.appendChild(imgWrap);

  // --- Intrinsic value (hidden in market mode) ---
  if (!mkt) {
    const valueWrap = document.createElement('div');
    valueWrap.className = 'description-values';
    appendIntrinsicValues(valueWrap, item);
    win.appendChild(valueWrap);
  }

  // --- Properties (stats / grid / constraints) ---
  const propsSection = buildPropertiesSection(item);
  if (propsSection) win.appendChild(propsSection);

  // --- Description ---
  const descWrap = document.createElement('div');
  descWrap.className = 'description-body';
  descWrap.textContent = item.description || 'No description available.';
  win.appendChild(descWrap);

  // --- Market buy section (only when mkt provided) ---
  if (mkt) {
    win.appendChild(buildMarketSection(item, mkt, closeDescription));
  }

  // --- Backdrop click ---
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeDescription();
  });

  backdrop.appendChild(win);
  document.body.appendChild(backdrop);
  currentWindow = backdrop;
  document.addEventListener('keydown', onKey);
}

/* -------------------------------------------------------------------
   Intrinsic value block (unchanged behaviour)
   ------------------------------------------------------------------- */
function appendIntrinsicValues(host, item) {
  if (!item.value) {
    host.innerHTML = '<span style="color:#5a636e; font-size: 11px;">No value</span>';
    return;
  }
  const currencies = [
    { key: 'credits', label: 'CR', color: '#3fb950' },
    { key: 'itokens', label: 'IT', color: '#d29922' },
    { key: 'gchips',  label: 'GC', color: '#a371f7' },
  ];
  let any = false;
  for (const c of currencies) {
    if (item.value[c.key] > 0) {
      any = true;
      const row = document.createElement('div');
      row.className = 'value-item';
      row.innerHTML = `
        <span class="value-label" style="color:${c.color}">${c.label}</span>
        <span class="value-amount">${item.value[c.key].toLocaleString()}</span>
      `;
      host.appendChild(row);
    }
  }
  if (!any) {
    host.innerHTML = '<span style="color:#5a636e; font-size: 11px;">No value</span>';
  }
}

/* -------------------------------------------------------------------
   Market buy/trade section
   ------------------------------------------------------------------- */
function buildMarketSection(item, mkt, closeAll) {
  const host = document.createElement('div');
  host.className = 'description-market';

  let qty = 1;
  const maxQtyFn = mkt.maxQtyFn || (() => mkt.stock || 0);

  const recompute = () => {
    const maxQty = Math.max(0, Math.min(mkt.stock || 0, maxQtyFn()));
    qty = Math.max(1, Math.min(qty, Math.max(1, maxQty)));
    render();
    return { maxQty };
  };

  const render = () => {
    host.innerHTML = '';

    const maxQty = Math.max(0, Math.min(mkt.stock || 0, maxQtyFn()));

    // --- Quantity row ---
    const qtyRow = document.createElement('div');
    qtyRow.className = 'desc-qty-row';
    qtyRow.innerHTML = `<span class="desc-qty-label">QUANTITY</span>`;
    const control = document.createElement('div');
    control.className = 'desc-qty-control';

    const dec = document.createElement('button');
    dec.className = 'desc-qty-btn';
    dec.textContent = '−';
    dec.disabled = qty <= 1;
    dec.addEventListener('click', () => { if (qty > 1) { qty--; render(); } });

    const val = document.createElement('span');
    val.className = 'desc-qty-value';
    val.textContent = qty;

    const inc = document.createElement('button');
    inc.className = 'desc-qty-btn';
    inc.textContent = '+';
    inc.disabled = qty >= maxQty;
    inc.addEventListener('click', () => { if (qty < maxQty) { qty++; render(); } });

    control.appendChild(dec);
    control.appendChild(val);
    control.appendChild(inc);
    qtyRow.appendChild(control);

    const maxTag = document.createElement('span');
    maxTag.className = 'desc-qty-max';
    maxTag.textContent = `/ ${maxQty}`;
    qtyRow.appendChild(maxTag);
    host.appendChild(qtyRow);

    // --- Price row (currency) ---
    if (mkt.price !== undefined && mkt.currency) {
      const total = mkt.price * qty;
      const row = document.createElement('div');
      row.className = 'desc-price-row';
      row.innerHTML = `
        <span class="desc-price-label">TOTAL</span>
        <span class="desc-price-value">
          <span class="price-label ${mkt.currency}">${abbrev(mkt.currency)}</span>
          <span>${total.toLocaleString()}</span>
        </span>
      `;
      host.appendChild(row);
    }

    // --- Requires list (trade items) ---
    if (mkt.requires && mkt.requires.length) {
      const reqWrap = document.createElement('div');
      reqWrap.className = 'desc-requires';
      const title = document.createElement('div');
      title.className = 'desc-requires-title';
      title.textContent = 'REQUIRES';
      reqWrap.appendChild(title);

      for (const req of mkt.requires) {
        const need = req.count * qty;
        const have = mkt.availableFn ? mkt.availableFn(req.key) : 0;
        const ok = have >= need;

        const row = document.createElement('div');
        row.className = 'desc-req-row' + (ok ? '' : ' insufficient');
        row.innerHTML = `
          <span class="desc-req-name">${need}× ${escapeHtml(req.name)}</span>
          <span class="desc-req-have">Have ${have}</span>
        `;
        reqWrap.appendChild(row);
      }
      host.appendChild(reqWrap);
    }

        // --- Buy button ---
    const stockLeft = Math.max(0, mkt.stock || 0);
    const btn = document.createElement('button');
    btn.className = 'desc-buy-btn';
    const canBuy = maxQty >= 1 && (mkt.canBuy ? mkt.canBuy(qty) : true);
    btn.disabled = !canBuy;

    if (stockLeft === 0) {
      btn.textContent = 'OUT OF STOCK';
    } else {
      btn.textContent = mkt.requires ? `TRADE ${qty}` : `BUY ${qty}`;
    }

    btn.addEventListener('click', () => {
      const result = mkt.onBuy ? mkt.onBuy(qty) : { success: false, reason: 'Buy not configured.' };
      if (result.success) {
        closeAll();
      } else if (result.reason) {
        showToast(result.reason);
      }
    });
    host.appendChild(btn);

    // Warn block — the "Out of stock" case takes priority over "No storage"
    if (stockLeft === 0) {
      const warn = document.createElement('div');
      warn.className = 'desc-market-warn';
      warn.textContent = 'Out of stock.';
      host.appendChild(warn);
    } else if (maxQty === 0) {
      const warn = document.createElement('div');
      warn.className = 'desc-market-warn';
      warn.textContent = 'No storage space available.';
      host.appendChild(warn);
    }
  };

  recompute();
  return host;
}

function abbrev(cur) {
  if (cur === 'credits') return 'CR';
  if (cur === 'itokens') return 'IT';
  if (cur === 'gchips')  return 'GC';
  return cur.slice(0, 2).toUpperCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer = null;
function showToast(text) {
  let el = document.getElementById('descToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'descToast';
    el.className = 'desc-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

/* -------------------------------------------------------------------
   Lifecycle
   ------------------------------------------------------------------- */
function onKey(e) { if (e.key === 'Escape') closeDescription(); }

function closeDescription() {
  if (currentWindow) {
    currentWindow.remove();
    currentWindow = null;
    document.removeEventListener('keydown', onKey);
  }
}