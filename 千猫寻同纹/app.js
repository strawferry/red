(function () {
  "use strict";

  const game = window.CatsGame;
  const platform = window.CatsPlatform;
  const cards = window.CatsCards;
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
  let session = null;

  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => characters[character]);
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

  // One cat's visual: coat disc + face emoji, forehead mark and collar overlays.
  // The same markup serves grid cells (small), the target card and the result (big).
  function catMarkup(cat) {
    let mark = "";
    if (cat.mark === 1) mark = '<span class="cv-mark mark-bars"><i></i><i></i><i></i></span>';
    else if (cat.mark === 2) mark = '<span class="cv-mark mark-dot">●</span>';
    else if (cat.mark === 3) mark = '<span class="cv-mark mark-heart">♥</span>';
    else if (cat.mark === 4) mark = '<span class="cv-mark mark-bolt">⚡</span>';
    const collar = cat.collar > 0 ? '<span class="cv-collar collar-' + cat.collar + '"></span>' : "";
    return '<span class="cv coat-' + cat.coat + '"><span class="cv-disc"></span>' +
      '<span class="cv-face">' + game.faceFor(cat) + "</span>" + mark + collar + "</span>";
  }

  function chips(cat) {
    const items = [
      ["毛色", game.COATS[cat.coat].name],
      ["额纹", game.MARKS[cat.mark].name],
      ["眼睛", game.EYES[cat.eyes].name],
      ["项圈", game.COLLARS[cat.collar].name]
    ];
    return '<div class="chips">' + items.map(item =>
      '<span class="chip">' + item[0] + " · " + escape(item[1]) + "</span>").join("") + "</div>";
  }

  function confetti(emoji) {
    return '<div class="confetti" aria-hidden="true">' + Array.from({ length: 16 }, (unused, index) => {
      const seed = Math.sin(index * 97.3 + 13.7) * 10000;
      const frac = seed - Math.floor(seed);
      const seed2 = Math.sin(index * 57.9 + 71.3) * 10000;
      const frac2 = seed2 - Math.floor(seed2);
      return '<i style="left:' + (frac * 94 + 2).toFixed(0) + "%;font-size:" + (15 + frac2 * 13).toFixed(0) +
        "px;animation-duration:" + (1.5 + frac2 * 1.3).toFixed(2) + "s;animation-delay:" + (frac * 0.5).toFixed(2) +
        's">' + (index % 3 === 0 ? emoji : index % 3 === 1 ? "⭐" : "✨") + "</i>";
    }).join("") + "</div>";
  }

  function renderHome() {
    if (store.best) {
      bestCard.hidden = false;
      bestCard.innerHTML = '<span class="eyebrow">我的最快成绩</span><strong>' +
        game.formatTime(store.best.score) + '</strong><span class="note">评级「' + escape(store.best.title) +
        "」 · 已完成 " + store.plays + " 局</span>";
    } else {
      bestCard.hidden = true;
    }
  }

  function renderGame() {
    const board = session.board;
    let cats = "";
    board.cats.forEach((cat, index) => {
      cats += '<button class="cat" type="button" data-action="cat" data-value="' + index +
        '" aria-label="第 ' + (index + 1) + ' 只猫">' + catMarkup(cat) + "</button>";
    });
    const content =
      '<div class="target-bar"><div class="target-main"><div class="target-cat">' + catMarkup(board.target) +
      '</div><div class="target-info"><span class="eyebrow">目标猫 · 四处特征全对上</span>' +
      chips(board.target) + "</div></div>" +
      '<div class="stat-row"><span>⏱ <b id="stat-time">0.0 秒</b></span>' +
      '<span>点错 <b id="stat-wrong">0</b> 次 · 罚时 <b id="stat-penalty">0</b> 秒</span></div></div>' +
      '<div class="cat-grid">' + cats + "</div>" +
      '<p class="note play-tip">慢慢翻，逐项核对：毛色、额纹、眼睛、项圈，四处都一样才是它。</p>' +
      '<div class="trailing">' + link("放弃本局", "home") + "</div>";
    return layout("home", "找猫中 · 180 只猫", "找出同纹的那只", content);
  }

  function renderResult() {
    const result = lastResult;
    const isBest = store.best && store.best.stamp === result.stamp;
    const row = Math.floor(result.targetIndex / game.COLS) + 1;
    const col = result.targetIndex % game.COLS + 1;
    const rows = [
      ["实际用时", game.formatTime(result.elapsed)],
      ["点错罚时", "+" + result.penalty + " 秒（点错 " + result.wrongs + " 次）"],
      ["藏身位置", "第 " + row + " 行第 " + col + " 只"]
    ].map((item, index) =>
      '<div class="sum-row" style="animation-delay:' + (120 + index * 70) + 'ms"><span>' + item[0] +
      "</span><span>" + item[1] + "</span></div>").join("");
    const content =
      '<div class="score-card">' + (result.score < 60 ? confetti("🐱") : "") +
      '<span class="eyebrow">成绩时间</span>' +
      '<div class="scale-number" id="score-number">0.0</div>' +
      '<p class="note">实际用时 + 点错罚时</p></div>' +
      '<h2 class="rate-title">' + escape(result.title) + "</h2>" +
      '<p class="note">' + escape(result.line) + (isBest ? " 🏆 新纪录！" : "") + "</p>" +
      '<div class="found-card"><div class="target-cat">' + catMarkup(result.target) + "</div>" +
      '<div class="target-info"><span class="eyebrow">就是这只</span>' + chips(result.target) + "</div></div>" +
      '<div class="record sum-list"><strong>本局战绩</strong>' + rows + "</div>" +
      action("生成成绩卡", "poster-result", "primary") +
      action("再来一局", "start") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "结算", "找到了！", content);
  }

  const templates = { game: renderGame, result: renderResult };

  function render() {
    const inFlow = page !== "home";
    home.hidden = inFlow;
    flow.hidden = !inFlow;
    if (inFlow) flow.innerHTML = templates[page]();
    else renderHome();
  }

  // ---- Session: a 100ms ticker drives only the clock text. ----

  function stopSession() {
    if (!session) return;
    window.clearInterval(session.timer);
    session = null;
  }

  function startSession() {
    stopSession();
    lastResult = null;
    session = {
      board: game.generateBoard(Math.random),
      startedAt: Date.now(),
      wrongs: 0,
      timer: null,
      done: false
    };
    show("game");
    session.timer = window.setInterval(tickClock, 100);
  }

  function tickClock() {
    if (!session || page !== "game") return;
    const el = document.getElementById("stat-time");
    if (el) el.textContent = game.formatTime((Date.now() - session.startedAt) / 1000);
  }

  function tapCat(index, button) {
    if (!session || session.done || page !== "game") return;
    if (index === session.board.targetIndex) {
      finishGame(button);
      return;
    }
    session.wrongs += 1;
    button.disabled = true;
    button.classList.add("wrong");
    button.setAttribute("aria-label", "不是这只");
    platform.tap();
    const wrongEl = document.getElementById("stat-wrong");
    if (wrongEl) wrongEl.textContent = session.wrongs;
    const penaltyEl = document.getElementById("stat-penalty");
    if (penaltyEl) penaltyEl.textContent = session.wrongs * game.PENALTY;
  }

  function finishGame(button) {
    session.done = true;
    window.clearInterval(session.timer);
    if (button) button.classList.add("found");
    platform.tap();
    const elapsed = (Date.now() - session.startedAt) / 1000;
    const penalty = session.wrongs * game.PENALTY;
    const score = elapsed + penalty;
    const rated = game.rate(score);
    lastResult = {
      target: session.board.target,
      targetIndex: session.board.targetIndex,
      elapsed: Math.round(elapsed * 10) / 10,
      wrongs: session.wrongs,
      penalty,
      score: Math.round(score * 10) / 10,
      title: rated.title,
      line: rated.line,
      stamp: Date.now()
    };
    store.plays += 1;
    if (!store.best || lastResult.score < store.best.score) {
      store.best = {
        score: lastResult.score, title: rated.title, stamp: lastResult.stamp
      };
    }
    save();
    const done = session;
    window.setTimeout(() => {
      if (session === done) {
        session = null;
        show("result");
        animateScore(lastResult.score);
      }
    }, 550);
  }

  function animateScore(target) {
    const el = document.getElementById("score-number");
    if (!el) return;
    const started = Date.now();
    window.clearInterval(scoreTimer);
    scoreTimer = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / 900);
      const value = target * (1 - Math.pow(1 - t, 3));
      el.textContent = game.formatTime(value).replace(" 秒", "");
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
        '<p class="note">把成绩卡发出去，看看谁找得更快。</p>';
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
      const title = "千猫寻同纹：180 只猫找同纹，我的成绩 " + game.formatTime(lastResult.score);
      const content = "一大群端坐的猫里，只有一只和目标花纹完全一样：毛色、额纹、眼睛、项圈四处全对上。" +
        "我找了 " + game.formatTime(lastResult.elapsed) + "，点错 " + lastResult.wrongs + " 次，成绩 " +
        game.formatTime(lastResult.score) + "，评级：" + lastResult.title + "。你能比我快吗？";
      invokeButton(button, () => platform.openNote(poster, title, content));
    }
  }

  const actions = {
    home: () => { stopSession(); show("home"); },
    start: startSession,
    cat: (value, button) => tapCat(Number(value), button),
    "poster-result": (value, button) => openPoster(button)
  };

  function recover(data) {
    if (!data) return;
    if (data.version !== 1) throw new Error("记录格式不匹配");
    store.plays = Number.isFinite(data.plays) ? data.plays : 0;
    if (data.best && Number.isFinite(data.best.score)) {
      store.best = {
        score: data.best.score,
        title: typeof data.best.title === "string" ? data.best.title : "",
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
  document.getElementById("poster-close").addEventListener("click", closePoster);
  posterLayer.addEventListener("click", event => { if (event.target === posterLayer) closePoster(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !posterLayer.hidden) closePoster();
  });
  window.addEventListener("resize", platform.refreshInsets);
  platform.init().then(boot);
})();
