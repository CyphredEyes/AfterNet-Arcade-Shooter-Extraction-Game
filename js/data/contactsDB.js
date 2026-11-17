/* ===================================================================
   Contacts — story missions (auto), global contracts, private contracts.
   Story:   no timers, tick across any raid, sequential per contact.
   Global:  timers, apply effects to every raid until resolved.
   Private: timers, played via Ready → Contracts.
   =================================================================== */

export const CONTACTS = {
  rook: {
    id: 'rook',
    name: 'Rook',
    avatar: '◈',
    tagline: 'Your first handler. Reliable. Patient.',
    description: 'An old netrunner who pulled you out of a bad sector once. Keeps things simple and fair.',
    color: '#3fb950',

    market: {
      fixed: [
        { key: 'silicon',     price:  20, currency: 'credits', stock: 40 },
        { key: 'copper',      price:  25, currency: 'credits', stock: 30 },
        { key: 'plastic',     price:  10, currency: 'credits', stock: 30 },
        { key: 'electronics', price:  60, currency: 'credits', stock: 15 },
      ],
      random: {
        table: [
          { key: 'ram_t1',    price:  180, currency: 'credits', stock: [2, 4], weight: 8, repTier: 0 },
          { key: 'cpu_t1',    price:  200, currency: 'credits', stock: [2, 4], weight: 8, repTier: 0 },
          { key: 'cooler_t1', price:  140, currency: 'credits', stock: [2, 4], weight: 7, repTier: 0 },
          { key: 'ram_t2',    price:  500, currency: 'credits', stock: [1, 2], weight: 5, repTier: 1 },
          { key: 'cpu_t2',    price:  700, currency: 'credits', stock: [1, 2], weight: 5, repTier: 1 },
          { key: 'ram_t3',    price: 1500, currency: 'credits', stock: [1, 1], weight: 3, repTier: 2 },
        ],
        countMin: 3, countMax: 4, refreshRaids: 5,
      },
    },

    missions: [
      {
        id: 'rook_story_1',
        type: 'story',
        order: 1,
        name: 'First Steps',
        description: 'Learn the trade. Destroy 3 nodes in any sector.',
        conditions: 'Auto-tracks. Completes when 3 nodes are destroyed across any number of raids.',
        stages: [
          { type: 'destroy_nodes', nodeCategory: null, count: 3, label: 'Destroy 3 nodes (any)' },
        ],
        rewards: {
          credits: 500, reputation: 5,
          items: [
            { key: 'silicon', count: 10 },
            { key: 'copper',  count: 10 },
            { key: 'plastic', count: 5 },
          ],
        },
        penalties: {},
        cancelable: false,
      },
      {
        id: 'rook_story_2',
        type: 'story',
        order: 2,
        name: 'Bring Back Proof',
        description: 'Extract from a sector with at least 5 items in cargo.',
        conditions: 'Auto-tracks. Completes on any successful extraction with 5+ items.',
        stages: [
          { type: 'extract_items', count: 5, label: 'Extract with 5 items' },
        ],
        rewards: {
          credits: 800, reputation: 5,
          items: [{ key: 'ram_t1', count: 1 }],
        },
        penalties: {},
        cancelable: false,
      },
    ],

    contracts: [
      // ---- Global: debt ----
      {
        id: 'rook_gc_debt',
        type: 'global',
        name: 'Small Debt',
        description: 'Rook fronted you some gear once. He wants 10% of your take for the next 3 matches.',
        conditions: '10% of extracted loot value transferred to Rook on each successful extraction. Resolves after 3 matches.',
        globalEffect: {
          type: 'debt',
          percentage: 0.10,
          matchesToApply: 3,
        },
        rewards: { credits: 0, reputation: 8, items: [] },
        penalties: { reputation: -5, items: [] },
        expiresInRaids: 10,
        deadlineRaids: 8,
        cancelable: true,
      },

      // ---- Private: delivery ----
      {
        id: 'rook_pc_deliver',
        type: 'private',
        name: 'Sector Drop',
        description: 'Courier 2× Credential Dump to a Security node in a LOW sector. Do not lose them.',
        conditions: 'Enter via Ready → Contracts. Two Credential Dumps will be placed in your CD cargo (marked CONTRACT). Fly to any Security node and deliver. Dropping them, extracting with them, or dying fails the contract.',
        sectorTier: 'LOW',
        delivery: {
          itemKey: 'creds',
          itemCount: 2,
          target: 'node',
          targetCategory: 'security',
        },
        stages: [
          { type: 'deliver', label: 'Deliver 2× Credential Dump to Security node' },
        ],
        rewards: { credits: 900, reputation: 5, items: [] },
        penalties: { reputation: -10, items: [] },
        expiresInRaids: 5,
        deadlineRaids: 3,
        failOnDeath: false,
        cancelable: true,
      },
    ],
  },

  volt: {
    id: 'volt',
    name: 'Volt',
    avatar: '⚡',
    tagline: 'Ex-military. Impatient. Pays well.',
    description: 'A former corporate enforcer who went rogue. Runs combat-heavy contracts.',
    color: '#d29922',

    market: {
      fixed: [
        { key: 'net_t1',    price: 200, currency: 'credits', stock: 4 },
        { key: 'gpu_t1',    price: 200, currency: 'credits', stock: 4 },
        { key: 'cooler_t1', price: 150, currency: 'credits', stock: 4 },
      ],
      random: {
        table: [
          { key: 'net_t2',    price:  700, currency: 'credits', stock: [1, 2], weight: 6, repTier: 0 },
          { key: 'gpu_t2',    price:  800, currency: 'credits', stock: [1, 2], weight: 6, repTier: 0 },
          { key: 'cooler_t2', price:  700, currency: 'credits', stock: [1, 2], weight: 5, repTier: 1 },
          { key: 'net_t3',    price: 2500, currency: 'itokens', stock: [1, 1], weight: 3, repTier: 2 },
          { key: 'gpu_t3',    price: 2500, currency: 'itokens', stock: [1, 1], weight: 3, repTier: 2 },
        ],
        countMin: 2, countMax: 3, refreshRaids: 4,
      },
    },

    missions: [],

    contracts: [
      // ---- Global: stat debuff ----
      {
        id: 'volt_gc_nerf',
        type: 'global',
        name: 'Field Test Alpha',
        description: 'Volt wants to test your ship\'s limits. Your RAM modules will run 40% underperforming for 2 matches.',
        conditions: 'All RAM attack multipliers reduced by 40% for 2 matches. Applies to any raid. Resolves automatically.',
        globalEffect: {
          type: 'stat_mod',
          stat: 'attack',
          sourceComponent: 'ram',
          multiplier: 0.60,
          matchesToApply: 2,
        },
        rewards: { credits: 700, reputation: 4, items: [] },
        penalties: { reputation: -2, items: [] },
        expiresInRaids: 8,
        deadlineRaids: 6,
        cancelable: true,
      },

      // ---- Private: combat ----
      {
        id: 'volt_pc_bug',
        type: 'private',
        name: 'Bug Hunt',
        description: 'Kill 5 Security nodes in a MID sector. High threat expected.',
        conditions: 'Enter via Ready → Contracts. Kill 5 Security-category nodes in a MID sector. Dies before completion = fail.',
        sectorTier: 'MID',
        stages: [
          { type: 'destroy_nodes', nodeCategory: 'security', count: 5, label: 'Destroy 5 Security nodes' },
        ],
        rewards: { credits: 1000, reputation: 4, items: [] },
        penalties: { reputation: -5, items: [] },
        expiresInRaids: 5,
        deadlineRaids: 2,
        failOnDeath: true,
        cancelable: true,
      },
    ],
  },

  iris: {
    id: 'iris',
    name: 'Iris',
    avatar: '◐',
    tagline: 'Data broker. Cautious. Well-connected.',
    description: 'An independent data broker who trades in information, not violence. Runs logistics contracts.',
    color: '#6ee7ff',

    market: {
      fixed: [
        { key: 'datacables',  price:   90, currency: 'credits', stock: 10 },
        { key: 'data_cache',  price:  140, currency: 'credits', stock:  6 },
        { key: 'vr_basic',    price:  500, currency: 'credits', stock:  2 },
      ],
      random: {
        table: [
          { key: 'compacted_data', price:  280, currency: 'credits', stock: [1, 3], weight: 7, repTier: 0 },
          { key: 'vr_advanced',    price: 1500, currency: 'credits', stock: [1, 1], weight: 4, repTier: 1 },
          { key: 'vr3',            price: 4000, currency: 'itokens', stock: [1, 1], weight: 2, repTier: 2 },
        ],
        countMin: 2, countMax: 3, refreshRaids: 3,
      },
    },

    missions: [],

    contracts: [
      // ---- Global: collection ----
      {
        id: 'iris_gc_harvest',
        type: 'global',
        name: 'Silicon Quota',
        description: 'Iris needs silicon. Deliver 20 across any raids. She takes it automatically from your stash on extraction.',
        conditions: 'Every successful extraction, 5× Silicon is consumed from your stash. Contract completes after 4 extractions or 20 total silicon.',
        globalEffect: {
          type: 'collection',
          itemKey: 'silicon',
          perExtraction: 5,
          totalTarget: 20,
        },
        rewards: { credits: 400, reputation: 5, items: [] },
        penalties: { reputation: -3, items: [] },
        expiresInRaids: 6,
        deadlineRaids: 8,
        cancelable: true,
      },

      // ---- Private: delivery to core ----
      {
        id: 'iris_pc_core',
        type: 'private',
        name: 'Core Drop',
        description: 'Courier 1× User Database to the sector core in a MID sector. Rumor says it\'s the original.',
        conditions: 'Enter via Ready → Contracts. A User Database will be placed in your CD cargo (marked CONTRACT). Fly to the sector core and deliver. Extract without delivering, drop it, or die → fail.',
        sectorTier: 'MID',
        delivery: {
          itemKey: 'userdb',
          itemCount: 1,
          target: 'core',
        },
        stages: [
          { type: 'deliver', label: 'Deliver 1× User Database to the Core' },
        ],
        rewards: { credits: 1200, reputation: 6, items: [] },
        penalties: { reputation: -8, items: [] },
        expiresInRaids: 4,
        deadlineRaids: 3,
        failOnDeath: false,
        cancelable: true,
      },
    ],
  },
};

export const CONTACT_LIST = ['rook', 'volt', 'iris'];