// ---------------------------------------------------------------------------
// Resource gathering: chopping trees with an axe, mining boulders with a
// pickaxe, and resting at a placed campfire to skip to morning
// ---------------------------------------------------------------------------

function hasItem(state, itemId) {
  return state.player.inventory.some((i) => i.item === itemId);
}

// Chopping a tree or mining a boulder now takes RESOURCE_HITS_REQUIRED
// separate hits (via Enter or a click, from js/main.js) before it gives up
// its loot and clears. Progress is tracked per-tile in state.resourceHits,
// keyed by "x,y", so walking away and coming back resumes where you left off.
function hitResourceNode(state, x, y, tileType) {
  const isTree = tileType === TILE.TREE;
  const toolNeeded = isTree ? "axe" : "pickaxe";
  if (!hasItem(state, toolNeeded)) {
    Dialogue.show([`You need ${isTree ? "an Axe" : "a Pickaxe"} to ${isTree ? "chop this tree" : "mine this boulder"}.`]);
    return;
  }

  const p = state.player;
  p.lastToolSwingAt = performance.now();
  p.toolSwingType = toolNeeded;

  const key = `${x},${y}`;
  const hits = (state.resourceHits[key] || 0) + 1;
  if (hits < RESOURCE_HITS_REQUIRED) {
    state.resourceHits[key] = hits;
    state.worldFlashMessage = `${isTree ? "Chopping" : "Mining"}... (${hits}/${RESOURCE_HITS_REQUIRED})`;
    state.worldFlashUntil = performance.now() + 700;
    return;
  }

  delete state.resourceHits[key];
  state.map[y][x] = TILE.GRASS;
  if (isTree) {
    const logs = 2 + Math.floor(Math.random() * 2); // 2-3
    const sticks = 2 + Math.floor(Math.random() * 2); // 2-3
    addItem(state, "log", logs);
    addItem(state, "stick", sticks);
    Dialogue.show([`You chop down the tree. Found ${logs} Log${logs > 1 ? "s" : ""} and ${sticks} Stick${sticks > 1 ? "s" : ""}.`]);
  } else {
    const stone = 2 + Math.floor(Math.random() * 2); // 2-3
    const oreType = Math.random() < 0.5 ? "iron_ore" : "copper_ore";
    const oreQty = Math.floor(Math.random() * 3); // 0-2
    const flint = 1 + Math.floor(Math.random() * 2); // 1-2
    addItem(state, "stone", stone);
    if (oreQty > 0) addItem(state, oreType, oreQty);
    addItem(state, "flint", flint);
    const oreMsg = oreQty > 0 ? ` and ${oreQty} ${ITEMS[oreType].name}` : "";
    Dialogue.show([`You mine the boulder. Found ${stone} Stone, ${flint} Flint${oreMsg}.`]);
  }
}

function handleCampfireInteract(state) {
  if (isNightTime(state.turnCount)) {
    Dialogue.show(["You settle down by the campfire's warmth.", "Sleep comes quickly..."], {
      onComplete: () => {
        const p = state.player;
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        const remainder = state.turnCount % CYCLE_LENGTH;
        state.turnCount += CYCLE_LENGTH - remainder;
      },
    });
  } else {
    Dialogue.show(["The fire crackles quietly. It's still daylight - no need to sleep yet."]);
  }
}

function handleGatherHerb(state, x, y) {
  addItem(state, "healing_herb", 1);
  state.map[y][x] = TILE.GRASS;
  Dialogue.show(["You pick a sprig of Healing Herb."]);
}

function handleGatherMoonleaf(state, x, y) {
  addItem(state, "moonleaf", 1);
  state.map[y][x] = TILE.GRASS;
  Dialogue.show(["You gather a pale leaf of Moonleaf."]);
}

// Bushes always yield 1-2 random drops from FORAGE_LOOT_TABLE, then clear
// like a Healing Herb or Moonleaf patch. Reachable via the facing+Enter
// interact chain, or by clicking the "Forage" popup drawn near the player.
function handleForage(state, x, y) {
  state.map[y][x] = TILE.GRASS;
  const rolls = 1 + Math.floor(Math.random() * 2); // 1-2
  const gained = [];
  for (let i = 0; i < rolls; i++) {
    const itemId = FORAGE_LOOT_TABLE[Math.floor(Math.random() * FORAGE_LOOT_TABLE.length)];
    addItem(state, itemId, 1);
    gained.push(ITEMS[itemId].name);
  }
  Dialogue.show([`You forage the bush and find: ${gained.join(", ")}.`]);
}

function handleBedInteract(state) {
  if (isNightTime(state.turnCount)) {
    Dialogue.show(["You climb into the warm bed.", "Sleep comes quickly..."], {
      onComplete: () => {
        const p = state.player;
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        const remainder = state.turnCount % CYCLE_LENGTH;
        state.turnCount += CYCLE_LENGTH - remainder;
      },
    });
  } else {
    Dialogue.show(["The bed looks inviting, but it's still daylight outside."]);
  }
}
