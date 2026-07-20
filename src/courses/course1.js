// コース1: 静的な1層3D迷路。
// 2Dグリッド(course1.data.js)を y=1 の1層に配置し、上下(y=0/2)を床・天井の壁で塞ぐ。
// これで「実質2Dだが本物の3Dエンジンで動く」= look/feel を詰めるための最初のコース。

import { Maze } from "../maze.js";
import { grid } from "./course1.data.js";

export function loadCourse1() {
  const D = grid.length; // Z 方向のセル数
  const W = grid[0].length; // X 方向のセル数
  const size = [W, 3, D]; // [X, Y(3層), Z]

  let start = null;
  let goal = null;
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const ch = grid[z][x];
      if (ch === "S") start = [x, 1, z];
      if (ch === "G") goal = [x, 1, z];
    }
  }

  const solid = ([x, y, z]) => {
    if (y !== 1) return true; // 床(y=0)と天井(y=2)は常に壁
    return grid[z][x] === "#";
  };

  // 開始時の前方(S地点で開いている +X 方向を向く)
  return new Maze({ dims: 3, size, solid, start, goal, forward: { axis: 0, sign: 1 } });
}
