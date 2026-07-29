// N次元 完全迷路(perfect maze)ジェネレータ。再帰的バックトラッカー + 任意の braid。
//
// 使い方:
//   node tools/gen-maze.mjs --dims 3 --rooms 7,3,7 --seed 7 > src/courses/course1.data.js
//   node tools/gen-maze.mjs --dims 2 --rooms 11 --seed 3 > src/courses/course2.data.js
//
// オプション
//   --dims  N        次元数(既定 3)
//   --rooms a,b,c    軸ごとの部屋数。1つだけ渡すと全軸に適用。実グリッドは 2*部屋数+1
//   --seed  N        乱数シード(同じ値なら同じ迷路)
//   --braid 0..1     行き止まりをこの割合でつぶしてループを作る(0 = 完全迷路)
//
// 難易度は「サイズ(--rooms)・次元数(--dims)・分岐の多さ(--braid)」で調整する。
// braid を上げるほど行き止まりが減り、ループが増えて「詰まりにくいが道を見失いやすい」迷路になる。

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

// 次元ごとの既定サイズ。2Dは広く、3D以上は縦(axis1)を薄めにして層構造が分かるようにする。
const DEFAULT_ROOMS = {
  2: [11, 11],
  3: [7, 3, 7],
  4: [5, 3, 5, 3],
};

function parseArgs(argv) {
  const o = { dims: 3, rooms: null, seed: 7, braid: 0 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, "");
    const v = argv[++i];
    if (v === undefined) die(`--${k} に値がありません`);
    if (k === "rooms") o.rooms = v.split(",").map((s) => parseInt(s, 10));
    else if (k === "braid") o.braid = parseFloat(v);
    else if (k === "dims" || k === "seed") o[k] = parseInt(v, 10);
    else die(`不明なオプション --${k}`);
  }
  if (o.dims < 2) die("--dims は2以上");
  if (!o.rooms) o.rooms = DEFAULT_ROOMS[o.dims] ?? new Array(o.dims).fill(5);
  if (o.rooms.length === 1) o.rooms = new Array(o.dims).fill(o.rooms[0]);
  if (o.rooms.length !== o.dims) die(`--rooms は ${o.dims} 個(または1個)指定してください`);
  if (o.rooms.some((r) => !(r >= 1))) die("--rooms は1以上の整数");
  if (!(o.braid >= 0 && o.braid <= 1)) die("--braid は 0..1");
  return o;
}

function die(msg) {
  console.error(`gen-maze: ${msg}`);
  process.exit(1);
}

// 各軸のストライド(軸0が最も速く回る = 行方向)
function strides(size) {
  const s = new Array(size.length);
  let acc = 1;
  for (let i = 0; i < size.length; i++) {
    s[i] = acc;
    acc *= size[i];
  }
  return s;
}

// N次元グリッドの単純なインデクサ
function grid(size) {
  const st = strides(size);
  const total = size.reduce((a, b) => a * b, 1);
  return {
    size,
    total,
    index: (c) => {
      let i = 0;
      for (let ax = 0; ax < c.length; ax++) i += c[ax] * st[ax];
      return i;
    },
    inBounds: (c) => c.every((v, ax) => v >= 0 && v < size[ax]),
  };
}

// 部屋座標 → グリッド座標(部屋は奇数座標、その間が壁)
const roomToCell = (r) => r.map((v) => 2 * v + 1);

// 再帰的バックトラッカー: 全部屋を1本の木でつなぐ(= 完全迷路)
function carve(rooms, cells, g, rng) {
  const dims = rooms.length;
  const rg = grid(rooms);
  const visited = new Uint8Array(rg.total);

  const startRoom = new Array(dims).fill(0);
  visited[rg.index(startRoom)] = 1;
  cells[g.index(roomToCell(startRoom))] = 0;

  const stack = [startRoom];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const nbs = [];
    for (let ax = 0; ax < dims; ax++) {
      for (const s of [-1, 1]) {
        const n = cur.slice();
        n[ax] += s;
        if (n[ax] < 0 || n[ax] >= rooms[ax]) continue;
        if (visited[rg.index(n)]) continue;
        nbs.push([n, ax, s]);
      }
    }
    if (nbs.length === 0) {
      stack.pop();
      continue;
    }
    const [n, ax, s] = nbs[(rng() * nbs.length) | 0];
    visited[rg.index(n)] = 1;
    const wall = roomToCell(cur);
    wall[ax] += s; // 部屋と部屋の間の壁を掘る
    cells[g.index(wall)] = 0;
    cells[g.index(roomToCell(n))] = 0;
    stack.push(n);
  }
}

// 行き止まりの部屋を ratio の割合で選び、閉じている隣の壁を1枚抜いてループを作る。
function braidDeadEnds(rooms, cells, g, rng, ratio) {
  if (ratio <= 0) return 0;
  const dims = rooms.length;

  // 行き止まり = 開いている隣接方向が1つ以下の部屋
  const deadEnds = [];
  forEachRoom(rooms, (r) => {
    const c = roomToCell(r);
    let open = 0;
    for (let ax = 0; ax < dims; ax++) {
      for (const s of [-1, 1]) {
        const w = c.slice();
        w[ax] += s;
        if (g.inBounds(w) && cells[g.index(w)] === 0) open++;
      }
    }
    if (open <= 1) deadEnds.push(c);
  });

  let opened = 0;
  for (const c of deadEnds) {
    if (rng() >= ratio) continue;
    const cands = [];
    for (let ax = 0; ax < dims; ax++) {
      for (const s of [-1, 1]) {
        const w = c.slice();
        w[ax] += s;
        const opposite = c.slice();
        opposite[ax] += 2 * s;
        if (!g.inBounds(opposite)) continue; // 外周は抜かない
        if (cells[g.index(w)] === 0) continue; // 既に開いている
        cands.push(w);
      }
    }
    if (!cands.length) continue;
    cells[g.index(cands[(rng() * cands.length) | 0])] = 0;
    opened++;
  }
  return opened;
}

function forEachRoom(rooms, fn) {
  const dims = rooms.length;
  const r = new Array(dims).fill(0);
  const recur = (ax) => {
    if (ax === dims) return fn(r);
    for (r[ax] = 0; r[ax] < rooms[ax]; r[ax]++) recur(ax + 1);
    r[ax] = 0;
  };
  recur(0);
}

// start からの経路距離を BFS で全通路セルぶん求める。
function bfs(cells, g, start) {
  const dims = g.size.length;
  const dist = new Int32Array(g.total).fill(-1);
  dist[g.index(start)] = 0;

  const queue = [start];
  let head = 0;
  let maxDist = 0;

  while (head < queue.length) {
    const c = queue[head++];
    const d = dist[g.index(c)];
    for (let ax = 0; ax < dims; ax++) {
      for (const s of [-1, 1]) {
        const n = c.slice();
        n[ax] += s;
        if (!g.inBounds(n)) continue;
        const ni = g.index(n);
        if (cells[ni] !== 0 || dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        if (dist[ni] > maxDist) maxDist = dist[ni];
        queue.push(n);
      }
    }
  }
  return { dist, maxDist, reached: queue.length, order: queue };
}

// ゴールを選ぶ。「経路が長い」だけで選ぶと、最遠セルがスタートの真隣(壁1枚隔てた
// 別通路)になることがある。座標を頼りに進むゲームなので、それでは達成感が出ない。
// そこで「経路距離が上位 GOAL_BAND のセル」の中から、直線距離が最大のものを採る。
const GOAL_BAND = 0.75;

function pickGoal(g, start, { dist, maxDist, order }) {
  const threshold = maxDist * GOAL_BAND;
  let best = null;
  let bestScore = -1;
  for (const c of order) {
    const d = dist[g.index(c)];
    if (d < threshold) continue;
    let far2 = 0;
    for (let ax = 0; ax < c.length; ax++) {
      const dv = c[ax] - start[ax];
      far2 += dv * dv;
    }
    // 同じ直線距離なら経路の長いほうを優先
    const score = far2 * (maxDist + 1) + d;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best ?? start.slice();
}

// --- 出力 -------------------------------------------------------------
// 1行 = axis0 方向の並び(文字列)。行の並び順は axis1 を最上位、以降 axis2, axis3...
// の順に入れ子(= 最後の軸がいちばん速く回る)。3Dなら「axis1(高さ)ごとのフロアプラン」になる。
function rowIndex(c, size) {
  let i = 0;
  for (let ax = 1; ax < size.length; ax++) i = i * size[ax] + c[ax];
  return i;
}

function toRows(cells, g) {
  const size = g.size;
  const rowCount = size.slice(1).reduce((a, b) => a * b, 1);
  const rows = new Array(rowCount);
  const c = new Array(size.length).fill(0);

  const recur = (ax) => {
    if (ax === 0) {
      let s = "";
      for (c[0] = 0; c[0] < size[0]; c[0]++) s += cells[g.index(c)] ? "#" : ".";
      c[0] = 0;
      rows[rowIndex(c, size)] = s;
      return;
    }
    for (c[ax] = 0; c[ax] < size[ax]; c[ax]++) recur(ax - 1);
    c[ax] = 0;
  };
  recur(size.length - 1);
  return rows;
}

function emit(o, size, rows, start, goal, goalDist) {
  const blockSize = size.slice(2).reduce((a, b) => a * b, 1); // axis1 の1値ぶんの行数
  const lines = [];
  rows.forEach((r, i) => {
    if (size.length > 2 && i % blockSize === 0) {
      if (i > 0) lines.push("");
      lines.push(`  // axis1 = ${i / blockSize}`);
    }
    lines.push(`  ${JSON.stringify(r)},`);
  });

  return (
    `// 自動生成された静的コース(tools/gen-maze.mjs)。手で編集しても良い。\n` +
    `// 生成: node tools/gen-maze.mjs --dims ${o.dims} --rooms ${o.rooms.join(",")} --seed ${o.seed} --braid ${o.braid}\n` +
    `//\n` +
    `// '#'=壁 '.'=通路。1行は axis0 方向の並び。\n` +
    `// 行インデックスは axis1 を最上位、以降 axis2, axis3... の順に入れ子:\n` +
    `//   i = 0; for (ax = 1; ax < dims; ax++) i = i * size[ax] + c[ax];\n` +
    `// 3Dでは axis1 = 高さ(Y)なので、1ブロック = 1フロアの平面図になる。\n` +
    `export const meta = { dims: ${o.dims}, rooms: [${o.rooms.join(", ")}], seed: ${o.seed}, braid: ${o.braid}, goalDist: ${goalDist} };\n` +
    `export const dims = ${o.dims};\n` +
    `export const size = [${size.join(", ")}];\n` +
    `export const start = [${start.join(", ")}];\n` +
    `export const goal = [${goal.join(", ")}];\n` +
    `export const rows = [\n${lines.join("\n")}\n];\n`
  );
}

// --- main -------------------------------------------------------------
const o = parseArgs(process.argv);
const rng = mulberry32(o.seed);
const size = o.rooms.map((r) => 2 * r + 1);
const g = grid(size);

const cells = new Uint8Array(g.total).fill(1); // 1 = 壁
carve(o.rooms, cells, g, rng);
const braided = braidDeadEnds(o.rooms, cells, g, rng, o.braid);

const start = roomToCell(new Array(o.dims).fill(0));
const reach = bfs(cells, g, start);
const goal = pickGoal(g, start, reach);
const goalDist = reach.dist[g.index(goal)];

const empty = cells.reduce((a, v) => a + (v ? 0 : 1), 0);
console.error(
  `gen-maze: dims=${o.dims} size=${size.join("x")} 通路${empty}/${g.total}セル ` +
    `到達${reach.reached} braid開通${braided} / ゴール[${goal.join(",")}] 経路${goalDist}歩(最遠${reach.maxDist})`
);
if (reach.reached !== empty) die("到達できない通路セルがあります(生成バグ)");

process.stdout.write(emit(o, size, toRows(cells, g), start, goal, goalDist));
