// コース1: 多層の3D迷路(浮遊モード)。
// 上下も本物の迷路軸なので、前後左右だけでは踏破できない。ピッチ/ロールも解禁して
// 「姿勢を操作しながら進む」操作系のベースにする(重力固定はこの部分集合として後から足せる)。
//
// データは tools/gen-maze.mjs が吐いた N次元グリッド。読み方は course1.data.js 冒頭のコメント参照。

import { Maze } from "../maze.js";
import { dims, size, start, goal, rows } from "./course1.data.js";

// セル座標 → rows の行インデックス(axis1 を最上位、以降 axis2, axis3... の順)
function rowIndex(c) {
  let i = 0;
  for (let ax = 1; ax < dims; ax++) i = i * size[ax] + c[ax];
  return i;
}

export function loadCourse1() {
  const solid = (c) => rows[rowIndex(c)][c[0]] === "#";

  const maze = new Maze({
    dims,
    size,
    solid,
    start,
    goal,
    forward: { axis: 0, sign: 1 }, // 開始時は +X を向く(壁なら player 側が開いた方向へ向き直す)
  });

  return {
    maze,
    // モード記述子: どの回転面/並進方向を入力層で有効にするか。
    // 面や軸が増えてもエンジンは分岐せず、ここの記述だけが変わる。
    mode: {
      rotations: ["yaw", "pitch", "roll"],
      translations: ["fwd", "strafe", "up"],
    },
  };
}
