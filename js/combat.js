// ---------------------------------------------------------------------------
// Live combat: the player swings a sword or casts a fireball directly on the
// map with an attack key, monsters strike back automatically while
// adjacent - there is no separate battle screen or menu.
// ---------------------------------------------------------------------------

function triggerShrineEvent(state) {
  Dialogue.show(SHRINE_INTRO_TEXT, {
    onComplete: () => {
      const spot = facingTile(state.player);
      const x = isTileFreeForMonster(state, spot.x, spot.y) ? spot.x : state.player.tileX;
      const y = isTileFreeForMonster(state, spot.x, spot.y) ? spot.y : state.player.tileY;
      spawnBossMonster(state, x, y);
    },
  });
}

function rollVariance() {
  return Math.floor(Math.random() * 5) - 2;
}

function applyItemEffect(state, itemId) {
  const p = state.player;
  const entry = p.inventory.find((i) => i.item === itemId);
  if (!entry || entry.qty <= 0) return null;
  const data = ITEMS[itemId];
  let message = null;
  if (data.heal) {
    p.hp = Math.min(p.maxHp, p.hp + data.heal);
    message = `You use a ${data.name} and recover ${data.heal} HP.`;
  } else if (data.restoreMp) {
    p.mp = Math.min(p.maxMp, p.mp + data.restoreMp);
    message = `You use a ${data.name} and recover ${data.restoreMp} MP.`;
  } else if (data.restoreHunger) {
    p.hunger = Math.min(HUNGER_MAX, p.hunger + data.restoreHunger);
    message = `You eat the ${data.name} and recover ${data.restoreHunger} Hunger.`;
  }
  entry.qty -= 1;
  if (entry.qty <= 0) p.inventory = p.inventory.filter((i) => i.qty > 0);
  return message;
}

// The tile directly ahead of the player, plus the tile on either side of
// it (perpendicular to facing direction), for a 3-tile-wide sword swing.
function meleeHitTiles(player) {
  const target = facingTile(player);
  const facingHorizontally = target.x !== player.tileX;
  if (facingHorizontally) {
    return [
      { x: target.x, y: target.y - 1 },
      { x: target.x, y: target.y },
      { x: target.x, y: target.y + 1 },
    ];
  }
  return [
    { x: target.x - 1, y: target.y },
    { x: target.x, y: target.y },
    { x: target.x + 1, y: target.y },
  ];
}

// Attacking doesn't move the player, but it still gives monsters a chance
// to act - otherwise a player could sit in one spot forever without ever
// letting other monsters wander, spot them, or the day/night clock advance.
function advanceTurnForAction(state) {
  state.turnCount += 1;
  updateMonstersTurn(state);
}

// F always swings a melee attack, regardless of class - a mage's active
// skill (e.g. Fireball) is cast from the hotbar instead, via a number key.
function tryPlayerAttack(state) {
  const p = state.player;
  if (!p.class) return;
  const now = performance.now();
  if (now < p.attackCooldownUntil) return;

  p.attackCooldownUntil = now + ATTACK_COOLDOWN_MS;
  p.lastAttackAt = now;
  resetOutOfCombat(state);

  // Resolve the swing against monsters' current tiles before letting them
  // take their turn - otherwise an already-alert adjacent monster can
  // chase-step diagonally out of the hitbox in the same instant and dodge
  // a swing it was standing right in front of.
  const tiles = meleeHitTiles(p);
  const hits = state.monsters.filter((m) => tiles.some((t) => t.x === m.tileX && t.y === m.tileY));
  for (const m of hits) {
    const dmg = Math.max(2, playerAtk(p) - m.enemy.def + rollVariance());
    damageMonster(state, m, dmg);
  }

  advanceTurnForAction(state);
}

// Casts the active skill assigned to a hotbar slot (1-9). Passive skills
// (e.g. Parry) are always active and never occupy a slot.
function castHotbarSkill(state, slotIndex) {
  const p = state.player;
  const skillId = p.hotbar[slotIndex];
  if (!skillId) return;
  const skill = CLASS_SKILLS[p.class];
  if (!skill || skill.id !== skillId || skill.type !== "active") return;

  const now = performance.now();
  if (now < p.attackCooldownUntil) return;

  if (skillId === "fireball") {
    if (p.mp < FIREBALL_MP_COST) {
      state.worldFlashMessage = "Not enough MP!";
      state.worldFlashUntil = now + 1000;
      return;
    }
    p.mp -= FIREBALL_MP_COST;
    p.attackCooldownUntil = now + ATTACK_COOLDOWN_MS;
    resetOutOfCombat(state);
    spawnFireball(state, p);
    advanceTurnForAction(state);
  }
}

function spawnFireball(state, player) {
  const dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.dir];
  state.projectiles.push({
    x: player.pixelX + TILE_SIZE / 2,
    y: player.pixelY + TILE_SIZE / 2,
    vx: dirVec[0] * FIREBALL_SPEED,
    vy: dirVec[1] * FIREBALL_SPEED,
    spawnedAt: performance.now(),
    dmgBase: Math.floor(playerAtk(player) * 1.6),
  });
}

function updateProjectiles(state, dt) {
  const now = performance.now();
  state.projectiles = state.projectiles.filter((proj) => {
    if (now - proj.spawnedAt > FIREBALL_MAX_LIFE_MS) return false;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    const tileX = Math.floor(proj.x / TILE_SIZE);
    const tileY = Math.floor(proj.y / TILE_SIZE);
    if (!isPassable(state, tileX, tileY)) return false;

    const hit = state.monsters.find((m) => m.tileX === tileX && m.tileY === tileY);
    if (hit) {
      const dmg = Math.max(4, proj.dmgBase - hit.enemy.def + rollVariance());
      damageMonster(state, hit, dmg);
      return false;
    }
    return true;
  });
}

function updateMonsterCombat(state, dt) {
  const p = state.player;
  const now = performance.now();
  for (const m of state.monsters) {
    if (!m.alert) continue;
    if (chebyshevDist(m.tileX, m.tileY, p.tileX, p.tileY) > 1) continue;
    if (now < (m.nextAttackAt || 0)) continue;
    m.nextAttackAt = now + MONSTER_ATTACK_INTERVAL_MS;
    resolveMonsterAttack(state, m);
  }
}

function attemptParry(player, incomingDmg) {
  if (player.class !== "swordsman") return { parried: false };
  const now = performance.now();
  const wouldBeFatal = incomingDmg >= player.hp;
  if (wouldBeFatal && now - player.fatalParryUsedAt > FATAL_PARRY_COOLDOWN_MS) {
    if (Math.random() < 0.5) {
      player.fatalParryUsedAt = now;
      return { parried: true, fatal: true };
    }
  }
  if (Math.random() < 0.1) return { parried: true, fatal: false };
  return { parried: false };
}

function resolveMonsterAttack(state, monster) {
  const enemy = monster.enemy;
  const p = state.player;
  let dmg;
  let msg;
  if (enemy.skill && Math.random() < enemy.skill.chance) {
    dmg = Math.max(3, Math.floor(enemy.atk * enemy.skill.atkMult) - playerDef(p) + rollVariance());
    msg = `${enemy.name} uses ${enemy.skill.name}!`;
  } else {
    dmg = Math.max(2, enemy.atk - playerDef(p) + rollVariance());
    msg = `${enemy.name} attacks!`;
  }

  resetOutOfCombat(state);

  const parry = attemptParry(p, dmg);
  if (parry.parried) {
    state.worldFlashMessage = parry.fatal ? "You parry the killing blow!" : "You parry the attack!";
    state.worldFlashUntil = performance.now() + 1000;
    return;
  }

  p.hp = Math.max(0, p.hp - dmg);
  state.worldFlashMessage = `${msg} -${dmg} HP`;
  state.worldFlashUntil = performance.now() + 1000;
  if (p.hp <= 0) {
    state.mode = "GAMEOVER";
  }
}

function damageMonster(state, monster, dmg) {
  resetOutOfCombat(state);
  monster.currentHp = Math.max(0, monster.currentHp - dmg);
  monster.hitFlashUntil = performance.now() + 150;
  monster.floatText = { text: `-${dmg}`, until: performance.now() + 700 };
  // Getting hit (a fireball landing from range, say) wakes the monster up
  // even if it hadn't spotted the player yet - it comes to fight back.
  if (!monster.alert) {
    monster.alert = true;
    monster.chaseTilesLeft = FIELD_CHASE_MIN + Math.floor(Math.random() * (FIELD_CHASE_MAX - FIELD_CHASE_MIN + 1));
  }
  if (monster.currentHp <= 0) {
    defeatMonster(state, monster);
  }
}

// Walking undisturbed slowly mends the player's wounds: after 5 tiles with
// no combat, every further tile heals a little HP and MP, shown as floating
// green/blue text above the player.
function resetOutOfCombat(state) {
  state.player.tilesOutOfCombat = 0;
}

function tickOutOfCombatRegen(state) {
  const p = state.player;
  p.tilesOutOfCombat += 1;
  if (p.tilesOutOfCombat <= OUT_OF_COMBAT_TILE_THRESHOLD) return;
  // A starving or dehydrated body doesn't mend itself passively.
  if (p.hunger <= 0 || p.thirst <= 0) return;

  const now = performance.now();
  if (p.hp < p.maxHp) {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + HP_REGEN_PER_TILE);
    const healed = p.hp - before;
    if (healed > 0) p.hpFloatText = { text: `+${healed}`, until: now + 700 };
  }
  if (p.mp < p.maxMp) {
    const before = p.mp;
    p.mp = Math.min(p.maxMp, p.mp + MP_REGEN_PER_TILE);
    const healed = p.mp - before;
    if (healed > 0) p.mpFloatText = { text: `+${healed}`, until: now + 700 };
  }
}

function defeatMonster(state, monster) {
  const enemy = monster.enemy;
  const levelMsgs = grantExp(state, enemy.exp);
  state.player.gold += enemy.gold;
  state.monsters = state.monsters.filter((m) => m !== monster);

  let msg = `Defeated ${enemy.name}! +${enemy.exp} EXP, +${enemy.gold} gold.`;
  if (enemy.drop && Math.random() < enemy.drop.chance) {
    addItem(state, enemy.drop.item, 1);
    msg += ` Found ${ITEMS[enemy.drop.item].name}.`;
  }
  if (levelMsgs.length) msg += ` ${levelMsgs[levelMsgs.length - 1]}`;

  if (monster.isBoss) {
    state.flags.bossDefeated = true;
    addItem(state, "traveler_charm", 1);
    Dialogue.show(VICTORY_TEXT.slice(0, 2), {
      onComplete: () => {
        state.mode = "VICTORY";
      },
    });
  } else {
    state.worldFlashMessage = msg;
    state.worldFlashUntil = performance.now() + 1800;
  }
}

function drawBar(ctx, x, y, w, h, ratio, color) {
  ratio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = "#222";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(x, y, w, h);
}
