// 現在いるスライスを「プレイヤーの上方向から見下ろした」小さな地図。探索の補助。
//
// スライス面 = カメラの 右/前 が張る平面。見るのは up 方向から見下ろす向き。
// 90度回転しかしないので up は常にぴったり ±(世界軸)を向き、「+/- どちら側から
// 見下ろすか」が一意に決まる(45度のような「どの軸が一番上か曖昧」が起きない)。
// 重力固定コース(ピッチ/ロールを割り当てない)では up = 世界up に固定されるので、
// この実装がそのまま普通のフロアプランになる。
//
// 転置対策: 地図の2軸は「軸インデックス昇順」で世界に固定する(向きで割り当てを
//           入れ替えない)。プレイヤーのアイコンだけが回る。
// 鏡像対策: 画面上に置く軸の符号を up の符号から決め、俯瞰の手性に揃える。
//           レンダラの投影は 右×上 = 前(左辺は通常の外積)なので、
//           視線方向 = -up に対して 画面右×画面上 = -up となる符号を選ぶ。

import { axisOf } from "./vec.js";
import { RIGHT, UP, FWD, axisLabel } from "./orientation.js";

// snapBasis: 回転アニメの影響を受けないスナップ済み基底。
export function drawMinimap(ctx, maze, camera, snapBasis, opts = {}) {
  const cell = opts.cell ?? 9;
  const pad = opts.pad ?? 10;

  const axR = axisOf(snapBasis[RIGHT]);
  const axU = axisOf(snapBasis[UP]);
  const axF = axisOf(snapBasis[FWD]);
  const su = Math.sign(Math.round(snapBasis[UP][axU])); // up がその軸の +/- どちらを向くか

  // 地図の2軸(スライス面): 可視3軸のうち up 以外を、軸インデックス昇順で固定。
  const [a, b] = axR < axF ? [axR, axF] : [axF, axR];
  // 画面右 = +e_a に固定し、画面上に置く e_b の符号を手性から決める。
  const eps = -su * permSign(a, b, axU);

  const na = maze.size[a];
  const nb = maze.size[b];
  const w = na * cell;
  const h = nb * cell;

  // セル座標 → ローカル座標(canvas は y 下向き。eps>0 = 画面上が +e_b なので反転する)
  const px = (va) => (va + 0.5) * cell;
  const py = (vb) => (eps > 0 ? nb - vb - 0.5 : vb + 0.5) * cell;

  // 配置(anchor)。既定は左上。'bottom-right' 等で四隅に寄せる。
  const anchor = opts.anchor ?? "top-left";
  const ox = anchor.includes("right") ? ctx.canvas.width - w - pad : pad;
  const oy = anchor.includes("bottom") ? ctx.canvas.height - h - pad : pad;

  const labelH = Math.round(cell * 1.3); // スライス見出しのぶん、背景を上に伸ばす

  ctx.save();
  ctx.translate(ox, oy);

  ctx.fillStyle = "rgba(8,10,16,0.72)";
  ctx.fillRect(-4, -4 - labelH, w + 8, h + 8 + labelH);

  // スライス位置は「不可視軸+up軸をプレイヤーの座標に固定」したもの
  const base = camera.pos.map(Math.round);

  for (let vb = 0; vb < nb; vb++) {
    for (let va = 0; va < na; va++) {
      const c = base.slice();
      c[a] = va;
      c[b] = vb;
      const x = px(va) - cell / 2;
      const y = py(vb) - cell / 2;
      if (maze.isSolid(c)) {
        ctx.fillStyle = "#3a4250";
        ctx.fillRect(x, y, cell - 1, cell - 1);
        continue;
      }
      ctx.fillStyle = "#141922";
      ctx.fillRect(x, y, cell - 1, cell - 1);

      // このスライスからの抜け道(up軸方向の穴)を示す。
      // 単一スライスでは縦の通路が全く見えないので、3D迷路ではこれが無いと地図が嘘になる。
      const head = c.slice();
      head[axU] += su; // プレイヤーの頭側
      const feet = c.slice();
      feet[axU] -= su; // 足側
      if (maze.isEmpty(head)) chevron(ctx, px(va), y + cell * 0.28, cell, -1, "#7fd6a0");
      if (maze.isEmpty(feet)) chevron(ctx, px(va), y + cell * 0.72, cell, 1, "#4a6f8a");
    }
  }

  // ゴール。別スライスにあるときは薄く(面内の位置だけ分かる)。
  const g = maze.goal;
  const goalHere = g[axU] === base[axU];
  ctx.fillStyle = goalHere ? "#e0b64a" : "rgba(224,182,74,0.28)";
  ctx.fillRect(px(g[a]) - cell / 2 + 1, py(g[b]) - cell / 2 + 1, cell - 3, cell - 3);

  // プレイヤー(位置 + 前方向き)。前は必ずスライス面内にあるので矢印は正確。
  const cx = px(camera.pos[a]);
  const cy = py(camera.pos[b]);
  const fx = camera.Fwd[a];
  const fy = -eps * camera.Fwd[b];
  ctx.fillStyle = "#4ad0ff";
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4ad0ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + fx * cell * 0.7, cy + fy * cell * 0.7);
  ctx.stroke();

  // どのスライスを見ているか(例 "Y=5 ↑" = 上下軸がYで、頭が +Y 側)
  ctx.fillStyle = "rgba(190,205,225,0.75)";
  ctx.font = `${Math.round(cell * 1.1)}px system-ui, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.fillText(`${axisLabel(axU)}=${base[axU]} ${su > 0 ? "↑" : "↓"}`, 0, -6);

  ctx.restore();
}

// スライス面から抜ける穴の目印(dirY: -1 = 画面上向き)
function chevron(ctx, cx, cy, cell, dirY, color) {
  const r = cell * 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + dirY * r);
  ctx.lineTo(cx - r, cy - dirY * r * 0.5);
  ctx.lineTo(cx + r, cy - dirY * r * 0.5);
  ctx.closePath();
  ctx.fill();
}

// (i,j,k) を昇順に並べ替えるのに必要な交換の偶奇。偶=+1 / 奇=-1。
// 3Dでは e_i × e_j = permSign(i,j,k) * e_k(i,j,k は相異なる3軸)に一致する。
function permSign(i, j, k) {
  let swaps = 0;
  if (i > j) swaps++;
  if (j > k) swaps++;
  if (i > k) swaps++;
  return swaps % 2 === 0 ? 1 : -1;
}
