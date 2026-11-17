import { WORLD_W, WORLD_H, SERVER, SERVER_STATE, CORP_THREAT, NODE_CATEGORIES, EXPLOIT_TIERS } from '../modules/config.js';
import { wrapPos, wrapDelta } from '../modules/world.js';
import { input } from '../modules/input.js';
import { state as globalState, saveCorpThreat } from '../core/state.js';

const STATE_ORDER = SERVER_STATE.ORDER;

function escalate(server, targetState) {
  const cur = STATE_ORDER.indexOf(server.state);
  const tgt = STATE_ORDER.indexOf(targetState);
  if (tgt <= cur) return false;
  server.state = targetState;

  // Hook: when a cared-about server is destroyed, raise threat
  if (targetState === 'DESTROYED' && server.tierDef?.corpCare) {
    const before = globalState.corpThreat;
    globalState.corpThreat = Math.min(
      CORP_THREAT.MAX,
      globalState.corpThreat + server.tier,
    );
    if (globalState.corpThreat !== before) saveCorpThreat();
  }
  return true;
}

function updateServerState(server) {
  const total = server.nodes.length;
  const broken = server.nodes.filter(n => n.broken).length;
  const nodeRatio = total > 0 ? broken / total : 0;
  const mainRatio = server.mainHp / server.mainMaxHp;

  if (server.mainBroken)                        escalate(server, 'DESTROYED');
  else if (mainRatio <= SERVER_STATE.DESPERATE_MAIN_RATIO) escalate(server, 'DESPERATE');
  else if (nodeRatio >= SERVER_STATE.HARDENED_NODE_RATIO)  escalate(server, 'HARDENED');
  else if (nodeRatio >= SERVER_STATE.ALARMED_NODE_RATIO)   escalate(server, 'ALARMED');
  else if (broken >= 1)                                    escalate(server, 'SUSPICIOUS');
}

export function updateServers(state, dt) {
  const { player, servers } = state;
  let closest = null;
  let closestDistSq = Infinity;

  for (const server of servers) {
    server._time += dt;

    // Update node wobble positions (skip broken ones so they freeze visually)
    const alive = !server.core.broken;
    for (const node of server.nodes) {
      if (alive && !node.broken) {
        const wobX = Math.sin(server._time * node.wobbleSpeed + node.wobblePhaseX) * node.wobbleAmp;
        const wobY = Math.cos(server._time * node.wobbleSpeed + node.wobblePhaseY) * node.wobbleAmp;
        node.x = wrapPos(server.x + node.ox + wobX, WORLD_W);
        node.y = wrapPos(server.y + node.oy + wobY, WORLD_H);
        // Exploit DoT — only ticks if injection is active and node is alive
        if (!node.broken && node.injectTimer > 0) {
          node.injectTimer -= dt;
          node.hp -= node.injectDps * dt;
          if (node.hp <= 0) {
            node.hp = 0;
            node.broken = true;
            node.injectTimer = 0;
            node.compromised = false;
            window.dispatchEvent(new CustomEvent('sector:node-killed', {
              detail: { server, node },
            }));
          }
        }
      }
      if (node.exploited && !node.broken) {
        node.exploitRemaining -= dt;
        if (node.exploitRemaining <= 0) {
          node.exploited = false;
          node.exploitTier = null;
          node.exploitPacketsQueue = [];
        } else {
          node.exploitGroupTimer -= dt;
          if (node.exploitGroupTimer <= 0) {
            const tierCfg = EXPLOIT_TIERS.find(t => t.tier === node.exploitTier);
            if (tierCfg) {
              for (let k = 0; k < tierCfg.packetsPerGroup; k++) {
                node.exploitPacketsQueue.push({
                  delay: k * tierCfg.intervalBetweenPackets,
                  damage: tierCfg.damagePerPacket,
                });
              }
              node.exploitGroupTimer = tierCfg.intervalBetweenGroups;
            }
          }

          for (let k = node.exploitPacketsQueue.length - 1; k >= 0; k--) {
            const pkt = node.exploitPacketsQueue[k];
            pkt.delay -= dt;
            if (pkt.delay <= 0) {
              spawnExploitPacket(server, node, pkt.damage, state);
              node.exploitPacketsQueue.splice(k, 1);
            }
          }
        }
      }
    }

    // Escalate sector state based on shieldPct
    updateSectorState(server);

    // Interaction proximity
    const sdx = wrapDelta(server.x - player.x, WORLD_W);
    const sdy = wrapDelta(server.y - player.y, WORLD_H);
    const sDistSq = sdx * sdx + sdy * sdy;
    server.near = sDistSq < SERVER.interactRadius * SERVER.interactRadius;

    if (server.near && sDistSq < closestDistSq) {
      closestDistSq = sDistSq;
      closest = { type: 'server', server };
    }
  }

  state.closestInteract = closest;

  if (closest && input.keys['e']) {
    if (!state.interactLock && !state.activeOverlay) {
      state.interactLock = true;
      
    }
  } else if (!input.keys['e']) {
    state.interactLock = false;
  }
}

function updateSectorState(server) {
  if (server.core.broken) { server.state = 'DESTROYED'; return; }
  const pct = getShieldPct(server);
  if (pct <= 0)       server.state = 'EXPOSED';
  else if (pct <= 66) server.state = 'ALARMED';
  else if (pct < 100) server.state = 'SUSPICIOUS';
  else                server.state = 'PASSIVE';
}

export function getShieldPct(server) {
  if (!server || !server.nodes || server.nodes.length === 0) return 0;

  let totalWeight = 0;
  let aliveWeight = 0;
  for (const node of server.nodes) {
    const w = NODE_CATEGORIES[node.category]?.weight || 1;
    totalWeight += w;
    if (!node.broken) aliveWeight += w;
  }
  if (totalWeight === 0) return 0;
  return (aliveWeight / totalWeight) * 100;
}

// Legacy alias — many callers still use this name.
export function getEffectiveShield(server) {
  return getShieldPct(server);
}

export function getServerAccessLevel(server) {
  if (server.core.broken)          return 'down';
  if (getShieldPct(server) <= 0)   return 'exposed';
  return 'intact';
}

let exploitPacketId = 1;

function spawnExploitPacket(server, node, damage, gameState) {
  const offsetX = 0;
  const offsetY = 0;

  const a = {
    id: 90000 + (exploitPacketId++),
    kind: Math.random() < 0.5 ? 'tcp' : 'udp',
    nodeId: node.id,
    sourceServerId: server.id,
    groupId: server.networkGroup?.id,
    nodeRef: node,
    sourceServerRef: server,
    offsetX, offsetY,
    state: 'waiting',
    waitTimer: 0,
    transit: null,
    queueIndex: 0,
    motionQueue: ['node_to_core'],
    direction: 'node_to_core',
    fromExploit: true,
    encrypted: false,
    contamination: 0,
    maxContamination: 0,
    maxKill: 6,
    contaminationState: 'heavy',
    damage,
    tierLightDamage: damage,
    dying: false,
    dyingTimer: 0,
    x: node.x,
    y: node.y,
    vx: 0, vy: 0,
    s: 8,
    rot: Math.atan2(server.y - node.y, server.x - node.x),
    spin: 0,
    hp: 6,
    maxHp: 6,
    broken: false,
    unlocked: false,
    bag: null,
    near: false,
  };

  gameState.asteroids.push(a);
  if (server.networkGroup) server.networkGroup.packets.push(a);
}