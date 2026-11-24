(function () {
  'use strict';

  var STORAGE_KEY = 'jieguang.preferences';
  var LARGE_DATA_URL_LENGTH = 135000;
  var version = null;
  var writeQueue = Promise.resolve();

  function hostWindow() {
    return typeof window !== 'undefined' ? window : null;
  }

  function api() {
    var host = hostWindow();
    return host && host.xhs && host.xhs.miniTool;
  }

  function readVersion(options) {
    var env = options && options.miniToolEnv;
    var raw = env && env.buildVersion;
    if (typeof raw !== 'number' && typeof raw !== 'string') return null;
    if (!/^[1-9]\d{6,}$/.test(String(raw))) return null;

    var buildVersion = Number(raw);
    return Number.isSafeInteger(buildVersion) ? Math.floor(buildVersion / 1000) : null;
  }

  function readWindowSnapshot(options) {
    var env = options && options.miniToolEnv;
    return env && env.windowInfo;
  }

  function canCall(method, minimum) {
    var bridge = api();
    return version !== null && version >= minimum && bridge && typeof bridge[method] === 'function';
  }

  function setRootProperty(name, value) {
    var host = hostWindow();
    var doc = host && host.document;
    var root = doc && doc.documentElement;
    var style = root && root.style;
    if (style && typeof style.setProperty === 'function') style.setProperty(name, value + 'px');
  }

  function clearRootProperty(name) {
    var host = hostWindow();
    var doc = host && host.document;
    var root = doc && doc.documentElement;
    var style = root && root.style;
    if (style && typeof style.removeProperty === 'function') style.removeProperty(name);
  }

  function visibleRect(rect) {
    if (!rect || rect.bottom === null || rect.bottom === undefined) return false;

    var width = rect.width === null || rect.width === undefined ? null : Number(rect.width);
    var height = rect.height === null || rect.height === undefined ? null : Number(rect.height);
    if (width !== null && (!Number.isFinite(width) || width <= 0)) return false;
    if (height !== null && (!Number.isFinite(height) || height <= 0)) return false;
    return Number.isFinite(Number(rect.bottom));
  }

  function applyWindowInfo(info) {
    if (!info) {
      clearRootProperty('--host-bottom');
      return false;
    }

    var width = Number(info.windowWidth);
    var height = Number(info.windowHeight);
    if (!(width > 0) || !(height > 0)) {
      clearRootProperty('--host-bottom');
      return false;
    }

    var safe = info.safeArea || {};
    var buttons = info.menuButtons || {};
    var capsule = buttons.capsule;
    var fallbackButtons = [buttons.back, buttons.me, buttons.share];

    var relevant = visibleRect(capsule) ? [capsule] : fallbackButtons.filter(visibleRect);
    var safeTop = Number(safe.top);
    var contentTop = Number.isFinite(safeTop) ? Math.max(0, safeTop) : 0;
    relevant.forEach(function (rect) {
      contentTop = Math.max(contentTop, Number(rect.bottom) || 0);
    });

    var safeBottom = Number(safe.bottom);
    if (Number.isFinite(safeBottom) && safeBottom >= 0 && safeBottom <= height) {
      setRootProperty('--host-bottom', Math.max(0, height - safeBottom));
    } else {
      clearRootProperty('--host-bottom');
    }

    var safeLeft = Number(safe.left);
    var safeRight = Number(safe.right);
    var leftInset = Number.isFinite(safeLeft) ? Math.max(0, safeLeft) : 0;
    var rightInset = Number.isFinite(safeRight) ? Math.max(0, width - safeRight) : 0;

    setRootProperty('--host-top', contentTop);
    setRootProperty('--host-side', Math.max(leftInset, rightInset));
    return true;
  }

  async function refreshWindow() {
    if (!canCall('getWindowInfo', 9490)) return false;
    try {
      return applyWindowInfo(await api().getWindowInfo());
    } catch (error) {
      return false;
    }
  }

  function initialize() {
    var host = hostWindow();
    var xhs = host && host.xhs;
    var options = xhs && xhs.launchOptions;
    version = readVersion(options);

    var snapshot = readWindowSnapshot(options);
    if (snapshot) applyWindowInfo(snapshot);

    var bridge = api();
    if (version === null && bridge && typeof bridge.getLaunchOptions === 'function') {
      var loaded;
      try {
        loaded = bridge.getLaunchOptions();
      } catch (error) {
        return refreshWindow();
      }

      return Promise.resolve(loaded).then(function (result) {
        if (result) {
          options = result;
          version = readVersion(result);
          snapshot = readWindowSnapshot(result);
          if (snapshot) applyWindowInfo(snapshot);
        }
        return refreshWindow();
      }, function () {
        return refreshWindow();
      });
    }

    return refreshWindow();
  }

  async function loadPreferences() {
    if (!canCall('getStorage', 9460)) return null;
    try {
      var result = await api().getStorage({ key: STORAGE_KEY });
      if (!result || typeof result.data !== 'string') return null;
      var parsed = JSON.parse(result.data);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function savePreferences(preferences) {
    if (!canCall('setStorage', 9460)) return Promise.resolve(null);

    var serialized;
    try {
      serialized = JSON.stringify(preferences);
    } catch (error) {
      return Promise.resolve(false);
    }
    if (typeof serialized !== 'string') return Promise.resolve(false);

    writeQueue = writeQueue.then(function () {
      return Promise.resolve().then(function () {
        return api().setStorage({ key: STORAGE_KEY, data: serialized });
      }).then(function (result) {
        return Boolean(result && result.errMsg === 'setStorage:ok');
      }).catch(function () {
        return false;
      });
    });
    return writeQueue;
  }

  function canSave() {
    return canCall('saveImageToPhotosAlbum', 9420);
  }

  function canPost() {
    var bridge = api();
    return Boolean(bridge && typeof bridge.postNote === 'function');
  }

  function isLargeJpegDataUrl(data) {
    return typeof data === 'string' && data.length > LARGE_DATA_URL_LENGTH &&
      /^data:image\/(?:jpeg|jpg)(?:;|,)/i.test(data);
  }

  async function resolveMediaUrl(dataUrl) {
    var bridge = api();
    if (!isLargeJpegDataUrl(dataUrl) || !bridge || typeof bridge.writeTempFile !== 'function') {
      return dataUrl;
    }

    try {
      var result = await bridge.writeTempFile({ data: dataUrl });
      return result && typeof result.filePath === 'string' && result.filePath ? result.filePath : dataUrl;
    } catch (error) {
      return dataUrl;
    }
  }

  async function savePhoto(dataUrl) {
    if (!canSave() || typeof dataUrl !== 'string' || !dataUrl) return false;

    var filePath = await resolveMediaUrl(dataUrl);
    var result = await api().saveImageToPhotosAlbum({ filePath: filePath });
    return Boolean(result && result.errMsg === 'saveImageToPhotosAlbum:ok');
  }

  async function postPhoto(dataUrl) {
    if (!canPost() || typeof dataUrl !== 'string' || !dataUrl) return false;

    var url = await resolveMediaUrl(dataUrl);
    var payload = {
      title: '借个光',
      mediaInfo: {
        image_resources: [{ url: url }]
      }
    };
    if (version !== null && version >= 9430) payload.pageType = 'photo_publish';

    var result = await api().postNote(payload);
    return Boolean(result && result.errMsg === 'postNote:ok');
  }

  function vibrate() {
    if (!canCall('vibrateShort', 9500)) return;
    try {
      var result = api().vibrateShort({ type: 'light' });
      if (result && typeof result.then === 'function') result.catch(function () {});
    } catch (error) {
      // Vibration is optional feedback; the light panel remains usable.
    }
  }

  var platform = {
    initialize: initialize,
    refreshWindow: refreshWindow,
    loadPreferences: loadPreferences,
    savePreferences: savePreferences,
    vibrate: vibrate,
    canSave: canSave,
    canPost: canPost,
    savePhoto: savePhoto,
    postPhoto: postPhoto
  };

  var host = hostWindow();
  if (host) host.LightPlatform = platform;
}());
