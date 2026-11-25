(function () {
  "use strict";

  const game = window.MalatangGame;
  const platform = window.MalatangPlatform;
  const cards = window.MalatangCards;
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
  let pieces = [];
  let lastResult = null;
  let canSave = false;
  let queue = Promise.resolve();
  let notification;
  let poster = null;
  let posterOpener = null;
  let weighing = null;

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
    if (store.best) {
      bestCard.hidden = false;
      bestCard.innerHTML = '<span class="eyebrow">我的最佳纪录</span><strong>' +
        (store.best.diff === 0 ? "正好 250g！" : "差 " + Math.abs(store.best.diff) + " 克") +
        '</strong><span class="note">那一碗称了 ' + store.best.total + "g · 已挑战 " + store.plays + " 局</span>";
    } else {
      bestCard.hidden = true;
    }
  }

  function pieceStyle(index) {
    const seed = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    const frac = seed - Math.floor(seed);
    const seed2 = Math.sin(index * 269.5 + 183.3) * 28001.8384;
    const frac2 = seed2 - Math.floor(seed2);
    const size = 30 + frac2 * 14;
    let left;
    let bottom;
    let rot = Math.round(frac * 50 - 25);
    if (index >= 24 && frac > 0.45) {
      // Overflow: pieces spill over the rim and hang outside the bowl.
      const side = frac > 0.72 ? 1 : -1;
      left = side > 0 ? 76 + frac2 * 13 : -4 + frac2 * 8;
      bottom = 52 + frac2 * 34;
      rot = side * Math.round(24 + frac2 * 26);
    } else {
      left = 13 + frac * 58;
      bottom = 4 + Math.floor(index / 4) * 11 + frac2 * 5;
    }
    return "left:" + left.toFixed(1) + "%;bottom:" + bottom.toFixed(1) + "px;font-size:" +
      size.toFixed(0) + "px;transform:rotate(" + rot + "deg)";
  }

  function refreshPlayBits() {
    const count = document.getElementById("piece-count");
    if (count) {
      count.textContent = pieces.length;
      count.classList.remove("pop");
      void count.offsetWidth;
      count.classList.add("pop");
    }
    const undoButton = document.getElementById("undo-button");
    const weighButton = document.getElementById("weigh-button");
    if (undoButton) undoButton.disabled = pieces.length === 0;
    if (weighButton) weighButton.disabled = pieces.length === 0;
    const wrap = document.getElementById("bowl-wrap");
    if (wrap) {
      wrap.classList.remove("bounce");
      void wrap.offsetWidth;
      wrap.classList.add("bounce");
    }
  }

  function placePiece(piece) {
    pieces.push(piece);
    const pile = document.getElementById("pile");
    if (pile) {
      const span = document.createElement("span");
      span.className = "pile-piece drop";
      span.setAttribute("style", pieceStyle(pieces.length - 1));
      span.textContent = piece.emoji;
      pile.appendChild(span);
    }
    refreshPlayBits();
  }

  function renderPlay() {
    const pile = pieces.map((piece, index) =>
      '<span class="pile-piece' + (index === pieces.length - 1 ? " drop" : "") + '" style="' +
      pieceStyle(index) + '">' + piece.emoji + "</span>").join("");
    const tray = game.INGREDIENTS.map(item => {
      const size = Math.round(22 + Math.min(item.base, 60) / 60 * 14);
      return '<button type="button" class="food" data-action="add" data-value="' + item.id + '">' +
        '<span class="food-emoji" style="font-size:' + size + 'px">' + item.emoji + "</span>" +
        '<span class="food-name">' + escape(item.name) + "</span></button>";
    }).join("");
    const content =
      '<div class="bowl-wrap" id="bowl-wrap"><span class="steam s1"></span><span class="steam s2"></span><span class="steam s3"></span>' +
      '<div class="bowl-pile" id="pile">' + pile + '</div><div class="bowl" id="bowl"></div></div>' +
      '<p class="count-line">已加 <b id="piece-count">' + pieces.length + '</b> 件 · 目标 250g（称重前不许偷看）</p>' +
      '<div class="tray">' + tray + "</div>" +
      '<div class="play-actions">' +
      '<button class="button secondary" type="button" id="undo-button" data-action="undo"' + (pieces.length ? "" : " disabled") + ">撤回上一件</button>" +
      '<button class="button primary" type="button" id="weigh-button" data-action="weigh"' + (pieces.length ? "" : " disabled") + ">称重出锅</button></div>";
    return layout("home", "挑战中", "往碗里加，别手抖", content);
  }

  function summaryText() {
    const counts = new Map();
    pieces.forEach(piece => {
      const row = counts.get(piece.id) || { name: piece.name, count: 0, grams: 0 };
      row.count += 1;
      row.grams += piece.grams;
      counts.set(piece.id, row);
    });
    return Array.from(counts.values());
  }

  function renderResult() {
    const result = lastResult;
    const rows = summaryText().map((row, index) =>
      '<div class="sum-row" style="animation-delay:' + (120 + index * 70) + 'ms"><span>' + escape(row.name) +
      " × " + row.count + '</span><span>' + row.grams + "g</span></div>").join("");
    const confetti = Math.abs(result.diff) <= 10 ?
      '<div class="confetti" aria-hidden="true">' + Array.from({ length: 16 }, (unused, index) => {
        const seed = Math.sin(index * 97.3 + 13.7) * 10000;
        const frac = seed - Math.floor(seed);
        const seed2 = Math.sin(index * 57.9 + 71.3) * 10000;
        const frac2 = seed2 - Math.floor(seed2);
        return '<i style="left:' + (frac * 94 + 2).toFixed(0) + "%;font-size:" + (15 + frac2 * 13).toFixed(0) +
          "px;animation-duration:" + (1.5 + frac2 * 1.3).toFixed(2) + "s;animation-delay:" + (frac * 0.5).toFixed(2) +
          's">' + (index % 3 === 0 ? "🌶️" : index % 3 === 1 ? "⭐" : "🎉") + "</i>";
      }).join("") + "</div>" : "";
    const isBest = store.best && store.best.diff === result.diff &&
      store.best.total === result.total && store.best.stamp === result.stamp;
    const content =
      '<div class="scale-card">' + confetti + '<span class="eyebrow">电子秤显示</span>' +
      '<div class="scale-number" id="scale-number">0g</div>' +
      '<p class="note">目标 250g · ' + (result.diff === 0 ? "正好，一克不差！" :
        (result.diff > 0 ? "超了 " : "差了 ") + Math.abs(result.diff) + " 克") + "</p></div>" +
      '<h2 class="rate-title">' + escape(result.title) + "</h2>" +
      '<p class="note">' + escape(result.line) + (isBest ? " 🏆 新纪录！" : "") + "</p>" +
      '<div class="record sum-list"><strong>这一碗的清单</strong>' + rows + "</div>" +
      action("生成成绩卡", "poster-result", "primary") +
      action("再来一局", "start") +
      '<div class="trailing">' + link("回首页", "home") + "</div>";
    return layout("home", "称重结果", "开秤！", content);
  }

  const templates = { play: renderPlay, result: renderResult };

  function render() {
    const inFlow = page !== "home";
    home.hidden = inFlow;
    flow.hidden = !inFlow;
    if (inFlow) flow.innerHTML = templates[page]();
    else renderHome();
  }

  function startGame() {
    pieces = [];
    lastResult = null;
    show("play");
  }

  let pendingAdds = 0;

  function addPiece(id, button) {
    const item = game.INGREDIENTS.find(entry => entry.id === Number(id));
    if (!item || pieces.length + pendingAdds >= 40) {
      if (item) announce("碗要装不下了，先称重吧。");
      return;
    }
    const piece = game.makePiece(item);
    platform.tap();
    const bowl = document.getElementById("bowl");
    if (button && bowl && button.getBoundingClientRect) {
      const from = button.getBoundingClientRect();
      const to = bowl.getBoundingClientRect();
      const fly = document.createElement("span");
      fly.className = "fly-piece";
      fly.textContent = item.emoji;
      fly.style.left = (from.left + from.width / 2 - 17) + "px";
      fly.style.top = (from.top + from.height / 2 - 17) + "px";
      fly.style.fontSize = "34px";
      document.body.appendChild(fly);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top - 6 - (from.top + from.height / 2);
      window.requestAnimationFrame(() => {
        fly.style.transform = "translate(" + dx + "px," + dy + "px) scale(.82) rotate(14deg)";
        fly.style.opacity = ".92";
      });
      pendingAdds += 1;
      window.setTimeout(() => {
        pendingAdds -= 1;
        fly.remove();
        placePiece(piece);
      }, 385);
    } else {
      placePiece(piece);
    }
  }

  function undo() {
    if (!pieces.length) return;
    pieces.pop();
    const pile = document.getElementById("pile");
    if (pile && pile.lastElementChild) pile.removeChild(pile.lastElementChild);
    refreshPlayBits();
  }

  function weigh() {
    const total = pieces.reduce((sum, piece) => sum + piece.grams, 0);
    const rated = game.rate(total);
    lastResult = {
      total, diff: rated.diff, title: rated.title, line: rated.line,
      count: pieces.length, stamp: Date.now(),
      summary: summaryText().map(row => row.name + "×" + row.count).join(" ")
    };
    store.plays += 1;
    if (!store.best || Math.abs(rated.diff) < Math.abs(store.best.diff)) {
      store.best = { diff: rated.diff, total, stamp: lastResult.stamp };
    }
    save();
    show("result");
    platform.tap();
    const el = document.getElementById("scale-number");
    if (el) {
      const started = Date.now();
      weighing = window.setInterval(() => {
        const t = Math.min(1, (Date.now() - started) / 900);
        el.textContent = Math.round(total * (1 - Math.pow(1 - t, 3))) + "g";
        if (t >= 1) window.clearInterval(weighing);
      }, 40);
    }
  }

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
        '<p class="note">把成绩卡发出去，看看谁能比你更接近 250g。</p>';
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
      const title = "麻辣烫挑战：我离 250g 只差 " + Math.abs(lastResult.diff) + " 克";
      const content = "凭手感加食材挑战正好 250g，我称了 " + lastResult.total + "g，" +
        (lastResult.diff === 0 ? "一克不差！" : "差 " + Math.abs(lastResult.diff) + " 克") +
        "。评级：" + lastResult.title + "。你也来试试？";
      invokeButton(button, () => platform.openNote(poster, title, content));
    }
  }

  const actions = {
    home: () => show("home"),
    start: startGame,
    add: (value, button) => addPiece(value, button),
    undo,
    weigh,
    "poster-result": (value, button) => openPoster(button)
  };

  function recover(data) {
    if (!data) return;
    if (data.version !== 1) throw new Error("记录格式不匹配");
    store.plays = Number.isFinite(data.plays) ? data.plays : 0;
    if (data.best && Number.isFinite(data.best.diff) && Number.isFinite(data.best.total)) {
      store.best = { diff: data.best.diff, total: data.best.total, stamp: data.best.stamp || 0 };
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
