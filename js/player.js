// ---------------------------------------------------------------------------
// Player entity: stats, inventory, leveling, grid movement
// ---------------------------------------------------------------------------

function createPlayer() {
  return {
    tileX: PLAYER_START.x,
    tileY: PLAYER_START.y,
    pixelX: PLAYER_START.x * TILE_SIZE,
    pixelY: PLAYER_START.y * TILE_SIZE,
    moving: false,
    dir: "down",
    moveSpeed: 220, // pixels per second
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
  };
}

function playerAtk(player) {
  const bonus = player.weapon ? ITEMS[player.weapon].atkBonus || 0 : 0;
  return player.baseAtk + bonus;
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
    messages.push(`Level up! You are now level ${p.level}.`);
  }
  return messages;
}

function tryMovePlayer(state, dt) {
  const player = state.player;
  const map = state.map;

  if (player.moving) {
    const targetX = player.tileX * TILE_SIZE;
    const targetY = player.tileY * TILE_SIZE;
    const dx = targetX - player.pixelX;
    const dy = targetY - player.pixelY;
    const dist = player.moveSpeed * dt;

    if (Math.abs(dx) <= dist && Math.abs(dy) <= dist) {
      player.pixelX = targetX;
      player.pixelY = targetY;
      player.moving = false;
      onPlayerArrivedTile(state);
    } else {
      player.pixelX += Math.sign(dx) * Math.min(dist, Math.abs(dx));
      player.pixelY += Math.sign(dy) * Math.min(dist, Math.abs(dy));
    }
    return;
  }

  const move = Input.moveDirection();
  if (!move) return;
  player.dir = move.dir;

  const newX = player.tileX + move.x;
  const newY = player.tileY + move.y;
  if (isWalkable(map, newX, newY)) {
    player.tileX = newX;
    player.tileY = newY;
    player.moving = true;
  }
}

function isWalkable(map, x, y) {
  if (x < 0 || y < 0 || y >= map.length || x >= map[0].length) return false;
  return !SOLID_TILES.has(map[y][x]);
}

function facingTile(player) {
  let dx = 0, dy = 0;
  if (player.dir === "up") dy = -1;
  else if (player.dir === "down") dy = 1;
  else if (player.dir === "left") dx = -1;
  else if (player.dir === "right") dx = 1;
  return { x: player.tileX + dx, y: player.tileY + dy };
}

function onPlayerArrivedTile(state) {
  state.turnCount += 1;

  if (checkMonsterCollision(state)) return;

  const tile = state.map[player_ySafe(state)][player_xSafe(state)];
  if (tile === TILE.SHRINE && !state.flags.bossDefeated) {
    triggerShrineEvent(state);
    return;
  }
  checkItemPickup(state);

  updateMonstersTurn(state);
  checkMonsterCollision(state);
}

function player_xSafe(state) { return state.player.tileX; }
function player_ySafe(state) { return state.player.tileY; }

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
    }
  }
}
