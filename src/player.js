// プレイヤーの状態と、移動/回転の離散アニメーション。
//
// 状態は「セル位置(整数ベクトル)」と「向き(スナップ済み基底)」。
// 入力で移動・回転が入ると anim を開始し、update() で t を進めて、
// 完了時に pos / basis を確定スナップする。
// getCamera() はレンダラ用に、アニメ補間後のカメラ位置と可視3軸を返す。

import { add, scale, lerp, clone, axisOf } from "./vec.js";
import { identityBasis, rotated, partialRotate, RIGHT, UP, FWD } from "./orientation.js";

// なめらかな加減速(0..1)
const smooth = (t) => t * t * (3 - 2 * t);

// 開始向きを決める。maze.forward を優先しつつ、その先が壁なら
// 開いている水平方向へヨーして「壁に密着した状態で始まる」のを避ける。
function initialBasis(maze, pos) {
  let basis = identityBasis(maze.dims);
  // maze.forward で指定された軸/符号に前方を合わせる(ヨーで最大3回)
  const want = maze.forward;
  for (let i = 0; i < 4; i++) {
    const f = basis[FWD];
    if (axisOf(f) === want.axis && f[want.axis] === want.sign) break;
    basis = rotated(basis, FWD, RIGHT); // 右回りヨー
  }
  // 前が壁なら、開いている方向が見つかるまでヨー
  for (let i = 0; i < 4; i++) {
    const ahead = add(pos, basis[FWD].map(Math.round));
    if (maze.isEmpty(ahead)) break;
    basis = rotated(basis, FWD, RIGHT);
  }
  return basis;
}

export class Player {
  constructor(maze, opts = {}) {
    this.maze = maze;
    this.pos = clone(maze.start);
    this.basis = initialBasis(maze, this.pos);

    this.moveDur = opts.moveDur ?? 0.16; // 1マス移動の所要秒(サクサク寄り)
    this.turnDur = opts.turnDur ?? 0.3; // 90度回転の所要秒(気持ちゆっくり)
    this.eyeHeight = opts.eyeHeight ?? 0; // 上方向スロットへのオフセット(セル中心=0)

    this.anim = null; // { type, t(0..1), ... }
    this.won = maze.isGoal(this.pos);
  }

  get busy() {
    return this.anim !== null;
  }

  // slot 方向へ sign(±1)だけ1マス移動を試みる。壁なら false。
  tryStep(slot, sign) {
    if (this.busy) return false;
    const dir = scale(this.basis[slot], sign).map(Math.round);
    const target = add(this.pos, dir);
    if (!this.maze.isEmpty(target)) return false;
    this.anim = { type: "move", t: 0, dur: this.moveDur, from: clone(this.pos), to: target };
    return true;
  }

  stepForward() { return this.tryStep(FWD, 1); }
  stepBack() { return this.tryStep(FWD, -1); }
  strafeLeft() { return this.tryStep(RIGHT, -1); }
  strafeRight() { return this.tryStep(RIGHT, 1); }

  // dir: +1=右回り, -1=左回り(ヨー)。カメラの (前,右) 平面で回す。
  turn(dir) {
    if (this.busy) return false;
    const [a, b] = dir > 0 ? [FWD, RIGHT] : [RIGHT, FWD];
    this.anim = { type: "turn", t: 0, dur: this.turnDur, a, b, target: rotated(this.basis, a, b) };
    return true;
  }
  turnLeft() { return this.turn(-1); }
  turnRight() { return this.turn(1); }

  update(dt) {
    if (!this.anim) return;
    this.anim.t += dt / this.anim.dur;
    if (this.anim.t >= 1) {
      if (this.anim.type === "move") {
        this.pos = clone(this.anim.to);
        if (this.maze.isGoal(this.pos)) this.won = true;
      } else {
        this.basis = this.anim.target;
      }
      this.anim = null;
    }
  }

  // レンダラ用カメラ。pos は float、R/U/Fwd はワールド方向(単位)。
  getCamera() {
    let pos = this.pos.map((v) => v);
    let b = this.basis;

    if (this.anim && this.anim.type === "move") {
      pos = lerp(this.anim.from, this.anim.to, smooth(this.anim.t));
    } else if (this.anim && this.anim.type === "turn") {
      const theta = smooth(this.anim.t) * (Math.PI / 2);
      b = partialRotate(this.basis, this.anim.a, this.anim.b, theta);
    }

    // 目の高さ(上方向スロットにオフセット)
    if (this.eyeHeight) pos = add(pos, scale(b[UP], this.eyeHeight));

    return { pos, R: b[RIGHT], U: b[UP], Fwd: b[FWD] };
  }
}
