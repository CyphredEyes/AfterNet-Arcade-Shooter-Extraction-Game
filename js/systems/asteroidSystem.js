import { WORLD_W, WORLD_H, ASTEROID, PACKET, PACKET_DYING_DURATION } from '../modules/config.js';
import { wrapPos, wrapDelta } from '../modules/world.js';
import { state as globalState } from '../core/state.js';

export function updateAsteroids(state, dt, screen) {
  const { asteroids, player } = state;

  reflowDockPositions(asteroids);

  const halfDiag = Math.hypot(screen.width, screen.height) * 0.5;
  const sleepR = halfDiag + ASTEROID.sleepRadiusPadding;
  const sleepR2 = sleepR * sleepR;

  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    const dx = wrapDelta(a.x - player.x, WORLD_W);
    const dy = wrapDelta(a.y - player.y, WORLD_H);
    a.near = (dx * dx + dy * dy) < sleepR2;

    if (globalState.viewedPacketId === a.id) continue;

    if (a.dying) {
      a.dyingTimer -= dt;
      if (a.dyingTimer <= 0) asteroids.splice(i, 1);
      continue;
    }

    if (a.broken) continue;

    updatePacketMotion(a, dt);

    if (a._instantRemove) {
      asteroids.splice(i, 1);
      continue;
    }
  }
}

/* ===================================================================
   Docking — radial pizza-slice positions around each node,
   perpendicular to the node→core line so packets don't sit on it.
   =================================================================== */
function reflowDockPositions(asteroids) {
  const byNode = new Map();

  for (const a of asteroids) {
    if (a.state !== 'waiting' || !a.nodeRef || a.broken || a.dying) continue;

    // Skip packets that are physically at the core (initial spawn).
    // They should stay hidden at the core until startLeg teleports them out.
    const server = a.sourceServerRef;
    if (server) {
      const ddx = a.x - server.x;
      const ddy = a.y - server.y;
      if (ddx * ddx + ddy * ddy < 100) continue;
    }

    if (!byNode.has(a.nodeRef)) byNode.set(a.nodeRef, []);
    byNode.get(a.nodeRef).push(a);
  }

  for (const [node, list] of byNode) {
    list.sort((a, b) => a.id - b.id);
    const server = list[0].sourceServerRef;
    if (!server) continue;

    const lineAngle = Math.atan2(server.y - node.y, server.x - node.x);
    const perpAngle = lineAngle + Math.PI / 2;
    const count = list.length;
    const dockRadius = 45;

    const totalSpread = Math.min((Math.PI * 2) / 3, (count - 1) * (Math.PI / 3));
    const startAngle = -totalSpread / 2;
    const step = count > 1 ? totalSpread / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angle = perpAngle + startAngle + step * i;
      const p = list[i];
      p.dockX = node.x + Math.cos(angle) * dockRadius;
      p.dockY = node.y + Math.sin(angle) * dockRadius;
    }
  }
}

/* ===================================================================
   Packet motion
   =================================================================== */
function updatePacketMotion(a, dt) {
  const server = a.sourceServerRef;
  const node = a.nodeRef;
  if (!server || !node) return;

  if (a.state === 'stopped') return;

  const anchorDead = node.broken || server.core.broken;

  if (a.state === 'transit') {
    a.transit.t += dt / a.transit.duration;

    const from = a.transit.fromRef;
    const to = a.transit.toRef;
    const fromX = from.x;
    const fromY = from.y;
    const toX = to.x;
    const toY = to.y;

    a.rot = Math.atan2(toY - fromY, toX - fromX);

    if (a.transit.t >= 1) {
      a.x = toX;
      a.y = toY;
      const arrivedAt = a.transit.toRef;
      a.transit = null;

      // Exploit packets: instant deletion, damage applied
      if (a.fromExploit) {
        applyPacketDamage(a, arrivedAt);
        a._instantRemove = true;
        return;
      }

      // Player-contaminated: damage, then blink-then-die
      if (a.contaminationState !== 'clean') {
        applyPacketDamage(a, arrivedAt);
        killPacket(a);
        return;
      }

      if (anchorDead) {
        if (arrivedAt === node) {
          // Snap to a radial dock slot so it doesn't freeze at node center
          const lineAngle = Math.atan2(server.y - node.y, server.x - node.x);
          const perpAngle = lineAngle + Math.PI / 2;
          const dockRadius = 45;
          a.x = node.x + Math.cos(perpAngle) * dockRadius;
          a.y = node.y + Math.sin(perpAngle) * dockRadius;
        }
        killPacket(a);
        return;
      }

      a.queueIndex++;
      if (a.queueIndex >= a.motionQueue.length) endCycle(a, arrivedAt);
      else startLeg(a);
    } else {
      const t = a.transit.t;
      a.x = fromX + (toX - fromX) * t;
      a.y = fromY + (toY - fromY) * t;
    }
    return;
  }

  if (a.state === 'waiting') {
    if (anchorDead) {
      a.state = 'stopped';
      return;
    }

    // Snap to dock position (computed by reflowDockPositions)
    if (a.dockX !== undefined) {
      a.x = a.dockX;
      a.y = a.dockY;
    }

    a.waitTimer -= dt;
    if (a.waitTimer <= 0) startLeg(a);
  }
}

function applyPacketDamage(a, targetRef) {
  const server = a.sourceServerRef;
  if (!server) return;

  const isCore = targetRef === server || targetRef === server.core;

  if (isCore) {
    if (!server.core.broken) {
      server.core.hp -= a.damage;
      if (server.core.hp <= 0) {
        server.core.hp = 0;
        server.core.broken = true;
        window.dispatchEvent(new CustomEvent('sector:core-killed', { detail: { server } }));
      }
    }
  } else {
    if (!targetRef.broken) {
      targetRef.hp -= a.damage;
      if (targetRef.hp <= 0) {
        targetRef.hp = 0;
        targetRef.broken = true;
        window.dispatchEvent(new CustomEvent('sector:node-killed', {
          detail: { server, node: targetRef },
        }));
      }
    }
  }
}

function killPacket(a) {
  if (a.dying) return;
  a.broken = true;
  a.dying = true;
  a.dyingTimer = PACKET_DYING_DURATION;
  a.transit = null;
  a.state = 'waiting';
}

function startLeg(a) {
  const dir = a.motionQueue[a.queueIndex];
  const fromRef = dir === 'core_to_node' ? a.sourceServerRef : a.nodeRef;
  const toRef   = dir === 'core_to_node' ? a.nodeRef         : a.sourceServerRef;

  if (dir === 'core_to_node' && a.nodeRef.exploited) {
    killPacket(a);
    return;
  }

  a.transit = {
    fromRef,
    toRef,
    t: 0,
    duration: a.kind === 'tcp' ? PACKET.tcpLegDuration : PACKET.udpLegDuration,
  };
  a.state = 'transit';
  a.x = fromRef.x;
  a.y = fromRef.y;
  a.rot = Math.atan2(toRef.y - fromRef.y, toRef.x - fromRef.x);
  a.dockX = undefined;
  a.dockY = undefined;
}

function endCycle(a, arrivedAt) {
  for (let i = 0; i < a.motionQueue.length; i++) {
    a.motionQueue[i] = a.motionQueue[i] === 'core_to_node' ? 'node_to_core' : 'core_to_node';
  }
  a.queueIndex = 0;

  const isCore = arrivedAt === a.sourceServerRef;

  // No visible docking at core — pass straight through
  if (isCore) {
    startLeg(a);
    return;
  }

  // Docking at node
  a.state = 'waiting';
  const [lo, hi] = a.kind === 'tcp'
    ? [PACKET.tcpWaitMin, PACKET.tcpWaitMax]
    : [PACKET.udpWaitMin, PACKET.udpWaitMax];
  a.waitTimer = lo + Math.random() * (hi - lo);
}

export function resolvePlayerDamage(state, dt) {
  const { player } = state;
  if (player.invuln > 0) player.invuln -= dt;

  if (player.hp <= 0 && !state.deathHandled) {
    state.deathHandled = true;
    window.dispatchEvent(new CustomEvent('game:death'));
  }
}