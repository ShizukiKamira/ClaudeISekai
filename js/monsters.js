// ---------------------------------------------------------------------------
// Field monsters: roam tall grass, spot the player within their vision,
// then chase or give up - battle starts on tile contact either way
// ---------------------------------------------------------------------------

let fieldMonsterSeq = 0;

function spawnFieldMonster(state, x, y, speciesId) {
  const enemy = instantiateEnemy(speciesId);
  fieldMonsterSeq += 1;
  state.monsters.push({
    id: `fm${fieldMonsterSeq}`,
    tileX: x,
    tileY: y,
    pixelX: x * TILE_SIZE,
    pixelY: y * TILE_SIZE,
    moving: false,
    dir: "down",
    moveSpeed: 260,
    alert: false,
    chaseTilesLeft: 0,
    frozenTurns: 0,
    visionRadius: 3 + Math.floor(Math.random() * 2), // 3-4
    enemy,
  });
}

function isTileFreeForMonster(state, x, y) {
  if (!isWalkable(state.map, x, y)) return false;
  if (state.map[y][x] === TILE.SHRINE) return false;
  if (findNpcAt(state, x, y)) return false;
  if (state.player.tileX === x && state.player.tileY === y) return false;
  return !state.monsters.some((m) => m.tileX === x && m.tileY === y);
}

function findGrassSpawnSpots(state) {
  const spots = [];
  for (let y = 0; y < state.map.length; y++) {
    for (let x = 0; x < state.map[0].length; x++) {
      if (state.map[y][x] === TILE.TALLGRASS && isTileFreeForMonster(state, x, y)) {
        spots.push({ x, y });
      }
    }
  }
  return spots;
}

function spawnInitialMonsters(state, count) {
  for (let i = 0; i < count; i++) {
    const spots = findGrassSpawnSpots(state);
    if (!spots.length) break;
    const spot = spots[Math.floor(Math.random() * spots.length)];
    const speciesId = RANDOM_ENCOUNTER_TABLE[Math.floor(Math.random() * RANDOM_ENCOUNTER_TABLE.length)];
    spawnFieldMonster(state, spot.x, spot.y, speciesId);
  }
}

function tryMonsterSpawn(state) {
  const cap = isNightTime(state.turnCount) ? NIGHT_MAX_FIELD_MONSTERS : DAY_MAX_FIELD_MONSTERS;
  if (state.monsters.length >= cap) return;
  if (Math.random() >= FIELD_SPAWN_CHANCE) return;
  const spots = findGrassSpawnSpots(state);
  if (!spots.length) return;
  const spot = spots[Math.floor(Math.random() * spots.length)];
  const speciesId = RANDOM_ENCOUNTER_TABLE[Math.floor(Math.random() * RANDOM_ENCOUNTER_TABLE.length)];
  spawnFieldMonster(state, spot.x, spot.y, speciesId);
}

function chebyshevDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function stepMonsterToward(state, monster, targetX, targetY) {
  const dx = Math.sign(targetX - monster.tileX);
  const dy = Math.sign(targetY - monster.tileY);
  const candidates = [];
  if (dx !== 0) candidates.push([dx, 0]);
  if (dy !== 0) candidates.push([0, dy]);
  // Perpendicular detours so a single blocking tile (a tree, an NPC) doesn't
  // wall off a straight-line chase entirely.
  if (dy === 0 && dx !== 0) candidates.push([dx, 1], [dx, -1]);
  if (dx === 0 && dy !== 0) candidates.push([1, dy], [-1, dy]);

  for (const [mx, my] of candidates) {
    const nx = monster.tileX + mx;
    const ny = monster.tileY + my;
    const isPlayerTile = nx === state.player.tileX && ny === state.player.tileY;
    if (isPlayerTile || isTileFreeForMonster(state, nx, ny)) {
      monster.tileX = nx;
      monster.tileY = ny;
      monster.moving = true;
      monster.dir = my === 1 ? "down" : my === -1 ? "up" : mx === 1 ? "right" : "left";
      return;
    }
  }
}

function wanderMonster(state, monster) {
  if (Math.random() >= 0.4) return; // usually stays put
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const [mx, my] = dirs[Math.floor(Math.random() * dirs.length)];
  const nx = monster.tileX + mx;
  const ny = monster.tileY + my;
  if (isTileFreeForMonster(state, nx, ny)) {
    monster.tileX = nx;
    monster.tileY = ny;
    monster.moving = true;
    monster.dir = my === 1 ? "down" : my === -1 ? "up" : mx === 1 ? "right" : "left";
  }
}

function updateMonstersTurn(state) {
  const p = state.player;
  for (const monster of state.monsters) {
    if (monster.frozenTurns > 0) {
      monster.frozenTurns -= 1;
      continue;
    }
    const dist = chebyshevDist(monster.tileX, monster.tileY, p.tileX, p.tileY);
    if (monster.alert) {
      stepMonsterToward(state, monster, p.tileX, p.tileY);
      monster.chaseTilesLeft -= 1;
      if (monster.chaseTilesLeft <= 0) monster.alert = false;
    } else {
      const effectiveVision = p.crouching ? Math.max(0, monster.visionRadius - 2) : monster.visionRadius;
      if (dist <= effectiveVision) {
        monster.alert = true;
        monster.chaseTilesLeft = FIELD_CHASE_MIN + Math.floor(Math.random() * (FIELD_CHASE_MAX - FIELD_CHASE_MIN + 1));
      } else {
        wanderMonster(state, monster);
      }
    }
  }
  tryMonsterSpawn(state);
}

function updateMonsterAnimations(state, dt) {
  for (const monster of state.monsters) {
    if (!monster.moving) continue;
    const targetX = monster.tileX * TILE_SIZE;
    const targetY = monster.tileY * TILE_SIZE;
    const dx = targetX - monster.pixelX;
    const dy = targetY - monster.pixelY;
    const dist = monster.moveSpeed * dt;
    if (Math.abs(dx) <= dist && Math.abs(dy) <= dist) {
      monster.pixelX = targetX;
      monster.pixelY = targetY;
      monster.moving = false;
    } else {
      monster.pixelX += Math.sign(dx) * Math.min(dist, Math.abs(dx));
      monster.pixelY += Math.sign(dy) * Math.min(dist, Math.abs(dy));
    }
  }
}

function checkMonsterCollision(state) {
  const p = state.player;
  const hit = state.monsters.find((m) => m.tileX === p.tileX && m.tileY === p.tileY);
  if (hit) {
    startBattle(state, hit.enemy, hit.id);
    return true;
  }
  return false;
}
