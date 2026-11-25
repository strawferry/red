(function () {
  "use strict";

  const PEOPLE = 6;                 // friends in the row
  const FILMS = 5;                  // shots per round
  const READY_CHANCE = 0.55;        // share of "ready" when a state is rolled
  const PER_READY = 15;             // points per ready person
  const PERFECT_BONUS = 10;         // all six ready
  const STATES = ["ready", "blink", "away", "down"];

  // Cast: each friend has their own ready face plus a name tag.
  const CAST = [
    { name: "阿哲", face: "👦" },
    { name: "小雨", face: "👧" },
    { name: "大壮", face: "🧑" },
    { name: "莉莉", face: "👱‍♀️" },
    { name: "老王", face: "👨‍🦰" },
    { name: "奶奶", face: "👵" }
  ];
  const BLINK_FACE = "😑";
  const AWAY_FACE = "🙄";
  const STATE_LABEL = {
    ready: "就绪",
    blink: "眨眼了",
    away: "看别处",
    down: "蹲下了"
  };

  // Face shown for a person in a given state.
  function faceFor(person, state) {
    if (state === "blink") return BLINK_FACE;
    if (state === "away") return AWAY_FACE;
    return CAST[person].face; // ready and down keep their own face
  }

  // Roll a new state: ready about 55%, the rest split among the three flaws.
  function rollState(rand) {
    const r = rand();
    if (r < READY_CHANCE) return "ready";
    const rest = (r - READY_CHANCE) / (1 - READY_CHANCE); // 0..1
    if (rest < 1 / 3) return "blink";
    if (rest < 2 / 3) return "away";
    return "down";
  }

  // How long a state lasts: 0.6-2.2s.
  function stateDuration(rand) {
    return Math.round(600 + rand() * 1600);
  }

  // Score one frozen frame. states: array of 6 state strings.
  function scoreShot(states) {
    const ready = states.filter(state => state === "ready").length;
    const perfect = ready === PEOPLE;
    const score = ready * PER_READY + (perfect ? PERFECT_BONUS : 0);
    return { ready, perfect, score };
  }

  function rate(score) {
    if (score >= 100) return { title: "完美合影", line: "六个人全员看镜头，这种照片一年遇不到一次。" };
    if (score >= 85) return { title: "抓拍大师", line: "就差临门一脚，时机感已经拉满了。" };
    if (score >= 70) return { title: "还不错", line: "大体能看，就是总有一两个不配合的。" };
    if (score >= 50) return { title: "有点遗憾", line: "每张都差一个人，气不气？" };
    return { title: "全是废片", line: "五张胶片全军覆没，这届朋友太难带了。" };
  }

  // Index of the best shot in a list of shot results (first wins ties).
  function bestIndex(shots) {
    let best = -1;
    shots.forEach((shot, index) => {
      if (best < 0 || shot.score > shots[best].score) best = index;
    });
    return best;
  }

  window.PhotoGame = {
    PEOPLE, FILMS, READY_CHANCE, PER_READY, PERFECT_BONUS, STATES,
    CAST, BLINK_FACE, AWAY_FACE, STATE_LABEL,
    faceFor, rollState, stateDuration, scoreShot, rate, bestIndex
  };
})();
