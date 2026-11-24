(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const app = byId("app");
  const cake = byId("cake");
  const geometry = window.CakeCuts;
  const art = window.CakeArt;
  const platform = window.CakePlatform;

  function explainFallback() {
    byId("notice").textContent = "图形暂时无法加载，仍可参考圆形 6 份的切法。";
    byId("notice").hidden = false;
  }

  if (!geometry || !art || !platform || !cake.getContext("2d")) {
    explainFallback();
    return;
  }

  let shape = "round";
  let count = 6;
  let plan;
  let frame = 0;
  let activeStep = -1;
  let posterCanvas = null;
  let busy = false;
  let resizeTimer = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const shapes = Array.from(document.querySelectorAll("[data-shape]"));
  const presets = Array.from(document.querySelectorAll("[data-count]"));
  const overlay = byId("overlay");

  function describe() {
    app.dataset.shape = shape;
    byId("portion-count").textContent = String(count);
    byId("shape-limit").hidden = shape !== "heart";
    const range = geometry.shapes[shape];
    byId("minus").disabled = count <= range.min;
    byId("plus").disabled = count >= range.max;
    for (const button of shapes) {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.shape === shape));
    }
    for (const button of presets) {
      const option = Number(button.dataset.count);
      button.disabled = option < range.min || option > range.max;
      button.setAttribute("aria-pressed", String(option === count));
    }
    const step = plan.cuts[activeStep];
    const instruction = step ? step.caption.replace(/^第\s*\d+\s*刀[：:]\s*/, "") : plan.hint;
    byId("knife-count").textContent = step ?
      "第 " + (activeStep + 1) + " / " + plan.cuts.length + " 刀" : "共 " + plan.cuts.length + " 刀";
    byId("cut-hint").textContent = instruction;
    byId("step").textContent = step ? "看全图" : "逐刀看";
    byId("steps").hidden = !step;
    byId("prev").disabled = activeStep <= 0;
    byId("next").disabled = activeStep >= plan.cuts.length - 1;
    byId("status").textContent = step ?
      byId("knife-count").textContent + "，" + instruction :
      geometry.shapes[shape].name + "蛋糕分成 " + count + " 份，共 " + plan.cuts.length + " 刀";
    byId("stage").setAttribute("aria-label", byId("status").textContent + "。点击重播切法");
  }

  function finishDrawing() {
    art.draw(cake, plan, {
      progress: activeStep < 0 ? plan.cuts.length : activeStep + 1,
      focus: activeStep,
      showPieces: activeStep < 0,
      stepLabels: activeStep >= 0
    });
  }

  function stopAnimation() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function animate() {
    stopAnimation();
    if (reducedMotion.matches || document.hidden || !plan.cuts.length) {
      finishDrawing();
      return;
    }
    const currentPlan = plan;
    const cutDuration = Math.min(950, 430 + currentPlan.cuts.length * 43);
    const settleDuration = 130;
    let started = null;
    let lastDraw = -Infinity;
    let slowFrames = 0;
    art.draw(cake, plan, { progress: 0, focus: -1, showPieces: false });
    function tick(timestamp) {
      if (currentPlan !== plan) return;
      if (started === null) started = timestamp;
      const elapsed = timestamp - started;
      if (elapsed >= cutDuration + settleDuration || slowFrames >= 2) {
        frame = 0;
        finishDrawing();
        return;
      }
      if (timestamp - lastDraw >= 30) {
        const start = performance.now();
        const cutProgress = Math.min(1, elapsed / cutDuration);
        const progress = cutProgress * currentPlan.cuts.length;
        const settled = cutProgress === 1;
        const bounce = settled ? (elapsed - cutDuration) / settleDuration : 0;
        const pieceScale = 1 - 0.28 * Math.pow(1 - bounce, 2) + 0.14 * Math.sin(Math.PI * bounce);
        art.draw(cake, currentPlan, { progress, focus: settled ? -1 : Math.floor(progress),
          showPieces: settled, pieceScale });
        slowFrames = performance.now() - start > 26 ? slowFrames + 1 : 0;
        lastDraw = timestamp;
      }
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
  }

  function choose(nextShape, nextCount) {
    const range = geometry.shapes[nextShape];
    const desired = Math.min(range.max, Math.max(range.min, nextCount));
    if (shape === nextShape && count === desired) return;
    const nextPlan = geometry.plan(nextShape, desired);
    shape = nextShape;
    count = desired;
    plan = nextPlan;
    activeStep = -1;
    describe();
    animate();
  }

  function stepTo(step) {
    stopAnimation();
    activeStep = Math.max(-1, Math.min(step, plan.cuts.length - 1));
    describe();
    finishDrawing();
    if (activeStep >= 0 && document.activeElement && document.activeElement.disabled) byId("step").focus();
  }

  function replay() {
    activeStep = -1;
    describe();
    animate();
  }

  async function openPoster() {
    if (busy || !overlay.hidden) return;
    let picture;
    try {
      picture = art.poster(plan);
      if (!picture) throw new Error("无法绘制分切图");
    } catch (error) {
      byId("notice").textContent = "分切图暂未生成，请再试一次。";
      byId("notice").hidden = false;
      return;
    }
    const body = byId("poster-body");
    body.textContent = "";
    picture.setAttribute("role", "img");
    picture.setAttribute("aria-label", geometry.shapes[shape].name + "蛋糕分成 " + count + " 份的完整切法");
    body.appendChild(picture);
    posterCanvas = picture;
    byId("notice").hidden = true;
    byId("poster-hint").hidden = true;
    byId("poster-actions").hidden = true;
    byId("poster-status").hidden = true;
    overlay.hidden = false;
    app.setAttribute("aria-hidden", "true");
    if ("inert" in app) app.inert = true;
    document.body.classList.add("locked");
    body.scrollTop = 0;
    byId("poster-close").focus();
    const support = await Promise.all([
      platform.has("saveImageToPhotosAlbum", 9420),
      platform.has("share", 9530),
      platform.has("postNote")
    ]);
    if (posterCanvas !== picture) return;
    ["save", "share", "post"].forEach((id, i) => { byId(id).hidden = !support[i]; });
    byId("poster-actions").hidden = !support.some(Boolean);
    byId("poster-hint").hidden = support.some(Boolean);
  }

  function closePoster() {
    if (busy || overlay.hidden) return;
    overlay.hidden = true;
    app.removeAttribute("aria-hidden");
    if ("inert" in app) app.inert = false;
    document.body.classList.remove("locked");
    posterCanvas = null;
    byId("poster-body").textContent = "";
    byId("poster-open").focus();
  }

  function posterStatus(message) {
    const status = byId("poster-status");
    status.textContent = message;
    status.hidden = !message;
  }

  async function deliver(action) {
    if (!posterCanvas || busy) return;
    busy = true;
    const controls = overlay.querySelectorAll("button");
    controls.forEach(button => { button.disabled = true; });
    posterStatus("");
    try {
      if (action === "save") {
        const response = await platform.saveImage(posterCanvas);
        if (!response || response.errMsg !== "saveImageToPhotosAlbum:ok") throw new Error("保存未获确认");
        posterStatus("已保存到相册");
      } else if (action === "share") {
        await platform.shareImage(posterCanvas);
      } else {
        await platform.openNote(posterCanvas, geometry.shapes[shape].name + "蛋糕怎么切" + count + "份", plan.hint);
      }
    } catch (error) {
      if (action === "share" && Number(error && error.errCode) === 15502) {
        posterStatus("请在小红书全屏打开再分享，也可以先保存图片。");
      } else {
        posterStatus(action === "save" ? "保存未完成，请检查相册权限。" : "操作未完成，可以稍后再试。");
      }
    } finally {
      busy = false;
      controls.forEach(button => { button.disabled = false; });
    }
  }

  // Draw the initial result before enabling the adjustable controls.
  try {
    plan = geometry.plan(shape, count);
    finishDrawing();
  } catch (error) {
    explainFallback();
    return;
  }
  cake.hidden = false;
  byId("fallback").hidden = true;
  describe();
  for (const button of shapes) button.addEventListener("click", () => choose(button.dataset.shape, count));
  for (const button of presets) button.addEventListener("click", () => choose(shape, Number(button.dataset.count)));
  byId("minus").addEventListener("click", () => choose(shape, count - 1));
  byId("plus").addEventListener("click", () => choose(shape, count + 1));
  byId("step").addEventListener("click", () => stepTo(activeStep < 0 ? 0 : -1));
  byId("prev").addEventListener("click", () => stepTo(activeStep - 1));
  byId("next").addEventListener("click", () => stepTo(activeStep + 1));
  ["replay", "stage"].forEach(id => byId(id).addEventListener("click", replay));
  byId("poster-open").addEventListener("click", openPoster);
  byId("poster-close").addEventListener("click", closePoster);
  ["save", "share", "post"].forEach(id => byId(id).addEventListener("click", () => deliver(id)));
  overlay.addEventListener("click", event => { if (event.target === overlay) closePoster(); });
  document.addEventListener("keydown", event => {
    if (overlay.hidden) return;
    if (event.key === "Escape") closePoster();
    if (event.key !== "Tab") return;
    const items = Array.from(overlay.querySelectorAll("button")).filter(button => !button.disabled && button.getClientRects().length);
    const first = items[0];
    const last = items[items.length - 1];
    if (items.length && document.activeElement === (event.shiftKey ? first : last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frame) {
      stopAnimation();
      finishDrawing();
    }
    if (!document.hidden) platform.refreshInsets();
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(platform.refreshInsets, 100);
  });
  ["replay", "stage", "step", "poster-open"].forEach(id => { byId(id).disabled = false; });
  app.dataset.ready = "true";
  platform.refreshInsets();
}());
