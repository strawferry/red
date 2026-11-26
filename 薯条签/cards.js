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

  function fortuneCard(result) {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff8ec";
    ctx.fillRect(0, 0, 750, 1000);

    ctx.fillStyle = "#e2492f";
    ctx.beginPath();
    ctx.arc(375, 128, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "74px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🍟", 375, 156);

    ctx.fillStyle = "#3d2c1e";
    ctx.font = "800 52px sans-serif";
    ctx.fillText("薯条签", 375, 268);
    ctx.font = "700 27px sans-serif";
    ctx.fillStyle = "#a08b74";
    ctx.fillText("抽根薯条 · 看今日运", 375, 312);

    // The fry, drawn to scale on a 0-15cm ruler (x 90..660 maps 0..15cm).
    const x0 = 90;
    const pxPerCm = (660 - x0) / 15;
    const fryW = Math.max(30, result.len * pxPerCm);
    ctx.save();
    ctx.shadowColor = "rgba(185, 51, 32, .25)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    const fryGrad = ctx.createLinearGradient(0, 356, 0, 416);
    fryGrad.addColorStop(0, "#ffd964");
    fryGrad.addColorStop(0.55, "#ffc93c");
    fryGrad.addColorStop(1, "#f0a832");
    ctx.fillStyle = fryGrad;
    roundRect(ctx, x0, 356, fryW, 60, 16);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, .85)";
    for (let i = 0; i < 9; i++) {
      const seed = Math.sin(i * 47.3 + 9.1) * 10000;
      const frac = seed - Math.floor(seed);
      const seed2 = Math.sin(i * 29.7 + 3.3) * 10000;
      const frac2 = seed2 - Math.floor(seed2);
      ctx.beginPath();
      ctx.arc(x0 + 14 + frac * (fryW - 28), 366 + frac2 * 40, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#cbb99e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, 448);
    ctx.lineTo(660, 448);
    ctx.stroke();
    ctx.fillStyle = "#a08b74";
    for (let cm = 0; cm <= 15; cm++) {
      const x = x0 + cm * pxPerCm;
      ctx.fillRect(x - 1.5, 448, 3, cm % 5 === 0 ? 18 : 10);
      if (cm % 5 === 0) {
        ctx.font = "700 22px sans-serif";
        ctx.fillText(String(cm), x, 494);
      }
    }
    ctx.font = "700 22px sans-serif";
    ctx.fillText("cm", 660, 494);

    ctx.fillStyle = "#b93320";
    ctx.font = "900 118px Georgia, serif";
    ctx.fillText(result.len.toFixed(1), 375, 616);
    ctx.font = "700 30px sans-serif";
    ctx.fillStyle = "#a08b74";
    ctx.fillText("厘米", 375, 652);

    ctx.fillStyle = "#e2492f";
    ctx.font = "800 56px sans-serif";
    ctx.fillText(result.tier, 375, 726);

    ctx.fillStyle = "#3d2c1e";
    ctx.font = "700 34px sans-serif";
    const fortune = "「" + result.fortune + "」";
    ctx.fillText(fortune, 375, 786);
    ctx.font = "400 26px sans-serif";
    ctx.fillStyle = "#a08b74";
    const explain = result.explain.length > 26 ? result.explain.slice(0, 26) + "…" : result.explain;
    ctx.fillText(explain, 375, 830);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 95, 862, 560, 58, 14);
    ctx.fill();
    ctx.fillStyle = "#3d2c1e";
    ctx.font = "400 25px sans-serif";
    ctx.fillText("幸运物 " + result.item + " · 幸运色 " + result.color, 375, 900);

    const d = new Date(result.stamp || Date.now());
    ctx.font = "700 23px sans-serif";
    ctx.fillStyle = "#e2492f";
    ctx.fillText(d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 · 你今天抽到多长？→", 375, 966);
    return canvas;
  }

  window.FriesCards = { fortuneCard };
})();
