// 2D 完全迷路(perfect maze)ジェネレータ。
// いまは静的コース1枚を生成するためのもの。将来 N 次元へ拡張する土台。
//
// 使い方:
//   node tools/gen-maze.mjs --w 10 --h 10 --seed 7 > src/courses/course1.data.js
//
// 出力は ES モジュール(grid: 文字列配列)。'#'=壁 '.'=通路 'S'=開始 'G'=ゴール。
// 行が Z(奥行き)、列が X(横)。ゲーム側で y=1 の1層に配置される。

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv) {
  const o = { w: 10, h: 10, seed: 7 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, "");
    if (k in o) o[k] = parseInt(argv[++i], 10);
  }
  return o;
}

// 再帰的バックトラッカー。cellW×cellH の部屋を壁で仕切り、通路を掘る。
// 実グリッドサイズは (2*cellW+1) × (2*cellH+1)。
function generate(cellW, cellH, rng) {
  const W = 2 * cellW + 1;
  const H = 2 * cellH + 1;
  const grid = Array.from({ length: H }, () => Array(W).fill("#"));

  const visited = Array.from({ length: cellH }, () => Array(cellW).fill(false));
  const stack = [[0, 0]];
  visited[0][0] = true;
  grid[1][1] = ".";

  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nbs = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH && !visited[ny][nx]) {
        nbs.push([nx, ny, dx, dy]);
      }
    }
    if (nbs.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = nbs[(rng() * nbs.length) | 0];
    visited[ny][nx] = true;
    // 壁を掘る(セル座標→グリッド座標は *2+1)
    grid[2 * cy + 1 + dy][2 * cx + 1 + dx] = ".";
    grid[2 * ny + 1][2 * nx + 1] = ".";
    stack.push([nx, ny]);
  }

  // 開始と最遠ゴールを設定(左上開始、BFSで最遠セルをゴールに)
  grid[1][1] = "S";
  const [gx, gy] = farthestOpen(grid, 1, 1);
  grid[gy][gx] = "G";

  return grid.map((row) => row.join(""));
}

// 開始から最も遠い通路セル(グリッド座標)を BFS で求める
function farthestOpen(grid, sx, sy) {
  const H = grid.length;
  const W = grid[0].length;
  const dist = Array.from({ length: H }, () => Array(W).fill(-1));
  const q = [[sx, sy]];
  dist[sy][sx] = 0;
  let best = [sx, sy];
  let bestD = 0;
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      if (grid[ny][nx] === "#" || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      if (dist[ny][nx] > bestD) {
        bestD = dist[ny][nx];
        best = [nx, ny];
      }
      q.push([nx, ny]);
    }
  }
  return best;
}

const { w, h, seed } = parseArgs(process.argv);
const grid = generate(w, h, mulberry32(seed));

const body =
  `// 自動生成された静的コース(tools/gen-maze.mjs)。手で編集しても良い。\n` +
  `// '#'=壁 '.'=通路 'S'=開始 'G'=ゴール。行=Z(奥), 列=X(横)。\n` +
  `export const meta = { w: ${w}, h: ${h}, seed: ${seed} };\n` +
  `export const grid = [\n` +
  grid.map((r) => `  ${JSON.stringify(r)},`).join("\n") +
  `\n];\n`;

process.stdout.write(body);
