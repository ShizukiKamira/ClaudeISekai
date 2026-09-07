// ---------------------------------------------------------------------------
// Chest storage: a placed chest holds its own item list. The Chest screen
// shows the player's inventory and the chest's contents side by side -
// click to select, double-click (or drag between the two grids) to move a
// full stack, right-click to open a half/all/custom-amount prompt.
// ---------------------------------------------------------------------------

const CHEST_GRID_COLS = 4;
const CHEST_SLOT_SIZE = 56;
const CHEST_SLOT_GAP = 8;
const CHEST_DOUBLE_CLICK_MS = 400;

function getChestObject(state) {
  if (!state.chestTarget) return null;
  return state.placedObjects.find(
    (o) => o.type === "chest" && o.x === state.chestTarget.x && o.y === state.chestTarget.y && o.contents
  ) || null;
}

function removeZeroEntries(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].qty <= 0) arr.splice(i, 1);
  }
}

// Moves up to `qty` of itemId from fromArr to toArr (merging into an
// existing stack there, if any). Returns the amount actually moved.
function transferStack(fromArr, toArr, itemId, qty) {
  const fromEntry = fromArr.find((e) => e.item === itemId);
  if (!fromEntry) return 0;
  const moveQty = Math.min(qty, fromEntry.qty);
  if (moveQty <= 0) return 0;
  fromEntry.qty -= moveQty;
  const toEntry = toArr.find((e) => e.item === itemId);
  if (toEntry) toEntry.qty += moveQty;
  else toArr.push({ item: itemId, qty: moveQty });
  removeZeroEntries(fromArr);
  return moveQty;
}

function chestSideArray(state, side) {
  const chestObj = getChestObject(state);
  if (side === "inv") return state.player.inventory;
  return chestObj ? chestObj.contents : null;
}

function closeChest(state) {
  state.mode = "OVERWORLD";
  state.chestTarget = null;
  state.chestSelected = null;
  state.chestLastClick = null;
  state.chestPrompt = null;
}

function findSlotAt(state, x, y) {
  const invHit = (state.uiHitboxes.chestInvSlots || []).find((b) => pointInRect(x, y, b));
  if (invHit) return { side: "inv", idx: invHit.idx, item: invHit.item, qty: invHit.qty };
  const boxHit = (state.uiHitboxes.chestBoxSlots || []).find((b) => pointInRect(x, y, b));
  if (boxHit) return { side: "box", idx: boxHit.idx, item: boxHit.item, qty: boxHit.qty };
  return null;
}

function openAmountPrompt(state, slot) {
  state.chestPrompt = {
    side: slot.side,
    itemId: slot.item,
    maxQty: slot.qty,
    customInput: "",
  };
}

function applyPromptTransfer(state, qty) {
  const p = state.chestPrompt;
  if (!p) return;
  const chestObj = getChestObject(state);
  if (!chestObj) return;
  const fromArr = p.side === "inv" ? state.player.inventory : chestObj.contents;
  const toArr = p.side === "inv" ? chestObj.contents : state.player.inventory;
  transferStack(fromArr, toArr, p.itemId, Math.max(0, Math.floor(qty)));
  state.chestPrompt = null;
}

function updateChestPrompt(state) {
  const p = state.chestPrompt;
  if (Input.cancelPressed()) {
    state.chestPrompt = null;
    return;
  }
  if (Input.wasPressed("Backspace")) {
    p.customInput = p.customInput.slice(0, -1);
  }
  for (let d = 0; d <= 9; d++) {
    if (Input.wasPressed(`Digit${d}`) || Input.wasPressed(`Numpad${d}`)) {
      if (p.customInput.length < 5) p.customInput += String(d);
    }
  }
  if (Input.confirmPressed() && p.customInput) {
    applyPromptTransfer(state, parseInt(p.customInput, 10));
    return;
  }
  if (Input.clickPos) {
    const half = (state.uiHitboxes.chestPromptButtons || []).find(
      (b) => b.action === "half" && pointInRect(Input.clickPos.x, Input.clickPos.y, b)
    );
    const all = (state.uiHitboxes.chestPromptButtons || []).find(
      (b) => b.action === "all" && pointInRect(Input.clickPos.x, Input.clickPos.y, b)
    );
    const cancel = (state.uiHitboxes.chestPromptButtons || []).find(
      (b) => b.action === "cancel" && pointInRect(Input.clickPos.x, Input.clickPos.y, b)
    );
    if (half) applyPromptTransfer(state, Math.ceil(p.maxQty / 2));
    else if (all) applyPromptTransfer(state, p.maxQty);
    else if (cancel) state.chestPrompt = null;
    Input.clickPos = null;
  }
}

function updateChest(state) {
  const chestObj = getChestObject(state);
  if (!chestObj) {
    closeChest(state);
    return;
  }

  if (state.chestPrompt) {
    updateChestPrompt(state);
    return;
  }

  if (Input.cancelPressed() || Input.menuPressed()) {
    closeChest(state);
    return;
  }

  if (Input.wheelDelta) {
    const scrollingInv = Input.mousePos.x < canvas.width / 2;
    const key = scrollingInv ? "chestInvScroll" : "chestBoxScroll";
    state[key] = Math.max(0, (state[key] || 0) + (Input.wheelDelta > 0 ? 1 : -1));
    Input.wheelDelta = 0;
  }

  if (Input.rightClickPos) {
    const slot = findSlotAt(state, Input.rightClickPos.x, Input.rightClickPos.y);
    if (slot) openAmountPrompt(state, slot);
    Input.rightClickPos = null;
  }

  if (Input.mouseUpPos && Input.mouseDownPos) {
    const downSlot = findSlotAt(state, Input.mouseDownPos.x, Input.mouseDownPos.y);
    const upSlot = findSlotAt(state, Input.mouseUpPos.x, Input.mouseUpPos.y);
    if (downSlot && upSlot && downSlot.side !== upSlot.side) {
      // Dropped a slot from one grid onto the other - drag the whole stack across.
      const fromArr = chestSideArray(state, downSlot.side);
      const toArr = chestSideArray(state, upSlot.side);
      if (fromArr && toArr) transferStack(fromArr, toArr, downSlot.item, downSlot.qty);
      state.chestSelected = null;
      state.chestLastClick = null;
    } else if (downSlot && upSlot && downSlot.side === upSlot.side && downSlot.idx === upSlot.idx) {
      // A plain click (mousedown/up on the same slot) - select it, or on a
      // second click within the window, move the whole stack across.
      const now = performance.now();
      const last = state.chestLastClick;
      if (last && last.side === downSlot.side && last.idx === downSlot.idx && now - last.at < CHEST_DOUBLE_CLICK_MS) {
        const fromArr = chestSideArray(state, downSlot.side);
        const toArr = chestSideArray(state, downSlot.side === "inv" ? "box" : "inv");
        if (fromArr && toArr) transferStack(fromArr, toArr, downSlot.item, downSlot.qty);
        state.chestSelected = null;
        state.chestLastClick = null;
      } else {
        state.chestSelected = { side: downSlot.side, idx: downSlot.idx };
        state.chestLastClick = { side: downSlot.side, idx: downSlot.idx, at: now };
      }
    }
    Input.mouseDownPos = null;
  }
}

function renderChestGrid(ctx, state, x, y, w, h, side, title) {
  const entries = side === "inv" ? state.player.inventory : getChestObject(state).contents;
  const cols = CHEST_GRID_COLS;
  const rows = Math.max(1, Math.floor((h - 20 + CHEST_SLOT_GAP) / (CHEST_SLOT_SIZE + CHEST_SLOT_GAP)));
  const totalRows = Math.max(1, Math.ceil(entries.length / cols));
  const scrollKey = side === "inv" ? "chestInvScroll" : "chestBoxScroll";
  const scroll = Math.max(0, Math.min(state[scrollKey] || 0, Math.max(0, totalRows - rows)));
  state[scrollKey] = scroll;

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.fillText(title, x, y);

  const gridY = y + 16;
  const hitboxKey = side === "inv" ? "chestInvSlots" : "chestBoxSlots";
  state.uiHitboxes[hitboxKey] = [];
  entries.forEach((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (row < scroll || row >= scroll + rows) return;
    const sx = x + col * (CHEST_SLOT_SIZE + CHEST_SLOT_GAP);
    const sy = gridY + (row - scroll) * (CHEST_SLOT_SIZE + CHEST_SLOT_GAP);
    const selected = state.chestSelected && state.chestSelected.side === side && state.chestSelected.idx === i;
    drawItemSlot(ctx, sx, sy, CHEST_SLOT_SIZE, entry, selected);
    state.uiHitboxes[hitboxKey].push({ idx: i, x: sx, y: sy, w: CHEST_SLOT_SIZE, h: CHEST_SLOT_SIZE, item: entry.item, qty: entry.qty });
  });

  if (entries.length === 0) {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillText(side === "inv" ? "(inventory empty)" : "(chest empty)", x, gridY + 20);
  }

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  if (scroll > 0) ctx.fillText("▲", x + (cols * (CHEST_SLOT_SIZE + CHEST_SLOT_GAP)) / 2, gridY - 6);
  if (scroll + rows < totalRows) {
    ctx.fillText("▼", x + (cols * (CHEST_SLOT_SIZE + CHEST_SLOT_GAP)) / 2, gridY + rows * (CHEST_SLOT_SIZE + CHEST_SLOT_GAP) + 10);
  }
  ctx.textAlign = "left";
}

function renderChestPrompt(ctx, state, canvasW, canvasH) {
  const p = state.chestPrompt;
  const w = 260, h = 150;
  const x = (canvasW - w) / 2, y = (canvasH - h) / 2;
  ctx.fillStyle = "rgba(6,10,8,0.96)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  drawPixelFrameCorners(ctx, x, y, w, h, 10, "#e8c97a");

  const verb = p.side === "inv" ? "Store" : "Take";
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${verb} ${ITEMS[p.itemId].name} (max ${p.maxQty})`, x + w / 2, y + 26);
  ctx.textAlign = "left";

  state.uiHitboxes.chestPromptButtons = [];
  const btnY = y + 42, btnH = 28, btnGap = 8;
  const btnW = (w - 24 - btnGap) / 2;
  [["half", "Half"], ["all", "All"]].forEach(([action, label], i) => {
    const bx = x + 12 + i * (btnW + btnGap);
    ctx.fillStyle = "rgba(232,201,122,0.15)";
    ctx.fillRect(bx, btnY, btnW, btnH);
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, btnY, btnW, btnH);
    ctx.fillStyle = "#f2f2ec";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, bx + btnW / 2, btnY + btnH / 2 + 4);
    state.uiHitboxes.chestPromptButtons.push({ action, x: bx, y: btnY, w: btnW, h: btnH });
  });
  ctx.textAlign = "left";

  const fieldY = btnY + btnH + 14;
  ctx.fillStyle = "#cfd8cf";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Custom amount (type, Enter to confirm):", x + 12, fieldY);
  ctx.fillStyle = "rgba(20,28,20,0.8)";
  ctx.fillRect(x + 12, fieldY + 6, w - 24, 24);
  ctx.strokeStyle = "#e8c97a";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 12, fieldY + 6, w - 24, 24);
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 13px 'Segoe UI', sans-serif";
  ctx.fillText(p.customInput || "0", x + 18, fieldY + 23);

  const cancelY = fieldY + 40;
  ctx.fillStyle = "rgba(200,80,80,0.18)";
  ctx.fillRect(x + 12, cancelY, w - 24, 20);
  ctx.strokeStyle = "#c94f4f";
  ctx.strokeRect(x + 12, cancelY, w - 24, 20);
  ctx.fillStyle = "#e88a5a";
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Cancel (Esc)", x + w / 2, cancelY + 14);
  ctx.textAlign = "left";
  state.uiHitboxes.chestPromptButtons.push({ action: "cancel", x: x + 12, y: cancelY, w: w - 24, h: 20 });
}

function renderChest(ctx, state, canvasW, canvasH) {
  const chestObj = getChestObject(state);
  const panelX = 60, panelY = 40, panelW = canvasW - 120, panelH = canvasH - 80;
  ctx.fillStyle = "rgba(6,10,8,0.92)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  drawPixelFrameCorners(ctx, panelX, panelY, panelW, panelH, 16, "#e8c97a");

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 20px 'Segoe UI', sans-serif";
  ctx.fillText("Chest", panelX + 30, panelY + 36);

  if (!chestObj) {
    ctx.fillStyle = "#e88a5a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("This chest is no longer here.", panelX + 30, panelY + 70);
    return;
  }

  const gridY = panelY + 56;
  const gridH = panelH - 56 - 40;
  const colW = (panelW - 60 - 30) / 2;
  renderChestGrid(ctx, state, panelX + 30, gridY, colW, gridH, "inv", "Your Inventory");
  renderChestGrid(ctx, state, panelX + 30 + colW + 30, gridY, colW, gridH, "box", "Chest");

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(
    "Click to select, click again to move the stack, drag between grids, right-click for half/custom amounts.",
    panelX + 30,
    panelY + panelH - 16
  );

  if (state.chestPrompt) {
    renderChestPrompt(ctx, state, canvasW, canvasH);
  }
}
