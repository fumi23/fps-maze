// 向き(orientation)= カメラ基底。
// スロット順は [0:右, 1:上, 2:前, 3:第4軸(w), 4:...] で、
// 各スロットに「そのカメラ方向がワールドのどちらを向くか」を符号付き単位ベクトルで持つ。
//
// レンダラが見るのは 右/上/前 の3スロットだけ。4スロット目以降は
// 「視界全体に直交していて見えない軸」= 4D以降の奥行きになる。
//
// 90度回転は「2つのスロットが張る平面内の回転」= スロットの入れ替え+符号反転で表現する。

import { clone, scale } from "./vec.js";

// 単位向き: 右=+axis0, 上=+axis1, 前=+axis2, 以降 axis3,4,... に素直に対応。
export function identityBasis(n) {
  const basis = [];
  for (let i = 0; i < n; i++) {
    const v = new Array(n).fill(0);
    v[i] = 1;
    basis.push(v);
  }
  return basis;
}

// スロット a,b が張る平面で90度回した新しい基底を返す(非破壊)。
// 回転後: slot a = 旧 slot b, slot b = -(旧 slot a)。
export function rotated(basis, a, b) {
  const nb = basis.map(clone);
  const oldA = nb[a];
  nb[a] = nb[b];
  nb[b] = scale(oldA, -1);
  return nb;
}

// アニメ用: スロット a,b の平面で角度 theta(ラジアン)だけ回した基底を返す。
// theta = π/2 のとき rotated(basis, a, b) と一致する。
export function partialRotate(basis, a, b, theta) {
  const A = basis[a];
  const B = basis[b];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const out = basis.map(clone);
  out[a] = A.map((v, i) => c * v + s * B[i]);
  out[b] = B.map((v, i) => c * v - s * A[i]);
  return out;
}

// カメラスロット定数
export const RIGHT = 0;
export const UP = 1;
export const FWD = 2;
