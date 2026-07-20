// N次元グリッド迷路のデータモデル。
// セルは「空(通路)」か「壁(solid)」のどちらか。境界の外は常に壁扱い。
// 迷路の中身は solid(coords) コールバックに委譲するので、
// 静的マップでも、将来の自動生成でも、同じ Maze で扱える。

import { eq } from "./vec.js";

export class Maze {
  /**
   * @param {object} o
   * @param {number} o.dims  次元数 N
   * @param {number[]} o.size 各軸のセル数
   * @param {(coords:number[])=>boolean} o.solid 壁判定(境界内のみ呼ばれる)
   * @param {number[]} o.start 開始セル
   * @param {number[]} o.goal  ゴールセル
   * @param {{axis:number,sign:number}} [o.forward] 開始時の前方(未使用時は +axis2)
   */
  constructor({ dims, size, solid, start, goal, forward }) {
    this.dims = dims;
    this.size = size;
    this._solid = solid;
    this.start = start;
    this.goal = goal;
    this.forward = forward ?? { axis: 2, sign: 1 };
  }

  inBounds(c) {
    for (let i = 0; i < c.length; i++) {
      if (c[i] < 0 || c[i] >= this.size[i]) return false;
    }
    return true;
  }

  isSolid(c) {
    if (!this.inBounds(c)) return true; // 場外は壁
    return this._solid(c);
  }

  isEmpty(c) {
    return !this.isSolid(c);
  }

  isGoal(c) {
    return eq(c, this.goal);
  }
}
