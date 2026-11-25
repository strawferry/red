(function () {
  "use strict";

  const game = window.PhotoGame;
  const platform = window.PhotoPlatform;
  const cards = window.PhotoCards;
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
      bestCard.innerHTML = '<span class="eyebrow">我的最佳照片</span><strong>' +
        store.best.score + ' 分</strong><span class="note">最佳评级「' + escape(store.best.title) +
        "」 · 已拍 " + store.plays + " 局</span>";
    } else {
      bestCard.hidden = true;
    }
  }

  // One friend's markup; used live (with data-person) and frozen in polaroids.
  function personMarkup(index, state, frozen) {
    const person = game.CAST[index];
    const tag = state === "ready" ? "" : game.STATE_LABEL[state];
    return '<div class="person st-' + state + '"' + (frozen ? "" : ' data-person="' + index + '"') + ">" +
      '<div class="p-inner"><span class="p-face">' + game.faceFor(index, state) + "</span>" +
      '<span class="p-body"></span></div>' +
      '<span class="p-name">' + escape(person.name) + "</span>" +
      '<span class="p-tag">' + escape(tag) + "</span></div>";
  }

  function filmDots(used) {
    let dots = "";
    for (let i = 0; i < game.FILMS; i++) {
      dots += '<span class="film-dot' + (i < used ? " used" : "") + '">' + (i < used ? "▣" : "▢") + "</span>";
    }
    return '<div class="film-row"><span class="film-label">胶片</span>' + dots +
      '<span class="film-count">' + (game.FILMS - used) + " 张</span></div>";
  }

  function renderShoot() {
    let people = "";
    for (let i = 0; i < game.PEOPLE; i++) people += personMarkup(i, session.people[i].state, false);
    const content =
      '<div class="viewfinder" id="viewfinder"><span class="vf-corner tl"></span><span class="vf-corner tr"></span>' +
      '<span class="vf-corner bl"></span><span class="vf-corner br"></span>' +
      '<span class="vf-rec"><i></i>REC</span>' +
      '<div class="scene"><div class="row">' + people + "</div></div>" +
      '<div class="flash" id="flash"></div></div>' +
      filmDots(session.shots.length) +
      '<button class="shutter" type="button" data-action="shoot" aria-label="拍照"><span></span></button>' +
      '<p class="note play-tip">等 6 个人全都 😀 看镜头，再按快门！</p>' +
      '<div class="trailing">' + link("结束本局", "home") + "</div>";
    return layout("home", "拍摄中 · 第 " + (session.shots.length + 1) + " 张", "盯紧他们，别眨眼", content);
  }

  function flawTags(shot) {
    const tags = [];
    shot.states.forEach((state, index) => {
      if (state !== "ready") {
        tags.push('<span class="flaw-tag">' + escape(game.CAST[index].name) + " " + escape(game.STATE_LABEL[state]) + "</span>");
      }
    });
    return tags.length ? '<div class="flaw-row">' + tags.join("") + "</div>" :
      '<div class="flaw-row"><span class="flaw-tag ok">全员就绪，完美！</span></div>';
  }

  function polaroid(shot, extraClass) {
    let people = "";
    shot.states.forEach((state, index) => { people += personMarkup(index, state, true); });
    return '<div class="polaroid ' + (extraClass || "") + '"><div class="pola-scene"><div class="row small">' +
      people + '</div></div><div class="pola-caption"><strong>' + shot.score + ' 分</strong><span>' +
      shot.ready + "/6 就绪</span></div></div>";
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

  function renderShot() {
    const shot = session.shots[session.shots.length - 1];
    const last = session.shots.length >= game.FILMS;
    const content =
      '<div class="shot-wrap">' + (shot.perfect ? confetti("📸") : "") + polaroid(shot, "big") + "</div>" +
      '<div class="shot-score"><span class="eyebrow">这张得分</span>' +
      '<div class="scale-number" id="score-number">0</div></div>' +
      flawTags(shot) +
      (last ? action("看结算", "finish", "primary") : action("拍下一张", "next", "primary")) +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "第 " + session.shots.length + " 张 · 已用 " + session.shots.length + "/" + game.FILMS + " 张胶片",
      shot.perfect ? "完美合影！" : "咔嚓！定格了", content);
  }

  function renderResult() {
    const result = lastResult;
    const best = result.shots[result.bestIdx];
    const isBest = store.best && store.best.stamp === result.stamp;
    const rows = [
      ["最佳照片", result.score + " 分（第 " + (result.bestIdx + 1) + " 张）"],
      ["完美合影", result.perfects + " 次"],
      ["五张平均", Math.round(result.shots.reduce((sum, s) => sum + s.score, 0) / result.shots.length) + " 分"]
    ].map((row, index) =>
      '<div class="sum-row" style="animation-delay:' + (120 + index * 70) + 'ms"><span>' + row[0] +
      "</span><span>" + row[1] + "</span></div>").join("");
    const gallery = result.shots.map((shot, index) =>
      '<div class="thumb' + (index === result.bestIdx ? " best" : "") + '">' + polaroid(shot, "mini") +
      (index === result.bestIdx ? '<span class="thumb-badge">⭐ 最佳</span>' : "") + "</div>").join("");
    const content =
      '<div class="score-card">' + (result.score >= 100 ? confetti("📸") : "") +
      '<span class="eyebrow">最佳照片得分</span>' +
      '<div class="scale-number" id="score-number">0</div>' +
      '<p class="note">5 张胶片 · 取最佳一张</p></div>' +
      '<h2 class="rate-title">' + escape(result.title) + "</h2>" +
      '<p class="note">' + escape(result.line) + (isBest ? " 🏆 新纪录！" : "") + "</p>" +
      polaroid(best, "big result-best") + flawTags(best) +
      '<div class="record sum-list"><strong>本局战绩</strong>' + rows + "</div>" +
      '<strong class="gallery-title">胶片画廊</strong><div class="gallery">' + gallery + "</div>" +
      action("生成成绩卡", "poster-result", "primary") +
      action("再来一局", "start") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "结算", "胶片洗出来了", content);
  }

  const templates = { shoot: renderShoot, shot: renderShot, result: renderResult };

  function render() {
    const inFlow = page !== "home";
    home.hidden = inFlow;
    flow.hidden = !inFlow;
    if (inFlow) flow.innerHTML = templates[page]();
    else renderHome();
  }

  // ---- Session engine: a 120ms tick rolls states; only changed people re-render. ----

  function stopSession() {
    if (!session) return;
    window.clearInterval(session.tickTimer);
    session = null;
  }

  function startSession() {
    stopSession();
    lastResult = null;
    const now = Date.now();
    session = {
      shots: [],
      tickTimer: null,
      people: game.CAST.map((person, index) => ({
        state: game.rollState(Math.random),
        expiresAt: now + 400 + index * 220 + Math.random() * 700
      }))
    };
    show("shoot");
    bindPeople();
    session.tickTimer = window.setInterval(tick, 120);
  }

  function bindPeople() {
    session.people.forEach((person, index) => {
      person.el = flow.querySelector('[data-person="' + index + '"]');
    });
  }

  function paintPerson(index) {
    const person = session.people[index];
    if (!person.el) return;
    const state = person.state;
    person.el.className = "person st-" + state;
    person.el.querySelector(".p-face").textContent = game.faceFor(index, state);
    person.el.querySelector(".p-tag").textContent = state === "ready" ? "" : game.STATE_LABEL[state];
  }

  function tick() {
    if (!session || page !== "shoot") return;
    const now = Date.now();
    session.people.forEach((person, index) => {
      if (now >= person.expiresAt) {
        const next = game.rollState(Math.random);
        person.expiresAt = now + game.stateDuration(Math.random);
        if (next !== person.state) {
          person.state = next;
          paintPerson(index);
        }
      }
    });
  }

  function takeShot() {
    if (!session || page !== "shoot") return;
    const states = session.people.map(person => person.state);
    const scored = game.scoreShot(states);
    session.shots.push({
      states, score: scored.score, ready: scored.ready, perfect: scored.perfect, stamp: Date.now()
    });
    platform.tap();
    const flash = document.getElementById("flash");
    if (flash) {
      flash.classList.remove("go");
      void flash.offsetWidth;
      flash.classList.add("go");
    }
    const vf = document.getElementById("viewfinder");
    if (vf) {
      vf.classList.remove("snap");
      void vf.offsetWidth;
      vf.classList.add("snap");
    }
    window.clearInterval(session.tickTimer);
    const done = session;
    window.setTimeout(() => {
      if (session === done && page === "shoot") {
        show("shot");
        animateScore(session.shots[session.shots.length - 1].score);
      }
    }, 620);
  }

  function nextShot() {
    const now = Date.now();
    session.people.forEach((person, index) => {
      person.expiresAt = now + 300 + index * 160 + Math.random() * 600;
    });
    show("shoot");
    bindPeople();
    session.people.forEach((person, index) => paintPerson(index));
    window.clearInterval(session.tickTimer);
    session.tickTimer = window.setInterval(tick, 120);
  }

  function finish() {
    if (!session) return;
    const shots = session.shots;
    const bestIdx = game.bestIndex(shots);
    const best = shots[bestIdx];
    const rated = game.rate(best.score);
    lastResult = {
      score: best.score, title: rated.title, line: rated.line,
      shots, bestIdx, perfects: shots.filter(shot => shot.perfect).length,
      stamp: Date.now()
    };
    store.plays += 1;
    if (!store.best || best.score > store.best.score) {
      store.best = { score: best.score, title: rated.title, stamp: lastResult.stamp };
    }
    save();
    stopSession();
    show("result");
    animateScore(lastResult.score);
  }

  function animateScore(target) {
    const el = document.getElementById("score-number");
    if (!el) return;
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
        '<p class="note">把成绩卡发出去，看看谁的朋友更难带。</p>';
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
      const title = lastResult.score >= 100 ?
        "合影抓拍：我拍出了满分完美合影！" :
        "合影抓拍：我最好的照片拿了 " + lastResult.score + " 分";
      const content = "6 个朋友合影，每个人都在乱动：眨眼、看别处、蹲下躲镜头。我用 5 张胶片抓拍，最好的那张 " +
        lastResult.score + " 分，评级：" + lastResult.title + "。你能拍出满分合影吗？";
      invokeButton(button, () => platform.openNote(poster, title, content));
    }
  }

  const actions = {
    home: () => { stopSession(); show("home"); },
    start: startSession,
    shoot: takeShot,
    next: nextShot,
    finish,
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
