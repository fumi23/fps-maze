// ゲーム全体の組み立て: 入力 → プレイヤー更新 → 描画 → HUD。
// 移動/回転は離散。プレイヤーが非アニメ中のときだけ、押下キーを見て次の一手を出す
// (= キー押しっぱなしで連続移動できる)。

import { Player } from "./player.js";
import { Renderer } from "./renderer.js";
import { Input } from "./input.js";
import { drawMinimap } from "./minimap.js";
import { sub, axisOf } from "./vec.js";
import { rotated, FWD, RIGHT } from "./orientation.js";

export class Game {
  constructor({ canvas, maze, hud }) {
    this.canvas = canvas;
    this.maze = maze;
    this.hud = hud;
    this.renderer = new Renderer(canvas, { fov: 75 });
    this.player = new Player(maze, { eyeHeight: 0 });
    this.input = new Input(window);
    this.showMinimap = true;
    this.debug = this._makeDebug();

    window.addEventListener("resize", () => this.renderer.resize());

    this.last = performance.now();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  restart() {
    this.player = new Player(this.maze, { eyeHeight: 0 });
  }

  // コンソール用デバッグAPI(window.game.debug)。
  _makeDebug() {
    const g = this;

    // fromCell から toCell(水平方向の隣)を向く基底を作る
    const faceTo = (fromCell, toCell) => {
      const dir = sub(toCell, fromCell).map(Math.sign);
      const ax = axisOf(dir);
      if (ax < 0) return g.player.basis;
      let basis = g.player.basis.map((v) => v.slice());
      for (let i = 0; i < 4; i++) {
        const f = basis[FWD];
        if (axisOf(f) === ax && f[ax] === dir[ax]) break;
        basis = rotated(basis, FWD, RIGHT); // 右回りヨー
      }
      return basis;
    };

    return {
      // 任意セルへ瞬間移動(壁なら拒否)。faceCell 指定でそちらを向く。
      teleport(cell, faceCell) {
        if (!g.maze.isEmpty(cell)) {
          console.warn("[debug] 壁のセルには置けません:", cell);
          return g.player.pos.slice();
        }
        g.player.anim = null;
        g.player.pos = cell.slice();
        g.player.won = g.maze.isGoal(cell);
        if (faceCell) g.player.basis = faceTo(cell, faceCell);
        console.log("[debug] pos =", g.player.pos.slice());
        return g.player.pos.slice();
      },
      toStart() {
        return this.teleport(g.maze.start.slice());
      },
      toGoal() {
        return this.teleport(g.maze.goal.slice());
      },
      // ゴールの隣(空きセル)へ置き、ゴールを向く。W一歩でクリアできる状態。
      nearGoal() {
        const goal = g.maze.goal;
        const upAx = axisOf(g.player.basis[1]); // 上軸は水平隣の探索から除外
        for (let ax = 0; ax < g.maze.dims; ax++) {
          if (ax === upAx) continue;
          for (const s of [1, -1]) {
            const n = goal.slice();
            n[ax] += s;
            if (g.maze.isEmpty(n)) return this.teleport(n, goal);
          }
        }
        console.warn("[debug] ゴール隣接の空きセルが見つかりません");
        return g.player.pos.slice();
      },
      pos() {
        return g.player.pos.slice();
      },
      goal() {
        return g.maze.goal.slice();
      },
    };
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
