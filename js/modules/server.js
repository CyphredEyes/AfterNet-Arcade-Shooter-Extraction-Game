import {
  SERVER, WORLD_W, WORLD_H, SERVER_TIER,
  NODE_LAYOUT, NODE_CATEGORIES, NODE_CATEGORY_KEYS, SECTOR_ENCRYPTION_CHANCE,
} from './config.js';
import { wrapPos } from './world.js';
import { SITE_TYPES, pickSiteType } from '../data/lootDB.js';

let nextServerId = 1;
let nextGroupId  = 1;
let nextNodeId   = 1;

/* -------------------------------------------------------------------
   Node factory
   ------------------------------------------------------------------- */
function makeNode(category, angle, orbitRadius, radius, nodeHp) {
  const def = NODE_CATEGORIES[category];
  return {
    id: nextNodeId++,
    category,
    ox: Math.cos(angle) * orbitRadius,
    oy: Math.sin(angle) * orbitRadius,
    x: 0, y: 0,
    radius: radius,
    hp: nodeHp, maxHp: nodeHp,
    broken: false,
    wobblePhaseX: Math.random() * Math.PI * 2,
    wobblePhaseY: Math.random() * Math.PI * 2,
    wobbleSpeed:  NODE_LAYOUT.wobbleSpeed * (0.8 + Math.random() * 0.4),
    wobbleAmp:    NODE_LAYOUT.wobbleAmp,
    icon:    def.icon,
    iconImg: def.iconImg,
    color:   def.color,
    hasMasterKey: false,
  };
}

/* -------------------------------------------------------------------
   Server (sector) factory
   ------------------------------------------------------------------- */
export function createServer(x, y, typeOrKey, tier = null) {
  let type = typeOrKey;
  if (typeof typeOrKey === 'string') type = SITE_TYPES[typeOrKey];
  if (!type) type = pickSiteType();

  const tierNum = (typeof tier === 'number') ? tier : 2;
  const tDef    = SERVER_TIER[tierNum];

  const encryptionRoll = Math.random();
  const communicationEncrypted = encryptionRoll < (SECTOR_ENCRYPTION_CHANCE[tierNum] ?? 0);

  const wx = wrapPos(x, WORLD_W);
  const wy = wrapPos(y, WORLD_H);

  /* ---- Core ---- */
  const core = {
    id: nextNodeId++,
    x: wx, y: wy,
    radius: SERVER.coreRadius,
    hp: tDef.coreHp, maxHp: tDef.coreHp,
    broken: false,
  };

  /* ---- Category nodes ---- */
  const categories = [];
  for (const cat of NODE_CATEGORY_KEYS) {
    for (let i = 0; i < (tDef.nodes[cat] || 0); i++) categories.push(cat);
  }
  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }

  const nodes = [];
  const count       = categories.length;
  const angleStep   = (Math.PI * 2) / count;
  const angleOffset = Math.random() * Math.PI * 2;
  const jitterMax   = angleStep * 0.35;

  for (let i = 0; i < count; i++) {
    const baseAngle = i * angleStep + angleOffset;
    const jitter    = (Math.random() - 0.5) * 2 * jitterMax;
    const angle     = baseAngle + jitter;

    const radius = NODE_LAYOUT.radius
      + (Math.random() - 0.5) * 2 * NODE_LAYOUT.radiusJitter;

    let orbitRadius = NODE_LAYOUT.orbitRadiusMin
      + Math.random() * (NODE_LAYOUT.orbitRadiusMax - NODE_LAYOUT.orbitRadiusMin);

    for (let attempt = 0; attempt < 12; attempt++) {
      const nx = Math.cos(angle) * orbitRadius;
      const ny = Math.sin(angle) * orbitRadius;

      const overlaps = nodes.some(n => {
        const dx = nx - n.ox;
        const dy = ny - n.oy;
        const minDist = radius + n.radius + NODE_LAYOUT.minNodePadding;
        return (dx * dx + dy * dy) < minDist * minDist;
      });

      if (!overlaps) break;
      orbitRadius += 15;
    }

    const node = makeNode(categories[i], angle, orbitRadius, radius, tDef.nodeHp);
    node.x = wx + node.ox;
    node.y = wy + node.oy;
    nodes.push(node);
  }

  /* ---- Assemble ---- */
  const server = {
    id: nextServerId++,
    x: wx, y: wy,
    type,
    tier:    tierNum,
    tierDef: tDef,
    state:   'PASSIVE',
    communicationEncrypted,
    core,
    nodes,
    spoils: {},
    near: false,
    _time: Math.random() * 100,
  };

  /* ---- Compat shims ---- */
  Object.defineProperty(server, 'mainHp', {
    get() { return this.core.hp; },
    set(v) { this.core.hp = v; },
  });
  Object.defineProperty(server, 'mainMaxHp', {
    get() { return this.core.maxHp; },
  });
  Object.defineProperty(server, 'mainBroken', {
    get() { return this.core.broken; },
    set(v) { this.core.broken = v; },
  });

  server.webpage      = { isVisible: false };
  server.links        = [];
  server.linkBonus    = 0;
  server.baseChildren = null;
  server.networkBag   = null;
  server.networkGroup = null;

  server.lootTree = {
    type: 'folder',
    name: `${type.label || 'Sector'} #${server.id}/`,
    children: () => [],
  };

  return server;
}

/* -------------------------------------------------------------------
   Spawn — single sector, single server at world centre
   ------------------------------------------------------------------- */
export function spawnServerGroups(sectorTier = null) {
  const type = pickSiteType(sectorTier);

  const tierMap = { LOW: 0, MID: 1, HIGH: 3, EXTREME: 4 };
  const tierNum = (typeof sectorTier === 'number')
    ? sectorTier
    : (tierMap[sectorTier] ?? 2);

  const group = {
    id: nextGroupId++,
    type,
    cx: WORLD_W * 0.5,
    cy: WORLD_H * 0.5,
    servers: [],
    packets: [],
    topology: 'single',
  };

  const server = createServer(WORLD_W * 0.5, WORLD_H * 0.5, type, tierNum);
  server.networkGroup = group;
  group.servers.push(server);

  const hasKey = server.nodes.some(n => n.hasMasterKey);
  console.debug(
    `[server] sector spawned — tier ${tierNum}, ` +
    `${server.nodes.length} nodes + core, master key: ${hasKey ? 'yes' : 'no'}`,
  );

  return { groups: [group], servers: [server] };
}

/* -------------------------------------------------------------------
   Legacy stubs — no-op, kept so old imports don't crash
   ------------------------------------------------------------------- */
export function finalizeServer(server) {
  // Batch 2 will populate loot bags on-demand at kill time.
  return server;
}

export function buildServerPacketsNode() {
  return null;
}