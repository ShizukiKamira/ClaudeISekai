// ---------------------------------------------------------------------------
// Merchant shop: buy from stock / sell inventory, same category-tab +
// icon-grid pattern as the inventory tab (see inventory.js)
// ---------------------------------------------------------------------------

const SHOP_GRID_COLS = 5;

function getOwnedQty(state, itemId) {
  const entry = state.player.inventory.find((i) => i.item === itemId);
  return entry ? entry.qty : 0;
}

function getShopListing(state) {
  const cat = ITEM_CATEGORIES[state.shop.filterIndex].id;
  if (state.shop.mode === "buy") {
    return MERCHANT_STOCK
      .filter((id) => ITEMS[id].category === cat)
      .map((id) => ({ item: id, qty: 1, price: ITEMS[id].value || 0 }));
  }
  return state.player.inventory
    .filter((entry) => ITEMS[entry.item].category === cat && ITEMS[entry.item].type !== "currency")
    .map((entry) => ({ item: entry.item, qty: entry.qty, price: Math.max(1, Math.floor((ITEMS[entry.item].value || 0) / 2)) }));
}

function updateShop(state) {
  if (Input.cancelPressed() || Input.menuPressed()) {
    state.mode = "OVERWORLD";
    return;
  }
  if (Input.wasPressed("KeyQ")) {
    state.shop.mode = state.shop.mode === "buy" ? "sell" : "buy";
    state.shop.cursor = 0;
  }
  if (Input.wasPressed("BracketLeft")) {
    state.shop.filterIndex = (state.shop.filterIndex - 1 + ITEM_CATEGORIES.length) % ITEM_CATEGORIES.length;
    state.shop.cursor = 0;
  }
  if (Input.wasPressed("BracketRight")) {
    state.shop.filterIndex = (state.shop.filterIndex + 1) % ITEM_CATEGORIES.length;
    state.shop.cursor = 0;
  }
  if (Input.clickPos) {
    const modeHit = (state.uiHitboxes.shopModeToggle || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    const catHit = !modeHit && (state.uiHitboxes.shopCategoryTabs || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (modeHit) {
      state.shop.mode = modeHit.mode;
      state.shop.cursor = 0;
      Input.clickPos = null;
    } else if (catHit) {
      state.shop.filterIndex = catHit.index;
      state.shop.cursor = 0;
      Input.clickPos = null;
    }
  }

  const listing = getShopListing(state);
  if (listing.length === 0) return;
  state.shop.cursor = Math.min(state.shop.cursor, listing.length - 1);

  if (Input.wasPressed("ArrowRight")) state.shop.cursor = Math.min(state.shop.cursor + 1, listing.length - 1);
  if (Input.wasPressed("ArrowLeft")) state.shop.cursor = Math.max(state.shop.cursor - 1, 0);
  if (Input.wasPressed("ArrowDown")) state.shop.cursor = Math.min(state.shop.cursor + SHOP_GRID_COLS, listing.length - 1);
  if (Input.wasPressed("ArrowUp")) state.shop.cursor = Math.max(state.shop.cursor - SHOP_GRID_COLS, 0);

  if (Input.confirmPressed()) {
    tradeShopItem(state, listing[state.shop.cursor]);
  }
  if (Input.clickPos) {
    const slotHit = (state.uiHitboxes.shopSlots || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (slotHit) {
      // First click on a slot just selects it (matches keyboard browsing);
      // a second click on the already-selected slot trades it - so a stray
      // click doesn't instantly spend gold on something you meant to inspect.
      if (state.shop.cursor === slotHit.idx) {
        tradeShopItem(state, listing[slotHit.idx]);
      } else {
        state.shop.cursor = slotHit.idx;
      }
      Input.clickPos = null;
    }
  }
}

function tradeShopItem(state, entry) {
  const p = state.player;
  if (state.shop.mode === "buy") {
    if (p.gold < entry.price) {
      state.shopFlashMessage = "Not enough gold.";
    } else {
      p.gold -= entry.price;
      addItem(state, entry.item, 1);
      state.shopFlashMessage = `Bought ${ITEMS[entry.item].name}.`;
      logEvent(state, `Bought ${ITEMS[entry.item].name} for ${entry.price} gold.`, "loot");
    }
  } else {
    p.gold += entry.price;
    const invEntry = p.inventory.find((i) => i.item === entry.item);
    if (invEntry) {
      invEntry.qty -= 1;
      if (invEntry.qty <= 0) {
        p.inventory = p.inventory.filter((i) => i.qty > 0);
        if (p.weapon === entry.item) p.weapon = null;
        if (p.accessory === entry.item) p.accessory = null;
      }
    }
    state.shopFlashMessage = `Sold ${ITEMS[entry.item].name}.`;
    logEvent(state, `Sold ${ITEMS[entry.item].name} for ${entry.price} gold.`, "info");
  }
  state.shopFlashUntil = performance.now() + 1200;
}

function renderShop(ctx, state, canvasW, canvasH) {
  const panelX = 60, panelY = 40, panelW = canvasW - 120, panelH = canvasH - 80;
  ctx.fillStyle = "rgba(6,10,8,0.92)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  drawPixelFrameCorners(ctx, panelX, panelY, panelW, panelH, 16, "#e8c97a");

  ctx.font = "bold 20px 'Segoe UI', sans-serif";
  let modeX = panelX + 30;
  const modeY = panelY + 36;
  state.uiHitboxes.shopModeToggle = [];
  [["buy", "Buy"], ["sell", "Sell"]].forEach(([mode, label]) => {
    const text = state.shop.mode === mode ? `> ${label} <` : label;
    ctx.fillStyle = state.shop.mode === mode ? "#e8c97a" : "#cfd8cf";
    ctx.fillText(text, modeX, modeY);
    const textW = ctx.measureText(text).width;
    state.uiHitboxes.shopModeToggle.push({ mode, x: modeX - 8, y: modeY - 22, w: textW + 16, h: 30 });
    modeX += textW + 24;
  });

  const x = panelX + 30, y = panelY + 56;
  const w = panelW - 60, h = panelH - 56 - 44;
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  const catH = 26, catGap = 6;
  const catW = (leftW - catGap * (ITEM_CATEGORIES.length - 1)) / ITEM_CATEGORIES.length;
  state.uiHitboxes.shopCategoryTabs = [];
  ITEM_CATEGORIES.forEach((cat, i) => {
    const cx = x + i * (catW + catGap);
    const active = i === state.shop.filterIndex;
    ctx.fillStyle = active ? "#e8c97a" : "rgba(232,201,122,0.12)";
    ctx.fillRect(cx, y, catW, catH);
    ctx.strokeStyle = "rgba(232,201,122,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, y, catW, catH);
    ctx.fillStyle = active ? "#1a1206" : "#cfd8cf";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cat.label, cx + catW / 2, y + catH / 2 + 4);
    state.uiHitboxes.shopCategoryTabs.push({ index: i, x: cx, y, w: catW, h: catH });
  });
  ctx.textAlign = "left";

  const gridY = y + catH + 14;
  const gridH = h - catH - 14 - 28;
  const listing = getShopListing(state);
  const slotSize = 54, slotGap = 8;
  const rows = Math.max(3, Math.min(5, Math.floor((gridH + slotGap) / (slotSize + slotGap))));

  state.uiHitboxes.shopSlots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < SHOP_GRID_COLS; c++) {
      const idx = r * SHOP_GRID_COLS + c;
      const sx = x + c * (slotSize + slotGap);
      const sy = gridY + r * (slotSize + slotGap);
      const item = listing[idx];
      const entry = item ? { item: item.item, qty: item.qty } : null;
      drawItemSlot(ctx, sx, sy, slotSize, entry, idx === state.shop.cursor && !!entry);
      // While buying, show how many of this item the player already has -
      // the sell-mode badge already shows this (its qty IS the owned count),
      // so this only applies on the buy side.
      if (item && state.shop.mode === "buy") {
        const owned = getOwnedQty(state, item.item);
        if (owned > 0) {
          ctx.fillStyle = "rgba(10,14,12,0.85)";
          ctx.font = "bold 10px 'Segoe UI', sans-serif";
          const label = `(${owned})`;
          const labelW = ctx.measureText(label).width;
          ctx.fillRect(sx + 1, sy + 1, labelW + 6, 13);
          ctx.fillStyle = "#9adf7a";
          ctx.fillText(label, sx + 4, sy + 11);
        }
      }
      if (item) state.uiHitboxes.shopSlots.push({ idx, x: sx, y: sy, w: slotSize, h: slotSize });
    }
  }

  if (listing.length === 0) {
    const gridW = SHOP_GRID_COLS * (slotSize + slotGap) - slotGap;
    ctx.fillStyle = "#9aa89a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    const label = state.shop.mode === "buy" ? "(nothing in stock)" : "(nothing to sell)";
    ctx.fillText(label, x + gridW / 2, gridY + (rows * (slotSize + slotGap)) / 2);
    ctx.textAlign = "left";
  }

  const descY = y + h - 6;
  const selected = listing[state.shop.cursor];
  ctx.font = "13px 'Segoe UI', sans-serif";
  if (selected) {
    const data = ITEMS[selected.item];
    ctx.fillStyle = "#e8c97a";
    ctx.fillText(`${data.name} - ${selected.price}g`, x, descY - 15);
    ctx.fillStyle = "#cfd8cf";
    ctx.fillText(data.desc, x, descY);
  } else {
    ctx.fillStyle = "#9aa89a";
    ctx.fillText("Select an item to trade.", x, descY);
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);

  if (performance.now() < state.shopFlashUntil) {
    ctx.fillStyle = "#7cd68a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(state.shopFlashMessage, panelX + panelW - 16, panelY + 24);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Click to browse/trade, or: Q buy/sell   [ ] category   Arrows browse   Enter trade   Esc/I leave", panelX + 30, panelY + panelH - 16);
}
