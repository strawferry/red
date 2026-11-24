(function () {
  'use strict';

  const byId = function (id) { return document.getElementById(id); };
  const ui = {};
  [
    'app', 'sound-toggle', 'recent-button', 'count-label',
    'round-status', 'stage', 'touch-board', 'touch-intro', 'markers', 'hold-points', 'seat-board', 'timer',
    'timer-value', 'timer-note', 'result-badge', 'seat-setup', 'seat-minus', 'seat-plus',
    'seat-count', 'seat-actions', 'start-raffle', 'switch-mode', 'final-actions',
    'save-result', 'share-result', 'restart', 'feedback', 'result-preview', 'result-image', 'close-preview'
  ].forEach(function (id) { ui[id] = byId(id); });

  const legacyTasks = {
    dishes: { question: '今晚谁洗碗', result: '天选洗碗人' },
    delivery: { question: '谁去拿外卖', result: '天选跑腿人' },
    bill: { question: '谁来结账', result: '天选结账人' },
    first: { question: '谁先开始', result: '天选先手' }
  };
  const colors = ['#c498ff', '#ff9cbf', '#67e7da', '#ffa87b', '#88beff', '#d7f47b'];
  const symbols = ['●', '◆', '▲', '■', '✦', '✚'];
  const rosterMessages = { joined: '有人加入', left: '有人离开', changed: '有人进出' };
  const platform = window.RafflePlatform;
  const sound = platform.createSound();
  const round = window.RaffleRound.create();
  const state = round.state;
  const seatPresets = Array.from(ui['seat-setup'].querySelectorAll('[data-seats]'));
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchAvailable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const markers = new Map();
  const holdPoints = new Map();
  let seatNodes = [];
  let layoutKey = '';
  let seatCount = 8;
  const excludedSeats = new Set();
  let displayedSecond = null;
  let phaseBefore = 'waiting';
  let lastResult = null;
  let viewingRecent = false;
  let soundEnabled = true;
  let soundChanged = false;
  let resultBusy = false;
  let frame = null;
  let scanningNode = null;

  function now() {
    return window.performance && typeof window.performance.now === 'function'
      ? window.performance.now() : Date.now();
  }

  function feedback(message) {
    ui.feedback.textContent = message;
  }

  function activeRound() {
    return !viewingRecent && (state.phase === 'countdown' || state.phase === 'spinning' || state.phase === 'reveal');
  }

  function canOpenRecent() {
    return Boolean(lastResult && !activeRound() && !round.contactCount() && !resultBusy);
  }

  function getView() {
    if (viewingRecent) {
      return {
        mode: lastResult.mode, task: lastResult.task, phase: 'result', layout: lastResult.layout,
        tickets: lastResult.tickets, winner: lastResult.winner
      };
    }
    return {
      mode: state.mode, phase: state.phase, layout: state.layout,
      tickets: state.tickets, winner: state.winner
    };
  }

  function seatLayout() {
    const board = ui['seat-board'];
    const span = Math.min(board.clientHeight, board.clientWidth);
    return {
      total: seatCount,
      ring: seatCount <= 10 && span * 0.70 * Math.sin(Math.PI / seatCount) >= 60
    };
  }

  function seatColumns(total) {
    return Math.min(5, Math.ceil(Math.sqrt(total)));
  }

  function seatPosition(id, layout) {
    if (layout.ring) {
      const angle = (id - 1) / layout.total * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(angle) * 0.35, y: 0.52 + Math.sin(angle) * 0.35 };
    }
    const columns = seatColumns(layout.total);
    const rows = Math.ceil(layout.total / columns);
    return {
      x: ((id - 1) % columns + 0.5) / columns,
      y: (Math.floor((id - 1) / columns) + 0.5) / rows
    };
  }

  function makeSeat(id, layout) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.seat = String(id);
    button.className = 'seat';
    button.textContent = id;
    if (layout.ring) {
      const position = seatPosition(id, layout);
      button.style.left = position.x * 100 + '%';
      button.style.top = position.y * 100 + '%';
    }
    return button;
  }

  function renderSeats(view) {
    const board = ui['seat-board'];
    if (board.hidden) return;
    const layout = view.layout || seatLayout();
    const key = layout.total + ':' + layout.ring;
    if (layoutKey !== key) {
      const fragment = document.createDocumentFragment();
      seatNodes = [];
      for (let id = 1; id <= layout.total; id++) {
        const button = makeSeat(id, layout);
        seatNodes.push(button);
        fragment.appendChild(button);
      }
      board.classList.toggle('is-ring', layout.ring);
      ui.app.dataset.seatLayout = layout.ring ? 'ring' : 'grid';
      board.style.setProperty('--seat-columns', seatColumns(layout.total));
      board.textContent = '';
      board.appendChild(fragment);
      layoutKey = key;
    }

    const waiting = view.phase === 'waiting';
    const registered = waiting ? null : new Set(view.tickets.map(function (item) { return item.id; }));
    seatNodes.forEach(function (button, index) {
      const id = index + 1;
      const ready = waiting ? !excludedSeats.has(id) : registered.has(id);
      button.disabled = !waiting;
      button.classList.toggle('is-ready', ready);
      button.classList.toggle('is-empty', !ready);
      button.classList.toggle('is-picked', view.winner === id);
      button.setAttribute('aria-pressed', String(ready));
      button.setAttribute('aria-label', id + ' 号' + (view.winner === id ? '，选中' : ready ? '，参与抽签' : '，已排除'));
    });
  }

  function renderMarkers(view) {
    if (ui['touch-board'].hidden) return;
    const board = ui['touch-board'];
    const width = Math.max(1, board.clientWidth);
    const height = Math.max(1, board.clientHeight);
    const live = new Set();
    view.tickets.forEach(function (ticket) {
      live.add(ticket.id);
      let marker = markers.get(ticket.id);
      const styleIndex = (ticket.id - 1) % colors.length;
      if (!marker) {
        marker = document.createElement('span');
        marker.className = 'ticket';
        marker.dataset.symbol = symbols[styleIndex];
        marker.textContent = ticket.id;
        marker.style.setProperty('--ticket-color', colors[styleIndex]);
        ui.markers.appendChild(marker);
        markers.set(ticket.id, marker);
      }
      marker.classList.toggle('is-locked', view.phase !== 'waiting');
      marker.classList.toggle('is-picked', view.winner === ticket.id);
      const point = window.RaffleRound.displayPoint(ticket, width, height);
      marker.style.left = point.x * 100 + '%';
      marker.style.top = point.y * 100 + '%';
    });
    markers.forEach(function (element, id) {
      if (!live.has(id)) {
        element.remove();
        markers.delete(id);
      }
    });
  }

  function renderHoldPoints(pending) {
    holdPoints.forEach(function (element, identifier) {
      if (!pending.some(function (point) { return point.identifier === identifier; })) {
        element.remove();
        holdPoints.delete(identifier);
      }
    });
    pending.forEach(function (point) {
      let indicator = holdPoints.get(point.identifier);
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'hold-point';
        ui['hold-points'].appendChild(indicator);
        holdPoints.set(point.identifier, indicator);
      }
      indicator.style.left = point.x * 100 + '%';
      indicator.style.top = point.y * 100 + '%';
    });
  }

  function statusText(view, count) {
    if (view.phase === 'result') return '本轮结束';
    if (view.phase === 'reveal') return '天选时刻';
    if (view.phase === 'spinning') return '正在抽取';
    if (view.phase === 'countdown') return '请持续按住';
    if (view.mode === 'seat') return count >= 2 ? '点座号可排除' : '至少需要 2 人参与';
    if (count >= 2) return '保持按住，准备倒数';
    if (count === 1) return '再来一位就能开始';
    return touchAvailable ? '两人起抽' : '电脑可用座号模式';
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function renderControls(view) {
    const waiting = view.phase === 'waiting';
    const result = view.phase === 'result';
    const count = view.mode === 'seat' && waiting ? seatCount - excludedSeats.size : view.tickets.length;
    ui.app.dataset.mode = view.mode;
    ui.app.dataset.phase = view.phase;
    ui['touch-board'].hidden = view.mode !== 'touch';
    ui['touch-intro'].hidden = view.mode !== 'touch' || !waiting || count > 0 || round.contactCount() > 0;
    ui['seat-board'].hidden = view.mode !== 'seat';
    ui['seat-setup'].hidden = !waiting || view.mode !== 'seat';
    ui['seat-actions'].hidden = !waiting || view.mode !== 'seat';
    ui['final-actions'].hidden = !result;
    ui['switch-mode'].hidden = activeRound();
    ui['switch-mode'].disabled = resultBusy || activeRound();
    setText(ui['switch-mode'], view.mode === 'touch' ? '座号抽签' : '手指抽签');

    ui['sound-toggle'].disabled = false;
    ui['sound-toggle'].setAttribute('aria-pressed', String(soundEnabled));
    ui['sound-toggle'].setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效');
    const soundLabel = ui['sound-toggle'].querySelector('[data-sound-label]');
    setText(soundLabel || ui['sound-toggle'], soundEnabled ? '音效开' : '音效关');
    ui['recent-button'].hidden = !lastResult || result;
    ui['recent-button'].disabled = !canOpenRecent();

    ui['seat-count'].textContent = seatCount;
    ui['seat-minus'].disabled = !waiting || seatCount <= 2;
    ui['seat-plus'].disabled = !waiting;
    seatPresets.forEach(function (button) {
      button.disabled = !waiting;
      button.setAttribute('aria-pressed', String(Number(button.dataset.seats) === seatCount));
    });
    ui['start-raffle'].disabled = !waiting || count < 2;
    setText(ui['start-raffle'], count < 2 ? '开始抽签' : '开始抽签 · ' + count + ' 人');
    ui.restart.disabled = !result || resultBusy || (view.mode === 'touch' && round.contactCount() > 0);
    ui['save-result'].disabled = !result || resultBusy;
    setText(ui['save-result'], platform.supportsAlbum() ? '保存结果' : '查看结果图');
    ui['share-result'].hidden = !result || !platform.canShare();
    ui['share-result'].disabled = !result || resultBusy;
    setText(ui['count-label'], waiting && view.mode === 'touch' ? '识别到 ' + count + ' 位' : count + ' 人参与');
    setText(ui['round-status'], statusText(view, count));
    ui['result-badge'].hidden = view.phase !== 'reveal' && !result;
    const winnerLabel = ui['result-badge'].querySelector('[data-winner-label]');
    const winnerNumber = ui['result-badge'].querySelector('[data-winner-number]');
    const legacyTask = legacyTasks[view.task];
    setText(winnerLabel, view.winner ? (legacyTask ? legacyTask.result : '天选之人') : '');
    setText(winnerNumber, view.winner ? view.winner + ' 号' : '');
  }

  function renderTimer(at) {
    const counting = !viewingRecent && state.phase === 'countdown';
    ui.timer.hidden = !counting;
    if (!counting) {
      ui.timer.classList.remove('is-urgent');
      displayedSecond = null;
      return;
    }
    const remaining = Math.max(0, state.deadline - at);
    const seconds = Math.ceil(remaining / 1000);
    setText(ui['timer-value'], String(seconds));
    let note = '按住到开奖';
    const change = state.notice;
    if (change && at < change.until) {
      note = rosterMessages[change.kind] + (change.extended ? ' · +1 秒' : '');
    }
    setText(ui['timer-note'], note);
    ui.timer.classList.toggle('is-urgent', seconds <= 3);
    if (displayedSecond !== seconds) {
      if (displayedSecond !== null) sound.play(seconds <= 3 ? 'urgent' : 'tick');
      displayedSecond = seconds;
      if (!document.hidden) platform.vibrate(seconds <= 3 ? 'medium' : 'light');
    }
  }

  function renderScanner(at) {
    const id = round.scanningSeat(at);
    const next = id === null ? null : seatNodes[id - 1];
    if (next === scanningNode) return;
    if (scanningNode) scanningNode.classList.remove('is-scanning');
    scanningNode = next;
    if (scanningNode) {
      scanningNode.classList.add('is-scanning');
      sound.play('scan');
    }
  }

  function renderScene(at) {
    const view = getView();
    renderControls(view);
    renderHoldPoints(viewingRecent ? [] : round.pendingContacts());
    renderMarkers(view);
    renderSeats(view);
    renderTimer(at);
    renderScanner(at);
  }

  function bringWinnerIntoView(view) {
    if (view.mode !== 'seat') return;
    const board = ui['seat-board'];
    const target = seatNodes[view.winner - 1];
    if (!target || board.classList.contains('is-ring')) return;
    const box = board.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    if (item.top < box.top || item.bottom > box.bottom) {
      board.scrollTop += (item.top + item.bottom - box.top - box.bottom) / 2;
    }
  }

  function throwGoldTicket() {
    if (document.hidden || (reducedMotion && reducedMotion.matches)) return;
    const target = state.mode === 'seat' ? seatNodes[state.winner - 1] : markers.get(state.winner);
    if (!target) return;
    const table = ui.stage.getBoundingClientRect();
    const point = target.getBoundingClientRect();
    const ticket = document.createElement('span');
    ticket.textContent = state.winner;
    ticket.setAttribute('aria-hidden', 'true');
    ticket.className = 'flying-ticket';
    ui.stage.appendChild(ticket);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        const dx = point.left + point.width / 2 - table.left - table.width / 2;
        const dy = point.top + point.height / 2 - table.top - table.height * 0.46;
        ticket.style.transform = 'translate(-50%, -50%) translate(' + dx + 'px, ' + dy + 'px) rotate(0deg) scale(0.5)';
        ticket.style.opacity = '0';
      });
    });
    window.setTimeout(function () { ticket.remove(); }, state.mode === 'seat' ? 550 : 710);
  }

  function handleTransition(at) {
    if (state.phase === phaseBefore) return false;
    const previous = phaseBefore;
    phaseBefore = state.phase;
    if (state.phase === 'countdown' || state.phase === 'spinning') sound.play('stamp');
    renderScene(at);
    if (state.phase === 'reveal' || (state.phase === 'result' && previous !== 'reveal')) {
      bringWinnerIntoView(getView());
      if (state.phase === 'reveal') throwGoldTicket();
      if (!document.hidden) {
        sound.play('win');
        platform.vibrate('medium');
      }
    }
    if (state.phase === 'result') {
      lastResult = state.result;
      platform.store('recent', lastResult).then(function (saved) {
        if (saved === false && state.result === lastResult && !ui.feedback.textContent) {
          feedback('本轮结果可继续查看，重新打开后可能无法恢复');
        }
      });
    }
    return true;
  }

  function step() {
    frame = null;
    const at = now();
    const changed = round.advance(at);
    if (!handleTransition(at)) {
      if (changed) renderScene(at);
      else if (state.phase === 'spinning') renderScanner(at);
      else renderTimer(at);
    }
    schedule();
  }

  function schedule() {
    if (frame === null && !document.hidden && !viewingRecent &&
        (state.readyAt !== null || activeRound() || round.pendingContacts().length > 0)) {
      frame = window.requestAnimationFrame(step);
    }
  }

  function pointOnBoard(touch, rect) {
    return {
      x: (touch.clientX - rect.left) / Math.max(1, rect.width),
      y: (touch.clientY - rect.top) / Math.max(1, rect.height)
    };
  }

  function onTouch(event) {
    if (viewingRecent || state.mode !== 'touch') return;
    const observedAt = now();
    const at = event.timeStamp > 0 && event.timeStamp <= observedAt ? event.timeStamp : observedAt;
    const rect = ui['touch-board'].getBoundingClientRect();
    const registered = round.advance(at);
    let changed = false;
    if (event.type === 'touchstart' || event.type === 'touchend') sound.prime();
    for (let index = 0; index < event.changedTouches.length; index++) {
      const touch = event.changedTouches[index];
      if (event.type === 'touchend' || event.type === 'touchcancel') {
        changed = round.release(touch.identifier, at) || changed;
        continue;
      }
      const point = pointOnBoard(touch, rect);
      const outside = point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1 ||
        platform.isInHostGestureArea(touch.clientX, touch.clientY);
      if (outside) {
        if (event.type === 'touchmove') {
          changed = round.release(touch.identifier, at) || changed;
        }
        continue;
      }
      if (event.type === 'touchstart') {
        if (round.join(touch.identifier, point, at)) {
          sound.play('tap');
          changed = true;
        }
      } else {
        changed = round.move(touch.identifier, point) || changed;
      }
    }
    if (changed && event.cancelable) event.preventDefault();
    if (!handleTransition(observedAt) && (changed || registered)) renderScene(observedAt);
    schedule();
  }

  function resetRound(mode) {
    round.reset(mode);
    viewingRecent = false;
    phaseBefore = 'waiting';
    displayedSecond = null;
    sound.silence();
    feedback('');
    renderScene(now());
  }

  function changeSeatCount(value) {
    if (state.phase !== 'waiting' || state.mode !== 'seat' || (value === seatCount && !excludedSeats.size)) return;
    seatCount = Math.max(2, value);
    excludedSeats.clear();
    sound.prime();
    sound.play('tap');
    renderScene(now());
  }

  function validResult(value) {
    if (!value || (value.task !== undefined && !Object.prototype.hasOwnProperty.call(legacyTasks, value.task)) ||
        (value.mode !== 'touch' && value.mode !== 'seat') || !Array.isArray(value.tickets) ||
        value.tickets.length < 2 || !Number.isSafeInteger(value.winner)) return false;
    if (value.mode === 'seat' && (!value.layout || !Number.isSafeInteger(value.layout.total) ||
        value.layout.total < value.tickets.length || typeof value.layout.ring !== 'boolean')) return false;
    const numbers = new Set();
    for (const ticket of value.tickets) {
      if (!ticket || !Number.isSafeInteger(ticket.id) || ticket.id < 1 || numbers.has(ticket.id) ||
          !Number.isFinite(ticket.x) || !Number.isFinite(ticket.y) ||
          ticket.x < 0 || ticket.x > 1 || ticket.y < 0 || ticket.y > 1 ||
          (value.mode === 'seat' && ticket.id > value.layout.total)) return false;
      numbers.add(ticket.id);
    }
    return numbers.has(value.winner);
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function drawResult(result) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    const legacyTask = legacyTasks[result.task];
    const width = canvas.width = 720;
    const height = canvas.height = 960;
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#372257');
    background.addColorStop(0.54, '#1b132e');
    background.addColorStop(1, '#110e20');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.font = '700 30px system-ui, sans-serif';
    context.fillStyle = '#ede1ff';
    context.fillText('天选之人', width / 2, 56);
    context.font = '800 64px system-ui, sans-serif';
    context.fillStyle = '#ffcd90';
    context.fillText(result.winner + ' 号', width / 2, legacyTask ? 127 : 150, 620);
    if (legacyTask) {
      context.font = '700 34px system-ui, sans-serif';
      context.fillStyle = '#fff4e8';
      context.fillText(legacyTask.result, width / 2, 192);
    }
    roundRect(context, 44, 252, 632, 566, 30);
    const arena = context.createRadialGradient(360, 535, 24, 360, 535, 400);
    arena.addColorStop(0, '#331f54');
    arena.addColorStop(1, '#1b112f');
    context.fillStyle = arena;
    context.fill();
    context.strokeStyle = '#74559b';
    context.lineWidth = 2;
    context.stroke();
    context.lineWidth = 1;
    context.strokeStyle = '#583978';
    [70, 140, 210].forEach(function (radius) {
      context.beginPath();
      context.arc(360, 535, radius, 0, 2 * Math.PI);
      context.stroke();
    });

    let seats = result.tickets;
    if (result.mode === 'seat') {
      const used = new Set(result.tickets.map(function (ticket) { return ticket.id; }));
      seats = Array.from({ length: result.layout.total }, function (_, index) {
        const id = index + 1;
        const point = seatPosition(id, result.layout);
        return { id: id, x: point.x, y: point.y, empty: !used.has(id) };
      });
    }
    const rows = result.layout && !result.layout.ring
      ? Math.ceil(result.layout.total / seatColumns(result.layout.total)) : 1;
    const size = Math.max(10, Math.min(58, 350 / rows));
    seats.slice().sort(function (a, b) { return Number(a.id === result.winner) - Number(b.id === result.winner); })
      .forEach(function (ticket) {
        const picked = ticket.id === result.winner;
        const x = 98 + ticket.x * 524;
        const y = 302 + ticket.y * 466;
        const scale = picked ? 1.14 : 1;
        const half = size * scale / 2;
        context.beginPath();
        context.arc(x, y, half, 0, 2 * Math.PI);
        context.fillStyle = picked ? '#ffcd90' : ticket.empty ? '#332644' : colors[(ticket.id - 1) % colors.length];
        context.fill();
        if (picked) {
          context.beginPath();
          context.arc(x, y, half + 7, 0, 2 * Math.PI);
          context.lineWidth = 3;
          context.strokeStyle = '#ffcd90';
          context.stroke();
        }
        context.font = '700 ' + Math.max(9, Math.round(size * 0.55)) + 'px system-ui, sans-serif';
        context.fillStyle = ticket.empty ? '#d5c8e8' : '#241532';
        context.fillText(String(ticket.id), x, y, half * 1.75);
      });
    context.fillStyle = '#e4d3f9';
    context.font = '500 28px system-ui, sans-serif';
    const participantCount = result.tickets.length + ' 人参与';
    context.fillText(legacyTask ? legacyTask.question + ' · ' + participantCount : participantCount, width / 2, 880, 620);
    return canvas.toDataURL('image/png');
  }

  function previewResult(image, message) {
    ui['result-image'].src = image;
    ui['result-preview'].hidden = false;
    ui['close-preview'].disabled = false;
    feedback(message);
    const hint = ui['result-preview'].querySelector('[data-preview-hint]');
    if (hint) hint.textContent = message || '可以截屏保存这张结果图';
    ui['close-preview'].focus();
  }

  function closePreview() {
    ui['result-preview'].hidden = true;
    ui['result-image'].removeAttribute('src');
    ui['save-result'].focus();
  }

  async function saveResult() {
    if (resultBusy || (!viewingRecent && state.phase !== 'result')) return;
    const result = viewingRecent ? lastResult : state.result;
    const image = drawResult(result);
    if (!image) {
      feedback('暂时无法生成图片，可以截图保留当前结果');
      return;
    }
    if (!platform.supportsAlbum()) {
      previewResult(image, '可以截屏保存这张结果图');
      return;
    }
    resultBusy = true;
    renderControls(getView());
    try {
      if (await platform.saveToAlbum(image)) {
        feedback('已保存到相册');
      } else {
        previewResult(image, '相册未确认保存，可以截屏保留');
      }
    } catch (error) {
      previewResult(image, '相册保存失败，可以截屏保留');
    } finally {
      resultBusy = false;
      renderControls(getView());
    }
  }

  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (eventName) {
    ui['touch-board'].addEventListener(eventName, onTouch, { passive: false });
  });
  ui['touch-board'].addEventListener('contextmenu', function (event) {
    event.preventDefault();
  });

  ui['sound-toggle'].addEventListener('click', function () {
    soundChanged = true;
    soundEnabled = !soundEnabled;
    sound.setEnabled(soundEnabled);
    if (soundEnabled) sound.prime();
    platform.store('sound', soundEnabled);
    renderControls(getView());
  });

  ui['recent-button'].addEventListener('click', function () {
    if (!canOpenRecent()) return;
    viewingRecent = true;
    feedback('');
    renderScene(now());
    bringWinnerIntoView(getView());
  });

  ui['switch-mode'].addEventListener('click', function () {
    if (activeRound() || resultBusy) return;
    const view = getView();
    resetRound(view.mode === 'touch' ? 'seat' : 'touch');
  });

  ui['seat-minus'].addEventListener('click', function () { changeSeatCount(seatCount - 1); });
  ui['seat-plus'].addEventListener('click', function () { changeSeatCount(seatCount + 1); });
  seatPresets.forEach(function (button) {
    button.addEventListener('click', function () { changeSeatCount(Number(button.dataset.seats)); });
  });

  ui['seat-board'].addEventListener('click', function (event) {
    const id = Number(event.target.dataset.seat);
    if (!Number.isSafeInteger(id) || id < 1 || viewingRecent || state.phase !== 'waiting') return;
    if (excludedSeats.has(id)) excludedSeats.delete(id);
    else excludedSeats.add(id);
    sound.prime();
    sound.play('tap');
    renderScene(now());
  });

  ui['start-raffle'].addEventListener('click', function () {
    const layout = seatLayout();
    const tickets = [];
    for (let id = 1; id <= layout.total; id++) {
      if (excludedSeats.has(id)) continue;
      const point = seatPosition(id, layout);
      tickets.push({ id: id, x: point.x, y: point.y });
    }
    const at = now();
    if (!round.startSeats(tickets, at, layout, reducedMotion && reducedMotion.matches)) return;
    sound.prime();
    feedback('');
    handleTransition(at);
    schedule();
  });

  ui.restart.addEventListener('click', function () {
    const view = getView();
    if (view.phase !== 'result' || resultBusy || (view.mode === 'touch' && round.contactCount())) return;
    if (view.mode === 'seat') {
      seatCount = view.layout.total;
      const participants = new Set(view.tickets.map(function (ticket) { return ticket.id; }));
      excludedSeats.clear();
      for (let id = 1; id <= seatCount; id++) {
        if (!participants.has(id)) excludedSeats.add(id);
      }
    }
    resetRound(view.mode);
  });

  ui['save-result'].addEventListener('click', saveResult);
  ui['close-preview'].addEventListener('click', closePreview);
  ui['result-preview'].addEventListener('click', function (event) {
    if (event.target.classList.contains('result-preview__shade')) closePreview();
  });
  ui['share-result'].addEventListener('click', async function () {
    if (resultBusy || !platform.canShare()) return;
    resultBusy = true;
    renderControls(getView());
    const shared = await platform.shareCard();
    resultBusy = false;
    if (!shared) feedback('当前无法打开分享，可以保存结果图');
    renderControls(getView());
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Tab' && !ui['result-preview'].hidden) {
      event.preventDefault();
      ui['close-preview'].focus();
    }
    if (event.key === 'Escape' && !ui['result-preview'].hidden) closePreview();
  });
  document.addEventListener('visibilitychange', function () {
    const at = now();
    if (document.hidden) {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      round.clearContacts();
      sound.silence();
      return;
    }
    round.advance(at);
    if (!handleTransition(at)) renderScene(at);
    schedule();
    platform.refreshWindow().then(function () { renderScene(now()); });
  });

  let resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      renderScene(now());
      platform.refreshWindow().then(function () { renderScene(now()); });
    }, 100);
  });

  platform.initialize().then(async function () {
    renderControls(getView());
    const results = await Promise.all([platform.load('sound'), platform.load('recent')]);
    if (soundChanged) {
      platform.store('sound', soundEnabled);
    } else if (typeof results[0] === 'boolean') {
      soundEnabled = results[0];
      sound.setEnabled(soundEnabled);
    }
    if (!lastResult && validResult(results[1])) lastResult = results[1];
    renderScene(now());
  });

  renderScene(now());
  if (ui.app) ui.app.dataset.ready = 'true';
}());
