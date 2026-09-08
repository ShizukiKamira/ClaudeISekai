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
  } else if (data.restoreHunger && !data.restoreThirst) {
    p.hunger = Math.min(HUNGER_MAX, p.hunger + data.restoreHunger);
    message = `You eat the ${data.name} and recover ${data.restoreHunger} Hunger.`;
  } else if (data.restoreThirst) {
    p.thirst = Math.min(THIRST_MAX, p.thirst + data.restoreThirst);
    if (data.restoreHunger) p.hunger = Math.min(HUNGER_MAX, p.hunger + data.restoreHunger);
    message = data.restoreHunger
      ? `You eat the ${data.name} and recover ${data.restoreHunger} Hunger and ${data.restoreThirst} Thirst.`
      : `You drink the ${data.name} and recover ${data.restoreThirst} Thirst.`;
    if (data.poisonChance && Math.random() < data.poisonChance) {
      applyPoison(state);
      message += " It tasted foul - you feel sick!";
    }
  }
  entry.qty -= 1;
  if (entry.qty <= 0) p.inventory = p.inventory.filter((i) => i.qty > 0);
  if (data.leavesFlask) addItem(state, "empty_flask", 1);
  return message;
}

// Poisoning: a chance from drinking Dirty Water. Deals POISON_DAMAGE_PER_TICK
// once a second while active, but never pushes HP below POISON_HP_FLOOR (and
// does nothing at all once HP is already at or under that floor).
function applyPoison(state) {
  const p = state.player;
  p.poisonedUntil = performance.now() + POISON_DURATION_MS;
}

function updatePoisoning(state) {
  const p = state.player;
  if (!p.poisonedUntil) return;
  const now = performance.now();
  if (now >= p.poisonedUntil) {
    p.poisonedUntil = 0;
    return;
  }
  if (now - p.lastPoisonDamageAt < POISON_TICK_MS) return;
  p.lastPoisonDamageAt = now;
  if (p.hp > POISON_HP_FLOOR) {
    const dmg = Math.min(POISON_DAMAGE_PER_TICK, p.hp - POISON_HP_FLOOR);
    p.hp -= dmg;
    state.worldFlashMessage = `Poison courses through you! -${dmg} HP`;
    state.worldFlashUntil = now + 900;
    if (p.hp <= 0) state.mode = "GAMEOVER";
  }
}

// Every entity (a monster's tile, or an explicit pixel target) within
// MELEE_RANGE of the player and inside a MELEE_HALF_ANGLE cone around their
// continuous facing angle - the free-aim replacement for the old fixed
// 3-tile-wide line, letting a swing land in any of 8 directions including
// the diagonals.
function meleeHitTargets(player, entities, getCenter) {
  const cx = player.pixelX + TILE_SIZE / 2, cy = player.pixelY + TILE_SIZE / 2;
  return entities.filter((e) => {
    const [ex, ey] = getCenter(e);
    const dx = ex - cx, dy = ey - cy;
    const d = Math.hypot(dx, dy);
    if (d > MELEE_RANGE) return false;
    if (d < 1) return true; // degenerate case: standing exactly on the player
    let diff = Math.abs(Math.atan2(dy, dx) - player.facingAngle);
    diff = Math.min(diff, Math.PI * 2 - diff);
    return diff <= MELEE_HALF_ANGLE;
  });
}

// Points the player's continuous facing angle straight at wherever the
// mouse cursor currently sits, in world space - called right before an
// attack resolves so melee and fireball both aim anywhere around the
// player (including diagonals), not only 4 cardinal directions.
function aimTowardMouse(state) {
  const p = state.player;
  const worldX = Input.mousePos.x + Camera.x;
  const worldY = Input.mousePos.y + Camera.y;
  const cx = p.pixelX + TILE_SIZE / 2, cy = p.pixelY + TILE_SIZE / 2;
  const dx = worldX - cx, dy = worldY - cy;
  if (Math.hypot(dx, dy) < 2) {
    // Mouse is essentially on the player - keep the current facing, but
    // resync facingAngle from dir in case something (e.g. a direct
    // `player.dir = "right"` assignment) set dir alone without it.
    const [fx, fy] = dir8Vec(p.dir);
    p.facingAngle = Math.atan2(fy, fx);
    return;
  }
  p.facingAngle = Math.atan2(dy, dx);
  p.dir = angleToDir8(p.facingAngle);
}

// F always swings a melee attack, regardless of class - a mage's active
// skill (e.g. Fireball) is cast from the hotbar instead, via a number key.
function tryPlayerAttack(state) {
  const p = state.player;
  if (!p.class) return;
  const now = performance.now();
  if (now < p.attackCooldownUntil) return;

  aimTowardMouse(state);
  const weaponKind = getWeaponKind(p);
  p.meleeAnimKind = weaponKind === "staff" ? "staff" : weaponKind ? "blade" : "fists";
  p.attackCooldownUntil = now + ATTACK_COOLDOWN_MS;
  p.lastAttackAt = now;
  resetOutOfCombat(state);

  // Resolve the swing against monsters' current positions - the cone check
  // uses each monster's live pixel center, so free-roaming movement can't
  // dodge a swing already landing on it.
  const monsterCenter = (m) => [m.pixelX + TILE_SIZE / 2, m.pixelY + TILE_SIZE / 2];
  const hits = meleeHitTargets(p, state.monsters, monsterCenter);
  for (const m of hits) {
    const dmg = Math.max(2, playerAtk(p) - m.enemy.def + rollVariance());
    damageMonster(state, m, dmg);
  }

  // Rabbits are unarmored and never fight back, but otherwise take damage
  // just like a field monster - the direct alternative to a loaded trap.
  const rabbitHits = meleeHitTargets(p, state.animals.filter((a) => a.kind === "rabbit"), monsterCenter);
  for (const a of rabbitHits) {
    const dmg = Math.max(2, playerAtk(p) + rollVariance());
    damageAnimal(state, a, dmg);
  }
}

// Dispatches a hotbar slot press/click to whichever it holds: the class's
// assigned active skill, or a dragged-on consumable (with its own per-slot
// cooldown, independent of the global attack cooldown).
function activateHotbarSlot(state, slotIndex) {
  const p = state.player;
  const val = p.hotbar[slotIndex];
  if (!val) return;
  const skill = CLASS_SKILLS[p.class];
  if (skill && skill.id === val && skill.type === "active") {
    castHotbarSkill(state, slotIndex);
  } else if (ITEMS[val] && ITEMS[val].type === "consumable") {
    useHotbarItem(state, slotIndex);
  }
}

function useHotbarItem(state, slotIndex) {
  const p = state.player;
  const itemId = p.hotbar[slotIndex];
  const data = ITEMS[itemId];
  if (!data || data.type !== "consumable") return;
  const now = performance.now();
  if (now < (p.hotbarCooldownUntil[slotIndex] || 0)) return;
  if (!hasItem(state, itemId)) {
    state.worldFlashMessage = `Out of ${data.name}.`;
    state.worldFlashUntil = now + 1000;
    return;
  }
  const message = applyItemEffect(state, itemId);
  p.hotbarCooldownUntil[slotIndex] = now + HOTBAR_ITEM_COOLDOWN_MS;
  if (message) {
    state.worldFlashMessage = message;
    state.worldFlashUntil = now + 1400;
  }
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
    aimTowardMouse(state);
    // A blade can't channel magic - casting always uses the barehanded gesture
    // unless a staff is actually equipped, even for a mage holding a sword.
    p.castAnimKind = getWeaponKind(p) === "staff" ? "staff" : "hands";
    p.lastCastAt = now;
    p.mp -= FIREBALL_MP_COST;
    p.attackCooldownUntil = now + ATTACK_COOLDOWN_MS;
    resetOutOfCombat(state);
    spawnFireball(state, p);
  }
}

function spawnFireball(state, player) {
  state.projectiles.push({
    x: player.pixelX + TILE_SIZE / 2,
    y: player.pixelY + TILE_SIZE / 2,
    vx: Math.cos(player.facingAngle) * FIREBALL_SPEED,
    vy: Math.sin(player.facingAngle) * FIREBALL_SPEED,
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
    const hitAnimal = state.animals.find((a) => a.kind === "rabbit" && a.tileX === tileX && a.tileY === tileY);
    if (hitAnimal) {
      const dmg = Math.max(4, proj.dmgBase + rollVariance());
      damageAnimal(state, hitAnimal, dmg);
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
    logEvent(state, state.worldFlashMessage, "heal");
    return;
  }

  p.hp = Math.max(0, p.hp - dmg);
  state.worldFlashMessage = `${msg} -${dmg} HP`;
  state.worldFlashUntil = performance.now() + 1000;
  logEvent(state, state.worldFlashMessage, "damage");
  if (p.hp <= 0) {
    state.mode = "GAMEOVER";
  }
}

function damageMonster(state, monster, dmg) {
  if (monster.currentHp <= 0) return; // already dead this tick - never double-process a kill
  resetOutOfCombat(state);
  monster.currentHp = Math.max(0, monster.currentHp - dmg);
  monster.hitFlashUntil = performance.now() + 150;
  monster.floatText = { text: `-${dmg}`, until: performance.now() + 700 };
  logEvent(state, `Hit ${monster.enemy.name} for ${dmg} damage.`, "damage");
  // Getting hit (a fireball landing from range, say) wakes the monster up
  // even if it hadn't spotted the player yet - it comes to fight back.
  if (!monster.alert) {
    monster.alert = true;
    monster.chaseTimeLeftMs = (FIELD_CHASE_MIN + Math.floor(Math.random() * (FIELD_CHASE_MAX - FIELD_CHASE_MIN + 1))) * 1000;
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
  const drops = [];
  if (enemy.drop && Math.random() < enemy.drop.chance) {
    drops.push({ item: enemy.drop.item, qty: 1 });
  }
  if (drops.length) {
    spawnCorpse(state, monster.pixelX + TILE_SIZE / 2, monster.pixelY + TILE_SIZE / 2, drops, `${enemy.name} Corpse`);
    msg += ` It dropped something - loot the corpse.`;
  }
  if (levelMsgs.length) msg += ` ${levelMsgs[levelMsgs.length - 1]}`;
  logEvent(state, `Defeated ${enemy.name}! +${enemy.exp} EXP, +${enemy.gold} gold.`, "kill");

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
