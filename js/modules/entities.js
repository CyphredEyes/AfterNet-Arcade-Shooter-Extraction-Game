import {
  WORLD_W, WORLD_H, PLAYER, BULLET, PACKET,
  PACKET_TIERS, PACKET_KILL_MULTIPLIER,
} from './config.js';
import { wrapPos } from './world.js';
import { spawnServerGroups } from './server.js';
import { generateLootBag } from '../systems/lootSystem.js';
import { SITE_TYPES } from '../data/lootDB.js';

let nextPacketId = 1;

export function createPlayer(opts = {}) {
  return {
    x: PLAYER.startX, y: PLAYER.startY,
    vx: 0, vy: 0,
    angle: 0, r: PLAYER.radius,
    hp: PLAYER.maxHp, invuln: 0,
    maxSpeed:     opts.maxSpeed     ?? PLAYER.maxSpeed,
    bulletDamage: opts.bulletDamage ?? 1,
    defenseMul:   opts.defenseMul   ?? 1,
    fireRate:     opts.fireRate     ?? BULLET.fireRate,
    invulnTime:   opts.invulnTime   ?? PLAYER.invulnTime,
  };
}

export function createBullet(x, y, vx, vy, damage = 1) {
  return {
    x: wrapPos(x, WORLD_W),
    y: wrapPos(y, WORLD_H),
    vx, vy,
    life: BULLET.life,
    damage,
  };
}

/* Create one packet docked at `sourceServer`.
 * Every packet has TWO bags:
 *   secureBag → primary loot (locked until master key used)
 *   dropBag   → always-open bag (player storage, empty at spawn) */
/* One packet, bound to a node. Motion is managed in asteroidSystem. */
function makePacket(kind, node, sourceServer, group, opts = {}) {
  const isTcp = kind === 'tcp';

  const cfg = isTcp
    ? { sizeMin: PACKET.tcpSizeMin, sizeMax: PACKET.tcpSizeMax }
    : { sizeMin: PACKET.udpSizeMin, sizeMax: PACKET.udpSizeMax };

  const s = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
  const lootType = isTcp ? sourceServer.type : SITE_TYPES.udp;

  const direction = opts.direction || (Math.random() < 0.5 ? 'core_to_node' : 'node_to_core');
  const encrypted = sourceServer.communicationEncrypted === true;

  const startRef = direction === 'core_to_node' ? sourceServer : node;

  // Initial rotation aligned with travel direction
  const dx = node.x - sourceServer.x;
  const dy = node.y - sourceServer.y;
  const initialAngle = direction === 'core_to_node'
    ? Math.atan2(dy, dx)
    : Math.atan2(-dy, -dx);

  let motionQueue;
  if (isTcp) {
    motionQueue = direction === 'core_to_node'
      ? ['core_to_node', 'node_to_core', 'core_to_node']
      : ['node_to_core', 'core_to_node', 'node_to_core'];
  } else {
    motionQueue = [direction];
  }

  const tierCfg = PACKET_TIERS[sourceServer.tier] || PACKET_TIERS[0];
  const maxContamination = tierCfg.contamination;
  const maxKill = maxContamination * PACKET_KILL_MULTIPLIER;

  return {
    id: nextPacketId++,
    kind,
    nodeId: node.id,
    sourceServerId: sourceServer.id,
    groupId: group.id,
    nodeRef: node,
    sourceServerRef: sourceServer,
    offsetX: 0,
    offsetY: 0,

    state: 'waiting',
    waitTimer: PACKET.initialWaitMin + Math.random() * (PACKET.initialWaitMax - PACKET.initialWaitMin),
    transit: null,
    queueIndex: 0,
    motionQueue,
    direction,

    x: startRef.x,
    y: startRef.y,
    vx: 0, vy: 0,
    s,
    rot: initialAngle,
    spin: 0,

    hp: maxKill,
    maxHp: maxKill,
    broken: false,
    unlocked: false,

    contamination: 0,
    maxContamination,
    maxKill,
    contaminationState: 'clean',
    encrypted,
    damage: 0,
    tierLightDamage: tierCfg.lightDamage,
    fromExploit: false,

    dying: false,
    dyingTimer: 0,

    bag: encrypted ? null : generateLootBag(lootType, 'leaf'),

    near: false,
  };
}

/* 50 % of packets never spawn (PACKET.destroyChance).
 * Each packet docks initially at a random group server. */
/* Spawn per-node traffic. TCP: 1–2 per node. UDP: 60% chance per node. */
function spawnPackets(groups) {
  const out = [];

  for (const group of groups) {
    group.packets = [];

    const server = group.servers[0];
    if (!server) continue;

    for (const node of server.nodes) {
      const tcpCount = PACKET.tcpPerNodeMin +
        Math.floor(Math.random() * (PACKET.tcpPerNodeMax - PACKET.tcpPerNodeMin + 1));
      for (let i = 0; i < tcpCount; i++) {
        if (Math.random() < PACKET.destroyChance) continue;
        const p = makePacket('tcp', node, server, group);
        group.packets.push(p);
        out.push(p);
      }

      if (Math.random() < PACKET.udpSpawnChance) {
        if (Math.random() >= PACKET.destroyChance) {
          const p = makePacket('udp', node, server, group);
          group.packets.push(p);
          out.push(p);
        }
      }
    }
  }

  return out;
}

export function createGameState(shipConfig = {}, sectorTier = null) {
  const { groups, servers } = spawnServerGroups(sectorTier);
  const asteroids = spawnPackets(groups);

  return {
    player:        createPlayer(shipConfig),
    asteroids,
    bullets:       [],
    servers,
    serverGroups:  groups,
    fireCooldown:  0,
    interactLock:  false,
    shipColor:     shipConfig.shipColor   ?? 0x6ee7ff,
    shipImg:     shipConfig.shipImg     ?? null,
    bulletColor:   shipConfig.bulletColor ?? 0xffd36e,
    accentColor:   shipConfig.accentColor ?? 0x1a4a58,
    inventoryOpen: false,
    closestInteract: null,
    inventoryOpen: false,
    closestInteract: null,
    gate: null,             // { side, start, end } or null
    deathHandled: false,    // guard so 'game:death' fires once
    aiShips: [],
    aiBullets: [],
    sectorClearedFired: false,
    packetsUnlocked: false,
    aiSquads:       [],
    playerWeapons:  [],
    currentWeaponSlot: 0,
    specialCooldown:   0,
    projectiles:    [],
  };
}