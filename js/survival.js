// ---------------------------------------------------------------------------
// Survival: hunger/thirst drain as the player walks (restored by eating and
// drinking), plus rabbits - harmless critters caught with a placed trap
// rather than fought - that wander tall grass alongside field monsters.
// ---------------------------------------------------------------------------

function tickHungerThirst(state) {
  const p = state.player;
  p.hunger = Math.max(0, p.hunger - HUNGER_DECAY_PER_TILE);
  p.thirst = Math.max(0, p.thirst - THIRST_DECAY_PER_TILE);

  if ((p.hunger <= 0 || p.thirst <= 0) && state.turnCount % STARVATION_INTERVAL_TILES === 0) {
    p.hp = Math.max(0, p.hp - STARVATION_DAMAGE);
    state.worldFlashMessage = p.thirst <= 0 && p.hunger <= 0
      ? "You're starving and dehydrated! -1 HP"
      : p.thirst <= 0
      ? "You're dehydrated! -1 HP"
      : "You're starving! -1 HP";
    state.worldFlashUntil = performance.now() + 1200;
    logEvent(state, state.worldFlashMessage, "damage");
    if (p.hp <= 0) state.mode = "GAMEOVER";
  }
}

// With an Empty Flask on hand, interacting with water fills it with Dirty
// Water instead of drinking straight from the lake - the flask-refill flow
// the empty flask left behind by a drunk Potion exists for.
function handleDrinkWater(state) {
  const p = state.player;
  if (hasItem(state, "empty_flask")) {
    fillFlaskWithDirtyWater(state);
    return;
  }
  if (p.thirst >= THIRST_MAX) {
    Dialogue.show(["You're not thirsty right now."]);
    return;
  }
  p.thirst = THIRST_MAX;
  Dialogue.show(["You cup your hands and drink from the water. Thirst restored."]);
}

function fillFlaskWithDirtyWater(state) {
  const entry = state.player.inventory.find((i) => i.item === "empty_flask");
  entry.qty -= 1;
  if (entry.qty <= 0) state.player.inventory = state.player.inventory.filter((i) => i.qty > 0);
  addItem(state, "dirty_water", 1);
  Dialogue.show(["You fill the flask with murky water from the lake."]);
  logEvent(state, "Filled the flask with dirty water.", "loot");
}

// ---------------------------------------------------------------------------
// Rabbits
// ---------------------------------------------------------------------------

let rabbitSeq = 0;

function spawnRabbit(state, x, y) {
  rabbitSeq += 1;
  state.animals.push({
    id: `rabbit${rabbitSeq}`,
    kind: "rabbit",
    tileX: x,
    tileY: y,
    pixelX: x * TILE_SIZE,
    pixelY: y * TILE_SIZE,
    moving: false,
    dir: "down",
    moveSpeed: RABBIT_MOVE_SPEED,
    currentHp: RABBIT_MAX_HP,
    hitFlashUntil: 0,
    floatText: null,
  });
}

function isTileFreeForAnimal(state, x, y) {
  if (!isPassable(state, x, y)) return false;
  if (state.map[y][x] === TILE.SHRINE) return false;
  if (findNpcAt(state, x, y)) return false;
  if (state.player.tileX === x && state.player.tileY === y) return false;
  if (state.placedObjects.some((o) => o.x === x && o.y === y && o.type !== "bridge")) return false;
  if (state.monsters.some((m) => m.tileX === x && m.tileY === y)) return false;
  return !state.animals.some((a) => a.tileX === x && a.tileY === y);
}

function findAnimalSpawnSpots(state) {
  const spots = [];
  for (let y = 0; y < state.map.length; y++) {
    for (let x = 0; x < state.map[0].length; x++) {
      if (state.map[y][x] === TILE.TALLGRASS && isTileFreeForAnimal(state, x, y)) {
        spots.push({ x, y });
      }
    }
  }
  return spots;
}

function spawnInitialRabbits(state, count) {
  for (let i = 0; i < count; i++) {
    const spots = findAnimalSpawnSpots(state);
    if (!spots.length) break;
    const spot = spots[Math.floor(Math.random() * spots.length)];
    spawnRabbit(state, spot.x, spot.y);
  }
}

function tryRabbitSpawn(state) {
  if (state.animals.length >= RABBIT_LIMIT) return;
  if (Math.random() >= RABBIT_SPAWN_CHANCE) return;
  const spots = findAnimalSpawnSpots(state);
  if (!spots.length) return;
  const spot = spots[Math.floor(Math.random() * spots.length)];
  spawnRabbit(state, spot.x, spot.y);
}

// A rabbit within RABBIT_NOTICE_RADIUS of the player flees away from it in
// a straight continuous line (any of 8 directions) instead of wandering -
// the mirror image of a monster's chase steering. It never fights back, so
// the only ways to end up with meat are a loaded trap or catching up to
// land a direct hit.
function stepRabbitMovement(state, animal, dt) {
  const p = state.player;
  const dist = chebyshevDist(animal.tileX, animal.tileY, p.tileX, p.tileY);
  if (dist <= RABBIT_NOTICE_RADIUS) {
    const ax = animal.pixelX + TILE_SIZE / 2, ay = animal.pixelY + TILE_SIZE / 2;
    const px = p.pixelX + TILE_SIZE / 2, py = p.pixelY + TILE_SIZE / 2;
    const angle = Math.atan2(ay - py, ax - px);
    const fleeTargetX = ax + Math.cos(angle) * TILE_SIZE * 3;
    const fleeTargetY = ay + Math.sin(angle) * TILE_SIZE * 3;
    moveEntityToward(state, animal, fleeTargetX, fleeTargetY, dt, MONSTER_RADIUS * 0.8, 0);
  } else {
    wanderEntity(state, animal, dt, MONSTER_RADIUS * 0.8);
  }
  updateDerivedTile(animal);
}

// Damages a rabbit exactly like damageMonster does a field monster (hit
// flash, floating damage text, HP depletion) - shared by melee swings and
// fireball hits, the direct alternative to waiting on a loaded trap.
function damageAnimal(state, animal, dmg) {
  if (animal.currentHp <= 0) return; // already dead this tick - never double-process a kill
  resetOutOfCombat(state);
  animal.currentHp = Math.max(0, (animal.currentHp ?? RABBIT_MAX_HP) - dmg);
  animal.hitFlashUntil = performance.now() + 150;
  animal.floatText = { text: `-${dmg}`, until: performance.now() + 700 };
  if (animal.currentHp <= 0) {
    killRabbit(state, animal);
  }
}

function killRabbit(state, animal) {
  state.animals = state.animals.filter((a) => a !== animal);
  spawnCorpse(state, animal.pixelX + TILE_SIZE / 2, animal.pixelY + TILE_SIZE / 2, [{ item: "rabbit_meat", qty: 1 }], "Rabbit Corpse");
  state.worldFlashMessage = "You hunted a rabbit! Loot the corpse for meat.";
  state.worldFlashUntil = performance.now() + 1400;
  logEvent(state, "Hunted a rabbit.", "kill");
}

// A trap catches any rabbit currently adjacent to it with a flat per-tick
// chance; the trap then shows a "!" until the player collects it.
function updateTraps(state) {
  const traps = state.placedObjects.filter((o) => o.type === "basic_trap" && !o.loaded);
  if (!traps.length || !state.animals.length) return;
  for (const trap of traps) {
    const nearbyRabbit = state.animals.find(
      (a) => a.kind === "rabbit" && chebyshevDist(a.tileX, a.tileY, trap.x, trap.y) <= 1
    );
    if (nearbyRabbit && Math.random() < TRAP_CATCH_CHANCE) {
      state.animals = state.animals.filter((a) => a !== nearbyRabbit);
      trap.loaded = true;
    }
  }
}

function updateAnimalsMovement(state, dt) {
  for (const animal of state.animals) {
    if (animal.kind === "rabbit") stepRabbitMovement(state, animal, dt);
    else {
      wanderEntity(state, animal, dt, MONSTER_RADIUS * 0.8);
      updateDerivedTile(animal);
    }
  }
}

function handleTrapInteract(state, trapObj) {
  if (trapObj.loaded) {
    trapObj.loaded = false;
    addItem(state, "rabbit_meat", 1);
    Dialogue.show(["You check the trap - a rabbit! You collect the meat and reset the snare."]);
    logEvent(state, "Collected a rabbit from the trap.", "loot");
  } else {
    Dialogue.show(["The trap is empty. Wait for a rabbit to wander close."]);
  }
}
