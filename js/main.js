// ---------------------------------------------------------------------------
// Game bootstrap: state container, title/menu screens, main loop
// ---------------------------------------------------------------------------

const SAVE_KEY = "isekai_whispering_wood_save";

function createInitialState() {
  return {
    mode: "TITLE", // TITLE | INTRO | OVERWORLD | BATTLE | MENU | GAMEOVER | VICTORY
    map: buildMap(),
    npcs: NPCS,
    itemPickups: JSON.parse(JSON.stringify(ITEM_PICKUPS)),
    player: createPlayer(),
    flags: { metFox: false, bossDefeated: false },
    titleCursor: 0,
    menuCursor: 0,
    menuTab: "status", // status | inventory
    menuFilterIndex: 0,
    menuFlashMessage: "",
    menuFlashUntil: 0,
  };
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
canvas.width = MAP_COLS * TILE_SIZE;
canvas.height = MAP_ROWS * TILE_SIZE;

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
    case "INTRO":
      Dialogue.update();
      break;
    case "OVERWORLD":
      updateOverworld(dt);
      break;
    case "BATTLE":
      updateBattle(state);
      break;
    case "MENU":
      updateMenu();
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
      state.mode = "INTRO";
      Dialogue.show(INTRO_TEXT, {
        onComplete: () => {
          state.mode = "OVERWORLD";
        },
      });
    } else if (choice === "Continue") {
      loadGame(state);
      state.mode = "OVERWORLD";
    } else if (choice === "How to Play") {
      state.mode = "INTRO";
      Dialogue.show([
        "Arrow keys / WASD to move. Enter / Space / Z to confirm or talk.",
        "Press I to open your status and inventory menu (Q to switch tabs, [ ] to filter items, S to save).",
        "Walking through tall grass may trigger a battle - choose Attack, Skill, Item, or Run.",
        "Find the Ancient Shrine to the north-east to face the Guardian and complete your story.",
      ], {
        onComplete: () => {
          state.mode = "TITLE";
        },
      });
    }
  }
}

function updateOverworld(dt) {
  if (Dialogue.active) {
    Dialogue.update();
    return;
  }
  if (Input.menuPressed()) {
    state.mode = "MENU";
    state.menuCursor = 0;
    return;
  }

  tryMovePlayer(state, dt);

  if (Input.confirmPressed() && !state.player.moving) {
    const target = facingTile(state.player);
    const npc = findNpcAt(state, target.x, target.y);
    if (npc) {
      Dialogue.show(npc.dialogue, {
        speaker: npc.name,
        onComplete: () => npc.onComplete && npc.onComplete(state),
      });
    }
  }
}

function updateMenu() {
  if (Input.cancelPressed() || Input.menuPressed()) {
    state.mode = "OVERWORLD";
    return;
  }
  if (Input.wasPressed("KeyQ")) {
    state.menuTab = state.menuTab === "status" ? "inventory" : "status";
    state.menuCursor = 0;
  }
  if (Input.wasPressed("KeyS")) {
    saveGame(state);
    state.menuFlashMessage = "Game saved.";
    state.menuFlashUntil = performance.now() + 1200;
  }

  if (state.menuTab === "inventory") {
    updateInventoryTab(state);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  switch (state.mode) {
    case "TITLE":
      renderTitle();
      break;
    case "INTRO":
      renderIntroBackdrop();
      Dialogue.render(ctx, canvas.width, canvas.height);
      break;
    case "OVERWORLD":
      renderMap(ctx, state);
      Dialogue.render(ctx, canvas.width, canvas.height);
      renderHud();
      break;
    case "BATTLE":
      renderBattle(ctx, state, canvas.width, canvas.height);
      break;
    case "MENU":
      renderMap(ctx, state);
      renderMenu();
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
  ctx.fillText("ISEKAI: The Whispering Wood", canvas.width / 2, 160);

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

function renderHud() {
  const p = state.player;
  ctx.fillStyle = "rgba(10,14,12,0.75)";
  ctx.fillRect(8, 8, 190, 60);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(8, 8, 190, 60);
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText(`Lv.${p.level}   Gold: ${p.gold}`, 18, 26);
  drawBar(ctx, 18, 34, 170, 10, p.hp / p.maxHp, "#4fae5a");
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, 18, 58);

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Press I for menu", canvas.width - 130, 20);
}

function renderMenu() {
  const panelX = 60, panelY = 40, panelW = canvas.width - 120, panelH = canvas.height - 80;
  ctx.fillStyle = "rgba(6,10,8,0.9)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 20px 'Segoe UI', sans-serif";
  ctx.fillText(state.menuTab === "status" ? "> Status <   Inventory" : "Status   > Inventory <", 90, 76);

  const p = state.player;
  if (state.menuTab === "status") {
    ctx.fillStyle = "#f2f2ec";
    ctx.font = "16px 'Segoe UI', sans-serif";
    const lines = [
      `Level: ${p.level}`,
      `EXP: ${p.exp} / ${p.expToNext}`,
      `HP: ${p.hp} / ${p.maxHp}`,
      `MP: ${p.mp} / ${p.maxMp}`,
      `Attack: ${playerAtk(p)} ${p.weapon ? `(base ${p.baseAtk} + ${ITEMS[p.weapon].atkBonus} ${ITEMS[p.weapon].name})` : ""}`,
      `Defense: ${playerDef(p)} ${p.accessory ? `(base ${p.baseDef} + ${ITEMS[p.accessory].defBonus} ${ITEMS[p.accessory].name})` : ""}`,
      `Gold: ${p.gold}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 100, 120 + i * 28));
  } else {
    renderInventoryTab(ctx, state, 90, 96, panelW - 60, panelH - 96 - 44);
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
    ? "Q: tab   [ ]: category   Arrows: browse   Enter: use/equip   S: save   I/Esc: close"
    : "Q: switch tab   S: save   I or Esc: close";
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
