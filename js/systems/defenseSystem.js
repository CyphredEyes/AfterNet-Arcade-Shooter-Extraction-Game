/* ===================================================================
   AI defense system — squads, tiered behaviors, evasive maneuvers
   =================================================================== */

import {
  WORLD_W, WORLD_H, AI_SHIP_TYPES, CORP_THREAT, THREAT_SPAWN_TABLE,
  AI_SQUAD,
} from '../modules/config.js';
import { wrapPos, wrapDelta } from '../modules/world.js';
import { state as globalState, saveCorpThreat, saveSectorsCleared } from '../core/state.js';
import {
  ENEMY_TYPES, SECTOR_SPAWN_POOLS, SECTOR_SQUAD_SIZE, SECTOR_COORDINATION,
} from '../data/enemyShipsDB.js';
import { BLUEPRINTS, makeItem } from '../data/itemDB.js';
import { findFreeSpot } from './grid-core.js';

let nextShipId = 1;
let nextAiBulletId = 1;
let nextSquadId = 1;
let threatDecayTimer = 0;
let spawnTimer = 0;
let sectorClearedFired = false;

/* -------------------------------------------------------------------
   Sector tier (0-3): from currentSector, fallback LOW
   ------------------------------------------------------------------- */
function getSectorTier() {
  const map = { LOW: 0, MID: 1, HIGH: 2, EXTREME: 3 };
  return map[globalState.currentSector?.tier] ?? 0;
}

/* -------------------------------------------------------------------
   Squad spawning
   ------------------------------------------------------------------- */
function spawnSquad(gameState) {
  const tier = getSectorTier();
  const [minS, maxS] = SECTOR_SQUAD_SIZE[tier] || [1, 1];
  const size = minS + Math.floor(Math.random() * (maxS - minS + 1));
  const pool = SECTOR_SPAWN_POOLS[tier] || ['raider'];

  const squad = {
    id: nextSquadId++,
    members: [],
    targetAngle: Math.random() * Math.PI * 2,
    rotateTimer: AI_SQUAD.rotateIntervalMin,
    coordination: SECTOR_COORDINATION[tier] || 0,
  };

  for (let i = 0; i < size; i++) {
    const typeKey = pool[Math.floor(Math.random() * pool.length)];
    const type = ENEMY_TYPES[typeKey];
    if (!type) continue;

    const angle = Math.random() * Math.PI * 2;
    const dist = 1400 + Math.random() * 400;
    const x = wrapPos(gameState.player.x + Math.cos(angle) * dist, WORLD_W);
    const y = wrapPos(gameState.player.y + Math.sin(angle) * dist, WORLD_H);

    const ship = {
      id: nextShipId++,
      typeKey,
      hp: type.hp, maxHp: type.hp,
      size: type.size, shape: type.shape, color: type.color,
      x, y, vx: 0, vy: 0, angle: 0,
      fireCooldown: 0,
      flareCooldown: type.flareCooldown || 0,
      behavior: type.behavior,
      evade: type.evade || 0,
      evadePhase: Math.random() * Math.PI * 2,
      squadId: squad.id,
      squadSlot: i,
      state: 'patrol',
      stateTimer: 0,
      strafeSign: Math.random() < 0.5 ? 1 : -1,
    };
    gameState.aiShips.push(ship);
    squad.members.push(ship);
  }

  gameState.aiSquads.push(squad);
}

/* -------------------------------------------------------------------
   Update squads (coordinated attack angles)
   ------------------------------------------------------------------- */
function updateSquads(gameState, dt) {
  for (const squad of gameState.aiSquads) {
    squad.members = squad.members.filter(m => gameState.aiShips.includes(m));
    if (squad.members.length === 0) continue;

    squad.rotateTimer -= dt;
    if (squad.rotateTimer <= 0) {
      squad.targetAngle += (Math.random() < 0.5 ? 1 : -1) * Math.PI * 0.5;
      squad.rotateTimer = AI_SQUAD.rotateIntervalMin +
        Math.random() * (AI_SQUAD.rotateIntervalMax - AI_SQUAD.rotateIntervalMin);
    }
  }
  gameState.aiSquads = gameState.aiSquads.filter(s => s.members.length > 0);
}

/* -------------------------------------------------------------------
   Ship movement — behavior dispatch
   ------------------------------------------------------------------- */
function updateShipMovement(ship, gameState, dt) {
  const type = ENEMY_TYPES[ship.typeKey];
  if (!type) return;

  const squad = gameState.aiSquads.find(s => s.id === ship.squadId);
  const player = gameState.player;

  const dxp = wrapDelta(player.x - ship.x, WORLD_W);
  const dyp = wrapDelta(player.y - ship.y, WORLD_H);
  const distP = Math.hypot(dxp, dyp) || 1;
  const angleToPlayer = Math.atan2(dyp, dxp);

  let targetVx = 0, targetVy = 0;

  /* --- Squad-assisted attack direction --- */
  let attackOffset = 0;
  if (squad && squad.coordination > 0) {
    const slot = ship.squadSlot;
    const memberCount = squad.members.length;
    const spread = Math.PI * 2 / memberCount;
    attackOffset = (slot - (memberCount - 1) / 2) * spread * squad.coordination;
  }

  const effectiveAngle = angleToPlayer + attackOffset * 0.5;

  switch (ship.behavior) {
    case 'chase':
      targetVx = Math.cos(effectiveAngle) * type.speed;
      targetVy = Math.sin(effectiveAngle) * type.speed;
      break;

    case 'strafe': {
      const orbitAngle = angleToPlayer + Math.PI / 2 * ship.strafeSign + attackOffset * 0.3;
      const orbitRadius = 280;
      if (distP > orbitRadius + 80) {
        targetVx = Math.cos(angleToPlayer) * type.speed;
        targetVy = Math.sin(angleToPlayer) * type.speed;
      } else {
        targetVx = Math.cos(orbitAngle) * type.speed;
        targetVy = Math.sin(orbitAngle) * type.speed;
        if (distP < orbitRadius - 80) {
          targetVx -= Math.cos(angleToPlayer) * type.speed * 0.6;
          targetVy -= Math.sin(angleToPlayer) * type.speed * 0.6;
        }
      }
      break;
    }

    case 'orbit': {
      const orbitRadius = 340;
      const orbitAngle = angleToPlayer + Math.PI / 2 * ship.strafeSign;
      if (Math.abs(distP - orbitRadius) > 120) {
        const towardAngle = distP > orbitRadius ? angleToPlayer + Math.PI : angleToPlayer;
        targetVx = Math.cos(towardAngle) * type.speed;
        targetVy = Math.sin(towardAngle) * type.speed;
      } else {
        targetVx = Math.cos(orbitAngle) * type.speed;
        targetVy = Math.sin(orbitAngle) * type.speed;
      }
      break;
    }

    case 'kite': {
      const kiteRadius = 620;
      if (distP < kiteRadius - 100) {
        targetVx = -Math.cos(angleToPlayer) * type.speed;
        targetVy = -Math.sin(angleToPlayer) * type.speed;
      } else if (distP > kiteRadius + 150) {
        targetVx = Math.cos(angleToPlayer) * type.speed;
        targetVy = Math.sin(angleToPlayer) * type.speed;
      } else {
        const perpAngle = angleToPlayer + Math.PI / 2 * ship.strafeSign;
        targetVx = Math.cos(perpAngle) * type.speed * 0.6;
        targetVy = Math.sin(perpAngle) * type.speed * 0.6;
      }
      break;
    }

    case 'ace': {
      const orbitRadius = 240;
      const orbitAngle = angleToPlayer + Math.PI / 2 * ship.strafeSign + attackOffset * 0.4;
      if (distP > orbitRadius + 100) {
        targetVx = Math.cos(effectiveAngle) * type.speed;
        targetVy = Math.sin(effectiveAngle) * type.speed;
      } else {
        targetVx = Math.cos(orbitAngle) * type.speed;
        targetVy = Math.sin(orbitAngle) * type.speed;
      }
      break;
    }
  }

  /* --- Evasive maneuver: perpendicular wobble when player near --- */
  if (ship.evade > 0 && distP < 700) {
    ship.evadePhase += dt * 4;
    const wobble = Math.sin(ship.evadePhase) * ship.evade;
    const perpX = -Math.sin(angleToPlayer);
    const perpY = Math.cos(angleToPlayer);
    targetVx += perpX * type.speed * wobble;
    targetVy += perpY * type.speed * wobble;
  }

  ship.vx += (targetVx - ship.vx) * Math.min(1, type.accel * dt / 400);
  ship.vy += (targetVy - ship.vy) * Math.min(1, type.accel * dt / 400);

  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > type.speed) {
    ship.vx = ship.vx / sp * type.speed;
    ship.vy = ship.vy / sp * type.speed;
  }

  ship.x = wrapPos(ship.x + ship.vx * dt, WORLD_W);
  ship.y = wrapPos(ship.y + ship.vy * dt, WORLD_H);
  ship.angle = Math.atan2(dyp, dxp);
}

/* -------------------------------------------------------------------
   Ship weapons
   ------------------------------------------------------------------- */
function updateShipWeapons(ship, gameState, dt) {
  const type = ENEMY_TYPES[ship.typeKey];
  if (!type?.weapon) return;

  const player = gameState.player;
  const dx = wrapDelta(player.x - ship.x, WORLD_W);
  const dy = wrapDelta(player.y - ship.y, WORLD_H);
  const dist = Math.hypot(dx, dy);

  /* --- Flarer: drop flares periodically --- */
  if (type.flareCooldown && ship.flareCooldown > 0) {
    ship.flareCooldown -= dt;
    if (ship.flareCooldown <= 0 && dist < 500) {
      spawnEnemyFlares(gameState, ship);
      ship.flareCooldown = type.flareCooldown;
    }
  }

  /* --- Regular weapon fire --- */
  ship.fireCooldown -= dt;
  if (ship.fireCooldown > 0) return;
  if (dist > type.weapon.range) return;

  const aim = Math.atan2(dy, dx);

  if (type.weapon.isMissile) {
    gameState.projectiles.push({
      kind: 'missile',
      owner: 'enemy',
      x: ship.x,
      y: ship.y,
      vx: Math.cos(aim) * 80,
      vy: Math.sin(aim) * 80,
      angle: aim,
      target: player,
      initialSpeed: 80,
      maxSpeed: 380,
      accel: 500,
      drag: 0.45,
      turnRate: 1.8,
      damage: type.weapon.damage,
      splashRadius: 0,
      splashDamage: 0,
      lifetime: 5,
      color: 0xff0066,
      size: 4,
    });
  } else {
    gameState.aiBullets.push({
      id: nextAiBulletId++,
      x: ship.x, y: ship.y,
      vx: Math.cos(aim) * type.weapon.bulletSpeed,
      vy: Math.sin(aim) * type.weapon.bulletSpeed,
      damage: type.weapon.damage,
      life: 2.2,
      color: type.color,
    });
  }
  ship.fireCooldown = type.weapon.fireRate;
}

function spawnEnemyFlares(gameState, ship) {
  const count = 4;
  const spread = Math.PI * 0.6;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    const angle = Math.PI / 2 + t * spread;
    gameState.projectiles.push({
      kind: 'flare',
      owner: 'enemy',
      x: ship.x,
      y: ship.y,
      vx: Math.cos(angle) * 200 + ship.vx * 0.4,
      vy: Math.sin(angle) * 200 + ship.vy * 0.4,
      lifetime: 1.6,
      damage: 1,
      damageRadius: 18,
      repulseForce: 250,
      size: 4,
      color: 0xff6600,
      blinkPhase: Math.random() * Math.PI * 2,
    });
  }
}

/* -------------------------------------------------------------------
   AI bullets
   ------------------------------------------------------------------- */
function updateAiBullets(gameState, dt) {
  const player = gameState.player;
  for (let i = gameState.aiBullets.length - 1; i >= 0; i--) {
    const b = gameState.aiBullets[i];
    b.x = wrapPos(b.x + b.vx * dt, WORLD_W);
    b.y = wrapPos(b.y + b.vy * dt, WORLD_H);
    b.life -= dt;
    if (b.life <= 0) { gameState.aiBullets.splice(i, 1); continue; }

    if (player.invuln > 0) continue;
    const dx = wrapDelta(b.x - player.x, WORLD_W);
    const dy = wrapDelta(b.y - player.y, WORLD_H);
    if (dx * dx + dy * dy < (player.r + 3) * (player.r + 3)) {
      player.hp -= b.damage * (player.defenseMul || 1);
      player.invuln = 0.4;
      gameState.aiBullets.splice(i, 1);
    }
  }
}

/* -------------------------------------------------------------------
   Threat decay
   ------------------------------------------------------------------- */
function updateThreat(gameState, dt) {
  threatDecayTimer += dt;
  if (threatDecayTimer < CORP_THREAT.DECAY_INTERVAL) return;
  threatDecayTimer = 0;
  if (globalState.corpThreat > 0) {
    globalState.corpThreat--;
    saveCorpThreat();
  }
}

/* -------------------------------------------------------------------
   Spawn manager — keeps a target number of enemies based on threat
   ------------------------------------------------------------------- */
function updateSpawn(gameState, dt) {
  spawnTimer += dt;
  if (spawnTimer < CORP_THREAT.SPAWN_CHECK_INTERVAL) return;
  spawnTimer = 0;

  const tier = getSectorTier();
  const baseline = [0, 1, 2, 3][tier] || 0;
  const desiredCount = globalState.corpThreat + baseline;
  const currentCount = gameState.aiShips.length;

  if (currentCount < desiredCount) {
    spawnSquad(gameState);
  }
}

/* -------------------------------------------------------------------
   Sector cleared
   ------------------------------------------------------------------- */
function checkSectorCleared(gameState) {
  if (sectorClearedFired) return;
  if (gameState.servers.length === 0) return;
  if (!gameState.servers.every(s => s.core?.broken || s.mainBroken)) return;

  sectorClearedFired = true;
  globalState.sectorsCleared++;
  saveSectorsCleared();
  showSectorClearedBanner(globalState.sectorsCleared);
}

function showSectorClearedBanner(count) {
  const el = document.createElement('div');
  el.textContent = `SECTOR CLEARED — ${count}`;
  el.style.cssText = `
    position: fixed; top: 30%; left: 50%; transform: translate(-50%, -50%);
    font-family: monospace; font-size: 32px; font-weight: 900;
    letter-spacing: 6px; color: #ffffff;
    text-shadow: 0 0 20px rgba(255,255,255,0.8);
    z-index: 20000; pointer-events: none;
  `;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 1s'; }, 2200);
  setTimeout(() => el.remove(), 3400);
}

/* -------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------- */
export function resetDefenseState() {
  sectorClearedFired = false;
  threatDecayTimer = 0;
  spawnTimer = 0;
}

export function updateDefense(gameState, dt) {
  updateThreat(gameState, dt);
  updateSpawn(gameState, dt);
  updateSquads(gameState, dt);

  for (const ship of gameState.aiShips) {
    updateShipMovement(ship, gameState, dt);
    updateShipWeapons(ship, gameState, dt);
  }

  updateAiBullets(gameState, dt);
  checkSectorCleared(gameState);
}