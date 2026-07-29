// キーボード入力。押されているキーの集合を保持するだけ。
// 「離散移動を今どうするか」はゲームループ側が毎フレーム状態を見て決める
// (= キー押しっぱなしで連続移動できる)。
//
// キー割り当ての実体は game.js の BINDINGS 表にある。ここは正規化だけを担当する。
// Shift は修飾キーとして down セットに "shift" で入るので、そのまま参照できる。

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set(); // このフレームで新たに押されたキー(単発用)

    target.addEventListener("keydown", (e) => {
      const k = norm(e);
      if (!k) return;
      if (SCROLL_KEYS.has(k)) e.preventDefault();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
    });
    target.addEventListener("keyup", (e) => {
      const k = norm(e);
      if (k) this.down.delete(k);
    });
    // フォーカス外れでキーが押しっぱなしになるのを防ぐ
    window.addEventListener("blur", () => this.down.clear());
  }

  isDown(...keys) {
    return keys.some((k) => this.down.has(k));
  }
  wasPressed(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }
  endFrame() {
    this.pressed.clear();
  }
}

const SCROLL_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", " "]);

// Shift 併用でも同じキーとして扱えるように正規化する。
// 英字は toLowerCase で揃うが、記号は別文字になるので明示的に戻す。
const SHIFTED = { "<": ",", ">": "." };

function norm(e) {
  const k = e.key.toLowerCase();
  return SHIFTED[k] ?? k;
}
