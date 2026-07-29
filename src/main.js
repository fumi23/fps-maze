// エントリポイント。コースを読み込み、ゲームを起動する。

import { Game } from "./game.js";
import { loadCourse1 } from "./courses/course1.js";

const canvas = document.getElementById("view");
const course = loadCourse1(); // { maze, mode }

const game = new Game({
  canvas,
  course,
  hud: {
    pos: document.getElementById("hud-pos"),
    goal: document.getElementById("hud-goal"),
    win: document.getElementById("win"),
  },
});

// デバッグ用に参照を公開(コンソールから game.player などを触れる)
window.game = game;
