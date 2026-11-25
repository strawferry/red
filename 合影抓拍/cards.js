(function () {
  "use strict";

  const game = window.PhotoGame;

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
    ctx.fillStyle = "#f4f8fb";
    ctx.fillRect(0, 0, 750, 1000);

    ctx.fillStyle = "#2f7fb8";
    ctx.beginPath();
    ctx.arc(375, 138, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f8fb";
    ctx.font = "80px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📸", 375, 168);

    ctx.fillStyle = "#26303a";
    ctx.font = "800 54px sans-serif";
    ctx.fillText("合影抓拍", 375, 292);
    ctx.font = "700 29px sans-serif";
    ctx.fillStyle = "#7d8a94";
    ctx.fillText("等全员就绪，才按快门", 375, 340);

    // Best photo: polaroid-style frame with the frozen moment.
    const best = result.shots[result.bestIdx];
    ctx.save();
    ctx.shadowColor = "rgba(38, 48, 58, .25)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 95, 372, 560, 218, 10);
    ctx.fill();
    ctx.restore();
    const sky = ctx.createLinearGradient(0, 386, 0, 520);
    sky.addColorStop(0, "#aee3ff");
    sky.addColorStop(0.72, "#e8f7ff");
    sky.addColorStop(0.721, "#8fce6e");
    sky.addColorStop(1, "#6cb84f");
    ctx.fillStyle = sky;
    roundRect(ctx, 109, 386, 532, 148, 6);
    ctx.fill();
    const slot = 532 / 6;
    best.states.forEach((state, index) => {
      const cx = 109 + slot * index + slot / 2;
      const sink = state === "down" ? 34 : 0;
      ctx.font = "52px sans-serif";
      ctx.fillText(game.faceFor(index, state), cx, 486 + sink);
      if (state !== "ready") {
        ctx.strokeStyle = "#c22f2f";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, 462 + sink, 36, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#26303a";
      ctx.font = "700 20px sans-serif";
      ctx.fillText(game.CAST[index].name, cx, 560);
      ctx.fillStyle = "#26303a";
    });
    ctx.fillStyle = "#7d8a94";
    ctx.font = "700 24px sans-serif";
    ctx.fillText("最佳照片 · 第 " + (result.bestIdx + 1) + " 张 · " + best.ready + "/6 就绪", 375, 622);

    ctx.fillStyle = "#1d5a87";
    ctx.font = "900 132px Georgia, serif";
    ctx.fillText(String(result.score), 375, 748);

    ctx.fillStyle = "#26303a";
    ctx.font = "800 48px sans-serif";
    ctx.fillText(result.title, 375, 812);
    ctx.font = "400 29px sans-serif";
    ctx.fillStyle = "#7d8a94";
    const line = result.line.length > 24 ? result.line.slice(0, 24) + "…" : result.line;
    ctx.fillText(line, 375, 858);

    // Gallery strip: all five shots with scores.
    const avg = Math.round(result.shots.reduce((sum, s) => sum + s.score, 0) / result.shots.length);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 70, 884, 610, 62, 14);
    ctx.fill();
    ctx.fillStyle = "#26303a";
    ctx.font = "400 25px sans-serif";
    const gallery = result.shots.map((shot, index) => "第" + (index + 1) + "张 " + shot.score).join(" · ");
    ctx.fillText(gallery + " · 平均 " + avg, 375, 924);

    ctx.font = "700 24px sans-serif";
    ctx.fillStyle = "#2f7fb8";
    ctx.fillText("你也来试试，能拍出满分合影吗 →", 375, 978);
    return canvas;
  }

  window.PhotoCards = { resultCard };
})();
