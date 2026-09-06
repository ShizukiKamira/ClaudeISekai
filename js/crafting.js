// ---------------------------------------------------------------------------
// Crafting tab: combine gathered materials into placeable items
// ---------------------------------------------------------------------------

function getIngredientCount(state, itemId) {
  const entry = state.player.inventory.find((i) => i.item === itemId);
  return entry ? entry.qty : 0;
}

function canCraft(state, recipe) {
  return recipe.ingredients.every((ing) => getIngredientCount(state, ing.item) >= ing.qty);
}

function craftRecipe(state, recipe) {
  if (!canCraft(state, recipe)) {
    state.menuFlashMessage = "Not enough materials.";
    state.menuFlashUntil = performance.now() + 1400;
    return;
  }
  for (const ing of recipe.ingredients) {
    const entry = state.player.inventory.find((i) => i.item === ing.item);
    entry.qty -= ing.qty;
  }
  state.player.inventory = state.player.inventory.filter((i) => i.qty > 0);
  addItem(state, recipe.result, recipe.resultQty);
  state.menuFlashMessage = `Crafted ${ITEMS[recipe.result].name}.`;
  state.menuFlashUntil = performance.now() + 1400;
}

function updateCraftingTab(state) {
  const recipes = CRAFTING_RECIPES;
  if (recipes.length === 0) return;
  if (Input.wasPressed("ArrowUp")) {
    state.craftCursor = Math.max(0, state.craftCursor - 1);
  }
  if (Input.wasPressed("ArrowDown")) {
    state.craftCursor = Math.min(recipes.length - 1, state.craftCursor + 1);
  }
  if (Input.confirmPressed()) {
    craftRecipe(state, recipes[state.craftCursor]);
  }
}

function renderCraftingTab(ctx, state, x, y, w, h) {
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  const recipes = CRAFTING_RECIPES;
  const cardH = 84;
  const cardGap = 10;

  recipes.forEach((recipe, i) => {
    const cy = y + i * (cardH + cardGap);
    const selected = state.craftCursor === i;
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
    recipe.ingredients.forEach((ing, j) => {
      const have = getIngredientCount(state, ing.item);
      const enough = have >= ing.qty;
      ctx.fillStyle = enough ? "#7cd68a" : "#e88a5a";
      ctx.fillText(`${ITEMS[ing.item].name} ${have}/${ing.qty}`, x + 84, cy + 44 + j * 18);
    });
  });

  if (recipes.length === 0) {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("No recipes known yet.", x, y + 20);
  }

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Craft it, then select it from your Inventory to place it in the world.", x, y + h - 6);

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}
