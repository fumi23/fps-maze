// 現在いる水平スライスを上から見た小さな地図。開発・探索の補助。
// 可視軸のうち「上軸」を除いた2軸を地図のX/Yに割り当てて描く。

import { axisOf } from "./vec.js";

// snapBasis: 回転アニメの影響を受けないスナップ済み基底(軸の割り当てを安定させる)
export function drawMinimap(ctx, maze, camera, snapBasis, opts = {}) {
  const cell = opts.cell ?? 9;
  const pad = opts.pad ?? 10;

  // 水平2軸(スナップ済みの 右/前 が指すワールド軸)。地図X=hx, 地図Y=hy。
  const hx = axisOf(snapBasis[0]);
  const hy = axisOf(snapBasis[2]);
  const wCells = maze.size[hx];
  const hCells = maze.size[hy];
  const w = wCells * cell;
  const h = hCells * cell;

  ctx.save();
  ctx.translate(pad, pad);

  ctx.fillStyle = "rgba(8,10,16,0.72)";
  ctx.fillRect(-4, -4, w + 8, h + 8);

  const base = camera.pos.map(Math.round);
  for (let b = 0; b < hCells; b++) {
    for (let a = 0; a < wCells; a++) {
      const c = base.slice();
      c[hx] = a;
      c[hy] = b;
      const solid = maze.isSolid(c);
      ctx.fillStyle = solid ? "#3a4250" : "#141922";
      ctx.fillRect(a * cell, b * cell, cell - 1, cell - 1);
    }
  }

  // ゴール
  const g = maze.goal;
  ctx.fillStyle = "#e0b64a";
  ctx.fillRect(g[hx] * cell + 1, g[hy] * cell + 1, cell - 3, cell - 3);

  // プレイヤー(位置 + 前方向き)
  const px = (camera.pos[hx] + 0.5) * cell;
  const py = (camera.pos[hy] + 0.5) * cell;
  const fx = camera.Fwd[hx];
  const fy = camera.Fwd[hy];
  ctx.fillStyle = "#4ad0ff";
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4ad0ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + fx * cell * 0.7, py + fy * cell * 0.7);
  ctx.stroke();

  ctx.restore();
}
