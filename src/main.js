// エントリポイント。コースを読み込み、ゲームを起動する。

import { Game } from "./game.js";
import { loadCourse1 } from "./courses/course1.js";

const canvas = document.getElementById("view");
const maze = loadCourse1();

new Game({
  canvas,
  maze,
  hud: {
    pos: document.getElementById("hud-pos"),
    win: document.getElementById("win"),
  },
});
