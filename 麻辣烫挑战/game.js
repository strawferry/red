(function () {
  "use strict";

  const TARGET = 250;
  const INGREDIENTS = [
    { id: 0, name: "鱼丸", emoji: "🍥", base: 18 },
    { id: 1, name: "牛肉丸", emoji: "🧆", base: 22 },
    { id: 2, name: "虾滑", emoji: "🦐", base: 25 },
    { id: 3, name: "午餐肉", emoji: "🥩", base: 30 },
    { id: 4, name: "鹌鹑蛋", emoji: "🥚", base: 12 },
    { id: 5, name: "生菜", emoji: "🥬", base: 10 },
    { id: 6, name: "金针菇", emoji: "🍄", base: 15 },
    { id: 7, name: "玉米", emoji: "🌽", base: 28 },
    { id: 8, name: "宽粉", emoji: "🍜", base: 35 },
    { id: 9, name: "面饼", emoji: "🫓", base: 60 },
    { id: 10, name: "香肠", emoji: "🌭", base: 32 },
    { id: 11, name: "蟹棒", emoji: "🦀", base: 16 },
    { id: 12, name: "土豆片", emoji: "🥔", base: 14 },
    { id: 13, name: "西兰花", emoji: "🥦", base: 13 },
    { id: 14, name: "饺子", emoji: "🥟", base: 24 },
    { id: 15, name: "青椒", emoji: "🫑", base: 9 }
  ];

  function makePiece(item) {
    const grams = Math.max(3, Math.round(item.base * (0.85 + Math.random() * 0.3)));
    return { id: item.id, name: item.name, emoji: item.emoji, grams };
  }

  function rate(total) {
    const diff = total - TARGET;
    const abs = Math.abs(diff);
    if (abs === 0) return { diff, title: "麻辣烫之神", line: "一克不差！这手感，是开了天眼吧。" };
    if (abs <= 3) return { diff, title: "神之手感", line: "就差 " + abs + " 克，称都不用称了。" };
    if (abs <= 10) return { diff, title: "老饕本饕", line: "差 " + abs + " 克，常年在麻辣烫摊上混的。" };
    if (abs <= 25) return { diff, title: "有点东西", line: "差 " + abs + " 克，再练两局就出师。" };
    if (abs <= 50) return { diff, title: "差一口气", line: "差 " + abs + " 克，" + (diff > 0 ? "下手稍微重了点。" : "下手稍微轻了点。") };
    return diff > 0
      ? { diff, title: "麻辣烫刺客", line: "超了 " + abs + " 克！老板的称都要冒烟了。" }
      : { diff, title: "还没吃饱", line: "少了 " + abs + " 克，这碗端上桌得被笑话。" };
  }

  window.MalatangGame = { TARGET, INGREDIENTS, makePiece, rate };
})();
