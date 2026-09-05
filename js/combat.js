// ---------------------------------------------------------------------------
// Turn-based battle system
// ---------------------------------------------------------------------------

const Battle = {
  active: false,
  enemy: null,
  enemyHp: 0,
  enemyMaxHp: 0,
  isBoss: false,
  log: [],
  menu: "root", // root | skill | item
  cursor: 0,
  playerTurn: true,
  awaitingContinue: false,
  onEnd: null, // "victory" | "defeat" | "flee"
};

function startRandomEncounter(state) {
  const id = RANDOM_ENCOUNTER_TABLE[Math.floor(Math.random() * RANDOM_ENCOUNTER_TABLE.length)];
  startBattle(state, ENEMIES[id]);
}

function triggerShrineEvent(state) {
  Dialogue.show(SHRINE_INTRO_TEXT, {
    onComplete: () => startBattle(state, BOSS),
  });
}

function startBattle(state, enemyTemplate) {
  Battle.active = true;
  Battle.enemy = enemyTemplate;
  Battle.enemyHp = enemyTemplate.hp;
  Battle.enemyMaxHp = enemyTemplate.hp;
  Battle.isBoss = !!enemyTemplate.isBoss;
  Battle.log = [`A wild ${enemyTemplate.name} appears!`];
  Battle.menu = "root";
  Battle.cursor = 0;
  Battle.playerTurn = true;
  Battle.awaitingContinue = false;
  Battle.onEnd = null;
  state.mode = "BATTLE";
}

function pushLog(msg) {
  Battle.log.push(msg);
  if (Battle.log.length > 4) Battle.log.shift();
}

function playerAttack(state) {
  const dmg = Math.max(2, playerAtk(state.player) - Battle.enemy.def + rollVariance());
  Battle.enemyHp = Math.max(0, Battle.enemyHp - dmg);
  pushLog(`You strike the ${Battle.enemy.name} for ${dmg} damage.`);
  afterPlayerAction(state);
}

function playerSkillFireball(state) {
  const cost = 8;
  if (state.player.mp < cost) {
    pushLog("Not enough MP!");
    return;
  }
  state.player.mp -= cost;
  const dmg = Math.max(4, Math.floor(playerAtk(state.player) * 1.6) - Battle.enemy.def + rollVariance());
  Battle.enemyHp = Math.max(0, Battle.enemyHp - dmg);
  pushLog(`You cast Fireball! ${Battle.enemy.name} takes ${dmg} damage.`);
  afterPlayerAction(state);
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
  }
  entry.qty -= 1;
  if (entry.qty <= 0) p.inventory = p.inventory.filter((i) => i.qty > 0);
  return message;
}

function playerUseItem(state, itemId) {
  const message = applyItemEffect(state, itemId);
  if (message) pushLog(message);
  afterPlayerAction(state);
}

function playerFlee(state) {
  if (Battle.isBoss) {
    pushLog("You cannot flee this battle!");
    Battle.menu = "root";
    return;
  }
  if (Math.random() < 0.6) {
    pushLog("You got away safely.");
    endBattle(state, "flee");
  } else {
    pushLog("Couldn't escape!");
    enemyTurn(state);
  }
}

function rollVariance() {
  return Math.floor(Math.random() * 5) - 2;
}

function afterPlayerAction(state) {
  Battle.menu = "root";
  if (Battle.enemyHp <= 0) {
    onEnemyDefeated(state);
  } else {
    enemyTurn(state);
  }
}

function enemyTurn(state) {
  const enemy = Battle.enemy;
  let dmg;
  if (enemy.skill && Math.random() < enemy.skill.chance) {
    dmg = Math.max(3, Math.floor(enemy.atk * enemy.skill.atkMult) - playerDef(state.player) + rollVariance());
    pushLog(`${enemy.name} uses ${enemy.skill.name}! You take ${dmg} damage.`);
  } else {
    dmg = Math.max(2, enemy.atk - playerDef(state.player) + rollVariance());
    pushLog(`${enemy.name} attacks you for ${dmg} damage.`);
  }
  state.player.hp = Math.max(0, state.player.hp - dmg);
  if (state.player.hp <= 0) {
    Battle.awaitingContinue = true;
    Battle.onEnd = "defeat";
    pushLog("You have fallen...");
  }
}

function onEnemyDefeated(state) {
  const enemy = Battle.enemy;
  pushLog(`${enemy.name} is defeated!`);
  const levelMsgs = grantExp(state, enemy.exp);
  state.player.gold += enemy.gold;
  pushLog(`Gained ${enemy.exp} EXP and ${enemy.gold} gold.`);
  if (enemy.drop && Math.random() < enemy.drop.chance) {
    addItem(state, enemy.drop.item, 1);
    pushLog(`You also found ${ITEMS[enemy.drop.item].name}.`);
  }
  for (const m of levelMsgs) pushLog(m);
  if (Battle.isBoss) {
    state.flags.bossDefeated = true;
    addItem(state, "traveler_charm", 1);
    pushLog("The Guardian's light coalesces into a Traveler's Charm.");
  }
  Battle.awaitingContinue = true;
  Battle.onEnd = Battle.isBoss ? "victory" : "won";
}

function endBattle(state, result) {
  Battle.active = false;
  if (result === "defeat") {
    state.mode = "GAMEOVER";
  } else if (result === "victory") {
    state.mode = "VICTORY";
  } else {
    state.mode = "OVERWORLD";
  }
}

function updateBattle(state) {
  if (Battle.awaitingContinue) {
    if (Input.confirmPressed()) {
      const result = Battle.onEnd === "won" ? "won" : Battle.onEnd;
      Battle.awaitingContinue = false;
      if (result === "won") {
        state.mode = "OVERWORLD";
        Battle.active = false;
      } else {
        endBattle(state, result);
      }
    }
    return;
  }

  const options = battleMenuOptions(state);
  if (Input.wasPressed("ArrowUp") || Input.wasPressed("KeyW")) {
    Battle.cursor = (Battle.cursor - 1 + options.length) % options.length;
  }
  if (Input.wasPressed("ArrowDown") || Input.wasPressed("KeyS")) {
    Battle.cursor = (Battle.cursor + 1) % options.length;
  }
  if (Input.cancelPressed() && Battle.menu !== "root") {
    Battle.menu = "root";
    Battle.cursor = 0;
  }
  if (Input.confirmPressed()) {
    const opt = options[Battle.cursor];
    opt.action(state);
    Battle.cursor = 0;
  }
}

function renderBattle(ctx, state, canvasW, canvasH) {
  // backdrop
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0, Battle.isBoss ? "#2b1a3d" : "#1f3d2a");
  grad.addColorStop(1, "#0e1510");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // enemy sprite
  const cx = canvasW / 2;
  const cy = 170;
  const radius = Battle.isBoss ? 60 : 44;
  ctx.fillStyle = Battle.enemy.color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 20px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(Battle.enemy.name, cx, cy - radius - 20);

  // enemy hp bar
  const barW = 220;
  drawBar(ctx, cx - barW / 2, cy + radius + 20, barW, 14, Battle.enemyHp / Battle.enemyMaxHp, "#c94f4f");
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText(`HP ${Battle.enemyHp}/${Battle.enemyMaxHp}`, cx, cy + radius + 48);
  ctx.textAlign = "left";

  // player status panel
  const p = state.player;
  const panelY = canvasH - 260;
  ctx.fillStyle = "rgba(10,14,12,0.85)";
  ctx.fillRect(16, panelY, 220, 90);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(16, panelY, 220, 90);
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.fillText(`Lv.${p.level} You`, 30, panelY + 22);
  ctx.font = "13px 'Segoe UI', sans-serif";
  drawBar(ctx, 30, panelY + 32, 190, 12, p.hp / p.maxHp, "#4fae5a");
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, 30, panelY + 58);
  drawBar(ctx, 30, panelY + 64, 190, 10, p.mp / p.maxMp, "#4f8dae");
  ctx.fillText(`MP ${p.mp}/${p.maxMp}`, 130, panelY + 58);

  // log box
  const logY = canvasH - 160;
  ctx.fillStyle = "rgba(10,14,12,0.9)";
  ctx.fillRect(16, logY, canvasW - 32, 68);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(16, logY, canvasW - 32, 68);
  ctx.fillStyle = "#f2f2ec";
  ctx.font = "14px 'Segoe UI', sans-serif";
  Battle.log.slice(-3).forEach((line, i) => {
    ctx.fillText(line, 28, logY + 22 + i * 20);
  });

  if (Battle.awaitingContinue) {
    ctx.fillStyle = "#e8c97a";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("Enter / Space to continue", 28, canvasH - 20);
    return;
  }

  // menu box
  const menuY = canvasH - 84;
  ctx.fillStyle = "rgba(10,14,12,0.9)";
  ctx.fillRect(16, menuY, canvasW - 32, 68);
  ctx.strokeStyle = "#e8c97a";
  ctx.strokeRect(16, menuY, canvasW - 32, 68);

  const options = battleMenuOptions(state);
  const cols = 2;
  options.forEach((opt, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = 32 + col * ((canvasW - 64) / cols);
    const oy = menuY + 24 + row * 26;
    ctx.fillStyle = i === Battle.cursor ? "#e8c97a" : "#f2f2ec";
    ctx.font = "15px 'Segoe UI', sans-serif";
    ctx.fillText((i === Battle.cursor ? "> " : "  ") + opt.label, ox, oy);
  });
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

function battleMenuOptions(state) {
  if (Battle.menu === "root") {
    return [
      { label: "Attack", action: () => playerAttack(state) },
      { label: "Skill", action: () => { Battle.menu = "skill"; Battle.cursor = 0; } },
      { label: "Item", action: () => { Battle.menu = "item"; Battle.cursor = 0; } },
      { label: "Run", action: () => playerFlee(state) },
    ];
  }
  if (Battle.menu === "skill") {
    return [
      { label: "Fireball (8 MP)", action: () => playerSkillFireball(state) },
      { label: "Back", action: () => { Battle.menu = "root"; } },
    ];
  }
  if (Battle.menu === "item") {
    const items = state.player.inventory
      .filter((i) => ITEMS[i.item].type === "consumable")
      .map((i) => ({
        label: `${ITEMS[i.item].name} x${i.qty}`,
        action: () => playerUseItem(state, i.item),
      }));
    items.push({ label: "Back", action: () => { Battle.menu = "root"; } });
    return items.length ? items : [{ label: "(no items) Back", action: () => { Battle.menu = "root"; } }];
  }
  return [];
}
