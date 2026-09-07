// ---------------------------------------------------------------------------
// Fishing: cast a line at a facing water tile with a Fishing Rod, wait for a
// bite (a red "!" over a sinking bobber), then click or press F within the
// reaction window to land the catch. Missing the window loses the fish.
// ---------------------------------------------------------------------------

function startFishing(state, x, y) {
  const now = performance.now();
  state.fishing = {
    active: true,
    phase: "casting", // casting -> waiting -> bite
    targetX: x,
    targetY: y,
    phaseStartedAt: now,
    biteAt: 0,
    biteExpiresAt: 0,
  };
  Input.clickPos = null;
}

function cancelFishing(state, message) {
  state.fishing.active = false;
  if (message) {
    state.worldFlashMessage = message;
    state.worldFlashUntil = performance.now() + 1500;
  }
}

function resolveCatch(state) {
  const fishId = rollFishCatch();
  addItem(state, fishId, 1);
  state.fishing.active = false;
  Dialogue.show([`You caught a ${ITEMS[fishId].name}!`]);
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
    if (now >= f.biteAt) {
      f.phase = "bite";
      f.biteExpiresAt = now + FISH_BITE_WINDOW_MS;
    }
  } else if (f.phase === "bite") {
    if (Input.clickPos || Input.wasPressed("KeyF")) {
      resolveCatch(state);
      Input.clickPos = null;
      return;
    }
    if (now >= f.biteExpiresAt) {
      cancelFishing(state, "The fish got away!");
    }
  }

  // Any click during casting/waiting is "part of" fishing (don't let it fall
  // through and swing a melee attack while the player is anchored fishing).
  Input.clickPos = null;
}
