(function () {
  'use strict';

  const namespace = 'tianxuan.';
  let version = null;
  let windowInfo = null;
  let writeQueue = Promise.resolve();
  let shareBlocked = false;

  function api() {
    return window.xhs && window.xhs.miniTool;
  }

  function canCall(method, minimum) {
    const bridge = api();
    return version !== null && version >= minimum && bridge && typeof bridge[method] === 'function';
  }

  function readVersion(options) {
    const build = options && options.miniToolEnv && options.miniToolEnv.buildVersion;
    if ((typeof build !== 'string' && typeof build !== 'number') || !/^[1-9]\d{6,}$/.test(String(build))) {
      return null;
    }
    const value = Number(build);
    return Number.isSafeInteger(value) ? Math.floor(value / 1000) : null;
  }

  async function refreshWindow() {
    if (!canCall('getWindowInfo', 9490)) return false;
    try {
      return applyWindowInfo(await api().getWindowInfo());
    } catch (error) {
      return false;
    }
  }

  function applyWindowInfo(info) {
    if (!info || !(info.windowWidth > 0) || !(info.windowHeight > 0)) return false;
    windowInfo = info;
    const safe = info.safeArea || {};
    const buttons = info.menuButtons || {};
    const capsule = buttons.capsule;
    const visible = function (rect) { return rect && rect.width > 0 && rect.height > 0; };
    const relevant = visible(capsule) ? [capsule] : [buttons.back, buttons.me, buttons.share].filter(visible);
    const contentTop = relevant.reduce(function (top, rect) {
      return Math.max(top, Number(rect.bottom) || 0);
    }, Number(safe.top) || 0);
    const style = document.documentElement.style;
    style.setProperty('--host-top', Math.max(0, contentTop) + 'px');
    if (safe.bottom > 0) style.setProperty('--host-bottom', Math.max(0, info.windowHeight - safe.bottom) + 'px');
    const safeLeft = Number(safe.left);
    const safeRight = Number(safe.right);
    const leftInset = Number.isFinite(safeLeft) ? Math.max(0, safeLeft) : 0;
    const rightInset = Number.isFinite(safeRight) ? Math.max(0, info.windowWidth - safeRight) : 0;
    style.setProperty('--host-header-inline-safe', Math.max(leftInset, rightInset) + 'px');
    shareBlocked = false;
    return true;
  }

  function isInHostGestureArea(x, y) {
    const area = windowInfo && windowInfo.gestureArea;
    if (!area || area.left === null || area.left === undefined ||
        area.top === null || area.top === undefined ||
        area.right === null || area.right === undefined ||
        area.bottom === null || area.bottom === undefined) return false;
    const left = Number(area.left);
    const top = Number(area.top);
    const right = Number(area.right);
    const bottom = Number(area.bottom);
    const pointX = Number(x);
    const pointY = Number(y);
    if (![left, top, right, bottom, pointX, pointY].every(Number.isFinite) ||
        right <= left || bottom <= top) return false;
    return pointX >= left && pointX <= right && pointY >= top && pointY <= bottom;
  }

  async function initialize() {
    const xhs = window.xhs;
    let options = xhs && xhs.launchOptions;
    version = readVersion(options);
    if (version === null && api() && typeof api().getLaunchOptions === 'function') {
      try {
        options = await api().getLaunchOptions();
        version = readVersion(options);
      } catch (error) {
        version = null;
      }
    }
    if (version !== null && version >= 9490 && options && options.miniToolEnv) {
      applyWindowInfo(options.miniToolEnv.windowInfo);
    }
    await refreshWindow();
  }

  async function load(key) {
    if (!canCall('getStorage', 9460)) return null;
    try {
      const result = await api().getStorage({ key: namespace + key });
      return result && typeof result.data === 'string' ? JSON.parse(result.data) : null;
    } catch (error) {
      return null;
    }
  }

  function store(key, value) {
    if (!canCall('setStorage', 9460)) return Promise.resolve(null);
    writeQueue = writeQueue.then(async function () {
      try {
        const result = await api().setStorage({
          key: namespace + key,
          data: JSON.stringify(value)
        });
        return Boolean(result && result.errMsg === 'setStorage:ok');
      } catch (error) {
        return false;
      }
    });
    return writeQueue;
  }

  function supportsAlbum() {
    return Boolean(canCall('saveImageToPhotosAlbum', 9420));
  }

  async function saveToAlbum(dataUrl) {
    if (!supportsAlbum()) return false;
    let filePath = dataUrl;
    if (dataUrl.length > 135000 && canCall('writeTempFile', 9420)) {
      try {
        const file = await api().writeTempFile({ data: dataUrl });
        if (file && typeof file.filePath === 'string' && file.filePath) filePath = file.filePath;
      } catch (error) {
        // The album API also accepts the generated image directly.
      }
    }
    const saved = await api().saveImageToPhotosAlbum({ filePath: filePath });
    return Boolean(saved && saved.errMsg === 'saveImageToPhotosAlbum:ok');
  }

  function canShare() {
    if (shareBlocked || !windowInfo || !canCall('share', 9530)) return false;
    const statusBar = Number(windowInfo.statusBarHeight) || 0;
    const top = windowInfo.screenTop;
    // The SDK provides viewport geometry; the share call still enforces fullscreen.
    return windowInfo.screenHeight > 0 && Number.isFinite(top) &&
      top <= statusBar + 12 &&
      windowInfo.windowHeight + top >= windowInfo.screenHeight * 0.9;
  }

  async function shareCard() {
    if (!canShare()) return false;
    try {
      await api().share({ type: 'card' });
      return true;
    } catch (error) {
      if (Number(error && error.errCode) === 15502) shareBlocked = true;
      return false;
    }
  }

  function vibrate(type) {
    if (canCall('vibrateShort', 9500)) {
      try {
        Promise.resolve(api().vibrateShort({ type: type === 'medium' ? 'medium' : 'light' })).catch(function () {});
      } catch (error) {
        // Animation and visible result remain available when vibration fails.
      }
    }
  }

  function createSound() {
    let context;
    let active = [];
    let enabled = true;
    let lastTap = 0;

    function silence() {
      active.forEach(function (oscillator) {
        try { oscillator.stop(); } catch (error) {}
      });
      active = [];
    }

    function prime() {
      if (!enabled) return;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (typeof Audio !== 'function') return;
      try {
        if (!context) context = new Audio();
        if (context.state === 'suspended' && typeof context.resume === 'function') {
          Promise.resolve(context.resume()).catch(function () {});
        }
      } catch (error) {
        context = null;
      }
    }

    function tone(frequency, delay, length, level) {
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      active.push(oscillator);
      oscillator.onended = function () {
        const position = active.indexOf(oscillator);
        if (position !== -1) active.splice(position, 1);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + length + 0.025);
    }

    function play(kind) {
      if (!enabled || !context || context.state !== 'running' || document.hidden) return;
      try {
        if (kind === 'tap') {
          const now = Date.now();
          if (now - lastTap < 90) return;
          lastTap = now;
          tone(620, 0, 0.065, 0.065);
        } else if (kind === 'stamp') {
          tone(172, 0, 0.13, 0.16);
          tone(320, 0.045, 0.11, 0.08);
        } else if (kind === 'tick') {
          tone(390, 0, 0.075, 0.075);
        } else if (kind === 'scan') {
          tone(490, 0, 0.04, 0.04);
        } else if (kind === 'urgent') {
          tone(540, 0, 0.075, 0.10);
          tone(680, 0.17, 0.085, 0.11);
        } else if (kind === 'win') {
          silence();
          tone(440, 0, 0.19, 0.13);
          tone(659, 0.10, 0.23, 0.12);
          tone(880, 0.20, 0.26, 0.10);
        }
      } catch (error) {
        silence();
      }
    }

    return {
      prime: prime,
      play: play,
      silence: silence,
      setEnabled: function (value) {
        enabled = value;
        if (!enabled) silence();
      }
    };
  }

  window.RafflePlatform = {
    initialize: initialize,
    refreshWindow: refreshWindow,
    load: load,
    store: store,
    supportsAlbum: supportsAlbum,
    saveToAlbum: saveToAlbum,
    canShare: canShare,
    shareCard: shareCard,
    isInHostGestureArea: isInHostGestureArea,
    vibrate: vibrate,
    createSound: createSound
  };
}());
