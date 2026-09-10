// ---------------------------------------------------------------------------
// Profile tab: spend stat points earned on level-up (Strength/Mind/Defence),
// and see a full summary of derived combat stats and active buffs/cooldowns.
// ---------------------------------------------------------------------------

const PROFILE_STAT_ROWS = [
  { stat: "str", label: "Strength", detail: (p) => `+${p.allocStr * STR_ATK_PER_POINT} ATK` },
  { stat: "mnd", label: "Mind", detail: (p) => `+${p.allocMnd * MIND_MP_PER_POINT} Max MP, +${Math.round((magicPower(p) - 1) * 100)}% magic dmg` },
  { stat: "def", label: "Defence", detail: (p) => `+${p.allocDef * DEF_PER_POINT} DEF` },
];

function updateProfileTab(state) {
  if (!Input.clickPos) return;
  const hit = (state.uiHitboxes.profileStatButtons || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
  if (hit && state.player.statPoints > 0) {
    spendStatPoint(state, hit.stat);
    logEvent(state, `Spent a point on ${hit.label}.`, "heal");
  }
  Input.clickPos = null;
}

function renderProfileTab(ctx, state, x, y, w, h) {
  const p = state.player;
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.fillText("Attributes", x, y + 16);

  const hasPoints = p.statPoints > 0;
  ctx.fillStyle = hasPoints ? "#f6d97a" : "#8a9a8a";
  ctx.font = "bold 13px 'Segoe UI', sans-serif";
  ctx.fillText(`Unspent Points: ${p.statPoints}`, x, y + 38);

  state.uiHitboxes.profileStatButtons = [];
  const rowH = 44;
  let ry = y + 52;
  for (const row of PROFILE_STAT_ROWS) {
    const value = row.stat === "str" ? p.allocStr : row.stat === "mnd" ? p.allocMnd : p.allocDef;

    ctx.fillStyle = "#f2f2ec";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(`${row.label}  ${value}`, x, ry + 14);

    ctx.fillStyle = "#7cd68a";
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(row.detail(p), x, ry + 30);

    const btnSize = 26;
    const btnX = x + leftW - btnSize, btnY = ry;
    ctx.fillStyle = hasPoints ? "rgba(124,214,138,0.25)" : "rgba(90,106,90,0.2)";
    ctx.fillRect(btnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = hasPoints ? "#7cd68a" : "rgba(138,154,138,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(btnX, btnY, btnSize, btnSize);
    ctx.fillStyle = hasPoints ? "#f2f2ec" : "#5a6a5a";
    ctx.font = "bold 16px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", btnX + btnSize / 2, btnY + btnSize / 2 + 6);
    ctx.textAlign = "left";
    state.uiHitboxes.profileStatButtons.push({ stat: row.stat, label: row.label, x: btnX, y: btnY, w: btnSize, h: btnSize });

    ry += rowH;
  }

  ry += 4;
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 13px 'Segoe UI', sans-serif";
  ctx.fillText("Combat Stats", x, ry + 14);
  ry += 24;

  const atkBonus = p.weapon ? ITEMS[p.weapon].atkBonus || 0 : 0;
  const defBonus = p.accessory ? ITEMS[p.accessory].defBonus || 0 : 0;
  const lineH = 16;
  ctx.font = "11px 'Segoe UI', sans-serif";
  const combatLines = [
    `ATK ${playerAtk(p)}  (base ${p.baseAtk}, weapon +${atkBonus}, strength +${p.allocStr * STR_ATK_PER_POINT})`,
    `DEF ${playerDef(p)}  (base ${p.baseDef}, accessory +${defBonus}, defence +${p.allocDef * DEF_PER_POINT})`,
    `Max MP ${p.maxMp}  (mind contributes +${p.allocMnd * MIND_MP_PER_POINT})`,
    `Magic Power +${Math.round((magicPower(p) - 1) * 100)}%  (Fireball, Slow damage)`,
  ];
  ctx.fillStyle = "#cfd8cf";
  for (const line of combatLines) {
    ctx.fillText(line, x, ry + 12);
    ry += lineH;
  }

  ry += 8;
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 13px 'Segoe UI', sans-serif";
  ctx.fillText("Status Effects", x, ry + 14);
  ry += 24;

  const now = performance.now();
  const statusLines = [];
  if (p.poisonedUntil && now < p.poisonedUntil) {
    statusLines.push({ text: `Poisoned - ${Math.ceil((p.poisonedUntil - now) / 1000)}s left`, color: "#8e6fce" });
  }
  statusLines.push(
    now < p.regenCooldownUntil
      ? { text: `HP/MP regen - cooling down ${Math.ceil((p.regenCooldownUntil - now) / 1000)}s`, color: "#e88a5a" }
      : { text: "HP/MP regen - ready", color: "#7cd68a" }
  );
  statusLines.push({ text: `Dash charges - ${p.dashCharges}/${DASH_MAX_CHARGES}`, color: p.dashCharges > 0 ? "#7cd68a" : "#e88a5a" });
  if (p.class === "mage") {
    statusLines.push(
      now < p.slowCooldownUntil
        ? { text: `Slow - cooling down ${Math.ceil((p.slowCooldownUntil - now) / 1000)}s`, color: "#e88a5a" }
        : { text: "Slow - ready", color: "#7cd68a" }
    );
  }
  if (p.class === "swordsman") {
    statusLines.push(
      now < p.fatalParryUsedAt + FATAL_PARRY_COOLDOWN_MS
        ? { text: `Fatal Parry - cooling down ${Math.ceil((p.fatalParryUsedAt + FATAL_PARRY_COOLDOWN_MS - now) / 1000)}s`, color: "#e88a5a" }
        : { text: "Fatal Parry - ready", color: "#7cd68a" }
    );
  }
  statusLines.push({ text: p.crouching ? "Crouching" : "Standing", color: "#cfd8cf" });

  ctx.font = "11px 'Segoe UI', sans-serif";
  for (const line of statusLines) {
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, x, ry + 12);
    ry += lineH;
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}
