/* ===================================================================
   Crafting recipes — grouped, tiered.
   Consoles: no nesting (each crafted from components + raw).
   Components: linear chain within family.
   VRs: no nesting (each from raw).
   =================================================================== */

export const RECIPES = {
  // ---- Materials (all refined) ----
  wire: {
    key: 'wire', category: 'materials', group: 'Refined', tier: 1,
    produces: 2,
    ingredients: [
      { key: 'copper',  count: 2 },
      { key: 'plastic', count: 1 },
    ],
  },
  electronics: {
    key: 'electronics', category: 'materials', group: 'Refined', tier: 2,
    produces: 2,
    ingredients: [
      { key: 'silicon', count: 2 },
      { key: 'copper',  count: 2 },
      { key: 'plastic', count: 1 },
    ],
  },
  datacables: {
    key: 'datacables', category: 'materials', group: 'Refined', tier: 3,
    ingredients: [
      { key: 'wire',    count: 1 },
      { key: 'copper',  count: 2 },
      { key: 'plastic', count: 1 },
    ],
  },
  data_cache: {
    key: 'data_cache', category: 'materials', group: 'Refined', tier: 4,
    ingredients: [
      { key: 'silicon',     count: 2 },
      { key: 'electronics', count: 1 },
      { key: 'plastic',     count: 1 },
    ],
  },
  compacted_data: {
    key: 'compacted_data', category: 'materials', group: 'Refined', tier: 5,
    ingredients: [
      { key: 'datacables',  count: 1 },
      { key: 'electronics', count: 1 },
      { key: 'silicon',     count: 1 },
    ],
  },

  // ---- Components — RAM (attack) ----
  ram_t1: {
    key: 'ram_t1', category: 'components', group: 'RAM', tier: 1,
    ingredients: [
      { key: 'silicon', count: 3 },
      { key: 'copper',  count: 1 },
    ],
  },
  ram_t2: {
    key: 'ram_t2', category: 'components', group: 'RAM', tier: 2,
    ingredients: [
      { key: 'ram_t1',  count: 1 },
      { key: 'silicon', count: 2 },
      { key: 'copper',  count: 1 },
    ],
  },
  ram_t3: {
    key: 'ram_t3', category: 'components', group: 'RAM', tier: 3,
    ingredients: [
      { key: 'ram_t2',     count: 1 },
      { key: 'silicon',    count: 2 },
      { key: 'electronics', count: 1 },
      { key: 'gold',       count: 1 },
    ],
  },
  ram_t4: {
    key: 'ram_t4', category: 'components', group: 'RAM', tier: 4,
    ingredients: [
      { key: 'ram_t3',      count: 1 },
      { key: 'data_cache',  count: 1 },
      { key: 'electronics', count: 2 },
      { key: 'gold',        count: 1 },
    ],
  },
  ram_t5: {
    key: 'ram_t5', category: 'components', group: 'RAM', tier: 5,
    ingredients: [
      { key: 'ram_t4',         count: 1 },
      { key: 'compacted_data', count: 1 },
      { key: 'electronics',    count: 2 },
      { key: 'gold',           count: 2 },
    ],
  },

  // ---- Components — CPU (defense) ----
  cpu_t1: {
    key: 'cpu_t1', category: 'components', group: 'CPU', tier: 1,
    ingredients: [
      { key: 'silicon',     count: 3 },
      { key: 'electronics', count: 1 },
    ],
  },
  cpu_t2: {
    key: 'cpu_t2', category: 'components', group: 'CPU', tier: 2,
    ingredients: [
      { key: 'cpu_t1',  count: 1 },
      { key: 'silicon', count: 2 },
      { key: 'gold',    count: 1 },
    ],
  },
  cpu_t3: {
    key: 'cpu_t3', category: 'components', group: 'CPU', tier: 3,
    ingredients: [
      { key: 'cpu_t2',      count: 1 },
      { key: 'electronics', count: 2 },
      { key: 'gold',        count: 1 },
    ],
  },
  cpu_t4: {
    key: 'cpu_t4', category: 'components', group: 'CPU', tier: 4,
    ingredients: [
      { key: 'cpu_t3',      count: 1 },
      { key: 'data_cache',  count: 1 },
      { key: 'electronics', count: 2 },
      { key: 'gold',        count: 2 },
    ],
  },
  cpu_t5: {
    key: 'cpu_t5', category: 'components', group: 'CPU', tier: 5,
    ingredients: [
      { key: 'cpu_t4',         count: 1 },
      { key: 'compacted_data', count: 1 },
      { key: 'electronics',    count: 3 },
      { key: 'gold',           count: 2 },
    ],
  },

  // ---- Components — GPU (speed) ----
  gpu_t1: {
    key: 'gpu_t1', category: 'components', group: 'GPU', tier: 1,
    ingredients: [
      { key: 'silicon',     count: 3 },
      { key: 'electronics', count: 1 },
      { key: 'copper',      count: 1 },
    ],
  },
  gpu_t2: {
    key: 'gpu_t2', category: 'components', group: 'GPU', tier: 2,
    ingredients: [
      { key: 'gpu_t1',      count: 1 },
      { key: 'silicon',     count: 2 },
      { key: 'electronics', count: 1 },
      { key: 'gold',        count: 1 },
    ],
  },
  gpu_t3: {
    key: 'gpu_t3', category: 'components', group: 'GPU', tier: 3,
    ingredients: [
      { key: 'gpu_t2',      count: 1 },
      { key: 'electronics', count: 2 },
      { key: 'gold',        count: 2 },
    ],
  },

  // ---- Components — Network (firerate) ----
  net_t1: {
    key: 'net_t1', category: 'components', group: 'Network', tier: 1,
    ingredients: [
      { key: 'wire',        count: 2 },
      { key: 'electronics', count: 1 },
      { key: 'plastic',     count: 1 },
    ],
  },
  net_t2: {
    key: 'net_t2', category: 'components', group: 'Network', tier: 2,
    ingredients: [
      { key: 'net_t1',  count: 1 },
      { key: 'wire',    count: 2 },
      { key: 'gold',    count: 1 },
    ],
  },
  net_t3: {
    key: 'net_t3', category: 'components', group: 'Network', tier: 3,
    ingredients: [
      { key: 'net_t2',     count: 1 },
      { key: 'datacables', count: 2 },
      { key: 'gold',       count: 1 },
    ],
  },

  // ---- Components — Cooler (delays) ----
  cooler_t1: {
    key: 'cooler_t1', category: 'components', group: 'Cooler', tier: 1,
    ingredients: [
      { key: 'copper',  count: 3 },
      { key: 'plastic', count: 2 },
    ],
  },
  cooler_t2: {
    key: 'cooler_t2', category: 'components', group: 'Cooler', tier: 2,
    ingredients: [
      { key: 'cooler_t1', count: 1 },
      { key: 'copper',    count: 3 },
      { key: 'gold',      count: 1 },
    ],
  },

  // ---- Consoles — Makeshift (no nesting) ----
  console_mk1: {
    key: 'console_mk1', category: 'consoles', group: 'Makeshift', tier: 1,
    ingredients: [
      { key: 'electronics', count: 4 },
      { key: 'cpu_t1',      count: 1 },
      { key: 'cooler_t1',   count: 1 },
      { key: 'plastic',     count: 3 },
    ],
  },
  console_mk2: {
    key: 'console_mk2', category: 'consoles', group: 'Makeshift', tier: 2,
    ingredients: [
      { key: 'electronics', count: 5 },
      { key: 'cpu_t1',      count: 1 },
      { key: 'gpu_t1',      count: 1 },
      { key: 'cooler_t1',   count: 1 },
      { key: 'plastic',     count: 3 },
    ],
  },
  console_mk3: {
    key: 'console_mk3', category: 'consoles', group: 'Makeshift', tier: 3,
    ingredients: [
      { key: 'electronics', count: 6 },
      { key: 'cpu_t2',      count: 1 },
      { key: 'gpu_t1',      count: 1 },
      { key: 'net_t1',      count: 1 },
      { key: 'cooler_t1',   count: 1 },
      { key: 'plastic',     count: 4 },
    ],
  },

  // ---- Consoles — Standard ----
  console_t1: {
    key: 'console_t1', category: 'consoles', group: 'Standard', tier: 1,
    ingredients: [
      { key: 'electronics', count: 8 },
      { key: 'cpu_t2',      count: 1 },
      { key: 'gpu_t2',      count: 1 },
      { key: 'net_t1',      count: 1 },
      { key: 'cooler_t1',   count: 2 },
      { key: 'plastic',     count: 4 },
    ],
  },
  console_original: {
    key: 'console_original', category: 'consoles', group: 'Standard', tier: 2,
    ingredients: [
      { key: 'electronics', count: 10 },
      { key: 'cpu_t2',      count: 1 },
      { key: 'gpu_t2',      count: 1 },
      { key: 'net_t2',      count: 1 },
      { key: 'cooler_t1',   count: 2 },
      { key: 'gold',        count: 3 },
    ],
  },

  // ---- Consoles — Premium ----
  console_t2: {
    key: 'console_t2', category: 'consoles', group: 'Premium', tier: 1,
    ingredients: [
      { key: 'electronics', count: 12 },
      { key: 'cpu_t3',      count: 1 },
      { key: 'gpu_t3',      count: 1 },
      { key: 'net_t3',      count: 1 },
      { key: 'cooler_t2',   count: 2 },
      { key: 'gold',        count: 5 },
    ],
  },
  // console_blackmarket is NOT craftable — obtainable only from black market / loot

  // ---- VR (no nesting) ----
  vr_basic: {
    key: 'vr_basic', category: 'vr', group: 'Headsets', tier: 1,
    ingredients: [
      { key: 'electronics', count: 3 },
      { key: 'plastic',     count: 2 },
      { key: 'silicon',     count: 2 },
    ],
  },
  vr_advanced: {
    key: 'vr_advanced', category: 'vr', group: 'Headsets', tier: 2,
    ingredients: [
      { key: 'electronics', count: 5 },
      { key: 'plastic',     count: 4 },
      { key: 'gold',        count: 2 },
    ],
  },
  vr3: {
    key: 'vr3', category: 'vr', group: 'Headsets', tier: 3,
    ingredients: [
      { key: 'electronics', count: 8 },
      { key: 'gold',        count: 3 },
      { key: 'gchips',      count: 2 },
    ],
  },

  // ---- Containers ----
  gear_crate: {
    key: 'gear_crate', category: 'containers', group: 'Containers', tier: 1,
    ingredients: [
      { key: 'wire',    count: 4 },
      { key: 'plastic', count: 4 },
      { key: 'silicon', count: 2 },
    ],
  },
};

export const CRAFT_CATEGORIES = [
  { key: 'materials',  label: 'Materials',    icon: '⚗' },
  { key: 'components', label: 'Components',   icon: '⚙' },
  { key: 'consoles',   label: 'Consoles',     icon: '▣' },
  { key: 'vr',         label: 'VR Headsets',  icon: '◐' },
  { key: 'containers', label: 'Containers',   icon: '⬡' },
];