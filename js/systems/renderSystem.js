import { WORLD_W, WORLD_H, GRID, SERVER, BORDER, NODE_CATEGORIES, EXPLOIT_INJECTION } from '../modules/config.js';
import { getShieldPct } from './serverSystem.js';
import { state as globalState } from '../core/state.js';
import { wrapDelta } from '../modules/world.js';

//background configs.
const BG_PAD = 2000;
const ALERT_BLINK_DURATION_MS = 800;
const ALERT_GAP_MIN = 1500;
const ALERT_GAP_MAX = 4500;

export class RenderSystem {
  constructor(app) {
    this.app = app;
    this.stage = app.stage;

    this.worldContainer  = new PIXI.Container();
    this.entityContainer = new PIXI.Container();
    this.uiContainer     = new PIXI.Container();
    this.stage.addChild(this.worldContainer, this.entityContainer, this.uiContainer);

    /* -----------------------------------------------------------------
       Layer stack (declared upfront, in draw order):
         0  bgGfx          neural background
         1  gridGfx        grid lines
         3  lineLayer      server internal links (body → node → own)
         4  webpageLayer   floating webpages
         5  mainLayer      server base circles + icon sprites
         6  serverHpLayer  inner HP ring arcs
         7  nodeLayer      orbiting nodes + own-nodes
         8  asteroidLayer  packets (udp / tcp)
         9  bulletLayer    player bullets
        10  aiShipLayer    corp AI ships
        11  aiBulletLayer  corp AI bullets
        12  borderGlowGfx  border glow
        13  borderMainGfx  border main line
        14  borderGateGfx  border gate segment
       ----------------------------------------------------------------- */
    this.bgGfx         = new PIXI.Graphics();
    this.gridGfx       = new PIXI.Graphics();
    
    this.lineLayer     = new PIXI.Container();
    this.webpageLayer  = new PIXI.Container();
    this.mainLayer     = new PIXI.Container();
    this.serverHpLayer = new PIXI.Container();
    this.nodeLayer     = new PIXI.Container();
    this.asteroidLayer = new PIXI.Container();
    this.bulletLayer   = new PIXI.Container();
    this.aiShipLayer   = new PIXI.Container();
    this.aiBulletLayer = new PIXI.Container();
    this.borderGlowGfx = new PIXI.Graphics();
    this.borderMainGfx = new PIXI.Graphics();
    this.borderGateGfx = new PIXI.Graphics();

    this.worldContainer.addChild(
      this.bgGfx,
      this.gridGfx,
      
      this.lineLayer,
      this.webpageLayer,
      this.mainLayer,
      this.serverHpLayer,
      this.nodeLayer,
      this.asteroidLayer,
      this.bulletLayer,
      this.aiShipLayer,
      this.aiBulletLayer,
      this.borderGlowGfx,
      this.borderMainGfx,
      this.borderGateGfx,
    );

    this.playerGfx = new PIXI.Graphics();
    this.entityContainer.addChild(this.playerGfx);

    this.asteroidMap  = new Map();
    this.bulletMap    = new Map();
    this.serverMap    = new Map();
    this.aiShipMap    = new Map();
    this.aiBulletMap  = new Map();

    this.hudText = new PIXI.Text({ text: '', style: {
      fontFamily: 'monospace', fontSize: 12, fill: 0x4d6a8f,
    }});
    this.hudText.position.set(12, 12);
    this.uiContainer.addChild(this.hudText);

    this.hintText = new PIXI.Text({ text: '', style: {
      fontFamily: 'monospace', fontSize: 12, fill: 0x33465e,
    }});
    this.hintText.position.set(12, 30);
    this.uiContainer.addChild(this.hintText);

    this.promptText = new PIXI.Text({
      text: '', style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffff00 },
    });
    this.promptText.anchor.set(0.5);
    this.promptText.visible = false;
    this.uiContainer.addChild(this.promptText);

    this.minimapGfx = new PIXI.Graphics();
    this.uiContainer.addChild(this.minimapGfx);

    // Icon texture cache — loaded lazily, tolerant of missing files
    this.serverIcons = new Map();
    const ICON_TYPES = [
      'general','store','forum','sensitive','bank','social',
      'blackmarket','pirate','cracker','phishing',
      'cybersec','gov','datacenter','hackergroup',
    ];
    for (const t of ICON_TYPES) {
      PIXI.Assets.load(`/img/servers/${t}.png`)
        .then(tex => this.serverIcons.set(t, tex))
        .catch(() => {});     // silent fallback to text label
    }

        /* ---- Ship textures ---- */
    this.shipTextures = new Map();
    for (let i = 1; i <= 5; i++) {
      const path = `/img/items/SHIP_${i}.png`;
      PIXI.Assets.load(path)
        .then(tex => this.shipTextures.set(path, tex))
        .catch(() => {});
    }

    /* ---- Node category icons + core ---- */
    this.nodeIcons = new Map();
    const NODE_ICON_PATHS = {
      security:   '/img/items/security_icon.png',
      research:   '/img/items/hacker_icon.png',
      processing: '/img/items/bank_icon.png',
      storage:    '/img/items/database_icon.png',
      core:       '/img/items/server_icon.png',
    };
    for (const [key, path] of Object.entries(NODE_ICON_PATHS)) {
      PIXI.Assets.load(path)
        .then(tex => this.nodeIcons.set(key, tex))
        .catch(() => {});
    }

    this.shipImg = null;
    this.shipColor   = 0x6ee7ff;
    this.bulletColor = 0xffd36e;
    this.accentColor = 0x1a4a58;

    /* ----------------------------------------------------------------
       Neural background — stars (squares) + short connection lines.
       Pre-generated once; only the visible subset is drawn each frame.
       ---------------------------------------------------------------- */
    this.stars = [];
    const STAR_GRID = 300;
    for (let x = -BG_PAD; x < WORLD_W + BG_PAD; x += STAR_GRID) {
      for (let y = -BG_PAD; y < WORLD_H + BG_PAD; y += STAR_GRID) {
        this.stars.push({
          x: x + (Math.random() - 0.5) * STAR_GRID * 0.75,
          y: y + (Math.random() - 0.5) * STAR_GRID * 0.75,
          s: 1.5 + Math.random() * 2,
          brightness: 0.25 + Math.random() * 0.45,
        });
      }
    }

    this.starEdges = [];
    const CONNECT_R2 = 450 * 450;
    for (let i = 0; i < this.stars.length; i++) {
      const a = this.stars[i];
      const neighbors = [];
      for (let j = i + 1; j < this.stars.length; j++) {
        const b = this.stars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < CONNECT_R2) neighbors.push({ j, d2 });
      }
      neighbors.sort((u, v) => u.d2 - v.d2);
      const take = Math.min(3, neighbors.length);
      for (let k = 0; k < take; k++) this.starEdges.push([i, neighbors[k].j]);
    }

    this.starNeighbors = new Map();
    for (let i = 0; i < this.stars.length; i++) this.starNeighbors.set(i, []);
    for (const [i, j] of this.starEdges) {
      this.starNeighbors.get(i).push(j);
      this.starNeighbors.get(j).push(i);
    }

    this.alertActive = false;
    for (const s of this.stars) {
      s.blinkStartAt = -1;
      s.nextBlinkAt = 0;
    }
  }

  destroy() {
    this.stage.removeChild(this.worldContainer, this.entityContainer, this.uiContainer);
    this.worldContainer.destroy({ children: true });
    this.entityContainer.destroy({ children: true });
    this.uiContainer.destroy({ children: true });
  }

  sync(state, screen) {
    const { player, asteroids, bullets, servers } = state;
    const cx = screen.width  * 0.5;
    const cy = screen.height * 0.5;

    this.shipColor   = state.shipColor   ?? 0x6ee7ff;
    this.bulletColor = state.bulletColor ?? 0xffd36e;
    this.accentColor = state.accentColor ?? 0x1a4a58;
    this.shipImg     = state.shipImg     ?? null;

    this.drawBackground(player, cx, cy, screen);
    this.drawGrid(player, cx, cy, screen);
    this.drawBorders(player, cx, cy, screen, state);
    this.drawAsteroids(asteroids, player, cx, cy);
    this.drawBullets(bullets, player, cx, cy);
    this.drawProjectiles(state.projectiles || [], player, cx, cy);
    this.drawServers(servers, player, cx, cy, state);
    this.drawAIShips(state, player, cx, cy);
    this.drawAIBullets(state, player, cx, cy);
    this.drawPlayer(player, cx, cy);

    const gateLabel = state.gate ? `   GATE: ${state.gate.side.toUpperCase()}` : '';
    this.hudText.text =
      `WORLD ${WORLD_W}x${WORLD_H}   POS ${player.x.toFixed(0)}, ${player.y.toFixed(0)}   ` +
      `AST ${asteroids.length}   BUL ${bullets.length}   SRV ${servers.length}   ` +
      `HP ${player.hp.toFixed(0)}   THREAT ${globalState.corpThreat}/5${gateLabel}`;

    this.hintText.text = 'W/S thrust · A/D strafe · MOUSE aim · CLICK fire · E interact · I inventory';

    this.drawMinimap(player, screen, state);
  }

  /* ============================================================
     Neural background — stars + connections
     ============================================================ */
  drawBackground(player, cx, cy, screen) {
    const bg = this.bgGfx;
    bg.clear();

    const halfW  = screen.width  * 0.5;
    const halfH  = screen.height * 0.5;
    const margin = 400;
    const now = performance.now();

    /* ---- Collect visible stars ---- */
    const visible = new Map();
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const dx = s.x - player.x;
      const dy = s.y - player.y;
      if (Math.abs(dx) > halfW + margin) continue;
      if (Math.abs(dy) > halfH + margin) continue;
      visible.set(i, { sx: cx + dx, sy: cy + dy, s });
    }

    /* ---- Draw lines ---- */
    for (const [i, j] of this.starEdges) {
      const a = visible.get(i);
      const b = visible.get(j);
      if (!a || !b) continue;
      bg.moveTo(a.sx, a.sy);
      bg.lineTo(b.sx, b.sy);
    }
    bg.stroke({ color: 0xffffff, width: 0.8, alpha: 0.08 });

    /* ---- Draw stars (random blink if alert active) ---- */
    for (const v of visible.values()) {
      const s = v.s;
      const sz = s.s;
      let alertAlpha = 0;

      if (this.alertActive) {
        if (s.blinkStartAt >= 0 && now - s.blinkStartAt < ALERT_BLINK_DURATION_MS) {
          const progress = (now - s.blinkStartAt) / ALERT_BLINK_DURATION_MS;
          alertAlpha = Math.sin(progress * Math.PI);
        } else if (now >= s.nextBlinkAt) {
          s.blinkStartAt = now;
          s.nextBlinkAt = now + ALERT_BLINK_DURATION_MS +
            ALERT_GAP_MIN + Math.random() * (ALERT_GAP_MAX - ALERT_GAP_MIN);
        }
      }

      if (alertAlpha > 0.01) {
        bg.rect(v.sx - sz / 2, v.sy - sz / 2, sz, sz)
          .fill({ color: 0xff3333, alpha: 0.55 + 0.45 * alertAlpha });
      } else {
        bg.rect(v.sx - sz / 2, v.sy - sz / 2, sz, sz)
          .fill({ color: 0xffffff, alpha: s.brightness });
      }
    }
  }

  //triggerAlert on this file is just visual after the sector is cleared
  triggerAlert(originX, originY) {
    this.alertActive = true;
    const now = performance.now();
    for (const s of this.stars) {
      s.blinkStartAt = -1;
      s.nextBlinkAt = now + Math.random() * 2500;
    }
  }

  /* ============================================================
     Borders + gate
     ============================================================ */
  drawBorders(player, cx, cy, screen, state) {
    const glowG = this.borderGlowGfx;
    const mainG = this.borderMainGfx;
    const gateG = this.borderGateGfx;
    glowG.clear();
    mainG.clear();
    gateG.clear();

    const screenW = screen.width;
    const screenH = screen.height;
    const margin  = 20;

    const leftX   = cx - player.x;
    const rightX  = cx + (WORLD_W - player.x);
    const topY    = cy - player.y;
    const bottomY = cy + (WORLD_H - player.y);

    const leftVisible   = leftX   > -margin && leftX   < screenW + margin;
    const rightVisible  = rightX  > -margin && rightX  < screenW + margin;
    const topVisible    = topY    > -margin && topY    < screenH + margin;
    const bottomVisible = bottomY > -margin && bottomY < screenH + margin;

    const vY0 = Math.max(-margin, topY);
    const vY1 = Math.min(screenH + margin, bottomY);
    const vVisible = vY1 > vY0;

    const hX0 = Math.max(-margin, leftX);
    const hX1 = Math.min(screenW + margin, rightX);
    const hVisible = hX1 > hX0;

    // --- Glow layer ---
    if (leftVisible   && vVisible) glowG.moveTo(leftX,   vY0).lineTo(leftX,   vY1);
    if (rightVisible  && vVisible) glowG.moveTo(rightX,  vY0).lineTo(rightX,  vY1);
    if (topVisible    && hVisible) glowG.moveTo(hX0, topY).lineTo(hX1, topY);
    if (bottomVisible && hVisible) glowG.moveTo(hX0, bottomY).lineTo(hX1, bottomY);
    glowG.stroke({ color: 0xffffff, width: BORDER.glowWidth, alpha: BORDER.glowAlpha });

    // --- Main line ---
    if (leftVisible   && vVisible) mainG.moveTo(leftX,   vY0).lineTo(leftX,   vY1);
    if (rightVisible  && vVisible) mainG.moveTo(rightX,  vY0).lineTo(rightX,  vY1);
    if (topVisible    && hVisible) mainG.moveTo(hX0, topY).lineTo(hX1, topY);
    if (bottomVisible && hVisible) mainG.moveTo(hX0, bottomY).lineTo(hX1, bottomY);
    mainG.stroke({ color: 0xffffff, width: BORDER.lineWidth, alpha: BORDER.lineAlpha });

    // --- Gate ---
    if (!state.gate) return;
    const g = state.gate;

    if ((g.side === 'left' && leftVisible && vVisible) ||
        (g.side === 'right' && rightVisible && vVisible)) {
      const gx = g.side === 'left' ? leftX : rightX;
      const gY0 = Math.max(vY0, cy - player.y + g.start);
      const gY1 = Math.min(vY1, cy - player.y + g.end);
      if (gY1 > gY0) {
        gateG.moveTo(gx, gY0).lineTo(gx, gY1);
        gateG.stroke({ color: 0xffffff, width: BORDER.gateWidth, alpha: 1 });
      }
    }

    if ((g.side === 'top' && topVisible && hVisible) ||
        (g.side === 'bottom' && bottomVisible && hVisible)) {
      const gy = g.side === 'top' ? topY : bottomY;
      const gX0 = Math.max(hX0, cx - player.x + g.start);
      const gX1 = Math.min(hX1, cx - player.x + g.end);
      if (gX1 > gX0) {
        gateG.moveTo(gX0, gy).lineTo(gX1, gy);
        gateG.stroke({ color: 0xffffff, width: BORDER.gateWidth, alpha: 1 });
      }
    }
  }

  /* ============================================================
     AI ships — corp backup
     ============================================================ */
  drawAIShips(state, player, cx, cy) {
    const live = new Set();

    for (const ship of state.aiShips || []) {
      live.add(ship);
      let g = this.aiShipMap.get(ship);
      if (!g) {
        g = new PIXI.Graphics();
        this.aiShipLayer.addChild(g);
        this.aiShipMap.set(ship, g);
      }
      const sx = cx + (ship.x - player.x);
      const sy = cy + (ship.y - player.y);

      g.clear();
      const s = ship.size;

      if (ship.shape === 'hex') {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const px = Math.cos(a) * s;
          const py = Math.sin(a) * s;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath()
          .fill({ color: ship.color, alpha: 0.2 })
          .stroke({ color: ship.color, width: 2 });
      } else if (ship.shape === 'diamond') {
        g.moveTo(s, 0)
          .lineTo(0, s * 0.7)
          .lineTo(-s, 0)
          .lineTo(0, -s * 0.7)
          .closePath()
          .fill({ color: ship.color, alpha: 0.2 })
          .stroke({ color: ship.color, width: 2 });
      } else {
        // arrow (default — raider, wasp, flarer)
        g.moveTo(s, 0)
          .lineTo(-s * 0.65, s * 0.65)
          .lineTo(-s * 0.30, 0)
          .lineTo(-s * 0.65, -s * 0.65)
          .closePath()
          .fill({ color: ship.color, alpha: 0.2 })
          .stroke({ color: ship.color, width: 2 });
      }

      g.position.set(sx, sy);
      g.rotation = ship.angle;
    }

    for (const [ship, g] of this.aiShipMap) {
      if (!live.has(ship)) { g.destroy(); this.aiShipMap.delete(ship); }
    }
  }

  drawAIBullets(state, player, cx, cy) {
    const live = new Set();
    for (const b of state.aiBullets || []) {
      live.add(b);
      let g = this.aiBulletMap.get(b);
      if (!g) {
        g = new PIXI.Graphics().rect(-2, -2, 4, 4).fill(b.color || 0xff4444);
        this.aiBulletLayer.addChild(g);
        this.aiBulletMap.set(b, g);
      }
      g.position.set(cx + (b.x - player.x), cy + (b.y - player.y));
    }
    for (const [b, g] of this.aiBulletMap) {
      if (!live.has(b)) { g.destroy(); this.aiBulletMap.delete(b); }
    }
  }

  drawProjectiles(projectiles, player, cx, cy) {
    if (!this._projLayer) {
      this._projLayer = new PIXI.Container();
      this.worldContainer.addChild(this._projLayer);
      this._projMap = new Map();
    }

    const live = new Set();
    for (const p of projectiles) {
      live.add(p);
      let g = this._projMap.get(p);
      if (!g) {
        g = new PIXI.Graphics();
        this._projLayer.addChild(g);
        this._projMap.set(p, g);
      }

      g.clear();
      const sx = cx + (p.x - player.x);
      const sy = cy + (p.y - player.y);

      if (p.kind === 'missile') {
        const s = p.size || 4;
        g.rect(sx - s, sy - s, s * 2, s * 2)
          .fill({ color: p.color });
        g.rect(sx - s - 1, sy - s - 1, (s + 1) * 2, (s + 1) * 2)
          .stroke({ color: p.color, width: 1, alpha: 0.6 });
      } else if (p.kind === 'flare') {
        const blink = (Math.sin(performance.now() / 80 + p.blinkPhase) + 1) * 0.5;
        g.circle(sx, sy, p.size)
          .fill({ color: p.color, alpha: 0.7 + 0.3 * blink });
        g.circle(sx, sy, p.size * 2)
          .stroke({ color: p.color, width: 1, alpha: 0.4 * blink });
      }
    }

    for (const [p, g] of this._projMap) {
      if (!live.has(p)) { g.destroy(); this._projMap.delete(p); }
    }
  }

  /* ============================================================
     Grid — stays wrapped (background only)
     ============================================================ */
  drawGrid(player, cx, cy, screen) {
    const { w, h } = screen;
    const left = player.x - cx;
    const top  = player.y - cy;
    const g = this.gridGfx;
    g.clear();
    g.stroke({ width: 1, color: 0x101423 });

    const gx0 = Math.floor(left / GRID) * GRID;
    for (let gx = gx0; gx <= left + w; gx += GRID) {
      if (gx < 0 || gx > WORLD_W) continue;
      const sx = cx + (gx - player.x);
      if (sx < 0 || sx > w) continue;
      g.moveTo(sx, 0); g.lineTo(sx, h);
    }
    const gy0 = Math.floor(top / GRID) * GRID;
    for (let gy = gy0; gy <= top + h; gy += GRID) {
      if (gy < 0 || gy > WORLD_H) continue;
      const sy = cy + (gy - player.y);
      if (sy < 0 || sy > h) continue;
      g.moveTo(0, sy); g.lineTo(w, sy);
    }
  }

  /* ============================================================
     Asteroids (packets) — raw delta
     ============================================================ */
  drawAsteroids(asteroids, player, cx, cy) {
    const live = new Set();
    for (const a of asteroids) {
      live.add(a);

      let entry = this.asteroidMap.get(a);
      if (!entry) {
        const container = new PIXI.Container();
        const gfx = new PIXI.Graphics();
        container.addChild(gfx);
        entry = { container, gfx };
        this.asteroidMap.set(a, entry);
        this.asteroidLayer.addChild(container);
      }

      entry.container.position.set(cx + (a.x - player.x), cy + (a.y - player.y));
      entry.container.rotation = a.rot;

      // Hide packets only when inside the core circle
      if (a.sourceServerRef) {
        const ddx = wrapDelta(a.x - a.sourceServerRef.x, WORLD_W);
        const ddy = wrapDelta(a.y - a.sourceServerRef.y, WORLD_H);
        const coreR = SERVER.coreRadius;
        entry.container.visible = !(ddx * ddx + ddy * ddy < coreR * coreR);
      } else {
        entry.container.visible = true;
      }

      const g = entry.gfx;
      g.clear();

      let fillColor, strokeColor;

      const mastered = globalState.hasMasterKey === true;
      const visuallyEncrypted = a.encrypted && !mastered;

      if (a.dying) {
        const blink = (Math.sin(performance.now() / 50) + 1) * 0.5;
        fillColor = 0x000000;
        strokeColor = blink > 0.5 ? 0xff2020 : 0x220000;
      } else if (a.contaminationState === 'light' || a.contaminationState === 'heavy') {
        fillColor = 0x2a0a2a;
        strokeColor = 0xa040ff;
      } else if (visuallyEncrypted) {
        fillColor = 0x0a2a10;
        strokeColor = 0x3fff70;
      } else {
        // Unencrypted / post-master-key → yellow
        fillColor = 0x2a2000;
        strokeColor = 0xffdd33;
      }

      g.rect(-a.s, -a.s, a.s * 2, a.s * 2)
        .fill(fillColor)
        .stroke({ color: strokeColor, width: 2 });

      if (a.contaminationState === 'light' || a.contaminationState === 'heavy') {
        const pulse = (Math.sin(performance.now() / 200) + 1) * 0.5;
        g.rect(-a.s - 3, -a.s - 3, (a.s + 3) * 2, (a.s + 3) * 2)
          .stroke({ color: strokeColor, width: 1.5, alpha: 0.4 + 0.5 * pulse });
      }

      if (!a.broken && !a.dying && a.contaminationState === 'clean' && !visuallyEncrypted) {
        const t = (performance.now() / 700) % 1;
        g.rect(-a.s - 3, -a.s - 3, (a.s + 3) * 2, (a.s + 3) * 2)
          .stroke({ color: strokeColor, width: 1, alpha: 0.25 * (1 - t) });
      }
    }

    for (const [a, entry] of this.asteroidMap) {
      if (!live.has(a)) {
        entry.container.destroy({ children: true });
        this.asteroidMap.delete(a);
      }
    }
  }

  /* ============================================================
     Player bullets — raw delta
     ============================================================ */
  drawBullets(bullets, player, cx, cy) {
    const live = new Set();
    for (const b of bullets) {
      live.add(b);
      let g = this.bulletMap.get(b);
      if (!g) {
        g = new PIXI.Graphics().rect(-2, -2, 4, 4).fill(this.bulletColor);
        this.bulletMap.set(b, g);
        this.bulletLayer.addChild(g);
      }
      g.position.set(cx + (b.x - player.x), cy + (b.y - player.y));
    }
    for (const [b, g] of this.bulletMap) {
      if (!live.has(b)) { g.destroy(); this.bulletMap.delete(b); }
    }
  }

  /* ============================================================
     Servers — raw delta everywhere
     ============================================================ */
  drawServers(servers, player, cx, cy, state) {
    const liveServers = new Set();

    for (const server of servers) {
      liveServers.add(server);

      let entry = this.serverMap.get(server);
      if (!entry) {
        entry = {
          mainGfx:   new PIXI.Graphics(),
          shieldGfx: new PIXI.Graphics(),
          coreHpGfx: new PIXI.Graphics(),
          lineGfx:   new PIXI.Graphics(),
          nodeGfx:   new Map(),
        };
        this.mainLayer.addChild(entry.mainGfx);
        this.mainLayer.addChild(entry.shieldGfx);
        this.serverHpLayer.addChild(entry.coreHpGfx);
        this.lineLayer.addChild(entry.lineGfx);
        this.serverMap.set(server, entry);
      }

      const ssx = cx + (server.x - player.x);
      const ssy = cy + (server.y - player.y);

      /* ---- Connection lines: Core → alive nodes ---- */
      const lg = entry.lineGfx;
      lg.clear();
      for (const node of server.nodes) {
        if (node.broken) continue;
        const nx = cx + (node.x - player.x);
        const ny = cy + (node.y - player.y);
        lg.moveTo(ssx, ssy).lineTo(nx, ny);
      }
      const mastered = globalState.hasMasterKey === true;
      const visuallyEncryptedLine = server.communicationEncrypted === true && !mastered;
      lg.stroke({
        color: visuallyEncryptedLine ? 0x3fff70 : 0x3a5a7a,
        width: 1,
        alpha: visuallyEncryptedLine ? 0.65 : 0.45,
      });

      /* ---- Shield + core rendering ---- */
      const shieldPct = getShieldPct(server);
      const mg = entry.mainGfx;
      mg.clear();

      // Shield ring — colour + thickness scale with shieldPct
      const sg = entry.shieldGfx;
      sg.clear();
      if (shieldPct > 0 && !server.core.broken) {
        const t = shieldPct / 100;
        const ringColor = t > 0.66 ? 0x6ee7ff : t > 0.33 ? 0xffaa33 : 0xf85149;
        sg.circle(ssx, ssy, SERVER.coreRadius + 6)
          .stroke({ color: ringColor, width: 2, alpha: 0.3 + 0.5 * t });
      }

      // Core body — sprite if available, circle as fallback
      if (!entry.coreSprite) {
        entry.coreSprite = new PIXI.Sprite();
        entry.coreSprite.anchor.set(0.5);
        this.mainLayer.addChild(entry.coreSprite);
      }
      const coreTex = this.nodeIcons.get('core');
      const coreFill = server.core.broken ? 0x2a1a1a
                     : shieldPct > 0     ? 0x2a4a5a
                     :                    0x4a3a1a;
      const coreStroke = server.core.broken ? 0x661616
                       : shieldPct > 0     ? 0x6ee7ff
                       :                    0xffaa33;

      // Circle is always the base
      mg.circle(ssx, ssy, SERVER.coreRadius)
        .fill(coreFill)
        .stroke({ color: coreStroke, width: 2 });

      // Small icon overlay on top
      if (!entry.coreSprite) {
        entry.coreSprite = new PIXI.Sprite();
        entry.coreSprite.anchor.set(0.5);
        this.mainLayer.addChild(entry.coreSprite);
      }
      if (coreTex) {
        entry.coreSprite.texture = coreTex;
        entry.coreSprite.visible = true;
        entry.coreSprite.width  = SERVER.coreRadius * 0.9;
        entry.coreSprite.height = SERVER.coreRadius * 0.9;
        entry.coreSprite.position.set(ssx, ssy);
        entry.coreSprite.tint  = server.core.broken ? 0x661616 : 0xffffff;
        entry.coreSprite.alpha = server.core.broken ? 0.4 : 1;
      } else {
        entry.coreSprite.visible = false;
      }

      // Blink overlay
      const tt = server._time;
      let blinkColor = 0, blinkAlpha = 0;
      if (!server.core.broken && shieldPct <= 0) {
        blinkAlpha = (Math.sin(tt * Math.PI * 3.0) + 1) * 0.5 * 0.30;
        blinkColor = 0xffaa33;
      }
      if (blinkAlpha > 0.01) {
        mg.circle(ssx, ssy, SERVER.coreRadius)
          .fill({ color: blinkColor, alpha: blinkAlpha });
      }

      // Core HP ring
      const hg = entry.coreHpGfx;
      hg.clear();
      if (!server.core.broken) {
        const hpPct = server.core.maxHp > 0
          ? server.core.hp / server.core.maxHp
          : 0;
        const hpColor = hpPct > 0.60 ? 0x3fb950
                      : hpPct > 0.30 ? 0xd29922
                      :                0xf85149;
        hg.circle(ssx, ssy, SERVER.coreRadius - 8)
          .stroke({ color: 0x1a1f25, width: 4 });
        if (hpPct > 0) {
          const start = -Math.PI / 2;
          const end   = start + Math.PI * 2 * hpPct;
          const startX = ssx + Math.cos(start) * (SERVER.coreRadius - 8);
          const startY = ssy + Math.sin(start) * (SERVER.coreRadius - 8);
          hg.moveTo(startX, startY);
          hg.arc(ssx, ssy, SERVER.coreRadius - 8, start, end);
          hg.stroke({ color: hpColor, width: 4 });
        }
      }
      
      if (state.menuVisible && state.actionTarget && state.actionTarget.type === 'core') {
        const pulse = (Math.sin(tt * 4) + 1) * 0.5;
        const ringR = SERVER.coreRadius + 10 + pulse * 3;
        mg.circle(ssx, ssy, ringR)
          .stroke({ color: 0x3fb950, width: 2, alpha: 0.4 + 0.4 * pulse });
      }

      /* ---- Category nodes ---- */
      const serverLiveNodes = new Set();
      for (const node of server.nodes) {
        serverLiveNodes.add(node);

        let ne = entry.nodeGfx.get(node);
        if (!ne) {
          const container = new PIXI.Container();
          const gfx = new PIXI.Graphics();
          container.addChild(gfx);

          const iconSprite = new PIXI.Sprite();
          iconSprite.anchor.set(0.5);
          iconSprite.width  = node.radius * 1.25;
          iconSprite.height = node.radius * 1.25;
          container.addChild(iconSprite);

          ne = { container, gfx, iconSprite };
          entry.nodeGfx.set(node, ne);
          this.nodeLayer.addChild(container);
        }

        // Set / refresh the icon texture
        const iconTex = this.nodeIcons.get(node.category);
        if (iconTex) {
          ne.iconSprite.texture = iconTex;
          ne.iconSprite.visible = true;
        } else {
          ne.iconSprite.visible = false;
        }

        const nx = cx + (node.x - player.x);
        const ny = cy + (node.y - player.y);
        ne.container.position.set(nx, ny);

        const nodeColor = NODE_CATEGORIES[node.category]?.color ?? 0x8b949e;
        const exploited = node.exploited === true && !node.broken;

        const fillCol = node.broken ? 0x2a1a1a
                       : exploited  ? 0x2a0a2a
                       : (nodeColor & 0x555555);
        const strokeCol = node.broken ? 0x661616
                         : exploited  ? 0xa040ff
                         : nodeColor;

        const g = ne.gfx;
        g.clear();
        g.circle(0, 0, node.radius)
          .fill(fillCol)
          .stroke({ color: strokeCol, width: 2 });

        // Small HP arc on alive nodes
        if (!node.broken && node.maxHp > 0) {
          const hpPct = node.hp / node.maxHp;
          if (hpPct < 1) {
            const a0 = -Math.PI / 2;
            const a1 = a0 + Math.PI * 2 * hpPct;
            const r  = node.radius + 3;
            const sx = Math.cos(a0) * r;
            const sy = Math.sin(a0) * r;
            g.moveTo(sx, sy);
            g.arc(0, 0, r, a0, a1);
            g.stroke({ color: strokeCol, width: 2 });
          }
        }

        // Compromised / master-key indicator
        if (!node.broken && node.compromised) {
          const pulse = (Math.sin(tt * Math.PI * 4) + 1) * 0.5;
          g.circle(0, 0, node.radius + 4)
            .stroke({ color: 0xffaa33, width: 1, alpha: 0.4 + 0.5 * pulse });
        }

        ne.iconSprite.tint = node.broken ? 0x661616
          : exploited  ? 0xc080ff
          : 0xffffff;
        ne.iconSprite.alpha = node.broken ? 0.4 : 1;
        
        if (state.menuVisible && state.actionTarget && state.actionTarget.ref === node) {
          const pulse = (Math.sin(server._time * 4) + 1) * 0.5;
          const ringR = node.radius + 6 + pulse * 3;
          g.circle(0, 0, ringR)
            .stroke({ color: 0x3fb950, width: 2, alpha: 0.5 + 0.4 * pulse });
        }
      }

      // Cleanup dead node graphics
      for (const [node, ne] of entry.nodeGfx) {
        if (!serverLiveNodes.has(node)) {
          ne.container.destroy({ children: true });
          entry.nodeGfx.delete(node);
        }
      }
    }

    /* ---- Cleanup despawned servers ---- */
    for (const [server, entry] of this.serverMap) {
      if (!liveServers.has(server)) {
        entry.mainGfx.destroy();
        entry.shieldGfx.destroy();
        entry.coreHpGfx.destroy();
        entry.lineGfx?.destroy(); 
        for (const ne of entry.nodeGfx.values()) ne.container.destroy({ children: true });
        this.serverMap.delete(server);
      }
    }

        /* ---- Interaction prompt ---- */
    const menuVisible = state.menuVisible === true;
    let nearInteractive = false;

    if (servers.length > 0) {
      const srv = servers[0];
      const injR2 = EXPLOIT_INJECTION.range * EXPLOIT_INJECTION.range;

      if (!srv.core.broken) {
        const dx = wrapDelta(srv.core.x - player.x, WORLD_W);
        const dy = wrapDelta(srv.core.y - player.y, WORLD_H);
        if (dx * dx + dy * dy < injR2) nearInteractive = true;
      }
      if (!nearInteractive) {
        for (const node of srv.nodes) {
          if (node.broken) continue;
          const dx = wrapDelta(node.x - player.x, WORLD_W);
          const dy = wrapDelta(node.y - player.y, WORLD_H);
          if (dx * dx + dy * dy < injR2) { nearInteractive = true; break; }
        }
      }
    }

    if (menuVisible) {
      this.promptText.visible = false;
    } else if (nearInteractive) {
      this.promptText.text = 'Right-click to interact';
      this.promptText.style.fill = 0xffff00;
      this.promptText.visible = true;
      this.promptText.position.set(cx, cy + 70);
    } else {
      this.promptText.visible = false;
    }
  }

  drawPlayer(player, cx, cy) {
    const g = this.playerGfx;

    // Try image sprite first
    if (this.shipImg) {
      const tex = this.shipTextures.get(this.shipImg);
      if (tex) {
        if (!this._shipSprite) {
          this._shipSprite = new PIXI.Sprite();
          this._shipSprite.anchor.set(0.5);
          this.entityContainer.addChild(this._shipSprite);
        }
        g.clear();
        g.position.set(0, 0);
        this._shipSprite.texture = tex;
        this._shipSprite.visible = true;
        this._shipSprite.width = 40;
        this._shipSprite.height = 40;
        this._shipSprite.position.set(cx, cy);
        this._shipSprite.rotation = player.angle + Math.PI / 2;
        const blink = player.invuln > 0 && Math.floor(player.invuln * 12) % 2;
        this._shipSprite.alpha = blink ? 0.4 : 1;
        return;
      }
    }

    // Fallback: vector triangle
    if (this._shipSprite) this._shipSprite.visible = false;

    g.clear();
    g.moveTo(17, 0).lineTo(-11, 11).lineTo(-6, 0).lineTo(-11, -11).closePath();
    const blink = player.invuln > 0 && Math.floor(player.invuln * 12) % 2;
    g.fill({ color: blink ? this.accentColor : this.shipColor, alpha: blink ? 0.25 : 0.15 });
    g.stroke({ color: blink ? this.accentColor : this.shipColor, width: 2 });
    g.position.set(cx, cy);
    g.rotation = player.angle;
  }

  drawMinimap(player, screen, state) {
    const mw = 170;
    const mh = mw * (WORLD_H / WORLD_W);
    const mx = screen.width  - mw - 14;
    const my = 14;

    const g = this.minimapGfx;
    g.clear();
    g.rect(mx, my, mw, mh)
      .fill({ color: 0x000000, alpha: 0.45 })
      .stroke({ color: 0x26314a, width: 1 });


    // Gate marker (white segment) — shows where to escape
    if (state.gate) {
      const gg = state.gate;
      if (gg.side === 'left' || gg.side === 'right') {
        const gx  = mx + (gg.side === 'left' ? 0 : mw);
        const gy0 = my + (gg.start / WORLD_H) * mh;
        const gy1 = my + (gg.end   / WORLD_H) * mh;
        g.moveTo(gx, gy0).lineTo(gx, gy1).stroke({ color: 0xffffff, width: 2 });
      } else {
        const gy  = my + (gg.side === 'top' ? 0 : mh);
        const gx0 = mx + (gg.start / WORLD_W) * mw;
        const gx1 = mx + (gg.end   / WORLD_W) * mw;
        g.moveTo(gx0, gy).lineTo(gx1, gy).stroke({ color: 0xffffff, width: 2 });
      }
    }

    // Player blip — ship color
    g.rect(
      mx + (player.x / WORLD_W) * mw - 2.5,
      my + (player.y / WORLD_H) * mh - 2.5,
      5, 5,
    ).fill(this.shipColor);
  }
}
