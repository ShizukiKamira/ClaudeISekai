// ---------------------------------------------------------------------------
// Overworld rendering: tiles, decorations, NPCs, item sparkles, player sprite
// ---------------------------------------------------------------------------

// Deterministic per-tile pseudo-random value (stable across frames, unlike
// Math.random) so speckle/texture patterns don't flicker as the camera pans.
function pixelHash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function shadeColor(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

const PX_UNIT = TILE_SIZE / 10;

function drawGrassTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#3f7a3f";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  for (let i = 0; i < 7; i++) {
    const gx = px + Math.floor(pixelHash(tx, ty, i * 2) * 9) * u;
    const gy = py + Math.floor(pixelHash(tx, ty, i * 2 + 1) * 9) * u;
    ctx.fillStyle = i % 2 === 0 ? "#356b35" : "#4d8f4d";
    ctx.fillRect(gx, gy, u, u);
  }
}

function drawTallgrassTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  ctx.fillStyle = "#255c2a";
  for (let i = 0; i < 5; i++) {
    const bx = px + Math.floor(pixelHash(tx, ty, i * 3 + 50) * 8) * u;
    const bh = (2 + Math.floor(pixelHash(tx, ty, i * 3 + 51) * 3)) * u;
    ctx.fillRect(bx, py + TILE_SIZE - bh, u, bh);
  }
  ctx.fillStyle = "#4d9a4d";
  for (let i = 0; i < 4; i++) {
    const bx = px + Math.floor(pixelHash(tx, ty, i * 5 + 80) * 8) * u;
    const bh = (1 + Math.floor(pixelHash(tx, ty, i * 5 + 81) * 3)) * u;
    ctx.fillRect(bx, py + TILE_SIZE - bh, u, bh);
  }
}

function drawWaterTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#2b5f8a";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  const phase = Math.floor(performance.now() / 300) % 4;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let row = 0; row < 3; row++) {
    const ry = py + (2 + row * 3) * u;
    for (let col = 0; col < 10; col++) {
      if ((col + phase + row) % 4 === 0) ctx.fillRect(px + col * u, ry, u, u);
    }
  }
  ctx.fillStyle = "rgba(8,26,44,0.35)";
  ctx.fillRect(px, py, TILE_SIZE, u);
}

function drawRockTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  ctx.fillStyle = "#5f5f58";
  ctx.fillRect(px + 2 * u, py + 3 * u, 6 * u, 5 * u);
  ctx.fillStyle = "#8a8a80";
  ctx.fillRect(px + 3 * u, py + 3 * u, 4 * u, 2 * u);
  ctx.fillStyle = "#3a3a34";
  ctx.fillRect(px + 2 * u, py + 7 * u, 6 * u, u);
  ctx.fillStyle = "#a8a89e";
  ctx.fillRect(px + 3 * u, py + 4 * u, u, u);
}

function drawTreeTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  ctx.fillStyle = "#5c4326";
  ctx.fillRect(px + 4 * u, py + 7 * u, 2 * u, 3 * u);
  ctx.fillStyle = "#1f3d20";
  ctx.fillRect(px + 2 * u, py + 2 * u, 6 * u, 6 * u);
  ctx.fillRect(px + u, py + 3 * u, 8 * u, 4 * u);
  ctx.fillStyle = "#2f5c30";
  ctx.fillRect(px + 3 * u, py + 3 * u, 4 * u, 4 * u);
  ctx.fillStyle = "#4a8a4a";
  ctx.fillRect(px + 3 * u, py + 2 * u, 2 * u, 2 * u);
}

function drawFlowerTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  const petal = pixelHash(tx, ty, 99) < 0.5 ? "#e8c9e0" : "#f2e08a";
  ctx.fillStyle = "#3f8a3f";
  ctx.fillRect(px + 4 * u, py + 5 * u, u, 3 * u);
  ctx.fillStyle = petal;
  ctx.fillRect(px + 2 * u, py + 3 * u, u, u);
  ctx.fillRect(px + 6 * u, py + 3 * u, u, u);
  ctx.fillRect(px + 4 * u, py + 2 * u, u, u);
  ctx.fillRect(px + 4 * u, py + 4 * u, u, u);
  ctx.fillStyle = "#c9a03a";
  ctx.fillRect(px + 4 * u, py + 3 * u, u, u);
}

function drawPathTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#a68a5c";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  for (let i = 0; i < 5; i++) {
    const gx = px + Math.floor(pixelHash(tx, ty, i * 2) * 9) * u;
    const gy = py + Math.floor(pixelHash(tx, ty, i * 2 + 1) * 9) * u;
    ctx.fillStyle = i % 2 === 0 ? "#8a7048" : "#c7a875";
    ctx.fillRect(gx, gy, u, u);
  }
}

function drawShrineTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#3c7a3f";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  const glow = 0.6 + Math.sin(performance.now() / 400) * 0.2;
  ctx.fillStyle = "#5b4a86";
  ctx.fillRect(px + 2 * u, py + 2 * u, 6 * u, 6 * u);
  ctx.save();
  ctx.globalAlpha = glow;
  ctx.fillStyle = "#e8c97a";
  ctx.fillRect(px + 3 * u, py + 3 * u, 4 * u, 4 * u);
  ctx.restore();
  ctx.fillStyle = "#f6d97a";
  ctx.fillRect(px + 4 * u, py + 4 * u, 2 * u, 2 * u);
}

const TILE_DRAWERS = {
  [TILE.GRASS]: drawGrassTile,
  [TILE.TREE]: drawTreeTile,
  [TILE.TALLGRASS]: drawTallgrassTile,
  [TILE.WATER]: drawWaterTile,
  [TILE.PATH]: drawPathTile,
  [TILE.SHRINE]: drawShrineTile,
  [TILE.ROCK]: drawRockTile,
  [TILE.FLOWER]: drawFlowerTile,
};

// Pixel-fantasy corner brackets, dropped onto any UI panel rect to give it a
// carved-frame look without touching that panel's own layout code.
function drawPixelFrameCorners(ctx, x, y, w, h, size, color) {
  ctx.fillStyle = color;
  const s = size, t = Math.max(2, Math.round(size / 3));
  ctx.fillRect(x, y, s, t);
  ctx.fillRect(x, y, t, s);
  ctx.fillRect(x + w - s, y, s, t);
  ctx.fillRect(x + w - t, y, t, s);
  ctx.fillRect(x, y + h - t, s, t);
  ctx.fillRect(x, y + h - s, t, s);
  ctx.fillRect(x + w - s, y + h - t, s, t);
  ctx.fillRect(x + w - t, y + h - s, t, s);
}

function renderMap(ctx, state) {
  const map = state.map;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      const tile = map[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      (TILE_DRAWERS[tile] || drawGrassTile)(ctx, px, py, x, y);
    }
  }

  // Item pickups - rendered with their real icon, gently bobbing
  const t = performance.now() / 300;
  for (const pickup of state.itemPickups) {
    if (pickup.collected) continue;
    const px = pickup.x * TILE_SIZE + TILE_SIZE / 2;
    const py = pickup.y * TILE_SIZE + TILE_SIZE / 2 + Math.sin(t) * 4;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff6c9";
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const iconId = pickup.item === "class_weapon_upgrade" ? "iron_sword" : pickup.item;
    drawItemIcon(ctx, iconId, px, py, TILE_SIZE * 0.7);
  }

  // Placed objects (e.g. campfires, furnaces, bridges the player has built)
  for (const obj of state.placedObjects) {
    drawPlacedObject(ctx, obj);
    if (obj.type === "campfire" && isNearPlayer(state, obj.x, obj.y)) {
      drawInteractPrompt(ctx, obj.x, obj.y);
    } else if (obj.type === "furnace" && isNearPlayer(state, obj.x, obj.y)) {
      drawInteractPrompt(ctx, obj.x, obj.y, "Enter: smelt   Hold: pick up");
    } else if (obj.type === "crafting_table") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8c97a";
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.fillText("Crafting Table", obj.x * TILE_SIZE + TILE_SIZE / 2, obj.y * TILE_SIZE - 4);
      ctx.textAlign = "left";
      if (isNearPlayer(state, obj.x, obj.y)) {
        drawInteractPrompt(ctx, obj.x, obj.y, "Enter: open recipes");
      }
    }
  }

  // Placement preview (ghost) while the player is choosing where to place an item
  if (state.placingItem) {
    const target = facingTile(state.player);
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawPlacedObject(ctx, { type: state.placingItem, x: target.x, y: target.y });
    ctx.restore();
  }

  // NPCs
  for (const npc of state.npcs) {
    drawCharacter(ctx, npc.x * TILE_SIZE, npc.y * TILE_SIZE, npc.color, "down");
    if (npc.shop) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8c97a";
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.fillText(`${npc.name} (Merchant)`, npc.x * TILE_SIZE + TILE_SIZE / 2, npc.y * TILE_SIZE - 4);
      ctx.textAlign = "left";
      if (isNearPlayer(state, npc.x, npc.y)) {
        drawInteractPrompt(ctx, npc.x, npc.y);
      }
    }
  }

  // Field monsters
  for (const monster of state.monsters) {
    drawFieldMonster(ctx, monster);
  }

  // Player
  drawCharacter(ctx, state.player.pixelX, state.player.pixelY, "#f2d9a0", state.player.dir, true, state.player.moving);
  drawPlayerFloatText(ctx, state.player);

  // Live combat visuals: sword swing flash and fireball projectiles
  if (performance.now() - state.player.lastAttackAt < SWING_ANIM_MS) {
    drawSwordSwing(ctx, state.player);
  }
  for (const proj of state.projectiles) {
    drawFireball(ctx, proj);
  }
}

const SWING_FACING_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const SWING_HALF_SPREAD = Math.PI / 3; // 60 degrees either side of facing, spanning the 3-tile hitbox

// A blade sweeping through the facing direction's 3-tile arc, growing over
// SWING_ANIM_MS and fading out as it completes.
function drawSwordSwing(ctx, player) {
  const now = performance.now();
  const t = Math.min(1, (now - player.lastAttackAt) / SWING_ANIM_MS);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const baseAngle = SWING_FACING_ANGLE[player.dir] ?? Math.PI / 2;
  const startAngle = baseAngle - SWING_HALF_SPREAD;
  const sweepAngle = startAngle + t * (SWING_HALF_SPREAD * 2);
  const radius = TILE_SIZE * 1.3;

  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - t * 0.6);
  ctx.strokeStyle = "#f2f2ec";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, sweepAngle);
  ctx.stroke();

  // a fainter inner arc gives the blade some visual thickness
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.75, startAngle, sweepAngle);
  ctx.stroke();
  ctx.restore();
}

function drawPlayerFloatText(ctx, player) {
  const cx = player.pixelX + TILE_SIZE / 2;
  const now = performance.now();
  ctx.textAlign = "center";
  if (player.hpFloatText && now < player.hpFloatText.until) {
    const age = 1 - (player.hpFloatText.until - now) / 700;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = "#7cd68a";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(player.hpFloatText.text, cx, player.pixelY - 20 - age * 14);
    ctx.restore();
  }
  if (player.mpFloatText && now < player.mpFloatText.until) {
    const age = 1 - (player.mpFloatText.until - now) / 700;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = "#4f8dae";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(player.mpFloatText.text, cx, player.pixelY - 36 - age * 14);
    ctx.restore();
  }
  ctx.textAlign = "left";
}

function drawFireball(ctx, proj) {
  ctx.save();
  ctx.fillStyle = "#e8935a";
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6d97a";
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlacedObject(ctx, obj) {
  const px = obj.x * TILE_SIZE;
  const py = obj.y * TILE_SIZE;
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;

  if (obj.type === "bridge") {
    ctx.fillStyle = "#a68a5c";
    ctx.fillRect(px + 2, py + 6, TILE_SIZE - 4, TILE_SIZE - 12);
    ctx.strokeStyle = "#6b4a2f";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 6, TILE_SIZE - 4, TILE_SIZE - 12);
    for (let i = 0; i < 4; i++) {
      const lx = px + 6 + i * 8;
      ctx.beginPath();
      ctx.moveTo(lx, py + 6);
      ctx.lineTo(lx, py + TILE_SIZE - 6);
      ctx.stroke();
    }
    return;
  }

  if (obj.type === "campfire") {
    const glow = 14 + Math.sin(performance.now() / 200) * 3;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#f6a94a";
    ctx.beginPath();
    ctx.arc(cx, cy, glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawItemIcon(ctx, obj.type, cx, cy, TILE_SIZE * 0.85);
}



function isNearPlayer(state, x, y) {
  return chebyshevDist(state.player.tileX, state.player.tileY, x, y) <= 1;
}

function drawInteractPrompt(ctx, tileX, tileY, text = "Press Enter to interact") {
  const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
  const baseY = tileY * TILE_SIZE - 20;
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  const textW = ctx.measureText(text).width;
  const boxW = textW + 14;
  const boxH = 18;
  ctx.fillStyle = "rgba(10,14,12,0.85)";
  ctx.fillRect(cx - boxW / 2, baseY - boxH, boxW, boxH);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - boxW / 2, baseY - boxH, boxW, boxH);
  ctx.fillStyle = "#f2f2ec";
  ctx.textAlign = "center";
  ctx.fillText(text, cx, baseY - 5);
  ctx.textAlign = "left";
}

function drawFieldMonster(ctx, monster) {
  const radius = monster.isBoss ? 18 : 12;
  const flashing = monster.hitFlashUntil && performance.now() < monster.hitFlashUntil;
  drawMonsterSprite(
    ctx,
    monster.pixelX,
    monster.pixelY,
    flashing ? "#f2f2ec" : monster.enemy.color,
    monster.dir,
    radius,
    monster.moving,
    monster.isBoss
  );

  const cx = monster.pixelX + TILE_SIZE / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  const label = monster.isBoss ? monster.enemy.name : `Lv.${monster.enemy.level}`;
  ctx.fillText(label, cx, monster.pixelY - 4);

  const maxHp = monster.enemy.hp;
  const barW = monster.isBoss ? 60 : 32;
  const barY = monster.pixelY - (monster.isBoss ? 30 : 18);
  drawBar(ctx, cx - barW / 2, barY, barW, 5, monster.currentHp / maxHp, monster.isBoss ? "#c94f4f" : "#4fae5a");

  if (monster.alert && !monster.isBoss) {
    ctx.fillStyle = "#e84f4f";
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillText("!", cx, monster.pixelY - 34);
  }

  if (monster.floatText && performance.now() < monster.floatText.until) {
    const remaining = monster.floatText.until - performance.now();
    const age = 1 - remaining / 700;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = "#ffdf7a";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(monster.floatText.text, cx, monster.pixelY - 40 - age * 14);
    ctx.restore();
  }

  ctx.textAlign = "left";
}

// Small pixel-fantasy humanoid, built on an 8x10-unit grid (unit = TILE_SIZE
// / 10) so it reads as a blocky sprite rather than a smooth vector shape.
// A 2-frame leg/arm swap drives the walk cycle whenever `moving` is true.
function drawCharacter(ctx, px, py, color, dir, isPlayer = false, moving = false, radius = 12) {
  const scale = radius / 12;
  const u = Math.max(2, Math.round(PX_UNIT * scale));
  const gw = 8 * u;
  const ox = Math.round(px + (TILE_SIZE - gw) / 2);
  const oy = Math.round(py + (TILE_SIZE - gw) / 2);
  const walkPhase = moving ? Math.floor(performance.now() / 160) % 2 : 0;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(ox + gw / 2, oy + 8 * u + u / 2, u * 3, u, 0, 0, Math.PI * 2);
  ctx.fill();

  const cloth = color;
  const clothDark = shadeColor(color, -35);
  const skin = "#e8b98a";
  const hair = isPlayer ? "#5c3d24" : "#2a2018";

  // legs (one steps long while the other lifts short, and swap each frame)
  const legLongH = 3 * u, legShortH = 2 * u;
  const leftLegH = walkPhase === 1 ? legShortH : legLongH;
  const rightLegH = walkPhase === 1 ? legLongH : legShortH;
  ctx.fillStyle = clothDark;
  ctx.fillRect(ox + 2 * u, oy + 5 * u, 2 * u, leftLegH);
  ctx.fillRect(ox + 4 * u, oy + 5 * u, 2 * u, rightLegH);

  // arms (counter-swing to the legs)
  const armLongH = 2 * u, armShortH = u;
  const leftArmH = walkPhase === 1 ? armLongH : armShortH;
  const rightArmH = walkPhase === 1 ? armShortH : armLongH;
  ctx.fillStyle = cloth;
  ctx.fillRect(ox + u, oy + 2 * u, u, leftArmH);
  ctx.fillRect(ox + 6 * u, oy + 2 * u, u, rightArmH);

  // torso
  ctx.fillStyle = cloth;
  ctx.fillRect(ox + 2 * u, oy + 2 * u, 4 * u, 3 * u);
  ctx.fillStyle = clothDark;
  ctx.fillRect(ox + 2 * u, oy + 4 * u, 4 * u, u);

  // head (back of head only when facing away)
  ctx.fillStyle = dir === "up" ? hair : skin;
  ctx.fillRect(ox + 2 * u, oy + u, 4 * u, u);
  ctx.fillStyle = hair;
  ctx.fillRect(ox + 2 * u, oy, 4 * u, u);

  if (dir !== "up") {
    ctx.fillStyle = "#211a12";
    const eyeSize = Math.max(1, Math.floor(u / 2));
    const eyeY = oy + u + Math.max(1, Math.floor(u / 3));
    if (dir === "left") {
      ctx.fillRect(ox + 2 * u + eyeSize, eyeY, eyeSize, eyeSize);
    } else if (dir === "right") {
      ctx.fillRect(ox + 6 * u - eyeSize * 2, eyeY, eyeSize, eyeSize);
    } else {
      ctx.fillRect(ox + 3 * u - eyeSize, eyeY, eyeSize, eyeSize);
      ctx.fillRect(ox + 5 * u, eyeY, eyeSize, eyeSize);
    }
  }

  ctx.strokeStyle = isPlayer ? "#3a2e17" : "#161616";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 2 * u + 0.5, oy + 0.5, 4 * u - 1, 7 * u - 1);
}

// A blocky pixel "creature" sprite shared by every field monster/boss - a
// rectangular body with highlight/shadow bands and a 2-frame squash-hop
// while it's actively stepping between tiles.
function drawMonsterSprite(ctx, px, py, color, dir, radius, moving, isBoss) {
  const scale = radius / 12;
  const u = Math.max(2, Math.round(PX_UNIT * scale));
  const cx = Math.round(px + TILE_SIZE / 2);
  const baseY = Math.round(py + TILE_SIZE - 2 * u);
  const hop = moving ? Math.floor(performance.now() / 200) % 2 : 0;
  const bodyH = (hop === 1 ? 5 : 6) * u;
  const bodyW = (hop === 1 ? 8 : 6) * u;
  const bodyTop = baseY - bodyH;
  const bodyLeft = Math.round(cx - bodyW / 2);

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY + u / 2, u * 3, u, 0, 0, Math.PI * 2);
  ctx.fill();

  const dark = shadeColor(color, -40);
  const light = shadeColor(color, 35);

  ctx.fillStyle = color;
  ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH);
  ctx.fillStyle = light;
  ctx.fillRect(bodyLeft + u, bodyTop, bodyW - 2 * u, u);
  ctx.fillStyle = dark;
  ctx.fillRect(bodyLeft, bodyTop + bodyH - u, bodyW, u);

  if (dir !== "up") {
    ctx.fillStyle = "#1a1a1a";
    const eyeSize = Math.max(1, Math.floor(u / 2));
    const eyeY = bodyTop + u * 1.5;
    if (dir === "left") {
      ctx.fillRect(Math.round(bodyLeft + bodyW * 0.3), eyeY, eyeSize, eyeSize);
    } else if (dir === "right") {
      ctx.fillRect(Math.round(bodyLeft + bodyW * 0.7 - eyeSize), eyeY, eyeSize, eyeSize);
    } else {
      ctx.fillRect(Math.round(bodyLeft + bodyW * 0.32), eyeY, eyeSize, eyeSize);
      ctx.fillRect(Math.round(bodyLeft + bodyW * 0.68 - eyeSize), eyeY, eyeSize, eyeSize);
    }
  }

  if (isBoss) {
    ctx.fillStyle = dark;
    ctx.fillRect(bodyLeft + u, bodyTop - u, u, u);
    ctx.fillRect(bodyLeft + bodyW - 2 * u, bodyTop - u, u, u);
  }

  ctx.strokeStyle = "#161616";
  ctx.lineWidth = 1;
  ctx.strokeRect(bodyLeft + 0.5, bodyTop + 0.5, bodyW - 1, bodyH - 1);
}

function findNpcAt(state, x, y) {
  return state.npcs.find((n) => n.x === x && n.y === y);
}
