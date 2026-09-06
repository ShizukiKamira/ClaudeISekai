// ---------------------------------------------------------------------------
// Resource gathering: chopping trees with an axe, mining boulders with a
// pickaxe, and resting at a placed campfire to skip to morning
// ---------------------------------------------------------------------------

function hasItem(state, itemId) {
  return state.player.inventory.some((i) => i.item === itemId);
}

function handleChopTree(state, x, y) {
  if (!hasItem(state, "axe")) {
    Dialogue.show(["You need an Axe to chop this tree."]);
    return;
  }
  const logs = 2 + Math.floor(Math.random() * 2); // 2-3
  const sticks = 2 + Math.floor(Math.random() * 2); // 2-3
  addItem(state, "log", logs);
  addItem(state, "stick", sticks);
  state.map[y][x] = TILE.GRASS;
  Dialogue.show([`You chop down the tree. Found ${logs} Log${logs > 1 ? "s" : ""} and ${sticks} Stick${sticks > 1 ? "s" : ""}.`]);
}

function handleMineBoulder(state, x, y) {
  if (!hasItem(state, "pickaxe")) {
    Dialogue.show(["You need a Pickaxe to mine this boulder."]);
    return;
  }
  const stone = 2 + Math.floor(Math.random() * 2); // 2-3
  const oreType = Math.random() < 0.5 ? "iron_ore" : "copper_ore";
  const oreQty = Math.floor(Math.random() * 3); // 0-2
  const flint = 1 + Math.floor(Math.random() * 2); // 1-2
  addItem(state, "stone", stone);
  if (oreQty > 0) addItem(state, oreType, oreQty);
  addItem(state, "flint", flint);
  state.map[y][x] = TILE.GRASS;
  const oreMsg = oreQty > 0 ? ` and ${oreQty} ${ITEMS[oreType].name}` : "";
  Dialogue.show([`You mine the boulder. Found ${stone} Stone, ${flint} Flint${oreMsg}.`]);
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
