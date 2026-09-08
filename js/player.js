// ---------------------------------------------------------------------------
// Player entity: stats, inventory, leveling, free (non-tile) movement
// ---------------------------------------------------------------------------

function createPlayer() {
  return {
    tileX: PLAYER_START.x,
    tileY: PLAYER_START.y,
    pixelX: PLAYER_START.x * TILE_SIZE,
    pixelY: PLAYER_START.y * TILE_SIZE,
    moving: false,
    dir: "down",
    facingAngle: Math.PI / 2, // continuous facing, in radians - drives aiming/animation; dir is derived from it
    moveSpeed: PLAYER_MOVE_SPEED,
    _lastTileX: PLAYER_START.x,
    _lastTileY: PLAYER_START.y,
    level: 1,
    exp: 0,
    expToNext: 30,
    maxHp: 60,
    hp: 60,
    maxMp: 20,
    mp: 20,
    baseAtk: 8,
    baseDef: 3,
    gold: 15,
    class: null,
    weapon: null,
    accessory: null,
    inventory: [],
    crouching: false,
    attackCooldownUntil: 0,
    lastAttackAt: -Infinity,
    meleeAnimKind: "fists", // "blade" | "staff" | "fists" - set at swing time, drives the melee animation
    lastCastAt: -Infinity,
    castAnimKind: "hands", // "staff" | "hands" - set at cast time, drives the fireball cast animation
    fatalParryUsedAt: -Infinity,
    lastToolSwingAt: -Infinity,
    toolSwingType: null, // "axe" | "pickaxe", set alongside lastToolSwingAt
    hunger: HUNGER_MAX,
    thirst: THIRST_MAX,
    tilesOutOfCombat: 0,
    hotbar: new Array(HOTBAR_SIZE).fill(null),
    hotbarCooldownUntil: new Array(HOTBAR_SIZE).fill(0),
    poisonedUntil: 0,
    lastPoisonDamageAt: 0,
    hpFloatText: null,
    mpFloatText: null,
    dashCharges: DASH_MAX_CHARGES,
    dashChargeRegenAt: 0,
    dash: null, // { active, fromX, fromY, toX, toY, startedAt } while a dash is animating
  };
}

function playerAtk(player) {
  const bonus = player.weapon ? ITEMS[player.weapon].atkBonus || 0 : 0;
  return player.baseAtk + bonus;
}

// "sword" | "dagger" | "staff" | null (barehanded) - drives which melee/cast
// animation and in-hand sprite to use, independent of class: a mage who has
// equipped a sword swings it like a sword, not a staff, and vice versa.
function getWeaponKind(player) {
  return player.weapon ? ITEMS[player.weapon].weaponKind || null : null;
}

function playerDef(player) {
  const bonus = player.accessory ? ITEMS[player.accessory].defBonus || 0 : 0;
  return player.baseDef + bonus;
}

function expNeededFor(level) {
  return 25 + level * 20;
}

function grantExp(state, amount) {
  const p = state.player;
  p.exp += amount;
  const messages = [];
  while (p.exp >= p.expToNext) {
    p.exp -= p.expToNext;
    p.level += 1;
    p.expToNext = expNeededFor(p.level);
    p.maxHp += 14;
    p.maxMp += 4;
    p.baseAtk += 3;
    p.baseDef += 1;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    const levelMsg = `Level up! You are now level ${p.level}.`;
    messages.push(levelMsg);
    logEvent(state, levelMsg, "heal");
  }
  return messages;
}

function effectivePlayerSpeed(player) {
  return player.crouching ? player.moveSpeed * CROUCH_SPEED_MULT : player.moveSpeed;
}

// ---------------------------------------------------------------------------
// Direction helpers: 8-way facing derived from a continuous angle (radians,
// 0 = right, increasing clockwise since canvas y grows downward). Movement,
// aiming (toward the mouse), melee/cast animations, and dashing all read the
// same facingAngle, so every one of them can point in any of 8 directions -
// including the 4 diagonals - not just up/down/left/right.
// ---------------------------------------------------------------------------

const DIR8_LIST = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];

function angleToDir8(angle) {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a < 0) a += twoPi;
  const idx = Math.round(a / (Math.PI / 4)) % 8;
  return DIR8_LIST[idx];
}

const DIR8_VECS = {
  right: [1, 0],
  "down-right": [Math.SQRT1_2, Math.SQRT1_2],
  down: [0, 1],
  "down-left": [-Math.SQRT1_2, Math.SQRT1_2],
  left: [-1, 0],
  "up-left": [-Math.SQRT1_2, -Math.SQRT1_2],
  up: [0, -1],
  "up-right": [Math.SQRT1_2, -Math.SQRT1_2],
};

function dir8Vec(dir) {
  return DIR8_VECS[dir] || [0, 1];
}

// Collapses an 8-way dir down to the 4 sprite look drawCharacter knows how to
// draw (the pixel-art body only has up/down/left/right variants) - a
// diagonal keeps its vertical component, since the "up" sprite (hair only,
// no eyes) vs. "down" reads as the more important distinction at this scale.
function dir8To4(dir) {
  if (dir === "up-left" || dir === "up-right") return "up";
  if (dir === "down-left" || dir === "down-right") return "down";
  return dir;
}

// ---------------------------------------------------------------------------
// Continuous collision: entities are circles that slide along solid tiles,
// NPCs, other entities, and placed objects rather than snapping between
// tile centers. `self` is the entity attempting to move (or null), used only
// to exclude it from the entity-vs-entity checks below.
// ---------------------------------------------------------------------------

function dist2D(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function circleHitsSolidTile(state, cx, cy, r) {
  const map = state.map;
  const minTX = Math.floor((cx - r) / TILE_SIZE);
  const maxTX = Math.floor((cx + r) / TILE_SIZE);
  const minTY = Math.floor((cy - r) / TILE_SIZE);
  const maxTY = Math.floor((cy + r) / TILE_SIZE);
  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      if (isPassable(state, tx, ty)) continue;
      const closestX = Math.max(tx * TILE_SIZE, Math.min(cx, tx * TILE_SIZE + TILE_SIZE));
      const closestY = Math.max(ty * TILE_SIZE, Math.min(cy, ty * TILE_SIZE + TILE_SIZE));
      const dx = cx - closestX, dy = cy - closestY;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

function circleBlocked(state, cx, cy, r, self) {
  if (circleHitsSolidTile(state, cx, cy, r)) return true;
  for (const npc of state.npcs) {
    if (dist2D(cx, cy, npc.x * TILE_SIZE + TILE_SIZE / 2, npc.y * TILE_SIZE + TILE_SIZE / 2) < r + TILE_SIZE * 0.35) return true;
  }
  for (const o of state.placedObjects) {
    if (o.type === "bridge") continue;
    if (dist2D(cx, cy, o.x * TILE_SIZE + TILE_SIZE / 2, o.y * TILE_SIZE + TILE_SIZE / 2) < r + TILE_SIZE * 0.4) return true;
  }
  for (const m of state.monsters) {
    if (m === self) continue;
    if (dist2D(cx, cy, m.pixelX + TILE_SIZE / 2, m.pixelY + TILE_SIZE / 2) < r + MONSTER_RADIUS) return true;
  }
  if (self !== state.player) {
    const p = state.player;
    if (dist2D(cx, cy, p.pixelX + TILE_SIZE / 2, p.pixelY + TILE_SIZE / 2) < r + PLAYER_RADIUS + COMBAT_CONTACT_GAP) return true;
  }
  return false;
}

// Moves `entity` by (vx,vy)*dt with axis-separated collision resolution (so
// it slides along a wall instead of stopping dead on diagonal contact).
// Returns whether it actually moved at all.
function moveWithCollision(state, entity, vx, vy, dt, radius) {
  let cx = entity.pixelX + TILE_SIZE / 2;
  let cy = entity.pixelY + TILE_SIZE / 2;
  const dx = vx * dt, dy = vy * dt;
  let moved = false;
  if (dx !== 0) {
    const nx = cx + dx;
    if (!circleBlocked(state, nx, cy, radius, entity)) {
      cx = nx;
      moved = true;
    }
  }
  if (dy !== 0) {
    const ny = cy + dy;
    if (!circleBlocked(state, cx, ny, radius, entity)) {
      cy = ny;
      moved = true;
    }
  }
  entity.pixelX = cx - TILE_SIZE / 2;
  entity.pixelY = cy - TILE_SIZE / 2;
  return moved;
}

// Steers any entity with pixelX/pixelY/moveSpeed/dir/moving fields straight
// toward a pixel-space target, stopping once within stopDist - shared by
// alert field monsters chasing the player and rabbits fleeing from it.
function moveEntityToward(state, entity, targetPixelX, targetPixelY, dt, radius, stopDist) {
  const cx = entity.pixelX + TILE_SIZE / 2, cy = entity.pixelY + TILE_SIZE / 2;
  const dx = targetPixelX - cx, dy = targetPixelY - cy;
  const d = Math.hypot(dx, dy);
  if (d <= stopDist) {
    entity.moving = false;
    return;
  }
  const angle = Math.atan2(dy, dx);
  entity.dir = angleToDir8(angle);
  entity.moving = moveWithCollision(state, entity, Math.cos(angle) * entity.moveSpeed, Math.sin(angle) * entity.moveSpeed, dt, radius);
}

// Idle wandering: picks a random heading (or a pause) every so often and
// commits to it briefly, rather than tile-hopping on a fixed grid.
function wanderEntity(state, entity, dt, radius) {
  const now = performance.now();
  if (!entity._wanderUntil || now > entity._wanderUntil) {
    entity._wanderVec = Math.random() < 0.55 ? null : (() => {
      const angle = Math.random() * Math.PI * 2;
      return [Math.cos(angle), Math.sin(angle)];
    })();
    entity._wanderUntil = now + 500 + Math.random() * 900;
  }
  if (!entity._wanderVec) {
    entity.moving = false;
    return;
  }
  entity.dir = angleToDir8(Math.atan2(entity._wanderVec[1], entity._wanderVec[0]));
  const speed = entity.moveSpeed * 0.55;
  const moved = moveWithCollision(state, entity, entity._wanderVec[0] * speed, entity._wanderVec[1] * speed, dt, radius);
  entity.moving = moved;
  if (!moved) entity._wanderUntil = 0; // blocked - pick a new heading next frame instead of stalling
}

function updateDerivedTile(entity) {
  entity.tileX = Math.floor((entity.pixelX + TILE_SIZE / 2) / TILE_SIZE);
  entity.tileY = Math.floor((entity.pixelY + TILE_SIZE / 2) / TILE_SIZE);
}

// ---------------------------------------------------------------------------
// Player movement: free-roaming in any of 8 directions (WASD/arrows combine
// for diagonals), replacing the old tile-to-tile step. Hunger/thirst decay,
// the day/night clock, and spawn rolls no longer fire on "arriving at a
// tile" - instead they fire once per TILE_SIZE px actually walked, so the
// same pacing holds under continuous movement.
// ---------------------------------------------------------------------------

function tryMovePlayer(state, dt) {
  const player = state.player;
  if (player.dash) {
    updateDash(state, dt);
    updateDerivedTile(player);
    return;
  }

  const move = Input.moveVector();
  if (!move) {
    player.moving = false;
    return;
  }
  const angle = Math.atan2(move.y, move.x);
  player.facingAngle = angle;
  player.dir = angleToDir8(angle);

  const speed = effectivePlayerSpeed(player);
  player.moving = moveWithCollision(state, player, move.x * speed, move.y * speed, dt, PLAYER_RADIUS);
  updateDerivedTile(player);
}

// Fires once every TICK_INTERVAL_MS of real elapsed time, regardless of
// whether the player is walking, standing still, fighting, or reading a
// textbox - called unconditionally every frame from updateOverworld so the
// clock, hunger/thirst, regen, and spawn rolls are all driven by real time
// rather than distance walked. This means a player who just stands still can
// still wait out HP/MP regen, and the day/night cycle keeps advancing either
// way.
function accumulateGameTicks(state, dtMs) {
  if (state.mode === "GAMEOVER") return;
  state.tickAccumMs += dtMs;
  while (state.tickAccumMs >= TICK_INTERVAL_MS) {
    state.tickAccumMs -= TICK_INTERVAL_MS;
    fireGameTick(state);
    if (state.mode === "GAMEOVER") return;
  }
}

function fireGameTick(state) {
  state.turnCount += 1;
  tickOutOfCombatRegen(state);
  tickHungerThirst(state);
  if (state.mode === "GAMEOVER") return;
  tryMonsterSpawn(state);
  tryRabbitSpawn(state);
  updateTraps(state);
}

// Continuous-movement replacement for onPlayerArrivedTile's per-tile
// checks - item pickup and monster-collision-aggro run every frame (both are
// idempotent), while door/shrine triggers fire only on an actual tile
// transition so standing on one doesn't re-fire it every frame.
function updatePlayerTileEffects(state) {
  const p = state.player;
  checkMonsterCollision(state);
  checkItemPickup(state);

  if (p.tileX === p._lastTileX && p.tileY === p._lastTileY) return;
  p._lastTileX = p.tileX;
  p._lastTileY = p.tileY;

  const tile = state.map[p.tileY] && state.map[p.tileY][p.tileX];
  if (tile === TILE.SHRINE && !state.flags.bossDefeated) {
    triggerShrineEvent(state);
    return;
  }
  if (tile === TILE.DOOR) {
    enterOrExitHome(state);
  }
}

function isBlockedByEntity(state, x, y) {
  if (findNpcAt(state, x, y)) return true;
  if (state.monsters.some((m) => m.tileX === x && m.tileY === y)) return true;
  return state.placedObjects.some((o) => o.x === x && o.y === y && o.type !== "bridge");
}

// A bridge placed over water makes that one tile crossable, on top of the
// normal tile-type walkability check.
function isPassable(state, x, y) {
  const map = state.map;
  if (x < 0 || y < 0 || y >= map.length || x >= map[0].length) return false;
  if (isWalkable(map, x, y)) return true;
  return map[y][x] === TILE.WATER && state.placedObjects.some((o) => o.type === "bridge" && o.x === x && o.y === y);
}

function canPlaceAt(state, x, y) {
  if (!isWalkable(state.map, x, y)) return false;
  if (isBlockedByEntity(state, x, y)) return false;
  return !state.monsters.some((m) => m.tileX === x && m.tileY === y);
}

function canPlaceBridgeAt(state, x, y) {
  const map = state.map;
  if (x < 0 || y < 0 || y >= map.length || x >= map[0].length) return false;
  if (map[y][x] !== TILE.WATER) return false;
  return !state.placedObjects.some((o) => o.x === x && o.y === y);
}

function canPlaceItemAt(state, itemId, x, y) {
  return itemId === "bridge" ? canPlaceBridgeAt(state, x, y) : canPlaceAt(state, x, y);
}

function isWalkable(map, x, y) {
  if (x < 0 || y < 0 || y >= map.length || x >= map[0].length) return false;
  return !SOLID_TILES.has(map[y][x]);
}

// The tile the player is facing, derived from their continuous 8-way dir -
// still a single discrete adjacent tile (including the 4 diagonals now),
// used by the facing+Enter interact/gather chain and by placement.
function facingTile(player) {
  const [vx, vy] = dir8Vec(player.dir);
  return { x: player.tileX + Math.round(vx), y: player.tileY + Math.round(vy) };
}

function checkItemPickup(state) {
  const p = state.player;
  for (const pickup of state.itemPickups) {
    if (!pickup.collected && pickup.x === p.tileX && pickup.y === p.tileY) {
      pickup.collected = true;
      const itemId = pickup.item === "class_weapon_upgrade"
        ? (p.class === "mage" ? "magic_staff_1" : "iron_sword")
        : pickup.item;
      addItem(state, itemId, pickup.qty);
      const itemName = itemId === "gold" ? `${pickup.qty} Gold` : ITEMS[itemId].name;
      Dialogue.show([`You found ${itemName}!`]);
      logEvent(state, `Found ${itemName}!`, "loot");
    }
  }
}

// ---------------------------------------------------------------------------
// Dash: Q (optionally held alongside WASD/arrows to aim it) instantly
// commits to a direction and a collision-clamped endpoint up to
// DASH_DISTANCE away, then animates the player there over DASH_DURATION_MS -
// fast, but not an instant teleport. Up to DASH_MAX_CHARGES uses are banked,
// each recharging independently over DASH_RECHARGE_MS.
// ---------------------------------------------------------------------------

function updateDashCharges(state) {
  const p = state.player;
  if (p.dashCharges >= DASH_MAX_CHARGES) return;
  if (performance.now() < p.dashChargeRegenAt) return;
  p.dashCharges += 1;
  if (p.dashCharges < DASH_MAX_CHARGES) p.dashChargeRegenAt = performance.now() + DASH_RECHARGE_MS;
}

// Walks a small step at a time from the entity's current position up to
// maxDist along dirVec, resolving collision axis-by-axis exactly like
// moveWithCollision, so a dash slides along/stops at a wall instead of
// punching through it.
function computeDashEndpoint(state, entity, dirVec, maxDist) {
  const stepPx = 4;
  let cx = entity.pixelX + TILE_SIZE / 2, cy = entity.pixelY + TILE_SIZE / 2;
  let traveled = 0;
  while (traveled < maxDist) {
    const len = Math.min(stepPx, maxDist - traveled);
    let moved = false;
    const nx = cx + dirVec[0] * len;
    if (!circleBlocked(state, nx, cy, PLAYER_RADIUS, entity)) {
      cx = nx;
      moved = true;
    }
    const ny = cy + dirVec[1] * len;
    if (!circleBlocked(state, cx, ny, PLAYER_RADIUS, entity)) {
      cy = ny;
      moved = true;
    }
    if (!moved) break;
    traveled += len;
  }
  return { x: cx - TILE_SIZE / 2, y: cy - TILE_SIZE / 2 };
}

function tryStartDash(state) {
  const p = state.player;
  if (p.dash) return;
  if (p.dashCharges <= 0) {
    state.worldFlashMessage = "Dash is on cooldown.";
    state.worldFlashUntil = performance.now() + 900;
    return;
  }

  const held = Input.moveVector();
  const angle = held ? Math.atan2(held.y, held.x) : p.facingAngle;
  const dirVec = [Math.cos(angle), Math.sin(angle)];
  p.facingAngle = angle;
  p.dir = angleToDir8(angle);

  const now = performance.now();
  if (p.dashCharges === DASH_MAX_CHARGES) p.dashChargeRegenAt = now + DASH_RECHARGE_MS;
  p.dashCharges -= 1;

  const endpoint = computeDashEndpoint(state, p, dirVec, DASH_DISTANCE);
  p.dash = { fromX: p.pixelX, fromY: p.pixelY, toX: endpoint.x, toY: endpoint.y, startedAt: now };
  resetOutOfCombat(state);
}

function updateDash(state, dt) {
  const p = state.player;
  const d = p.dash;
  const t = Math.min(1, (performance.now() - d.startedAt) / DASH_DURATION_MS);
  const eased = easeOutCubic(t);
  p.pixelX = d.fromX + (d.toX - d.fromX) * eased;
  p.pixelY = d.fromY + (d.toY - d.fromY) * eased;
  p.moving = true;
  if (t >= 1) p.dash = null;
}
