(function () {
  "use strict";

  const quiz = window.FriendQuiz;
  const platform = window.FriendPlatform;
  const cards = window.FriendCards;
  const app = document.getElementById("app");
  const home = document.getElementById("home-view");
  const flow = document.getElementById("flow");
  const resume = document.getElementById("home-resume");
  const notice = document.getElementById("notice");
  const posterLayer = document.getElementById("poster-layer");
  const confirmLayer = document.getElementById("confirm-layer");
  const confirmMessage = document.getElementById("confirm-message");
  const posterImage = document.getElementById("poster-image");
  const posterActions = document.getElementById("poster-actions");
  const characters = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const store = { version: 1, maker: null, pausedCustomDraft: null, attempt: null, records: [] };
  let page = "home";
  let view = {};
  let trial = null;
  let canSave = false;
  let queue = Promise.resolve();
  let notification;
  let poster = null;
  let posterOpener = null;
  let posterRequest = 0;
  let scanning = false;

  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => characters[character]);
  }

  function theme(id) {
    return quiz.themes.find(item => item.id === id);
  }

  function question(themeId, id) {
    return theme(themeId).questions.find(item => item.id === id);
  }

  function themeName(themeId) {
    const item = theme(themeId);
    return item ? item.name : "自定义题单";
  }

  function challengeQuestion(challenge, index) {
    return challenge.questions ? challenge.questions[index] :
      question(challenge.themeId, challenge.questionIds[index]);
  }

  function record(code) {
    return store.records.find(entry => entry.code === code);
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const pad = value => String(value).padStart(2, "0");
    return (date.getMonth() + 1) + "月" + date.getDate() + "日 " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function recordMeta(entry, challenge) {
    const parts = [];
    if (entry.name) parts.push("署名：" + entry.name);
    if (entry.createdAt) parts.push(formatTime(entry.createdAt) + " 出题");
    const first = challengeQuestion(challenge, 0);
    if (first && first.title) {
      const title = first.title.length > 16 ? first.title.slice(0, 16) + "…" : first.title;
      parts.push("首题：" + title);
    }
    return parts.join(" · ");
  }

  function codeTail(code) {
    return "编号 …" + String(code).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  }

  function announce(message) {
    window.clearTimeout(notification);
    notice.textContent = message;
    notice.hidden = false;
    notification = window.setTimeout(() => { notice.hidden = true; }, 4400);
  }

  function save() {
    if (!canSave) return Promise.resolve(false);
    const data = JSON.stringify(store);
    const task = queue.then(() => platform.write(data)).then(() => true, () => {
      announce("保存未获确认，当前内容仍在。可先留存图片或重试。");
      return false;
    });
    queue = task;
    return task;
  }

  function show(next, options) {
    posterRequest++;
    page = next;
    view = options || {};
    render();
    window.scrollTo(0, 0);
    const title = (home.hidden ? flow : home).querySelector("h1, h2");
    if (title) title.focus();
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

  function field(label, id, value, attrs) {
    return '<label class="field">' + escape(label) + '<input id="' + id + '" value="' + escape(value) + '" ' + attrs + "></label>";
  }

  function codeBox(label, code) {
    if (quiz.isCustomCode(code)) {
      return '<details class="full-code"><summary>复制完整题单码</summary>' +
        '<label class="code-box">点按后可选中复制<input readonly value="' + escape(code) + '"></label></details>';
    }
    return '<label class="code-box">' + escape(label) + ' · 点按后可选中复制<input readonly value="' +
      escape(quiz.formatCode(code)) + '"></label>';
  }

  function uploader() {
    return '<div class="upload-control">' + action("选一张图片识别", "pick") +
      '<input class="file-input" id="card-file" type="file" accept="image/*" tabindex="-1" aria-label="选择挑战或成绩卡图片"></div>';
  }

  function progress(index, limit) {
    let segments = "";
    for (let i = 0; i < limit; i++) segments += '<span class="' + (i === index ? "current" : i < index ? "done" : "") + '"></span>';
    return '<div class="segment-progress" aria-hidden="true">' + segments + "</div>";
  }

  function renderHome() {
    resume.innerHTML = (store.maker ? action("继续上次出题", "resume-create") : "") +
      (store.attempt ? action(store.attempt.receipt ? "查看上次成绩" : "继续上次答题", "resume-answer") : "");
    resume.hidden = !resume.firstChild;
  }

  function renderSetup() {
    const selected = view.themeId;
    const themeButtons = quiz.themes.map(item =>
      '<button class="theme" type="button" data-action="theme" data-value="' + item.id + '" aria-pressed="' +
      (item.id === selected) + '"><span class="theme-icon" aria-hidden="true">' + escape(item.icon) +
      "</span><strong>" + escape(item.name) + "</strong></button>").join("");
    const countButtons = quiz.questionCounts.map(count =>
      '<button class="count-option" type="button" data-action="setup-count" data-value="' + count + '" aria-pressed="' +
      (count === view.count) + '">' + count + ' 题</button>').join("");
    return layout("home", "", "出一套题",
      '<div class="setup-group"><h2 class="setup-label" id="pack-label">选题包</h2><div class="theme-list" role="group" aria-labelledby="pack-label">' +
      themeButtons + '</div><p class="note theme-description">' + escape(theme(selected).subtitle) + '</p></div>' +
      '<div class="setup-group"><h2 class="setup-label" id="count-label">题目数量</h2><div class="count-options" role="group" aria-labelledby="count-label">' +
      countButtons + '</div></div><form data-form="setup">' +
      field("邀请图署名（选填）", "nickname", view.name, 'maxlength="12" placeholder="朋友平时叫你的名字" autocomplete="off"') +
      '<button type="submit" class="button primary">开始出题</button>' +
      (platform.hasAI() ? action("AI 帮我挑题", "ai") : "") + "</form>");
  }

  function updateSetup(actionName, value) {
    const top = window.scrollY;
    view = {
      themeId: actionName === "theme" ? value : view.themeId,
      count: actionName === "setup-count" ? value : view.count,
      name: fieldValue("nickname")
    };
    render();
    flow.querySelector('[data-action="' + actionName + '"][aria-pressed="true"]').focus();
    window.scrollTo(0, top);
  }

  function renderCodeEntry(receiving) {
    const title = receiving ? "导入成绩回执" : "答朋友的题";
    const help = receiving ? "选朋友发来的回执图，也可输入这份题单对应的回执码。" :
      "选朋友发来的邀请图，也可以输入挑战码或粘贴完整题单码。";
    const body = '<p class="note">' + help + "</p>" + uploader() +
      '<form data-form="code">' +
      field(receiving ? "回执码" : "挑战码或题单码", "typed-code", view.typed || "",
        'class="code-input" placeholder="输入或粘贴收到的码" maxlength="' + (receiving ? 100 : 2300) +
        '" autocapitalize="off" autocomplete="off" spellcheck="false"') +
      (receiving ? field("答题人昵称（选填）", "receipt-name", view.name, 'maxlength="12" placeholder="方便你区分成绩"') : "") +
      '<p class="error" id="entry-error" role="alert" hidden></p><button type="submit" class="button primary">' +
      (receiving ? "收下这份成绩" : "打开这份挑战") + "</button></form>";
    return layout(receiving ? "record-back" : "home", "", title, body);
  }

  function renderReady() {
    return layout("enter", themeName(view.challenge.themeId), "朋友给你的 " + view.challenge.answers.length + " 题",
      '<p class="note">按你对 TA 的了解选。最后一起揭晓猜中了几道。</p>' +
      action("开始答题", "begin-answer", "primary"));
  }

  function round() {
    if (page === "make") return store.maker;
    if (page === "trial") return trial;
    const data = store.attempt;
    const challenge = data && quiz.readChallenge(data.code);
    return challenge && { themeId: challenge.themeId, challenge, picks: data.picks, step: data.step };
  }

  function renderQuestion() {
    const current = round();
    const making = page === "make";
    const trying = page === "trial";
    const step = current.step;
    const count = current.picks.length;
    const item = current.challenge ? challengeQuestion(current.challenge, step) : question(current.themeId, current.ids[step]);
    const options = item.options.map((option, index) => {
      return '<button class="choice" type="button" data-action="pick-answer" data-value="' + index +
        '" aria-pressed="' + (current.picks[step] === index) + '"><span class="choice-letter" aria-hidden="true">' +
        (index === 0 ? "A" : "B") + "</span>" + escape(option) +
        '<span class="choice-icon" aria-hidden="true">' + escape(item.icons[index]) + "</span></button>";
    }).join("");
    const label = trying ? "示例 · 试两道" : (making ? "出题 · " : "猜朋友 · ") + themeName(current.themeId);
    return '<div class="page"><div class="page-head">' + link("‹ 回首页", "home", undefined, "back-button") +
      '<span class="eyebrow">' + label + " · " + (step + 1) + " / " + count + "</span></div>" +
      progress(step, count) + '<h1 class="question-heading" tabindex="-1">' + escape(item.title) +
      '</h1><div class="choices">' + options + '</div><div class="trailing">' +
      (step > 0 ? link("上一题", "previous") : "<span></span>") +
      (making ? link("换一道", "replace") : "") + "</div></div>";
  }

  function renderInvite() {
    const entry = record(view.code);
    const item = quiz.readChallenge(entry.code);
    const prompt = challengeQuestion(item, 0);
    const how = quiz.isCustomCode(item.code) ? "把挑战图发给朋友。朋友打开工具后，选原图就能导入你写的题。" :
      "把挑战图发给朋友。朋友打开工具后，选这张图或输入挑战码。";
    const body = '<p class="note">' + how + '</p>' +
      '<div class="quiz-card"><span class="eyebrow">' + escape(themeName(item.themeId)) + " · " + item.answers.length + " 题" +
      '</span><strong>你能猜对我几题？</strong><p class="note">' + escape(prompt.title) + '</p>' +
      codeBox("挑战码", item.code) + "</div>" +
      (!canSave ? '<p class="note setup-note">当前环境只保留本次打开的题单。邀请图可以单独留存。</p>' : "") +
      action("预览挑战图", "poster-invite", "primary") +
      (platform.has("share") ? action("发小工具卡", "share-tool") : "") +
      action("查看收回来的成绩", "record", "secondary", entry.code) +
      '<div class="trailing">' + link("查看题单和答案", "view-answers", entry.code) + "</div>";
    return layout("history", "题单已生成", "轮到朋友来猜", body);
  }

  function resultData() {
    if (page === "trial-result") return trial.result;
    const challenge = quiz.readChallenge(store.attempt.code);
    const parsed = quiz.readReceipt(store.attempt.receipt, challenge);
    const mismatch = parsed.guesses.findIndex((answer, index) => answer !== challenge.answers[index]);
    return {
      code: parsed.code,
      total: challenge.answers.length,
      score: parsed.score,
      theme: themeName(challenge.themeId),
      detail: mismatch < 0 ? null : {
        question: challengeQuestion(challenge, mismatch),
        actual: challenge.answers[mismatch],
        pick: parsed.guesses[mismatch]
      }
    };
  }

  function headline(result) {
    if (result.score === result.total) return "小习惯全被你记住了";
    if (result.score / result.total >= .7) return "连这种小事都记得";
    if (result.score / result.total >= .4) return "有些习惯还真猜不到";
    return "这下又认识了 TA 一点";
  }

  function renderResult() {
    const result = resultData();
    const detail = result.detail;
    const score = '<div class="score"><div class="score-number" aria-label="猜中 ' + result.score + ' 道，共 ' + result.total +
      ' 道">' + result.score + '<small> / ' + result.total + '</small></div><p class="score-title">' +
      headline(result) + "</p></div>";
    const line = detail ? '<div class="result-card"><span class="eyebrow">没猜到的那题</span><strong>' +
      escape(detail.question.title) + '</strong><p class="note">你选「' + escape(detail.question.options[detail.pick]) +
      '」<br>TA 选「' + escape(detail.question.options[detail.actual]) + '」</p></div>' : "";
    const buttons = action("换我出题", "create", "primary") +
      (result.code ? action("把成绩发给 TA", "poster-receipt") : "") + action("预览公开成绩图", "poster-result");
    return layout("home", result.theme, "揭晓成绩", score + line + '<div class="share-choices">' + buttons + "</div>");
  }

  function renderHistory() {
    const list = store.records.map(entry => {
      const challenge = quiz.readChallenge(entry.code);
      const meta = recordMeta(entry, challenge);
      return '<button type="button" class="record record-button" data-action="record" data-value="' + escape(entry.code) +
        '"><span><span class="record-name">' + escape(themeName(challenge.themeId)) + " · " + challenge.answers.length + " 题" +
        '</span>' + (meta ? '<span class="note record-meta">' + escape(meta) + "</span>" : "") +
        '<span class="note record-meta">' + entry.receipts.length +
        " 份已收回执 · " + codeTail(entry.code) + "</span></span><span aria-hidden=\"true\">›</span></button>";
    }).join("");
    return layout("home", "", "我的题单",
      (!canSave ? '<p class="note">当前环境只保留本次打开的记录。</p>' : "") +
      (list || '<div class="record empty note">出完一套题后，邀请卡和收到的成绩会显示在这里。</div>') +
      action("再出一套", "create", "primary"));
  }

  function renderRecord() {
    const entry = record(view.code);
    const challenge = quiz.readChallenge(entry.code);
    const sorted = entry.receipts.slice().sort((left, right) => right.score - left.score);
    const rows = sorted.map((receipt, index) =>
      '<div class="score-row"><div><b>' + receipt.score + "/" + challenge.answers.length + '</b>　' + escape(receipt.name || "朋友 " + (index + 1)) +
      "</div>" + link("看细节", "view-receipt", receipt.code) + link("移除", "remove-receipt", receipt.code) + "</div>").join("");
    const meta = recordMeta(entry, challenge);
    const body = (meta ? '<p class="note">' + escape(meta) + " · " + codeTail(entry.code) + "</p>" : "") +
      '<div class="record"><strong>已收到的回执</strong><p class="note">朋友主动发回并导入后才会显示。</p>' +
      (rows || '<p class="note setup-note">还没有成绩。答完后请朋友点「把成绩发给 TA」。</p>') +
      "</div>" + action("导入朋友的成绩", "receive", "primary") +
      action("重新发邀请", "invite", "secondary", entry.code) +
      '<div class="trailing">' + link("题单和答案", "view-answers", entry.code) +
      link("删除题单", "remove-record", entry.code) + "</div>";
    return layout("history", "", themeName(challenge.themeId) + " · " + challenge.answers.length + " 题", body);
  }

  function renderReview() {
    const entry = record(view.code);
    const challenge = quiz.readChallenge(entry.code);
    const items = challenge.answers.map((answer, index) => {
      const item = challengeQuestion(challenge, index);
      const options = item.options.map((option, optionIndex) => {
        const mine = optionIndex === answer;
        return '<div class="review-option' + (mine ? " mine" : "") + '"><span class="choice-letter" aria-hidden="true">' +
          (optionIndex === 0 ? "A" : "B") + "</span><span>" + escape(option) + "</span>" +
          (mine ? '<span class="review-badge">我的答案</span>' : "") + "</div>";
      }).join("");
      return '<div class="record review-item"><span class="eyebrow">第 ' + (index + 1) + " 题</span>" +
        '<p class="review-title">' + escape(item.title) + '</p><div class="review-options">' + options + "</div></div>";
    }).join("");
    return layout("record-back", "", "题单和答案", items);
  }

  function renderReceipt() {
    const entry = record(view.code);
    const challenge = quiz.readChallenge(entry.code);
    const receipt = entry.receipts.find(item => item.code === view.receipt);
    const parsed = receipt && quiz.readReceipt(receipt.code, challenge);
    if (!receipt || !parsed) return layout("history", "", "答题细节", '<p class="note">这份成绩读不出来了。</p>');
    const items = challenge.answers.map((answer, index) => {
      const guess = parsed.guesses[index];
      const correct = guess === answer;
      const item = challengeQuestion(challenge, index);
      const options = item.options.map((option, optionIndex) => {
        const isAnswer = optionIndex === answer;
        const isGuess = optionIndex === guess;
        const badge = isAnswer && isGuess ? "我的答案 · TA 也选了" :
          isAnswer ? "我的答案" : isGuess ? "TA 选的" : "";
        return '<div class="review-option' + (isAnswer ? " mine" : isGuess ? " theirs" : "") +
          '"><span class="choice-letter" aria-hidden="true">' + (optionIndex === 0 ? "A" : "B") +
          "</span><span>" + escape(option) + "</span>" +
          (badge ? '<span class="review-badge">' + badge + "</span>" : "") + "</div>";
      }).join("");
      return '<div class="record review-item"><div class="review-head"><span class="eyebrow">第 ' + (index + 1) + " 题</span>" +
        '<span class="review-status ' + (correct ? "ok" : "miss") + '">' + (correct ? "答对了" : "答错了") + "</span></div>" +
        '<p class="review-title">' + escape(item.title) + '</p><div class="review-options">' + options + "</div></div>";
    }).join("");
    const summary = '<p class="note">' + escape(receipt.name || "朋友") + " 一共答了 " + challenge.answers.length +
      " 题，答对 " + parsed.score + " 题。下面是每一题的对照。</p>";
    return layout("record-back", "", "答题细节", summary + items);
  }

  const templates = {
    setup: renderSetup,
    enter: () => renderCodeEntry(false),
    receive: () => renderCodeEntry(true),
    ready: renderReady,
    make: renderQuestion,
    answer: renderQuestion,
    trial: renderQuestion,
    invite: renderInvite,
    result: renderResult,
    "trial-result": renderResult,
    history: renderHistory,
    record: renderRecord,
    review: renderReview,
    receipt: renderReceipt
  };

  function render() {
    home.hidden = page !== "home";
    flow.hidden = page === "home";
    if (page === "home") renderHome();
    else flow.innerHTML = templates[page]();
  }

  function fieldValue(id) {
    const input = document.getElementById(id);
    return input ? input.value.trim() : "";
  }

  function startMaker(ids) {
    const selected = view.themeId;
    const count = view.count;
    if (!ids) {
      const pool = theme(selected).questions.map(item => item.id);
      for (let index = 0; index < count; index++) {
        const other = index + Math.floor(Math.random() * (pool.length - index));
        const original = pool[index];
        pool[index] = pool[other];
        pool[other] = original;
      }
      ids = pool.slice(0, count).sort((left, right) => left - right);
    }
    store.maker = { themeId: selected, name: fieldValue("nickname"), ids,
      used: [], picks: new Array(count).fill(null), step: 0 };
    save();
    show("make");
  }

  function startAnswer(challenge, restart) {
    if (restart || !store.attempt || store.attempt.code !== challenge.code) {
      store.attempt = { code: challenge.code, step: 0, picks: new Array(challenge.answers.length).fill(null), receipt: null };
      save();
    }
    show(store.attempt.receipt ? "result" : "answer");
  }

  function finishTrial(current) {
    const answers = [0, 1];
    const score = current.picks.reduce((sum, pick, index) => sum + Number(pick === answers[index]), 0);
    const miss = current.picks.findIndex((pick, index) => pick !== answers[index]);
    trial.result = { total: 2, score, theme: "两题试玩", detail: miss < 0 ? null : {
      question: question(current.themeId, current.ids[miss]), actual: answers[miss], pick: current.picks[miss]
    } };
    show("trial-result");
  }

  function chooseAnswer(pick) {
    const current = round();
    current.picks[current.step] = pick;
    if (current.step + 1 < current.picks.length) {
      const progressState = page === "make" ? store.maker : page === "trial" ? trial : store.attempt;
      progressState.step++;
      if (page !== "trial") save();
      show(page);
      return;
    }
    if (page === "make") {
      let challenge;
      try {
        challenge = quiz.makeChallenge(current.themeId, current.ids, current.picks);
      } catch (error) {
        announce("题单还未生成，请检查每一题的题目、选项和答案。");
        return;
      }
      store.records.unshift({ code: challenge.code, name: current.name, receipts: [], createdAt: Date.now() });
      store.maker = null;
      save();
      show("invite", { code: challenge.code });
    } else {
      platform.reveal();
      if (page === "trial") finishTrial(current);
      else {
        const challenge = quiz.readChallenge(store.attempt.code);
        store.attempt.receipt = quiz.makeReceipt(challenge, current.picks);
        save();
        show("result");
      }
    }
  }

  function replaceQuestion() {
    const current = store.maker;
    const previous = current.ids[current.step];
    const pack = theme(current.themeId).questions;
    const spare = pack.filter(item => !current.ids.includes(item.id));
    const alternative = spare.find(item => !current.used.includes(item.id)) || spare[0];
    if (!alternative) return;
    current.used.push(previous);
    current.ids[current.step] = alternative.id;
    current.picks[current.step] = null;
    save();
    show("make");
  }

  function entryError(message) {
    const line = document.getElementById("entry-error");
    if (!line) return;
    line.textContent = message;
    line.hidden = false;
  }

  function importCode(code) {
    if (page === "enter") {
      const challenge = quiz.readChallenge(code);
      if (!challenge) return entryError("挑战码不完整或有错字，请对照邀请图再试。");
      notice.hidden = true;
      show("ready", { challenge });
      return;
    }
    const entry = record(view.code);
    const challenge = quiz.readChallenge(entry.code);
    const receipt = quiz.readReceipt(code, challenge);
    if (!receipt) return entryError("这不是当前题单的回执，请核对收到的码。");
    if (entry.receipts.some(saved => saved.code === receipt.code)) return entryError("这份成绩已经收过了。");
    entry.receipts.push({ code: receipt.code, name: fieldValue("receipt-name"), score: receipt.score });
    save();
    show("record", { code: entry.code });
    announce("收到一份 " + receipt.score + " / " + challenge.answers.length + " 的成绩");
  }

  async function importImage(file) {
    if (scanning || !file) return;
    scanning = true;
    const origin = view;
    announce("正在识别图片…");
    try {
      const code = await cards.decode(file);
      if (view !== origin) return;
      const input = document.getElementById("typed-code");
      input.value = quiz.formatCode(code);
      if (page === "enter" && quiz.readChallenge(code)) importCode(code);
      else if (page === "receive") {
        notice.hidden = true;
        const entry = record(view.code);
        if (!quiz.readReceipt(code, quiz.readChallenge(entry.code))) entryError("这张卡片与当前题单不匹配。");
        else announce("回执码已填好，可以写个称呼后收下成绩");
      } else {
        notice.hidden = true;
        entryError("需要朋友发来的邀请图或截图。");
      }
    } catch (error) {
      if (view === origin) {
        notice.hidden = true;
        entryError(error.message || "图片未识别，可以手动填码。");
      }
    } finally {
      scanning = false;
    }
  }

  function posterModel(kind) {
    if (kind === "invite") {
      const entry = record(view.code);
      const item = quiz.readChallenge(entry.code);
      return { kind, code: entry.code, name: entry.name, theme: themeName(item.themeId), total: item.answers.length,
        question: challengeQuestion(item, 0) };
    }
    const result = resultData();
    return { kind, code: kind === "receipt" ? result.code : null, theme: result.theme,
      score: result.score, total: result.total, headline: headline(result) };
  }

  async function openPoster(kind, caller) {
    const requestId = ++posterRequest;
    caller.disabled = true;
    try {
      const model = posterModel(kind);
      const canvas = await cards.draw(model);
      if (requestId !== posterRequest) return;
      poster = { model, canvas };
      posterOpener = caller;
      posterImage.src = canvas.toDataURL("image/png");
      const share = platform.has("share");
      const saveImage = platform.has("saveImageToPhotosAlbum");
      const post = kind !== "receipt" && platform.has("postNote");
      const comment = kind === "result" && platform.has("interactionOpenApi") && platform.has("writeTempFile");
      posterActions.innerHTML = (share ? action("分享图片", "native-image", "primary") : "") +
        (saveImage ? action("保存到相册", "native-save", share ? "secondary" : "primary") : "") +
        (post ? action("打开笔记编辑页", "native-note") : "") +
        (comment ? action("带成绩图去评论", "native-comment") : "") +
        (model.code ? codeBox(kind === "invite" ? "挑战码" : "回执码", model.code) : "") +
        (!saveImage ? '<p class="note">可以截图留存。小红书容器支持时会显示保存和分享入口。</p>' : "");
      posterLayer.hidden = false;
      app.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "hidden";
      document.getElementById("poster-close").focus();
    } catch (error) {
      if (requestId === posterRequest) announce("图片没有生成，请再试一次。");
    } finally {
      caller.disabled = false;
    }
  }

  let confirmResolve = null;

  function confirmAction(message) {
    if (confirmResolve) return Promise.resolve(false);
    confirmMessage.textContent = message;
    confirmLayer.hidden = false;
    document.getElementById("confirm-cancel").focus();
    return new Promise(resolve => { confirmResolve = resolve; });
  }

  function settleConfirm(value) {
    if (!confirmResolve) return;
    const resolve = confirmResolve;
    confirmResolve = null;
    confirmLayer.hidden = true;
    resolve(value);
  }

  function closePoster() {
    posterRequest++;
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
      if (Number(error && error.errCode) === 15502) announce("此场景不能打开分享面板，可保存图片后发送。");
      else if (Number(error && error.errCode) === 15503) announce("今天打开分享面板的次数已达上限，可保存图片。");
      else if (Number(error && error.errCode) !== 20002) announce("操作未完成，可以重试或截图保留。");
    } finally {
      button.disabled = false;
    }
  }

  function nativeAction(name, button) {
    if (name === "share-tool") return invokeButton(button, platform.shareTool);
    if (!poster) return;
    const current = poster;
    const model = current.model;
    if (name === "native-image") return invokeButton(button, () => platform.shareImage(current.canvas));
    if (name === "native-save") return invokeButton(button, () => platform.saveImage(current.canvas), "图片已保存到相册");
    const resultText = "我猜中了 " + model.score + " / " + model.total + " 道。";
    if (name === "native-note") {
      const title = model.kind === "invite" ? "你能猜对我几题？" : "我猜中了朋友几道题";
      let content = resultText;
      if (model.kind === "invite") {
        content = "我出了 " + model.total + " 道关于自己的题。打开「好友默契局」，选择这张邀请图来答。";
        if (!quiz.isCustomCode(model.code)) content += "也可以输入挑战码：" + quiz.formatCode(model.code);
      }
      return invokeButton(button, () => platform.openNote(current.canvas, title, content));
    }
    if (name === "native-comment") return invokeButton(button, () => platform.openComment(current.canvas, resultText, "result"));
  }

  async function aiSetup(button) {
    if (store.maker && !(await confirmAction("开始新题单会替换尚未完成的草稿，继续吗？"))) return;
    const origin = view;
    const selected = theme(view.themeId);
    button.disabled = true;
    announce("AI 正在挑题，也可以直接开始出题");
    try {
      const ids = await platform.draftQuestions(selected, origin.count);
      if (page === "setup" && view === origin) {
        notice.hidden = true;
        startMaker(ids);
      }
    } catch (error) {
      if (page === "setup" && view === origin) announce("暂时没选出完整题单，可以直接开始，按需换题。");
    } finally {
      button.disabled = false;
    }
  }

  async function removeEntry(code, receiptCode) {
    if (!(await confirmAction(receiptCode ? "移除这份成绩？" : "删除本机的题单和已收成绩？"))) return;
    if (receiptCode) {
      const entry = record(code);
      entry.receipts = entry.receipts.filter(item => item.code !== receiptCode);
      show("record", { code });
    } else {
      store.records = store.records.filter(item => item.code !== code);
      show("history");
    }
    save();
  }

  function startTrial() {
    const pack = quiz.themes.find(item => item.questions.some(entry => entry.title.includes("特别好吃")));
    const selected = pack || theme(0);
    const experiment = selected.questions.find(item => item.title.includes("特别好吃"));
    const first = experiment ? experiment.id : quiz.defaultIds(selected.id)[0];
    const second = quiz.defaultIds(selected.id).find(id => id !== first);
    trial = { themeId: selected.id, ids: [first, second], step: 0, picks: [null, null], result: null };
    show("trial");
  }

  const actions = {
    home: () => show("home"),
    history: () => show("history"),
    create: () => show("setup", { themeId: 0, count: 10, name: "" }),
    theme: value => updateSetup("theme", Number(value)),
    "setup-count": value => updateSetup("setup-count", Number(value)),
    ai: (value, button) => aiSetup(button),
    enter: () => show("enter"),
    trial: startTrial,
    "resume-create": () => show("make"),
    "resume-answer": () => show(store.attempt.receipt ? "result" : "answer"),
    "begin-answer": () => startAnswer(view.challenge, false),
    "pick-answer": value => chooseAnswer(Number(value)),
    previous: () => {
      const state = page === "make" ? store.maker : page === "trial" ? trial : store.attempt;
      if (state.step > 0) state.step--;
      if (page !== "trial") save();
      show(page);
    },
    replace: replaceQuestion,
    invite: code => show("invite", { code }),
    record: code => show("record", { code }),
    "record-back": () => show("record", { code: view.code }),
    receive: () => show("receive", { code: view.code }),
    "view-answers": code => show("review", { code }),
    "view-receipt": receiptCode => show("receipt", { code: view.code, receipt: receiptCode }),
    "remove-receipt": code => removeEntry(view.code, code),
    "remove-record": code => removeEntry(code),
    pick: () => document.getElementById("card-file").click()
  };

  function bind() {
    document.addEventListener("click", event => {
      if (event.target.matches && event.target.matches(".code-box input")) {
        event.target.select();
        return;
      }
      const button = event.target.closest && event.target.closest("button[data-action]");
      if (!button || button.disabled || (!posterLayer.hidden && !posterLayer.contains(button)) ||
        (!confirmLayer.hidden && !confirmLayer.contains(button))) return;
      const name = button.dataset.action;
      if (name.startsWith("poster-")) openPoster(name.slice(7), button);
      else if (name.startsWith("native-") || name === "share-tool") nativeAction(name, button);
      else if (actions[name]) actions[name](button.dataset.value, button);
    });
    flow.addEventListener("submit", event => {
      event.preventDefault();
      if (event.target.dataset.form === "setup") {
        if (store.maker) {
          confirmAction("开始新题单会替换尚未完成的草稿，继续吗？").then(ok => { if (ok) startMaker(); });
        } else startMaker();
      } else if (event.target.dataset.form === "code") importCode(fieldValue("typed-code"));
    });
    flow.addEventListener("change", event => {
      if (event.target.id !== "card-file") return;
      const file = event.target.files[0];
      event.target.value = "";
      importImage(file);
    });
    document.getElementById("confirm-ok").addEventListener("click", () => settleConfirm(true));
    document.getElementById("confirm-cancel").addEventListener("click", () => settleConfirm(false));
    confirmLayer.addEventListener("click", event => { if (event.target === confirmLayer) settleConfirm(false); });
    document.getElementById("poster-close").addEventListener("click", closePoster);
    posterLayer.addEventListener("click", event => { if (event.target === posterLayer) closePoster(); });
    posterLayer.addEventListener("focusout", event => {
      if (!posterLayer.hidden && event.relatedTarget && !posterLayer.contains(event.relatedTarget)) {
        document.getElementById("poster-close").focus();
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (!confirmLayer.hidden) settleConfirm(false);
      else if (!posterLayer.hidden) closePoster();
    });
    window.addEventListener("resize", platform.refreshInsets);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) platform.refreshInsets();
    });
  }

  function recoverMaker(maker) {
    if (!maker || !theme(maker.themeId) || !Array.isArray(maker.ids) ||
        !Array.isArray(maker.picks) || !Array.isArray(maker.used) || !quiz.questionCounts.includes(maker.ids.length) ||
        maker.picks.length !== maker.ids.length || !Number.isInteger(maker.step) || maker.step < 0 || maker.step >= maker.ids.length) return;
    if (!maker.ids.every(id => question(maker.themeId, id)) || new Set(maker.ids).size !== maker.ids.length) return;
    store.maker = {
      themeId: maker.themeId,
      name: String(maker.name || "").slice(0, 12),
      ids: maker.ids,
      used: maker.used,
      picks: maker.picks.map(value => value === 0 || value === 1 ? value : null),
      step: maker.step
    };
  }

  function recover(data) {
    if (!data) return;
    if (data.version !== 1 || !Array.isArray(data.records)) throw new Error("记录格式不匹配");
    store.records = data.records.reduce((records, entry) => {
      const challenge = entry && quiz.readChallenge(entry.code);
      if (!challenge || !Array.isArray(entry.receipts)) return records;
      const receipts = entry.receipts.reduce((rows, receipt) => {
        const parsed = receipt && quiz.readReceipt(receipt.code, challenge);
        if (parsed) rows.push({ code: parsed.code, score: parsed.score, name: String(receipt.name || "").slice(0, 12) });
        return rows;
      }, []);
      records.push({ code: challenge.code, name: String(entry.name || "").slice(0, 12), receipts, createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : 0 });
      return records;
    }, []);
    store.pausedCustomDraft = data.pausedCustomDraft || null;
    const maker = data.maker;
    if (maker && (maker.themeId === null || (Array.isArray(maker.custom) && maker.custom.some(Boolean)))) {
      store.pausedCustomDraft = maker;
    } else {
      recoverMaker(maker);
    }
    const attempt = data.attempt;
    const challenge = attempt && quiz.readChallenge(attempt.code);
    if (challenge && Array.isArray(attempt.picks) && attempt.picks.length === challenge.answers.length && Number.isInteger(attempt.step) &&
        attempt.step >= 0 && attempt.step < challenge.answers.length && (!attempt.receipt || quiz.readReceipt(attempt.receipt, challenge))) {
      store.attempt = attempt;
    }
  }

  async function boot() {
    const status = document.getElementById("boot-status");
    try {
      const state = await platform.read();
      recover(state.data);
      canSave = state.supported;
      status.hidden = true;
    } catch (error) {
      status.textContent = "上次记录暂时无法读取，本次可以继续玩。";
    }
    bind();
    renderHome();
    Array.from(document.querySelectorAll("button[disabled]")).forEach(button => { button.disabled = false; });
    platform.refreshInsets();
  }

  if (quiz && platform && cards) boot();
}());
