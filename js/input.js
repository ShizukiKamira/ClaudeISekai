// ---------------------------------------------------------------------------
// Keyboard input handling
// ---------------------------------------------------------------------------

const Input = {
  down: new Set(),
  pressed: new Set(), // keys pressed this frame (edge-triggered, cleared after read)

  init() {
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
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
  },

  moveDirection() {
    if (this.isDown("ArrowUp") || this.isDown("KeyW")) return { x: 0, y: -1, dir: "up" };
    if (this.isDown("ArrowDown") || this.isDown("KeyS")) return { x: 0, y: 1, dir: "down" };
    if (this.isDown("ArrowLeft") || this.isDown("KeyA")) return { x: -1, y: 0, dir: "left" };
    if (this.isDown("ArrowRight") || this.isDown("KeyD")) return { x: 1, y: 0, dir: "right" };
    return null;
  },

  confirmPressed() {
    return this.wasPressed("Enter") || this.wasPressed("Space") || this.wasPressed("KeyZ");
  },

  cancelPressed() {
    return this.wasPressed("Escape") || this.wasPressed("KeyX");
  },

  menuPressed() {
    return this.wasPressed("KeyI") || this.wasPressed("Tab");
  },
};
