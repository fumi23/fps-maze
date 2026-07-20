// 現在いる水平スライスを「上から見下ろした(俯瞰)」小さな地図。開発・探索の補助。
// 世界に固定して描き(向きで軸割り当てを変えない)、プレイヤーのアイコンだけが回る。
//
// canvas は Y下向きなので、そのまま描くと「床を下から見上げた」手性になり、
// 左旋回で地図上のアイコンが時計回り(=直感と逆)になる。これを避けるため、
// 内容の描画を縦反転して「世界Z=画面の上」にし、俯瞰の手性に揃える。

import { axisOf } from "./vec.js";

// snapBasis: 回転アニメの影響を受けないスナップ済み基底。
export function drawMinimap(ctx, maze, camera, snapBasis, opts = {}) {
  const cell = opts.cell ?? 9;
  const pad = opts.pad ?? 10;

  // 水平2軸 = 右/前 が指すワールド軸。ただし「軸インデックス昇順」で固定して
  // 地図X=hx, 地図Y=hy に割り当てる。向きが変わっても割り当てが入れ替わらないので、
  // 地図が転置(左右反転)しない。
  const axR = axisOf(snapBasis[0]);
  const axF = axisOf(snapBasis[2]);
  const [hx, hy] = axR <= axF ? [axR, axF] : [axF, axR];
  const wCells = maze.size[hx];
  const hCells = maze.size[hy];
  const w = wCells * cell;
  const h = hCells * cell;

  ctx.save();
  ctx.translate(pad, pad);

  ctx.fillStyle = "rgba(8,10,16,0.72)";
  ctx.fillRect(-4, -4, w + 8, h + 8);

  // ここから内容は縦反転して描く(世界Z=画面の上、俯瞰の手性)。
  // セル・ゴール・プレイヤー・矢印すべてが一括で反転する。
  ctx.translate(0, h);
  ctx.scale(1, -1);

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
