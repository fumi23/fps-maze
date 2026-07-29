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

// 符号付き単位ベクトル dir を「前(FWD)」に向けた基底を返す。
// ピッチ(前/上)→ ヨー(前/右)の組み合わせを総当たりする。3Dなら6方向すべてに届く。
// 見つからなければ元の基底をそのまま返す。
export function faceDir(basis, dir) {
  let pitched = basis;
  for (let p = 0; p < 4; p++) {
    let b = pitched;
    for (let y = 0; y < 4; y++) {
      if (sameDir(b[FWD], dir)) return b;
      b = rotated(b, FWD, RIGHT);
    }
    pitched = rotated(pitched, FWD, UP);
  }
  return basis;
}

// グリッド整列した(=成分が 0/±1 の)ベクトル同士の一致判定
const sameDir = (a, b) => a.every((v, i) => Math.round(v) === Math.round(b[i]));

// 世界軸の表示名。4D の W まで用意(それ以上は a4, a5, ...)。
export const axisLabel = (ax) => ["X", "Y", "Z", "W"][ax] ?? `a${ax}`;

// 符号付き単位ベクトル → "+X" / "-Z" のような人間向けラベル(グリッド整列時)
export function dirLabel(v) {
  for (let i = 0; i < v.length; i++) {
    const s = Math.round(v[i]);
    if (s !== 0) return (s > 0 ? "+" : "-") + axisLabel(i);
  }
  return "?";
}
