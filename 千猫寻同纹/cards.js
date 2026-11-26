(function () {
  "use strict";

  const game = window.CatsGame;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Schematic of one cat drawn from its four attributes: coat disc + face emoji,
  // forehead mark and collar drawn as shapes so the card reads without filters.
  function drawCat(ctx, cat, cx, cy, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    // Backdrop disc in the coat colour.
    ctx.fillStyle = game.COATS[cat.coat].disc;
    ctx.beginPath();
    ctx.arc(0, 0, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(58, 46, 42, .14)";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Face.
    ctx.font = "118px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(game.faceFor(cat), 0, 8);
    // Forehead mark.
    if (cat.mark === 1) {
      ctx.fillStyle = "#8a5a33";
      [-26, 0, 26].forEach(offset => {
        roundRect(ctx, offset - 5, -88, 10, 34, 5);
        ctx.fill();
      });
    } else if (cat.mark === 2) {
      ctx.fillStyle = "#a03d2d";
      ctx.beginPath();
      ctx.arc(0, -72, 13, 0, Math.PI * 2);
      ctx.fill();
    } else if (cat.mark === 3) {
      ctx.fillStyle = "#e5537a";
      ctx.font = "44px sans-serif";
      ctx.fillText("♥", 0, -68);
    } else if (cat.mark === 4) {
      ctx.font = "42px sans-serif";
      ctx.fillText("⚡", 0, -68);
    }
    // Collar at the neck.
    if (cat.collar > 0) {
      ctx.fillStyle = cat.collar === 1 ? "#d63c32" : cat.collar === 2 ? "#3a6fd8" : "#f2b134";
      roundRect(ctx, -52, 62, 104, 15, 8);
      ctx.fill();
      if (cat.collar === 3) {
        ctx.fillStyle = "#f7c948";
        ctx.beginPath();
        ctx.arc(0, 88, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c9930a";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  function chipsText(cat) {
    return "毛色 " + game.COATS[cat.coat].name + " · 额纹 " + game.MARKS[cat.mark].name +
      " · 眼睛 " + game.EYES[cat.eyes].name + " · 项圈 " + game.COLLARS[cat.collar].name;
  }

  function resultCard(result) {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fdf6ec";
    ctx.fillRect(0, 0, 750, 1000);

    ctx.fillStyle = "#f6a8b8";
    ctx.beginPath();
    ctx.arc(375, 128, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fdf6ec";
    ctx.font = "74px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🐱", 375, 156);

    ctx.fillStyle = "#3a2e2a";
    ctx.font = "800 54px sans-serif";
    ctx.fillText("千猫寻同纹", 375, 272);
    ctx.font = "700 29px sans-serif";
    ctx.fillStyle = "#a08b80";
    ctx.fillText("千猫之中，只认同纹那只", 375, 318);

    // The found cat, drawn from its attributes.
    ctx.save();
    ctx.shadowColor = "rgba(58, 46, 42, .18)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 145, 348, 460, 252, 14);
    ctx.fill();
    ctx.restore();
    drawCat(ctx, result.target, 375, 462, 1.05);
    ctx.fillStyle = "#a08b80";
    ctx.font = "700 23px sans-serif";
    ctx.fillText(chipsText(result.target), 375, 582);

    ctx.fillStyle = "#c25e1d";
    ctx.font = "900 118px Georgia, serif";
    ctx.fillText(game.formatTime(result.score).replace(" 秒", ""), 375, 726);

    ctx.fillStyle = "#3a2e2a";
    ctx.font = "800 48px sans-serif";
    ctx.fillText(result.title, 375, 792);
    ctx.font = "400 29px sans-serif";
    ctx.fillStyle = "#a08b80";
    const line = result.line.length > 24 ? result.line.slice(0, 24) + "…" : result.line;
    ctx.fillText(line, 375, 838);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 70, 872, 610, 62, 14);
    ctx.fill();
    ctx.fillStyle = "#3a2e2a";
    ctx.font = "400 25px sans-serif";
    ctx.fillText("实际用时 " + game.formatTime(result.elapsed) + " · 点错 " + result.wrongs +
      " 次 · 罚时 +" + result.penalty + " 秒", 375, 912);

    ctx.font = "700 24px sans-serif";
    ctx.fillStyle = "#e8813a";
    ctx.fillText("180 只猫里，你能多快找到它 →", 375, 978);
    return canvas;
  }

  window.CatsCards = { resultCard, drawCat };
})();
