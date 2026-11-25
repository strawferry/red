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

  function resultCard(result) {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff7ee";
    ctx.fillRect(0, 0, 750, 1000);

    ctx.fillStyle = "#c22f2f";
    ctx.beginPath();
    ctx.arc(375, 168, 108, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ee";
    ctx.font = "92px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🌶️", 375, 200);

    ctx.fillStyle = "#33231c";
    ctx.font = "800 54px sans-serif";
    ctx.fillText("麻辣烫挑战", 375, 348);

    ctx.font = "700 30px sans-serif";
    ctx.fillStyle = "#8a6f5c";
    ctx.fillText("目标 250g，我这一碗——", 375, 402);

    ctx.fillStyle = "#c22f2f";
    ctx.font = "900 150px Georgia, serif";
    ctx.fillText(result.total + "g", 375, 560);

    const diffText = result.diff === 0 ? "正好 250g，一克不差！" :
      (result.diff > 0 ? "超了 " : "差了 ") + Math.abs(result.diff) + " 克";
    ctx.fillStyle = "#33231c";
    ctx.font = "800 52px sans-serif";
    ctx.fillText(result.title, 375, 650);
    ctx.font = "400 32px sans-serif";
    ctx.fillStyle = "#8a6f5c";
    ctx.fillText(diffText + " · " + result.line, 375, 706);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 70, 748, 610, 132, 16);
    ctx.fill();
    ctx.fillStyle = "#33231c";
    ctx.font = "400 29px sans-serif";
    const summary = result.summary.length > 34 ? result.summary.slice(0, 34) + "…" : result.summary;
    ctx.fillText(summary, 375, 802);
    ctx.fillStyle = "#8a6f5c";
    ctx.font = "400 26px sans-serif";
    ctx.fillText("一共 " + result.count + " 件食材", 375, 848);

    ctx.font = "700 28px sans-serif";
    ctx.fillStyle = "#c22f2f";
    ctx.fillText("你也来挑战正好 250 克 →", 375, 946);
    return canvas;
  }

  window.MalatangCards = { resultCard };
})();
