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
    ctx.fillStyle = "#f6f2df";
    ctx.fillRect(0, 0, 750, 1000);

    ctx.fillStyle = "#5b8c2a";
    ctx.beginPath();
    ctx.arc(375, 150, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6f2df";
    ctx.font = "88px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🐹", 375, 182);

    ctx.fillStyle = "#2f2a1e";
    ctx.font = "800 54px sans-serif";
    ctx.fillText("别打地鼠", 375, 322);

    ctx.font = "700 29px sans-serif";
    ctx.fillStyle = "#8a7a5c";
    ctx.fillText("45 秒反向打地鼠 · 只打人，不打鼠", 375, 372);

    ctx.fillStyle = result.score < 0 ? "#c22f2f" : "#5b8c2a";
    ctx.font = "900 148px Georgia, serif";
    ctx.fillText(String(result.score), 375, 522);

    ctx.fillStyle = "#2f2a1e";
    ctx.font = "800 50px sans-serif";
    ctx.fillText(result.title, 375, 606);
    ctx.font = "400 30px sans-serif";
    ctx.fillStyle = "#8a7a5c";
    const line = result.line.length > 24 ? result.line.slice(0, 24) + "…" : result.line;
    ctx.fillText(line, 375, 656);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 70, 692, 610, 96, 16);
    ctx.fill();
    ctx.fillStyle = "#2f2a1e";
    ctx.font = "400 29px sans-serif";
    ctx.fillText("打中人类 " + result.hits + " 个 · 误伤地鼠 " + result.misses + " 只 · 最高连击 " + result.maxCombo, 375, 752);

    // 3x3 hole diagram: dirt mounds with a mix of moles and humans.
    const faces = ["🐹", "🐹", "🧑", "🐹", "👩", "🐹", "🐹", "🧑‍🦱", "🐹"];
    const cell = 46;
    const gap = 9;
    const gridW = cell * 3 + gap * 2;
    const startX = 375 - gridW / 2;
    const startY = 800;
    for (let i = 0; i < 9; i++) {
      const cx = startX + (i % 3) * (cell + gap) + cell / 2;
      const cy = startY + Math.floor(i / 3) * (cell + gap) + cell / 2;
      ctx.fillStyle = "#8a5a28";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "30px sans-serif";
      ctx.fillText(faces[i], cx, cy + 9);
    }

    ctx.font = "700 26px sans-serif";
    ctx.fillStyle = "#5b8c2a";
    ctx.fillText("你也来试试，别打错 →", 375, 978);
    return canvas;
  }

  window.MoleCards = { resultCard };
})();
