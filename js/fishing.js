// ---------------------------------------------------------------------------
// Fishing: standing near water with a Fishing Rod shows a "Press F to fish"
// prompt. F casts a line; after a short wait for a bite, a minigame starts -
// hold Up/Down (or W/S) to move a green catch-box and keep the fish inside
// it. The fish drifts on its own, more erratically for a bigger/rarer
// catch; time inside the box fills a progress meter, time outside drains it.
// ---------------------------------------------------------------------------

function startFishing(state, x, y) {
  const now = performance.now();
  state.fishing = {
    active: true,
    phase: "casting", // casting -> waiting -> minigame
    targetX: x,
    targetY: y,
    phaseStartedAt: now,
    biteAt: 0,
    fishId: null,
    difficulty: 0,
    fishPos: 0.5,
    fishTargetPos: 0.5,
    fishRetargetAt: 0,
    boxPos: 0.5,
    progress: 0.35,
  };
  Input.clickPos = null;
}

function cancelFishing(state, message) {
  state.fishing.active = false;
  if (message) {
    state.worldFlashMessage = message;
    state.worldFlashUntil = performance.now() + 1500;
    logEvent(state, message, "info");
  }
}

function resolveCatch(state) {
  const fishId = state.fishing.fishId;
  addItem(state, fishId, 1);
  state.fishing.active = false;
  Dialogue.show([`You caught a ${ITEMS[fishId].name}!`]);
  logEvent(state, `Caught a ${ITEMS[fishId].name}!`, "loot");
}

function startFishMinigame(state) {
  const f = state.fishing;
  f.phase = "minigame";
  f.fishId = rollFishCatch();
  f.difficulty = FISH_DIFFICULTY[f.fishId] || 0.3;
  f.fishPos = 0.5;
  f.fishTargetPos = Math.random();
  f.fishRetargetAt = performance.now();
  f.boxPos = 0.5;
  f.progress = 0.35;
}

function updateFishMinigame(state, dt) {
  const f = state.fishing;
  const now = performance.now();

  // The fish drifts toward a periodically-changing target position, more
  // often and more sharply for a bigger/rarer (harder) fish.
  if (now >= f.fishRetargetAt) {
    f.fishTargetPos = Math.random();
    f.fishRetargetAt = now + (700 - f.difficulty * 400) + Math.random() * 400;
  }
  // Ease toward the target instead of beelining at a capped linear speed -
  // asymptotic motion can never overshoot or "teleport" regardless of dt
  // spikes, so the fish always reads as swimming smoothly even when fast.
  const smoothingRate = 3 + f.difficulty * 4; // higher = snappier, still smooth
  f.fishPos += (f.fishTargetPos - f.fishPos) * Math.min(1, smoothingRate * dt);
  f.fishPos = Math.max(0, Math.min(1, f.fishPos));

  const up = Input.isDown("ArrowUp") || Input.isDown("KeyW");
  const down = Input.isDown("ArrowDown") || Input.isDown("KeyS");
  const half = FISH_MINIGAME_BOX_HEIGHT_FRAC / 2;
  if (up && !down) f.boxPos -= FISH_MINIGAME_BOX_SPEED * dt;
  if (down && !up) f.boxPos += FISH_MINIGAME_BOX_SPEED * dt;
  f.boxPos = Math.max(half, Math.min(1 - half, f.boxPos));

  const inBox = f.fishPos >= f.boxPos - half && f.fishPos <= f.boxPos + half;
  f.progress += (inBox ? FISH_MINIGAME_FILL_RATE : -FISH_MINIGAME_DRAIN_RATE) * dt;
  f.progress = Math.max(0, Math.min(1, f.progress));

  if (f.progress >= 1) {
    resolveCatch(state);
  } else if (f.progress <= 0) {
    cancelFishing(state, "The fish got away!");
  }
}

function updateFishing(state, dt) {
  const f = state.fishing;
  const now = performance.now();

  if (Input.cancelPressed()) {
    cancelFishing(state, "You reel in your line.");
    Input.clickPos = null;
    return;
  }

  if (f.phase === "casting") {
    if (now - f.phaseStartedAt >= FISH_CAST_MS) {
      f.phase = "waiting";
      f.phaseStartedAt = now;
      f.biteAt = now + FISH_WAIT_MIN_MS + Math.random() * (FISH_WAIT_MAX_MS - FISH_WAIT_MIN_MS);
    }
  } else if (f.phase === "waiting") {
    if (now >= f.biteAt) startFishMinigame(state);
  } else if (f.phase === "minigame") {
    updateFishMinigame(state, dt);
  }

  // Any click while fishing is "part of" fishing (don't let it fall through
  // and swing a melee attack while the player is anchored fishing).
  Input.clickPos = null;
}
