(function () {
  "use strict";

  const DURATION = 45;              // seconds per round
  const HOLES = 9;                  // 3 x 3
  const HUMAN_CHANCE = 0.25;        // share of humans among spawns
  const MOLE_EMOJI = "🐹";
  const HUMAN_EMOJIS = ["🧑", "👨", "👩", "🧑‍🦱", "👨‍🦱", "👩‍🦱", "🧔", "👱‍♀️"];
  const HIT_POINTS = 10;
  const COMBO_EVERY = 5;            // every Nth combo step pays a bonus
  const COMBO_BONUS = 10;
  const MISS_PENALTY = 15;          // whacking a mole
  const MAX_ACTIVE = 4;

  function pickRole(rand) {
    return rand() < HUMAN_CHANCE ? "human" : "mole";
  }

  function pickEmoji(role, rand) {
    if (role === "mole") return MOLE_EMOJI;
    return HUMAN_EMOJIS[Math.floor(rand() * HUMAN_EMOJIS.length) % HUMAN_EMOJIS.length];
  }

  // Milliseconds between spawns: ~800ms early, ~380ms at the end.
  function spawnInterval(progress) {
    return Math.round(800 - 420 * progress);
  }

  // How long a target stays up: about 0.7-1.2s, a bit shorter late game.
  function stayDuration(progress, rand) {
    const min = 700 - 100 * progress;
    const max = 1200 - 250 * progress;
    return Math.round(min + rand() * (max - min));
  }

  // Late game may pop two targets at once.
  function spawnCount(progress, rand) {
    return progress > 0.55 && rand() < 0.4 ? 2 : 1;
  }

  // Pure scoring: returns the outcome of one tap on a visible target.
  function hitOutcome(role, combo) {
    if (role === "human") {
      const nextCombo = combo + 1;
      const bonus = nextCombo % COMBO_EVERY === 0 ? COMBO_BONUS : 0;
      return { delta: HIT_POINTS + bonus, bonus, combo: nextCombo, kind: "hit" };
    }
    return { delta: -MISS_PENALTY, bonus: 0, combo: 0, kind: "miss" };
  }

  function rate(score, misses) {
    if (score >= 300) return { title: "眼疾手快", line: "地鼠看了都摇头，这手速和眼力没谁了。" };
    if (score >= 200) return { title: "反应灵敏", line: "下手又快又准，人类一个都没跑掉。" };
    if (score >= 100) return { title: "渐入佳境", line: "节奏对了，再快一点就起飞。" };
    if (score >= 0) return { title: "再练练手", line: "记住口诀：只打人，不打鼠。" };
    return { title: "地鼠保护协会警告", line: "本局误伤地鼠 " + misses + " 只，协会已发来警告信！" };
  }

  window.MoleGame = {
    DURATION, HOLES, HUMAN_CHANCE, MOLE_EMOJI, HUMAN_EMOJIS,
    HIT_POINTS, COMBO_EVERY, COMBO_BONUS, MISS_PENALTY, MAX_ACTIVE,
    pickRole, pickEmoji, spawnInterval, stayDuration, spawnCount, hitOutcome, rate
  };
})();
