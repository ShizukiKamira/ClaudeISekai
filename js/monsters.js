// ---------------------------------------------------------------------------
// Field monsters: roam tall grass, spot the player within their vision, then
// chase (free-roaming, in any of 8 directions, slower than the player) or
// give up - combat starts on proximity contact either way.
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
    moveSpeed: MONSTER_MOVE_SPEED,
    alert: false,
    chaseTimeLeftMs: 0,
    visionRadius: 3 + Math.floor(Math.random() * 2), // 3-4
    currentHp: enemy.hp,
    nextAttackAt: 0,
    enemy,
  });
}

function spawnBossMonster(state, x, y) {
  const enemy = { ...BOSS };
  fieldMonsterSeq += 1;
  const boss = {
    id: `boss${fieldMonsterSeq}`,
    tileX: x,
    tileY: y,
    pixelX: x * TILE_SIZE,
    pixelY: y * TILE_SIZE,
    moving: false,
    dir: "down",
    moveSpeed: MONSTER_MOVE_SPEED,
    alert: true,
    chaseTimeLeftMs: Infinity,
    visionRadius: 99,
    currentHp: enemy.hp,
    nextAttackAt: 0,
    isBoss: true,
    enemy,
  };
  state.monsters.push(boss);
  return boss;
}

function isTileFreeForMonster(state, x, y) {
  if (!isPassable(state, x, y)) return false;
  if (state.map[y][x] === TILE.SHRINE) return false;
  if (findNpcAt(state, x, y)) return false;
  if (state.player.tileX === x && state.player.tileY === y) return false;
  if (state.placedObjects.some((o) => o.x === x && o.y === y && o.type !== "bridge")) return false;
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

// Alert: steers straight toward the player every frame (free-roaming, so it
// closes the distance diagonally where a straight tile-step chase couldn't),
// stopping just outside melee contact range rather than stacking on top of
// the player. Not alert: spots the player by vision radius, or wanders.
function stepMonsterMovement(state, monster, dt) {
  const p = state.player;
  if (monster.alert) {
    const targetX = p.pixelX + TILE_SIZE / 2, targetY = p.pixelY + TILE_SIZE / 2;
    const stopDist = PLAYER_RADIUS + MONSTER_RADIUS + COMBAT_CONTACT_GAP;
    moveEntityToward(state, monster, targetX, targetY, dt, MONSTER_RADIUS, stopDist);
    monster.chaseTimeLeftMs -= dt * 1000;
    if (monster.chaseTimeLeftMs <= 0) monster.alert = false;
  } else {
    const dist = chebyshevDist(monster.tileX, monster.tileY, p.tileX, p.tileY);
    const effectiveVision = p.crouching ? Math.max(0, monster.visionRadius - 2) : monster.visionRadius;
    if (dist <= effectiveVision) {
      monster.alert = true;
      monster.chaseTimeLeftMs = (FIELD_CHASE_MIN + Math.floor(Math.random() * (FIELD_CHASE_MAX - FIELD_CHASE_MIN + 1))) * 1000;
    } else {
      wanderEntity(state, monster, dt, MONSTER_RADIUS);
    }
  }
  updateDerivedTile(monster);
}

// Crouching lets an already-alert monster close a little faster, the
// free-movement equivalent of the old "2 tiles per player turn" tradeoff.
function updateMonstersMovement(state, dt) {
  const effDt = state.player.crouching ? dt * 1.6 : dt;
  for (const monster of state.monsters) {
    stepMonsterMovement(state, monster, effDt);
  }
}

// Walking within contact range of a monster instantly aggros it (even if it
// hadn't spotted the player via vision yet) - actual damage is resolved
// every frame by updateMonsterCombat while the two remain in range.
function checkMonsterCollision(state) {
  const p = state.player;
  const hit = state.monsters.find((m) => m.tileX === p.tileX && m.tileY === p.tileY);
  if (hit && !hit.alert) {
    hit.alert = true;
    hit.chaseTimeLeftMs = (FIELD_CHASE_MIN + Math.floor(Math.random() * (FIELD_CHASE_MAX - FIELD_CHASE_MIN + 1))) * 1000;
  }
}
