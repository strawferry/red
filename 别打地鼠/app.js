(function () {
  "use strict";

  const game = window.MoleGame;
  const platform = window.MolePlatform;
  const cards = window.MoleCards;
  const app = document.getElementById("app");
  const home = document.getElementById("home-view");
  const flow = document.getElementById("flow");
  const notice = document.getElementById("notice");
  const bestCard = document.getElementById("best-card");
  const posterLayer = document.getElementById("poster-layer");
  const posterImage = document.getElementById("poster-image");
  const posterActions = document.getElementById("poster-actions");
  const characters = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const store = { version: 1, best: null, plays: 0 };
  let page = "home";
  let lastResult = null;
  let canSave = false;
  let queue = Promise.resolve();
  let notification;
  let poster = null;
  let posterOpener = null;
  let scoreTimer = null;
  let round = null;

  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, character => characters[character]);
  }

  function announce(message) {
    notice.textContent = message;
    notice.hidden = false;
    window.clearTimeout(notification);
    notification = window.setTimeout(() => { notice.hidden = true; }, 4400);
  }

  function save() {
    if (!canSave) return Promise.resolve(false);
    const data = JSON.stringify(store);
    const task = queue.then(() => platform.write(data)).then(() => true, () => false);
    queue = task;
    return task;
  }

  function show(next) {
    page = next;
    render();
    window.scrollTo(0, 0);
  }

  function action(label, name, type, data) {
    return '<button class="button ' + (type || "secondary") + '" type="button" data-action="' + name + '"' +
      (data === undefined ? "" : ' data-value="' + escape(data) + '"') + ">" + escape(label) + "</button>";
  }

  function link(label, name, data, extra) {
    return '<button class="text-button ' + (extra || "") + '" type="button" data-action="' + name + '"' +
      (data === undefined ? "" : ' data-value="' + escape(data) + '"') + ">" + escape(label) + "</button>";
  }

  function layout(back, label, title, content) {
    return '<div class="page"><div class="page-head">' + link("‹ 返回", back, undefined, "back-button") +
      (label ? '<span class="eyebrow">' + escape(label) + "</span>" : "") +
      '</div><h1 class="page-title" tabindex="-1">' + escape(title) + "</h1>" + content + "</div>";
  }

  function renderHome() {
    if (store.best) {
      bestCard.hidden = false;
      bestCard.innerHTML = '<span class="eyebrow">我的最佳纪录</span><strong>' +
        store.best.score + ' 分</strong><span class="note">打中人类 ' + store.best.hits +
        " 个 · 误伤地鼠 " + store.best.misses + " 只 · 已挑战 " + store.plays + " 局</span>";
    } else {
      bestCard.hidden = true;
    }
  }

  function holeMarkup(index) {
    return '<div class="hole" data-hole="' + index + '">' +
      '<div class="target"><span class="bubble"></span>' +
      '<span class="stars" aria-hidden="true">💫</span>' +
      '<span class="face"></span></div>' +
      '<div class="opening"></div><div class="mound"></div></div>';
  }

  function renderPlay() {
    let holes = "";
    for (let i = 0; i < game.HOLES; i++) holes += holeMarkup(i);
    const content =
      '<div class="hud"><div class="time-track" id="time-track"><div class="time-fill" id="time-fill"></div></div>' +
      '<div class="hud-row"><div class="hud-score">分数 <b id="hud-score">0</b></div>' +
      '<div class="hud-combo" id="hud-combo" hidden>🔥 连击 ×<span id="hud-combo-n">0</span></div>' +
      '<div class="hud-time">⏱ <b id="hud-secs">' + game.DURATION + '</b> 秒</div></div></div>' +
      '<div class="field" id="field">' + holes + "</div>" +
      '<p class="note play-tip">🐹 地鼠别打！只打 🧑 人类 —— 打错一只 −15 分</p>' +
      '<div class="trailing">' + link("结束本局", "home") + "</div>";
    return layout("home", "挑战中", "手别抖，眼别花", content);
  }

  function renderResult() {
    const result = lastResult;
    const confetti = result.score >= 200 ?
      '<div class="confetti" aria-hidden="true">' + Array.from({ length: 16 }, (unused, index) => {
        const seed = Math.sin(index * 97.3 + 13.7) * 10000;
        const frac = seed - Math.floor(seed);
        const seed2 = Math.sin(index * 57.9 + 71.3) * 10000;
        const frac2 = seed2 - Math.floor(seed2);
        return '<i style="left:' + (frac * 94 + 2).toFixed(0) + "%;font-size:" + (15 + frac2 * 13).toFixed(0) +
          "px;animation-duration:" + (1.5 + frac2 * 1.3).toFixed(2) + "s;animation-delay:" + (frac * 0.5).toFixed(2) +
          's">' + (index % 3 === 0 ? "🐹" : index % 3 === 1 ? "⭐" : "✨") + "</i>";
      }).join("") + "</div>" : "";
    const isBest = store.best && store.best.stamp === result.stamp;
    const rows = [
      ["打中人类", result.hits + " 个"],
      ["误伤地鼠", result.misses + " 只"],
      ["最高连击", result.maxCombo + " 次"]
    ].map((row, index) =>
      '<div class="sum-row" style="animation-delay:' + (120 + index * 70) + 'ms"><span>' + row[0] +
      "</span><span>" + row[1] + "</span></div>").join("");
    const content =
      '<div class="score-card">' + confetti + '<span class="eyebrow">本局得分</span>' +
      '<div class="scale-number" id="score-number">0</div>' +
      '<p class="note">' + (result.score < 0 ? "地鼠们在洞口开庆功会了" : "45 秒 · 只打人，不打鼠") + "</p></div>" +
      '<h2 class="rate-title">' + escape(result.title) + "</h2>" +
      '<p class="note">' + escape(result.line) + (isBest ? " 🏆 新纪录！" : "") + "</p>" +
      '<div class="record sum-list"><strong>本局战绩</strong>' + rows + "</div>" +
      action("生成成绩卡", "poster-result", "primary") +
      action("再来一局", "start") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "结算", "时间到！", content);
  }

  const templates = { play: renderPlay, result: renderResult };

  function render() {
    const inFlow = page !== "home";
    home.hidden = inFlow;
    flow.hidden = !inFlow;
    if (inFlow) flow.innerHTML = templates[page]();
    else renderHome();
  }

  // ---- Round engine: all in-round updates are local DOM writes. ----

  function stopGame() {
    if (!round) return;
    window.clearInterval(round.tickTimer);
    round.holes.forEach(hole => {
      window.clearTimeout(hole.timer);
      window.clearTimeout(hole.coolTimer);
    });
    round = null;
  }

  function startGame() {
    stopGame();
    lastResult = null;
    show("play");
    round = {
      over: false,
      startedAt: Date.now(),
      nextSpawnAt: Date.now() + 450,
      tickTimer: null,
      lastSecond: game.DURATION,
      stats: { score: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0 },
      holes: []
    };
    for (let i = 0; i < game.HOLES; i++) {
      const cell = flow.querySelector('[data-hole="' + i + '"]');
      round.holes.push({
        state: "idle", role: null, resolved: false, timer: null, coolTimer: null,
        els: {
          cell,
          target: cell.querySelector(".target"),
          face: cell.querySelector(".face"),
          bubble: cell.querySelector(".bubble")
        }
      });
    }
    round.tickTimer = window.setInterval(tick, 100);
  }

  function progress() {
    return Math.min(1, (Date.now() - round.startedAt) / (game.DURATION * 1000));
  }

  function tick() {
    if (!round || round.over) return;
    const now = Date.now();
    const remaining = game.DURATION - (now - round.startedAt) / 1000;
    const secs = Math.max(0, Math.ceil(remaining));
    if (secs !== round.lastSecond) {
      round.lastSecond = secs;
      const secsEl = document.getElementById("hud-secs");
      if (secsEl) secsEl.textContent = secs;
    }
    const fill = document.getElementById("time-fill");
    if (fill) fill.style.width = Math.max(0, remaining / game.DURATION * 100) + "%";
    if (remaining <= 5.05) {
      const track = document.getElementById("time-track");
      if (track) track.classList.add("danger");
    }
    if (remaining <= 0) {
      endRound();
      return;
    }
    if (now >= round.nextSpawnAt) {
      trySpawn();
      round.nextSpawnAt = now + game.spawnInterval(progress()) * (0.75 + Math.random() * 0.5);
    }
  }

  function trySpawn() {
    let count = game.spawnCount(progress(), Math.random);
    while (count > 0) {
      count -= 1;
      if (round.holes.filter(hole => hole.state !== "idle").length >= game.MAX_ACTIVE) break;
      const idle = round.holes.map((hole, index) => hole.state === "idle" ? index : -1).filter(index => index >= 0);
      if (!idle.length) break;
      spawn(idle[Math.floor(Math.random() * idle.length)]);
    }
  }

  function spawn(index) {
    const hole = round.holes[index];
    const role = game.pickRole(Math.random);
    hole.role = role;
    hole.resolved = false;
    hole.state = "up";
    hole.els.face.textContent = game.pickEmoji(role, Math.random);
    hole.els.bubble.textContent = "";
    hole.els.bubble.classList.remove("show");
    hole.els.target.classList.remove("bonk", "dizzy");
    hole.els.target.classList.add("up");
    hole.timer = window.setTimeout(() => retreat(index), game.stayDuration(progress(), Math.random));
  }

  function retreat(index) {
    if (!round) return;
    const hole = round.holes[index];
    if (!hole || hole.state === "idle") return;
    window.clearTimeout(hole.timer);
    hole.state = "leaving";
    hole.els.target.classList.remove("up");
    hole.coolTimer = window.setTimeout(() => {
      hole.state = "idle";
      hole.role = null;
      hole.els.target.classList.remove("bonk", "dizzy");
      hole.els.bubble.classList.remove("show");
    }, 240);
  }

  function floatText(hole, text, kind) {
    const span = document.createElement("span");
    span.className = "float-score " + kind;
    span.textContent = text;
    hole.els.cell.appendChild(span);
    window.setTimeout(() => span.remove(), 850);
  }

  function refreshHud() {
    const stats = round.stats;
    const scoreEl = document.getElementById("hud-score");
    if (scoreEl) {
      scoreEl.textContent = stats.score;
      scoreEl.classList.remove("pop");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("pop");
    }
    const combo = document.getElementById("hud-combo");
    if (combo) {
      combo.hidden = stats.combo < 2;
      const n = document.getElementById("hud-combo-n");
      if (n) n.textContent = stats.combo;
      if (stats.combo > 0 && stats.combo % game.COMBO_EVERY === 0) {
        combo.classList.remove("pulse");
        void combo.offsetWidth;
        combo.classList.add("pulse");
      }
    }
  }

  function hitHole(index) {
    if (!round || round.over) return;
    const hole = round.holes[index];
    if (hole.state !== "up" || hole.resolved) return;
    hole.resolved = true;
    window.clearTimeout(hole.timer);
    const stats = round.stats;
    const outcome = game.hitOutcome(hole.role, stats.combo);
    stats.score += outcome.delta;
    stats.combo = outcome.combo;
    stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
    if (outcome.kind === "hit") {
      stats.hits += 1;
      hole.els.bubble.textContent = outcome.bonus ? "哎哟！连击奖励" : "哎哟！";
      hole.els.bubble.classList.add("show");
      hole.els.target.classList.add("bonk");
      floatText(hole, "+" + outcome.delta, "good");
      window.setTimeout(() => retreat(index), 300);
    } else {
      stats.misses += 1;
      hole.els.bubble.textContent = "打错了！";
      hole.els.bubble.classList.add("show");
      hole.els.target.classList.add("dizzy");
      floatText(hole, String(outcome.delta), "bad");
      const field = document.getElementById("field");
      if (field) {
        field.classList.remove("bad");
        void field.offsetWidth;
        field.classList.add("bad");
      }
      window.setTimeout(() => retreat(index), 620);
    }
    platform.tap();
    refreshHud();
  }

  function endRound() {
    if (!round || round.over) return;
    round.over = true;
    window.clearInterval(round.tickTimer);
    round.holes.forEach((hole, index) => {
      window.clearTimeout(hole.timer);
      if (hole.state === "up") retreat(index);
    });
    const stats = round.stats;
    const rated = game.rate(stats.score, stats.misses);
    lastResult = {
      score: stats.score, hits: stats.hits, misses: stats.misses, maxCombo: stats.maxCombo,
      title: rated.title, line: rated.line, stamp: Date.now()
    };
    store.plays += 1;
    if (!store.best || stats.score > store.best.score) {
      store.best = { score: stats.score, hits: stats.hits, misses: stats.misses, stamp: lastResult.stamp };
    }
    save();
    platform.tap();
    const finished = round;
    window.setTimeout(() => {
      if (round === finished) round = null;
      if (page === "play") {
        show("result");
        animateScore();
      }
    }, 700);
  }

  function animateScore() {
    const el = document.getElementById("score-number");
    if (!el || !lastResult) return;
    const target = lastResult.score;
    const started = Date.now();
    window.clearInterval(scoreTimer);
    scoreTimer = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / 900);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t >= 1) window.clearInterval(scoreTimer);
    }, 40);
  }

  // ---- Poster (same pattern as the other tools) ----

  async function openPoster(button) {
    if (!lastResult) return;
    posterOpener = button;
    button.disabled = true;
    try {
      poster = cards.resultCard(lastResult);
      posterImage.src = poster.toDataURL("image/png");
      posterActions.innerHTML =
        action("保存到相册", "poster-save", "primary") +
        (platform.has("share") ? action("分享成绩卡", "poster-share") : "") +
        (platform.has("postNote") ? action("发成笔记", "poster-note") : "") +
        '<p class="note">把成绩卡发出去，看看谁比你更忍得住手。</p>';
      posterLayer.hidden = false;
      app.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "hidden";
      document.getElementById("poster-close").focus();
    } catch (error) {
      announce("成绩卡没生成出来，请再试一次。");
    } finally {
      button.disabled = false;
    }
  }

  function closePoster() {
    posterLayer.hidden = true;
    posterImage.removeAttribute("src");
    poster = null;
    app.removeAttribute("aria-hidden");
    document.body.style.overflow = "";
    if (posterOpener) posterOpener.focus();
  }

  async function invokeButton(button, invoke, success) {
    button.disabled = true;
    try {
      await invoke();
      if (success) announce(success);
    } catch (error) {
      announce("这一步没成功，请再试一次。");
    } finally {
      button.disabled = false;
    }
  }

  function posterAction(name, button) {
    if (!poster) return;
    if (name === "poster-save") {
      invokeButton(button, () => platform.saveImage(poster), "已保存到相册。");
    } else if (name === "poster-share") {
      invokeButton(button, () => platform.shareImage(poster));
    } else if (name === "poster-note") {
      const title = lastResult.score < 0 ?
        "别打地鼠：我被地鼠保护协会警告了" :
        "别打地鼠：我拿了 " + lastResult.score + " 分";
      const content = "45 秒反向打地鼠，地鼠一只都不能打、只打混进来的人。我打中 " +
        lastResult.hits + " 个人、误伤 " + lastResult.misses + " 只地鼠，评级：" +
        lastResult.title + "。你也来试试？";
      invokeButton(button, () => platform.openNote(poster, title, content));
    }
  }

  const actions = {
    home: () => { stopGame(); show("home"); },
    start: startGame,
    "poster-result": (value, button) => openPoster(button)
  };

  function recover(data) {
    if (!data) return;
    if (data.version !== 1) throw new Error("记录格式不匹配");
    store.plays = Number.isFinite(data.plays) ? data.plays : 0;
    if (data.best && Number.isFinite(data.best.score)) {
      store.best = {
        score: data.best.score,
        hits: Number.isFinite(data.best.hits) ? data.best.hits : 0,
        misses: Number.isFinite(data.best.misses) ? data.best.misses : 0,
        stamp: data.best.stamp || 0
      };
    }
  }

  async function boot() {
    try {
      const stored = await platform.read();
      canSave = stored.supported;
      recover(stored.data);
    } catch (error) {
      canSave = false;
    }
    document.getElementById("boot-status").hidden = true;
    document.querySelectorAll("button[disabled]").forEach(button => { button.disabled = false; });
    renderHome();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest && event.target.closest("button[data-action]");
    if (!button || button.disabled || (!posterLayer.hidden && !posterLayer.contains(button))) return;
    const name = button.dataset.action;
    if (name.startsWith("poster-") && name !== "poster-result") posterAction(name, button);
    else if (actions[name]) actions[name](button.dataset.value, button);
  });
  document.addEventListener("pointerdown", event => {
    if (page !== "play" || !round || round.over) return;
    const cell = event.target.closest && event.target.closest("[data-hole]");
    if (cell) hitHole(Number(cell.dataset.hole));
  });
  document.getElementById("poster-close").addEventListener("click", closePoster);
  posterLayer.addEventListener("click", event => { if (event.target === posterLayer) closePoster(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !posterLayer.hidden) closePoster();
  });
  window.addEventListener("resize", platform.refreshInsets);
  platform.init().then(boot);
})();
