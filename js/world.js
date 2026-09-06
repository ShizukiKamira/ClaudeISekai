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
  drawCharacter(ctx, state.player.pixelX, state.player.pixelY, "#f2d9a0", state.player.dir, true);

  // Live combat visuals: sword swing flash and fireball projectiles
  if (state.player.class === "swordsman" && performance.now() - state.player.lastAttackAt < 200) {
    drawSwordSwing(ctx, state.player);
  }
  for (const proj of state.projectiles) {
    drawFireball(ctx, proj);
  }
}

function drawSwordSwing(ctx, player) {
  const cx = player.pixelX + TILE_SIZE / 2;
  const cy = player.pixelY + TILE_SIZE / 2;
  const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const [dx, dy] = offsets[player.dir] || offsets.down;
  const swingCx = cx + dx * TILE_SIZE * 0.6;
  const swingCy = cy + dy * TILE_SIZE * 0.6;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = "#f2f2ec";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(swingCx, swingCy, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
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
  drawCharacter(ctx, monster.pixelX, monster.pixelY, flashing ? "#f2f2ec" : monster.enemy.color, monster.dir, false, radius);

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

function drawCharacter(ctx, px, py, color, dir, isPlayer = false, radius = 12) {
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, py + TILE_SIZE - 6, radius, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // outline
  ctx.strokeStyle = isPlayer ? "#3a2e17" : "#111";
  ctx.lineWidth = 2;
  ctx.stroke();

  // facing indicator
  ctx.fillStyle = "#111";
  const off = radius * 0.5;
  const offsets = {
    up: [0, -off],
    down: [0, off],
    left: [-off, 0],
    right: [off, 0],
  };
  const [ox, oy] = offsets[dir] || offsets.down;
  ctx.beginPath();
  ctx.arc(cx + ox, cy + oy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function findNpcAt(state, x, y) {
  return state.npcs.find((n) => n.x === x && n.y === y);
}
