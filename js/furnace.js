// ---------------------------------------------------------------------------
// Furnace: short press to smelt ore into ingots, long press (with a
// Pickaxe) to break it back down into inventory
// ---------------------------------------------------------------------------

const SMELTING_RECIPES = [
  { id: "iron_ingot", name: "Iron Ingot", result: "iron_ingot", resultQty: 1, ore: "iron_ore", oreQty: 1 },
  { id: "copper_ingot", name: "Copper Ingot", result: "copper_ingot", resultQty: 1, ore: "copper_ore", oreQty: 1 },
  { id: "purified_water", name: "Purified Water", result: "purified_water", resultQty: 1, ore: "dirty_water", oreQty: 1, verb: "Boiled" },
];
const FURNACE_FUEL_ITEMS = ["log", "stick"];

function findFuel(state) {
  for (const id of FURNACE_FUEL_ITEMS) {
    if (getIngredientCount(state, id) > 0) return id;
  }
  return null;
}

function canSmelt(state, recipe) {
  return getIngredientCount(state, recipe.ore) >= recipe.oreQty && !!findFuel(state);
}

function smelt(state, recipe) {
  const fuel = findFuel(state);
  if (getIngredientCount(state, recipe.ore) < recipe.oreQty || !fuel) {
    state.menuFlashMessage = "Not enough ore or fuel.";
    state.menuFlashUntil = performance.now() + 1400;
    return;
  }
  const oreEntry = state.player.inventory.find((i) => i.item === recipe.ore);
  oreEntry.qty -= recipe.oreQty;
  const fuelEntry = state.player.inventory.find((i) => i.item === fuel);
  fuelEntry.qty -= 1;
  state.player.inventory = state.player.inventory.filter((i) => i.qty > 0);
  addItem(state, recipe.result, recipe.resultQty);
  state.menuFlashMessage = `${recipe.verb || "Smelted"} ${ITEMS[recipe.result].name} (used ${ITEMS[fuel].name} as fuel).`;
  state.menuFlashUntil = performance.now() + 1600;
}

function updateFurnaceUI(state) {
  if (Input.cancelPressed() || Input.menuPressed()) {
    state.mode = "OVERWORLD";
    return;
  }
  if (Input.wasPressed("ArrowUp")) state.furnaceCursor = Math.max(0, state.furnaceCursor - 1);
  if (Input.wasPressed("ArrowDown")) state.furnaceCursor = Math.min(SMELTING_RECIPES.length - 1, state.furnaceCursor + 1);
  if (Input.confirmPressed()) smelt(state, SMELTING_RECIPES[state.furnaceCursor]);
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.furnaceCards || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      state.furnaceCursor = hit.idx;
      smelt(state, SMELTING_RECIPES[hit.idx]);
      Input.clickPos = null;
    }
  }
}

function renderFurnaceUI(ctx, state, canvasW, canvasH) {
  const panelX = 60, panelY = 40, panelW = canvasW - 120, panelH = canvasH - 80;
  ctx.fillStyle = "rgba(6,10,8,0.92)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  drawPixelFrameCorners(ctx, panelX, panelY, panelW, panelH, 16, "#e8c97a");

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 20px 'Segoe UI', sans-serif";
  ctx.fillText("Furnace", panelX + 30, panelY + 36);

  const x = panelX + 30, y = panelY + 56;
  const w = panelW - 60, h = panelH - 56 - 44;
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  const cardH = 78, cardGap = 8;
  const fuel = findFuel(state);
  state.uiHitboxes.furnaceCards = [];
  SMELTING_RECIPES.forEach((recipe, i) => {
    const cy = y + i * (cardH + cardGap);
    state.uiHitboxes.furnaceCards.push({ idx: i, x, y: cy, w: leftW, h: cardH });
    const selected = state.furnaceCursor === i;
    ctx.fillStyle = selected ? "rgba(232,201,122,0.18)" : "rgba(20,28,20,0.75)";
    ctx.fillRect(x, cy, leftW, cardH);
    ctx.strokeStyle = selected ? "#e8c97a" : "rgba(199,167,95,0.35)";
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.strokeRect(x + 1, cy + 1, leftW - 2, cardH - 2);

    drawItemIcon(ctx, recipe.result, x + 44, cy + cardH / 2, 48);

    ctx.fillStyle = "#e8c97a";
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillText(recipe.name, x + 84, cy + 24);

    ctx.font = "12px 'Segoe UI', sans-serif";
    const oreHave = getIngredientCount(state, recipe.ore);
    ctx.fillStyle = oreHave >= recipe.oreQty ? "#7cd68a" : "#e88a5a";
    ctx.fillText(`${ITEMS[recipe.ore].name} ${oreHave}/${recipe.oreQty}`, x + 84, cy + 44);

    ctx.fillStyle = fuel ? "#7cd68a" : "#e88a5a";
    ctx.fillText(fuel ? `Fuel: ${ITEMS[fuel].name}` : "Fuel: none (need Stick or Log)", x + 84, cy + 62);
  });

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Arrows: select   Enter: smelt   Esc/I: leave", x, y + h - 6);

  if (performance.now() < state.menuFlashUntil) {
    ctx.fillStyle = "#7cd68a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(state.menuFlashMessage, panelX + panelW - 16, panelY + 24);
    ctx.textAlign = "left";
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}

function openFurnace(state, furnaceObj) {
  state.mode = "FURNACE";
  state.furnaceCursor = 0;
  state.furnaceTarget = { x: furnaceObj.x, y: furnaceObj.y };
}

function pickUpFurnace(state, furnaceObj) {
  if (!hasItem(state, "pickaxe")) {
    state.worldFlashMessage = "You need a Pickaxe to break this down.";
    state.worldFlashUntil = performance.now() + 1400;
    return;
  }
  state.placedObjects = state.placedObjects.filter((o) => o !== furnaceObj);
  addItem(state, "furnace", 1);
  state.worldFlashMessage = "Picked up the Furnace.";
  state.worldFlashUntil = performance.now() + 1400;
}

function updateFurnaceHold(state, furnaceObj) {
  const fh = state.furnaceHold;
  if (Input.confirmDown()) {
    if (!fh.active) {
      fh.active = true;
      fh.longFired = false;
    }
    if (Input.confirmHeldMs() >= FURNACE_LONG_PRESS_MS && !fh.longFired) {
      fh.longFired = true;
      pickUpFurnace(state, furnaceObj);
    }
  } else {
    if (fh.active && !fh.longFired) {
      openFurnace(state, furnaceObj);
    }
    fh.active = false;
    fh.longFired = false;
  }
}
