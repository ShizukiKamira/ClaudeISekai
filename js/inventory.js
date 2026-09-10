// ---------------------------------------------------------------------------
// Detailed inventory tab: category filters, item-icon grid, player panel
// ---------------------------------------------------------------------------

const INVENTORY_GRID_COLS = 5;

function currentCategory(state) {
  return ITEM_CATEGORIES[state.menuFilterIndex].id;
}

function getFilteredInventory(state, categoryId) {
  return state.player.inventory.filter((entry) => ITEMS[entry.item].category === categoryId);
}

function updateInventoryTab(state) {
  const p = state.player;
  if (Input.wasPressed("BracketLeft")) {
    state.menuFilterIndex = (state.menuFilterIndex - 1 + ITEM_CATEGORIES.length) % ITEM_CATEGORIES.length;
    state.menuCursor = 0;
  }
  if (Input.wasPressed("BracketRight")) {
    state.menuFilterIndex = (state.menuFilterIndex + 1) % ITEM_CATEGORIES.length;
    state.menuCursor = 0;
  }
  if (Input.clickPos) {
    const catHit = (state.uiHitboxes.invCategoryTabs || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (catHit) {
      state.menuFilterIndex = catHit.index;
      state.menuCursor = 0;
      Input.clickPos = null;
    }
  }

  const items = getFilteredInventory(state, currentCategory(state));

  // Hotbar drag-and-drop: drag a consumable from the grid onto a slot to
  // assign it there, or drag directly from one hotbar slot to another to
  // move it; a plain click (mousedown+up on the same, already-assigned
  // slot) removes it. Runs before the empty-category early-return so
  // removal/hotbar-to-hotbar dragging still works while browsing an empty
  // category. The same item is never allowed on two hotbar slots at once -
  // assigning/moving one clears any other slot that already held it.
  updateHotbarDrag(state, items, "invSlots", "invHotbarSlots");

  // Right-clicking an item offers its available actions (equip/unequip a
  // weapon or accessory, or assign a potion to the lowest open hotbar slot)
  // as an explicit menu instead of relying on the double-click-to-use/equip
  // shortcut.
  if (Input.rightClickPos) {
    const slotHit = (state.uiHitboxes.invSlots || []).find((b) => pointInRect(Input.rightClickPos.x, Input.rightClickPos.y, b));
    if (slotHit && items[slotHit.idx]) {
      openInventoryItemContextMenu(state, items[slotHit.idx].item, Input.rightClickPos.x, Input.rightClickPos.y);
      Input.rightClickPos = null;
    }
  }

  if (items.length === 0) return;
  state.menuCursor = Math.min(state.menuCursor, items.length - 1);

  if (Input.wasPressed("ArrowRight")) {
    state.menuCursor = Math.min(state.menuCursor + 1, items.length - 1);
  }
  if (Input.wasPressed("ArrowLeft")) {
    state.menuCursor = Math.max(state.menuCursor - 1, 0);
  }
  if (Input.wasPressed("ArrowDown")) {
    state.menuCursor = Math.min(state.menuCursor + INVENTORY_GRID_COLS, items.length - 1);
  }
  if (Input.wasPressed("ArrowUp")) {
    state.menuCursor = Math.max(state.menuCursor - INVENTORY_GRID_COLS, 0);
  }

  if (Input.confirmPressed()) {
    useOrEquipItem(state, items[state.menuCursor].item);
  }
  if (Input.clickPos) {
    const slotHit = (state.uiHitboxes.invSlots || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (slotHit) {
      // First click on a slot just selects it (matches keyboard browsing);
      // a second click on the already-selected slot uses/equips it - so a
      // stray click doesn't instantly drink a potion you meant to inspect.
      if (state.menuCursor === slotHit.idx) {
        useOrEquipItem(state, items[slotHit.idx].item);
      } else {
        state.menuCursor = slotHit.idx;
      }
      Input.clickPos = null;
    }
  }
}

function useOrEquipItem(state, itemId) {
  const p = state.player;
  const data = ITEMS[itemId];
  if (data.type === "consumable") {
    const message = applyItemEffect(state, itemId);
    if (message) {
      state.menuFlashMessage = message;
      state.menuFlashUntil = performance.now() + 1400;
    }
  } else if (data.type === "weapon") {
    p.weapon = p.weapon === itemId ? null : itemId;
  } else if (data.type === "accessory") {
    p.accessory = p.accessory === itemId ? null : itemId;
  } else if (data.type === "placeable") {
    state.mode = "OVERWORLD";
    state.placingItem = itemId;
  }
}

function getLowestEmptyHotbarSlot(state) {
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (!state.player.hotbar[i]) return i;
  }
  return -1;
}

// Right-click menu for an inventory slot: weapons/accessories get an
// Equip/Unequip toggle (sharing useOrEquipItem's logic), potions get a
// one-click "Put in Slot N" for the lowest open hotbar slot. Items with
// nothing sensible to offer here (tools, materials, placeables) just don't
// open a menu.
function openInventoryItemContextMenu(state, itemId, x, y) {
  const p = state.player;
  const data = ITEMS[itemId];
  const options = [];

  if (data.type === "weapon") {
    options.push({
      label: p.weapon === itemId ? "Unequip" : "Equip",
      onSelect: () => useOrEquipItem(state, itemId),
    });
  } else if (data.type === "accessory") {
    options.push({
      label: p.accessory === itemId ? "Unequip" : "Equip",
      onSelect: () => useOrEquipItem(state, itemId),
    });
  } else if (data.type === "consumable") {
    const slotIdx = getLowestEmptyHotbarSlot(state);
    if (slotIdx >= 0) {
      options.push({
        label: `Put in Slot ${slotIdx + 1}`,
        onSelect: () => assignHotbarSlot(state, slotIdx, itemId),
      });
    } else {
      options.push({ label: "Hotbar full", disabled: true });
    }
  }

  if (options.length === 0) return;
  openContextMenu(state, x, y, options);
}

// --- icon drawing -----------------------------------------------------------

function drawFlaskIcon(ctx, cx, cy, s, liquidColor) {
  const bodyR = s * 0.34;
  const neckW = s * 0.22;
  const neckH = s * 0.22;

  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(cx - neckW / 2 - 2, cy - bodyR - neckH - 6, neckW + 4, 6);
  ctx.fillStyle = "#d8d8d0";
  ctx.fillRect(cx - neckW / 2, cy - bodyR - neckH, neckW, neckH);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, bodyR - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(20,20,20,0.15)";
  ctx.fillRect(cx - bodyR, cy - bodyR, bodyR * 2, bodyR * 2);
  ctx.fillStyle = liquidColor;
  ctx.fillRect(cx - bodyR, cy - bodyR * 0.15, bodyR * 2, bodyR * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
  ctx.strokeStyle = "#cfd8cf";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(cx - bodyR * 0.35, cy - bodyR * 0.35, bodyR * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawSwordIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  ctx.fillStyle = "#d8d8d0";
  ctx.fillRect(-s * 0.06, -s * 0.42, s * 0.12, s * 0.6);
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.42);
  ctx.lineTo(0, -s * 0.54);
  ctx.lineTo(s * 0.06, -s * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c7a75f";
  ctx.fillRect(-s * 0.2, s * 0.16, s * 0.4, s * 0.08);
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(-s * 0.05, s * 0.2, s * 0.1, s * 0.2);
  ctx.beginPath();
  ctx.arc(0, s * 0.42, s * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = "#c7a75f";
  ctx.fill();

  ctx.restore();
}

function drawDaggerIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  ctx.fillStyle = "#e8e2d0";
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, -s * 0.3);
  ctx.lineTo(s * 0.05, -s * 0.3);
  ctx.lineTo(s * 0.02, -s * 0.4);
  ctx.lineTo(0, -s * 0.46);
  ctx.lineTo(-s * 0.02, -s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-s * 0.05, -s * 0.3, s * 0.1, s * 0.36);

  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(-s * 0.14, s * 0.06, s * 0.28, s * 0.06);
  ctx.fillStyle = "#3a2e17";
  ctx.fillRect(-s * 0.04, s * 0.1, s * 0.08, s * 0.16);

  ctx.restore();
}

function drawStaffIcon(ctx, cx, cy, s, gemColor) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 8);

  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(-s * 0.05, -s * 0.46, s * 0.1, s * 0.86);

  ctx.beginPath();
  ctx.arc(0, -s * 0.46, s * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = gemColor;
  ctx.fill();
  ctx.strokeStyle = "#c7a75f";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function drawCharmIcon(ctx, cx, cy, s) {
  ctx.strokeStyle = "#c7a75f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.4, s * 0.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.26, cy + s * 0.06);
  ctx.lineTo(cx, cy + s * 0.4);
  ctx.lineTo(cx - s * 0.26, cy + s * 0.06);
  ctx.closePath();
  ctx.fillStyle = "#8e6fce";
  ctx.fill();
  ctx.strokeStyle = "#c9b8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.2);
  ctx.lineTo(cx, cy + s * 0.4);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDropletIcon(ctx, cx, cy, s, color) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.4);
  ctx.quadraticCurveTo(cx + s * 0.32, cy + s * 0.06, cx, cy + s * 0.4);
  ctx.quadraticCurveTo(cx - s * 0.32, cy + s * 0.06, cx, cy - s * 0.4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.08, cy - s * 0.04, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawFangIcon(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.16, cy - s * 0.36);
  ctx.quadraticCurveTo(cx + s * 0.08, cy, cx + s * 0.02, cy + s * 0.4);
  ctx.quadraticCurveTo(cx - s * 0.12, cy + s * 0.05, cx - s * 0.16, cy - s * 0.36);
  ctx.closePath();
  ctx.fillStyle = "#e8e2d0";
  ctx.fill();
  ctx.strokeStyle = "#9a9488";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLocketIcon(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.42, s * 0.09, 0, Math.PI * 2);
  ctx.strokeStyle = "#c7a75f";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.3, s * 0.36, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#8a7a4a";
  ctx.fill();
  ctx.strokeStyle = "#c7a75f";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy);
  ctx.lineTo(cx + s * 0.3, cy);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#c94f4f";
  ctx.fill();
}

function drawGenericIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#555";
  ctx.fillRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6);
  ctx.strokeStyle = "#999";
  ctx.strokeRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6);
}

function drawStickIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(-s * 0.4, -s * 0.07, s * 0.8, s * 0.14);
  ctx.strokeStyle = "#5c4326";
  ctx.lineWidth = 1;
  ctx.strokeRect(-s * 0.4, -s * 0.07, s * 0.8, s * 0.14);
  ctx.restore();
}

function drawFlintIcon(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.24, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.38);
  ctx.lineTo(cx - s * 0.14, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.12);
  ctx.closePath();
  ctx.fillStyle = "#5c6773";
  ctx.fill();
  ctx.strokeStyle = "#2f363d";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.3);
  ctx.lineTo(cx - s * 0.02, cy + s * 0.2);
  ctx.stroke();
}

function drawCampfireIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy + s * 0.15);
  ctx.rotate(-Math.PI / 8);
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(-s * 0.32, -s * 0.05, s * 0.64, s * 0.1);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy + s * 0.15);
  ctx.rotate(Math.PI / 8);
  ctx.fillStyle = "#7a5636";
  ctx.fillRect(-s * 0.32, -s * 0.05, s * 0.64, s * 0.1);
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.42);
  ctx.quadraticCurveTo(cx + s * 0.22, cy - s * 0.05, cx + s * 0.1, cy + s * 0.2);
  ctx.quadraticCurveTo(cx, cy + s * 0.08, cx - s * 0.1, cy + s * 0.2);
  ctx.quadraticCurveTo(cx - s * 0.22, cy - s * 0.05, cx, cy - s * 0.42);
  ctx.closePath();
  ctx.fillStyle = "#e8935a";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.22);
  ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.02, cx + s * 0.04, cy + s * 0.12);
  ctx.quadraticCurveTo(cx, cy + s * 0.04, cx - s * 0.04, cy + s * 0.12);
  ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.02, cx, cy - s * 0.22);
  ctx.closePath();
  ctx.fillStyle = "#f6d97a";
  ctx.fill();
}

function drawLogIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 10);
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(-s * 0.38, -s * 0.16, s * 0.76, s * 0.32);
  ctx.strokeStyle = "#5c4326";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-s * 0.38, -s * 0.16, s * 0.76, s * 0.32);
  [-0.38, 0.38].forEach((ox) => {
    ctx.beginPath();
    ctx.ellipse(s * ox, 0, s * 0.05, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#c9a97a";
    ctx.fill();
    ctx.strokeStyle = "#5c4326";
    ctx.stroke();
  });
  ctx.restore();
}

function drawSandIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#d8c58a";
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.1, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a9822f";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#c9b06a";
  [[-0.12, 0.06], [0.1, 0.12], [0.02, -0.02]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(cx + s * dx, cy + s * dy, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawStoneIcon(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.16, cy - s * 0.28);
  ctx.lineTo(cx + s * 0.14, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.32, cy + s * 0.02);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.32);
  ctx.lineTo(cx - s * 0.18, cy + s * 0.3);
  ctx.closePath();
  ctx.fillStyle = "#8a8a80";
  ctx.fill();
  ctx.strokeStyle = "#5c5c54";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawOreIcon(ctx, cx, cy, s, speckColor) {
  drawStoneIcon(ctx, cx, cy, s);
  ctx.fillStyle = speckColor;
  [[-0.08, -0.05], [0.1, 0.05], [-0.02, 0.15], [0.15, -0.1]].forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(cx + ox * s, cy + oy * s, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawAxeIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(-s * 0.06, -s * 0.42, s * 0.12, s * 0.78);
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.42);
  ctx.lineTo(-s * 0.34, -s * 0.3);
  ctx.lineTo(-s * 0.3, -s * 0.02);
  ctx.lineTo(-s * 0.06, -s * 0.12);
  ctx.closePath();
  ctx.fillStyle = "#9aa4ab";
  ctx.fill();
  ctx.strokeStyle = "#4a5158";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawPickaxeIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(-s * 0.06, -s * 0.42, s * 0.12, s * 0.78);
  ctx.strokeStyle = "#4a5158";
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, -s * 0.4);
  ctx.quadraticCurveTo(0, -s * 0.62, s * 0.36, -s * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawBridgeIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#a68a5c";
  ctx.fillRect(cx - s * 0.4, cy - s * 0.12, s * 0.8, s * 0.24);
  ctx.strokeStyle = "#6b4a2f";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.4, cy - s * 0.12, s * 0.8, s * 0.24);
  for (let i = 0; i < 3; i++) {
    const lx = cx - s * 0.26 + i * s * 0.26;
    ctx.beginPath();
    ctx.moveTo(lx, cy - s * 0.12);
    ctx.lineTo(lx, cy + s * 0.12);
    ctx.stroke();
  }
}

function drawFurnaceIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#6b6b63";
  ctx.fillRect(cx - s * 0.36, cy - s * 0.42, s * 0.72, s * 0.84);
  ctx.strokeStyle = "#3a3a34";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.36, cy - s * 0.42, s * 0.72, s * 0.84);
  ctx.fillStyle = "#e8935a";
  ctx.fillRect(cx - s * 0.16, cy + s * 0.06, s * 0.32, s * 0.18);
  ctx.strokeStyle = "#2a2a26";
  ctx.strokeRect(cx - s * 0.16, cy + s * 0.06, s * 0.32, s * 0.18);
}

function drawIngotIcon(ctx, cx, cy, s, color) {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.32, cy + s * 0.18);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.16);
  ctx.lineTo(cx + s * 0.2, cy - s * 0.16);
  ctx.lineTo(cx + s * 0.32, cy + s * 0.18);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.14, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.14, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.08, cy + s * 0.06);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.06);
  ctx.closePath();
  ctx.fill();
}

function drawCraftingTableIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(cx - s * 0.4, cy - s * 0.3, s * 0.8, s * 0.16);
  ctx.strokeStyle = "#5c4326";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.4, cy - s * 0.3, s * 0.8, s * 0.16);
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(cx - s * 0.32, cy - s * 0.14, s * 0.08, s * 0.44);
  ctx.fillRect(cx + s * 0.24, cy - s * 0.14, s * 0.08, s * 0.44);
}

function drawGoldIcon(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "#e8c97a";
  ctx.fill();
  ctx.strokeStyle = "#a9822f";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy - s * 0.1, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawHerbIcon(ctx, cx, cy, s) {
  ctx.strokeStyle = "#3a5c2a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.38);
  ctx.lineTo(cx, cy - s * 0.1);
  ctx.stroke();
  ctx.fillStyle = "#4d9a4d";
  for (const [dx, dy] of [[-0.22, -0.1], [0.22, -0.02], [0, -0.34], [-0.14, -0.24]]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * dx, cy + s * dy, s * 0.16, s * 0.08, dx * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#c9534f";
  ctx.beginPath();
  ctx.arc(cx + s * 0.12, cy + s * 0.16, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoonleafIcon(ctx, cx, cy, s) {
  ctx.strokeStyle = "#3a5c4a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.38);
  ctx.lineTo(cx, cy - s * 0.05);
  ctx.stroke();
  const glow = ctx.createRadialGradient(cx, cy - s * 0.12, 1, cx, cy - s * 0.12, s * 0.36);
  glow.addColorStop(0, "rgba(207,232,224,0.9)");
  glow.addColorStop(1, "rgba(207,232,224,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfe8e0";
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.12, s * 0.14, s * 0.28, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#eaf6f2";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBedIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(cx - s * 0.42, cy - s * 0.42, s * 0.84, s * 0.84);
  ctx.fillStyle = "#8e3f3f";
  ctx.fillRect(cx - s * 0.36, cy - s * 0.36, s * 0.72, s * 0.72);
  ctx.fillStyle = "#e8dfc9";
  ctx.fillRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.2);
  ctx.strokeStyle = "#5c3520";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.2);
  ctx.fillStyle = "#a8524f";
  ctx.fillRect(cx - s * 0.3, cy + s * 0.02, s * 0.6, s * 0.3);
}

function drawTableIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#8a6a45";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5c4326";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#7a5636";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

function drawChairIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(cx - s * 0.28, cy - s * 0.12, s * 0.56, s * 0.4);
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.28, cy - s * 0.12, s * 0.56, s * 0.4);
  ctx.fillStyle = "#8a6a45";
  ctx.fillRect(cx - s * 0.28, cy - s * 0.36, s * 0.56, s * 0.14);
}

function drawBookshelfIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#5c4326";
  ctx.fillRect(cx - s * 0.36, cy - s * 0.42, s * 0.72, s * 0.84);
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.36, cy - s * 0.42, s * 0.72, s * 0.84);
  const colors = ["#8e3f3f", "#4f8dae", "#59c46b", "#c9a03a", "#8e6fce"];
  for (let row = 0; row < 2; row++) {
    let x = cx - s * 0.3;
    for (let i = 0; i < 5; i++) {
      const w = s * 0.1;
      ctx.fillStyle = colors[(i + row * 2) % colors.length];
      ctx.fillRect(x, cy - s * 0.32 + row * s * 0.4, w, s * 0.3);
      x += w + 1;
    }
  }
}

function drawChestIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#7a5636";
  ctx.fillRect(cx - s * 0.38, cy - s * 0.08, s * 0.76, s * 0.4);
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.38, cy - s * 0.08, s * 0.76, s * 0.4);
  ctx.fillStyle = "#5c4326";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.38, cy - s * 0.08);
  ctx.quadraticCurveTo(cx, cy - s * 0.34, cx + s * 0.38, cy - s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e8c97a";
  ctx.fillRect(cx - s * 0.05, cy + s * 0.04, s * 0.1, s * 0.14);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(cx - s * 0.38, cy - s * 0.08, s * 0.76, 2);
}

function drawCabinetIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(cx - s * 0.36, cy - s * 0.42, s * 0.72, s * 0.84);
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.36, cy - s * 0.42, s * 0.72, s * 0.84);
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.42);
  ctx.lineTo(cx, cy + s * 0.42);
  ctx.stroke();
  ctx.fillStyle = "#e8c97a";
  ctx.beginPath();
  ctx.arc(cx - s * 0.08, cy, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.08, cy, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
}

function drawWeaponRackIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#5c4326";
  ctx.fillRect(cx - s * 0.36, cy + s * 0.24, s * 0.72, s * 0.1);
  ctx.save();
  ctx.translate(cx - s * 0.12, cy);
  ctx.rotate(-Math.PI / 10);
  drawSwordIcon(ctx, 0, 0, s * 0.85);
  ctx.restore();
  ctx.save();
  ctx.translate(cx + s * 0.16, cy);
  ctx.rotate(Math.PI / 8);
  drawAxeIcon(ctx, 0, 0, s * 0.75);
  ctx.restore();
}

function drawFireplaceIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#5f5f58";
  ctx.fillRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8);
  ctx.strokeStyle = "#3a3a34";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8);
  ctx.fillStyle = "#1a1a16";
  ctx.fillRect(cx - s * 0.26, cy - s * 0.2, s * 0.52, s * 0.5);
  const flicker = 0.85 + Math.sin(performance.now() / 150) * 0.15;
  ctx.fillStyle = `rgba(246,169,74,${flicker})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.14, cy + s * 0.06, cx, cy + s * 0.26);
  ctx.quadraticCurveTo(cx - s * 0.14, cy + s * 0.06, cx, cy - s * 0.1);
  ctx.fill();
  ctx.fillStyle = "#f6d97a";
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.1, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrapIcon(ctx, cx, cy, s) {
  ctx.strokeStyle = "#8a8a80";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.36, s * 0.24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#5c5c54";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const jx = cx + Math.cos(angle) * s * 0.36;
    const jy = cy + Math.sin(angle) * s * 0.24;
    ctx.save();
    ctx.translate(jx, jy);
    ctx.rotate(angle);
    ctx.fillRect(-s * 0.02, -s * 0.09, s * 0.04, s * 0.18);
    ctx.restore();
  }
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy - s * 0.14);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.14);
  ctx.stroke();
}

function drawRabbitMeatIcon(ctx, cx, cy, s) {
  ctx.fillStyle = "#c9534f";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.1);
  ctx.quadraticCurveTo(cx - s * 0.32, cy - s * 0.28, cx, cy - s * 0.3);
  ctx.quadraticCurveTo(cx + s * 0.32, cy - s * 0.24, cx + s * 0.22, cy + s * 0.2);
  ctx.quadraticCurveTo(cx + s * 0.1, cy + s * 0.36, cx - s * 0.12, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7a2a28";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#e8dfc9";
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.16, cy + s * 0.22, s * 0.1, s * 0.06, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFishingRodIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 5);
  ctx.strokeStyle = "#8a6a45";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, s * 0.42);
  ctx.lineTo(s * 0.42, -s * 0.42);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(230,230,225,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tipX = cx + Math.cos(-Math.PI / 5) * s * 0.42;
  const tipY = cy + Math.sin(-Math.PI / 5) * s * 0.42;
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo(tipX - s * 0.1, tipY + s * 0.5, cx - s * 0.05, cy + s * 0.4);
  ctx.stroke();
  ctx.fillStyle = "#e8c97a";
  ctx.beginPath();
  ctx.arc(cx - s * 0.05, cy + s * 0.4, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawFishIcon(ctx, cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.05, cy, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.26, cy);
  ctx.lineTo(cx + s * 0.42, cy - s * 0.16);
  ctx.lineTo(cx + s * 0.42, cy + s * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#1a1a16";
  ctx.beginPath();
  ctx.arc(cx - s * 0.28, cy - s * 0.04, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.12);
  ctx.lineTo(cx + s * 0.15, cy - s * 0.06);
  ctx.stroke();
}

function drawBerryIcon(ctx, cx, cy, s) {
  ctx.strokeStyle = "#3a5c2a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.4);
  ctx.lineTo(cx, cy - s * 0.18);
  ctx.stroke();
  ctx.fillStyle = "#4d9a4d";
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.14, cy - s * 0.28, s * 0.12, s * 0.07, -0.4, 0, Math.PI * 2);
  ctx.fill();
  const berryColors = ["#8e3f6e", "#a8524f", "#7a2a6a"];
  const spots = [[-0.14, 0.02], [0.12, -0.04], [0, 0.24], [-0.05, 0.26]];
  spots.forEach(([dx, dy], i) => {
    ctx.fillStyle = berryColors[i % berryColors.length];
    ctx.beginPath();
    ctx.arc(cx + s * dx, cy + s * dy, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(cx + s * dx - s * 0.04, cy + s * dy - s * 0.04, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawItemIcon(ctx, itemId, cx, cy, s) {
  ctx.save();
  switch (itemId) {
    case "potion":
      drawFlaskIcon(ctx, cx, cy, s, "#c9534f");
      break;
    case "hi_potion":
      drawFlaskIcon(ctx, cx, cy, s, "#e8935a");
      break;
    case "ether":
      drawFlaskIcon(ctx, cx, cy, s, "#4f8dae");
      break;
    case "iron_sword":
    case "bronze_sword":
      drawSwordIcon(ctx, cx, cy, s);
      break;
    case "wolf_dagger":
      drawDaggerIcon(ctx, cx, cy, s);
      break;
    case "wooden_staff":
      drawStaffIcon(ctx, cx, cy, s, "#7aa9c9");
      break;
    case "magic_staff_1":
      drawStaffIcon(ctx, cx, cy, s, "#8e6fce");
      break;
    case "traveler_charm":
      drawCharmIcon(ctx, cx, cy, s);
      break;
    case "slime_gel":
      drawDropletIcon(ctx, cx, cy, s, "#59c46b");
      break;
    case "wolf_fang":
      drawFangIcon(ctx, cx, cy, s);
      break;
    case "old_locket":
      drawLocketIcon(ctx, cx, cy, s);
      break;
    case "stick":
      drawStickIcon(ctx, cx, cy, s);
      break;
    case "flint":
      drawFlintIcon(ctx, cx, cy, s);
      break;
    case "campfire":
      drawCampfireIcon(ctx, cx, cy, s);
      break;
    case "log":
      drawLogIcon(ctx, cx, cy, s);
      break;
    case "stone":
      drawStoneIcon(ctx, cx, cy, s);
      break;
    case "sand":
      drawSandIcon(ctx, cx, cy, s);
      break;
    case "iron_ore":
      drawOreIcon(ctx, cx, cy, s, "#cfd8cf");
      break;
    case "copper_ore":
      drawOreIcon(ctx, cx, cy, s, "#e0895a");
      break;
    case "axe":
      drawAxeIcon(ctx, cx, cy, s);
      break;
    case "pickaxe":
      drawPickaxeIcon(ctx, cx, cy, s);
      break;
    case "bridge":
      drawBridgeIcon(ctx, cx, cy, s);
      break;
    case "furnace":
      drawFurnaceIcon(ctx, cx, cy, s);
      break;
    case "iron_ingot":
      drawIngotIcon(ctx, cx, cy, s, "#c7cdd4");
      break;
    case "copper_ingot":
      drawIngotIcon(ctx, cx, cy, s, "#c97a4a");
      break;
    case "crafting_table":
      drawCraftingTableIcon(ctx, cx, cy, s);
      break;
    case "gold":
      drawGoldIcon(ctx, cx, cy, s);
      break;
    case "healing_herb":
      drawHerbIcon(ctx, cx, cy, s);
      break;
    case "moonleaf":
      drawMoonleafIcon(ctx, cx, cy, s);
      break;
    case "bed":
      drawBedIcon(ctx, cx, cy, s);
      break;
    case "table":
      drawTableIcon(ctx, cx, cy, s);
      break;
    case "chair":
      drawChairIcon(ctx, cx, cy, s);
      break;
    case "bookshelf":
      drawBookshelfIcon(ctx, cx, cy, s);
      break;
    case "chest":
      drawChestIcon(ctx, cx, cy, s);
      break;
    case "cabinet":
      drawCabinetIcon(ctx, cx, cy, s);
      break;
    case "weapon_rack":
      drawWeaponRackIcon(ctx, cx, cy, s);
      break;
    case "fireplace":
      drawFireplaceIcon(ctx, cx, cy, s);
      break;
    case "basic_trap":
      drawTrapIcon(ctx, cx, cy, s);
      break;
    case "rabbit_meat":
      drawRabbitMeatIcon(ctx, cx, cy, s);
      break;
    case "fishing_rod":
      drawFishingRodIcon(ctx, cx, cy, s);
      break;
    case "fish_small":
      drawFishIcon(ctx, cx, cy, s * 0.6, "#7aa9c9");
      break;
    case "fish_medium":
      drawFishIcon(ctx, cx, cy, s * 0.8, "#5c8fae");
      break;
    case "fish_large":
      drawFishIcon(ctx, cx, cy, s, "#4a7a9a");
      break;
    case "fish_extra_large":
      drawFishIcon(ctx, cx, cy, s * 1.15, "#3a6a8a");
      break;
    case "fish_golden":
      drawFishIcon(ctx, cx, cy, s * 0.9, "#e8c97a");
      break;
    case "berry":
      drawBerryIcon(ctx, cx, cy, s);
      break;
    case "empty_flask":
      drawFlaskIcon(ctx, cx, cy, s, "rgba(255,255,255,0.1)");
      break;
    case "dirty_water":
      drawFlaskIcon(ctx, cx, cy, s, "#6b5a3a");
      break;
    case "purified_water":
      drawFlaskIcon(ctx, cx, cy, s, "#bfe0f0");
      break;
    default:
      drawGenericIcon(ctx, cx, cy, s);
      break;
  }
  ctx.restore();
}

function drawPortrait(ctx, cx, cy, radius, color) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius + 8, radius * 0.8, radius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2e17";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(cx, cy + radius * 0.4, radius * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- slot + panel drawing ---------------------------------------------------

function drawItemSlot(ctx, x, y, size, entry, selected) {
  ctx.fillStyle = selected ? "rgba(232,201,122,0.18)" : "rgba(20,28,20,0.75)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = selected ? "#e8c97a" : "rgba(199,167,95,0.35)";
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

  if (!entry) return;
  drawItemIcon(ctx, entry.item, x + size / 2, y + size / 2 - 2, size * 0.6);

  if (entry.qty > 1) {
    const badgeR = 10;
    const bx = x + size - badgeR - 1;
    const by = y + size - badgeR - 1;
    ctx.fillStyle = "rgba(10,14,12,0.9)";
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f2f2ec";
    ctx.font = "bold 11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(entry.qty), bx, by + 4);
    ctx.textAlign = "left";
  }
}

function renderPlayerPanel(ctx, state, x, y, w, h) {
  const p = state.player;

  const portraitH = 118;
  ctx.fillStyle = "rgba(20,28,20,0.5)";
  ctx.fillRect(x, y, w, portraitH);
  ctx.strokeStyle = "rgba(232,201,122,0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, portraitH);
  drawPortrait(ctx, x + w / 2, y + portraitH / 2 - 4, 32, "#f2d9a0");

  const eqY = y + portraitH + 14;
  const eqSize = 52;
  const eqGap = (w - eqSize * 2) / 3;
  const weaponEntry = p.weapon ? { item: p.weapon, qty: 1 } : null;
  const accessoryEntry = p.accessory ? { item: p.accessory, qty: 1 } : null;
  const weaponX = x + eqGap, accessoryX = x + eqGap * 2 + eqSize;
  drawItemSlot(ctx, weaponX, eqY, eqSize, weaponEntry, false);
  drawItemSlot(ctx, accessoryX, eqY, eqSize, accessoryEntry, false);
  // Tracked so a dragged hotbar item can be shown glowing red here - it's
  // never a valid drop target for a consumable.
  state.uiHitboxes.equipSlots = [
    { slot: "weapon", x: weaponX, y: eqY, w: eqSize, h: eqSize },
    { slot: "accessory", x: accessoryX, y: eqY, w: eqSize, h: eqSize },
  ];

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "10px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Weapon", x + eqGap + eqSize / 2, eqY + eqSize + 13);
  ctx.fillText("Accessory", x + eqGap * 2 + eqSize + eqSize / 2, eqY + eqSize + 13);
  ctx.textAlign = "left";

  const className = p.class === "mage" ? "Mage" : p.class === "swordsman" ? "Swordsman" : "Traveler";
  let sy = eqY + eqSize + 34;
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.fillText(`Lv.${p.level} ${className}`, x, sy);
  sy += 16;

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText(`EXP ${p.exp}/${p.expToNext}`, x, sy);
  drawBar(ctx, x, sy + 5, w, 7, p.exp / p.expToNext, "#8e6fce");
  sy += 22;

  ctx.fillStyle = "#f2f2ec";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, x, sy);
  drawBar(ctx, x, sy + 5, w, 9, p.hp / p.maxHp, "#4fae5a");
  sy += 24;

  ctx.fillText(`MP ${p.mp}/${p.maxMp}`, x, sy);
  drawBar(ctx, x, sy + 5, w, 9, p.mp / p.maxMp, "#4f8dae");
  sy += 26;

  const atkBonus = p.weapon ? ITEMS[p.weapon].atkBonus || 0 : 0;
  const defBonus = p.accessory ? ITEMS[p.accessory].defBonus || 0 : 0;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(`ATK ${playerAtk(p)}${atkBonus ? ` (+${atkBonus})` : ""}`, x, sy);
  ctx.fillText(`DEF ${playerDef(p)}${defBonus ? ` (+${defBonus})` : ""}`, x + w / 2, sy);
  sy += 20;
  ctx.fillText(`Gold ${p.gold}`, x, sy);
}

function renderInventoryTab(ctx, state, x, y, w, h) {
  const p = state.player;

  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  // category filter tabs (above the item grid, left column only)
  const catH = 26;
  const catGap = 6;
  const catW = (leftW - catGap * (ITEM_CATEGORIES.length - 1)) / ITEM_CATEGORIES.length;
  state.uiHitboxes.invCategoryTabs = [];
  ITEM_CATEGORIES.forEach((cat, i) => {
    const cx = x + i * (catW + catGap);
    const active = i === state.menuFilterIndex;
    ctx.fillStyle = active ? "#e8c97a" : "rgba(232,201,122,0.12)";
    ctx.fillRect(cx, y, catW, catH);
    ctx.strokeStyle = "rgba(232,201,122,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, y, catW, catH);
    ctx.fillStyle = active ? "#1a1206" : "#cfd8cf";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cat.label, cx + catW / 2, y + catH / 2 + 4);
    state.uiHitboxes.invCategoryTabs.push({ index: i, x: cx, y, w: catW, h: catH });
  });
  ctx.textAlign = "left";

  const hotbarAreaH = 96; // hunger/thirst bars + label + one row of hotbar slots, reserved below the grid
  const gridY = y + catH + 14;
  const gridH = h - catH - 14 - 28 - hotbarAreaH;

  const items = getFilteredInventory(state, currentCategory(state));
  const slotSize = 54;
  const slotGap = 8;
  const rows = Math.max(3, Math.min(5, Math.floor((gridH + slotGap) / (slotSize + slotGap))));

  state.uiHitboxes.invSlots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < INVENTORY_GRID_COLS; c++) {
      const idx = r * INVENTORY_GRID_COLS + c;
      const sx = x + c * (slotSize + slotGap);
      const sy = gridY + r * (slotSize + slotGap);
      const entry = items[idx] || null;
      drawItemSlot(ctx, sx, sy, slotSize, entry, idx === state.menuCursor && !!entry);
      if (entry) state.uiHitboxes.invSlots.push({ idx, x: sx, y: sy, w: slotSize, h: slotSize });
    }
  }

  if (items.length === 0) {
    const gridW = INVENTORY_GRID_COLS * (slotSize + slotGap) - slotGap;
    ctx.fillStyle = "#9aa89a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("(nothing in this category yet)", x + gridW / 2, gridY + (rows * (slotSize + slotGap)) / 2);
    ctx.textAlign = "left";
  }

  const statsY = gridY + rows * (slotSize + slotGap) + 14;
  const statsW = HOTBAR_SIZE * 30 + (HOTBAR_SIZE - 1) * Math.max(3, Math.round(30 * 0.18));
  const rowH = 15, barH = 5;
  ctx.font = "10px 'Segoe UI', sans-serif";
  ctx.fillStyle = p.hunger <= 0 ? "#e88a5a" : "#cfd8cf";
  ctx.fillText(`Hunger ${Math.ceil(p.hunger)}/${HUNGER_MAX}`, x, statsY);
  drawBar(ctx, x, statsY + 3, statsW, barH, p.hunger / HUNGER_MAX, "#c9a03a");
  ctx.fillStyle = p.thirst <= 0 ? "#e88a5a" : "#cfd8cf";
  ctx.fillText(`Thirst ${Math.ceil(p.thirst)}/${THIRST_MAX}`, x, statsY + rowH);
  drawBar(ctx, x, statsY + rowH + 3, statsW, barH, p.thirst / THIRST_MAX, "#4f8dae");

  const hotbarLabelY = statsY + rowH * 2 + 10;
  ctx.fillStyle = "#8a9a8a";
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText("Hotbar - drag a potion here to assign 1-9 (click an assigned slot to remove):", x, hotbarLabelY);
  renderHotbarRow(ctx, state, x, hotbarLabelY + 8, 30, "invHotbarSlots");

  const descY = y + h - 6;
  const selected = items[state.menuCursor];
  ctx.font = "13px 'Segoe UI', sans-serif";
  if (selected) {
    const data = ITEMS[selected.item];
    const tag = selected.item === p.weapon || selected.item === p.accessory ? " (equipped)" : "";
    ctx.fillStyle = "#e8c97a";
    ctx.fillText(`${data.name}${tag}`, x, descY - 15);
    ctx.fillStyle = "#cfd8cf";
    ctx.fillText(data.desc, x, descY);
  } else {
    ctx.fillStyle = "#9aa89a";
    ctx.fillText("Select an item to see its details.", x, descY);
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
  renderHotbarDragOverlay(ctx, state, "invHotbarSlots");
}
