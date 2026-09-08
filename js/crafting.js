// ---------------------------------------------------------------------------
// Crafting tab: combine gathered materials into placeable items. Recipes
// flagged requiresTable only appear while standing near a placed
// Crafting Table.
// ---------------------------------------------------------------------------

const CRAFTING_GRID_COLS = 2;

function getIngredientCount(state, itemId) {
  const entry = state.player.inventory.find((i) => i.item === itemId);
  return entry ? entry.qty : 0;
}

function getIngredientSets(recipe) {
  return recipe.altIngredients || [recipe.ingredients];
}

function findSatisfiableSet(state, recipe) {
  return getIngredientSets(recipe).find((set) => set.every((ing) => getIngredientCount(state, ing.item) >= ing.qty)) || null;
}

function canCraft(state, recipe) {
  return findSatisfiableSet(state, recipe) !== null;
}

function isNearCraftingTable(state) {
  return state.placedObjects.some(
    (o) => o.type === "crafting_table" && chebyshevDist(state.player.tileX, state.player.tileY, o.x, o.y) <= 1
  );
}

function getAvailableRecipes(state) {
  const nearTable = isNearCraftingTable(state);
  return CRAFTING_RECIPES.filter((r) => !r.requiresTable || nearTable);
}

function craftRecipe(state, recipe) {
  const set = findSatisfiableSet(state, recipe);
  if (!set) {
    state.menuFlashMessage = "Not enough materials.";
    state.menuFlashUntil = performance.now() + 1400;
    return;
  }
  for (const ing of set) {
    const entry = state.player.inventory.find((i) => i.item === ing.item);
    entry.qty -= ing.qty;
  }
  state.player.inventory = state.player.inventory.filter((i) => i.qty > 0);
  addItem(state, recipe.result, recipe.resultQty);
  state.menuFlashMessage = `Crafted ${ITEMS[recipe.result].name}.`;
  state.menuFlashUntil = performance.now() + 1400;
  logEvent(state, state.menuFlashMessage, "loot");
}

// Shared by update (to decide scroll clamping/follow) and render (to lay out
// cards) so the two never disagree about how many rows fit or exist.
function craftingLayout(recipeCount) {
  const cardH = 82, cardGap = 8, hintH = 22;
  // Mirrors renderMenu's call: panelH(canvas.height - 80) - 96 - 44.
  const h = canvas.height - 220;
  const gridH = h - hintH;
  const visibleRows = Math.max(1, Math.floor((gridH + cardGap) / (cardH + cardGap)));
  const totalRows = Math.max(1, Math.ceil(recipeCount / CRAFTING_GRID_COLS));
  return { visibleRows, totalRows };
}

function updateCraftingTab(state) {
  const recipes = getAvailableRecipes(state);
  if (recipes.length === 0) return;
  state.craftCursor = Math.min(state.craftCursor, recipes.length - 1);
  const cursorBefore = state.craftCursor;
  if (Input.wasPressed("ArrowRight")) state.craftCursor = Math.min(state.craftCursor + 1, recipes.length - 1);
  if (Input.wasPressed("ArrowLeft")) state.craftCursor = Math.max(state.craftCursor - 1, 0);
  if (Input.wasPressed("ArrowDown")) state.craftCursor = Math.min(state.craftCursor + CRAFTING_GRID_COLS, recipes.length - 1);
  if (Input.wasPressed("ArrowUp")) state.craftCursor = Math.max(state.craftCursor - CRAFTING_GRID_COLS, 0);

  const { visibleRows, totalRows } = craftingLayout(recipes.length);
  let scroll = state.craftScroll || 0;
  // Only force the view to follow the selection when the keyboard just
  // moved it - a mouse-wheel scroll (below) doesn't touch the cursor, so it
  // must not get snapped straight back to the cursor's row every frame.
  if (state.craftCursor !== cursorBefore) {
    const cursorRow = Math.floor(state.craftCursor / CRAFTING_GRID_COLS);
    if (cursorRow < scroll) scroll = cursorRow;
    if (cursorRow > scroll + visibleRows - 1) scroll = cursorRow - visibleRows + 1;
  }
  if (Input.wheelDelta) {
    scroll += Input.wheelDelta > 0 ? 1 : -1;
    Input.wheelDelta = 0;
  }
  state.craftScroll = Math.max(0, Math.min(scroll, Math.max(0, totalRows - visibleRows)));

  if (Input.confirmPressed()) {
    craftRecipe(state, recipes[state.craftCursor]);
  }
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.craftCards || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      // First click on a card just selects it; a second click on the
      // already-selected card crafts it - mirrors the inventory's
      // select-then-use pattern so a stray click doesn't burn materials.
      if (state.craftCursor === hit.idx) {
        craftRecipe(state, recipes[hit.idx]);
      } else {
        state.craftCursor = hit.idx;
      }
      Input.clickPos = null;
    }
  }
}

function renderCraftingTab(ctx, state, x, y, w, h) {
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  const recipes = getAvailableRecipes(state);
  const cols = CRAFTING_GRID_COLS;
  const cardGap = 8;
  const cardW = Math.floor((leftW - cardGap * (cols - 1)) / cols);
  const cardH = 82;

  // Reserve a line at the bottom for the hint text so the card grid never
  // grows into it - instead, once more rows exist than fit, the list
  // scrolls (via updateCraftingTab, which follows the keyboard cursor or a
  // mouse-wheel scroll) rather than overflowing. Render just clamps what
  // it's handed, so it never fights that decision.
  const { visibleRows, totalRows } = craftingLayout(recipes.length);
  const scroll = Math.max(0, Math.min(state.craftScroll || 0, Math.max(0, totalRows - visibleRows)));
  state.craftScroll = scroll;

  state.uiHitboxes.craftCards = [];
  recipes.forEach((recipe, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (row < scroll || row >= scroll + visibleRows) return;
    const cx0 = x + col * (cardW + cardGap);
    const cy = y + (row - scroll) * (cardH + cardGap);
    state.uiHitboxes.craftCards.push({ idx: i, x: cx0, y: cy, w: cardW, h: cardH });
    const selected = state.craftCursor === i;
    ctx.fillStyle = selected ? "rgba(232,201,122,0.18)" : "rgba(20,28,20,0.75)";
    ctx.fillRect(cx0, cy, cardW, cardH);
    ctx.strokeStyle = selected ? "#e8c97a" : "rgba(199,167,95,0.35)";
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.strokeRect(cx0 + 1, cy + 1, cardW - 2, cardH - 2);

    drawItemIcon(ctx, recipe.result, cx0 + 34, cy + cardH / 2, 40);

    ctx.fillStyle = "#e8c97a";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(recipe.name, cx0 + 62, cy + 20);

    ctx.font = "11px 'Segoe UI', sans-serif";
    const sets = getIngredientSets(recipe);
    let rowIndex = 0;
    sets.forEach((set, si) => {
      set.forEach((ing) => {
        const have = getIngredientCount(state, ing.item);
        const enough = have >= ing.qty;
        ctx.fillStyle = enough ? "#7cd68a" : "#e88a5a";
        const prefix = si > 0 && ing === set[0] ? "or " : "";
        ctx.fillText(`${prefix}${ITEMS[ing.item].name} ${have}/${ing.qty}`, cx0 + 62, cy + 38 + rowIndex * 15);
        rowIndex++;
      });
    });
  });

  if (recipes.length === 0) {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("No recipes known yet.", x, y + 20);
  }

  // Scroll indicators, only shown when there's more content in that direction.
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 12px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  if (scroll > 0) ctx.fillText("▲", x + leftW / 2, y - 4);
  if (scroll + visibleRows < totalRows) {
    ctx.fillText("▼", x + leftW / 2, y + visibleRows * (cardH + cardGap) + 4);
  }
  ctx.textAlign = "left";

  const nearTable = isNearCraftingTable(state);
  const hasHiddenTableRecipes = !nearTable && CRAFTING_RECIPES.some((r) => r.requiresTable);
  ctx.fillStyle = "#8a9a8a";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(
    hasHiddenTableRecipes
      ? "Some recipes need a nearby Crafting Table to unlock."
      : "Craft it, then select it from your Inventory to place it in the world.",
    x,
    y + h - 6
  );

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}
