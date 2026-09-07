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
    if (p.hp <= 0) state.mode = "GAMEOVER";
  }
}

function handleDrinkWater(state) {
  const p = state.player;
  if (p.thirst >= THIRST_MAX) {
    Dialogue.show(["You're not thirsty right now."]);
    return;
  }
  p.thirst = THIRST_MAX;
  Dialogue.show(["You cup your hands and drink from the water. Thirst restored."]);
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

// Rabbits never chase or flee the player - they just wander, same cadence
// as an unaware field monster - and get removed only by a loaded trap.
function wanderAnimal(state, animal) {
  if (Math.random() >= 0.5) return;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const [mx, my] = dirs[Math.floor(Math.random() * dirs.length)];
  const nx = animal.tileX + mx;
  const ny = animal.tileY + my;
  if (isTileFreeForAnimal(state, nx, ny)) {
    animal.tileX = nx;
    animal.tileY = ny;
    animal.moving = true;
    animal.dir = my === 1 ? "down" : my === -1 ? "up" : mx === 1 ? "right" : "left";
  }
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

function updateAnimalsTurn(state) {
  for (const animal of state.animals) {
    wanderAnimal(state, animal);
  }
  updateTraps(state);
  tryRabbitSpawn(state);
}

function updateAnimalAnimations(state, dt) {
  for (const animal of state.animals) {
    if (!animal.moving) continue;
    const targetX = animal.tileX * TILE_SIZE;
    const targetY = animal.tileY * TILE_SIZE;
    const dx = targetX - animal.pixelX;
    const dy = targetY - animal.pixelY;
    const dist = animal.moveSpeed * dt;
    if (Math.abs(dx) <= dist && Math.abs(dy) <= dist) {
      animal.pixelX = targetX;
      animal.pixelY = targetY;
      animal.moving = false;
    } else {
      animal.pixelX += Math.sign(dx) * Math.min(dist, Math.abs(dx));
      animal.pixelY += Math.sign(dy) * Math.min(dist, Math.abs(dy));
    }
  }
}

function handleTrapInteract(state, trapObj) {
  if (trapObj.loaded) {
    trapObj.loaded = false;
    addItem(state, "rabbit_meat", 1);
    Dialogue.show(["You check the trap - a rabbit! You collect the meat and reset the snare."]);
  } else {
    Dialogue.show(["The trap is empty. Wait for a rabbit to wander close."]);
  }
}
