// ゲーム全体の組み立て: 入力 → プレイヤー更新 → 描画 → HUD。
// 移動/回転は離散。プレイヤーが非アニメ中のときだけ、押下キーを見て次の一手を出す
// (= キー押しっぱなしで連続移動できる)。

import { Player } from "./player.js";
import { Renderer } from "./renderer.js";
import { Input } from "./input.js";
import { drawMinimap } from "./minimap.js";
import { sub, unit } from "./vec.js";
import { faceDir, dirLabel, UP, FWD } from "./orientation.js";

// ミニマップは常時表示せず「M で一時的に覗く」方式。地図を追いながら歩く状態を避ける。
const MINIMAP_PEEK = 3.5; // 表示してから消えるまでの秒数
const MINIMAP_FADE_IN = 0.15;
const MINIMAP_FADE_OUT = 0.6;

// キーバインド表。統一スキーム:
//   単体キー = 旋回 / Shift = ストレイフ(前以外への並進) / 前後は単体で並進。
// shift: true=Shift必須, false=Shift禁止, null=どちらでも。
// need: モード記述子のどの機能を要求するか。無効なコースではそのバインドが消えるだけ。
// 先に一致した1手だけを実行する(優先順位 = 前後 > ストレイフ > 旋回)。
const BINDINGS = [
  { keys: ["w"], shift: null, need: ["translations", "fwd"], act: (p) => p.stepForward() },
  { keys: ["s"], shift: null, need: ["translations", "fwd"], act: (p) => p.stepBack() },
  { keys: ["a"], shift: true, need: ["translations", "strafe"], act: (p) => p.strafeLeft() },
  { keys: ["d"], shift: true, need: ["translations", "strafe"], act: (p) => p.strafeRight() },
  { keys: ["r"], shift: true, need: ["translations", "up"], act: (p) => p.stepUp() },
  { keys: ["f"], shift: true, need: ["translations", "up"], act: (p) => p.stepDown() },
  { keys: ["a", "arrowleft"], shift: false, need: ["rotations", "yaw"], act: (p) => p.yawLeft() },
  { keys: ["d", "arrowright"], shift: false, need: ["rotations", "yaw"], act: (p) => p.yawRight() },
  { keys: ["r", "arrowup"], shift: false, need: ["rotations", "pitch"], act: (p) => p.pitchUp() },
  { keys: ["f", "arrowdown"], shift: false, need: ["rotations", "pitch"], act: (p) => p.pitchDown() },
  { keys: [","], shift: null, need: ["rotations", "roll"], act: (p) => p.rollLeft() },
  { keys: ["."], shift: null, need: ["rotations", "roll"], act: (p) => p.rollRight() },
];

// コース側が mode を持たないときの既定(2D相当: ヨーと水平移動のみ)
const DEFAULT_MODE = { rotations: ["yaw"], translations: ["fwd", "strafe"] };

export class Game {
  constructor({ canvas, course, hud }) {
    this.canvas = canvas;
    this.maze = course.maze;
    this.mode = course.mode ?? DEFAULT_MODE;
    this.hud = hud;
    this.renderer = new Renderer(canvas, { fov: 85 });
    this.player = new Player(this.maze, { eyeHeight: 0 });
    this.input = new Input(window);
    this.minimapPeek = 0; // ミニマップの残り表示秒(0 = 非表示)
    this.minimapPinned = false; // デバッグ: 常時表示(game.debug.minimap)
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

    // fromCell から toCell を向く基底を作る(差が最大の軸を前方に取る)
    const faceTo = (fromCell, toCell) => {
      const d = sub(toCell, fromCell);
      let ax = -1;
      let best = 0;
      for (let i = 0; i < d.length; i++) {
        if (Math.abs(d[i]) > best) {
          best = Math.abs(d[i]);
          ax = i;
        }
      }
      if (ax < 0) return g.player.basis;
      return faceDir(g.player.basis, unit(d.length, ax, Math.sign(d[ax])));
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
        for (let ax = 0; ax < g.maze.dims; ax++) {
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
      // ミニマップを常時表示/解除(通常は M の一時表示のみ)。
      minimap(on = true) {
        g.minimapPinned = !!on;
        console.log("[debug] minimap pinned =", g.minimapPinned);
        return g.minimapPinned;
      },
    };
  }

  handleInput() {
    const inp = this.input;

    // 単発トグル系(R はピッチに使うので、リスタートは Enter)
    if (inp.wasPressed("m")) this.minimapPeek = MINIMAP_PEEK; // 一時表示(再押下で延長)
    if (inp.wasPressed("enter")) this.restart();

    if (this.player.busy) return; // アニメ中は次の入力を受けない(離散)
    if (this.player.won) return;

    const shift = inp.isDown("shift");
    for (const b of BINDINGS) {
      if (b.shift !== null && b.shift !== shift) continue;
      if (!this.mode[b.need[0]].includes(b.need[1])) continue;
      if (!inp.isDown(...b.keys)) continue;
      b.act(this.player);
      break;
    }
  }

  tick(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // タブ復帰などの大ジャンプを抑制

    this.handleInput();
    this.player.update(dt);

    const cam = this.player.getCamera();
    this.renderer.render(cam, this.maze, this.player.basis);

    // ミニマップ: 常時表示(デバッグ)なら alpha=1、それ以外は M の一時表示をフェード。
    let mmAlpha = 0;
    if (this.minimapPinned) {
      mmAlpha = 1;
    } else if (this.minimapPeek > 0) {
      this.minimapPeek = Math.max(0, this.minimapPeek - dt);
      const t = this.minimapPeek;
      const elapsed = MINIMAP_PEEK - t;
      mmAlpha = Math.min(1, elapsed / MINIMAP_FADE_IN, t / MINIMAP_FADE_OUT);
    }
    if (mmAlpha > 0) {
      const ctx = this.renderer.ctx;
      ctx.save();
      ctx.globalAlpha = mmAlpha;
      drawMinimap(ctx, this.maze, cam, this.player.basis, {
        cell: 11 * this.renderer.dpr,
        pad: 12 * this.renderer.dpr,
        anchor: "bottom-right",
      });
      ctx.restore();
    }

    this.updateHud();
    this.input.endFrame();
    requestAnimationFrame(this.tick);
  }

  updateHud() {
    if (!this.hud) return;
    const p = this.player.pos;
    this.hud.win.style.display = this.player.won ? "flex" : "none";
    // 姿勢インジケータ相当: 3Dでは前だけでは姿勢が決まらないので上も出す。
    // 回転アニメ中の cam.Fwd は軸に整列していないので、スナップ済み基底を使う。
    const b = this.player.basis;
    this.hud.pos.textContent = `pos (${p.join(", ")})  facing ${dirLabel(b[FWD])}  up ${dirLabel(b[UP])}`;
    if (this.hud.goal) this.hud.goal.textContent = `goal (${this.maze.goal.join(", ")})`;
  }
}
