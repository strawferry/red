(function () {
  "use strict";

  // Geometry is defined in a fixed logical coordinate system (CSS pixels of
  // the stage at design width). The stage element scales to the real screen;
  // app.js converts between stage pixels and logical pixels.
  const STAGE_WIDTH = 340;      // logical width of the play stage
  const TABLE_LEFT = 6;         // table starts here
  const TABLE_RIGHT = 322;      // the cliff: table edge x
  const COIN_R = 21;            // coin radius
  const COIN_START = 34;        // coin centre x at rest
  const MM_PER_PX = 0.5;        // display scale: 1 stage px = 0.5 mm
  const FRICTION = 260;         // px/s^2, constant sliding deceleration
  const MAX_SPEED = 460;        // px/s cap for a full-power flick
  const MIN_FLICK = 26;         // px of drag below which nothing launches
  const ATTEMPTS = 3;

  // Convert a pointer gesture into a launch speed (px/s).
  // distance: total horizontal drag in stage px; velocity: release velocity
  // of the pointer in stage px/s. A blend keeps both gentle drags and quick
  // flicks controllable.
  function launchSpeed(distance, velocity) {
    if (distance < MIN_FLICK && velocity < 60) return 0;
    const fromDistance = distance * 2.1;
    const fromVelocity = Math.max(0, velocity) * 0.55;
    const speed = Math.max(fromDistance, fromVelocity * 0.4 + fromDistance * 0.75);
    return Math.min(MAX_SPEED, Math.round(speed));
  }

  // 0..1 power meter value for a given drag distance.
  function powerRatio(distance) {
    return Math.max(0, Math.min(1, distance / 190));
  }

  // Where does a coin launched at `speed` stop? Returns centre x.
  function stopCentre(speed) {
    return COIN_START + (speed * speed) / (2 * FRICTION);
  }

  // Score a finished slide. centre = final coin centre x (stage px).
  // fell: coin centre passed the edge (coin tips over and drops).
  function judge(centre) {
    const gapPx = TABLE_RIGHT - (centre + COIN_R);
    if (gapPx < 0) {
      return { fell: true, mm: null, gapPx, title: "飞出去了！", line: "力气给大了，硬币直接冲下了悬崖。" };
    }
    const mm = Math.max(0, Math.round(gapPx * MM_PER_PX * 10) / 10);
    if (mm <= 2) return { fell: false, mm, gapPx, title: "贴边之神", line: "只差 " + mm + " 毫米就掉下去，这手感封神了。" };
    if (mm <= 5) return { fell: false, mm, gapPx, title: "毫米大师", line: "离悬崖只剩 " + mm + " 毫米，看得人心跳加速。" };
    if (mm <= 15) return { fell: false, mm, gapPx, title: "稳稳当当", line: "差 " + mm + " 毫米，够稳，也够险。" };
    if (mm <= 40) return { fell: false, mm, gapPx, title: "还差一点", line: "还差 " + mm + " 毫米，下次手再往前送一点。" };
    return { fell: false, mm, gapPx, title: "太保守啦", line: "离桌沿还有 " + mm + " 毫米，大胆一点，悬崖在召唤。" };
  }

  window.CoinGame = {
    STAGE_WIDTH, TABLE_LEFT, TABLE_RIGHT, COIN_R, COIN_START,
    MM_PER_PX, FRICTION, MAX_SPEED, MIN_FLICK, ATTEMPTS,
    launchSpeed, powerRatio, stopCentre, judge
  };
})();
