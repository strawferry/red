(function () {
  "use strict";

  const game = window.FriesGame;
  const platform = window.FriesPlatform;
  const cards = window.FriesCards;
  const app = document.getElementById("app");
  const home = document.getElementById("home-view");
  const flow = document.getElementById("flow");
  const notice = document.getElementById("notice");
  const bestCard = document.getElementById("best-card");
  const posterLayer = document.getElementById("poster-layer");
  const posterImage = document.getElementById("poster-image");
  const posterActions = document.getElementById("poster-actions");
  const characters = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const store = { version: 1, best: null, draws: 0, last: null };
  let page = "home";
  let lastResult = null;
  let canSave = false;
  let queue = Promise.resolve();
  let notification;
  let poster = null;
  let posterOpener = null;
  let lenTimer = null;
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
      bestCard.innerHTML = '<span class="eyebrow">我抽到过的最长薯条</span><strong>' +
        store.best.len.toFixed(1) + ' cm · ' + escape(store.best.tier) + '</strong><span class="note">已抽 ' +
        store.draws + " 次签 · 上次 " + (store.last ? store.last.len.toFixed(1) + " cm " + escape(store.last.tier) : "—") + "</span>";
    } else {
      bestCard.hidden = true;
    }
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

  // ---- Draw page: a striped tube with STICKS fry tips to pull ----

  const STICK_HEIGHTS = [92, 112, 84, 102, 90, 116, 86]; // visible tip heights, px

  function renderDraw() {
    // Sticks live inside a .sticks box exactly as wide as the tube (252px),
    // so the left % below is relative to the tube width, not the stage:
    // every stick stays within the tube's inner span (about 7px padding on
    // each side). Height = visible tip + 130px hidden behind the tube front
    // (sticks sit 20px above the stage floor, tube front is 150px tall).
    let sticks = "";
    for (let i = 0; i < game.STICKS; i++) {
      sticks += '<div class="stick" data-stick="' + i + '" style="left:' + (2.8 + i * 13.5).toFixed(1) +
        "%;height:" + (STICK_HEIGHTS[i] + 130) + 'px"><span class="stick-tip"></span></div>';
    }
    const content =
      '<div class="tube-stage" id="tube-stage"><div class="sticks">' + sticks + '</div>' +
      '<div class="tube-body"><span class="tube-label">薯条签</span><span class="tube-sub">FRIES FORTUNE</span></div>' +
      '<div class="salt-box" id="salt-box"></div></div>' +
      '<p class="note play-tip">按住一根薯条，往上拖出来。拖不动？换一根，或者——</p>' +
      action("帮我抽一根", "auto", "primary") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "抽签中 · 筒里 " + game.STICKS + " 根", "今天，哪根最旺你？", content);
  }

  function renderReveal() {
    const r = lastResult;
    const pct = (r.len / 15 * 100).toFixed(1);
    const content =
      '<div class="board-wrap">' + (r.level >= 4 ? confetti("🍟") : "") +
      '<div class="board"><div class="board-fry" style="width:' + pct + '%"><span class="board-fry-end"></span></div>' +
      '<div class="ruler"><span class="tick-label" style="left:0%">0</span>' +
      '<span class="tick-label" style="left:33.3%">5</span>' +
      '<span class="tick-label" style="left:66.7%">10</span>' +
      '<span class="tick-label" style="left:100%">15 cm</span></div></div></div>' +
      '<div class="len-score"><span class="eyebrow">这根薯条的长度</span>' +
      '<div class="scale-number"><span id="len-number">0.0</span><small> cm</small></div>' +
      '<p class="note">比 ' + r.pct + '% 的薯条都长（趣味换算）</p></div>' +
      '<div class="fortune-card"><span class="tier-badge tier-' + r.level + '">' + escape(r.tier) + "</span>" +
      '<p class="fortune-text">「' + escape(r.fortune) + '」</p>' +
      '<p class="fortune-explain">' + escape(r.explain) + "</p>" +
      '<div class="lucky-row"><span>幸运物 · <strong>' + escape(r.item) + "</strong></span>" +
      "<span>幸运色 · <strong>" + escape(r.color) + "</strong></span></div></div>" +
      action("生成签文卡", "poster-result", "primary") +
      action("再抽一根", "start") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "揭晓 · 第 " + store.draws + " 抽", r.level >= 4 ? "好长一根！" : "你的签来了", content);
  }

  const templates = { draw: renderDraw, reveal: renderReveal };

  function render() {
    const inFlow = page !== "home";
    home.hidden = inFlow;
    flow.hidden = !inFlow;
    if (inFlow) {
      flow.innerHTML = templates[page]();
      if (page === "draw") bindSticks();
    } else renderHome();
  }

  // ---- Draw session ----

  function startSession() {
    session = {
      lengths: Array.from({ length: game.STICKS }, () => game.drawLength(Math.random)),
      pulled: -1,
      drag: null
    };
    show("draw");
  }

  function bindSticks() {
    flow.querySelectorAll(".stick").forEach(stick => {
      stick.addEventListener("pointerdown", onStickDown);
    });
  }

  function onStickDown(event) {
    if (!session || session.pulled >= 0) return;
    const stick = event.currentTarget;
    const index = Number(stick.dataset.stick);
    session.drag = { index, el: stick, startY: event.clientY, dy: 0, id: event.pointerId };
    stick.classList.add("dragging");
    if (stick.setPointerCapture) {
      try { stick.setPointerCapture(event.pointerId); } catch (error) { /* capture is a nicety */ }
    }
    stick.addEventListener("pointermove", onStickMove);
    stick.addEventListener("pointerup", onStickUp);
    stick.addEventListener("pointercancel", onStickUp);
    event.preventDefault();
  }

  function onStickMove(event) {
    const drag = session && session.drag;
    if (!drag || event.pointerId !== drag.id) return;
    drag.dy = Math.max(0, Math.min(190, drag.startY - event.clientY));
    drag.el.style.transform = "translateY(" + (-drag.dy) + "px) rotate(" + (drag.dy * 0.02 - 1) + "deg)";
  }

  function onStickUp(event) {
    const drag = session && session.drag;
    if (!drag || event.pointerId !== drag.id) return;
    const stick = drag.el;
    stick.removeEventListener("pointermove", onStickMove);
    stick.removeEventListener("pointerup", onStickUp);
    stick.removeEventListener("pointercancel", onStickUp);
    stick.classList.remove("dragging");
    const pulled = drag.dy >= game.PULL_THRESHOLD;
    const index = drag.index;
    session.drag = null;
    if (pulled) completePull(index, stick);
    else {
      stick.classList.add("settle");
      stick.style.transform = "";
      window.setTimeout(() => stick.classList.remove("settle"), 380);
    }
  }

  function saltBurst(stick) {
    const box = document.getElementById("salt-box");
    if (!box) return;
    const stage = document.getElementById("tube-stage");
    const stageRect = stage.getBoundingClientRect();
    const rect = stick.getBoundingClientRect();
    const cx = rect.left - stageRect.left + rect.width / 2;
    let html = "";
    for (let i = 0; i < 12; i++) {
      const seed = Math.sin(i * 61.7 + cx) * 10000;
      const frac = seed - Math.floor(seed);
      const seed2 = Math.sin(i * 33.1 + 7.7) * 10000;
      const frac2 = seed2 - Math.floor(seed2);
      html += '<i class="salt" style="left:' + (cx + (frac - 0.5) * 90).toFixed(0) + "px;top:" +
        (40 + frac2 * 30).toFixed(0) + "px;animation-delay:" + (frac * 0.12).toFixed(2) + 's"></i>';
    }
    box.innerHTML = html;
  }

  function completePull(index, stick) {
    if (!session || session.pulled >= 0) return;
    session.pulled = index;
    stick.classList.add("pulled");
    stick.style.transform = "";
    saltBurst(stick);
    platform.tap();
    const result = game.makeResult(session.lengths[index], Math.random);
    window.setTimeout(() => {
      lastResult = result;
      store.draws += 1;
      if (!store.best || result.len > store.best.len) {
        store.best = { len: result.len, tier: result.tier, stamp: result.stamp };
      }
      store.last = {
        len: result.len, tier: result.tier, fortune: result.fortune,
        explain: result.explain, item: result.item, color: result.color, stamp: result.stamp
      };
      save();
      session = null;
      show("reveal");
      animateLength(result.len);
      platform.tap();
    }, 820);
  }

  function autoPull() {
    if (!session || session.pulled >= 0) return;
    const index = Math.floor(Math.random() * game.STICKS);
    const stick = flow.querySelector('[data-stick="' + index + '"]');
    if (stick) completePull(index, stick);
  }

  function animateLength(target) {
    const el = document.getElementById("len-number");
    if (!el) return;
    const started = Date.now();
    window.clearInterval(lenTimer);
    lenTimer = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / 950);
      el.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(1);
      if (t >= 1) window.clearInterval(lenTimer);
    }, 40);
  }

  // ---- Poster (same pattern as the other tools) ----

  async function openPoster(button) {
    if (!lastResult) return;
    posterOpener = button;
    button.disabled = true;
    try {
      poster = cards.fortuneCard(lastResult);
      posterImage.src = poster.toDataURL("image/png");
      posterActions.innerHTML =
        action("保存到相册", "poster-save", "primary") +
        (platform.has("share") ? action("分享签文卡", "poster-share") : "") +
        (platform.has("postNote") ? action("发成笔记", "poster-note") : "") +
        '<p class="note">把签文卡发出去，看看谁抽的薯条更长。</p>';
      posterLayer.hidden = false;
      app.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "hidden";
      document.getElementById("poster-close").focus();
    } catch (error) {
      announce("签文卡没生成出来，请再试一次。");
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
      const title = "薯条签：我抽到 " + lastResult.len.toFixed(1) + "cm 的" + lastResult.tier;
      const content = "摇一摇薯条签筒，抽出一根 " + lastResult.len.toFixed(1) + "cm 的薯条，" +
        lastResult.tier + "：「" + lastResult.fortune + "」幸运物是" + lastResult.item +
        "，幸运色是" + lastResult.color + "。你今天抽到多长？";
      invokeButton(button, () => platform.openNote(poster, title, content));
    }
  }

  const actions = {
    home: () => { session = null; show("home"); },
    start: startSession,
    auto: autoPull,
    "poster-result": (value, button) => openPoster(button)
  };

  function recover(data) {
    if (!data) return;
    if (data.version !== 1) throw new Error("记录格式不匹配");
    store.draws = Number.isFinite(data.draws) ? data.draws : 0;
    if (data.best && Number.isFinite(data.best.len)) {
      store.best = {
        len: data.best.len,
        tier: typeof data.best.tier === "string" ? data.best.tier : "",
        stamp: data.best.stamp || 0
      };
    }
    if (data.last && Number.isFinite(data.last.len)) {
      store.last = data.last;
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
