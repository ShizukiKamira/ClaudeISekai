// ---------------------------------------------------------------------------
// Game bootstrap: state container, title/menu screens, main loop
// ---------------------------------------------------------------------------

const SAVE_KEY = "isekai_whispering_wood_save";
const MENU_TABS = ["inventory", "skills", "crafting"];
const MENU_TAB_LABELS = { inventory: "Inventory", skills: "Skills", crafting: "Crafting" };

function createInitialState() {
  const state = {
    mode: "TITLE", // TITLE | INTRO | OVERWORLD | MENU | SHOP | FURNACE | GAMEOVER | VICTORY
    map: buildMap(),
    npcs: NPCS,
    monsters: [],
    projectiles: [],
    itemPickups: JSON.parse(JSON.stringify(ITEM_PICKUPS)),
    placedObjects: [],
    placingItem: null,
    player: createPlayer(),
    flags: { metFox: false, bossDefeated: false },
    turnCount: 0,
    titleCursor: 0,
    classCursor: 0,
    menuCursor: 0,
    menuTab: "inventory", // inventory | skills | crafting
    menuFilterIndex: 0,
    menuFlashMessage: "",
    menuFlashUntil: 0,
    craftCursor: 0,
    shop: { mode: "buy", filterIndex: 0, cursor: 0 },
    shopFlashMessage: "",
    shopFlashUntil: 0,
    worldFlashMessage: "",
    worldFlashUntil: 0,
    furnaceHold: { active: false, longFired: false },
    furnaceCursor: 0,
    furnaceTarget: null,
    // Clickable regions from the most recent render, keyed by screen (e.g.
    // uiHitboxes.craftCards). Populated by each render*() call, read back by
    // the matching update*() call on the next frame.
    uiHitboxes: {},
  };
  spawnInitialMonsters(state, INITIAL_FIELD_MONSTERS);
  return state;
}

let state = createInitialState();

function hasSaveGame() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

function saveGame(s) {
  try {
    const payload = {
      player: s.player,
      flags: s.flags,
      itemPickups: s.itemPickups,
      placedObjects: s.placedObjects,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

function loadGame(s) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    s.player = Object.assign(createPlayer(), payload.player);
    s.flags = payload.flags || s.flags;
    s.itemPickups = payload.itemPickups || s.itemPickups;
    s.placedObjects = payload.placedObjects || s.placedObjects;
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
// Setting canvas.width/height resets the 2D context state, so disable
// smoothing (for a crisp pixel-fantasy look) only after resizing.
canvas.width = VIEWPORT_COLS * TILE_SIZE;
canvas.height = VIEWPORT_ROWS * TILE_SIZE;
ctx.imageSmoothingEnabled = false;

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  Input.clickPos = {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
});

function pointInRect(px, py, box) {
  return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;
}

const Camera = { x: 0, y: 0 };

function updateCamera(state) {
  const mapPixelW = state.map[0].length * TILE_SIZE;
  const mapPixelH = state.map.length * TILE_SIZE;
  const targetX = state.player.pixelX + TILE_SIZE / 2 - canvas.width / 2;
  const targetY = state.player.pixelY + TILE_SIZE / 2 - canvas.height / 2;
  Camera.x = Math.max(0, Math.min(targetX, Math.max(0, mapPixelW - canvas.width)));
  Camera.y = Math.max(0, Math.min(targetY, Math.max(0, mapPixelH - canvas.height)));
}

Input.init();

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  render();

  Input.endFrame();
  requestAnimationFrame(loop);
}

function update(dt) {
  switch (state.mode) {
    case "TITLE":
      updateTitle();
      break;
    case "CLASS_SELECT":
      updateClassSelect();
      break;
    case "INTRO":
      Dialogue.update();
      break;
    case "OVERWORLD":
      updateOverworld(dt);
      break;
    case "MENU":
      updateMenu();
      break;
    case "SHOP":
      updateShop(state);
      break;
    case "FURNACE":
      updateFurnaceUI(state);
      break;
    case "GAMEOVER":
      if (Input.confirmPressed()) {
        state = createInitialState();
      }
      break;
    case "VICTORY":
      if (Input.confirmPressed()) {
        state = createInitialState();
      }
      break;
  }
}

function updateTitle() {
  const options = hasSaveGame() ? ["New Game", "Continue", "How to Play"] : ["New Game", "How to Play"];
  if (Input.wasPressed("ArrowUp") || Input.wasPressed("KeyW")) {
    state.titleCursor = (state.titleCursor - 1 + options.length) % options.length;
  }
  if (Input.wasPressed("ArrowDown") || Input.wasPressed("KeyS")) {
    state.titleCursor = (state.titleCursor + 1) % options.length;
  }
  if (Input.confirmPressed()) {
    const choice = options[state.titleCursor];
    if (choice === "New Game") {
      state = createInitialState();
      state.mode = "CLASS_SELECT";
      state.classCursor = 0;
    } else if (choice === "Continue") {
      loadGame(state);
      state.mode = "OVERWORLD";
    } else if (choice === "How to Play") {
      state.mode = "INTRO";
      Dialogue.show([
        "Arrow keys / WASD to move. Enter / Space / Z to confirm or talk.",
        "At the start of a new game you'll choose Mage or Swordsman, each with a different weapon and skill.",
        "Press I to open your inventory menu (Q to switch tabs, [ ] to filter items, S to save).",
        "Monsters roam the forest in real time - press F to swing at the 3 tiles in front of you, or move away to flee.",
        "Active skills like Fireball are cast from a hotbar - assign one to a number key (1-9) from the Skills tab, then press that key to cast it.",
        "Find the Ancient Shrine to the north-east to face the Guardian and complete your story.",
      ], {
        onComplete: () => {
          state.mode = "TITLE";
        },
      });
    }
  }
}

function updateClassSelect() {
  if (Input.wasPressed("ArrowUp") || Input.wasPressed("KeyW")) state.classCursor = 0;
  if (Input.wasPressed("ArrowDown") || Input.wasPressed("KeyS")) state.classCursor = 1;
  if (Input.confirmPressed()) {
    const chosenClass = state.classCursor === 0 ? "mage" : "swordsman";
    const startWeapon = chosenClass === "mage" ? "wooden_staff" : "bronze_sword";
    state.player.class = chosenClass;
    addItem(state, startWeapon, 1);
    state.player.weapon = startWeapon;
    if (chosenClass === "mage") {
      state.player.maxMp = 40;
      state.player.mp = 40;
      state.player.hotbar[0] = "fireball";
    }
    state.mode = "INTRO";
    Dialogue.show(INTRO_TEXT, {
      onComplete: () => {
        state.mode = "OVERWORLD";
      },
    });
  }
}

function updateOverworld(dt) {
  updateMonsterAnimations(state, dt);
  if (Dialogue.active) {
    Dialogue.update();
    return;
  }
  if (state.placingItem) {
    updatePlacing(dt);
    return;
  }

  updateProjectiles(state, dt);
  updateMonsterCombat(state, dt);

  if (Input.menuPressed()) {
    state.mode = "MENU";
    state.menuCursor = 0;
    return;
  }
  if (Input.wasPressed("KeyC")) {
    state.player.crouching = !state.player.crouching;
  }
  if (Input.wasPressed("KeyF")) {
    tryPlayerAttack(state);
  }
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (Input.wasPressed(`Digit${i + 1}`)) {
      castHotbarSkill(state, i);
    }
  }
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.hotbar || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      castHotbarSkill(state, hit.idx);
      Input.clickPos = null;
    }
  }

  tryMovePlayer(state, dt);

  const target = facingTile(state.player);
  const placedAtTarget = state.placedObjects.find((o) => o.x === target.x && o.y === target.y);
  const facingFurnace = placedAtTarget && placedAtTarget.type === "furnace";

  if (facingFurnace && !state.player.moving) {
    updateFurnaceHold(state, placedAtTarget);
  } else if (state.furnaceHold.active) {
    state.furnaceHold.active = false;
    state.furnaceHold.longFired = false;
  }

  if (!facingFurnace && Input.confirmPressed() && !state.player.moving) {
    const npc = findNpcAt(state, target.x, target.y);
    if (npc) {
      if (npc.shop) {
        state.mode = "SHOP";
        state.shop.mode = "buy";
        state.shop.filterIndex = 0;
        state.shop.cursor = 0;
      } else {
        Dialogue.show(npc.dialogue, {
          speaker: npc.name,
          onComplete: () => npc.onComplete && npc.onComplete(state),
        });
      }
    } else if (placedAtTarget && placedAtTarget.type === "campfire") {
      handleCampfireInteract(state);
    } else if (placedAtTarget && placedAtTarget.type === "crafting_table") {
      state.mode = "MENU";
      state.menuTab = "crafting";
      state.menuCursor = 0;
      state.craftCursor = 0;
    } else {
      const tile = state.map[target.y] && state.map[target.y][target.x];
      if (tile === TILE.TREE && !isBorderTile(target.x, target.y)) {
        handleChopTree(state, target.x, target.y);
      } else if (tile === TILE.ROCK) {
        handleMineBoulder(state, target.x, target.y);
      }
    }
  }
}

function updatePlacing(dt) {
  tryMovePlayer(state, dt);
  if (Input.cancelPressed()) {
    state.placingItem = null;
    return;
  }
  if (Input.confirmPressed() && !state.player.moving) {
    const target = facingTile(state.player);
    if (canPlaceItemAt(state, state.placingItem, target.x, target.y)) {
      state.placedObjects.push({ type: state.placingItem, x: target.x, y: target.y });
      const entry = state.player.inventory.find((i) => i.item === state.placingItem);
      if (entry) {
        entry.qty -= 1;
        if (entry.qty <= 0) state.player.inventory = state.player.inventory.filter((i) => i.qty > 0);
      }
      state.placingItem = null;
    } else {
      state.worldFlashMessage = "Can't place it there.";
      state.worldFlashUntil = performance.now() + 1200;
    }
  }
}

function updateMenu() {
  if (Input.cancelPressed() || Input.menuPressed()) {
    state.mode = "OVERWORLD";
    return;
  }
  if (Input.wasPressed("KeyQ")) {
    const idx = MENU_TABS.indexOf(state.menuTab);
    state.menuTab = MENU_TABS[(idx + 1) % MENU_TABS.length];
    state.menuCursor = 0;
  }
  if (Input.wasPressed("KeyS")) {
    saveGame(state);
    state.menuFlashMessage = "Game saved.";
    state.menuFlashUntil = performance.now() + 1200;
  }
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.menuTabs || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      state.menuTab = hit.tab;
      state.menuCursor = 0;
      Input.clickPos = null;
    }
  }

  if (state.menuTab === "inventory") {
    updateInventoryTab(state);
  } else if (state.menuTab === "crafting") {
    updateCraftingTab(state);
  } else if (state.menuTab === "skills") {
    updateSkillsTab(state);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  switch (state.mode) {
    case "TITLE":
      renderTitle();
      break;
    case "CLASS_SELECT":
      renderClassSelect();
      break;
    case "INTRO":
      renderIntroBackdrop();
      Dialogue.render(ctx, canvas.width, canvas.height);
      break;
    case "OVERWORLD":
      updateCamera(state);
      ctx.save();
      ctx.translate(-Camera.x, -Camera.y);
      renderMap(ctx, state);
      ctx.restore();
      renderNightOverlay(state);
      Dialogue.render(ctx, canvas.width, canvas.height);
      renderHud();
      break;
    case "MENU":
      updateCamera(state);
      ctx.save();
      ctx.translate(-Camera.x, -Camera.y);
      renderMap(ctx, state);
      ctx.restore();
      renderNightOverlay(state);
      renderMenu();
      break;
    case "SHOP":
      updateCamera(state);
      ctx.save();
      ctx.translate(-Camera.x, -Camera.y);
      renderMap(ctx, state);
      ctx.restore();
      renderNightOverlay(state);
      renderShop(ctx, state, canvas.width, canvas.height);
      break;
    case "FURNACE":
      updateCamera(state);
      ctx.save();
      ctx.translate(-Camera.x, -Camera.y);
      renderMap(ctx, state);
      ctx.restore();
      renderNightOverlay(state);
      renderFurnaceUI(ctx, state, canvas.width, canvas.height);
      break;
    case "GAMEOVER":
      renderEndScreen("You Perished", GAMEOVER_TEXT, "#3d1414", "#c94f4f");
      break;
    case "VICTORY":
      renderEndScreen("Victory", VICTORY_TEXT, "#1a2f1e", "#e8c97a");
      break;
  }
}

function renderIntroBackdrop() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1f3d2a");
  grad.addColorStop(1, "#0e1510");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderTitle() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#0e1a12");
  grad.addColorStop(1, "#1f3d2a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 40px 'Segoe UI', sans-serif";
  ctx.fillText("The Whispering Wood", canvas.width / 2, 160);

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillText("You didn't choose this world. It chose you.", canvas.width / 2, 200);

  const options = hasSaveGame() ? ["New Game", "Continue", "How to Play"] : ["New Game", "How to Play"];
  options.forEach((opt, i) => {
    ctx.fillStyle = i === state.titleCursor ? "#e8c97a" : "#f2f2ec";
    ctx.font = "22px 'Segoe UI', sans-serif";
    ctx.fillText((i === state.titleCursor ? "> " : "") + opt, canvas.width / 2, 300 + i * 40);
  });

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText("Arrow keys to choose - Enter / Space to select", canvas.width / 2, canvas.height - 30);
  ctx.textAlign = "left";
}

function renderClassSelect() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#0e1a12");
  grad.addColorStop(1, "#1f3d2a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 30px 'Segoe UI', sans-serif";
  ctx.fillText("Choose Your Path", canvas.width / 2, 130);

  const options = [
    {
      name: "Mage",
      blurb: "Channel arcane fire from a distance. Starts with a Wooden Staff - F to swing it, or cast Fireball from the hotbar.",
    },
    {
      name: "Swordsman",
      blurb: "Steel and steady nerves. Starts with a Bronze Sword - press F to swing, with a reflexive Parry.",
    },
  ];
  options.forEach((opt, i) => {
    const y = 230 + i * 110;
    ctx.fillStyle = i === state.classCursor ? "#e8c97a" : "#f2f2ec";
    ctx.font = "24px 'Segoe UI', sans-serif";
    ctx.fillText((i === state.classCursor ? "> " : "") + opt.name, canvas.width / 2, y);
    ctx.fillStyle = "#cfd8cf";
    ctx.font = "14px 'Segoe UI', sans-serif";
    wrapText(ctx, opt.blurb, canvas.width / 2, y + 28, 440, 18);
  });

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText("Arrow keys to choose - Enter / Space to confirm", canvas.width / 2, canvas.height - 30);
  ctx.textAlign = "left";
}

function renderNightOverlay(state) {
  const darkness = 1 - getDaylightFactor(state.turnCount);
  if (darkness <= 0) return;
  ctx.fillStyle = `rgba(6,10,30,${(darkness * 0.75).toFixed(3)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderHud() {
  const p = state.player;
  const boxX = 8, boxY = 8, boxW = 210, boxH = 100;
  ctx.fillStyle = "rgba(10,14,12,0.78)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  drawPixelFrameCorners(ctx, boxX, boxY, boxW, boxH, 10, "#e8c97a");

  const innerX = boxX + 10;
  const barW = boxW - 20;
  let sy = boxY + 18;

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 13px 'Segoe UI', sans-serif";
  ctx.fillText(`Lv.${p.level}`, innerX, sy);
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`Gold ${p.gold}`, boxX + boxW - 10, sy);
  ctx.textAlign = "left";
  sy += 18;

  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#f2f2ec";
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, innerX, sy);
  drawBar(ctx, innerX, sy + 3, barW, 9, p.hp / p.maxHp, "#4fae5a");
  sy += 24;

  ctx.fillText(`MP ${p.mp}/${p.maxMp}`, innerX, sy);
  drawBar(ctx, innerX, sy + 3, barW, 9, p.mp / p.maxMp, "#4f8dae");
  sy += 24;

  ctx.fillText(`EXP ${p.exp}/${p.expToNext}`, innerX, sy);
  drawBar(ctx, innerX, sy + 3, barW, 7, p.exp / p.expToNext, "#8e6fce");

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("I: menu   F: attack   1-9/click: skills", canvas.width - 130, 20);

  if (p.crouching) {
    ctx.fillStyle = "#7cd68a";
    ctx.font = "bold 12px 'Segoe UI', sans-serif";
    ctx.fillText("Crouching (C)", canvas.width - 130, 38);
  }

  const night = isNightTime(state.turnCount);
  ctx.fillStyle = night ? "#c9d6f0" : "#f6d97a";
  ctx.beginPath();
  ctx.arc(canvas.width - 122, 42, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfd8cf";
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText(night ? "Night" : "Day", canvas.width - 108, 46);

  if (performance.now() < state.worldFlashUntil) {
    ctx.fillStyle = "#e88a5a";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.worldFlashMessage, canvas.width / 2, 30);
    ctx.textAlign = "left";
  }

  if (state.placingItem) {
    ctx.fillStyle = "rgba(10,14,12,0.82)";
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
    ctx.fillStyle = "#e8c97a";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Placing ${ITEMS[state.placingItem].name} - Enter to place, Esc to cancel`,
      canvas.width / 2,
      canvas.height - 10
    );
    ctx.textAlign = "left";
  }

  renderHotbar(ctx, state);
}

function renderMenu() {
  const panelX = 60, panelY = 40, panelW = canvas.width - 120, panelH = canvas.height - 80;
  ctx.fillStyle = "rgba(6,10,8,0.9)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  drawPixelFrameCorners(ctx, panelX, panelY, panelW, panelH, 16, "#e8c97a");

  ctx.font = "bold 20px 'Segoe UI', sans-serif";
  let tabX = 90;
  const tabY = 76;
  state.uiHitboxes.menuTabs = [];
  for (const t of MENU_TABS) {
    const label = t === state.menuTab ? `> ${MENU_TAB_LABELS[t]} <` : MENU_TAB_LABELS[t];
    ctx.fillStyle = t === state.menuTab ? "#e8c97a" : "#f2f2ec";
    ctx.fillText(label, tabX, tabY);
    const labelW = ctx.measureText(label).width;
    state.uiHitboxes.menuTabs.push({ tab: t, x: tabX - 8, y: tabY - 22, w: labelW + 16, h: 30 });
    tabX += labelW + 28;
  }

  if (state.menuTab === "inventory") {
    renderInventoryTab(ctx, state, 90, 96, panelW - 60, panelH - 96 - 44);
  } else if (state.menuTab === "crafting") {
    renderCraftingTab(ctx, state, 90, 96, panelW - 60, panelH - 96 - 44);
  } else {
    renderSkillsTab(ctx, state, 90, 96, panelW - 60, panelH - 96 - 44);
  }

  if (performance.now() < state.menuFlashUntil) {
    ctx.fillStyle = "#7cd68a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(state.menuFlashMessage, panelX + panelW - 16, panelY + 24);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#8a9a8a";
  ctx.font = "12px 'Segoe UI', sans-serif";
  const hint = state.menuTab === "inventory"
    ? "Click a tab/item, or: Q tab   [ ] category   Arrows browse   Enter use/equip   S save   I/Esc close"
    : state.menuTab === "crafting"
    ? "Click a tab/recipe, or: Q tab   Arrows select   Enter craft   S save   I/Esc close"
    : "Click a tab/hotbar slot, or: Q tab   1-9 assign to hotbar   S save   I/Esc close";
  ctx.fillText(hint, 90, canvas.height - 56);
}

function renderEndScreen(title, lines, bg, accent) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = "bold 36px 'Segoe UI', sans-serif";
  ctx.fillText(title, canvas.width / 2, 140);

  ctx.fillStyle = "#f2f2ec";
  ctx.font = "16px 'Segoe UI', sans-serif";
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, 210 + i * 28));

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.fillText("Press Enter / Space to return to the title screen", canvas.width / 2, canvas.height - 40);
  ctx.textAlign = "left";
}

requestAnimationFrame(loop);
