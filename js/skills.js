// ---------------------------------------------------------------------------
// Skills tab: the player's class skill card, alongside the player panel
// ---------------------------------------------------------------------------

const CLASS_SKILLS = {
  mage: {
    id: "fireball",
    name: "Fireball",
    type: "active",
    costLabel: "8 MP",
    desc: "Hurl a bolt of flame for roughly 1.6x your Attack in damage.",
  },
  swordsman: {
    id: "parry",
    name: "Parry",
    type: "passive",
    costLabel: "Passive",
    desc: "Always active. 10% chance to parry any incoming attack. 50% chance to parry a blow that would otherwise be fatal - but that reflex can only save you once per battle.",
  },
};

function drawFireballIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.5);
  ctx.quadraticCurveTo(cx + s * 0.38, cy - s * 0.05, cx + s * 0.18, cy + s * 0.5);
  ctx.quadraticCurveTo(cx, cy + s * 0.3, cx - s * 0.18, cy + s * 0.5);
  ctx.quadraticCurveTo(cx - s * 0.38, cy - s * 0.05, cx, cy - s * 0.5);
  ctx.closePath();
  ctx.fillStyle = "#e8935a";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.28);
  ctx.quadraticCurveTo(cx + s * 0.18, cy + s * 0.02, cx + s * 0.08, cy + s * 0.32);
  ctx.quadraticCurveTo(cx, cy + s * 0.18, cx - s * 0.08, cy + s * 0.32);
  ctx.quadraticCurveTo(cx - s * 0.18, cy + s * 0.02, cx, cy - s * 0.28);
  ctx.closePath();
  ctx.fillStyle = "#f6d97a";
  ctx.fill();
  ctx.restore();
}

function drawParryIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.46);
  ctx.lineTo(cx + s * 0.34, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.34, cy + s * 0.12);
  ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.4, cx, cy + s * 0.5);
  ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.4, cx - s * 0.34, cy + s * 0.12);
  ctx.lineTo(cx - s * 0.34, cy - s * 0.3);
  ctx.closePath();
  ctx.fillStyle = "#7d8a99";
  ctx.fill();
  ctx.strokeStyle = "#c7a75f";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.15);
  ctx.stroke();
  ctx.restore();
}

function renderSkillsTab(ctx, state, x, y, w, h) {
  const p = state.player;
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  const cardH = 220;
  ctx.fillStyle = "rgba(20,28,20,0.75)";
  ctx.fillRect(x, y, leftW, cardH);
  ctx.strokeStyle = "rgba(199,167,95,0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, leftW, cardH);

  const skill = CLASS_SKILLS[p.class];
  if (skill) {
    const iconCx = x + 74;
    const iconCy = y + 74;
    if (skill.id === "fireball") drawFireballIcon(ctx, iconCx, iconCy, 76);
    else if (skill.id === "parry") drawParryIcon(ctx, iconCx, iconCy, 76);

    ctx.fillStyle = "#e8c97a";
    ctx.font = "bold 18px 'Segoe UI', sans-serif";
    ctx.fillText(skill.name, x + 140, y + 44);

    ctx.fillStyle = skill.type === "passive" ? "#8ec9e8" : "#e89a5a";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillText(
      (skill.type === "passive" ? "PASSIVE - " : "ACTIVE - ") + skill.costLabel,
      x + 140,
      y + 64
    );

    ctx.fillStyle = "#cfd8cf";
    ctx.font = "13px 'Segoe UI', sans-serif";
    wrapText(ctx, skill.desc, x + 140, y + 90, leftW - 160, 18);
  } else {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText("No class selected.", x + 20, y + 40);
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}
