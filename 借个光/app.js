(function () {
  'use strict';

  const ui = {};
  [
    'app', 'light', 'light-area', 'neon-first', 'neon-next', 'dimmer', 'board', 'board-header', 'board-message',
    'console', 'clean-screen', 'brightness', 'brightness-value', 'open-colors', 'effect-label', 'open-camera',
    'color-overlay', 'colors', 'color-title', 'close-colors', 'color-tip', 'color-hex', 'hue', 'saturation',
    'random-color', 'start-neon', 'sound-setting', 'vibration-setting',
    'camera', 'camera-video', 'camera-status', 'camera-back', 'camera-retry', 'camera-delay', 'shutter', 'countdown',
    'camera-lights', 'camera-brightness-section', 'camera-brightness', 'camera-brightness-value', 'camera-neon',
    'review', 'photo', 'review-back', 'retake', 'review-status', 'save-photo', 'post-photo'
  ].forEach(function (id) { ui[id] = document.getElementById(id); });

  const presets = {
    soft: { color: '#FFF9F2', tip: '柔白适合给暗处合照补一点光。' },
    warm: { color: '#FFD9B1', tip: '暖光适合保留餐桌上的暖色氛围。' },
    cool: { color: '#DDEAFF', tip: '冷白适合环境灯偏黄的室内。' },
    peach: { color: '#FFC7B7', tip: '蜜桃色适合靠近脸侧，补一点柔和的红。' },
    lilac: { color: '#ECCBFF', tip: '粉紫适合给夜景人像的侧脸染色。' },
    ice: { color: '#BBF4FB', tip: '冰蓝适合用作侧光，保留画面的冷色感。' }
  };
  const palettes = [
    ['#FFBD78', '#FFD09D', '#FFE9BB', '#FFF1D3'],
    ['#91BDFF', '#A6D7FF', '#A9EFFF', '#DBFAFF'],
    ['#FDAFE3', '#ECA3F7', '#CAB9FF', '#F4D8FF'],
    ['#90EBD1', '#ABEFC7', '#CAF5A6', '#F0F9CD'],
    ['#FF9DAD', '#FFABA2', '#FFB7D1', '#FFDEBE']
  ];
  const randomColors = Object.keys(presets).map(function (key) { return presets[key].color; })
    .concat(['#FFE6C5', '#FFD8F0', '#D6DEFF', '#C7F1DD', '#FFF0B8']);
  const presetButtons = Array.from(document.querySelectorAll('[data-preset]'));
  const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const platform = window.LightPlatform;
  const camera = window.LightCamera.create(ui['camera-video'], function () {
    if (view === 'camera') interruptCamera('取景已中断，可以重新打开相机。');
  });

  const prefs = { vibration: true, sound: false };
  const changedPrefs = new Set();
  const paletteDuration = 3200;
  let view = 'board';
  let effect = 'fixed';
  let tone = presets.soft.color;
  let selectedPreset = 'soft';
  let clean = false;
  let modalOpen = false;
  let panelTrigger = null;
  let neonPaused = false;
  let palette = 0;
  let nextPalette = 1;
  let paletteTime = 0;
  let driftTime = 0;
  let animation = null;
  let animationTime = null;
  let messageTimer = null;
  let audioContext = null;
  let cameraReady = false;
  let cameraRequest = 0;
  let delayEnabled = false;
  let shutterTimer = null;
  let shutterAt = null;
  let photo = null;
  let photoAction = null;
  let preferencesReady = false;
  let lightChanged = false;
  let saveRevision = 0;

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function motionIsReduced() {
    return Boolean(reducedMotion && reducedMotion.matches);
  }

  function showMessage(message, duration) {
    window.clearTimeout(messageTimer);
    setText(ui['board-message'], message);
    ui['board-message'].hidden = !message;
    if (message) {
      messageTimer = window.setTimeout(function () { ui['board-message'].hidden = true; }, duration || 1800);
    }
  }

  function lightFeedback() {
    if (prefs.vibration) platform.vibrate();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!prefs.sound || typeof Audio !== 'function') return;

    function play() {
      if (!audioContext || audioContext.state !== 'running' || !prefs.sound || document.hidden) return;
      try {
        const start = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = 510;
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.055, start + .009);
        gain.gain.exponentialRampToValueAtTime(0.001, start + .085);
        oscillator.onended = function () {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + .11);
      } catch (error) {
        // The light switch still works when sound cannot play.
      }
    }

    try {
      if (!audioContext) audioContext = new Audio();
      if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
        Promise.resolve(audioContext.resume()).then(play).catch(function () {});
      } else {
        play();
      }
    } catch (error) {
      audioContext = null;
    }
  }

  function otherIndex(length, excluded) {
    if (excluded < 0) return Math.floor(Math.random() * length);
    const index = Math.floor(Math.random() * (length - 1));
    return index >= excluded ? index + 1 : index;
  }

  function loadPalettes() {
    ui['neon-first'].style.backgroundImage = 'linear-gradient(135deg, ' + palettes[palette].join(', ') + ')';
    ui['neon-next'].style.backgroundImage = 'linear-gradient(135deg, ' + palettes[nextPalette].join(', ') + ')';
  }

  function paintNeon() {
    const fraction = paletteTime / paletteDuration;
    const blend = fraction * fraction * (3 - 2 * fraction);
    const dx = 8.5 * Math.sin(driftTime / 2350);
    const dy = 7.5 * Math.cos(driftTime / 3020);
    const position = 'translate3d(' + dx.toFixed(2) + '%, ' + dy.toFixed(2) + '%, 0)';
    ui['neon-first'].style.transform = position;
    ui['neon-next'].style.transform = position;
    ui['neon-next'].style.opacity = String(blend);
  }

  function shouldAnimate() {
    return effect === 'neon' && view === 'board' && !document.hidden && !neonPaused && !motionIsReduced();
  }

  function animate(at) {
    animation = null;
    if (!shouldAnimate()) {
      animationTime = null;
      return;
    }
    if (animationTime === null || at - animationTime >= 30) {
      const delta = animationTime === null ? 0 : Math.min(120, at - animationTime);
      animationTime = at;
      paletteTime += delta;
      driftTime += delta;
      if (paletteTime >= paletteDuration) {
        paletteTime -= paletteDuration;
        palette = nextPalette;
        nextPalette = otherIndex(palettes.length, palette);
        loadPalettes();
      }
      paintNeon();
    }
    animation = window.requestAnimationFrame(animate);
  }

  function syncAnimation() {
    if (shouldAnimate()) {
      if (animation === null) animation = window.requestAnimationFrame(animate);
      return;
    }
    if (animation !== null) window.cancelAnimationFrame(animation);
    animation = null;
    animationTime = null;
  }

  function renderBoard() {
    const isNeon = effect === 'neon';
    ui.app.dataset.effect = effect;
    ui.app.dataset.clean = String(clean);
    ui['board-header'].hidden = clean;
    ui.console.hidden = clean;
    ui['clean-screen'].hidden = isNeon;
    ui['light-area'].setAttribute('aria-label', isNeon
      ? (motionIsReduced() ? '点光面更换静态渐变' : neonPaused ? '点光面继续霓虹' : '点光面暂停霓虹')
      : (clean ? '点光面恢复控件' : '点光面隐藏控件'));
    const status = isNeon && (motionIsReduced() ? '静态' : neonPaused ? '已暂停' : '');
    ui['effect-label'].hidden = !status;
    setText(ui['effect-label'], status || '');
    presetButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(!isNeon && selectedPreset === button.dataset.preset));
    });
    ui['start-neon'].setAttribute('aria-pressed', String(isNeon));
    ui['camera-neon'].setAttribute('aria-pressed', String(isNeon));
    ui['start-neon'].setAttribute('aria-label', status ? '随机霓虹，' + status + '，可换一组' : '随机霓虹');
    setText(ui['color-tip'], isNeon ? (view === 'camera' ? '自拍时渐变定格，点「随机霓虹」可换一组。'
      : motionIsReduced() ? '渐变已静止，点光面换一组配色。' : '点一下光面暂停，再点一下继续。')
      : selectedPreset ? presets[selectedPreset].tip : '拖动时，光板会实时预览颜色。');
    setText(ui['color-hex'], isNeon ? '渐变' : tone);
    layoutCameraPanel();
  }

  function setFixed(color, preset) {
    effect = 'fixed';
    selectedPreset = preset || null;
    tone = color;
    ui.light.style.backgroundColor = color;
    renderBoard();
    syncAnimation();
  }

  function presetFor(color) {
    return Object.keys(presets).find(function (key) { return presets[key].color === color; });
  }

  function hslColor(hue, saturation) {
    const s = saturation / 100;
    const l = .995 - .255 * s;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const section = hue / 60;
    const middle = chroma * (1 - Math.abs(section % 2 - 1));
    const components = [
      [chroma, middle, 0], [middle, chroma, 0], [0, chroma, middle],
      [0, middle, chroma], [middle, 0, chroma], [chroma, 0, middle]
    ][Math.floor(section)];
    return '#' + components.map(function (part) {
      const hex = Math.round((part + l - chroma / 2) * 255).toString(16).toUpperCase();
      return hex.length < 2 ? '0' + hex : hex;
    }).join('');
  }

  function customColor() {
    const hue = Number(ui.hue.value);
    lightChanged = true;
    ui.saturation.style.setProperty('--saturation-tone', hslColor(hue, 100));
    setFixed(hslColor(hue, Number(ui.saturation.value)));
  }

  function setBrightness(event) {
    const level = Number(event ? event.currentTarget.value : ui.brightness.value);
    ui.brightness.value = level;
    ui['camera-brightness'].value = level;
    ui.dimmer.style.opacity = String(1 - level / 100);
    setText(ui['brightness-value'], level + '%');
    setText(ui['camera-brightness-value'], level + '%');
  }

  function layoutCameraPanel() {
    if (!modalOpen || view !== 'camera') return;
    const sheetTop = ui.colors.getBoundingClientRect().top - ui.app.getBoundingClientRect().top;
    const padding = parseFloat(window.getComputedStyle(ui.camera).paddingTop) || 0;
    const statusHeight = ui['camera-status'].hidden ? 0 : ui['camera-status'].offsetHeight + 11;
    const retryHeight = ui['camera-retry'].hidden ? 0 : ui['camera-retry'].offsetHeight + 9;
    const frameWidth = Math.floor((sheetTop - padding - statusHeight - retryHeight - 12) * .75);
    ui.app.style.setProperty('--camera-sheet-space', Math.max(0, ui.app.clientHeight - sheetTop) + 'px');
    ui.app.style.setProperty('--camera-panel-frame-width', Math.max(34, Math.min(230, frameWidth)) + 'px');
  }

  function closeColors(restoreFocus) {
    if (!modalOpen) return;
    modalOpen = false;
    ui['color-overlay'].hidden = true;
    delete ui.app.dataset.colorPanel;
    ui[view].removeAttribute('aria-hidden');
    if (panelTrigger) {
      panelTrigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) panelTrigger.focus();
    }
    panelTrigger = null;
  }

  function openColors(event) {
    const inCamera = view === 'camera';
    if (inCamera && shutterAt !== null) cancelShutter();
    modalOpen = true;
    panelTrigger = event.currentTarget;
    panelTrigger.setAttribute('aria-expanded', 'true');
    ui.app.dataset.colorPanel = view;
    ui['camera-brightness-section'].hidden = !inCamera;
    ui['camera-neon'].hidden = !inCamera;
    setText(ui['color-title'], inCamera ? '灯光' : '更多光色');
    ui['color-overlay'].hidden = false;
    ui.colors.scrollTop = 0;
    ui.colors.querySelector('.color-options').scrollTop = 0;
    renderBoard();
    ui['close-colors'].focus();
    ui[view].setAttribute('aria-hidden', 'true');
  }

  function startNeon() {
    const previous = effect === 'neon' ? palette : -1;
    effect = 'neon';
    neonPaused = false;
    clean = false;
    choosePalette(previous);
    renderBoard();
    syncAnimation();
    lightFeedback();
    rememberLight();
    if (view === 'board') {
      showMessage(motionIsReduced() ? '点光面换一组配色' : '点一下光面暂停，再点继续', 2550);
    }
  }

  function choosePalette(previous) {
    palette = otherIndex(palettes.length, previous);
    nextPalette = otherIndex(palettes.length, palette);
    paletteTime = 0;
    driftTime = 0;
    animationTime = null;
    loadPalettes();
    paintNeon();
  }

  function toggleClean() {
    clean = !clean;
    renderBoard();
    if (clean) {
      if (document.activeElement === ui['clean-screen']) ui['light-area'].focus();
      showMessage('点光面恢复控件', 1400);
    } else {
      showMessage('');
    }
  }

  function tapLight() {
    if (effect === 'fixed') {
      toggleClean();
      return;
    }
    if (motionIsReduced()) {
      choosePalette(palette);
      showMessage('已换一组配色');
    } else {
      neonPaused = !neonPaused;
      syncAnimation();
      renderBoard();
      showMessage(neonPaused ? '已暂停' : '继续滚动');
    }
    lightFeedback();
    rememberLight();
  }

  function saveSettings(reportFailure) {
    if (!preferencesReady) return;
    const write = ++saveRevision;
    const lastLight = { effect: effect, tone: tone, hue: Number(ui.hue.value), saturation: Number(ui.saturation.value) };
    if (effect === 'neon') {
      lastLight.neon = {
        palette: palette, nextPalette: nextPalette, paletteTime: paletteTime, driftTime: driftTime, paused: neonPaused
      };
    }
    platform.savePreferences({ sound: prefs.sound, vibration: prefs.vibration, lastLight: lastLight }).then(function (saved) {
      if (saved !== false || !reportFailure || write !== saveRevision || view === 'review' || document.hidden) return;
      const message = '未能保存上次光色，当前光色仍可使用。';
      if (modalOpen) setText(ui['color-tip'], message);
      else if (view === 'board') showMessage(message);
      else if (cameraReady) refreshCameraControls(message);
    });
  }

  function rememberLight() {
    lightChanged = true;
    saveSettings(true);
  }

  function restoreLight(lastLight) {
    if (!lastLight || typeof lastLight.tone !== 'string' || !/^#[0-9a-f]{6}$/i.test(lastLight.tone)) return;
    if (Number.isInteger(lastLight.hue) && lastLight.hue >= 0 && lastLight.hue < 360) {
      ui.hue.value = lastLight.hue;
      ui.saturation.style.setProperty('--saturation-tone', hslColor(lastLight.hue, 100));
    }
    if (Number.isInteger(lastLight.saturation) && lastLight.saturation >= 0 && lastLight.saturation <= 100) {
      ui.saturation.value = lastLight.saturation;
    }
    const color = lastLight.tone.toUpperCase();
    setFixed(color, presetFor(color));
    const neon = lastLight.neon;
    if (lastLight.effect !== 'neon' || !neon ||
        !Number.isInteger(neon.palette) || !palettes[neon.palette] ||
        !Number.isInteger(neon.nextPalette) || !palettes[neon.nextPalette] || neon.palette === neon.nextPalette ||
        !Number.isFinite(neon.paletteTime) || neon.paletteTime < 0 || neon.paletteTime >= paletteDuration ||
        !Number.isFinite(neon.driftTime) || neon.driftTime < 0) return;
    effect = 'neon';
    clean = false;
    palette = neon.palette;
    nextPalette = neon.nextPalette;
    paletteTime = neon.paletteTime;
    driftTime = neon.driftTime;
    neonPaused = neon.paused === true;
    loadPalettes();
    paintNeon();
    renderBoard();
    syncAnimation();
  }

  function renderPreferences() {
    ui['sound-setting'].setAttribute('aria-pressed', String(prefs.sound));
    ui['vibration-setting'].setAttribute('aria-pressed', String(prefs.vibration));
  }

  function changePreference(key) {
    prefs[key] = !prefs[key];
    changedPrefs.add(key);
    renderPreferences();
    saveSettings(true);
    if (prefs[key]) lightFeedback();
  }

  function renderView() {
    ui.app.dataset.view = view;
    ui.board.hidden = view !== 'board';
    ui.camera.hidden = view !== 'camera';
    ui.review.hidden = view !== 'review';
    syncAnimation();
  }

  function refreshCameraControls(message) {
    setText(ui['camera-status'], message);
    ui['camera-status'].hidden = !message;
    ui.shutter.disabled = !cameraReady;
    ui['camera-delay'].disabled = !cameraReady || shutterAt !== null;
    ui['camera-delay'].setAttribute('aria-pressed', String(delayEnabled));
    layoutCameraPanel();
  }

  function cancelShutter() {
    window.clearTimeout(shutterTimer);
    shutterTimer = null;
    shutterAt = null;
    ui.countdown.hidden = true;
    ui.shutter.removeAttribute('data-counting');
    ui.shutter.setAttribute('aria-label', '拍照');
    ui['camera-delay'].disabled = !cameraReady;
  }

  function stopCamera() {
    cameraRequest++;
    cameraReady = false;
    cancelShutter();
    camera.stop();
  }

  function interruptCamera(message) {
    stopCamera();
    ui['camera-retry'].hidden = false;
    refreshCameraControls(message);
  }

  function cameraMessage(error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return '相机权限未开启。可在系统设置授权后重试。';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return '相机暂时无法使用，可能被其他应用占用。';
    }
    if (error.name === 'NoFrameError') return '没有收到取景画面，可以重新打开相机。';
    if (['NotFoundError', 'OverconstrainedError', 'ConstraintNotSatisfiedError', 'FrontCameraError'].indexOf(error.name) >= 0) {
      return '当前设备无法确认可用的前置相机。';
    }
    return '前置相机暂时无法打开，可以重试或返回灯板。';
  }

  async function startCamera() {
    if (!window.LightCamera.available()) {
      const message = '当前环境无法使用相机，灯板可继续使用。';
      if (view === 'camera') interruptCamera(message);
      else if (view === 'review') setText(ui['review-status'], message);
      else showMessage(message, 2700);
      return;
    }
    stopCamera();
    closeColors(false);
    photo = null;
    photoAction = null;
    ui.photo.removeAttribute('src');
    view = 'camera';
    ui['camera-retry'].hidden = true;
    refreshCameraControls('正在打开前置相机…');
    renderView();
    const request = cameraRequest;
    try {
      if (!await camera.open() || request !== cameraRequest || view !== 'camera') return;
      cameraReady = true;
      refreshCameraControls('');
    } catch (error) {
      if (request !== cameraRequest || view !== 'camera') return;
      interruptCamera(cameraMessage(error));
    }
  }

  function backToBoard() {
    stopCamera();
    closeColors(false);
    photo = null;
    photoAction = null;
    ui.photo.removeAttribute('src');
    view = 'board';
    renderView();
    ui['open-camera'].focus();
  }

  function renderReviewActions() {
    ui['save-photo'].hidden = !platform.canSave();
    ui['post-photo'].hidden = !platform.canPost();
    ui['save-photo'].disabled = Boolean(photoAction);
    ui['post-photo'].disabled = Boolean(photoAction);
  }

  function takePhoto() {
    cancelShutter();
    if (!cameraReady || view !== 'camera') return;
    try {
      photo = camera.capture();
    } catch (error) {
      photo = null;
    }
    if (!photo) {
      refreshCameraControls('这次没能拍到画面，请再试一次。');
      return;
    }
    stopCamera();
    view = 'review';
    ui.photo.src = photo;
    setText(ui['review-status'], platform.canSave() || platform.canPost() ? '' : '可长按照片保存。');
    renderView();
    renderReviewActions();
  }

  function tickShutter() {
    if (shutterAt === null) return;
    const remaining = shutterAt - Date.now();
    if (remaining <= 0) {
      takePhoto();
      return;
    }
    setText(ui.countdown, String(Math.ceil(remaining / 1000)));
    shutterTimer = window.setTimeout(tickShutter, Math.min(remaining, 80));
  }

  function pressShutter() {
    if (!cameraReady || view !== 'camera' || modalOpen) return;
    if (shutterAt !== null) {
      cancelShutter();
      return;
    }
    if (!delayEnabled) {
      takePhoto();
      return;
    }
    shutterAt = Date.now() + 3000;
    ui.countdown.hidden = false;
    ui.shutter.dataset.counting = 'true';
    ui.shutter.setAttribute('aria-label', '取消 3 秒倒计时');
    ui['camera-delay'].disabled = true;
    tickShutter();
  }

  async function handlePhoto(kind) {
    if (!photo || photoAction) return;
    const image = photo;
    const work = {};
    const save = kind === 'save';
    photoAction = work;
    renderReviewActions();
    setText(ui['review-status'], save ? '正在保存…' : '正在打开图文编辑页…');
    let success = false;
    try {
      success = await (save ? platform.savePhoto(image) : platform.postPhoto(image));
    } catch (error) {
      success = false;
    }
    if (view !== 'review' || photoAction !== work) return;
    photoAction = null;
    renderReviewActions();
    if (save) setText(ui['review-status'], success ? '已保存到相册' : '保存失败，照片还在，可以重试。');
    else setText(ui['review-status'], success ? '' : '未完成图文操作，照片还在，可以再试。');
  }

  presetButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const key = button.dataset.preset;
      if (effect === 'fixed' && selectedPreset === key) return;
      setFixed(presets[key].color, key);
      lightFeedback();
      rememberLight();
    });
  });
  ui['light-area'].addEventListener('click', tapLight);
  ui['clean-screen'].addEventListener('click', toggleClean);
  ui.brightness.addEventListener('input', setBrightness);
  ui['camera-brightness'].addEventListener('input', setBrightness);
  ui['open-colors'].addEventListener('click', openColors);
  ui['camera-lights'].addEventListener('click', openColors);
  ui['close-colors'].addEventListener('click', function () { closeColors(true); });
  ui['color-overlay'].addEventListener('click', function (event) {
    if (event.target === ui['color-overlay']) closeColors(true);
  });
  [ui.hue, ui.saturation].forEach(function (input) {
    input.addEventListener('input', customColor);
    input.addEventListener('change', function () {
      customColor();
      lightFeedback();
      rememberLight();
    });
  });
  ui['random-color'].addEventListener('click', function () {
    const color = randomColors[otherIndex(randomColors.length, randomColors.indexOf(tone))];
    setFixed(color, presetFor(color));
    lightFeedback();
    rememberLight();
  });
  ui['start-neon'].addEventListener('click', startNeon);
  ui['camera-neon'].addEventListener('click', startNeon);
  ui['vibration-setting'].addEventListener('click', function () { changePreference('vibration'); });
  ui['sound-setting'].addEventListener('click', function () { changePreference('sound'); });

  [ui['open-camera'], ui['camera-retry'], ui.retake].forEach(function (button) {
    button.addEventListener('click', startCamera);
  });
  [ui['camera-back'], ui['review-back']].forEach(function (button) {
    button.addEventListener('click', backToBoard);
  });
  ui['camera-delay'].addEventListener('click', function () {
    delayEnabled = !delayEnabled;
    ui['camera-delay'].setAttribute('aria-pressed', String(delayEnabled));
  });
  ui.shutter.addEventListener('click', pressShutter);
  ui['save-photo'].addEventListener('click', function () { handlePhoto('save'); });
  ui['post-photo'].addEventListener('click', function () { handlePhoto('post'); });

  document.addEventListener('keydown', function (event) {
    if (modalOpen && event.key === 'Tab') {
      const focusable = ui.colors.querySelectorAll('button:not(:disabled), input:not(:disabled)');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    if (event.key !== 'Escape') return;
    if (modalOpen) closeColors(true);
    else if (shutterAt !== null) cancelShutter();
    else if (view !== 'board') backToBoard();
    else if (clean) toggleClean();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && effect === 'neon' && !neonPaused && !motionIsReduced()) saveSettings(false);
    if (document.hidden && view === 'camera') interruptCamera('相机已关闭，返回后可以重新打开。');
    if (!document.hidden) platform.refreshWindow().then(layoutCameraPanel);
    syncAnimation();
  });
  window.addEventListener('pagehide', function () {
    if (!document.hidden && effect === 'neon' && !neonPaused && !motionIsReduced()) saveSettings(false);
    if (view === 'camera') interruptCamera('相机已关闭，返回后可以重新打开。');
    if (animation !== null) window.cancelAnimationFrame(animation);
    animation = null;
    animationTime = null;
  });
  window.addEventListener('pageshow', syncAnimation);

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    layoutCameraPanel();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { platform.refreshWindow().then(layoutCameraPanel); }, 100);
  });
  function motionChanged() {
    renderBoard();
    syncAnimation();
  }
  if (reducedMotion) {
    if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', motionChanged);
    else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(motionChanged);
  }

  document.querySelectorAll('[data-start]').forEach(function (element) { element.disabled = false; });
  renderBoard();
  renderPreferences();
  setBrightness();
  ui.app.dataset.ready = 'true';

  platform.initialize().then(function () {
    layoutCameraPanel();
    if (view === 'review') {
      renderReviewActions();
      if (!photoAction && (platform.canSave() || platform.canPost())) setText(ui['review-status'], '');
    }
    return platform.loadPreferences();
  }).catch(function () { return null; }).then(function (saved) {
    if (saved) {
      Object.keys(prefs).forEach(function (key) {
        if (!changedPrefs.has(key) && typeof saved[key] === 'boolean') prefs[key] = saved[key];
      });
      if (!lightChanged) restoreLight(saved.lastLight);
    }
    preferencesReady = true;
    if (changedPrefs.size || lightChanged) saveSettings(true);
    renderPreferences();
  });
}());
