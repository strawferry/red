(function () {
  "use strict";

  const game = window.CoinGame;
  const platform = window.CoinPlatform;
  const cards = window.CoinCards;
  const app = document.getElementById("app");
  const home = document.getElementById("home-view");
  const flow = document.getElementById("flow");
  const notice = document.getElementById("notice");
  const bestCard = document.getElementById("best-card");
  const posterLayer = document.getElementById("poster-layer");
  const posterImage = document.getElementById("poster-image");
  const posterActions = document.getElementById("poster-actions");
  const characters = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const store = { version: 1, bestMm: null, plays: 0 };
  let page = "home";
  let tries = [];
  let lastResult = null;
  let canSave = false;
  let queue = Promise.resolve();
  let notification;
  let poster = null;
  let posterOpener = null;

  // Play-session state (not persisted).
  let phase = "ready"; // ready | dragging | sliding | falling | settling | done
  let coinX = game.COIN_START;
  let coinAngle = 0;
  let drag = null;
  let rafId = null;

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
    return '<div class="page">' + link("‹ 返回", back, undefined, "back-button") +
      (label ? '<span class="eyebrow">' + escape(label) + "</span>" : "") +
      '<h1 class="page-title" tabindex="-1">' + escape(title) + "</h1>" + content + "</div>";
  }

  function renderHome() {
    if (store.bestMm !== null) {
      bestCard.hidden = false;
      bestCard.innerHTML = '<span class="eyebrow">我的最佳纪录</span><strong>离桌沿 ' +
        store.bestMm + ' 毫米</strong><span class="note">已挑战 ' + store.plays + " 局 · 差一点就掉下去的那种刺激</span>";
    } else {
      bestCard.hidden = true;
    }
  }

  function dotsHtml() {
    let html = "";
    for (let i = 0; i < game.ATTEMPTS; i++) {
      let cls = "dot";
      if (i < tries.length) cls += tries[i].fell ? " fell" : " used";
      else if (i === tries.length) cls += " now";
      html += '<span class="' + cls + '"></span>';
    }
    return html;
  }

  function renderPlay() {
    const content =
      '<div class="attempts" id="attempts">' + dotsHtml() +
      '<span class="attempts-label">第 ' + Math.min(tries.length + 1, game.ATTEMPTS) + " 次机会（共 " + game.ATTEMPTS + " 次）</span></div>" +
      '<div class="stage" id="stage">' +
      '<span class="stage-cloud c1" aria-hidden="true">☁️</span><span class="stage-cloud c2" aria-hidden="true">☁️</span>' +
      '<div class="edge-line" aria-hidden="true"></div>' +
      '<div class="edge-marker" aria-hidden="true">桌沿<br>▼</div>' +
      '<div class="table"></div><div class="table-leg l1"></div><div class="table-leg l2"></div>' +
      '<div class="drag-arrow" id="drag-arrow" aria-hidden="true">按住硬币，往右滑 →</div>' +
      '<div class="coin ready" id="coin"><span class="coin-face">¥</span></div>' +
      '<div class="verdict" id="verdict" hidden></div>' +
      "</div>" +
      '<div class="power-wrap"><div class="power-track"><div class="power-fill" id="power-fill"></div></div>' +
      '<div class="power-label"><span>力度</span><span id="power-text">按住硬币往右滑，松手发射</span></div></div>' +
      '<div class="try-list" id="try-list"></div>' +
      '<p class="note stage-hint">滑得越快、越远，硬币冲得越猛。目标：停在桌沿边上，别掉下去。</p>' +
      '<div class="trailing">' + link("重新开始本局", "start") + link("回首页", "home") + "</div>";
    return layout("home", "挑战中", "手别抖，滑！", content);
  }

  function confettiHtml(chars) {
    return '<div class="confetti" aria-hidden="true">' + Array.from({ length: 16 }, (unused, index) => {
      const seed = Math.sin(index * 97.3 + 13.7) * 10000;
      const frac = seed - Math.floor(seed);
      const seed2 = Math.sin(index * 57.9 + 71.3) * 10000;
      const frac2 = seed2 - Math.floor(seed2);
      return '<i style="left:' + (frac * 94 + 2).toFixed(0) + "%;font-size:" + (15 + frac2 * 13).toFixed(0) +
        "px;animation-duration:" + (1.5 + frac2 * 1.3).toFixed(2) + "s;animation-delay:" + (frac * 0.5).toFixed(2) +
        's">' + chars[index % chars.length] + "</i>";
    }).join("") + "</div>";
  }

  function renderResult() {
    const result = lastResult;
    const rows = result.attempts.map((a, index) =>
      '<div class="sum-row" style="animation-delay:' + (120 + index * 70) + 'ms"><span>第 ' + (index + 1) + " 次</span>" +
      (a.fell ? '<span class="fell">飞出去了 💥</span>' : "<span>" + a.mm + " mm</span>") + "</div>").join("");
    const isBest = result.bestMm !== null && store.bestMm === result.bestMm && store.bestStamp === result.stamp;
    const confetti = result.bestMm !== null && result.bestMm <= 15 ? confettiHtml(["🪙", "⭐", "✨"]) : "";
    const big = result.bestMm !== null ? result.bestMm + '<span style="font-size:34px"> mm</span>' : "全飞了";
    const content =
      '<div class="score-card">' + confetti + '<span class="eyebrow">本局最佳 · 离桌沿</span>' +
      '<div><span class="score-number pop" id="score-number">' + big + "</span></div>" +
      '<p class="note">' + (result.bestMm !== null ? "三次里停得最贴边的一次" : "三次机会全冲下了悬崖") + "</p></div>" +
      '<h2 class="rate-title">' + escape(result.bestTitle) + "</h2>" +
      '<p class="note">' + escape(result.bestLine) + (isBest ? " 🏆 新纪录！" : "") + "</p>" +
      '<div class="record sum-list"><strong>三次成绩</strong>' + rows + "</div>" +
      action("生成成绩卡", "poster-result", "primary") +
      action("再来一局", "start") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "结算", "看看有多险", content);
  }

  const templates = { play: renderPlay, result: renderResult };

  function render() {
    const inFlow = page !== "home";
    home.hidden = inFlow;
    flow.hidden = !inFlow;
    if (inFlow) {
      flow.innerHTML = templates[page]();
      if (page === "play") setupStage();
    } else {
      renderHome();
    }
  }

  function startGame() {
    cancelLoop();
    tries = [];
    lastResult = null;
    coinX = game.COIN_START;
    coinAngle = 0;
    phase = "ready";
    show("play");
  }

  /* ---------- stage & physics ---------- */

  function stageEl() { return document.getElementById("stage"); }
  function coinEl() { return document.getElementById("coin"); }

  function placeCoin() {
    const coin = coinEl();
    if (!coin) return;
    coin.style.left = ((coinX - game.COIN_R) / game.STAGE_WIDTH * 100) + "%";
    coin.style.top = "42.67%";
  }

  function setPower(ratio, text) {
    const fill = document.getElementById("power-fill");
    if (fill) fill.style.width = Math.round(ratio * 100) + "%";
    const label = document.getElementById("power-text");
    if (label && text) label.textContent = text;
  }

  function showVerdict(text, kind) {
    const el = document.getElementById("verdict");
    if (!el) return;
    el.hidden = false;
    el.className = "verdict" + (kind ? " " + kind : "");
    el.textContent = text;
  }

  function hideVerdict() {
    const el = document.getElementById("verdict");
    if (el) el.hidden = true;
  }

  function refreshAttempts() {
    const wrap = document.getElementById("attempts");
    if (wrap) {
      wrap.innerHTML = dotsHtml() + '<span class="attempts-label">第 ' +
        Math.min(tries.length + 1, game.ATTEMPTS) + " 次机会（共 " + game.ATTEMPTS + " 次）</span>";
    }
    const list = document.getElementById("try-list");
    if (list) {
      const bestMm = bestOf(tries);
      list.innerHTML = tries.map((a, index) => {
        const isBest = !a.fell && a.mm === bestMm;
        return '<span class="try-chip' + (a.fell ? " fell" : "") + (isBest ? " best" : "") + '">第 ' + (index + 1) +
          " 次 · " + (a.fell ? "坠落 💥" : a.mm + " mm") + "</span>";
      }).join("");
    }
  }

  function bestOf(list) {
    let best = null;
    list.forEach(a => { if (!a.fell && (best === null || a.mm < best)) best = a.mm; });
    return best;
  }

  function setupStage() {
    const stage = stageEl();
    if (!stage) return;
    placeCoin();
    refreshAttempts();
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onCancel);
  }

  function logicalX(event, stage) {
    const rect = stage.getBoundingClientRect();
    return (event.clientX - rect.left) / rect.width * game.STAGE_WIDTH;
  }

  function onDown(event) {
    if (phase !== "ready") return;
    const stage = stageEl();
    const x = logicalX(event, stage);
    drag = { startX: x, samples: [{ x, t: Date.now() }] };
    phase = "dragging";
    try { stage.setPointerCapture(event.pointerId); } catch (error) { /* optional */ }
    const coin = coinEl();
    if (coin) coin.classList.remove("ready");
    const arrow = document.getElementById("drag-arrow");
    if (arrow) arrow.style.visibility = "hidden";
    hideVerdict();
  }

  function onMove(event) {
    if (phase !== "dragging" || !drag) return;
    const stage = stageEl();
    const x = logicalX(event, stage);
    drag.samples.push({ x, t: Date.now() });
    if (drag.samples.length > 24) drag.samples.shift();
    const dx = Math.max(0, x - drag.startX);
    coinX = Math.min(game.COIN_START + dx, game.COIN_START + 130);
    placeCoin();
    const ratio = game.powerRatio(dx);
    setPower(ratio, ratio >= 0.97 ? "满格！这不得飞出去……" : "力度 " + Math.round(ratio * 100) + "%");
  }

  function releaseVelocity() {
    const samples = drag.samples;
    const last = samples[samples.length - 1];
    let first = samples[0];
    for (let i = samples.length - 1; i >= 0; i--) {
      if (last.t - samples[i].t <= 110) first = samples[i];
      else break;
    }
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.x - first.x) / dt * 1000;
  }

  function onUp(event) {
    if (phase !== "dragging" || !drag) return;
    const stage = stageEl();
    const x = logicalX(event, stage);
    drag.samples.push({ x, t: Date.now() });
    const dx = Math.max(0, x - drag.startX);
    const speed = game.launchSpeed(dx, releaseVelocity());
    drag = null;
    if (speed <= 0) {
      phase = "ready";
      coinX = game.COIN_START;
      coinAngle = 0;
      placeCoin();
      setPower(0, "滑得太轻啦，再用力一点");
      const coin = coinEl();
      if (coin) { coin.classList.add("ready"); coin.style.transform = ""; }
      return;
    }
    launch(speed);
  }

  function onCancel() {
    if (phase !== "dragging") return;
    drag = null;
    phase = "ready";
    coinX = game.COIN_START;
    placeCoin();
    setPower(0, "按住硬币往右滑，松手发射");
  }

  function cancelLoop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function launch(speed) {
    phase = "sliding";
    setPower(0, "滑出去了……");
    platform.tap();
    let v = speed;
    let last = performance.now();
    const step = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      v -= game.FRICTION * dt;
      if (v <= 0) {
        settle();
        return;
      }
      coinX += v * dt;
      coinAngle += (v * dt) / game.COIN_R * 57.3 * 0.9;
      const coin = coinEl();
      if (!coin) { rafId = null; return; }
      placeCoin();
      coin.style.transform = "rotate(" + coinAngle.toFixed(1) + "deg)";
      if (coinX - game.COIN_R > game.TABLE_RIGHT) {
        startFall(v);
        return;
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
  }

  function startFall(vx) {
    phase = "falling";
    const stage = stageEl();
    const scaleY = stage ? stage.clientHeight / 300 : 1;
    let vy = 0;
    let y = 0;
    let last = performance.now();
    const step = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      vy += 1500 * dt;
      y += vy * dt;
      coinX += vx * dt * 0.55;
      coinAngle += 300 * dt;
      const coin = coinEl();
      if (!coin) { rafId = null; return; }
      placeCoin();
      coin.style.transform = "translateY(" + (y * scaleY).toFixed(1) + "px) rotate(" + coinAngle.toFixed(1) + "deg)";
      coin.style.opacity = y > 90 ? Math.max(0, 1 - (y - 90) / 110) : 1;
      if (y > 195) {
        rafId = null;
        finishTry(game.judge(coinX));
        return;
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
  }

  function settle() {
    rafId = null;
    phase = "settling";
    const coin = coinEl();
    if (coin) {
      coin.classList.add("settle");
      coin.style.transform = "rotate(" + coinAngle.toFixed(1) + "deg)";
    }
    platform.tap();
    window.setTimeout(() => finishTry(game.judge(coinX)), 480);
  }

  function finishTry(result) {
    tries.push(result);
    refreshAttempts();
    if (result.fell) {
      showVerdict("飞出去了！💥", "bad");
    } else if (result.mm <= 5) {
      showVerdict(result.title + "！只差 " + result.mm + "mm 🎉", "good");
    } else {
      showVerdict("停住了 · 差 " + result.mm + "mm", "");
    }
    if (tries.length >= game.ATTEMPTS) {
      phase = "done";
      window.setTimeout(finishRound, 1500);
    } else {
      window.setTimeout(resetCoin, 1500);
    }
  }

  function resetCoin() {
    if (page !== "play") return;
    const coin = coinEl();
    coinX = game.COIN_START;
    coinAngle = 0;
    if (coin) {
      coin.classList.remove("settle");
      coin.style.transition = "left .45s ease, opacity .3s ease";
      coin.style.opacity = 1;
      coin.style.transform = "";
      placeCoin();
      window.setTimeout(() => {
        coin.style.transition = "";
        coin.classList.add("ready");
      }, 480);
    }
    hideVerdict();
    setPower(0, "按住硬币往右滑，松手发射");
    const arrow = document.getElementById("drag-arrow");
    if (arrow) arrow.style.visibility = "visible";
    phase = "ready";
  }

  function finishRound() {
    const bestMm = bestOf(tries);
    let best = null;
    tries.forEach(a => { if (!a.fell && a.mm === bestMm) best = a; });
    lastResult = {
      bestMm,
      bestTitle: best ? best.title : "飞出去了！",
      bestLine: best ? best.line : "三枚硬币全冲下了悬崖，手劲太猛啦。",
      bestGapPx: best ? best.gapPx : undefined,
      attempts: tries.slice(),
      stamp: Date.now()
    };
    store.plays += 1;
    if (bestMm !== null && (store.bestMm === null || bestMm < store.bestMm)) {
      store.bestMm = bestMm;
      store.bestStamp = lastResult.stamp;
    }
    save();
    show("result");
  }

  /* ---------- poster ---------- */

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
        '<p class="note">把成绩卡发出去，看看谁敢停得比你更贴边。</p>';
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
      const title = lastResult.bestMm !== null
        ? "硬币贴边：我的硬币离悬崖只差 " + lastResult.bestMm + " 毫米"
        : "硬币贴边：三枚硬币全让我弹飞了";
      const content = lastResult.bestMm !== null
        ? "把硬币弹向桌子边缘，我停在了离桌沿 " + lastResult.bestMm + "mm 的地方，评级：" +
          lastResult.bestTitle + "。你敢停得更贴边吗？"
        : "把硬币弹向桌子边缘，三次全飞下悬崖……评级：飞出去了！你来试试能不能停住。";
      invokeButton(button, () => platform.openNote(poster, title, content));
    }
  }

  const actions = {
    home: () => { cancelLoop(); show("home"); },
    start: startGame,
    "poster-result": (value, button) => openPoster(button)
  };

  function recover(data) {
    if (!data) return;
    if (data.version !== 1) throw new Error("记录格式不匹配");
    store.plays = Number.isFinite(data.plays) ? data.plays : 0;
    if (Number.isFinite(data.bestMm)) {
      store.bestMm = data.bestMm;
      store.bestStamp = data.bestStamp || 0;
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
