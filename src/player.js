// プレイヤーの状態と、移動/回転の離散アニメーション。
//
// 状態は「セル位置(整数ベクトル)」と「向き(スナップ済み基底)」。
// 入力で移動・回転が入ると anim を開始し、update() で t を進めて、
// 完了時に pos / basis を確定スナップする。
// getCamera() はレンダラ用に、アニメ補間後のカメラ位置と可視3軸を返す。

import { add, scale, neg, lerp, clone, unit } from "./vec.js";
import { identityBasis, rotated, partialRotate, faceDir, RIGHT, UP, FWD } from "./orientation.js";

// なめらかな加減速(0..1)
const smooth = (t) => t * t * (3 - 2 * t);

// 開始向きを決める。maze.forward を優先しつつ、その先が壁なら
// 開いている方向へ向き直して「壁に密着した状態で始まる」のを避ける。
// 3Dでは開いているのが上下だけのこともあるので、水平4方向 → 上下 の順に探す。
function initialBasis(maze, pos) {
  const basis = faceDir(identityBasis(maze.dims), unit(maze.dims, maze.forward.axis, maze.forward.sign));
  const candidates = [
    basis[FWD],
    basis[RIGHT],
    neg(basis[FWD]),
    neg(basis[RIGHT]),
    basis[UP],
    neg(basis[UP]),
  ];
  for (const d of candidates) {
    const dir = d.map(Math.round);
    if (maze.isEmpty(add(pos, dir))) return faceDir(basis, dir);
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
  stepUp() { return this.tryStep(UP, 1); }
  stepDown() { return this.tryStep(UP, -1); }

  // スロット a,b が張る平面で90度回転する。回転後は「slot a が旧 slot b を向く」。
  // 面が増えても(4Dのフリップなど)この1本で足りる。
  rotate(a, b) {
    if (this.busy) return false;
    this.anim = { type: "turn", t: 0, dur: this.turnDur, a, b, target: rotated(this.basis, a, b) };
    return true;
  }

  // ヨー(前/右): 前を左右へ振る。up は保存される。
  yawRight() { return this.rotate(FWD, RIGHT); }
  yawLeft() { return this.rotate(RIGHT, FWD); }
  // ピッチ(前/上): 前を上下へ向ける。
  pitchUp() { return this.rotate(FWD, UP); }
  pitchDown() { return this.rotate(UP, FWD); }
  // ロール(上/右): 前は変えず、画面内で傾く(方向感覚の調整用)。
  rollRight() { return this.rotate(UP, RIGHT); }
  rollLeft() { return this.rotate(RIGHT, UP); }

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
