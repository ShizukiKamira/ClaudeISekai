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

// Shared by the persistent HUD hotbar (during OVERWORLD) and the Inventory
// tab's copy of it (the only place a potion drag can reach it, since the
// HUD one is hidden behind the MENU panel). A slot holds either the class's
// assigned active skill (dims on the shared attack cooldown, as before) or a
// dragged-on consumable (dims and counts down its own per-slot cooldown).
function renderHotbarRow(ctx, state, x, y, slotSize, hitboxKey) {
  const p = state.player;
  const gap = Math.max(3, Math.round(slotSize * 0.18));
  const now = performance.now();
  const skill = CLASS_SKILLS[p.class];
  const onSkillCooldown = now < p.attackCooldownUntil;

  state.uiHitboxes[hitboxKey] = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const sx = x + i * (slotSize + gap);
    const val = p.hotbar[i];
    const isSkill = !!skill && val === skill.id;
    const itemData = !isSkill && val ? ITEMS[val] : null;
    const itemCooldownRemain = itemData ? Math.max(0, (p.hotbarCooldownUntil[i] || 0) - now) : 0;

    ctx.save();
    if (isSkill && onSkillCooldown) ctx.globalAlpha = 0.5;
    if (itemData && itemCooldownRemain > 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = "rgba(10,14,12,0.78)";
    ctx.fillRect(sx, y, slotSize, slotSize);
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, y, slotSize, slotSize);
    if (isSkill && val === "fireball") {
      drawFireballIcon(ctx, sx + slotSize / 2, y + slotSize / 2, slotSize * 0.7);
    } else if (itemData) {
      drawItemIcon(ctx, val, sx + slotSize / 2, y + slotSize / 2, slotSize * 0.7);
    }
    ctx.restore();

    if (itemData && itemCooldownRemain > 0) {
      ctx.fillStyle = "#f2f2ec";
      ctx.font = `bold ${Math.max(10, Math.floor(slotSize * 0.4))}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(Math.ceil(itemCooldownRemain / 1000)), sx + slotSize / 2, y + slotSize / 2 + slotSize * 0.15);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "#cfd8cf";
    ctx.font = "9px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(i + 1), sx + 2, y + 10);
    state.uiHitboxes[hitboxKey].push({ idx: i, x: sx, y, w: slotSize, h: slotSize });
  }
}

// ---------------------------------------------------------------------------
// Hotbar drag-and-drop: dragging a consumable from the inventory grid onto a
// hotbar slot assigns it there; dragging directly from one hotbar slot to
// another moves it (not just inventory-grid -> hotbar); a plain click
// (down+up with barely any movement) on an already-assigned slot removes
// it. The same item can never occupy two hotbar slots at once - assigning
// or moving one clears any other slot that already held it.
// ---------------------------------------------------------------------------

const DRAG_CLICK_THRESHOLD = 6; // px - below this, a mousedown+up counts as a click, not a drag

function hotbarSlotAt(hitboxList, x, y) {
  return (hitboxList || []).find((b) => pointInRect(x, y, b)) || null;
}

function clearHotbarDuplicates(player, itemId, exceptIdx) {
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (i !== exceptIdx && player.hotbar[i] === itemId) player.hotbar[i] = null;
  }
}

function assignHotbarSlot(state, slotIdx, itemId) {
  clearHotbarDuplicates(state.player, itemId, slotIdx);
  state.player.hotbar[slotIdx] = itemId;
}

function startHotbarDrag(state, invItems, invHitboxKey, hotbarHitboxKey) {
  // Deliberately keyed off mouseDownPos (which persists across frames until
  // this same flow clears it) rather than the momentary mouseIsDown flag -
  // a fast click can see its mousedown AND mouseup both land between two
  // polls of the game loop, in which case mouseIsDown would already be back
  // to false by the time this runs, and the drag/click would never resolve.
  if (state.dragging || !Input.mouseDownPos) return;
  const invHit = hotbarSlotAt(state.uiHitboxes[invHitboxKey], Input.mouseDownPos.x, Input.mouseDownPos.y);
  if (invHit && invItems[invHit.idx] && ITEMS[invItems[invHit.idx].item].type === "consumable") {
    state.dragging = { from: "inv", idx: invHit.idx, itemId: invItems[invHit.idx].item };
    return;
  }
  const hotHit = hotbarSlotAt(state.uiHitboxes[hotbarHitboxKey], Input.mouseDownPos.x, Input.mouseDownPos.y);
  const cur = hotHit && state.player.hotbar[hotHit.idx];
  if (hotHit && cur && ITEMS[cur] && ITEMS[cur].type === "consumable") {
    state.dragging = { from: "hotbar", idx: hotHit.idx, itemId: cur };
  }
}

function updateHotbarDrag(state, invItems, invHitboxKey, hotbarHitboxKey) {
  startHotbarDrag(state, invItems, invHitboxKey, hotbarHitboxKey);

  if (state.dragging && Input.mouseUpPos) {
    const d = state.dragging;
    state.dragging = null;
    const downPos = Input.mouseDownPos;
    const upPos = Input.mouseUpPos;
    const movedFar = !downPos || Math.hypot(upPos.x - downPos.x, upPos.y - downPos.y) > DRAG_CLICK_THRESHOLD;

    if (d.from === "hotbar" && !movedFar) {
      state.player.hotbar[d.idx] = null; // a plain click on an assigned slot removes it
    } else {
      const hotHit = hotbarSlotAt(state.uiHitboxes[hotbarHitboxKey], upPos.x, upPos.y);
      if (hotHit && !(d.from === "hotbar" && hotHit.idx === d.idx)) {
        assignHotbarSlot(state, hotHit.idx, d.itemId);
      }
      // dropped outside any hotbar slot (or back on its own slot after
      // moving) - cancel, leaving everything unchanged.
    }
  }
  if (Input.mouseUpPos) Input.mouseDownPos = null;
}

// Drawn on top of the Inventory tab: the dragged item's icon follows the
// cursor, and whichever slot it's currently over glows yellow (a hotbar
// slot - a valid drop) or red (an equipment slot - never a valid drop for a
// dragged consumable).
function renderHotbarDragOverlay(ctx, state, hotbarHitboxKey) {
  const d = state.dragging;
  if (!d) return;
  const mx = Input.mousePos.x, my = Input.mousePos.y;

  const hotHit = hotbarSlotAt(state.uiHitboxes[hotbarHitboxKey], mx, my);
  const equipHit = !hotHit && hotbarSlotAt(state.uiHitboxes.equipSlots, mx, my);
  const target = hotHit || equipHit;
  if (target) {
    ctx.save();
    ctx.strokeStyle = hotHit ? "#f6d97a" : "#e84f4f";
    ctx.lineWidth = 3;
    ctx.shadowColor = hotHit ? "rgba(246,217,122,0.9)" : "rgba(232,79,79,0.9)";
    ctx.shadowBlur = 10;
    ctx.strokeRect(target.x - 1, target.y - 1, target.w + 2, target.h + 2);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.9;
  drawItemSlot(ctx, mx - 22, my - 22, 44, { item: d.itemId, qty: 1 }, false);
  ctx.restore();
}

function renderHotbar(ctx, state) {
  const slotSize = 34;
  const gap = 6;
  const totalW = HOTBAR_SIZE * slotSize + (HOTBAR_SIZE - 1) * gap;
  const startX = (canvas.width - totalW) / 2;
  const y = canvas.height - slotSize - 36; // clears the "placing item" bottom bar
  renderHotbarRow(ctx, state, startX, y, slotSize, "hotbar");
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
