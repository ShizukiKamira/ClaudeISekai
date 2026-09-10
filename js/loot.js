// ---------------------------------------------------------------------------
// Monster corpses: a defeated monster/rabbit drops its item loot as a corpse
// in the world rather than straight into the inventory. A "Loot" popup near
// it loots everything at once (Space, or click the popup); clicking the
// corpse itself opens a panel to pick individual items. Unlooted corpses
// fade away after CORPSE_DESPAWN_MS.
// ---------------------------------------------------------------------------

// A small green-framed popup, like drawForagePrompt but centered on an
// arbitrary pixel point rather than a tile - corpses aren't tile-aligned.
function drawForageStylePrompt(ctx, cx, topY, text) {
  ctx.font = "bold 12px 'Segoe UI', sans-serif";
  const textW = ctx.measureText(text).width;
  const boxW = textW + 20, boxH = 20;
  const bx = cx - boxW / 2, by = topY - boxH;
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

let corpseSeq = 0;

function spawnCorpse(state, pixelX, pixelY, items, label) {
  if (!items.length) return;
  corpseSeq += 1;
  state.corpses.push({
    id: `corpse${corpseSeq}`,
    x: pixelX,
    y: pixelY,
    items,
    label,
    spawnedAt: performance.now(),
  });
}

function updateCorpseDespawn(state) {
  const now = performance.now();
  state.corpses = state.corpses.filter((c) => now - c.spawnedAt < CORPSE_DESPAWN_MS);
}

function findNearestCorpse(state, px, py, range) {
  let best = null, bestDist = Infinity;
  for (const c of state.corpses) {
    const d = Math.hypot(px - c.x, py - c.y);
    if (d <= range && d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

function lootCorpseAll(state, corpse) {
  for (const entry of corpse.items) addItem(state, entry.item, entry.qty);
  const summary = corpse.items.map((e) => `${e.qty}x ${ITEMS[e.item] ? ITEMS[e.item].name : e.item}`).join(", ");
  state.corpses = state.corpses.filter((c) => c !== corpse);
  state.worldFlashMessage = `Looted ${corpse.label}.`;
  state.worldFlashUntil = performance.now() + 1400;
  logEvent(state, `Looted ${corpse.label}: ${summary}.`, "loot");
}

function openCorpseLoot(state, corpse) {
  state.mode = "CORPSE_LOOT";
  state.lootTarget = corpse.id;
}

function getLootTargetCorpse(state) {
  return state.corpses.find((c) => c.id === state.lootTarget) || null;
}

function closeCorpseLoot(state) {
  state.mode = "OVERWORLD";
  state.lootTarget = null;
}

function updateCorpseLoot(state) {
  const corpse = getLootTargetCorpse(state);
  if (!corpse) {
    closeCorpseLoot(state);
    return;
  }
  if (Input.cancelPressed() || Input.menuPressed()) {
    closeCorpseLoot(state);
    return;
  }
  if (Input.clickPos) {
    const takeAllHit = (state.uiHitboxes.lootTakeAll || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (takeAllHit) {
      lootCorpseAll(state, corpse);
      closeCorpseLoot(state);
      Input.clickPos = null;
      return;
    }
    const slotHit = (state.uiHitboxes.lootSlots || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (slotHit) {
      const entry = corpse.items[slotHit.idx];
      if (entry) {
        addItem(state, entry.item, entry.qty);
        logEvent(state, `Looted ${entry.qty}x ${ITEMS[entry.item] ? ITEMS[entry.item].name : entry.item}.`, "loot");
        corpse.items = corpse.items.filter((e) => e !== entry);
        if (corpse.items.length === 0) {
          state.corpses = state.corpses.filter((c) => c !== corpse);
          closeCorpseLoot(state);
        }
      }
      Input.clickPos = null;
    }
  }
}

function renderCorpseLoot(ctx, state, canvasW, canvasH) {
  const corpse = getLootTargetCorpse(state);
  const w = 380, h = 320;
  const x = (canvasW - w) / 2, y = (canvasH - h) / 2;
  ctx.fillStyle = "rgba(6,10,8,0.94)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  drawPixelFrameCorners(ctx, x, y, w, h, 12, "#e8c97a");

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.fillText(corpse ? corpse.label : "Corpse", x + 20, y + 32);

  if (!corpse) {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("Already looted.", x + 20, y + 60);
    return;
  }

  const slotSize = 56, gap = 10, cols = 5;
  state.uiHitboxes.lootSlots = [];
  corpse.items.forEach((entry, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const sx = x + 20 + col * (slotSize + gap);
    const sy = y + 52 + row * (slotSize + gap);
    drawItemSlot(ctx, sx, sy, slotSize, entry, false);
    state.uiHitboxes.lootSlots.push({ idx: i, x: sx, y: sy, w: slotSize, h: slotSize });
  });

  const btnY = y + h - 56, btnW = w - 40, btnH = 32;
  ctx.fillStyle = "rgba(232,201,122,0.18)";
  ctx.fillRect(x + 20, btnY, btnW, btnH);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 20, btnY, btnW, btnH);
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Take All", x + 20 + btnW / 2, btnY + btnH / 2 + 5);
  ctx.textAlign = "left";
  state.uiHitboxes.lootTakeAll = [{ x: x + 20, y: btnY, w: btnW, h: btnH }];

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText("Click an item to take it, or Take All. Esc/I to leave the rest behind.", x + 20, y + h - 16);
}

// ---------------------------------------------------------------------------
// Right-click a placed object -> "Store <item>?" confirm - accepting removes
// it from the world and returns it to the inventory.
// ---------------------------------------------------------------------------

function openStorePrompt(state, obj) {
  state.storePrompt = { x: obj.x, y: obj.y, type: obj.type };
}

function getStorePromptObject(state) {
  const sp = state.storePrompt;
  if (!sp) return null;
  return state.placedObjects.find((o) => o.x === sp.x && o.y === sp.y && o.type === sp.type) || null;
}

function confirmStorePrompt(state) {
  const obj = getStorePromptObject(state);
  state.storePrompt = null;
  if (!obj) return;
  if (obj.type === "chest" && obj.contents && obj.contents.length > 0) {
    state.worldFlashMessage = "Empty the chest before storing it.";
    state.worldFlashUntil = performance.now() + 1500;
    return;
  }
  state.placedObjects = state.placedObjects.filter((o) => o !== obj);
  addItem(state, obj.type, 1);
  state.worldFlashMessage = `Stored ${ITEMS[obj.type] ? ITEMS[obj.type].name : obj.type}.`;
  state.worldFlashUntil = performance.now() + 1400;
  logEvent(state, state.worldFlashMessage, "info");
}

function updateStorePrompt(state) {
  if (Input.cancelPressed()) {
    state.storePrompt = null;
    return;
  }
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.storePromptButtons || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      if (hit.action === "confirm") confirmStorePrompt(state);
      else state.storePrompt = null;
      Input.clickPos = null;
    }
  }
}

function renderStorePrompt(ctx, state, canvasW, canvasH) {
  const sp = state.storePrompt;
  if (!sp) return;
  const itemName = ITEMS[sp.type] ? ITEMS[sp.type].name : sp.type;
  const w = 300, h = 110;
  const x = (canvasW - w) / 2, y = (canvasH - h) / 2;
  ctx.fillStyle = "rgba(6,10,8,0.96)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  drawPixelFrameCorners(ctx, x, y, w, h, 10, "#e8c97a");

  ctx.fillStyle = "#f2f2ec";
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  wrapText(ctx, `Do you want to store the ${itemName}?`, x + w / 2, y + 32, w - 30, 18);
  ctx.textAlign = "left";

  state.uiHitboxes.storePromptButtons = [];
  const btnY = y + h - 40, btnW = (w - 40) / 2, btnH = 28;
  [["confirm", "Yes"], ["cancel", "No"]].forEach(([action, label], i) => {
    const bx = x + 16 + i * (btnW + 8);
    ctx.fillStyle = action === "confirm" ? "rgba(124,214,138,0.2)" : "rgba(200,80,80,0.18)";
    ctx.fillRect(bx, btnY, btnW, btnH);
    ctx.strokeStyle = action === "confirm" ? "#7cd68a" : "#c94f4f";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, btnY, btnW, btnH);
    ctx.fillStyle = "#f2f2ec";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, bx + btnW / 2, btnY + btnH / 2 + 4);
    state.uiHitboxes.storePromptButtons.push({ action, x: bx, y: btnY, w: btnW, h: btnH });
  });
  ctx.textAlign = "left";
}

// Small carcass sprite (crossed bones over a dark patch) drawn at a corpse's
// position, plus its "Loot" popup when the player is close enough.
function drawCorpse(ctx, state, corpse) {
  const cx = corpse.x, cy = corpse.y;
  const age = performance.now() - corpse.spawnedAt;
  const fadeIn = Math.min(1, age / 200);
  ctx.save();
  ctx.globalAlpha = fadeIn;
  ctx.fillStyle = "rgba(20,14,10,0.55)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e8dfc9";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 2);
  ctx.lineTo(cx + 9, cy + 8);
  ctx.moveTo(cx + 9, cy - 2);
  ctx.lineTo(cx - 9, cy + 8);
  ctx.stroke();
  ctx.restore();

  const p = state.player;
  const pcx = p.pixelX + TILE_SIZE / 2, pcy = p.pixelY + TILE_SIZE / 2;
  if (Math.hypot(pcx - cx, pcy - cy) <= CORPSE_LOOT_RANGE) {
    const rect = drawForageStylePrompt(ctx, cx, cy - 22, "Loot (Space)");
    state.uiHitboxes.lootButtons.push({ corpseId: corpse.id, x: rect.x - Camera.x, y: rect.y - Camera.y, w: rect.w, h: rect.h });
  }
  state.uiHitboxes.corpseHitboxes.push({ corpseId: corpse.id, x: cx - Camera.x - 16, y: cy - Camera.y - 16, w: 32, h: 32 });
}
