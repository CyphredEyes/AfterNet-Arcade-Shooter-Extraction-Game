import { WEAPONS } from '../data/weaponsDB.js';
import { FLARES, WORLD_W, WORLD_H } from '../modules/config.js';
import { createBullet } from '../modules/entities.js';
import { wrapDelta } from '../modules/world.js';

/* -------------------------------------------------------------------
   Weapon switching
   ------------------------------------------------------------------- */
export function switchWeapon(gs, slotIndex) {
  if (!gs.playerWeapons) return;
  if (slotIndex < 0 || slotIndex >= gs.playerWeapons.length) return;
  gs.currentWeaponSlot = slotIndex;
  window.dispatchEvent(new CustomEvent('weapon:changed'));
}

/* -------------------------------------------------------------------
   Fire current weapon
   ------------------------------------------------------------------- */
export function fireCurrentWeapon(gs, aimAngle) {
  const wpn = gs.playerWeapons?.[gs.currentWeaponSlot];
  if (!wpn) return;
  if (wpn.cooldown > 0) return;

  const def = WEAPONS[wpn.key];
  if (!def) return;

  if (def.type === 'bullet') firePulse(gs, def, aimAngle);
  else if (def.type === 'missile') fireMissile(gs, def, aimAngle);

  wpn.cooldown = def.fireRate;
}

function firePulse(gs, def, angle) {
  const p = gs.player;
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const spread = (Math.random() - 0.5) * def.spread;

  const vx = Math.cos(angle + spread) * def.speed + p.vx * def.playerVelInfluence;
  const vy = Math.sin(angle + spread) * def.speed + p.vy * def.playerVelInfluence;

  gs.bullets.push(createBullet(
    p.x + fx * def.muzzleOffset,
    p.y + fy * def.muzzleOffset,
    vx, vy,
    p.bulletDamage || def.damage,
  ));
}

function fireMissile(gs, def, angle) {
  const p = gs.player;
  const target = selectMissileTarget(gs, p, angle);

  gs.projectiles.push({
    kind: 'missile',
    owner: 'player',
    x: p.x + Math.cos(angle) * def.muzzleOffset,
    y: p.y + Math.sin(angle) * def.muzzleOffset,
    vx: Math.cos(angle) * def.initialSpeed + p.vx * 0.15,
    vy: Math.sin(angle) * def.initialSpeed + p.vy * 0.15,
    angle,
    target,
    initialSpeed: def.initialSpeed,
    maxSpeed: def.maxSpeed,
    accel: def.accel,
    drag: def.drag,
    turnRate: def.turnRate,
    damage: def.damage,
    splashRadius: def.splashRadius,
    splashDamage: def.splashDamage,
    lifetime: def.lifetime,
    color: def.color,
    size: def.size,
  });
}

/* Selects the missile's initial target.
   Priority:
     1) Enemies inside a forward cone (±60°) around aim — scored by alignment
        and corridor length (prefers further targets for more runway).
     2) Fallback: nearest enemy anywhere. */
function selectMissileTarget(gs, player, aimAngle) {
  const candidates = gs.aiShips || [];
  if (candidates.length === 0) return null;

  const CONE = Math.PI / 3;
  const IDEAL_DIST = 700;
  const MAX_DIST = 1600;

  let bestInCone = null;
  let bestInConeScore = -Infinity;
  let bestOut = null;
  let bestOutScore = -Infinity;

  for (const s of candidates) {
    if (s.hp <= 0) continue;
    const dx = wrapDelta(s.x - player.x, WORLD_W);
    const dy = wrapDelta(s.y - player.y, WORLD_H);
    const dist = Math.hypot(dx, dy);
    if (dist < 1) continue;

    const enemyAngle = Math.atan2(dy, dx);
    let angleOff = enemyAngle - aimAngle;
    while (angleOff > Math.PI) angleOff -= Math.PI * 2;
    while (angleOff < -Math.PI) angleOff += Math.PI * 2;
    const absOff = Math.abs(angleOff);

    if (absOff < CONE) {
      const alignScore = 1 - (absOff / CONE);
      const distScore = Math.min(1, dist / IDEAL_DIST);
      const total = alignScore * 2.2 + distScore * 1.0;
      if (total > bestInConeScore) {
        bestInConeScore = total;
        bestInCone = s;
      }
    } else {
      const score = Math.max(0, 1 - dist / MAX_DIST);
      if (score > bestOutScore) {
        bestOutScore = score;
        bestOut = s;
      }
    }
  }

  return bestInCone || bestOut;
}

/* -------------------------------------------------------------------
   Fire flares (F key / special)
   ------------------------------------------------------------------- */
export function fireFlares(gs) {
  if (gs.specialCooldown > 0) return;
  const p = gs.player;

  const count = FLARES.count;
  const baseOffset = Math.random() * Math.PI * 2;

  for (let i = 0; i < count; i++) {
    // Fully randomized direction — each flare scattered
    const angle = baseOffset + (i / count) * Math.PI * 2 +
                  (Math.random() - 0.5) * 0.9;

    gs.projectiles.push({
      kind: 'flare',
      owner: 'player',
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * FLARES.speed + p.vx * FLARES.velocityInheritance,
      vy: Math.sin(angle) * FLARES.speed + p.vy * FLARES.velocityInheritance,
      lifetime: FLARES.lifetime,
      damage: FLARES.damage,
      damageRadius: FLARES.damageRadius,
      repulseForce: FLARES.repulseForce,
      size: 5,
      color: 0xffdd33,
      blinkPhase: Math.random() * Math.PI * 2,
    });
  }

  gs.specialCooldown = FLARES.cooldown;
  window.dispatchEvent(new CustomEvent('special:fired'));
}

/* -------------------------------------------------------------------
   Update cooldowns
   ------------------------------------------------------------------- */
export function updateWeaponCooldowns(gs, dt) {
  if (gs.playerWeapons) {
    for (const w of gs.playerWeapons) {
      if (w.cooldown > 0) w.cooldown -= dt;
    }
  }
  if (gs.specialCooldown > 0) gs.specialCooldown -= dt;
}