(function () {
  "use strict";

  const MIN_LEN = 4.0;              // shortest possible fry, cm
  const MAX_LEN = 14.0;             // longest possible fry, cm
  const STICKS = 7;                 // fry tips shown in the tube
  const PULL_THRESHOLD = 64;        // px of upward drag needed to draw

  // Length: average of two uniform rolls mapped onto [MIN_LEN, MAX_LEN]
  // gives a triangular distribution — middling lengths common, extremes rare.
  function drawLength(rand) {
    const t = (rand() + rand()) / 2;
    const len = MIN_LEN + t * (MAX_LEN - MIN_LEN);
    return Math.round(len * 10) / 10;
  }

  // Five tiers by length, best first.
  const TIERS = [
    {
      min: 12.5, name: "上上签", level: 5,
      fortunes: ["长得离谱，好运也是。", "今日你就是全桌最长的那根。", "签长一寸，运强十分。"],
      explain: "想做的事放心大胆去做，今天连番茄酱都站在你这边。"
    },
    {
      min: 10.5, name: "上签", level: 4,
      fortunes: ["长度在线，运气在线。", "出道即高峰，今天稳了。", "这根薯条，有点东西。"],
      explain: "会有小惊喜落在手边，别低头玩手机，抬头接住。"
    },
    {
      min: 8.5, name: "中签", level: 3,
      fortunes: ["不长不短，刚刚好。", "平平无奇，快乐无敌。", "中庸之道，自有回甘。"],
      explain: "节奏不用赶，把手边的小事做完，好运在排队。"
    },
    {
      min: 6.5, name: "平签", level: 2,
      fortunes: ["短小精悍，蘸酱正好。", "个头不大，胜在脆香。", "别比长度，比快乐你赢。"],
      explain: "适合躺平蓄力，吃点好的，明天再战。"
    },
    {
      min: 0, name: "末签", level: 1,
      fortunes: ["迷你本迷你，可爱本爱。", "签筒深处自有宝藏，这根是探路的。", "短短一根，快乐翻倍。"],
      explain: "运气在攒大招，今天宜对自己好一点，坏事自动绕道。"
    }
  ];

  function tierFor(len) {
    for (let i = 0; i < TIERS.length; i++) {
      if (len >= TIERS[i].min) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  const LUCKY_ITEMS = ["番茄酱", "芝士条", "冰可乐", "薄荷糖", "耳机", "帆布包", "雨伞", "笔记本", "发圈", "钥匙扣"];
  const LUCKY_COLORS = ["番茄红", "金黄色", "奶油白", "抹茶绿", "天空蓝", "蜜桃粉", "可可棕", "葡萄紫"];

  function pick(list, rand) {
    return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  }

  // Fun-only percentile: linear map of the length range onto 1..99.
  // Not a real statistic — the design doc says so, and the share card omits it.
  function percentile(len) {
    const t = (len - MIN_LEN) / (MAX_LEN - MIN_LEN);
    return Math.max(1, Math.min(99, Math.round(t * 98) + 1));
  }

  // One full draw result from a chosen length.
  function makeResult(len, rand) {
    const tier = tierFor(len);
    return {
      len,
      tier: tier.name,
      level: tier.level,
      fortune: pick(tier.fortunes, rand),
      explain: tier.explain,
      item: pick(LUCKY_ITEMS, rand),
      color: pick(LUCKY_COLORS, rand),
      pct: percentile(len),
      stamp: Date.now()
    };
  }

  window.FriesGame = {
    MIN_LEN, MAX_LEN, STICKS, PULL_THRESHOLD,
    TIERS, LUCKY_ITEMS, LUCKY_COLORS,
    drawLength, tierFor, pick, percentile, makeResult
  };
})();
