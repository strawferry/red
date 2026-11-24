(function (root) {
  'use strict';

  /*
   * The geometry module deliberately owns the cutting maths.  This file only
   * paints the geometry it receives, so it can be used by the first screen and
   * by the share-card renderer without having to know how a cut was calculated.
   */

  var DESIGN_SIZE = 400;
  var MIN_COUNT = 2;
  var MAX_COUNT = 16;
  var SANS = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  var TITLE = 'Georgia, "Songti SC", "STSong", serif';
  var COLORS = {
    paper: '#fff9f0',
    paperDeep: '#f7ead8',
    cocoa: '#6d443e',
    cocoaDark: '#4b3032',
    strawberry: '#df685d',
    strawberryDark: '#b84d4e',
    strawberrySoft: '#f5b0a1',
    cream: '#fff4dc',
    creamBright: '#fffaf0',
    mint: '#a8d5bc',
    saffron: '#e8a246',
    berry: '#c34d58',
    leaf: '#6e9e78'
  };

  var SHAPE_NAMES = {
    round: '圆形',
    square: '方形',
    rectangle: '长方形',
    heart: '心形'
  };

  function own(object, key) {
    return Boolean(object && Object.prototype.hasOwnProperty.call(object, key));
  }

  function finite(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function integer(value, fallback) {
    var number = Math.round(finite(value, fallback));
    return number;
  }

  function point(value, fallback) {
    var source = value || fallback || { x: 0, y: 0 };
    return {
      x: finite(source.x, fallback ? finite(fallback.x, 0) : 0),
      y: finite(source.y, fallback ? finite(fallback.y, 0) : 0)
    };
  }

  function safeShape(value) {
    var key = String(value || '').toLowerCase();
    if (key === 'circle') key = 'round';
    if (key === 'rect') key = 'rectangle';
    return SHAPE_NAMES[key] ? key : 'round';
  }

  function defaultBounds(shape) {
    if (shape === 'square') return { x: 62, y: 62, width: 276, height: 276 };
    if (shape === 'rectangle') return { x: 42, y: 102, width: 316, height: 196 };
    if (shape === 'heart') return { x: 70, y: 48, width: 260, height: 302 };
    return { x: 52, y: 52, width: 296, height: 296 };
  }

  function normalizeBounds(value, fallback) {
    var source = value || fallback;
    var width = Math.max(1, finite(source.width, fallback.width));
    var height = Math.max(1, finite(source.height, fallback.height));
    return {
      x: finite(source.x, fallback.x),
      y: finite(source.y, fallback.y),
      width: width,
      height: height
    };
  }

  function boundsFromOutline(outline, fallback) {
    var kind = outline && outline.kind;
    var points;
    var i;
    var minX;
    var minY;
    var maxX;
    var maxY;
    if (kind === 'circle') {
      var cx = finite(outline.cx, fallback.x + fallback.width / 2);
      var cy = finite(outline.cy, fallback.y + fallback.height / 2);
      var radius = Math.max(1, finite(outline.r, Math.min(fallback.width, fallback.height) / 2));
      return { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };
    }
    if (kind === 'rect') {
      return normalizeBounds(outline, fallback);
    }
    if (kind === 'polygon' && Array.isArray(outline.points) && outline.points.length) {
      points = outline.points;
      minX = maxX = finite(points[0].x, fallback.x);
      minY = maxY = finite(points[0].y, fallback.y);
      for (i = 1; i < points.length; i += 1) {
        minX = Math.min(minX, finite(points[i].x, minX));
        minY = Math.min(minY, finite(points[i].y, minY));
        maxX = Math.max(maxX, finite(points[i].x, maxX));
        maxY = Math.max(maxY, finite(points[i].y, maxY));
      }
      return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
      };
    }
    return fallback;
  }

  function normalizeOutline(value, shape, bounds) {
    var source = value || {};
    var kind = source.kind;
    var points;
    var i;
    if (kind === 'circle') {
      return {
        kind: 'circle',
        cx: finite(source.cx, bounds.x + bounds.width / 2),
        cy: finite(source.cy, bounds.y + bounds.height / 2),
        r: Math.max(1, finite(source.r, Math.min(bounds.width, bounds.height) / 2))
      };
    }
    if (kind === 'rect') {
      return {
        kind: 'rect',
        x: finite(source.x, bounds.x),
        y: finite(source.y, bounds.y),
        width: Math.max(1, finite(source.width, bounds.width)),
        height: Math.max(1, finite(source.height, bounds.height))
      };
    }
    if (kind === 'polygon' && Array.isArray(source.points) && source.points.length >= 3) {
      points = [];
      for (i = 0; i < source.points.length; i += 1) points.push(point(source.points[i]));
      return { kind: 'polygon', points: points };
    }
    if (shape === 'heart') return { kind: 'heart', bounds: bounds };
    if (shape === 'square' || shape === 'rectangle') {
      return { kind: 'rect', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }
    return {
      kind: 'circle',
      cx: bounds.x + bounds.width / 2,
      cy: bounds.y + bounds.height / 2,
      r: Math.min(bounds.width, bounds.height) / 2
    };
  }

  function normalizePlan(plan) {
    var source = plan || {};
    var shape = safeShape(source.shape);
    var fallbackBounds = defaultBounds(shape);
    var outlineSource = source.outline;
    var outlineBounds = boundsFromOutline(outlineSource, fallbackBounds);
    var bounds = normalizeBounds(source.bounds, outlineBounds);
    var outline = normalizeOutline(outlineSource, shape, bounds);
    var cuts = [];
    var pieces = [];
    var rawCuts = Array.isArray(source.cuts) ? source.cuts : [];
    var rawPieces = Array.isArray(source.pieces) ? source.pieces : [];
    var i;
    var cut;
    var from;
    var to;
    var piece;
    for (i = 0; i < rawCuts.length; i += 1) {
      cut = rawCuts[i] || {};
      from = point(cut.from, { x: bounds.x, y: bounds.y + bounds.height / 2 });
      to = point(cut.to, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
      cuts.push({
        from: from,
        to: to,
        caption: typeof cut.caption === 'string' ? cut.caption : '',
        percent: finite(cut.percent, null)
      });
    }
    for (i = 0; i < rawPieces.length; i += 1) {
      piece = rawPieces[i];
      if (!piece || typeof piece !== 'object') continue;
      pieces.push(point(piece));
    }
    return {
      shape: shape,
      count: clamp(integer(source.count, pieces.length || Math.max(2, cuts.length + 1)), MIN_COUNT, MAX_COUNT),
      bounds: bounds,
      outline: outline,
      cuts: cuts,
      pieces: pieces,
      hint: typeof source.hint === 'string' ? source.hint : ''
    };
  }

  function traceHeart(context, bounds) {
    var x = bounds.x;
    var y = bounds.y;
    var width = bounds.width;
    var height = bounds.height;
    var centerX = x + width / 2;
    context.moveTo(centerX, y + height * 0.22);
    context.bezierCurveTo(
      x + width * 0.37, y - height * 0.02,
      x, y + height * 0.07,
      x, y + height * 0.30
    );
    context.bezierCurveTo(
      x, y + height * 0.53,
      x + width * 0.17, y + height * 0.70,
      centerX, y + height * 0.98
    );
    context.bezierCurveTo(
      x + width * 0.83, y + height * 0.70,
      x + width, y + height * 0.53,
      x + width, y + height * 0.30
    );
    context.bezierCurveTo(
      x + width, y + height * 0.07,
      x + width * 0.63, y - height * 0.02,
      centerX, y + height * 0.22
    );
    context.closePath();
  }

  function traceOutline(context, outline, bounds) {
    var i;
    var points;
       var kind = outline && outline.kind;
    if (!context || typeof context.beginPath !== 'function') return;
    context.beginPath();
    if (kind === 'circle') {
      context.arc(outline.cx, outline.cy, outline.r, 0, Math.PI * 2, false);
      context.closePath();
      return;
    }
    if (kind === 'rect') {
      context.rect(outline.x, outline.y, outline.width, outline.height);
      return;
    }
    if (kind === 'polygon' && Array.isArray(outline.points) && outline.points.length) {
      points = outline.points;
      context.moveTo(points[0].x, points[0].y);
      for (i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
      context.closePath();
      return;
    }
    traceHeart(context, (outline && outline.bounds) || bounds);
  }

  function drawPathFill(context, outline, bounds, color) {
    traceOutline(context, outline, bounds);
    context.fillStyle = color;
    context.fill();
  }

  function drawPathStroke(context, outline, bounds, color, lineWidth) {
    traceOutline(context, outline, bounds);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  function setDash(context, values) {
    if (context && typeof context.setLineDash === 'function') context.setLineDash(values || []);
  }

  function gradient(context, bounds, first, second) {
    var value;
    if (!context || typeof context.createLinearGradient !== 'function') return first;
    value = context.createLinearGradient(0, bounds.y, 0, bounds.y + bounds.height);
    value.addColorStop(0, first);
    value.addColorStop(1, second);
    return value;
  }

  function pointInside(outline, bounds, x, y) {
    var kind = outline && outline.kind;
    var dx;
    var dy;
    var points;
    var inside = false;
    var i;
    var j;
    var xi;
    var yi;
    var xj;
    var yj;
    if (kind === 'circle') {
      dx = x - outline.cx;
      dy = y - outline.cy;
      return dx * dx + dy * dy <= outline.r * outline.r;
    }
    if (kind === 'rect') {
      return x >= outline.x && x <= outline.x + outline.width &&
        y >= outline.y && y <= outline.y + outline.height;
    }
    if (kind === 'polygon' && outline.points && outline.points.length >= 3) {
      points = outline.points;
      j = points.length - 1;
      for (i = 0; i < points.length; i += 1) {
        xi = points[i].x;
        yi = points[i].y;
        xj = points[j].x;
        yj = points[j].y;
        if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        j = i;
      }
      return inside;
    }
    if (bounds) {
      /* A conservative heart test keeps decorations away from its lobes. */
      dx = (x - (bounds.x + bounds.width / 2)) / (bounds.width / 2);
      dy = (y - (bounds.y + bounds.height * 0.43)) / (bounds.height * 0.54);
      return Math.pow(dx * dx + dy * dy - 1, 3) - dx * dx * Math.pow(dy, 3) <= 0.12;
    }
    return false;
  }

  function distanceToSegment(pointValue, start, end) {
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var lengthSquared = dx * dx + dy * dy;
    var t;
    var x;
    var y;
    if (!lengthSquared) {
      dx = pointValue.x - start.x;
      dy = pointValue.y - start.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    t = ((pointValue.x - start.x) * dx + (pointValue.y - start.y) * dy) / lengthSquared;
    t = clamp(t, 0, 1);
    x = start.x + t * dx;
    y = start.y + t * dy;
    dx = pointValue.x - x;
    dy = pointValue.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function decorationClear(candidate, cuts) {
    var i;
    for (i = 0; i < cuts.length; i += 1) {
      if (distanceToSegment(candidate, cuts[i].from, cuts[i].to) < 18) return false;
    }
    return true;
  }

  function drawBerry(context, x, y, radius) {
    context.save();
    context.fillStyle = COLORS.berry;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2, false);
    context.fill();
    context.fillStyle = COLORS.strawberryDark;
    context.beginPath();
    context.arc(x - radius * 0.25, y - radius * 0.2, radius * 0.25, 0, Math.PI * 2, false);
    context.fill();
    context.fillStyle = COLORS.leaf;
    context.beginPath();
    context.moveTo(x - radius * 0.25, y - radius * 0.72);
    context.lineTo(x - radius * 0.78, y - radius * 1.08);
    context.lineTo(x - radius * 0.03, y - radius * 1.03);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x + radius * 0.05, y - radius * 0.70);
    context.lineTo(x + radius * 0.62, y - radius * 1.08);
    context.lineTo(x + radius * 0.38, y - radius * 0.30);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawCakeDecorations(context, plan) {
    var b = plan.bounds;
    var candidates = [
      { x: b.x + b.width * 0.24, y: b.y + b.height * 0.27, r: 5.5 },
      { x: b.x + b.width * 0.76, y: b.y + b.height * 0.26, r: 5 },
      { x: b.x + b.width * 0.26, y: b.y + b.height * 0.75, r: 4.6 },
      { x: b.x + b.width * 0.76, y: b.y + b.height * 0.75, r: 4.8 }
    ];
    var i;
    var candidate;
    for (i = 0; i < candidates.length; i += 1) {
      candidate = candidates[i];
      if (pointInside(plan.outline, b, candidate.x, candidate.y) && decorationClear(candidate, plan.cuts)) {
        drawBerry(context, candidate.x, candidate.y, candidate.r);
      }
    }
    context.save();
    context.fillStyle = 'rgba(255, 250, 238, 0.62)';
    context.beginPath();
    context.arc(b.x + b.width * 0.50, b.y + b.height * 0.31, 3.2, 0, Math.PI * 2, false);
    context.fill();
    context.restore();
  }

  function drawHeartGuide(context, plan) {
    var b = plan.bounds;
    var cuts = plan.cuts;
    var rulerX = b.x;
    var rulerWidth = b.width;
    var rulerY;
    var rows;
    var maxLabelY;
    var i;
    var cut;
    var percent;
    var tickX;
    var labelY;
    var label;
    var labelFont = 'bold 11px ' + SANS;
    if (plan.shape !== 'heart' || rulerWidth < 80) return;
    rulerY = b.y + b.height + 12;
    rows = cuts.length > 4 ? 2 : 1;
    maxLabelY = rulerY + 19 + (rows - 1) * 14;
    if (maxLabelY > 394) rulerY -= maxLabelY - 394;
    if (rulerY < b.y + b.height + 7) return;
    context.save();
    context.strokeStyle = 'rgba(109, 68, 62, 0.46)';
    context.fillStyle = 'rgba(109, 68, 62, 0.70)';
    context.lineWidth = 1.4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(rulerX, rulerY);
    context.lineTo(rulerX + rulerWidth, rulerY);
    context.stroke();
    context.beginPath();
    context.moveTo(rulerX, rulerY - 3);
    context.lineTo(rulerX, rulerY + 3);
    context.moveTo(rulerX + rulerWidth, rulerY - 3);
    context.lineTo(rulerX + rulerWidth, rulerY + 3);
    context.stroke();
    context.fillStyle = COLORS.cocoa;
    context.font = 'bold 9px ' + SANS;
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillText('左起', rulerX, rulerY - 5);
    context.font = labelFont;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    for (i = 0; i < cuts.length; i += 1) {
      cut = cuts[i];
      percent = finite(cut.percent, (cut.from.x - b.x) / b.width * 100);
      percent = clamp(percent, 0, 100);
      tickX = rulerX + rulerWidth * percent / 100;
      context.strokeStyle = COLORS.saffron;
      context.lineWidth = 2.2;
      context.beginPath();
      context.moveTo(tickX, rulerY - 5);
      context.lineTo(tickX, rulerY + 6);
      context.stroke();
      context.fillStyle = COLORS.cocoaDark;
      label = formatPercent(percent);
      labelY = rulerY + 8 + (rows > 1 && i % 2 ? 14 : 0);
      context.fillText(label, tickX, labelY);
    }
    context.restore();
  }

  function formatPercent(value) {
    var rounded = Math.round(value * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) return String(Math.round(rounded)) + '%';
    return rounded.toFixed(1) + '%';
  }

  function drawCakeBase(context, plan) {
    var b = plan.bounds;
    var outer = plan.outline;
    context.save();
    context.shadowColor = 'rgba(87, 48, 48, 0.20)';
    context.shadowBlur = 10;
    context.shadowOffsetY = 7;
    drawPathFill(context, outer, b, COLORS.paperDeep);
    context.restore();

    context.save();
    context.lineJoin = 'round';
    drawPathStroke(context, outer, b, COLORS.creamBright, 13);
    drawPathFill(context, outer, b, gradient(context, b, '#f6ad9e', '#e87972'));
    context.restore();

    context.save();
    context.lineJoin = 'round';
    drawPathStroke(context, outer, b, COLORS.cocoa, 2.5);
    context.globalAlpha = 0.68;
    drawPathStroke(context, outer, b, 'rgba(255, 244, 220, 0.72)', 2);
    context.restore();

    context.save();
    context.strokeStyle = COLORS.cream;
    context.lineWidth = 7;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    setDash(context, [1, 13]);
    traceOutline(context, outer, b);
    context.stroke();
    setDash(context, []);
    context.restore();

    drawCakeDecorations(context, plan);
    drawHeartGuide(context, plan);
  }

  function drawLine(context, start, end, color, width, alpha) {
    context.save();
    context.globalAlpha = alpha === undefined ? 1 : alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.restore();
  }

  function visibleProgress(options, length) {
    var progress = options && own(options, 'progress') ? finite(options.progress, length) : length;
    progress = clamp(progress, 0, length);
    return {
      complete: Math.floor(progress),
      fraction: progress - Math.floor(progress),
      value: progress
    };
  }

  function drawCuts(context, plan, options) {
    var progress = visibleProgress(options, plan.cuts.length);
    var focus = options && own(options, 'focus') ? integer(options.focus, -1) : -1;
    var stepLabels = Boolean(options && options.stepLabels);
    var i;
    var cut;
    var end;
    var active;
    var startPoint;
    var target;
    var directionX;
    var directionY;
    var length;
    for (i = 0; i < plan.cuts.length; i += 1) {
      cut = plan.cuts[i];
      if (i < progress.complete) {
        end = cut.to;
      } else if (i === progress.complete && progress.fraction > 0) {
        end = {
          x: cut.from.x + (cut.to.x - cut.from.x) * progress.fraction,
          y: cut.from.y + (cut.to.y - cut.from.y) * progress.fraction
        };
      } else {
        continue;
      }
      active = i === focus || (i === progress.complete && progress.fraction > 0);
      context.save();
      traceOutline(context, plan.outline, plan.bounds);
      context.clip();
      drawLine(context, cut.from, end, active ? COLORS.strawberryDark : COLORS.cocoa, active ? 4.2 : 2.6, 0.26);
      drawLine(context, cut.from, end, active ? COLORS.saffron : COLORS.cocoa, active ? 2.9 : 1.75, 1);
      context.restore();

      if (active) {
        context.save();
        context.fillStyle = COLORS.saffron;
        context.beginPath();
        context.arc(end.x, end.y, 3.5, 0, Math.PI * 2, false);
        context.fill();
        context.restore();
      }
      if (stepLabels) {
        startPoint = cut.from;
        target = cut.to;
        directionX = target.x - startPoint.x;
        directionY = target.y - startPoint.y;
        length = Math.sqrt(directionX * directionX + directionY * directionY) || 1;
        drawStepBadge(context, startPoint.x + directionX / length * 17,
          startPoint.y + directionY / length * 17, i + 1, plan.bounds);
      }
    }
  }

  function roundedPath(context, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function drawStepBadge(context, x, y, number, bounds) {
    var width = 29;
    var height = 19;
    var left = clamp(x - width / 2, bounds.x + 4, bounds.x + bounds.width - width - 4);
    var top = clamp(y - height / 2, bounds.y + 4, bounds.y + bounds.height - height - 4);
    context.save();
    context.shadowColor = 'rgba(95, 50, 43, 0.18)';
    context.shadowBlur = 4;
    context.shadowOffsetY = 1;
    roundedPath(context, left, top, width, height, 7);
    context.fillStyle = COLORS.saffron;
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = '#fff2d7';
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = COLORS.cocoaDark;
    context.font = 'bold 10px ' + SANS;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('刀' + number, left + width / 2, top + height / 2 + 0.5);
    context.restore();
  }

  function drawPieceLabels(context, plan, scale) {
    var i;
    var piece;
    var zoom = clamp(finite(scale, 1), 0.6, 1.2);
    var radius = (plan.count > 12 ? 10 : 12) * zoom;
    var fontSize = (plan.count > 12 ? 10 : 12) * zoom;
    var label = '';
    for (i = 0; i < plan.pieces.length && i < plan.count; i += 1) {
      piece = plan.pieces[i];
      label = String(i + 1);
      context.save();
      context.shadowColor = 'rgba(87, 45, 43, 0.18)';
      context.shadowBlur = 3;
      context.shadowOffsetY = 1;
      context.fillStyle = 'rgba(255, 250, 240, 0.94)';
      context.beginPath();
      context.arc(piece.x, piece.y, radius, 0, Math.PI * 2, false);
      context.fill();
      context.shadowColor = 'transparent';
      context.strokeStyle = 'rgba(184, 77, 78, 0.58)';
      context.lineWidth = 1.3;
      context.stroke();
      context.fillStyle = COLORS.strawberryDark;
      context.font = 'bold ' + fontSize + 'px ' + SANS;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, piece.x, piece.y + 0.5);
      context.restore();
    }
  }

  function drawScene(context, plan, options) {
    drawCakeBase(context, plan);
    drawCuts(context, plan, options || {});
    if (!options || options.showPieces !== false) drawPieceLabels(context, plan, options && options.pieceScale);
  }

  function fillCanvasBackground(context, width, height) {
    var background;
    if (typeof context.createLinearGradient === 'function') {
      background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#fffaf2');
      background.addColorStop(1, '#f8ecdc');
      context.fillStyle = background;
    } else {
      context.fillStyle = COLORS.paper;
    }
    context.fillRect(0, 0, width, height);
    context.save();
    context.fillStyle = 'rgba(232, 162, 70, 0.12)';
    context.beginPath();
    context.arc(width * 0.11, height * 0.15, Math.max(2, Math.min(width, height) * 0.012), 0, Math.PI * 2, false);
    context.arc(width * 0.89, height * 0.84, Math.max(2, Math.min(width, height) * 0.009), 0, Math.PI * 2, false);
    context.fill();
    context.restore();
  }

  function withDesignScale(context, x, y, size, callback) {
    context.save();
    context.translate(x, y);
    context.scale(size / DESIGN_SIZE, size / DESIGN_SIZE);
    callback();
    context.restore();
  }

  function draw(canvas, planSource, options) {
    var context;
    var width;
    var height;
    var size;
    var x;
    var y;
    var plan;
    if (!canvas || typeof canvas.getContext !== 'function') return canvas;
    context = canvas.getContext('2d');
    if (!context) return canvas;
    width = Math.max(0, finite(canvas.width, 0));
    height = Math.max(0, finite(canvas.height, 0));
    if (!width || !height) return canvas;
    plan = normalizePlan(planSource);
    size = Math.min(width, height);
    x = (width - size) / 2;
    y = (height - size) / 2;
    context.clearRect(0, 0, width, height);
    fillCanvasBackground(context, width, height);
    withDesignScale(context, x, y, size, function () {
      drawScene(context, plan, options || {});
    });
    return canvas;
  }

  function textValue(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function cleanText(value) {
    return textValue(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function measure(context, value, font) {
    context.font = font;
    return context.measureText(value).width;
  }

  function wrapLines(context, value, maxWidth, font, maxLines) {
    var source = cleanText(value);
    var chars = source.split('');
    var lines = [];
    var current = '';
    var i;
    var candidate;
    var last;
    if (!source) return [];
    context.font = font;
    for (i = 0; i < chars.length; i += 1) {
      candidate = current + chars[i];
      if (current && measure(context, candidate, font) > maxWidth) {
        lines.push(current);
        current = chars[i];
        if (lines.length === maxLines) {
          last = lines[maxLines - 1];
          lines[maxLines - 1] = last.length > 1 ? last.slice(0, -1) + '…' : last + '…';
          return lines;
        }
      } else {
        current = candidate;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    return lines;
  }

  function shapeLabel(shape) {
    return SHAPE_NAMES[shape] || SHAPE_NAMES.round;
  }

  function drawPosterHeader(context, plan) {
    context.save();
    context.fillStyle = COLORS.cocoaDark;
    context.font = 'bold 43px ' + TITLE;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('蛋糕分分', 54, 78);
    context.fillStyle = COLORS.strawberryDark;
    context.font = 'bold 21px ' + SANS;
    context.fillText(shapeLabel(plan.shape) + ' · ' + plan.count + '份', 56, 116);
    context.strokeStyle = 'rgba(109, 68, 62, 0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(56, 139);
    context.lineTo(664, 139);
    context.stroke();
    context.fillStyle = COLORS.saffron;
    context.beginPath();
    context.arc(646, 76, 7, 0, Math.PI * 2, false);
    context.fill();
    context.fillStyle = COLORS.strawberry;
    context.beginPath();
    context.arc(664, 76, 4, 0, Math.PI * 2, false);
    context.fill();
    context.restore();
  }

  function drawPosterFooter(context, plan) {
    var font = 'bold 22px ' + SANS;
    var lines = wrapLines(context, plan.hint || '按图上的刀次，从标记边缘下刀。', 606, font, 3);
    var i;
    var top = 805;
    context.save();
    context.fillStyle = COLORS.cocoa;
    context.font = font;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    for (i = 0; i < lines.length; i += 1) context.fillText(lines[i], 58, top + i * 30);
    context.restore();
  }

  function poster(planSource) {
    var canvas;
    var context;
    var plan;
    var sceneX = 80;
    var sceneY = 166;
    var sceneSize = 560;
    var posterOptions;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      throw new Error('CakeArt.poster 需要 Canvas 环境');
    }
    canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 960;
    context = canvas.getContext('2d');
    plan = normalizePlan(planSource);
    fillCanvasBackground(context, canvas.width, canvas.height);
    drawPosterHeader(context, plan);
    context.save();
    roundedPath(context, 45, 151, 630, 615, 24);
    context.fillStyle = 'rgba(255, 255, 255, 0.38)';
    context.fill();
    context.strokeStyle = 'rgba(109, 68, 62, 0.13)';
    context.lineWidth = 1;
    context.stroke();
    context.restore();
    posterOptions = {
      showPieces: true,
      stepLabels: plan.cuts.length <= 10,
      focus: -1
    };
    withDesignScale(context, sceneX, sceneY, sceneSize, function () {
      drawScene(context, plan, posterOptions);
    });
    drawPosterFooter(context, plan);
    return canvas;
  }

  var api = { draw: draw, poster: poster };
  if (root) root.CakeArt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window :
  (typeof globalThis !== 'undefined' ? globalThis : this)));
