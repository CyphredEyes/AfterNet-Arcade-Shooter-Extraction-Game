import { WORLD_W, WORLD_H, PLAYER, BULLET } from '../modules/config.js';
import { applyBorderRepulsion } from '../modules/world.js';
import { input } from '../modules/input.js';
import { createBullet } from '../modules/entities.js';
import { fireCurrentWeapon } from './weaponSystem.js';

export function updatePlayer(state, dt, screen) {
  const { player } = state;
  const cx = screen.width  * 0.5;
  const cy = screen.height * 0.5;

  player.angle = Math.atan2(input.mouseY - cy, input.mouseX - cx);

  const fx = Math.cos(player.angle);
  const fy = Math.sin(player.angle);
  const sx = -fy;
  const sy =  fx;

  const allowInput = !state.activeOverlay;

  let ax = 0, ay = 0;

  if (allowInput) {
    if (input.keys['w'] || input.keys['arrowup'])    { ax += fx * PLAYER.accel; ay += fy * PLAYER.accel; }
    if (input.keys['s'] || input.keys['arrowdown'])  { ax -= fx * PLAYER.accel * PLAYER.reverseFactor; ay -= fy * PLAYER.accel * PLAYER.reverseFactor; }
    if (input.keys['d'] || input.keys['arrowright']) { ax += sx * PLAYER.accel; ay += sy * PLAYER.accel; }
    if (input.keys['a'] || input.keys['arrowleft'])  { ax -= sx * PLAYER.accel; ay -= sy * PLAYER.accel; }
  }

  player.vx += ax * dt;
  player.vy += ay * dt;

  const drag = Math.exp(-PLAYER.dragPerSec * dt);
  player.vx *= drag;
  player.vy *= drag;

  const sp = Math.hypot(player.vx, player.vy);
  if (sp > player.maxSpeed) {
    const k = player.maxSpeed / sp;
    player.vx *= k;
    player.vy *= k;
  }

  // Move by velocity, then apply border repulsion / gate check
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const borderResult = applyBorderRepulsion(player, player.r, { gate: state.gate });

  if (borderResult === 'escaped') {
    window.dispatchEvent(new CustomEvent('game:escape'));
    return;
  }

  if (allowInput && input.mouseDown) {
    fireCurrentWeapon(state, player.angle);
  }
}