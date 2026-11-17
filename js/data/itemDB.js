export const BLUEPRINTS = {
  // ===================================================================
  // UTILS
  // ===================================================================
  miningdevicev1: {
    key: 'miningdevicev1', name: 'Credit Mining Device v1.0', w: 2, h: 2,
    color: '#dd58d6', stackMax: 1, category: 'utils', tags: ['mining'],
    description: 'A portable rig that slowly extracts loose credits from rock formations. Slow, but reliable.',
    value: { credits: 1500 }
  },

  // ===================================================================
  // MINERALS + PLASTIC (RAW)
  // ===================================================================
  silicon: {
    key: 'silicon', name: 'Silicon', w: 1, h: 1, color: '#bfc6ce', stackMax: 25,
    category: 'mineral', tags: ['metal', 'mineral', 'salvage'],
    description: 'Raw silicon. The foundation of every chip, board, and cache in the net.',
    value: { credits: 15 }
  },
  gold: {
    key: 'gold', name: 'Gold', w: 1, h: 1, color: '#ffd900', stackMax: 25,
    category: 'mineral', tags: ['metal', 'mineral', 'salvage'],
    description: 'Refined gold. Extreme conductivity, extreme value. Used in high-tier contacts.',
    value: { credits: 250, itokens: 1 }
  },
  copper: {
    key: 'copper', name: 'Copper', w: 1, h: 1, color: '#ec6d04', stackMax: 25,
    category: 'mineral', tags: ['metal', 'mineral', 'salvage'],
    description: 'Copper ore. Cheap, common, and required for almost every circuit.',
    value: { credits: 20 }
  },
  plastic: {
    key: 'plastic', name: 'Plastic', w: 1, h: 1, color: '#8a9eaa', stackMax: 6,
    category: 'mineral', tags: ['plastic', 'crafting'],
    description: 'Recycled polymer chunks. Cheap, low value, endlessly useful.',
    value: { credits: 3 }
  },

  // ===================================================================
  // CRAFTED MATERIALS (5)
  // ===================================================================
  wire: {
    key: 'wire', name: 'Wire', w: 1, h: 1, color: '#d48a3a', stackMax: 8,
    img: '/img/items/wire.png',
    category: 'materials', tags: ['crafting', 'metal'],
    description: 'Unshielded copper wire. The simplest conductive material.',
    value: { credits: 8 }
  },
  electronics: {
    key: 'electronics', name: 'Electronics', w: 2, h: 1, color: '#7a8a9a', stackMax: 15,
    category: 'materials', tags: ['crafting', 'metal'],
    description: 'Pre-assembled boards. The intermediate step between raw stock and finished hardware.',
    value: { credits: 40 }
  },
  datacables: {
    key: 'datacables', name: 'Data Cables', w: 2, h: 2, color: '#493ee6', stackMax: 5,
    category: 'materials', tags: ['crafting', 'plastic'],
    description: 'Shielded data cables. Required for anything that moves signal between systems.',
    value: { credits: 60 }
  },
  data_cache: {
    key: 'data_cache', name: 'Data Cache', w: 2, h: 1, color: '#a371f7', stackMax: 4,
    img: '/img/items/folder.png',
    category: 'materials', tags: ['crafting', 'data'],
    description: 'A compressed fragment of archived data. Required for high-tier memory modules.',
    value: { credits: 80 }
  },
  compacted_data: {
    key: 'compacted_data', name: 'Compacted Data', w: 2, h: 2, color: '#6ee7ff', stackMax: 3,
    img: '/img/items/compacted_files.png',
    category: 'materials', tags: ['crafting', 'data'],
    description: 'Highly compressed data. Stored as a dense crystalline block. Rare and valuable.',
    value: { credits: 180 }
  },

  // ===================================================================
  // COMPONENTS — RAM (5 tiers, ATTACK stat)
  // ===================================================================
  ram_t1: {
    key: 'ram_t1', name: 'Titan M1', w: 2, h: 1, color: '#4a9a4a', stackMax: 3,
    img: '/img/items/memory1.png',
    category: 'component', tags: ['component', 'ram'],
    description: 'Entry-level memory module. Boosts attack throughput.',
    value: { credits: 120 },
    rarity: 'common',
    stats: { multipliers: { attack: 1.06 } },
  },
  ram_t2: {
    key: 'ram_t2', name: 'Titan M2', w: 2, h: 1, color: '#4a9a4a', stackMax: 3,
    img: '/img/items/memory1.png',
    category: 'component', tags: ['component', 'ram'],
    description: 'Consumer memory module. Slightly faster attack cycle.',
    value: { credits: 280 },
    rarity: 'uncommon',
    stats: { multipliers: { attack: 1.10 } },
  },
  ram_t3: {
    key: 'ram_t3', name: 'Titan M3', w: 2, h: 1, color: '#3fb950', stackMax: 2,
    img: '/img/items/memory2.png',
    category: 'component', tags: ['component', 'ram'],
    description: 'Mid-market memory. Noticeable attack boost.',
    value: { credits: 700 },
    rarity: 'rare',
    stats: { multipliers: { attack: 1.15 } },
  },
  ram_t4: {
    key: 'ram_t4', name: 'Titan M4', w: 2, h: 1, color: '#3fb950', stackMax: 2,
    img: '/img/items/memory2.png',
    category: 'component', tags: ['component', 'ram'],
    description: 'Corporate memory. Significant attack enhancement.',
    value: { credits: 1800 },
    rarity: 'epic',
    stats: { multipliers: { attack: 1.20 } },
  },
  ram_t5: {
    key: 'ram_t5', name: 'Titan M5', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/memory2.png',
    category: 'component', tags: ['component', 'ram'],
    description: 'Military-grade memory. Maximum attack throughput.',
    value: { credits: 5000 },
    rarity: 'legendary',
    stats: { multipliers: { attack: 1.25 } },
  },

  // ===================================================================
  // COMPONENTS — CPU (5 tiers, DEFENSE stat)
  // ===================================================================
  cpu_t1: {
    key: 'cpu_t1', name: 'Cortex i3', w: 1, h: 1, color: '#4a9a4a', stackMax: 2,
    img: '/img/items/cpu_basic.png',
    category: 'component', tags: ['component', 'cpu'],
    description: 'Consumer-grade processor. Reliable defensive routing.',
    value: { credits: 150 },
    rarity: 'common',
    stats: { multipliers: { defense: 1.06 } },
  },
  cpu_t2: {
    key: 'cpu_t2', name: 'Cortex i5', w: 1, h: 1, color: '#4a9a4a', stackMax: 2,
    img: '/img/items/CPU_midspec1.png',
    category: 'component', tags: ['component', 'cpu'],
    description: 'Mid-market processor. Better at absorbing hostile payloads.',
    value: { credits: 400 },
    rarity: 'uncommon',
    stats: { multipliers: { defense: 1.10 } },
  },
  cpu_t3: {
    key: 'cpu_t3', name: 'Cortex i7', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/CPU_highspec1.png',
    category: 'component', tags: ['component', 'cpu'],
    description: 'Corporate-grade processor. Solid defensive kernel.',
    value: { credits: 1000 },
    rarity: 'rare',
    stats: { multipliers: { defense: 1.15 } },
  },
  cpu_t4: {
    key: 'cpu_t4', name: 'Cortex i9', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/cpu_advanced.png',
    category: 'component', tags: ['component', 'cpu'],
    description: 'High-end consumer processor. Exceptional threat parsing.',
    value: { credits: 2500 },
    rarity: 'epic',
    stats: { multipliers: { defense: 1.20 } },
  },
  cpu_t5: {
    key: 'cpu_t5', name: 'Cortex i11', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/CPU_highspec1.png',
    category: 'component', tags: ['component', 'cpu'],
    description: 'Fictional top-end processor. Near-impenetrable defense.',
    value: { credits: 7000 },
    rarity: 'legendary',
    stats: { multipliers: { defense: 1.25 } },
  },

  // ===================================================================
  // COMPONENTS — GPU (3 tiers, SPEED stat)
  // ===================================================================
  gpu_t1: {
    key: 'gpu_t1', name: 'Lumen 1', w: 2, h: 1, color: '#4a9a4a', stackMax: 2,
    img: '/img/items/gpu_basic.png',
    category: 'component', tags: ['component', 'gpu'],
    description: 'Consumer graphics unit. Renders VR environments fast enough to move efficiently.',
    value: { credits: 140 },
    rarity: 'common',
    stats: { multipliers: { speed: 1.08 } },
  },
  gpu_t2: {
    key: 'gpu_t2', name: 'Lumen 2', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/GPU_midspec1.png',
    category: 'component', tags: ['component', 'gpu'],
    description: 'Mid-market graphics unit. Noticeable traversal improvement.',
    value: { credits: 700 },
    rarity: 'rare',
    stats: { multipliers: { speed: 1.14 } },
  },
  gpu_t3: {
    key: 'gpu_t3', name: 'Lumen 3', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/GPU_highspec1.png',
    category: 'component', tags: ['component', 'gpu'],
    description: 'Enterprise graphics unit. Renders the net at maximum fidelity.',
    value: { credits: 2200 },
    rarity: 'epic',
    stats: { multipliers: { speed: 1.20 } },
  },

  // ===================================================================
  // COMPONENTS — NETWORK (3 tiers, FIRE RATE stat)
  // ===================================================================
  net_t1: {
    key: 'net_t1', name: 'Relay N1', w: 2, h: 1, color: '#4a9a4a', stackMax: 2,
    img: '/img/items/net_basic.png',
    category: 'component', tags: ['component', 'network'],
    description: 'Basic relay card. Improves signal throughput for weapon systems.',
    value: { credits: 130 },
    rarity: 'common',
    stats: { multipliers: { firerate: 1.05 } },
  },
  net_t2: {
    key: 'net_t2', name: 'Relay N2', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/network_midspec1.png',
    category: 'component', tags: ['component', 'network'],
    description: 'Mid-market relay. Noticeably faster fire cycle.',
    value: { credits: 600 },
    rarity: 'rare',
    stats: { multipliers: { firerate: 1.10 } },
  },
  net_t3: {
    key: 'net_t3', name: 'Relay N3', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/net_advanced.png',
    category: 'component', tags: ['component', 'network'],
    description: 'Corporate relay. Every signal hits its target in the theoretical minimum.',
    value: { credits: 2000 },
    rarity: 'epic',
    stats: { multipliers: { firerate: 1.15 } },
  },

  // ===================================================================
  // COMPONENTS — COOLER (2 tiers, DELAY reduction)
  // ===================================================================
  cooler_t1: {
    key: 'cooler_t1', name: 'Frost 1', w: 2, h: 1, color: '#4a9a4a', stackMax: 2,
    img: '/img/items/cooler_basic.png',
    category: 'component', tags: ['component', 'cooler'],
    description: 'Basic fan assembly. Keeps the rig from thermal-throttling under load.',
    value: { credits: 100 },
    rarity: 'common',
    stats: { multipliers: { shieldDelay: 0.90, gunOverloadDelay: 0.90 } },
  },
  cooler_t2: {
    key: 'cooler_t2', name: 'Frost 2', w: 2, h: 1, color: '#3fb950', stackMax: 1,
    img: '/img/items/COOLER_midspec.png',
    category: 'component', tags: ['component', 'cooler'],
    description: 'Liquid-cooled block. Sustained bursts stay cool longer.',
    value: { credits: 600 },
    rarity: 'rare',
    stats: { multipliers: { shieldDelay: 0.80, gunOverloadDelay: 0.80 } },
  },

  // ===================================================================
  // COMPONENTS — EXOTIC
  // ===================================================================
  servercore: {
    key: 'servercore', name: 'Server Core', w: 2, h: 2, color: '#ff8080', stackMax: 1,
    img: '/img/items/ServerCore.png',
    category: 'component', tags: ['component', 'tech', 'unique'],
    description: 'The main processing core of a data center, ripped from its housing. Every drive inside still spinning.',
    value: { credits: 20000, itokens: 50, gchips: 20 },
    rarity: 'unique',
  },
  quantumcore: {
    key: 'quantumcore', name: 'Quantum Core', w: 2, h: 2, color: '#6ee7ff', stackMax: 1,
    img: '/img/items/energycrystal.png',
    category: 'component', tags: ['component', 'tech', 'rare'],
    description: 'A sealed quantum processing core. Humming quietly. Barely understood.',
    value: { credits: 5000, gchips: 5 },
    rarity: 'mythic',
  },

  // ===================================================================
  // CONSOLES (DECKS) — 7 total, keys stable for save compat
  // ===================================================================
  console_mk1: {
    key: 'console_mk1', name: 'Patchwork Deck I', w: 3, h: 3, color: '#505860', stackMax: 1,
    img: '/img/items/CONSOLE_Makeshift_MKI.png',
    category: 'tech', tags: ['console'],
    description: 'A cobbled-together console. Every slot is one smaller than standard. It boots. Mostly.',
    value: { credits: 300 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 1, rows: 1 },
      ram:     { cols: 1, rows: 1 },
      gpu:     { cols: 1, rows: 1 },
      network: { cols: 1, rows: 2 },
      cooler:  { cols: 1, rows: 1 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },
  console_t1: {
    key: 'console_t1', name: 'Standard Deck', w: 3, h: 3, color: '#606870', stackMax: 1,
    category: 'tech', tags: ['console'],
    description: 'Mass-produced deck. Every bay fits a standard module.',
    value: { credits: 1200 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 1, rows: 1 },
      ram:     { cols: 2, rows: 1 },
      gpu:     { cols: 2, rows: 1 },
      network: { cols: 2, rows: 1 },
      cooler:  { cols: 2, rows: 1 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },
  console_mk2: {
    key: 'console_mk2', name: 'Patchwork Deck II', w: 3, h: 3, color: '#707880', stackMax: 1,
    img: '/img/items/CONSOLE_Makeshift_MKII.png',
    category: 'tech', tags: ['console'],
    description: 'An upgraded scavenger build. Bigger bays than MKI, still uneven.',
    value: { credits: 700 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 2, rows: 1 },
      ram:     { cols: 2, rows: 1 },
      gpu:     { cols: 2, rows: 1 },
      network: { cols: 2, rows: 2 },
      cooler:  { cols: 1, rows: 2 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },
  console_t2: {
    key: 'console_t2', name: 'Nexus Deck', w: 3, h: 3, color: '#808890', stackMax: 1,
    category: 'tech', tags: ['console'],
    description: 'Flagship standard-issue deck. Every bay oversized, every bus at max bandwidth.',
    value: { credits: 4000 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 2, rows: 2 },
      ram:     { cols: 2, rows: 2 },
      gpu:     { cols: 2, rows: 2 },
      network: { cols: 2, rows: 5 },
      cooler:  { cols: 2, rows: 2 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },
  console_mk3: {
    key: 'console_mk3', name: 'Patchwork Deck III', w: 3, h: 3, color: '#8a96a2', stackMax: 1,
    img: '/img/items/CONSOLE_Makeshift_MKIII.png',
    category: 'tech', tags: ['console'],
    description: 'A serious workshop build. Almost matches a premium deck.',
    value: { credits: 1800 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 2, rows: 2 },
      ram:     { cols: 2, rows: 2 },
      gpu:     { cols: 2, rows: 2 },
      network: { cols: 2, rows: 3 },
      cooler:  { cols: 2, rows: 2 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },
  console_original: {
    key: 'console_original', name: 'Original Deck', w: 3, h: 3, color: '#9aa4ae', stackMax: 1,
    img: '/img/items/CONSOLE_Original.png',
    category: 'tech', tags: ['console'],
    description: 'A factory-original pre-war deck. Restored. Immaculate. Sits just above a mass-produced Standard.',
    value: { credits: 2500 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 2, rows: 2 },
      ram:     { cols: 2, rows: 2 },
      gpu:     { cols: 2, rows: 2 },
      network: { cols: 2, rows: 4 },
      cooler:  { cols: 2, rows: 2 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },
  console_blackmarket: {
    key: 'console_blackmarket', name: 'Ghost Deck', w: 3, h: 3, color: '#f85149', stackMax: 1,
    img: '/img/items/CONSOLE_BlackMarket.png',
    category: 'tech', tags: ['console'],
    description: 'A custom black-market rig. Every bay oversized. Every seal broken. Nobody asks where it came from.',
    value: { credits: 6000, gchips: 10 },
    containerType: 'console',
    internalHardware: {
      cpu:     { cols: 2, rows: 3 },
      ram:     { cols: 2, rows: 3 },
      gpu:     { cols: 2, rows: 3 },
      network: { cols: 2, rows: 6 },
      cooler:  { cols: 2, rows: 3 },
      cdSlot:  { cols: 2, rows: 1 },
    },
  },

  // ===================================================================
  // VR HEADSETS
  // ===================================================================
  vr_basic: {
    key: 'vr_basic', name: 'Standard Visor', w: 2, h: 2, color: '#8b949e', stackMax: 1,
    category: 'tech', tags: ['vr_headset'],
    description: 'Consumer VR rig. Sharp enough to aim, cheap enough to break.',
    value: { credits: 400 },
    rarity: 'uncommon',
    stats: { multipliers: { attack: 1.10 } },
  },
  vr_advanced: {
    key: 'vr_advanced', name: 'Tactical Visor', w: 2, h: 2, color: '#d29922', stackMax: 1,
    category: 'tech', tags: ['vr_headset'],
    description: 'Military-grade rig. Real-time threat overlay and hardened predictive shielding.',
    value: { credits: 1200 },
    rarity: 'rare',
    stats: { multipliers: { defense: 1.10 } },
  },
  vr3: {
    key: 'vr3', name: 'Prototype Visor', w: 2, h: 2, color: '#d29922', stackMax: 1,
    img: '/img/items/VR3.png',
    category: 'tech', tags: ['vr_headset'],
    description: 'A prototype-class rig with no serial number. Perceives the net at its theoretical maximum.',
    value: { credits: 3000 },
    rarity: 'epic',
    stats: { multipliers: { attack: 1.25, defense: 1.25 } },
  },

  // ===================================================================
  // SHIP DATA (CDs)
  // ===================================================================
  datadisk1: {
    key: 'datadisk1', name: 'Classic Fighter CD', w: 2, h: 1, color: '#be00af', stackMax: 1,
    category: 'software', tags: ['cd', 'ship_data'],
    rarity: 'common',
    description: 'Starter blueprint for the Scout Frigate. Cheap frame, cheap guns, cheap death.',
    value: { credits: 200 },
    shipKey: 'scout',
    internalCols: 6, internalRows: 5,
    internalItems: [],
  },
  datadisk2: {
    key: 'datadisk2', name: 'Freighter CD', w: 2, h: 1, color: '#be00af', stackMax: 1,
    category: 'software', tags: ['cd', 'ship_data'],
    rarity: 'legendary',
    description: 'Heavy hauler blueprint. Slow, sturdy, and holds the largest cargo bay in the fleet.',
    value: { credits: 2500 },
    shipKey: 'freighter',
    internalCols: 8, internalRows: 6,
    internalItems: [],
  },
  datadisk3: {
    key: 'datadisk3', name: 'Interceptor CD', w: 2, h: 1, color: '#be00af', stackMax: 1,
    category: 'software', tags: ['cd', 'ship_data'],
    rarity: 'rare',
    description: 'Strike fighter blueprint. Fast as a knife, fragile as glass.',
    value: { credits: 800 },
    shipKey: 'interceptor',
    internalCols: 6, internalRows: 4,
    internalItems: [],
  },
  datadisk4: {
    key: 'datadisk4', name: 'Crusader CD', w: 2, h: 1, color: '#be00af', stackMax: 1,
    category: 'software', tags: ['cd', 'ship_data'],
    rarity: 'unique',
    description: 'Classified blueprint for the Prototype Vessel. There is no second copy.',
    value: { credits: 15000, itokens: 20, gchips: 5 },
    shipKey: 'prototype',
    internalCols: 8, internalRows: 7,
    internalItems: [],
  },
  datadisk5: {
    key: 'datadisk5', name: 'Phantom CD', w: 2, h: 1, color: '#be00af', stackMax: 1,
    category: 'software', tags: ['cd', 'ship_data'],
    rarity: 'mythic',
    description: 'Stealth-frame blueprint. Emits no signature. Leaves no trace.',
    value: { credits: 6000, gchips: 5 },
    shipKey: 'phantom',
    internalCols: 7, internalRows: 5,
    internalItems: [],
  },

    // ===================================================================
  // DECODERS — unlock secure containers of matching tier
  // ===================================================================
  decoder_t3: {
    key: 'decoder_t3', name: 'Rare Decoder', w: 1, h: 1, color: '#3b82f6', stackMax: 3,
    
    category: 'keys', tags: ['key', 'decoder'],
    description: 'Decrypts a Rare-grade secure container.',
    value: { credits: 600 },
    rarity: 'rare',
  },
  decoder_t4: {
    key: 'decoder_t4', name: 'Epic Decoder', w: 1, h: 1, color: '#a371f7', stackMax: 3,
    
    category: 'keys', tags: ['key', 'decoder'],
    description: 'Decrypts an Epic-grade secure container.',
    value: { credits: 1500, gchips: 1 },
    rarity: 'epic',
  },
  decoder_t5: {
    key: 'decoder_t5', name: 'Legendary Decoder', w: 1, h: 1, color: '#d29922', stackMax: 2,
    
    category: 'keys', tags: ['key', 'decoder'],
    description: 'Decrypts a Legendary-grade secure container.',
    value: { credits: 4000, gchips: 3 },
    rarity: 'legendary',
  },
  decoder_t6: {
    key: 'decoder_t6', name: 'Mythic Decoder', w: 1, h: 1, color: '#f85149', stackMax: 1,
    
    category: 'keys', tags: ['key', 'decoder'],
    description: 'Decrypts a Mythic-grade secure container.',
    value: { credits: 12000, gchips: 8 },
    rarity: 'mythic',
  },
  decoder_t7: {
    key: 'decoder_t7', name: 'Unique Decoder', w: 1, h: 1, color: '#ffd900', stackMax: 1,

    category: 'keys', tags: ['key', 'decoder'],
    description: 'Decrypts a Unique-grade secure container.',
    value: { credits: 40000, gchips: 20 },
    rarity: 'unique',
  },

  // ===================================================================
  // CONTAINERS
  // ===================================================================
  gear_crate: {
    key: 'gear_crate', name: 'Gear Crate', w: 4, h: 2, color: '#7bb885', stackMax: 1,
    category: 'containers', tags: ['container'],
    internalCols: 6, internalRows: 3, internalItems: [],
    allowedInside: ['anomaly_container'], canStore: null,
    description: 'A large reinforced crate. Not much to look at, but it can hold a lot.',
    value: { credits: 250 }
  },
  CD_Container: {
    key: 'CD_Container', name: 'CD Container', w: 2, h: 4, color: '#7bb885', stackMax: 1,
    category: 'containers', tags: ['container'],
    internalCols: 6, internalRows: 3, internalItems: [],
    allowedInside: ['anomaly_container'], canStore: { categories: ['cd'] },
    description: 'A large reinforced crate. Not much to look at, but it can hold a lot.',
    value: { credits: 250 }
  },
  sectortwentysafe: {
    key: 'sectortwentysafe', name: 'RARE SECURE CONTAINER', w: 2, h: 2,
    color: '#eeff00', bgColor: 'rgba(236, 201, 0, 0.2)', stackMax: 1,
    category: 'containers', tags: ['container', 'lockable', 'secure', 'data'],
    internalCols: 3, internalRows: 2, internalItems: [],
    lockType: 'decoder', decoderTier: 3,
    allowedInside: [], canStore: null,
    description: 'A sealed container of rare-grade loot. Requires a Rare Decoder.',
    value: { credits: 1500 },
    rarity: 'rare',
  },
  secure_container_epic: {
    key: 'secure_container_epic', name: 'EPIC SECURE CONTAINER', w: 2, h: 2,
    color: '#a371f7', bgColor: 'rgba(163, 113, 247, 0.2)', stackMax: 1,
    category: 'containers', tags: ['container', 'lockable', 'secure', 'data'],
    internalCols: 3, internalRows: 3, internalItems: [],
    lockType: 'decoder', decoderTier: 4,
    allowedInside: [], canStore: null,
    description: 'A reinforced container of epic-grade loot. Requires an Epic Decoder.',
    value: { credits: 5000 },
    rarity: 'epic',
  },
  secure_container_legendary: {
    key: 'secure_container_legendary', name: 'LEGENDARY SECURE CONTAINER', w: 2, h: 2,
    color: '#d29922', bgColor: 'rgba(210, 153, 34, 0.2)', stackMax: 1,
    category: 'containers', tags: ['container', 'lockable', 'secure', 'data'],
    internalCols: 3, internalRows: 3, internalItems: [],
    lockType: 'decoder', decoderTier: 5,
    allowedInside: [], canStore: null,
    description: 'A heavily-armored container of legendary-grade loot. Requires a Legendary Decoder.',
    value: { credits: 15000 },
    rarity: 'legendary',
  },
  secure_container_mythic: {
    key: 'secure_container_mythic', name: 'MYTHIC SECURE CONTAINER', w: 2, h: 2,
    color: '#f85149', bgColor: 'rgba(248, 81, 73, 0.2)', stackMax: 1,
    category: 'containers', tags: ['container', 'lockable', 'secure', 'data'],
    internalCols: 3, internalRows: 4, internalItems: [],
    lockType: 'decoder', decoderTier: 6,
    allowedInside: [], canStore: null,
    description: 'A corporate vault. Requires a Mythic Decoder.',
    value: { credits: 50000 },
    rarity: 'mythic',
  },
  secure_container_unique: {
    key: 'secure_container_unique', name: 'UNIQUE SECURE CONTAINER', w: 2, h: 2,
    color: '#ffd900', bgColor: 'rgba(255, 217, 0, 0.15)', stackMax: 1,
    category: 'containers', tags: ['container', 'lockable', 'secure', 'data'],
    internalCols: 3, internalRows: 4, internalItems: [],
    lockType: 'decoder', decoderTier: 7,
    allowedInside: [], canStore: null,
    description: 'A one-of-a-kind vault. Requires a Unique Decoder.',
    value: { credits: 150000, gchips: 25 },
    rarity: 'unique',
  },
  
  anomaly_container: {
    key: 'anomaly_container', name: 'Anomaly Container', w: 1, h: 2,
    color: '#505860', bgColor: 'rgba(80, 88, 96, 0.2)', stackMax: 1,
    category: 'containers', tags: ['container'],
    internalCols: 1, internalRows: 2, internalItems: [],
    dynamicImageCategory: 'anomaly',
    allowedInside: [], canStore: { categories: ['anomaly'] },
    description: 'A reinforced container built specifically to house anomalous objects.',
    value: { credits: 800 }
  },

  // ===================================================================
  // CURRENCY
  // ===================================================================
  gchips: {
    key: 'gchips', name: 'Ghost Chips', w: 2, h: 1, color: '#81008d', stackMax: 16,
    category: 'valuables', tags: ['currency', 'trade'],
    description: 'Dark-market currency. Untraceable, and worth a lot to the right people.',
    value: { gchips: 1 }
  },
  itokens: {
    key: 'itokens', name: 'Imperial Tokens', w: 1, h: 2, color: '#f0c509', stackMax: 50,
    category: 'valuables', tags: ['currency', 'trade'],
    description: 'Imperial-issue tokens. Used by the loyalists for high-tier trade.',
    value: { itokens: 1 }
  },

  // ===================================================================
  // ANOMALY
  // ===================================================================
  energycrystal: {
    key: 'energycrystal', name: 'Violet Energy Crystal', w: 1, h: 2, color: '#830883', stackMax: 1,
    category: 'anomaly', tags: ['trade', 'anomaly', 'crystal'],
    description: 'A violet crystal that hums faintly. Fires were started over less.',
    value: { credits: 2000, gchips: 5 }
  },
  atomiccore: {
    key: 'atomiccore', name: 'Atomic Energy Core', w: 1, h: 2, color: '#2a71dd', stackMax: 1,
    category: 'anomaly', tags: ['trade', 'anomaly'],
    description: 'A sealed atomic core. Warm to the touch. Do not drop.',
    value: { credits: 1500, itokens: 10 }
  },
  alienplant: {
    key: 'alienplant', name: 'Alien Plant', w: 1, h: 2, color: '#01a71c', stackMax: 1,
    category: 'anomaly', tags: ['trade', 'anomaly', 'plant'],
    description: 'A strange bio-luminescent plant. It looks back at you. Probably harmless.',
    value: { credits: 600, gchips: 2 }
  },

  // ===================================================================
  // DATA LOOT
  // ===================================================================
  datapad: {
    key: 'datapad', name: 'Data Pad', w: 1, h: 1, color: '#5a8aaa', stackMax: 5,
    img: '/img/items/file_text.png',
    category: 'data', tags: ['data', 'low_value'],
    description: 'A generic data pad. Whatever was on it, someone thought it was worth writing down.',
    value: { credits: 30 },
    rarity: 'common',
  },
  accesslog: {
    key: 'accesslog', name: 'Access Log', w: 1, h: 1, color: '#5a8aaa', stackMax: 5,
    img: '/img/items/file_binary.png',
    category: 'data', tags: ['data', 'security', 'low_value'],
    description: 'Connection records pulled from a server. Tells you who was careless.',
    value: { credits: 45 },
    rarity: 'common',
  },
  creds: {
    key: 'creds', name: 'Credential Dump', w: 1, h: 1, color: '#6ee7ff', stackMax: 3,
    img: '/img/items/file_secure.png',
    category: 'data', tags: ['data', 'credentials', 'sensitive'],
    description: 'A file of passwords, tokens, and hashes. Someone is going to be very unhappy.',
    value: { credits: 180, itokens: 1 },
    rarity: 'uncommon',
  },
  userdb: {
    key: 'userdb', name: 'User Database', w: 1, h: 2, color: '#a371f7', stackMax: 1,
    img: '/img/items/file_database.png',
    category: 'data', tags: ['data', 'user', 'sensitive'],
    description: 'A full user table. Names, addresses, activity — the kind of thing that ends careers.',
    value: { credits: 400 },
    rarity: 'rare',
  },
  exploit: {
    key: 'exploit', name: 'Exploit Kit', w: 2, h: 1, color: '#f85149', stackMax: 1,
    img: '/img/items/file_secure.png',
    category: 'data', tags: ['data', 'weapon', 'dark', 'valuable'],
    description: 'A compact exploit kit. Zero-day, probably. Handle with care — and don\'t test it on yourself.',
    value: { credits: 900, gchips: 2 },
    rarity: 'epic',
  },
  
  satellite: {
    key: 'satellite', name: 'Satellite Feed', w: 2, h: 1, color: '#6ee7ff', stackMax: 1,
    img: '/img/items/file_binary.png',
    category: 'data', tags: ['data', 'gov', 'extreme', 'valuable'],
    description: 'A live feed from a surveillance satellite. The kind of thing governments deny exists.',
    value: { credits: 3000, itokens: 15 },
    rarity: 'legendary',
  },
};

let nextItemId = 1000;

export function makeItem(key, opts = {}) {
  const bp = BLUEPRINTS[key];
  if (!bp) throw new Error('Unknown item key: ' + key);

  const foundInWorld = !!opts.foundInWorld;

  const item = {
    id: nextItemId++,
    key: bp.key,
    name: bp.name,
    w: bp.w,
    h: bp.h,
    color: bp.color || null,
    bgColor: bp.bgColor || null,
    img: bp.img !== undefined ? bp.img : `/img/items/${bp.key}.png`,
    imgScale: bp.imgScale !== undefined ? bp.imgScale : 1,
    imgWidth: bp.imgWidth !== undefined ? bp.imgWidth : null,
    imgHeight: bp.imgHeight !== undefined ? bp.imgHeight : null,
    rotated: false,
    col: 0,
    row: 0,
    count: 1,
    stackMax: bp.stackMax || 1,
    category: bp.category || 'misc',
    tags: bp.tags ? [...bp.tags] : [],
    description: bp.description || 'No description available.',
    value: bp.value || null,
    state: bp.state !== undefined ? bp.state : 0,
    stateImages: bp.stateImages ? { ...bp.stateImages } : null,
    shipKey: bp.shipKey || null,
    containerType: bp.containerType || null,
    rarity: bp.rarity || 'common',
    borderColor: bp.borderColor || null,
    bgGradient: bp.bgGradient || null,
    glow: bp.glow || null,
    stats: bp.stats ? { ...bp.stats } : null,
  };

  if (bp.internalCols && bp.internalRows) {
    item.internalCols = bp.internalCols;
    item.internalRows = bp.internalRows;
    item.internalItems = [];
    item.allowedInside = bp.allowedInside || [];
    item.canStore = bp.canStore || null;
    item.dynamicImageCategory = bp.dynamicImageCategory || null;
  }

  if (bp.internalHardware) {
    item.hardware = {};
    for (const [slot, dims] of Object.entries(bp.internalHardware)) {
      item.hardware[slot] = {
        cols: dims.cols,
        rows: dims.rows,
        items: [],
      };
    }
  }

  if (bp.lockType) {
    item.lockType = bp.lockType;
    item.requiredKey = bp.requiredKey || null;
    item.decoderTier = bp.decoderTier !== undefined ? bp.decoderTier : null;
    item.locked = foundInWorld ? true : false;
    item.lockResolved = foundInWorld ? false : true;
  }

  return item;
}

export function nextItemIdForSplit() {
  return nextItemId++;
}

export function getBlueprint(key) {
  return BLUEPRINTS[key] || null;
}

export function ensureNextItemIdAbove(maxSeenId) {
  if (typeof maxSeenId !== 'number' || !Number.isFinite(maxSeenId)) return;
  if (maxSeenId >= nextItemId) nextItemId = maxSeenId + 1;
}