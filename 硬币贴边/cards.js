(function () {
  "use strict";

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCoin(ctx, cx, cy, r) {
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
    grad.addColorStop(0, "#ffe9a8");
    grad.addColorStop(0.65, "#f5b93f");
    grad.addColorStop(1, "#d98a12");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b96f06";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(185, 111, 6, .55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#8a5203";
    ctx.font = "900 " + Math.round(r * 1.05) + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("¥", cx, cy + 2);
    ctx.textBaseline = "alphabetic";
  }

  // result: { bestMm (number|null), bestTitle, bestLine, attempts: [{fell, mm}] , bestGapPx }
  function resultCard(result) {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fdf6ec";
    ctx.fillRect(0, 0, 750, 1000);
    ctx.textAlign = "center";

    drawCoin(ctx, 375, 150, 74);

    ctx.fillStyle = "#33302a";
    ctx.font = "800 54px sans-serif";
    ctx.fillText("硬币贴边", 375, 292);

    ctx.font = "700 30px sans-serif";
    ctx.fillStyle = "#97836a";
    ctx.fillText("离悬崖最近的一次——", 375, 344);

    if (result.bestMm !== null) {
      ctx.fillStyle = "#d98a12";
      ctx.font = "900 138px Georgia, serif";
      ctx.fillText(result.bestMm + "mm", 375, 500);
      ctx.fillStyle = "#33302a";
      ctx.font = "800 52px sans-serif";
      ctx.fillText(result.bestTitle, 375, 586);
      ctx.font = "400 31px sans-serif";
      ctx.fillStyle = "#97836a";
      ctx.fillText(result.bestLine, 375, 640);
    } else {
      ctx.fillStyle = "#c2452d";
      ctx.font = "900 96px Georgia, serif";
      ctx.fillText("全军覆没", 375, 492);
      ctx.fillStyle = "#33302a";
      ctx.font = "800 50px sans-serif";
      ctx.fillText("三枚全飞了", 375, 578);
      ctx.font = "400 31px sans-serif";
      ctx.fillStyle = "#97836a";
      ctx.fillText("手劲太猛啦，下次轻一点。", 375, 632);
    }

    // Diagram: table top view with the best coin position and the cliff.
    const dx = 85, dw = 580, dy = 700, dh = 30;
    ctx.fillStyle = "#8a5a33";
    roundRect(ctx, dx, dy, dw, dh, 8);
    ctx.fill();
    ctx.fillStyle = "#6e4525";
    ctx.fillRect(dx + dw - 10, dy, 10, dh + 66);
    ctx.fillStyle = "#c2452d";
    ctx.font = "700 25px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("桌沿 ▼", dx + dw, dy - 14);
    ctx.textAlign = "center";
    if (result.bestMm !== null && result.bestGapPx !== undefined) {
      const scale = dw / 316; // logical table span 6..322
      const rightEdge = dx + dw;
      const coinRight = rightEdge - result.bestGapPx * scale;
      drawCoin(ctx, coinRight - 21 * scale, dy + dh / 2, 21 * scale);
      ctx.strokeStyle = "#d98a12";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(coinRight, dy - 34);
      ctx.lineTo(rightEdge, dy - 34);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      drawCoin(ctx, dx + dw + 44, dy + 96, 26);
      ctx.fillStyle = "#97836a";
      ctx.font = "400 24px sans-serif";
      ctx.fillText("↓ 掉下去了", dx + dw + 44, dy + 152);
    }

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 85, 838, 580, 74, 14);
    ctx.fill();
    ctx.fillStyle = "#33302a";
    ctx.font = "400 28px sans-serif";
    const tries = result.attempts.map((a, i) =>
      "第" + (i + 1) + "次 " + (a.fell ? "坠落" : a.mm + "mm")).join(" · ");
    ctx.fillText(tries, 375, 885);

    ctx.font = "700 28px sans-serif";
    ctx.fillStyle = "#d98a12";
    ctx.fillText("你敢把硬币停在几毫米？ →", 375, 962);
    return canvas;
  }

  window.CoinCards = { resultCard };
})();
