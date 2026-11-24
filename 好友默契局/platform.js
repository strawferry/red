(function () {
  "use strict";

  const STORAGE_KEY = "friend_quiz_v1";
  const minimum = {
    getStorage: 9460,
    setStorage: 9460,
    getStorageInfo: 9460,
    getWindowInfo: 9490,
    interactionOpenApi: 9490,
    vibrateShort: 9500,
    share: 9530,
    saveImageToPhotosAlbum: 9420
  };
  let launchPromise;
  let version = null;

  function sdk() {
    return window.xhs && window.xhs.miniTool;
  }

  function deadline(task, ms) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("小红书接口响应超时")), ms);
      Promise.resolve().then(task).then(value => {
        window.clearTimeout(timer);
        resolve(value);
      }, error => {
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function request(method, payload, timeout) {
    const tool = sdk();
    if (!tool || typeof tool[method] !== "function") return Promise.reject(new Error("此环境暂不支持"));
    const invoke = () => payload === undefined ? tool[method]() : tool[method](payload);
    return timeout ? deadline(invoke, timeout) : Promise.resolve().then(invoke);
  }

  function readClient(options) {
    const env = options && options.miniToolEnv;
    const raw = env && env.buildVersion;
    if (!/^[1-9][0-9]{6,}$/.test(String(raw))) return null;
    const build = Number(raw);
    return Number.isSafeInteger(build) ? Math.floor(build / 1000) : null;
  }

  function has(method) {
    const tool = sdk();
    return Boolean(tool && typeof tool[method] === "function" &&
      (!minimum[method] || (version !== null && version >= minimum[method])));
  }

  function applyInsets(info) {
    if (!info) return;
    const safe = info.safeArea || {};
    const buttons = info.menuButtons || {};
    const capsule = buttons.capsule;
    const rects = capsule && capsule.width > 0 && capsule.height > 0 ? [capsule] :
      [buttons.back, buttons.me, buttons.share];
    const top = rects.reduce((maximum, rect) => {
      return rect && rect.width > 0 && rect.height > 0 && Number.isFinite(rect.bottom) ?
        Math.max(maximum, rect.bottom) : maximum;
    }, Number.isFinite(safe.top) ? Math.max(0, safe.top) : 0);
    const bottom = Number.isFinite(safe.bottom) && Number.isFinite(info.windowHeight) ?
      Math.max(0, info.windowHeight - safe.bottom) : 0;
    document.documentElement.style.setProperty("--native-top", top + "px");
    document.documentElement.style.setProperty("--native-bottom", bottom + "px");
  }

  function init() {
    if (launchPromise) return launchPromise;
    const options = window.xhs && window.xhs.launchOptions;
    version = readClient(options);
    applyInsets(options && options.miniToolEnv && options.miniToolEnv.windowInfo);
    launchPromise = version !== null ? Promise.resolve() :
      request("getLaunchOptions", undefined, 1300).then(result => {
        version = readClient(result);
        applyInsets(result && result.miniToolEnv && result.miniToolEnv.windowInfo);
      }).catch(() => {});
    return launchPromise;
  }

  async function refreshInsets() {
    await init();
    if (has("getWindowInfo")) {
      try {
        applyInsets(await request("getWindowInfo", undefined, 1500));
      } catch (error) {
        // Keep the launch snapshot while the container is changing size.
      }
    }
  }

  async function read() {
    await init();
    if (!has("getStorage") || !has("setStorage")) return { supported: false, data: null };
    try {
      const result = await request("getStorage", { key: STORAGE_KEY }, 2100);
      if (!result || !Object.prototype.hasOwnProperty.call(result, "data")) throw new Error("读取未获确认");
      return { supported: true, data: result.data === null || result.data === "" ? null : JSON.parse(result.data) };
    } catch (error) {
      if (has("getStorageInfo")) {
        const info = await request("getStorageInfo", undefined, 1500);
        if (info && Array.isArray(info.keys) && !info.keys.includes(STORAGE_KEY)) {
          return { supported: true, data: null };
        }
      }
      throw error;
    }
  }

  async function write(data) {
    const result = await request("setStorage", { key: STORAGE_KEY, data }, 2200);
    if (!result || result.errMsg !== "setStorage:ok") throw new Error("保存未获确认");
  }

  async function imagePath(canvas, needsPath) {
    const data = canvas.toDataURL("image/png");
    if (!needsPath && (data.length < 145000 || !has("writeTempFile"))) return data;
    const result = await request("writeTempFile", { data }, 3000);
    if (!result || typeof result.filePath !== "string") throw new Error("图片文件未生成");
    return result.filePath;
  }

  function hasAI() {
    const ai = window.xhs && window.xhs.AI;
    return Boolean(ai && typeof ai.createModel === "function");
  }

  function draftQuestions(theme, count) {
    return deadline(async () => {
      const model = window.xhs.AI.createModel("deepseek-v4-flash");
      const questions = theme.questions.map(question => question.id + " " + question.title).join("\n");
      const result = await model.generateText({
        messages: [
          { role: "system", content: "为朋友间的生活偏好小测验选题。只从提供的编号中选择 " + count + " 个不同编号，尽量兼顾不同话题。只输出 JSON 整数数组，不输出其它内容。" },
          { role: "user", content: theme.name + "\n" + questions }
        ],
        max_output_tokens: 128
      });
      const choice = result && result.choices && result.choices[0];
      const answer = choice && choice.message && choice.message.content;
      const array = typeof answer === "string" && answer.match(/\[[\d\s,]+\]/);
      const ids = array ? JSON.parse(array[0]) : [];
      const inTheme = ids.every(id => theme.questions.some(question => question.id === id));
      if (ids.length !== count || new Set(ids).size !== count || !inTheme) throw new Error("没有收到完整题单");
      return ids.slice().sort((left, right) => left - right);
    }, 9500);
  }

  window.FriendPlatform = {
    init, refreshInsets, read, write, has, hasAI, draftQuestions,
    shareTool() { return request("share", { type: "card" }); },
    async saveImage(canvas) {
      return request("saveImageToPhotosAlbum", { filePath: await imagePath(canvas) });
    },
    async shareImage(canvas) {
      return request("share", { type: "image", image_resource: await imagePath(canvas) });
    },
    async openNote(canvas, title, content) {
      return request("postNote", {
        title, content, pageType: "photo_publish", mediaInfo: { image_resources: [{ url: await imagePath(canvas) }] }
      });
    },
    async openComment(canvas, content, kind) {
      const file = await imagePath(canvas, true);
      return request("interactionOpenApi", {
        payload: {
          action: "post_comment", content,
          media_bean: [{ media_type: "image", cover_image_url: file }],
          miniToolSnapshotInfo: JSON.stringify({ tool: "friend_quiz", page: kind })
        },
        saveToAlbum: false
      });
    },
    reveal() {
      if (has("vibrateShort")) request("vibrateShort", { type: "light" }).catch(() => {});
    }
  };
}());
