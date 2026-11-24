(function () {
  "use strict";

  const KEY = "world_clock_settings.v1";
  let launchPromise;

  function sdk() {
    return window.xhs && window.xhs.miniTool;
  }

  function request(method, payload, waitMs) {
    const tool = sdk();
    return new Promise((resolve, reject) => {
      let timer = 0;
      function finish(callback, value) {
        window.clearTimeout(timer);
        callback(value);
      }
      if (!tool || typeof tool[method] !== "function") {
        reject(new Error("当前环境不支持此操作"));
        return;
      }
      if (waitMs) timer = window.setTimeout(() => reject(new Error("小红书接口响应超时")), waitMs);
      try {
        Promise.resolve(payload === undefined ? tool[method]() : tool[method](payload))
          .then(value => finish(resolve, value), error => finish(reject, error));
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  function launch() {
    const cached = window.xhs && window.xhs.launchOptions;
    if (client(cached) !== null) return Promise.resolve(cached);
    if (!launchPromise) {
      launchPromise = request("getLaunchOptions", undefined, 1600).catch(() => cached || null);
    }
    return launchPromise;
  }

  function client(options) {
    const env = options && options.miniToolEnv;
    const raw = env && env.buildVersion;
    if (!/^[1-9][0-9]{6,}$/.test(String(raw))) return null;
    const version = Number(raw);
    return Number.isSafeInteger(version) ? Math.floor(version / 1000) : null;
  }

  async function has(method, minimum) {
    const tool = sdk();
    if (!tool || typeof tool[method] !== "function") return false;
    if (!minimum) return true;
    const version = client(await launch());
    return version !== null && version >= minimum;
  }

  async function loadSettings() {
    if (!(await has("getStorage", 9460)) || !(await has("setStorage", 9460))) {
      return { available: false, value: null };
    }
    let result;
    try {
      result = await request("getStorage", { key: KEY }, 2500);
    } catch (error) {
      if (await has("getStorageInfo", 9460)) {
        const info = await request("getStorageInfo", undefined, 2500);
        if (info && Array.isArray(info.keys) && info.keys.indexOf(KEY) === -1) {
          return { available: true, value: null };
        }
      }
      throw error;
    }
    if (!result || !Object.prototype.hasOwnProperty.call(result, "data")) throw new Error("读取缓存失败");
    return { available: true, value: result.data === null ? null : JSON.parse(result.data) };
  }

  async function saveSettings(value) {
    const result = await request("setStorage", { key: KEY, data: value }, 2500);
    if (!result || result.errMsg !== "setStorage:ok") throw new Error("保存未获确认");
  }

  function visibleRect(rect) {
    return rect && rect.width > 0 && rect.height > 0 && Number.isFinite(rect.bottom);
  }

  function applyInsets(info) {
    if (!info) return;
    const safe = info.safeArea || {};
    const buttons = info.menuButtons || {};
    const rects = visibleRect(buttons.capsule) ? [buttons.capsule] : [buttons.back, buttons.share, buttons.me];
    const top = rects.filter(visibleRect).reduce((max, rect) => Math.max(max, rect.bottom), safe.top || 0);
    const bottom = Number.isFinite(safe.bottom) && info.windowHeight ? Math.max(0, info.windowHeight - safe.bottom) : 0;
    const style = document.documentElement.style;
    style.setProperty("--native-top", top + "px");
    style.setProperty("--native-bottom", bottom + "px");
    // The side-swipe hit area describes a gesture, independent of the display's safe area.
    const width = info.windowWidth;
    if (Number.isFinite(width) && Number.isFinite(safe.left) && safe.left >= 0 &&
        Number.isFinite(safe.right) && safe.right > safe.left && safe.right <= width) {
      style.setProperty("--native-left", safe.left + "px");
      style.setProperty("--native-right", (width - safe.right) + "px");
    } else {
      style.removeProperty("--native-left");
      style.removeProperty("--native-right");
    }
  }

  async function refreshInsets() {
    const sync = window.xhs && window.xhs.launchOptions;
    const snapshot = sync && sync.miniToolEnv && sync.miniToolEnv.windowInfo;
    if (snapshot) applyInsets(snapshot);
    if (await has("getWindowInfo", 9490)) {
      try {
        applyInsets(await request("getWindowInfo", undefined, 1500));
      } catch (error) {
        // Keep the launch snapshot or the CSS safe-area values.
      }
    }
  }

  async function photoPath(canvas) {
    const data = canvas.toDataURL("image/png");
    if (data.length < 145000 || !(await has("writeTempFile"))) return data;
    const result = await request("writeTempFile", { data }, 4000);
    if (!result || !result.filePath) throw new Error("无法生成图片文件");
    return result.filePath;
  }

  window.ClockPlatform = {
    loadSettings, saveSettings, refreshInsets, has,
    async saveImage(canvas) {
      return request("saveImageToPhotosAlbum", { filePath: await photoPath(canvas) });
    },
    async shareImage(canvas) {
      return request("share", { type: "image", image_resource: await photoPath(canvas) });
    },
    async openNote(canvases, title, content) {
      const pictures = [];
      for (const canvas of canvases) pictures.push({ url: await photoPath(canvas) });
      return request("postNote", { title, content, pageType: "photo_publish", mediaInfo: { image_resources: pictures } });
    }
  };
}());
