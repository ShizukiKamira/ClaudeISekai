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

const FORAGE_BURST_MS = 450;

function spawnForageBurst(state, tileX, tileY) {
  state.forageEffects.push({
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
    startedAt: performance.now(),
  });
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

// Herb/Moonleaf patches route through the same unified forage flow as
// bushes and sand, so the facing+Enter interact chain gives the exact same
// odds (including the bonus stick/flint chance) as clicking the popup.
function handleGatherHerb(state, x, y) {
  handleForage(state, x, y);
}

function handleGatherMoonleaf(state, x, y) {
  handleForage(state, x, y);
}

// Every forage source (bush, herb patch, moonleaf patch, sand patch) yields
// its own small random assortment, then clears back to grass, plus an
// independent chance of a bonus Stick and/or Flint on top - reachable via
// the facing+Enter interact chain, or by clicking the "Forage" popup drawn
// near the player.
function handleForage(state, x, y) {
  const source = FORAGE_SOURCES[state.map[y][x]];
  if (!source) return;
  state.map[y][x] = TILE.GRASS;

  const rolls = source.minRolls + Math.floor(Math.random() * (source.maxRolls - source.minRolls + 1));
  const gained = [];
  for (let i = 0; i < rolls; i++) {
    const itemId = source.table[Math.floor(Math.random() * source.table.length)];
    addItem(state, itemId, 1);
    gained.push(ITEMS[itemId].name);
  }

  const bonuses = [];
  if (Math.random() < FORAGE_BONUS_CHANCE) {
    addItem(state, "stick", 1);
    bonuses.push("Stick");
  }
  if (Math.random() < FORAGE_BONUS_CHANCE) {
    addItem(state, "flint", 1);
    bonuses.push("Flint");
  }

  spawnForageBurst(state, x, y);
  let msg = `You forage and find: ${gained.join(", ")}.`;
  if (bonuses.length) msg += ` Lucky find: ${bonuses.join(", ")}!`;
  Dialogue.show([msg]);
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
