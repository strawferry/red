(function () {
  "use strict";

  // The cards are intentionally a little taller than a phone screenshot. It
  // leaves enough room for a quiet QR code while keeping the exported image
  // easy to crop or share in a feed.
  const width = 960;
  const height = 1200;
  const ink = "#26223D";
  const coral = "#FF6B60";
  const accent = "#A32D4F";
  const lavender = "#E8E0FF";
  const lavenderLight = "#F7F3FF";
  const warmWhite = "#FCFAF7";
  const muted = "#746E88";
  const border = "#E5DDF4";
  const font = '"PingFang SC", "Microsoft YaHei", sans-serif';
  const pending = {};
  let logoPromise;

  function load(name, path) {
    if (typeof window[name] === "function") return Promise.resolve(window[name]);
    if (!pending[name]) {
      pending[name] = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = path;
        script.onload = () => {
          if (typeof window[name] === "function") resolve(window[name]);
          else reject(new Error("识别组件未能加载"));
        };
        script.onerror = () => reject(new Error("识别组件未能加载"));
        document.head.appendChild(script);
      }).catch(error => {
        delete pending[name];
        throw error;
      });
    }
    return pending[name];
  }

  function loadLogo() {
    if (logoPromise) return logoPromise;
    logoPromise = new Promise(resolve => {
      if (typeof Image === "undefined") {
        resolve(null);
        return;
      }
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = "./assets/logo.png";
    });
    return logoPromise;
  }

  function safe(value) {
    return value == null ? "" : String(value);
  }

  function totalOf(model) {
    const value = Number(model && model.total);
    return isFinite(value) && value > 0 ? Math.round(value) : 10;
  }

  function setFont(ctx, size, weight, family) {
    ctx.font = (weight || 400) + " " + size + "px " + (family || font);
  }

  function fill(ctx, color) {
    ctx.fillStyle = color;
  }

  function roundedPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function roundBox(ctx, x, y, w, h, color, radius) {
    roundedPath(ctx, x, y, w, h, radius == null ? 28 : radius);
    fill(ctx, color);
    ctx.fill();
  }

  function roundBorder(ctx, x, y, w, h, color, radius, lineWidth) {
    roundedPath(ctx, x, y, w, h, radius == null ? 28 : radius);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.stroke();
  }

  function drawText(ctx, value, x, y, size, weight, color, family) {
    setFont(ctx, size, weight, family);
    fill(ctx, color || ink);
    ctx.fillText(safe(value), x, y);
  }

  function wrapLines(ctx, value, maxWidth, size, weight, family) {
    const source = safe(value);
    const paragraphs = source.split("\n");
    const lines = [];
    setFont(ctx, size, weight, family);
    paragraphs.forEach(paragraph => {
      if (!paragraph) {
        lines.push("");
        return;
      }
      let line = "";
      for (let index = 0; index < paragraph.length; index += 1) {
        const character = paragraph.charAt(index);
        const candidate = line + character;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = character;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
    });
    return lines.length ? lines : [""];
  }

  function drawWrapped(ctx, value, x, baseline, maxWidth, size, weight, color, lineHeight, maxLines) {
    const step = lineHeight || Math.round(size * 1.4);
    let lines = wrapLines(ctx, value, maxWidth, size, weight);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[lines.length - 1];
      setFont(ctx, size, weight);
      while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = last + "…";
    }
    lines.forEach((line, index) => drawText(ctx, line, x, baseline + index * step, size, weight, color));
    return lines.length;
  }

  function fitText(ctx, value, x, y, maxWidth, size, weight, color, minimum) {
    let current = size;
    const floor = minimum || Math.max(16, Math.round(size * 0.58));
    while (current > floor) {
      setFont(ctx, current, weight);
      if (ctx.measureText(safe(value)).width <= maxWidth) break;
      current -= 1;
    }
    drawText(ctx, value, x, y, current, weight, color);
    return current;
  }

  function tag(ctx, value, x, y, w, h, color, textColor) {
    roundBox(ctx, x, y, w, h, color || lavender, h / 2);
    fitText(ctx, value, x + 18, y + h - 14, w - 36, 21, 700, textColor || ink, 15);
  }

  function background(ctx) {
    roundBox(ctx, 0, 0, width, height, warmWhite, 0);
    ctx.save();
    ctx.globalAlpha = 0.75;
    fill(ctx, lavender);
    ctx.beginPath();
    ctx.arc(910, 44, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    fill(ctx, coral);
    ctx.beginPath();
    ctx.arc(70, 1125, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.32;
    fill(ctx, coral);
    ctx.beginPath();
    ctx.arc(872, 1098, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawImageContain(ctx, image, x, y, w, h) {
    const sourceWidth = image.naturalWidth || image.width || w;
    const sourceHeight = image.naturalHeight || image.height || h;
    const scale = Math.min(w / sourceWidth, h / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    ctx.drawImage(image, x + (w - drawWidth) / 2, y + (h - drawHeight) / 2, drawWidth, drawHeight);
  }

  async function header(ctx, themeName) {
    const image = await loadLogo();
    const logoBox = { x: 80, y: 58, w: 48, h: 48 };
    if (image) drawImageContain(ctx, image, logoBox.x, logoBox.y, logoBox.w, logoBox.h);
    drawText(ctx, "好友默契局", image ? 146 : 80, 96, 31, 800, ink);
    const label = safe(themeName || "自定义题单");
    const tagWidth = Math.min(282, Math.max(150, 34 + label.length * 24));
    tag(ctx, label, width - 80 - tagWidth, 63, tagWidth, 44, lavender, ink);
  }

  function questionTitle(question) {
    const source = safe(question && question.title).replace(/[?？]$/, "");
    if (!source) return "你会选哪一个？";
    return /[。！!？?]$/.test(source) ? source : source + "？";
  }

  function questionOptions(question) {
    const options = question && Array.isArray(question.options) ? question.options : [];
    return [safe(options[0]) || "选项 A", safe(options[1]) || "选项 B"];
  }

  function drawOption(ctx, label, value, x, y, w, h) {
    roundBox(ctx, x, y, w, h, "#FFFFFF", 20);
    roundBorder(ctx, x, y, w, h, border, 20, 2);
    fill(ctx, coral);
    ctx.beginPath();
    ctx.arc(x + 34, y + h / 2, 19, 0, Math.PI * 2);
    ctx.fill();
    setFont(ctx, 20, 800);
    fill(ctx, ink);
    ctx.textAlign = "center";
    ctx.fillText(label, x + 34, y + h / 2 + 7);
    ctx.textAlign = "start";
    drawWrapped(ctx, value, x + 72, y + 34, w - 100, 28, 700, ink, 31, 2);
  }

  function formatCode(code) {
    if (window.FriendQuiz && typeof window.FriendQuiz.formatCode === "function") {
      return window.FriendQuiz.formatCode(code) || safe(code);
    }
    return safe(code);
  }

  function customCode(code) {
    return window.FriendQuiz && typeof window.FriendQuiz.isCustomCode === "function" &&
      window.FriendQuiz.isCustomCode(code);
  }

  async function qr(ctx, code, bounds) {
    const factory = await load("qrcode", "./vendor/qrcode.js");
    const graphic = factory(0, "M");
    graphic.addData("DMQ:" + safe(code));
    graphic.make();
    const count = graphic.getModuleCount();
    const cell = Math.max(1, Math.floor(bounds.size / (count + 8)));
    const size = (count + 8) * cell;
    const x = bounds.x + Math.floor((bounds.size - size) / 2);
    const y = bounds.y + Math.floor((bounds.size - size) / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    roundBox(ctx, x, y, size, size, "#FFFFFF", 0);
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (graphic.isDark(row, column)) {
          fill(ctx, "#111111");
          ctx.fillRect(x + (column + 4) * cell, y + (row + 4) * cell, cell, cell);
        }
      }
    }
    ctx.restore();
  }

  async function codePanel(ctx, model, y, label, hint) {
    const panelX = 80;
    const panelW = 800;
    const panelH = 278;
    const code = safe(model && model.code);
    roundBox(ctx, panelX, y, panelW, panelH, "#FFFFFF", 30);
    roundBorder(ctx, panelX, y, panelW, panelH, border, 30, 2);
    drawText(ctx, label, 116, y + 68, 25, 800, accent);
    drawText(ctx, formatCode(code), 116, y + 124, 27, 700, ink, "Menlo, Consolas, monospace");
    drawText(ctx, hint, 116, y + 235, 21, 600, muted);
    roundBox(ctx, 620, y + 20, 236, 236, "#FFFFFF", 12);
    roundBorder(ctx, 620, y + 20, 236, 236, border, 12, 2);
    if (code) {
      try {
        await qr(ctx, code, { x: 628, y: y + 28, size: 220 });
      } catch (error) {
        drawText(ctx, "二维码暂不可用", 650, y + 142, 19, 600, muted);
      }
    }
  }

  async function drawLongInvite(model) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const total = totalOf(model);
    const question = model.question || {};
    const options = questionOptions(question);
    background(ctx);
    await header(ctx, model.theme || "自定义题单");
    drawText(ctx, "来猜猜我", 80, 184, 64, 800, ink);
    tag(ctx, total + " 题", 80, 212, 116, 42, lavender, ink);
    if (model.name) drawText(ctx, "出题人 · " + safe(model.name), 220, 241, 23, 700, muted);

    // Historical C.1 codes can be much longer than the compact challenge
    // codes. Keep a small readable preview, then give the complete payload a
    // large, isolated QR area so its modules stay comfortably scannable.
    const previewY = 274;
    roundBox(ctx, 80, previewY, 800, 162, lavenderLight, 28);
    roundBox(ctx, 80, previewY, 8, 162, coral, 4);
    tag(ctx, "题目预览", 116, previewY + 24, 116, 34, coral, ink);
    drawWrapped(ctx, questionTitle(question), 116, previewY + 87, 700, 29, 800, ink, 38, 1);
    drawText(ctx, "A  " + options[0] + "　　B  " + options[1], 116, previewY + 139, 21, 700, muted);

    const panelY = 438;
    roundBox(ctx, 80, panelY, 800, 752, "#FFFFFF", 32);
    roundBorder(ctx, 80, panelY, 800, 752, border, 32, 2);
    drawText(ctx, "打开「好友默契局」，选择这张原图作答", 116, panelY + 48, 24, 800, accent);
    drawText(ctx, "二维码包含完整题单，不截断", 116, panelY + 62, 20, 600, muted);
    roundBox(ctx, 140, panelY + 70, 680, 680, "#FFFFFF", 16);
    roundBorder(ctx, 140, panelY + 70, 680, 680, border, 16, 2);
    try {
      await qr(ctx, model.code, { x: 140, y: panelY + 70, size: 680 });
    } catch (error) {
      drawText(ctx, "二维码暂不可用，请保留原图重试", 244, panelY + 397, 23, 600, muted);
    }
    return canvas;
  }

  async function drawInvite(model) {
    if (customCode(model.code)) {
      return drawLongInvite(model);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const total = totalOf(model);
    const themeName = model.theme || "自定义题单";
    const question = model.question || {};
    const options = questionOptions(question);
    background(ctx);
    await header(ctx, themeName);
    drawText(ctx, "来猜猜我", 80, 232, 78, 800, ink);
    tag(ctx, total + " 题", 80, 292, 116, 44, lavender, ink);
    if (model.name) drawText(ctx, "出题人 · " + safe(model.name), 220, 323, 25, 700, muted);

    const cardY = 365;
    roundBox(ctx, 80, cardY, 800, 425, lavenderLight, 32);
    roundBox(ctx, 80, cardY, 9, 425, coral, 4);
    tag(ctx, "第 1 题", 116, cardY + 32, 110, 38, coral, ink);
    const titleLines = drawWrapped(ctx, questionTitle(question), 116, cardY + 125, 700, 36, 800, ink, 48, 2);
    const optionY = cardY + 125 + titleLines * 48 + 30;
    drawOption(ctx, "A", options[0], 116, optionY, 728, 70);
    drawOption(ctx, "B", options[1], 116, optionY + 86, 728, 70);
    await codePanel(ctx, model, 820, "挑战码", "打开「好友默契局」，选图或输码");
    return canvas;
  }

  function scorePanel(ctx, model) {
    const total = totalOf(model);
    const score = safe(model && model.score);
    roundBox(ctx, 80, 215, 800, 353, lavenderLight, 34);
    roundBox(ctx, 80, 215, 9, 353, coral, 4);
    drawText(ctx, "这次猜中了", 124, 278, 29, 700, muted);
    const scoreText = score + " / " + total;
    setFont(ctx, 126, 800, "Georgia, serif");
    const scoreWidth = ctx.measureText(scoreText).width;
    drawText(ctx, scoreText, 120, 414, 126, 800, "#D44856", "Georgia, serif");
    drawText(ctx, "题", 120 + scoreWidth + 20, 407, 34, 800, ink);
    const headline = safe(model && model.headline) || "有些小习惯，还要再认识一点";
    drawWrapped(ctx, headline, 124, 493, 680, 34, 800, ink, 45, 2);
  }

  async function drawResult(model) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    background(ctx);
    await header(ctx, model.theme || "成绩");
    scorePanel(ctx, model);
    if (model.kind === "receipt" && model.code) {
      await codePanel(ctx, model, 704, "成绩回执", "把这张图发回给出题的人");
    } else {
      roundBox(ctx, 80, 704, 800, 278, "#FFFFFF", 30);
      roundBorder(ctx, 80, 704, 800, 278, border, 30, 2);
      drawText(ctx, "下一轮，换我出题", 116, 790, 40, 800, ink);
      drawWrapped(ctx, "在小红书打开「好友默契局」，出一套题给朋友", 116, 855, 670, 28, 600, muted, 40, 2);
    }
    return canvas;
  }

  async function draw(model) {
    const current = model || {};
    if (current.kind === "invite") return drawInvite(current);
    return drawResult(current);
  }

  async function decode(file) {
    if (!file || (file.type && !file.type.startsWith("image/")) || file.size > 20000000) {
      throw new Error("请选一张 20 MB 以内的邀请图或截图");
    }
    const reader = await load("jsQR", "./vendor/jsqr.js");
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("图片打不开，请换一张"));
        element.src = url;
      });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = reader(pixels.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
      const data = result && typeof result.data === "string" ? result.data : "";
      const code = data.startsWith("DMQ:") ? data.slice(4) : "";
      if (code.length > 2300 || !/^(?:[A-Z0-9-]{8,64}|C\.\d+\.[A-Za-z0-9_-]+)$/.test(code)) {
        throw new Error("没识别到好友默契局的码，可以手动填写");
      }
      return code;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.FriendCards = { draw, decode };
}());
