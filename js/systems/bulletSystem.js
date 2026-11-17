import { WORLD_W, WORLD_H, ASTEROID, SERVER, PACKET_DYING_DURATION } from '../modules/config.js';
import { wrapPos, wrapDelta } from '../modules/world.js';
import { getShieldPct } from './serverSystem.js';
import { state as globalState } from '../core/state.js';

export function updateBullets(state, dt) {
  const { bullets, asteroids, servers } = state;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    b.x = wrapPos(b.x + b.vx * dt, WORLD_W);
    b.y = wrapPos(b.y + b.vy * dt, WORLD_H);
    b.life -= dt;
    if (b.life <= 0) { bullets.splice(i, 1); continue; }

    let hit = false;


    // ---- Packets ----
    for (let j = asteroids.length - 1; j >= 0 && !hit; j--) {
      const a = asteroids[j];
      if (a.broken || a.dying) continue;

      const dx = wrapDelta(b.x - a.x, WORLD_W);
      const dy = wrapDelta(b.y - a.y, WORLD_H);
      const rad = a.s * ASTEROID.bulletHitPad + 3;

      if (dx * dx + dy * dy < rad * rad) {
        a.contamination += 1;

        // Encrypted packets cannot be contaminated — unless master key has been acquired
        const stillEncrypted = a.encrypted && !globalState.hasMasterKey;
        if (!stillEncrypted && a.contaminationState === 'clean' && a.contamination >= a.maxContamination) {
          a.contaminationState = 'light';
          a.damage = a.tierLightDamage || 1;
        }

        if (a.contamination >= a.maxKill) {
          a.broken = true;
          a.dying = true;
          a.dyingTimer = PACKET_DYING_DURATION;
          a.transit = null;
          a.state = 'waiting';
          window.dispatchEvent(new CustomEvent('sector:packet-killed', {
            detail: { packet: a },
          }));
        }

        hit = true;
      }
    }

    // ---- Core + Nodes ----
    if (!hit) {
      outer: for (const server of servers) {
        // Core
        if (!server.core.broken) {
          const dx  = wrapDelta(b.x - server.core.x, WORLD_W);
          const dy  = wrapDelta(b.y - server.core.y, WORLD_H);
          const rad = server.core.radius * SERVER.bulletHitPad + 3;
          if (dx * dx + dy * dy < rad * rad) {
            damageCore(server, b.damage);
            hit = true;
            break outer;
          }
        }

        // Category nodes
        for (const node of server.nodes) {
          if (node.broken) continue;
          const dx  = wrapDelta(b.x - node.x, WORLD_W);
          const dy  = wrapDelta(b.y - node.y, WORLD_H);
          const rad = node.radius * SERVER.bulletHitPad + 3;
          if (dx * dx + dy * dy < rad * rad) {
            node.hp -= b.damage;
            if (node.hp <= 0) {
              node.hp = 0;
              node.broken = true;
              window.dispatchEvent(new CustomEvent('sector:node-killed', {
                detail: { server, node },
              }));
            }
            hit = true;
            break outer;
          }
        }
      }
    }
    
        // ---- AI ships ----
    if (!hit) {
      for (let k = state.aiShips.length - 1; k >= 0; k--) {
        const   ship = state.aiShips[k];
        const dx = wrapDelta(b.x - ship.x, WORLD_W);
        const dy = wrapDelta(b.y - ship.y, WORLD_H);
        const r = ship.size + 3;
        if (dx * dx + dy * dy < r * r) {
          ship.hp -= b.damage;
          if (ship.hp <= 0) state.aiShips.splice(k, 1);
          hit = true;
          break;
        }
      }
    }

    if (hit) bullets.splice(i, 1);
  }
}

function damageCore(server, damage) {
  // Core is immune while shield > 0
  if (getShieldPct(server) > 0) return;

  server.core.hp -= damage;
  if (server.core.hp <= 0) {
    server.core.hp = 0;
    server.core.broken = true;
    window.dispatchEvent(new CustomEvent('sector:core-killed', {
      detail: { server },
    }));
  }
}
