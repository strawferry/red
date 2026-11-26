(function () {
  "use strict";

  const TOTAL = 180;                // cats per board
  const COLS = 6;                   // grid columns
  const PENALTY = 3;                // seconds added per wrong tap
  const NEAR_MIN = 45;              // near-miss cats (differ in exactly 1 attribute)
  const NEAR_MAX = 65;

  // Attribute tables. `disc` is the backdrop colour that backs up the coat filter,
  // so a coat stays recognisable even where the filter renders weakly.
  const COATS = [
    { name: "橘子橘", disc: "#ffd9a3" },
    { name: "奶油白", disc: "#efe9dd" },
    { name: "水泥灰", disc: "#dde2e6" },
    { name: "巧克力", disc: "#d9b48f" },
    { name: "草莓粉", disc: "#ffd6e0" },
    { name: "薄荷青", disc: "#cdf0dd" }
  ];
  const MARKS = [
    { name: "光溜溜" },
    { name: "三条纹" },
    { name: "一点斑" },
    { name: "爱心斑" },
    { name: "闪电纹" }
  ];
  // Eye styles use distinct cat-face emoji variants: overlay-drawn eyes would
  // drift across renderers, and there is no star-eye cat face, so the third
  // style is heart eyes — just as easy to tell apart.
  const EYES = [
    { name: "圆圆眼", face: "🐱" },
    { name: "眯眯眼", face: "😸" },
    { name: "心心眼", face: "😻" }
  ];
  const COLLARS = [
    { name: "没项圈" },
    { name: "红项圈" },
    { name: "蓝项圈" },
    { name: "金铃铛" }
  ];
  const KEYS = ["coat", "mark", "eyes", "collar"];
  const SIZES = { coat: COATS.length, mark: MARKS.length, eyes: EYES.length, collar: COLLARS.length };

  function randInt(rand, n) {
    return Math.floor(rand() * n);
  }

  function randomAttrs(rand) {
    return {
      coat: randInt(rand, SIZES.coat),
      mark: randInt(rand, SIZES.mark),
      eyes: randInt(rand, SIZES.eyes),
      collar: randInt(rand, SIZES.collar)
    };
  }

  function faceFor(cat) {
    return EYES[cat.eyes].face;
  }

  // How many of the four attributes differ between two cats (0-4).
  function diffCount(a, b) {
    let diff = 0;
    KEYS.forEach(key => { if (a[key] !== b[key]) diff += 1; });
    return diff;
  }

  // A cat that matches the target everywhere except exactly one attribute.
  function nearVariant(target, rand) {
    const cat = { coat: target.coat, mark: target.mark, eyes: target.eyes, collar: target.collar };
    const key = KEYS[randInt(rand, KEYS.length)];
    const size = SIZES[key];
    cat[key] = (target[key] + 1 + randInt(rand, size - 1)) % size;
    return cat;
  }

  // Build one board: exactly one full match, NEAR_MIN-NEAR_MAX near misses,
  // every other cat differs from the target in at least two attributes.
  function generateBoard(rand) {
    const target = randomAttrs(rand);
    const nearCount = NEAR_MIN + randInt(rand, NEAR_MAX - NEAR_MIN + 1);
    const cats = [];
    for (let i = 0; i < nearCount; i++) cats.push(nearVariant(target, rand));
    while (cats.length < TOTAL - 1) {
      const candidate = randomAttrs(rand);
      if (diffCount(candidate, target) >= 2) cats.push(candidate);
    }
    const targetIndex = randInt(rand, TOTAL);
    cats.splice(targetIndex, 0, {
      coat: target.coat, mark: target.mark, eyes: target.eyes, collar: target.collar
    });
    return { target, cats, targetIndex, nearCount };
  }

  function rate(score) {
    if (score < 30) return { title: "鹰眼", line: "一百八十只猫扫一眼就锁定，你这眼睛是自带搜索框的吧。" };
    if (score < 60) return { title: "火眼金睛", line: "猫海茫茫，你愣是把同纹那只给揪出来了。" };
    if (score < 120) return { title: "眼力不错", line: "稳扎稳打逐项核对，猫们表示心服口服。" };
    if (score < 240) return { title: "慢慢找也找到了", line: "找猫一阵子，快乐一下午——功夫不负有心人。" };
    return { title: "猫都看晕了", line: "猫看你都看困了，但找到就是胜利。" };
  }

  // Seconds (float) -> "47.6 秒" under a minute, "2:03.4" above it.
  function formatTime(seconds) {
    const tenths = Math.round(seconds * 10);
    const minutes = Math.floor(tenths / 600);
    const rest = tenths % 600;
    const secs = Math.floor(rest / 10);
    const tenth = rest % 10;
    if (minutes > 0) return minutes + ":" + (secs < 10 ? "0" : "") + secs + "." + tenth;
    return secs + "." + tenth + " 秒";
  }

  window.CatsGame = {
    TOTAL, COLS, PENALTY, NEAR_MIN, NEAR_MAX,
    COATS, MARKS, EYES, COLLARS, KEYS, SIZES,
    faceFor, diffCount, generateBoard, rate, formatTime
  };
})();
