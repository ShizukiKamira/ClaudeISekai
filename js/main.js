// ---------------------------------------------------------------------------
// Game bootstrap: state container, title/menu screens, main loop
// ---------------------------------------------------------------------------

const SAVE_KEY = "isekai_whispering_wood_save";
const MENU_TABS = ["inventory", "skills", "crafting"];
const MENU_TAB_LABELS = { inventory: "Inventory", skills: "Skills", crafting: "Crafting" };

function createInitialState() {
  const state = {
    mode: "TITLE", // TITLE | INTRO | OVERWORLD | MENU | SHOP | FURNACE | CHEST | CORPSE_LOOT | GAMEOVER | VICTORY
    map: buildMap(),
    npcs: NPCS,
    monsters: [],
    animals: [],
    corpses: [],
    lootTarget: null, // id of the corpse open in the CORPSE_LOOT panel
    storePrompt: null, // { x, y, type } of a placed object pending a "store it?" confirm
    forageEffects: [], // brief sparkle bursts played where a forage just yielded loot
    dragging: null, // { from: "inv"|"hotbar", idx, itemId } while the inventory/hotbar drag is in progress
    projectiles: [],
    itemPickups: JSON.parse(JSON.stringify(ITEM_PICKUPS)),
    placedObjects: [],
    placingItem: null,
    placeHoverTile: null,
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
    craftScroll: 0,
    location: "overworld", // overworld | home
    exteriorSnapshot: null, // set while indoors: { map, npcs, monsters, itemPickups, placedObjects, returnX, returnY, returnDir }
    resourceHits: {}, // "x,y" -> hit count so far, for trees/boulders mid-chop/mine
    fishing: { active: false },
    chestTarget: null, // { x, y } of the placedObject currently open
    chestSelected: null, // { side, idx } highlighted slot
    chestLastClick: null, // { side, idx, at } for double-click detection
    chestPrompt: null, // { side, itemId, maxQty, customInput } while the amount prompt is open
    chestInvScroll: 0,
    chestBoxScroll: 0,
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
  spawnInitialRabbits(state, RABBIT_LIMIT);
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
    // Always persist the overworld's state, even mid-visit to the home
    // interior - the snapshot holds the real exterior data while indoors.
    const indoors = s.location === "home" && s.exteriorSnapshot;
    const payload = {
      player: s.player,
      flags: s.flags,
      itemPickups: indoors ? s.exteriorSnapshot.itemPickups : s.itemPickups,
      placedObjects: indoors ? s.exteriorSnapshot.placedObjects : s.placedObjects,
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

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  Input.wheelDelta += e.deltaY;
}, { passive: false });

function canvasEventPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

// Right-click and drag support (used by the chest storage UI): the browser's
// own context menu is suppressed on the canvas so a right-click can drive
// the take/store-amount prompt instead.
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    Input.rightClickPos = canvasEventPos(e);
  } else if (e.button === 0) {
    Input.mouseDownPos = canvasEventPos(e);
    Input.mouseIsDown = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    Input.mouseUpPos = canvasEventPos(e);
    Input.mouseIsDown = false;
  }
});

// Safety net: if the button is released outside the canvas (or focus is
// lost mid-drag), still clear the held-down flag so a UI drag can't get
// stuck following the cursor forever.
window.addEventListener("mouseup", () => {
  Input.mouseIsDown = false;
});
window.addEventListener("blur", () => {
  Input.mouseIsDown = false;
});

canvas.addEventListener("mousemove", (e) => {
  Input.mousePos = canvasEventPos(e);
});

function pointInRect(px, py, box) {
  return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;
}

// Converts a click's canvas-pixel position into the world tile it landed on,
// accounting for the current camera scroll.
function screenToTile(clickPos) {
  return {
    x: Math.floor((clickPos.x + Camera.x) / TILE_SIZE),
    y: Math.floor((clickPos.y + Camera.y) / TILE_SIZE),
  };
}

const Camera = { x: 0, y: 0 };

function updateCamera(state) {
  const mapPixelW = state.map[0].length * TILE_SIZE;
  const mapPixelH = state.map.length * TILE_SIZE;
  // A map smaller than the viewport (e.g. the home interior) is centered
  // rather than pinned to the top-left corner.
  if (mapPixelW <= canvas.width) {
    Camera.x = -(canvas.width - mapPixelW) / 2;
  } else {
    const targetX = state.player.pixelX + TILE_SIZE / 2 - canvas.width / 2;
    Camera.x = Math.max(0, Math.min(targetX, mapPixelW - canvas.width));
  }
  if (mapPixelH <= canvas.height) {
    Camera.y = -(canvas.height - mapPixelH) / 2;
  } else {
    const targetY = state.player.pixelY + TILE_SIZE / 2 - canvas.height / 2;
    Camera.y = Math.max(0, Math.min(targetY, mapPixelH - canvas.height));
  }
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
    case "CHEST":
      updateChest(state);
      break;
    case "CORPSE_LOOT":
      updateCorpseLoot(state);
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

// Finds whichever NPC or placed object sits at the given tile, if any -
// shared by the facing+Enter interact chain and the click-at-range one.
function findInteractableAt(state, x, y) {
  const npc = findNpcAt(state, x, y);
  if (npc) return { npc };
  const obj = state.placedObjects.find((o) => o.x === x && o.y === y);
  if (obj) return { obj };
  return null;
}

// Opens whatever a target resolves to - a shop or dialogue for an NPC, the
// matching UI/interaction for a placed object. Returns true if it recognized
// and handled the target, so callers can fall back to other behavior (e.g.
// the tile-based gather chain) when it's something with no interaction of
// its own (a bridge, say).
function performInteraction(state, target) {
  if (target.npc) {
    const npc = target.npc;
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
    return true;
  }

  const obj = target.obj;
  if (obj.type === "campfire") {
    handleCampfireInteract(state);
    return true;
  }
  if (obj.type === "crafting_table") {
    state.mode = "MENU";
    state.menuTab = "crafting";
    state.menuCursor = 0;
    state.craftCursor = 0;
    return true;
  }
  if (obj.type === "bed") {
    handleBedInteract(state);
    return true;
  }
  if (obj.type === "basic_trap") {
    handleTrapInteract(state, obj);
    return true;
  }
  if (obj.type === "chest" && obj.contents) {
    state.mode = "CHEST";
    state.chestTarget = { x: obj.x, y: obj.y };
    state.chestSelected = null;
    state.chestLastClick = null;
    state.chestPrompt = null;
    state.chestInvScroll = 0;
    state.chestBoxScroll = 0;
    return true;
  }
  if (obj.type === "furnace") {
    // A click always gets the short-press "open the smelting UI" behavior -
    // the long-press-to-pick-up hold mechanic only makes sense for a facing
    // Enter press (see updateFurnaceHold), not an at-range click.
    openFurnace(state, obj);
    return true;
  }
  if (HOME_FLAVOR_TEXT[obj.type]) {
    Dialogue.show([HOME_FLAVOR_TEXT[obj.type]]);
    return true;
  }
  return false;
}

function updateOverworld(dt) {
  if (Dialogue.active) {
    Dialogue.update();
    return;
  }

  updateMonstersMovement(state, dt);
  updateAnimalsMovement(state, dt);
  updateDashCharges(state);

  if (state.placingItem) {
    updatePlacing(dt);
    return;
  }
  if (state.fishing.active) {
    updateFishing(state, dt);
    return;
  }

  updateProjectiles(state, dt);
  updateMonsterCombat(state, dt);
  updatePoisoning(state);
  updateCorpseDespawn(state);
  if (state.mode === "GAMEOVER") return;

  if (Input.menuPressed()) {
    state.mode = "MENU";
    state.menuCursor = 0;
    return;
  }
  if (Input.wasPressed("KeyC")) {
    state.player.crouching = !state.player.crouching;
  }
  if (Input.wasPressed("KeyF")) {
    const facingWater = facingTile(state.player);
    const facingTileType = state.map[facingWater.y] && state.map[facingWater.y][facingWater.x];
    if (facingTileType === TILE.WATER && hasItem(state, "fishing_rod")) {
      startFishing(state, facingWater.x, facingWater.y);
    } else {
      tryPlayerAttack(state);
    }
  }
  if (Input.wasPressed("KeyQ")) {
    tryStartDash(state);
  }
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (Input.wasPressed(`Digit${i + 1}`)) {
      activateHotbarSlot(state, i);
    }
  }
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.hotbar || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      activateHotbarSlot(state, hit.idx);
      Input.clickPos = null;
    }
  }

  // The "Forage" popup near a bush takes priority over the world-click
  // combat/gathering dispatch below, so a click on it never also swings.
  if (Input.clickPos) {
    const forageHit = (state.uiHitboxes.forageButtons || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (forageHit) {
      handleForage(state, forageHit.tileX, forageHit.tileY);
      Input.clickPos = null;
    }
  }

  // Corpse looting: Space loots the nearest corpse in range all at once;
  // clicking its "Loot" popup does the same; clicking the corpse sprite
  // itself instead opens a panel to choose individual items.
  if (Input.wasPressed("Space")) {
    const p = state.player;
    const nearest = findNearestCorpse(state, p.pixelX + TILE_SIZE / 2, p.pixelY + TILE_SIZE / 2, CORPSE_LOOT_RANGE);
    if (nearest) lootCorpseAll(state, nearest);
  }
  if (Input.clickPos) {
    const lootHit = (state.uiHitboxes.lootButtons || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (lootHit) {
      const corpse = state.corpses.find((c) => c.id === lootHit.corpseId);
      if (corpse) lootCorpseAll(state, corpse);
      Input.clickPos = null;
    }
  }
  if (Input.clickPos) {
    const corpseHit = (state.uiHitboxes.corpseHitboxes || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (corpseHit) {
      const corpse = state.corpses.find((c) => c.id === corpseHit.corpseId);
      if (corpse) openCorpseLoot(state, corpse);
      Input.clickPos = null;
    }
  }

  // Right-clicking a placed object prompts to store it back in the
  // inventory, removing it from the world.
  if (Input.rightClickPos && !Dialogue.active) {
    const clicked = screenToTile(Input.rightClickPos);
    const withinRange = chebyshevDist(clicked.x, clicked.y, state.player.tileX, state.player.tileY) <= INTERACT_CLICK_RANGE;
    const obj = state.placedObjects.find((o) => o.x === clicked.x && o.y === clicked.y);
    if (withinRange && obj) {
      openStorePrompt(state, obj);
      Input.rightClickPos = null;
    }
  }
  if (state.storePrompt) {
    updateStorePrompt(state);
  }

  // Clicking directly on an NPC or a placed object (crafting table, chest,
  // furnace, trap, bed) within INTERACT_CLICK_RANGE tiles opens it right
  // away, without needing to walk up and face it first.
  if (Input.clickPos && !Dialogue.active) {
    const clicked = screenToTile(Input.clickPos);
    const withinRange = chebyshevDist(clicked.x, clicked.y, state.player.tileX, state.player.tileY) <= INTERACT_CLICK_RANGE;
    if (withinRange) {
      const interactTarget = findInteractableAt(state, clicked.x, clicked.y);
      if (interactTarget && performInteraction(state, interactTarget)) {
        Input.clickPos = null;
      }
    }
  }

  tryMovePlayer(state, dt);
  updatePlayerTileEffects(state);

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
    const handled = npc
      ? performInteraction(state, { npc })
      : placedAtTarget
      ? performInteraction(state, { obj: placedAtTarget })
      : false;
    if (!handled) {
      const tile = state.map[target.y] && state.map[target.y][target.x];
      if (tile === TILE.TREE && !isBorderTile(target.x, target.y)) {
        hitResourceNode(state, target.x, target.y, TILE.TREE);
      } else if (tile === TILE.ROCK) {
        hitResourceNode(state, target.x, target.y, TILE.ROCK);
      } else if (tile === TILE.HERB) {
        handleGatherHerb(state, target.x, target.y);
      } else if (tile === TILE.MOONLEAF) {
        handleGatherMoonleaf(state, target.x, target.y);
      } else if (tile === TILE.BUSH) {
        handleForage(state, target.x, target.y);
      } else if (tile === TILE.WATER) {
        handleDrinkWater(state);
      }
    }
  }

  // Mouse: clicking the tree/boulder directly ahead (with the right tool)
  // chops/mines it; any other click on the world swings a melee attack, so
  // combat and gathering both work without touching the keyboard.
  if (Input.clickPos && !facingFurnace && !Dialogue.active) {
    const clicked = screenToTile(Input.clickPos);
    const facingTileType = state.map[target.y] && state.map[target.y][target.x];
    const clickedFacingTile = clicked.x === target.x && clicked.y === target.y;
    if (clickedFacingTile && facingTileType === TILE.TREE && !isBorderTile(target.x, target.y) && hasItem(state, "axe")) {
      hitResourceNode(state, target.x, target.y, TILE.TREE);
      Input.clickPos = null;
    } else if (clickedFacingTile && facingTileType === TILE.ROCK && hasItem(state, "pickaxe")) {
      hitResourceNode(state, target.x, target.y, TILE.ROCK);
      Input.clickPos = null;
    } else if (clickedFacingTile && facingTileType === TILE.WATER && hasItem(state, "fishing_rod")) {
      startFishing(state, target.x, target.y);
    } else {
      tryPlayerAttack(state);
      Input.clickPos = null;
    }
  }
}

function placePlayerAt(state, x, y, dir) {
  const p = state.player;
  p.tileX = x;
  p.tileY = y;
  p._lastTileX = x;
  p._lastTileY = y;
  p.pixelX = x * TILE_SIZE;
  p.pixelY = y * TILE_SIZE;
  p.moving = false;
  p.dir = dir;
  p.facingAngle = Math.atan2(dir8Vec(dir)[1], dir8Vec(dir)[0]);
  p.dash = null;
  p.distanceAccum = 0;
}

// Toggles between the overworld and the player's home interior. Stepping
// onto a DOOR tile (in onPlayerArrivedTile) calls this in either direction -
// entering stashes the overworld's dynamic entities behind a snapshot and
// swaps in the tiny home map/furniture; exiting restores them.
function enterOrExitHome(state) {
  if (state.location !== "home") {
    state.exteriorSnapshot = {
      map: state.map,
      npcs: state.npcs,
      monsters: state.monsters,
      animals: state.animals,
      itemPickups: state.itemPickups,
      placedObjects: state.placedObjects,
      returnX: HOME_EXTERIOR.doorX,
      returnY: HOME_EXTERIOR.doorY + 1,
      returnDir: "down",
    };
    state.map = HOME_MAP;
    state.npcs = [];
    state.monsters = [];
    state.animals = [];
    state.itemPickups = [];
    state.placedObjects = HOME_FURNITURE.map((f) => ({ ...f }));
    state.location = "home";
    placePlayerAt(state, HOME_SPAWN_INTERIOR.x, HOME_SPAWN_INTERIOR.y, HOME_SPAWN_INTERIOR.dir);
  } else {
    const snap = state.exteriorSnapshot;
    state.map = snap.map;
    state.npcs = snap.npcs;
    state.monsters = snap.monsters;
    state.animals = snap.animals;
    state.itemPickups = snap.itemPickups;
    state.placedObjects = snap.placedObjects;
    state.location = "overworld";
    state.exteriorSnapshot = null;
    placePlayerAt(state, snap.returnX, snap.returnY, snap.returnDir);
  }
}

// The target tile follows the mouse cursor (rather than only the tile the
// player is facing), clamped to within PLACEMENT_RANGE tiles of the player -
// state.placeHoverTile is read back by renderMap for the ghost preview.
function updatePlacing(dt) {
  tryMovePlayer(state, dt);
  if (Input.cancelPressed()) {
    state.placingItem = null;
    state.placeHoverTile = null;
    return;
  }

  const hover = screenToTile(Input.mousePos);
  state.placeHoverTile = hover;
  const inRange = chebyshevDist(hover.x, hover.y, state.player.tileX, state.player.tileY) <= PLACEMENT_RANGE;

  const wantsConfirm = Input.confirmPressed() || !!Input.clickPos;
  if (wantsConfirm) {
    if (!inRange) {
      state.worldFlashMessage = "Too far away to place it there.";
      state.worldFlashUntil = performance.now() + 1200;
    } else if (canPlaceItemAt(state, state.placingItem, hover.x, hover.y)) {
      const placed = { type: state.placingItem, x: hover.x, y: hover.y };
      if (state.placingItem === "chest") placed.contents = [];
      state.placedObjects.push(placed);
      const entry = state.player.inventory.find((i) => i.item === state.placingItem);
      if (entry) {
        entry.qty -= 1;
        if (entry.qty <= 0) state.player.inventory = state.player.inventory.filter((i) => i.qty > 0);
      }
      state.placingItem = null;
      state.placeHoverTile = null;
    } else {
      state.worldFlashMessage = "Can't place it there.";
      state.worldFlashUntil = performance.now() + 1200;
    }
    Input.clickPos = null;
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
      if (state.fishing.active && state.fishing.phase === "minigame") {
        drawFishingMinigame(ctx, state);
      }
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
    case "CHEST":
      updateCamera(state);
      ctx.save();
      ctx.translate(-Camera.x, -Camera.y);
      renderMap(ctx, state);
      ctx.restore();
      renderNightOverlay(state);
      renderChest(ctx, state, canvas.width, canvas.height);
      break;
    case "CORPSE_LOOT":
      updateCamera(state);
      ctx.save();
      ctx.translate(-Camera.x, -Camera.y);
      renderMap(ctx, state);
      ctx.restore();
      renderNightOverlay(state);
      renderCorpseLoot(ctx, state, canvas.width, canvas.height);
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
  if (state.location === "home") return; // the cabin is always lit indoors
  const darkness = 1 - getDaylightFactor(state.turnCount);
  if (darkness <= 0) return;
  ctx.fillStyle = `rgba(6,10,30,${(darkness * 0.75).toFixed(3)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderHud() {
  const p = state.player;
  const boxX = 8, boxY = 8, boxW = 210, boxH = 96;
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

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("I: menu   F: attack   1-9/click: skills", canvas.width - 130, 20);

  if (p.crouching) {
    ctx.fillStyle = "#7cd68a";
    ctx.font = "bold 12px 'Segoe UI', sans-serif";
    ctx.fillText("Crouching (C)", canvas.width - 130, 38);
  }
  if (p.poisonedUntil && performance.now() < p.poisonedUntil) {
    ctx.fillStyle = "#8e6fce";
    ctx.font = "bold 12px 'Segoe UI', sans-serif";
    ctx.fillText("Poisoned", canvas.width - 130, p.crouching ? 54 : 38);
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
      `Placing ${ITEMS[state.placingItem].name} - click (within ${PLACEMENT_RANGE} tiles) or Enter to place, Esc to cancel`,
      canvas.width / 2,
      canvas.height - 10
    );
    ctx.textAlign = "left";
  }

  renderStatBarsAboveHotbar(ctx, state);
  renderHotbar(ctx, state);
  renderStorePrompt(ctx, state, canvas.width, canvas.height);
  renderDashHud(ctx, state);
}

// Dash charge pips, drawn just under the top-left HUD box - filled gold for
// a ready charge, a hollow ring with a countdown ring for one recharging.
function renderDashHud(ctx, state) {
  const p = state.player;
  const boxX = 8, y = 112;
  const r = 6, gap = 16;
  ctx.font = "10px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#cfd8cf";
  ctx.fillText("Dash (Q)", boxX, y);
  for (let i = 0; i < DASH_MAX_CHARGES; i++) {
    const cx = boxX + 46 + i * gap, cy = y - 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (i < p.dashCharges) {
      ctx.fillStyle = "#e8c97a";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#8a9a8a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// EXP, Hunger, and Thirst live here instead of the top-left HUD box, stacked
// directly above the hotbar (EXP on top) and aligned to its same width so
// the whole cluster reads as one unit.
function renderStatBarsAboveHotbar(ctx, state) {
  const p = state.player;
  const hotbarSlotSize = 34, hotbarGap = 6;
  const totalW = HOTBAR_SIZE * hotbarSlotSize + (HOTBAR_SIZE - 1) * hotbarGap;
  const startX = (canvas.width - totalW) / 2;
  const hotbarY = canvas.height - hotbarSlotSize - 36;

  const rowH = 17;
  const barH = 6;
  let sy = hotbarY - 8 - rowH * 3 + 10;

  ctx.font = "10px 'Segoe UI', sans-serif";

  ctx.fillStyle = "#cfd8cf";
  ctx.fillText(`EXP ${p.exp}/${p.expToNext}`, startX, sy);
  drawBar(ctx, startX, sy + 3, totalW, barH, p.exp / p.expToNext, "#8e6fce");
  sy += rowH;

  ctx.fillStyle = p.hunger <= 0 ? "#e88a5a" : "#f2f2ec";
  ctx.fillText(`Hunger ${Math.ceil(p.hunger)}/${HUNGER_MAX}`, startX, sy);
  drawBar(ctx, startX, sy + 3, totalW, barH, p.hunger / HUNGER_MAX, "#c9a03a");
  sy += rowH;

  ctx.fillStyle = p.thirst <= 0 ? "#e88a5a" : "#f2f2ec";
  ctx.fillText(`Thirst ${Math.ceil(p.thirst)}/${THIRST_MAX}`, startX, sy);
  drawBar(ctx, startX, sy + 3, totalW, barH, p.thirst / THIRST_MAX, "#4f8dae");
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
