// N次元ベクトルのユーティリティ。ベクトルは素の number[] として扱う。
// 次元数(N)に依存しない実装にすることで、2D/3D/4D を同じコードで動かす。

export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, s) => a.map((v) => v * s);
export const neg = (a) => a.map((v) => -v);
export const dot = (a, b) => a.reduce((acc, v, i) => acc + v * b[i], 0);
export const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const clone = (a) => a.slice();
export const zeros = (n) => new Array(n).fill(0);
export const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// n次元の符号付き単位ベクトル(axis番目だけ ±1)
export function unit(n, axis, sign = 1) {
  const v = zeros(n);
  v[axis] = sign;
  return v;
}

// 符号付き単位ベクトルから「どの軸か」を返す(グリッド整列時のみ有効)
export function axisOf(v) {
  for (let i = 0; i < v.length; i++) if (v[i] !== 0) return i;
  return -1;
}
