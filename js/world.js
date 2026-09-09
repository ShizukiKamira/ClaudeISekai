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

function drawHerbTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  ctx.fillStyle = "#2f6b32";
  ctx.fillRect(px + 3 * u, py + 4 * u, u, 3 * u);
  ctx.fillRect(px + 5 * u, py + 3 * u, u, 4 * u);
  ctx.fillStyle = "#4d9a4d";
  ctx.fillRect(px + 2 * u, py + 3 * u, u, 2 * u);
  ctx.fillRect(px + 4 * u, py + 2 * u, u, 2 * u);
  ctx.fillRect(px + 6 * u, py + 3 * u, u, 2 * u);
  ctx.fillStyle = "#c9534f";
  ctx.fillRect(px + 3 * u, py + 4 * u, u, u);
  ctx.fillRect(px + 5 * u, py + 5 * u, u, u);
}

function drawMoonleafTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  const glow = 0.55 + Math.sin(performance.now() / 500 + tx * 0.7 + ty * 0.3) * 0.2;
  ctx.fillStyle = "#3a5c4a";
  ctx.fillRect(px + 4 * u, py + 5 * u, u, 3 * u);
  ctx.save();
  ctx.globalAlpha = glow;
  ctx.fillStyle = "#cfe8e0";
  ctx.fillRect(px + 2 * u, py + 3 * u, 2 * u, 2 * u);
  ctx.fillRect(px + 5 * u, py + 2 * u, 2 * u, 2 * u);
  ctx.fillRect(px + 3 * u, py + 5 * u, 2 * u, 2 * u);
  ctx.restore();
  ctx.fillStyle = "#eaf6f2";
  ctx.fillRect(px + 4 * u, py + 4 * u, u, u);
}

function drawRoofTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#7a3a2a";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  for (let row = 0; row < 5; row++) {
    ctx.fillStyle = row % 2 === 0 ? "#8a4632" : "#6b2f22";
    ctx.fillRect(px, py + row * 2 * u, TILE_SIZE, u);
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(px, py, TILE_SIZE, u);
}

function drawWallTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  for (let row = 0; row < 5; row++) {
    ctx.fillStyle = row % 2 === 0 ? "#7a5636" : "#5c4326";
    ctx.fillRect(px, py + row * 2 * u, TILE_SIZE, 2 * u);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(px, py + row * 2 * u + 2 * u - 1, TILE_SIZE, 1);
  }
  // Roughly every third wall tile gets a small shuttered window for detail.
  if (pixelHash(tx, ty, 200) < 0.3) {
    ctx.fillStyle = "#2a3a3f";
    ctx.fillRect(px + 3 * u, py + 3 * u, 4 * u, 3 * u);
    ctx.fillStyle = "#4a6a72";
    ctx.fillRect(px + 3 * u, py + 3 * u, 4 * u, u);
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 3 * u + 0.5, py + 3 * u + 0.5, 4 * u - 1, 3 * u - 1);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
}

function drawDoorTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(px + u, py + u, 8 * u, 9 * u);
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(px + 2 * u, py + 2 * u, 3 * u, 3 * u);
  ctx.fillRect(px + 5 * u, py + 2 * u, 3 * u, 3 * u);
  ctx.fillRect(px + 2 * u, py + 6 * u, 3 * u, 3 * u);
  ctx.fillRect(px + 5 * u, py + 6 * u, 3 * u, 3 * u);
  ctx.fillStyle = "#e8c97a";
  ctx.fillRect(px + 7 * u, py + 5 * u, u, u);
  ctx.strokeStyle = "#2a1a0f";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + u + 0.5, py + u + 0.5, 8 * u - 1, 9 * u - 1);
}

function drawFloorTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#7a5c3e";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  const plank = (tx + ty) % 2 === 0;
  ctx.fillStyle = plank ? "#835f3f" : "#6f5236";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(px, py + i * (TILE_SIZE / 4));
    ctx.lineTo(px + TILE_SIZE, py + i * (TILE_SIZE / 4));
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.moveTo(px + TILE_SIZE / 2, py);
  ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const kx = px + Math.floor(pixelHash(tx, ty, i * 4) * 8) * u;
    const ky = py + Math.floor(pixelHash(tx, ty, i * 4 + 1) * 8) * u;
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(kx, ky, u, u);
  }
}

function drawBushTile(ctx, px, py, tx, ty) {
  drawGrassTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  ctx.fillStyle = "#255c2a";
  ctx.beginPath();
  ctx.ellipse(px + 5 * u, py + 6 * u, 4.4 * u, 3.2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f8a3f";
  ctx.beginPath();
  ctx.ellipse(px + 3.4 * u, py + 5 * u, 2.6 * u, 2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px + 6.6 * u, py + 5 * u, 2.6 * u, 2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4d9a4d";
  ctx.beginPath();
  ctx.ellipse(px + 5 * u, py + 4 * u, 2.8 * u, 2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8e3f6e";
  for (const [dx, dy] of [[-0.7, 0.1], [0.7, -0.2], [0, 0.5], [1.4, 0.4], [-1.4, 0.4]]) {
    ctx.beginPath();
    ctx.arc(px + (5 + dx) * u, py + (5 + dy) * u, 0.5 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSandTile(ctx, px, py, tx, ty) {
  ctx.fillStyle = "#d8c58a";
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const u = PX_UNIT;
  for (let i = 0; i < 8; i++) {
    const gx = px + Math.floor(pixelHash(tx, ty, i * 2) * 9) * u;
    const gy = py + Math.floor(pixelHash(tx, ty, i * 2 + 1) * 9) * u;
    ctx.fillStyle = i % 2 === 0 ? "#c9b06a" : "#e8d9a8";
    ctx.fillRect(gx, gy, u, u);
  }
}

function drawRugTile(ctx, px, py, tx, ty) {
  drawFloorTile(ctx, px, py, tx, ty);
  const u = PX_UNIT;
  ctx.fillStyle = "#8e3f3f";
  ctx.fillRect(px + u, py + u, 8 * u, 8 * u);
  ctx.fillStyle = "#a8524f";
  ctx.fillRect(px + 2 * u, py + 2 * u, 6 * u, 6 * u);
  ctx.fillStyle = "#c97a4a";
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 2.5 * u, py + 2.5 * u, 5 * u, 5 * u);
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
  [TILE.HERB]: drawHerbTile,
  [TILE.MOONLEAF]: drawMoonleafTile,
  [TILE.ROOF]: drawRoofTile,
  [TILE.WALL]: drawWallTile,
  [TILE.DOOR]: drawDoorTile,
  [TILE.FLOOR]: drawFloorTile,
  [TILE.RUG]: drawRugTile,
  [TILE.BUSH]: drawBushTile,
  [TILE.SAND]: drawSandTile,
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
    } else if (obj.type === "basic_trap") {
      if (obj.loaded) {
        ctx.fillStyle = "#e84f4f";
        ctx.font = "bold 20px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", obj.x * TILE_SIZE + TILE_SIZE / 2, obj.y * TILE_SIZE - 12);
        ctx.textAlign = "left";
      }
      if (isNearPlayer(state, obj.x, obj.y)) {
        drawInteractPrompt(ctx, obj.x, obj.y, obj.loaded ? "Enter: collect catch" : "Enter: check trap");
      }
    } else if (obj.type === "chest" && obj.contents && isNearPlayer(state, obj.x, obj.y)) {
      drawInteractPrompt(ctx, obj.x, obj.y, "Enter: open chest");
    }
  }

  // Forage popup for any bush/herb/moonleaf/sand tile within reach of the
  // player - clickable, and identical in effect to the facing+Enter gather.
  state.uiHitboxes.forageButtons = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = state.player.tileX + dx;
      const ty = state.player.tileY + dy;
      if (map[ty] && FORAGE_SOURCES[map[ty][tx]]) {
        const rect = drawForagePrompt(ctx, tx, ty);
        // renderMap draws inside a translate(-Camera.x, -Camera.y), so the
        // rect above is in world space - convert to canvas/screen space to
        // match Input.clickPos for hit-testing next frame.
        state.uiHitboxes.forageButtons.push({
          tileX: tx,
          tileY: ty,
          x: rect.x - Camera.x,
          y: rect.y - Camera.y,
          w: rect.w,
          h: rect.h,
        });
      }
    }
  }

  // Door label - persistent, like the crafting table's, so it reads clearly
  // from a distance rather than only when the player is standing next to it.
  if (state.location === "home") {
    drawDoorLabel(ctx, HOME_DOOR.x, HOME_DOOR.y, "Exit");
  } else if (map[HOME_EXTERIOR.doorY] && map[HOME_EXTERIOR.doorY][HOME_EXTERIOR.doorX] === TILE.DOOR) {
    drawDoorLabel(ctx, HOME_EXTERIOR.doorX, HOME_EXTERIOR.doorY, "Your Cabin");
  }

  // Placement preview (ghost) while the player is choosing where to place an
  // item - it follows the mouse cursor rather than only the facing tile, and
  // is tinted green/red to show whether the hovered tile is a legal spot.
  if (state.placingItem) {
    const target = state.placeHoverTile || facingTile(state.player);
    const inRange = chebyshevDist(target.x, target.y, state.player.tileX, state.player.tileY) <= PLACEMENT_RANGE;
    const valid = inRange && canPlaceItemAt(state, state.placingItem, target.x, target.y);
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawPlacedObject(ctx, { type: state.placingItem, x: target.x, y: target.y });
    ctx.restore();
    ctx.strokeStyle = valid ? "#7cd68a" : "#e84f4f";
    ctx.lineWidth = 2;
    ctx.strokeRect(target.x * TILE_SIZE + 1, target.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
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

  // Rabbits - harmless, no HP bar or level, just a small critter sprite
  for (const animal of state.animals) {
    drawRabbit(ctx, animal);
  }

  // Forage bursts - a brief sparkle where a bush/herb/sand patch just gave
  // up its loot
  const nowFx = performance.now();
  state.forageEffects = state.forageEffects.filter((fx) => nowFx - fx.startedAt < FORAGE_BURST_MS);
  for (const fx of state.forageEffects) {
    const t = (nowFx - fx.startedAt) / FORAGE_BURST_MS;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const r = 6 + t * 16;
      ctx.beginPath();
      ctx.moveTo(fx.x + Math.cos(angle) * r, fx.y + Math.sin(angle) * r);
      ctx.lineTo(fx.x + Math.cos(angle) * (r + 5), fx.y + Math.sin(angle) * (r + 5));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Monster/rabbit corpses - hold their item drops until looted
  state.uiHitboxes.lootButtons = [];
  state.uiHitboxes.corpseHitboxes = [];
  for (const corpse of state.corpses) {
    drawCorpse(ctx, state, corpse);
  }

  // Player
  drawCharacter(ctx, state.player.pixelX, state.player.pixelY, "#f2d9a0", dir8To4(state.player.dir), true, state.player.moving);
  if (state.player.dash) drawDashStreak(ctx, state.player);
  drawPlayerFloatText(ctx, state.player);

  // Live combat visuals: melee swing, fireball cast glow, and projectiles.
  // The equipped weapon is always visible at rest, and swaps for the swing
  // animation itself while one is actively playing.
  const now = performance.now();
  const swinging = now - state.player.lastAttackAt < meleeAnimDuration(state.player.meleeAnimKind);
  if (swinging) {
    drawMeleeSwing(ctx, state.player);
  } else {
    drawWeaponInHand(ctx, state.player);
  }
  if (now - state.player.lastCastAt < CAST_ANIM_MS) {
    drawCastAnimation(ctx, state.player);
  }
  if (state.player.toolSwingType && now - state.player.lastToolSwingAt < TOOL_SWING_ANIM_MS) {
    drawToolSwing(ctx, state.player);
  }
  for (const proj of state.projectiles) {
    drawFireball(ctx, proj);
  }

  if (state.fishing.active && state.fishing.phase !== "minigame") {
    drawFishingLine(ctx, state);
  }

  // "Press F to fish" prompt while facing water with a Fishing Rod and not
  // already fishing.
  if (!state.fishing.active && hasItem(state, "fishing_rod")) {
    const target = facingTile(state.player);
    const facingTileType = map[target.y] && map[target.y][target.x];
    if (facingTileType === TILE.WATER) {
      drawInteractPrompt(ctx, target.x, target.y, "Press F to fish");
    }
  }
}

// The line arcs out from the player toward the water tile during "casting",
// then holds still with a floating bobber; during "bite" the bobber dips
// and a red "!" appears, the player's cue to click or press F.
function drawFishingLine(ctx, state) {
  const f = state.fishing;
  const now = performance.now();
  const player = state.player;
  const rodX = player.pixelX + TILE_SIZE / 2;
  const rodY = player.pixelY + TILE_SIZE / 2 - 6;
  const waterX = f.targetX * TILE_SIZE + TILE_SIZE / 2;
  const waterY = f.targetY * TILE_SIZE + TILE_SIZE / 2;

  let bobberX, bobberY;
  if (f.phase === "casting") {
    const t = Math.min(1, (now - f.phaseStartedAt) / FISH_CAST_MS);
    bobberX = rodX + (waterX - rodX) * t;
    bobberY = rodY + (waterY - rodY) * t - Math.sin(t * Math.PI) * 18; // little arc
  } else {
    bobberX = waterX;
    bobberY = waterY + Math.sin(now / 260) * 2;
  }

  ctx.strokeStyle = "rgba(240,240,235,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rodX, rodY);
  ctx.lineTo(bobberX, bobberY);
  ctx.stroke();

  ctx.fillStyle = "#e84f4f";
  ctx.beginPath();
  ctx.arc(bobberX, bobberY - 4, 4, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#f2f2ec";
  ctx.beginPath();
  ctx.arc(bobberX, bobberY, 4, 0, Math.PI);
  ctx.fill();
}

// The minigame overlay: hold Up/Down (or W/S) to move the green catch-box
// and keep the drifting fish icon inside it - drawn as a fixed HUD panel
// (called from main.js's render(), outside the world's camera translate)
// rather than anchored to the water tile, so it stays legible and fixed on
// screen regardless of where the player is standing.
function drawFishingMinigame(ctx, state) {
  const f = state.fishing;
  const barH = FISH_MINIGAME_BAR_HEIGHT, barW = 46;
  const x = canvas.width - 90, y = (canvas.height - barH) / 2;

  ctx.fillStyle = "rgba(10,14,12,0.85)";
  ctx.fillRect(x, y, barW, barH);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  const boxH = FISH_MINIGAME_BOX_HEIGHT_FRAC * barH;
  const boxY = y + f.boxPos * barH - boxH / 2;
  ctx.fillStyle = "rgba(124,214,138,0.35)";
  ctx.fillRect(x + 2, boxY, barW - 4, boxH);
  ctx.strokeStyle = "#7cd68a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, boxY, barW - 4, boxH);

  const fishY = y + f.fishPos * barH;
  drawFishIcon(ctx, x + barW / 2, fishY, 18, "#4a7a9a");

  const meterX = x - 16;
  ctx.fillStyle = "#222";
  ctx.fillRect(meterX, y, 8, barH);
  ctx.fillStyle = "#e8c97a";
  const fillH = barH * f.progress;
  ctx.fillRect(meterX, y + barH - fillH, 8, fillH);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX, y, 8, barH);

  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Up/Down:", x + barW / 2, y - 22);
  ctx.fillText("move box", x + barW / 2, y - 10);
  ctx.fillText("Keep the fish", x + barW / 2, y + barH + 16);
  ctx.fillText("inside! (Esc: reel in)", x + barW / 2, y + barH + 30);
  ctx.textAlign = "left";
}

const SWING_HALF_SPREAD = Math.PI / 3; // 60 degrees either side of facing, spanning the melee cone

// Fast start, gentle settle - reused across every combat animation below so
// swings/thrusts/casts all share the same "snappy but not linear" feel.
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function meleeAnimDuration(kind) {
  if (kind === "staff") return STAFF_SWING_ANIM_MS;
  if (kind === "fists") return FIST_SWING_ANIM_MS;
  return SWING_ANIM_MS;
}

// Dispatches to the animation matching whatever the player swung with -
// a swordsman's blade, a mage's staff, or a bare-handed jab all read as
// distinct motions rather than one generic "attack flash".
function drawMeleeSwing(ctx, player) {
  if (player.meleeAnimKind === "staff") drawStaffSwing(ctx, player);
  else if (player.meleeAnimKind === "fists") drawFistSwing(ctx, player);
  else drawBladeSwing(ctx, player);
}

// A blade sweeping through the facing direction's 3-tile arc, the sword
// itself visibly riding along the sweep's leading edge, easing out into
// its follow-through rather than moving at a flat, linear rate.
function drawBladeSwing(ctx, player) {
  const now = performance.now();
  const tLinear = Math.min(1, (now - player.lastAttackAt) / SWING_ANIM_MS);
  const t = easeOutCubic(tLinear);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const baseAngle = player.facingAngle;
  const startAngle = baseAngle - SWING_HALF_SPREAD;
  const sweepAngle = startAngle + t * (SWING_HALF_SPREAD * 2);
  const radius = TILE_SIZE * 1.3;

  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - tLinear * 0.6);
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

  // the actual sword, carried at the tip of the sweep so the equipped
  // weapon is what's visibly doing the cutting
  const tipX = cx + Math.cos(sweepAngle) * radius * 0.85;
  const tipY = cy + Math.sin(sweepAngle) * radius * 0.85;
  ctx.save();
  ctx.globalAlpha = 1 - tLinear * 0.3;
  ctx.translate(tipX, tipY);
  ctx.rotate(sweepAngle + Math.PI / 4);
  const kind = getWeaponKind(player);
  if (kind === "dagger") drawDaggerIcon(ctx, 0, 0, TILE_SIZE * 0.75);
  else drawSwordIcon(ctx, 0, 0, TILE_SIZE * 0.85);
  ctx.restore();
}

// A staff doesn't slash - it's swung/thrust like a quarterstaff, lunging
// forward and snapping back, with a small impact spark at full extension.
function drawStaffSwing(ctx, player) {
  const now = performance.now();
  const tLinear = Math.min(1, (now - player.lastAttackAt) / STAFF_SWING_ANIM_MS);
  const t = easeOutCubic(tLinear);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const angle = player.facingAngle;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const lunge = Math.sin(t * Math.PI) * TILE_SIZE * 0.7;
  const tipX = cx + dx * (TILE_SIZE * 0.25 + lunge);
  const tipY = cy + dy * (TILE_SIZE * 0.25 + lunge);
  const swingAngle = angle + Math.PI / 2 + (t - 0.5) * 0.8;

  ctx.save();
  ctx.globalAlpha = 1 - tLinear * 0.25;
  ctx.translate(tipX, tipY);
  ctx.rotate(swingAngle);
  drawStaffIcon(ctx, 0, 0, TILE_SIZE * 0.9, staffGemColor(player.weapon));
  ctx.restore();

  if (t > 0.6) {
    const sparkT = (t - 0.6) / 0.4;
    ctx.save();
    ctx.globalAlpha = (1 - sparkT) * 0.8;
    ctx.fillStyle = "#c9b8f0";
    ctx.beginPath();
    ctx.arc(tipX, tipY, TILE_SIZE * 0.18 * sparkT, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Barehanded: a quick, small jab with no weapon icon - fast and unarmed.
function drawFistSwing(ctx, player) {
  const now = performance.now();
  const tLinear = Math.min(1, (now - player.lastAttackAt) / FIST_SWING_ANIM_MS);
  const t = easeOutCubic(tLinear);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const dx = Math.cos(player.facingAngle), dy = Math.sin(player.facingAngle);
  const lunge = Math.sin(t * Math.PI) * TILE_SIZE * 0.35;
  const fx = cx + dx * (TILE_SIZE * 0.3 + lunge);
  const fy = cy + dy * (TILE_SIZE * 0.3 + lunge);

  ctx.save();
  ctx.globalAlpha = 1 - tLinear * 0.3;
  ctx.fillStyle = "#e8b98a";
  ctx.strokeStyle = "#8a6248";
  ctx.lineWidth = 1;
  const s = TILE_SIZE * 0.22;
  ctx.fillRect(fx - s / 2, fy - s / 2, s, s);
  ctx.strokeRect(fx - s / 2, fy - s / 2, s, s);
  ctx.restore();
}

// The axe/pickaxe lunges forward toward the tile being worked and eases
// back, growing then shrinking over TOOL_SWING_ANIM_MS.
function drawToolSwing(ctx, player) {
  const now = performance.now();
  const t = Math.min(1, (now - player.lastToolSwingAt) / TOOL_SWING_ANIM_MS);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const angle = player.facingAngle;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const lunge = Math.sin(t * Math.PI) * TILE_SIZE * 0.55;
  const iconX = cx + dx * (TILE_SIZE * 0.25 + lunge);
  const iconY = cy + dy * (TILE_SIZE * 0.25 + lunge);
  const swingAngle = angle + Math.PI / 2 + (t - 0.5) * 1.2;

  ctx.save();
  ctx.globalAlpha = 1 - t * 0.3;
  ctx.translate(iconX, iconY);
  ctx.rotate(swingAngle);
  if (player.toolSwingType === "pickaxe") {
    drawPickaxeIcon(ctx, 0, 0, TILE_SIZE * 0.8);
  } else {
    drawAxeIcon(ctx, 0, 0, TILE_SIZE * 0.8);
  }
  ctx.restore();
}

function staffGemColor(weaponId) {
  return weaponId === "wooden_staff" ? "#7aa9c9" : "#8e6fce";
}

// The equipped weapon carried at rest, whenever no swing animation is
// currently playing - a swordsman visibly carries their sword, a mage
// their staff, so the loadout reads at a glance even outside combat.
function drawWeaponInHand(ctx, player) {
  const kind = getWeaponKind(player);
  if (!kind) return;
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  // Carried slightly forward of center and off to one side, rotating with
  // the player's continuous facing angle so it reads correctly on diagonals.
  const angle = player.facingAngle;
  const fx = Math.cos(angle), fy = Math.sin(angle);
  const perpX = -fy, perpY = fx;
  const hx = cx + fx * TILE_SIZE * 0.16 + perpX * TILE_SIZE * 0.3;
  const hy = cy + fy * TILE_SIZE * 0.16 + perpY * TILE_SIZE * 0.3;
  if (kind === "staff") {
    drawStaffIcon(ctx, hx, hy, TILE_SIZE * 0.85, staffGemColor(player.weapon));
  } else if (kind === "dagger") {
    drawDaggerIcon(ctx, hx, hy, TILE_SIZE * 0.55);
  } else {
    drawSwordIcon(ctx, hx, hy, TILE_SIZE * 0.7);
  }
}

// Dispatches the fireball cast glow to a staff channel or a barehanded
// conjuring gesture, matching drawWeaponInHand/drawMeleeSwing's logic: only
// an actual staff channels magic, a sword equipped instead falls back to hands.
function drawCastAnimation(ctx, player) {
  if (player.castAnimKind === "staff") drawStaffCast(ctx, player);
  else drawHandsCast(ctx, player);
}

// The staff is raised toward the cast direction while a glowing orb charges
// and releases at its tip.
function drawStaffCast(ctx, player) {
  const now = performance.now();
  const tLinear = Math.min(1, (now - player.lastCastAt) / CAST_ANIM_MS);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const dx = Math.cos(player.facingAngle), dy = Math.sin(player.facingAngle);
  const tipX = cx + dx * TILE_SIZE * 0.5;
  const tipY = cy + dy * TILE_SIZE * 0.5 - TILE_SIZE * 0.35;

  ctx.save();
  ctx.globalAlpha = 1 - tLinear * 0.2;
  drawStaffIcon(ctx, tipX, tipY, TILE_SIZE * 0.9, staffGemColor(player.weapon));
  ctx.restore();

  drawCastGlow(ctx, tipX, tipY - TILE_SIZE * 0.1, tLinear);
}

// Barehanded (or a blade instead of a staff): two hands cup a glowing orb
// that charges and releases in front of the caster.
function drawHandsCast(ctx, player) {
  const now = performance.now();
  const tLinear = Math.min(1, (now - player.lastCastAt) / CAST_ANIM_MS);
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const dx = Math.cos(player.facingAngle), dy = Math.sin(player.facingAngle);
  const ox = cx + dx * TILE_SIZE * 0.42;
  const oy = cy + dy * TILE_SIZE * 0.42 - TILE_SIZE * 0.05;
  const perpX = dy, perpY = -dx;
  const spread = TILE_SIZE * (0.22 - tLinear * 0.1);

  ctx.save();
  ctx.globalAlpha = 1 - tLinear * 0.2;
  ctx.fillStyle = "#e8b98a";
  const hs = TILE_SIZE * 0.16;
  ctx.beginPath();
  ctx.arc(ox + perpX * spread, oy + perpY * spread, hs / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ox - perpX * spread, oy - perpY * spread, hs / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawCastGlow(ctx, ox, oy, tLinear);
}

// Shared glow orb: grows then fades over the cast animation's course.
function drawCastGlow(ctx, x, y, tLinear) {
  const glowT = Math.sin(Math.min(1, tLinear) * Math.PI);
  const radius = TILE_SIZE * (0.1 + glowT * 0.22);
  ctx.save();
  ctx.globalAlpha = 0.5 * glowT + 0.15;
  ctx.fillStyle = "#e8935a";
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85 * glowT + 0.15;
  ctx.fillStyle = "#f6d97a";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A trail of fading afterimages behind the player while a dash is animating,
// so the fast (but non-instant) motion reads clearly.
function drawDashStreak(ctx, player) {
  const d = player.dash;
  const t = Math.min(1, (performance.now() - d.startedAt) / DASH_DURATION_MS);
  for (let i = 1; i <= 3; i++) {
    const backT = Math.max(0, t - i * 0.12);
    const ex = easeOutCubic(backT);
    const gx = d.fromX + (d.toX - d.fromX) * ex;
    const gy = d.fromY + (d.toY - d.fromY) * ex;
    ctx.save();
    ctx.globalAlpha = 0.22 * (1 - i / 4);
    ctx.fillStyle = "#e8c97a";
    ctx.fillRect(gx + TILE_SIZE * 0.2, gy + TILE_SIZE * 0.15, TILE_SIZE * 0.6, TILE_SIZE * 0.7);
    ctx.restore();
  }
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

function drawDoorLabel(ctx, tileX, tileY, text) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.fillText(text, tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE - 4);
  ctx.textAlign = "left";
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

  if (obj.type === "campfire" || obj.type === "fireplace") {
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

// Like drawInteractPrompt, but returns its own rect (in the same world-space
// coordinates it drew in) so renderMap can convert it to a clickable hitbox.
function drawForagePrompt(ctx, tileX, tileY) {
  const text = "Forage";
  const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
  const baseY = tileY * TILE_SIZE - 20;
  ctx.font = "bold 12px 'Segoe UI', sans-serif";
  const textW = ctx.measureText(text).width;
  const boxW = textW + 20;
  const boxH = 20;
  const bx = cx - boxW / 2;
  const by = baseY - boxH;
  ctx.fillStyle = "rgba(37,92,42,0.9)";
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = "#9adf7a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.fillStyle = "#f2f2ec";
  ctx.textAlign = "center";
  ctx.fillText(text, cx, by + boxH - 6);
  ctx.textAlign = "left";
  return { x: bx, y: by, w: boxW, h: boxH };
}

function drawFieldMonster(ctx, monster) {
  const radius = monster.isBoss ? 18 : 12;
  const flashing = monster.hitFlashUntil && performance.now() < monster.hitFlashUntil;
  drawMonsterSprite(
    ctx,
    monster.pixelX,
    monster.pixelY,
    flashing ? "#f2f2ec" : monster.enemy.color,
    dir8To4(monster.dir),
    radius,
    monster.moving,
    monster.isBoss
  );

  const cx = monster.pixelX + TILE_SIZE / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.font = monster.isBoss ? "bold 11px 'Segoe UI', sans-serif" : "bold 10px 'Segoe UI', sans-serif";
  const label = monster.isBoss ? monster.enemy.name : `${monster.enemy.name} Lv.${monster.enemy.level}`;
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

  if (monster.slowedUntil && performance.now() < monster.slowedUntil) {
    drawSlowIcon(ctx, monster.pixelX + TILE_SIZE - 6, monster.pixelY + 6, 16);
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

// A rabbit is just a small tan critter sprite - no HP bar, level, or alert
// icon, since it never fights back and can only be caught via a trap.
function drawRabbit(ctx, animal) {
  const flashing = animal.hitFlashUntil && performance.now() < animal.hitFlashUntil;
  drawMonsterSprite(ctx, animal.pixelX, animal.pixelY, flashing ? "#f2f2ec" : "#cbb89a", dir8To4(animal.dir), 9, animal.moving, false);
  const u = PX_UNIT;
  const baseY = Math.round(animal.pixelY + TILE_SIZE - 2 * u);
  const cx = Math.round(animal.pixelX + TILE_SIZE / 2);
  ctx.fillStyle = "#cbb89a";
  ctx.fillRect(cx - 3 * u, baseY - 9 * u, u, 3 * u);
  ctx.fillRect(cx + 2 * u, baseY - 9 * u, u, 3 * u);
  ctx.fillStyle = "#e8d9c5";
  ctx.fillRect(cx - 3 * u, baseY - 9 * u, u, u);
  ctx.fillRect(cx + 2 * u, baseY - 9 * u, u, u);

  // A small HP bar, same idea as a field monster's but scaled down - only
  // shown once it's taken a hit, so an unharmed rabbit stays uncluttered.
  const maxHp = RABBIT_MAX_HP;
  if (animal.currentHp != null && animal.currentHp < maxHp) {
    const barW = 22;
    drawBar(ctx, cx - barW / 2, animal.pixelY - 12, barW, 4, animal.currentHp / maxHp, "#4fae5a");
  }

  if (animal.floatText && performance.now() < animal.floatText.until) {
    const remaining = animal.floatText.until - performance.now();
    const age = 1 - remaining / 700;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = "#ffdf7a";
    ctx.font = "bold 12px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(animal.floatText.text, cx, animal.pixelY - 18 - age * 12);
    ctx.textAlign = "left";
    ctx.restore();
  }
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
