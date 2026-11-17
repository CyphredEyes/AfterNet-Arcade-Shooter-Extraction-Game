import { WORLD_W, WORLD_H, BORDER } from './config.js';

export const wrapPos = (v, size) => {
  const r = v % size;
  return r < 0 ? r + size : r;
};

export const wrapDelta = (d, size) => {
  let r = (d + size * 0.5) % size;
  if (r < 0) r += size;
  return r - size * 0.5;
};

export const torusDistSq = (ax, ay, bx, by, w, h) => {
  const dx = wrapDelta(ax - bx, w);
  const dy = wrapDelta(ay - by, h);
  return dx * dx + dy * dy;
};

/* Generic border repulsion + optional gate escape.
 *
 * Returns:
 *   false     → no border interaction
 *   'hit'     → bounced against a border
 *   'escaped' → passed through an open gate
 *
 * `entity` must have { x, y, vx, vy }.
 * `gate` is `{ side, start, end }` or null.
 */
export function applyBorderRepulsion(entity, radius, opts = {}) {
  const { bounciness = BORDER.bounciness, gate = null } = opts;

  let result = false;

  // Pre-compute whether the entity is inside the gate's cross-range
  const inGate = gate
    ? ((gate.side === 'left' || gate.side === 'right')
        ? (entity.y >= gate.start && entity.y <= gate.end)
        : (entity.x >= gate.start && entity.x <= gate.end))
    : false;

  // --- Left border ---
  if (entity.x < radius) {
    if (gate && gate.side === 'left' && inGate) return 'escaped';
    entity.x = radius;
    if (entity.vx < 0) entity.vx = -entity.vx * bounciness;
    result = true;
  }
  // --- Right border ---
  else if (entity.x > WORLD_W - radius) {
    if (gate && gate.side === 'right' && inGate) return 'escaped';
    entity.x = WORLD_W - radius;
    if (entity.vx > 0) entity.vx = -entity.vx * bounciness;
    result = true;
  }

  // --- Top border ---
  if (entity.y < radius) {
    if (gate && gate.side === 'top' && inGate) return 'escaped';
    entity.y = radius;
    if (entity.vy < 0) entity.vy = -entity.vy * bounciness;
    result = true;
  }
  // --- Bottom border ---
  else if (entity.y > WORLD_H - radius) {
    if (gate && gate.side === 'bottom' && inGate) return 'escaped';
    entity.y = WORLD_H - radius;
    if (entity.vy > 0) entity.vy = -entity.vy * bounciness;
    result = true;
  }

  return result ? 'hit' : false;
}