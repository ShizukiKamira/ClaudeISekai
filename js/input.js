// ---------------------------------------------------------------------------
// Keyboard input handling
// ---------------------------------------------------------------------------

const Input = {
  down: new Set(),
  pressed: new Set(), // keys pressed this frame (edge-triggered, cleared after read)
  heldSince: new Map(), // code -> timestamp the key was first pressed down
  clickPos: null, // {x, y} in canvas pixel space for a click this frame, cleared after the frame
  wheelDelta: 0, // accumulated mouse-wheel deltaY this frame, cleared after the frame
  rightClickPos: null, // {x, y} for a right-click (context menu) this frame, cleared after the frame
  mouseDownPos: null, // {x, y} set on left-mouse-down this frame, cleared after the frame
  mouseUpPos: null, // {x, y} set on left-mouse-up this frame, cleared after the frame
  mouseIsDown: false, // true continuously while the left mouse button is held (for drag rendering)
  mousePos: { x: 400, y: 300 }, // continuously-updated cursor position, never cleared

  init() {
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (!this.down.has(e.code)) {
        this.pressed.add(e.code);
        this.heldSince.set(e.code, performance.now());
      }
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      this.heldSince.delete(e.code);
    });
  },

  isDown(code) {
    return this.down.has(code);
  },

  wasPressed(code) {
    return this.pressed.has(code);
  },

  endFrame() {
    this.pressed.clear();
    this.clickPos = null;
    this.wheelDelta = 0;
    this.rightClickPos = null;
    this.mouseUpPos = null;
    // mouseDownPos is intentionally NOT cleared here - a drag can span many
    // frames between mousedown and mouseup, so it persists until whoever
    // pairs it with a mouseUpPos (e.g. chest.js's drag handling) clears it.
  },

  // Combines every held WASD/arrow key into one normalized vector, so
  // opposite-corner keys (e.g. W+D) produce diagonal movement rather than
  // only ever the 4 cardinal directions.
  moveVector() {
    let x = 0, y = 0;
    if (this.isDown("ArrowUp") || this.isDown("KeyW")) y -= 1;
    if (this.isDown("ArrowDown") || this.isDown("KeyS")) y += 1;
    if (this.isDown("ArrowLeft") || this.isDown("KeyA")) x -= 1;
    if (this.isDown("ArrowRight") || this.isDown("KeyD")) x += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  },

  confirmPressed() {
    return this.wasPressed("Enter") || this.wasPressed("Space") || this.wasPressed("KeyZ");
  },

  confirmDown() {
    return this.isDown("Enter") || this.isDown("Space") || this.isDown("KeyZ");
  },

  confirmHeldMs() {
    const codes = ["Enter", "Space", "KeyZ"];
    let maxMs = 0;
    for (const c of codes) {
      if (this.heldSince.has(c)) {
        maxMs = Math.max(maxMs, performance.now() - this.heldSince.get(c));
      }
    }
    return maxMs;
  },

  cancelPressed() {
    return this.wasPressed("Escape") || this.wasPressed("KeyX");
  },

  menuPressed() {
    return this.wasPressed("KeyI") || this.wasPressed("Tab");
  },
};
