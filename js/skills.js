// ---------------------------------------------------------------------------
// Skills tab: the player's class skill card, alongside the player panel
// ---------------------------------------------------------------------------

const CLASS_SKILLS = {
  mage: [
    {
      id: "fireball",
      name: "Fireball",
      type: "active",
      costLabel: "8 MP",
      desc: "Assign to a hotbar slot below, then press or click it to hurl a bolt of flame in front of you for ~1.6x your Attack (scaled further by Mind) in damage.",
    },
    {
      id: "slow",
      name: "Slow",
      type: "active",
      costLabel: "10 MP + 12s cooldown",
      desc: "Assign to a hotbar slot below, then press or click it to hurl a chilling bolt at the chosen target, halving its move speed for 10 seconds. Has its own cooldown on top of the usual cast delay.",
    },
  ],
  swordsman: [
    {
      id: "parry",
      name: "Parry",
      type: "passive",
      costLabel: "Passive",
      desc: "Always active. 10% chance to parry any incoming attack. 50% chance to parry a blow that would otherwise be fatal - that reflex needs about 15 seconds to recover between uses.",
    },
  ],
};

// Every active skill this class has, in one flat list - used wherever code
// needs to check "is this hotbar value one of my skills" without caring
// which specific skill it is.
function classSkillList(playerClass) {
  return CLASS_SKILLS[playerClass] || [];
}

function findClassSkillById(playerClass, skillId) {
  return classSkillList(playerClass).find((s) => s.id === skillId) || null;
}

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

function drawSlowIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.strokeStyle = "#8ec9e8";
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI / 3) * i;
    const dx = Math.cos(angle) * s * 0.46, dy = Math.sin(angle) * s * 0.46;
    ctx.beginPath();
    ctx.moveTo(cx - dx, cy - dy);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.stroke();
    for (const sign of [1, -1]) {
      const ex = cx + dx * sign, ey = cy + dy * sign;
      const tickAngle = angle + Math.PI / 3;
      const tdx = Math.cos(tickAngle) * s * 0.14, tdy = Math.sin(tickAngle) * s * 0.14;
      ctx.beginPath();
      ctx.moveTo(ex - tdx, ey - tdy);
      ctx.lineTo(ex + tdx, ey + tdy);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#f2f9ff";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.09, 0, Math.PI * 2);
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
  if (Input.rightClickPos) {
    const hit = (state.uiHitboxes.skillCards || []).find((b) => pointInRect(Input.rightClickPos.x, Input.rightClickPos.y, b));
    if (hit) {
      openSkillHotbarMenu(state, hit.skill, Input.rightClickPos.x, Input.rightClickPos.y);
      Input.rightClickPos = null;
    }
  }
}

// Right-click menu for the skill card: offers to equip the skill onto the
// hotbar (prompting a second menu to pick which slot) or, if it's already
// assigned somewhere, to unequip it - the discoverable replacement for the
// old "click a mini-slot / press a number" toggle.
function openSkillHotbarMenu(state, skill, x, y) {
  const currentSlot = state.player.hotbar.indexOf(skill.id);
  const options = currentSlot >= 0
    ? [{ label: "Unequip from Hotbar", onSelect: () => assignSkillToSlot(state, skill, currentSlot) }]
    : [{ label: "Equip onto Hotbar", onSelect: () => openSkillSlotPicker(state, skill, x, y) }];
  openContextMenu(state, x, y, options);
}

function openSkillSlotPicker(state, skill, x, y) {
  const options = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    options.push({ label: `Slot ${i + 1}`, onSelect: () => assignSkillToSlot(state, skill, i) });
  }
  openContextMenu(state, x, y, options);
}

// Shared by the persistent HUD hotbar (during OVERWORLD) and the Inventory
// tab's copy of it (the only place a potion drag can reach it, since the
// HUD one is hidden behind the MENU panel). A slot holds either the class's
// assigned active skill (dims on the shared attack cooldown, as before) or a
// dragged-on consumable (dims and counts down its own per-slot cooldown).
const SKILL_ICON_DRAWERS = {
  fireball: drawFireballIcon,
  slow: drawSlowIcon,
};

function renderHotbarRow(ctx, state, x, y, slotSize, hitboxKey) {
  const p = state.player;
  const gap = Math.max(3, Math.round(slotSize * 0.18));
  const now = performance.now();
  const classSkills = classSkillList(p.class);
  const onSharedCooldown = now < p.attackCooldownUntil;

  state.uiHitboxes[hitboxKey] = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const sx = x + i * (slotSize + gap);
    const val = p.hotbar[i];
    const skill = classSkills.find((s) => s.type === "active" && s.id === val) || null;
    const itemData = !skill && val ? ITEMS[val] : null;
    const itemCooldownRemain = itemData ? Math.max(0, (p.hotbarCooldownUntil[i] || 0) - now) : 0;
    // Slow carries its own cooldown on top of the shared attack cooldown -
    // whichever is still running is the one shown counting down.
    const skillOwnCooldownRemain = skill && skill.id === "slow" ? Math.max(0, p.slowCooldownUntil - now) : 0;
    const skillCoolingDown = !!skill && (onSharedCooldown || skillOwnCooldownRemain > 0);

    ctx.save();
    if (skill && skillCoolingDown) ctx.globalAlpha = 0.5;
    if (itemData && itemCooldownRemain > 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = "rgba(10,14,12,0.78)";
    ctx.fillRect(sx, y, slotSize, slotSize);
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, y, slotSize, slotSize);
    if (skill && SKILL_ICON_DRAWERS[skill.id]) {
      SKILL_ICON_DRAWERS[skill.id](ctx, sx + slotSize / 2, y + slotSize / 2, slotSize * 0.7);
    } else if (itemData) {
      drawItemIcon(ctx, val, sx + slotSize / 2, y + slotSize / 2, slotSize * 0.7);
    }
    ctx.restore();

    const cooldownLabelMs = itemData ? itemCooldownRemain : skillOwnCooldownRemain > 0 && !onSharedCooldown ? skillOwnCooldownRemain : 0;
    if (cooldownLabelMs > 0) {
      ctx.fillStyle = "#f2f2ec";
      ctx.font = `bold ${Math.max(10, Math.floor(slotSize * 0.4))}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(Math.ceil(cooldownLabelMs / 1000)), sx + slotSize / 2, y + slotSize / 2 + slotSize * 0.15);
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

// One card per class skill - active skills are right-click-assignable to
// the hotbar (tracked in state.uiHitboxes.skillCards); passives (e.g.
// Parry) just display their effect, with no hotbar row.
function renderSkillCard(ctx, state, skill, x, y, w, cardH) {
  const p = state.player;
  ctx.fillStyle = "rgba(20,28,20,0.75)";
  ctx.fillRect(x, y, w, cardH);
  ctx.strokeStyle = "rgba(199,167,95,0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, cardH);

  if (skill.type === "active") {
    state.uiHitboxes.skillCards.push({ skill, x, y, w, h: cardH });
  }

  const iconSize = Math.min(64, cardH * 0.5);
  const iconCx = x + 64, iconCy = y + cardH / 2 - 4;
  if (skill.id === "fireball") drawFireballIcon(ctx, iconCx, iconCy, iconSize);
  else if (skill.id === "slow") drawSlowIcon(ctx, iconCx, iconCy, iconSize);
  else if (skill.id === "parry") drawParryIcon(ctx, iconCx, iconCy, iconSize);

  const textX = x + 128;
  ctx.fillStyle = "#e8c97a";
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.fillText(skill.name, textX, y + 26);

  ctx.fillStyle = skill.type === "passive" ? "#8ec9e8" : "#e89a5a";
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText((skill.type === "passive" ? "PASSIVE - " : "ACTIVE - ") + skill.costLabel, textX, y + 44);

  ctx.fillStyle = "#cfd8cf";
  ctx.font = "12px 'Segoe UI', sans-serif";
  wrapText(ctx, skill.desc, textX, y + 64, x + w - textX - 16, 15);

  if (skill.type === "active") {
    const slotIdx = p.hotbar.indexOf(skill.id);
    ctx.fillStyle = slotIdx >= 0 ? "#7cd68a" : "#e88a5a";
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText("Right-click card to equip/unequip on the hotbar", textX, y + cardH - 28);

    const miniSize = 18, miniGap = 3;
    const rowY = y + cardH - 18;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const sx = textX + i * (miniSize + miniGap);
      const assigned = p.hotbar[i] === skill.id;
      ctx.fillStyle = assigned ? "rgba(124,214,138,0.25)" : "rgba(10,14,12,0.6)";
      ctx.fillRect(sx, rowY, miniSize, miniSize);
      ctx.strokeStyle = assigned ? "#7cd68a" : "rgba(232,201,122,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, rowY, miniSize, miniSize);
      ctx.fillStyle = "#cfd8cf";
      ctx.font = "8px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), sx + miniSize / 2, rowY + miniSize / 2 + 3);
    }
    ctx.textAlign = "left";
  }
}

function renderSkillsTab(ctx, state, x, y, w, h) {
  const leftW = Math.round(w * 0.56);
  const rightX = x + leftW + 18;
  const rightW = w - leftW - 18;

  const skills = classSkillList(state.player.class);
  state.uiHitboxes.skillCards = [];

  if (skills.length === 0) {
    ctx.fillStyle = "#9aa89a";
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText("No class selected.", x + 20, y + 40);
  } else {
    const cardGap = 12;
    const cardH = Math.min(190, Math.floor((h - cardGap * (skills.length - 1)) / skills.length));
    skills.forEach((skill, idx) => {
      renderSkillCard(ctx, state, skill, x, y + idx * (cardH + cardGap), leftW, cardH);
    });
  }

  renderPlayerPanel(ctx, state, rightX, y, rightW, h);
}
