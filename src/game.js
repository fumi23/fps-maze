// ゲーム全体の組み立て: 入力 → プレイヤー更新 → 描画 → HUD。
// 移動/回転は離散。プレイヤーが非アニメ中のときだけ、押下キーを見て次の一手を出す
// (= キー押しっぱなしで連続移動できる)。

import { Player } from "./player.js";
import { Renderer } from "./renderer.js";
import { Input } from "./input.js";
import { drawMinimap } from "./minimap.js";
import { eq } from "./vec.js";

export class Game {
  constructor({ canvas, maze, hud }) {
    this.canvas = canvas;
    this.maze = maze;
    this.hud = hud;
    this.renderer = new Renderer(canvas, { fov: 75 });
    this.player = new Player(maze, { eyeHeight: 0 });
    this.input = new Input(window);
    this.showMinimap = true;

    window.addEventListener("resize", () => this.renderer.resize());

    this.last = performance.now();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  restart() {
    this.player = new Player(this.maze, { eyeHeight: 0 });
    this.showWin = false;
  }

  handleInput() {
    const inp = this.input;

    // 単発トグル系
    if (inp.wasPressed("m")) this.showMinimap = !this.showMinimap;
    if (inp.wasPressed("r")) this.restart();

    if (this.player.busy) return; // アニメ中は次の入力を受けない(離散)
    if (this.player.won) return;

    // 押下優先順位: 前後 > ストレイフ > 旋回。最初に一致した1手だけ実行。
    if (inp.isDown("w")) this.player.stepForward();
    else if (inp.isDown("s")) this.player.stepBack();
    else if (inp.isDown("a")) this.player.strafeLeft();
    else if (inp.isDown("d")) this.player.strafeRight();
    else if (inp.isDown("q", "arrowleft")) this.player.turnLeft();
    else if (inp.isDown("e", "arrowright")) this.player.turnRight();
  }

  tick(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // タブ復帰などの大ジャンプを抑制

    this.handleInput();
    this.player.update(dt);

    const cam = this.player.getCamera();
    this.renderer.render(cam, this.maze);

    if (this.showMinimap) {
      drawMinimap(this.renderer.ctx, this.maze, cam, this.player.basis, {
        cell: 8 * this.renderer.dpr,
        pad: 12 * this.renderer.dpr,
      });
    }

    this.updateHud(cam);
    this.input.endFrame();
    requestAnimationFrame(this.tick);
  }

  updateHud(cam) {
    if (!this.hud) return;
    const p = this.player.pos;
    this.hud.win.style.display = this.player.won ? "flex" : "none";
    const facing = faceName(cam.Fwd);
    this.hud.pos.textContent = `pos (${p.join(", ")})  facing ${facing}`;
  }
}

// 前方向ベクトル → 人間向けラベル(グリッド整列時)
function faceName(fwd) {
  const names = ["+X", "+Y", "+Z"];
  for (let i = 0; i < fwd.length; i++) {
    if (Math.round(fwd[i]) === 1) return names[i] ?? `+a${i}`;
    if (Math.round(fwd[i]) === -1) return "-" + (names[i]?.slice(1) ?? `a${i}`);
  }
  return "?";
}
