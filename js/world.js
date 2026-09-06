// ---------------------------------------------------------------------------
// Overworld rendering: tiles, decorations, NPCs, item sparkles, player sprite
// ---------------------------------------------------------------------------

const TILE_COLORS = {
  [TILE.GRASS]: "#3c7a3f",
  [TILE.TREE]: "#1f3d20",
  [TILE.TALLGRASS]: "#2f6b34",
  [TILE.WATER]: "#2b5f8a",
  [TILE.PATH]: "#a68a5c",
  [TILE.SHRINE]: "#5b4a86",
  [TILE.ROCK]: "#6b6b63",
  [TILE.FLOWER]: "#4a8a4d",
};

function renderMap(ctx, state) {
  const map = state.map;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      const tile = map[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      ctx.fillStyle = TILE_COLORS[tile] || "#000";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      if (tile === TILE.TREE) {
        ctx.fillStyle = "#2f5c30";
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === TILE.TALLGRASS) {
        ctx.strokeStyle = "#1f4a24";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const gx = px + 6 + i * 8;
          ctx.beginPath();
          ctx.moveTo(gx, py + TILE_SIZE - 4);
          ctx.lineTo(gx + 2, py + TILE_SIZE - 20);
          ctx.stroke();
        }
      } else if (tile === TILE.WATER) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.moveTo(px + 4, py + TILE_SIZE / 2);
        ctx.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE / 2);
        ctx.stroke();
      } else if (tile === TILE.ROCK) {
        ctx.fillStyle = "#8a8a80";
        ctx.beginPath();
        ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === TILE.FLOWER) {
        ctx.fillStyle = "#e8c9e0";
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === TILE.SHRINE) {
        ctx.fillStyle = "#e8c97a";
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Item sparkles
  const t = performance.now() / 300;
  for (const pickup of state.itemPickups) {
    if (pickup.collected) continue;
    const px = pickup.x * TILE_SIZE + TILE_SIZE / 2;
    const py = pickup.y * TILE_SIZE + TILE_SIZE / 2 + Math.sin(t) * 4;
    ctx.fillStyle = "#fff6c9";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8c97a";
    ctx.stroke();
  }

  // Placed objects (e.g. campfires the player has built)
  for (const obj of state.placedObjects) {
    drawPlacedObject(ctx, obj);
  }

  // Placement preview (ghost) while the player is choosing where to place an item
  if (state.placingItem) {
    const target = facingTile(state.player);
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawPlacedObject(ctx, { type: state.placingItem, x: target.x, y: target.y });
    ctx.restore();
  }

  // Bed
  drawBed(ctx, state);

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
  drawCharacter(ctx, state.player.pixelX, state.player.pixelY, "#f2d9a0", state.player.dir, true);
}

function drawPlacedObject(ctx, obj) {
  const cx = obj.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = obj.y * TILE_SIZE + TILE_SIZE / 2;
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

function drawBed(ctx, state) {
  const bx = BED.x * TILE_SIZE;
  const by = BED.y * TILE_SIZE;
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(bx + 4, by + 8, TILE_SIZE - 8, TILE_SIZE - 12);
  ctx.fillStyle = "#e8c9e0";
  ctx.fillRect(bx + 6, by + 10, TILE_SIZE - 12, 12);
  ctx.fillStyle = "#f2f2ec";
  ctx.fillRect(bx + 6, by + 10, 8, 12);
  ctx.strokeStyle = "#3a2e17";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 4, by + 8, TILE_SIZE - 8, TILE_SIZE - 12);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.fillText("Bed", bx + TILE_SIZE / 2, by - 4);
  ctx.textAlign = "left";

  if (isNearPlayer(state, BED.x, BED.y)) {
    drawInteractPrompt(ctx, BED.x, BED.y);
  }
}

function isNearPlayer(state, x, y) {
  return chebyshevDist(state.player.tileX, state.player.tileY, x, y) <= 1;
}

function drawInteractPrompt(ctx, tileX, tileY) {
  const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
  const baseY = tileY * TILE_SIZE - 20;
  const text = "Press Enter to interact";
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
  drawCharacter(ctx, monster.pixelX, monster.pixelY, monster.enemy.color, monster.dir, false);

  const cx = monster.pixelX + TILE_SIZE / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.fillText(`Lv.${monster.enemy.level}`, cx, monster.pixelY - 4);

  if (monster.alert) {
    ctx.fillStyle = "#e84f4f";
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillText("!", cx, monster.pixelY - 18);
  }
  ctx.textAlign = "left";
}

function drawCharacter(ctx, px, py, color, dir, isPlayer = false) {
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, py + TILE_SIZE - 6, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  // outline
  ctx.strokeStyle = isPlayer ? "#3a2e17" : "#111";
  ctx.lineWidth = 2;
  ctx.stroke();

  // facing indicator
  ctx.fillStyle = "#111";
  const offsets = {
    up: [0, -6],
    down: [0, 6],
    left: [-6, 0],
    right: [6, 0],
  };
  const [ox, oy] = offsets[dir] || offsets.down;
  ctx.beginPath();
  ctx.arc(cx + ox, cy + oy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function findNpcAt(state, x, y) {
  return state.npcs.find((n) => n.x === x && n.y === y);
}
