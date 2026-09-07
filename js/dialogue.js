// ---------------------------------------------------------------------------
// Textbox / dialogue overlay system
// ---------------------------------------------------------------------------

const Dialogue = {
  lines: [],
  index: 0,
  active: false,
  onComplete: null,
  speaker: null,

  show(lines, { onComplete = null, speaker = null } = {}) {
    this.lines = lines;
    this.index = 0;
    this.active = true;
    this.onComplete = onComplete;
    this.speaker = speaker;
  },

  advance() {
    if (!this.active) return;
    this.index++;
    if (this.index >= this.lines.length) {
      this.active = false;
      const cb = this.onComplete;
      this.onComplete = null;
      if (cb) cb();
    }
  },

  update() {
    if (!this.active) return;
    if (Input.confirmPressed()) this.advance();
  },

  render(ctx, canvasW, canvasH) {
    if (!this.active) return;
    const boxH = 130;
    const pad = 20;
    const boxY = canvasH - boxH - 16;

    ctx.fillStyle = "rgba(10, 14, 12, 0.88)";
    ctx.fillRect(16, boxY, canvasW - 32, boxH);
    ctx.strokeStyle = "#e8c97a";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, boxY, canvasW - 32, boxH);
    drawPixelFrameCorners(ctx, 16, boxY, canvasW - 32, boxH, 14, "#e8c97a");

    if (this.speaker) {
      ctx.fillStyle = "#e8c97a";
      ctx.font = "bold 16px 'Segoe UI', sans-serif";
      ctx.fillText(this.speaker, 32, boxY + 24);
    }

    ctx.fillStyle = "#f2f2ec";
    ctx.font = "16px 'Segoe UI', sans-serif";
    const text = this.lines[this.index] || "";
    wrapText(ctx, text, 32, this.speaker ? boxY + 52 : boxY + 34, canvasW - 64, 22);

    ctx.fillStyle = "#bdbdb0";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("Enter / Space to continue", canvasW - 200, boxY + boxH - 14);
  },
};

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      ctx.fillText(line, x, curY);
      line = word + " ";
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, curY);
}
