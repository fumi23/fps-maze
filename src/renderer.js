// 依存ゼロの簡易3Dレンダラ。
// 「壁面(単位正方形)」を集めて、カメラ空間へ変換 → 近接クリップ → 透視投影 →
// 奥から手前へ塗る(画家のアルゴリズム)。テクスチャも光源もなし、面ごとの単色+フォグ。
//
// 可視軸は「右/上/前」が指すワールド3軸のみ。それ以外(4D以降のw軸)は視界に直交して
// 見えないので、そのw座標に一致するセルだけを描く(= 現在いる3Dスライス)。

import { sub, dot, add, scale, axisOf } from "./vec.js";

// --- 色パレット(レトロで落ち着いた寒色系) ---
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#0e1118");
const EDGE = hex("#0b0d13");

// 面の色は「世界軸ごとに色相・法線の符号で明暗」で決める(世界固定=プレイヤーの向きに依存しない)。
// axis 0=X(東西) 1=Y(上下) 2=Z(南北) 3=W(4D用)。neg=−方向の面 / pos=+方向の面。
// 全体はミュートな寒色系に馴染むよう低彩度。Yは従来のグレー(床=濃/天井=薄)を維持。
const AXIS_COLORS = [
  { neg: hex("#67655e"), pos: hex("#9b9991") }, // X: 気づく程度の暖色グレー(東西)
  { neg: hex("#262c38"), pos: hex("#8f9db4") }, // Y: 青灰(床=濃 / 天井=薄)
  { neg: hex("#616a63"), pos: hex("#949e97") }, // Z: 気づく程度の緑グレー(南北)
  { neg: hex("#656169"), pos: hex("#9a9aa2") }, // W: 気づく程度の紫グレー(4D用・将来)
];
const FALLBACK = { neg: hex("#454b57"), pos: hex("#8f9db4") };

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fov = (opts.fov ?? 75) * (Math.PI / 180);
    this.near = 0.02;
    this.maxDist = opts.maxDist ?? 22; // 描画距離
    this.fogStart = opts.fogStart ?? 4;
    this.fogEnd = opts.fogEnd ?? this.maxDist;
    this.dpr = 1;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.cx = this.W / 2;
    this.cy = this.H / 2;
    this.f = this.H / 2 / Math.tan(this.fov / 2); // 焦点距離(px)
  }

  // snapBasis: グリッド整列したスナップ済み基底 [右,上,前,...]。
  // 可視軸/スライスの判定はこちらから行う(回転アニメ中は camera.R/U/Fwd が軸に
  // 整列しておらず axisOf が破綻するため)。投影には補間済みの camera を使う。
  render(camera, maze, snapBasis) {
    const ctx = this.ctx;
    ctx.fillStyle = css(BG);
    ctx.fillRect(0, 0, this.W, this.H);

    const { pos, R, U, Fwd } = camera;

    // 可視3軸(右/上/前 が指すワールド軸)と、その中の「上軸」。スナップ基底から求める。
    const sb = snapBasis ?? [R, U, Fwd];
    const axR = axisOf(sb[0]), axU = axisOf(sb[1]), axF = axisOf(sb[2]);
    const visible = new Set([axR, axU, axF]);
    const rounded = pos.map(Math.round);

    // 壁面を集める(現在スライス内 & 描画距離内の空セルの、壁に接する面)
    const faces = [];
    this._collectFaces(maze, rounded, visible, pos, faces);

    // カメラ空間へ変換して深度計算
    const projected = [];
    for (const face of faces) {
      const cam = face.pts.map((p) => {
        const rel = sub(p, pos);
        return { x: dot(rel, R), y: dot(rel, U), z: dot(rel, Fwd) };
      });
      // 全点がカメラ後方 or 遠すぎるものは捨てる
      let zsum = 0, allBehind = true, minZ = Infinity;
      for (const c of cam) {
        zsum += c.z;
        if (c.z >= this.near) allBehind = false;
        if (c.z < minZ) minZ = c.z;
      }
      if (allBehind) continue;
      const depth = zsum / cam.length;
      if (depth > this.maxDist) continue;
      const clipped = this._clipNear(cam);
      if (clipped.length < 3) continue;
      projected.push({ cam: clipped, depth, color: face.color });
    }

    // 奥から手前へ
    projected.sort((a, b) => b.depth - a.depth);

    for (const p of projected) {
      const path = new Path2D();
      for (let i = 0; i < p.cam.length; i++) {
        const c = p.cam[i];
        const sx = (c.x / c.z) * this.f + this.cx;
        const sy = (-c.y / c.z) * this.f + this.cy;
        if (i === 0) path.moveTo(sx, sy);
        else path.lineTo(sx, sy);
      }
      path.closePath();
      // フォグ: 深いほど背景色へ寄せる
      const fog = clamp((p.depth - this.fogStart) / (this.fogEnd - this.fogStart), 0, 1);
      ctx.fillStyle = css(mix(p.color, BG, fog));
      ctx.fill(path);
      // うっすら輪郭(レトロな面の境界。ソートの継ぎ目も隠す)
      ctx.strokeStyle = css(mix(EDGE, BG, fog));
      ctx.lineWidth = 1 * this.dpr;
      ctx.stroke(path);
    }
  }

  _collectFaces(maze, center, visible, camPos, out) {
    const visAxes = [...visible];
    const size = maze.size;
    const rd = this.maxDist;

    // 可視3軸の範囲だけを走査(不可視軸はプレイヤー座標に固定 = 現在スライス)
    const lo = center.map((v, i) => (visible.has(i) ? Math.max(0, v - rd) : v));
    const hi = center.map((v, i) => (visible.has(i) ? Math.min(size[i] - 1, v + rd) : v));

    const c = center.slice();
    const recur = (k) => {
      if (k >= visAxes.length) {
        if (!maze.isEmpty(c)) return;
        // 距離カリング(可視空間内のユークリッド距離)
        let d2 = 0;
        for (const ax of visAxes) { const dx = c[ax] - camPos[ax]; d2 += dx * dx; }
        if (d2 > rd * rd) return;
        // この空セルの、壁に接する面を出す
        for (const ax of visAxes) {
          for (const sign of [-1, 1]) {
            const nb = c.slice();
            nb[ax] += sign;
            if (maze.isEmpty(nb)) continue; // 通路が続く→面なし
            out.push(this._makeFace(c, ax, sign, visAxes));
          }
        }
        return;
      }
      const ax = visAxes[k];
      for (let v = lo[ax]; v <= hi[ax]; v++) { c[ax] = v; recur(k + 1); }
    };
    recur(0);
  }

  // セル c の ax 方向(sign)側の境界面(単位正方形)を作る。
  _makeFace(c, ax, sign, visAxes) {
    const center = c.slice();
    center[ax] += 0.5 * sign;
    // 面が張る、ax以外の可視2軸
    const span = visAxes.filter((a) => a !== ax);
    const [u, v] = span;
    const corners = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ];
    const pts = corners.map(([du, dv]) => {
      const p = center.slice();
      p[u] += du;
      p[v] += dv;
      return p;
    });

    // 世界固定の配色: その面の世界軸(ax)で色相、法線の符号(sign)で明暗。
    const pal = AXIS_COLORS[ax] ?? FALLBACK;
    const color = sign > 0 ? pal.pos : pal.neg;

    return { pts, color };
  }

  // カメラ空間でニアプレーン(z>=near)に対しSutherland-Hodgmanクリップ
  _clipNear(poly) {
    const near = this.near;
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const cur = poly[i];
      const prev = poly[(i + n - 1) % n];
      const curIn = cur.z >= near;
      const prevIn = prev.z >= near;
      if (curIn) {
        if (!prevIn) out.push(intersectNear(prev, cur, near));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersectNear(prev, cur, near));
      }
    }
    return out;
  }
}

function intersectNear(a, b, near) {
  const t = (near - a.z) / (b.z - a.z);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
