// キーボード入力。押されているキーの集合を保持するだけ。
// 「離散移動を今どうするか」はゲームループ側が毎フレーム状態を見て決める
// (= キー押しっぱなしで連続移動できる)。
//
// 移動: W/S=前後, A/D=左右ストレイフ
// 旋回: Q/E または ←/→(どちらも効く)
// その他: M=ミニマップ切替, R=リスタート

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

const SCROLL_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright"]);

function norm(e) {
  const k = e.key.toLowerCase();
  return k;
}
