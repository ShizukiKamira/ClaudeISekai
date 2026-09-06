// ---------------------------------------------------------------------------
// Skills tab: the player's class skill card, alongside the player panel
// ---------------------------------------------------------------------------

const CLASS_SKILLS = {
  mage: {
    id: "fireball",
    name: "Fireball",
    type: "active",
    costLabel: "8 MP",
    desc: "Assign to a hotbar slot below, then press or click it to hurl a bolt of flame in front of you for ~1.6x your Attack in damage.",
  },
  swordsman: {
    id: "parry",
    name: "Parry",
    type: "passive",
    costLabel: "Passive",
    desc: "Always active. 10% chance to parry any incoming attack. 50% chance to parry a blow that would otherwise be fatal - that reflex needs about 15 seconds to recover between uses.",
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

// Active skills (Fireball) live on a numbered hotbar slot the player
// assigns from this tab; passive skills (Parry) are always on and never
// occupy a slot. Shared by both the digit-key press and clicking a slot.
function assignSkillToSlot(state, skill, slotIndex) {
  const p = state.player;
  if (p.hotbar[slotIndex] === skill.id) {
    p.hotbar[slotIndex] = null; // press/click the same slot again to unassign
  } else {
    for (let j = 0; j < HOTBAR_SIZE; j++) {
      if (p.hotbar[j] === skill.id) p.hotbar[j] = null;
    }
    p.hotbar[slotIndex] = skill.id;
  }
}

function updateSkillsTab(state) {
  const p = state.player;
  const skill = CLASS_SKILLS[p.class];
  if (!skill || skill.type !== "active") return;
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (Input.wasPressed(`Digit${i + 1}`)) assignSkillToSlot(state, skill, i);
  }
  if (Input.clickPos) {
    const hit = (state.uiHitboxes.skillsHotbar || []).find((b) => pointInRect(Input.clickPos.x, Input.clickPos.y, b));
    if (hit) {
      assignSkillToSlot(state, skill, hit.idx);
      Input.clickPos = null;
    }
  }
}

function renderHotbar(ctx, state) {
  const p = state.player;
  const slotSize = 34;
  const gap = 6;
  const totalW = HOTBAR_SIZE * slotSize + (HOTBAR_SIZE - 1) * gap;
  const startX = (canvas.width - totalW) / 2;
  const y = canvas.height - slotSize - 36; // clears the "placing item" bottom bar
  const now = performance.now();
  const onCooldown = now < p.attackCooldownUntil;

  state.uiHitboxes.hotbar = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const sx = startX + i * (slotSize + gap);
    const skillId = p.hotbar[i];
    ctx.save();
    if (skillId && onCooldown) ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(10,14,12,0.78)";
    ctx.fillRect(sx, y, slotSize, slotSize);
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, y, slotSize, slotSize);
    if (skillId === "fireball") {
      drawFireballIcon(ctx, sx + slotSize / 2, y + slotSize / 2, slotSize * 0.7);
    }
    ctx.restore();

    ctx.fillStyle = "#cfd8cf";
    ctx.font = "9px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(i + 1), sx + 2, y + 10);
    state.uiHitboxes.hotbar.push({ idx: i, x: sx, y, w: slotSize, h: slotSize });
  }
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

    if (skill.type === "active") {
      const slotIdx = p.hotbar.indexOf(skill.id);
      const slotLabel = slotIdx >= 0
        ? `Hotbar slot ${slotIdx + 1} - click it (or press ${slotIdx + 1}) to unassign`
        : "Not on hotbar - click a slot below (or press 1-9) to assign it";
      ctx.fillStyle = slotIdx >= 0 ? "#7cd68a" : "#e88a5a";
      ctx.font = "12px 'Segoe UI', sans-serif";
      ctx.fillText(slotLabel, x + 140, y + cardH - 34);

      const miniSize = 22, miniGap = 4;
      const totalW = HOTBAR_SIZE * miniSize + (HOTBAR_SIZE - 1) * miniGap;
      const rowX = x + 140;
      const rowY = y + cardH - 22;
      state.uiHitboxes.skillsHotbar = [];
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const sx = rowX + i * (miniSize + miniGap);
        const assigned = p.hotbar[i] === skill.id;
        ctx.fillStyle = assigned ? "rgba(124,214,138,0.25)" : "rgba(10,14,12,0.6)";
        ctx.fillRect(sx, rowY, miniSize, miniSize);
        ctx.strokeStyle = assigned ? "#7cd68a" : "rgba(232,201,122,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, rowY, miniSize, miniSize);
        ctx.fillStyle = "#cfd8cf";
        ctx.font = "9px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), sx + miniSize / 2, rowY + miniSize / 2 + 3);
        state.uiHitboxes.skillsHotbar.push({ idx: i, x: sx, y: rowY, w: miniSize, h: miniSize });
      }
      ctx.textAlign = "left";
    }
  } else {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText("No class selected.", x + 20, y + 40);
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}
