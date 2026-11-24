(function (root, factory) {
  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CakeCuts = api;
  }
})(typeof window !== 'undefined'
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var EPSILON = 1e-9;
  var ROUND_BOUNDS = { x: 50, y: 50, width: 300, height: 300 };
  var SQUARE_BOUNDS = { x: 50, y: 50, width: 300, height: 300 };
  var RECTANGLE_BOUNDS = { x: 50, y: 100, width: 300, height: 200 };
  var HEART_BOUNDS = { x: 50, y: 57.5, width: 300, height: 285 };
  var HEART_SAMPLES = 720;

  var shapes = {
    round: { name: '圆形', min: 2, max: 16 },
    square: { name: '方形', min: 2, max: 16 },
    rectangle: { name: '长方形', min: 2, max: 16 },
    heart: { name: '心形', min: 2, max: 8 }
  };

  function rounded(value, digits) {
    var factor = Math.pow(10, digits == null ? 4 : digits);
    var result = Math.round(value * factor) / factor;
    return Math.abs(result) < EPSILON ? 0 : result;
  }

  function point(x, y) {
    return { x: rounded(x, 4), y: rounded(y, 4) };
  }

  function copyBounds(bounds) {
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
  }

  function copyPoint(p) {
    return point(p.x, p.y);
  }

  function copyOutline(outline) {
    if (outline.kind === 'circle') {
      return { kind: 'circle', cx: outline.cx, cy: outline.cy, r: outline.r };
    }
    if (outline.kind === 'rect') {
      return {
        kind: 'rect',
        x: outline.x,
        y: outline.y,
        width: outline.width,
        height: outline.height
      };
    }
    return {
      kind: 'polygon',
      points: outline.points.map(copyPoint)
    };
  }

  function copyCut(from, to, caption, percent) {
    var result = {
      from: copyPoint(from),
      to: copyPoint(to),
      caption: caption
    };
    if (percent != null) {
      result.percent = rounded(percent, 2);
    }
    return result;
  }

  function polygonSignedArea(points) {
    var sum = 0;
    var i;
    var next;

    for (i = 0; i < points.length; i += 1) {
      next = points[(i + 1) % points.length];
      sum += points[i].x * next.y - next.x * points[i].y;
    }
    return sum / 2;
  }

  function pushUnique(points, candidate) {
    var last;

    if (!candidate) {
      return;
    }
    last = points[points.length - 1];
    if (!last || Math.abs(last.x - candidate.x) > 1e-8 || Math.abs(last.y - candidate.y) > 1e-8) {
      points.push(candidate);
    }
  }

  function normalizePolygon(points) {
    var result = [];
    var i;

    for (i = 0; i < points.length; i += 1) {
      pushUnique(result, points[i]);
    }
    if (result.length > 1) {
      var first = result[0];
      var last = result[result.length - 1];
      if (Math.abs(first.x - last.x) <= 1e-8 && Math.abs(first.y - last.y) <= 1e-8) {
        result.pop();
      }
    }
    return result;
  }

  function verticalIntersection(a, b, x) {
    var dx = b.x - a.x;
    var ratio;

    if (Math.abs(dx) < EPSILON) {
      return point(x, (a.y + b.y) / 2);
    }
    ratio = (x - a.x) / dx;
    return point(x, a.y + ratio * (b.y - a.y));
  }

  function clipByVertical(points, x, keepLeft) {
    var result = [];
    var i;
    var a;
    var b;
    var aInside;
    var bInside;

    if (!points.length) {
      return result;
    }

    for (i = 0; i < points.length; i += 1) {
      a = points[i];
      b = points[(i + 1) % points.length];
      aInside = keepLeft ? a.x <= x + EPSILON : a.x >= x - EPSILON;
      bInside = keepLeft ? b.x <= x + EPSILON : b.x >= x - EPSILON;

      if (aInside && bInside) {
        pushUnique(result, copyPoint(b));
      } else if (aInside && !bInside) {
        pushUnique(result, verticalIntersection(a, b, x));
      } else if (!aInside && bInside) {
        pushUnique(result, verticalIntersection(a, b, x));
        pushUnique(result, copyPoint(b));
      }
    }

    return normalizePolygon(result);
  }

  function clipPolygonBetween(points, minX, maxX) {
    var clipped = points;

    if (minX !== -Infinity) {
      clipped = clipByVertical(clipped, minX, false);
    }
    if (maxX !== Infinity) {
      clipped = clipByVertical(clipped, maxX, true);
    }
    return clipped;
  }

  function polygonArea(points) {
    return Math.abs(polygonSignedArea(points));
  }

  function polygonCentroid(points) {
    var signedArea = polygonSignedArea(points);
    var cx = 0;
    var cy = 0;
    var i;
    var next;
    var cross;

    if (points.length === 0) {
      return null;
    }
    if (Math.abs(signedArea) < 1e-8) {
      for (i = 0; i < points.length; i += 1) {
        cx += points[i].x;
        cy += points[i].y;
      }
      return point(cx / points.length, cy / points.length);
    }

    for (i = 0; i < points.length; i += 1) {
      next = points[(i + 1) % points.length];
      cross = points[i].x * next.y - next.x * points[i].y;
      cx += (points[i].x + next.x) * cross;
      cy += (points[i].y + next.y) * cross;
    }
    return point(cx / (6 * signedArea), cy / (6 * signedArea));
  }

  function pointInPolygon(candidate, polygon) {
    var inside = false;
    var i;
    var j;
    var a;
    var b;
    var intersects;

    if (!candidate || polygon.length < 3) {
      return false;
    }

    for (i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      a = polygon[i];
      b = polygon[j];
      intersects = ((a.y > candidate.y) !== (b.y > candidate.y)) &&
        (candidate.x < (b.x - a.x) * (candidate.y - a.y) / (b.y - a.y) + a.x);
      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }

  function verticalIntersections(polygon, x) {
    var ys = [];
    var i;
    var a;
    var b;
    var dx;
    var ratio;
    var y;

    function addY(value) {
      var k;
      for (k = 0; k < ys.length; k += 1) {
        if (Math.abs(ys[k] - value) < 1e-7) {
          return;
        }
      }
      ys.push(value);
    }

    for (i = 0; i < polygon.length; i += 1) {
      a = polygon[i];
      b = polygon[(i + 1) % polygon.length];
      dx = b.x - a.x;
      if (Math.abs(dx) < EPSILON) {
        if (Math.abs(x - a.x) < 1e-7) {
          addY(a.y);
          addY(b.y);
        }
        continue;
      }
      ratio = (x - a.x) / dx;
      if (ratio >= -1e-8 && ratio <= 1 + 1e-8) {
        y = a.y + ratio * (b.y - a.y);
        addY(y);
      }
    }

    ys.sort(function (left, right) { return left - right; });
    return ys;
  }

  function verticalSpan(polygon, x) {
    var ys = verticalIntersections(polygon, x);
    var best = null;
    var i;
    var top;
    var bottom;
    var middle;
    var gap;

    for (i = 0; i < ys.length - 1; i += 1) {
      top = ys[i];
      bottom = ys[i + 1];
      gap = bottom - top;
      if (gap < 1e-7) {
        continue;
      }
      middle = { x: x, y: (top + bottom) / 2 };
      if (pointInPolygon(middle, polygon) && (!best || gap > best.bottom - best.top)) {
        best = { top: top, bottom: bottom };
      }
    }

    if (best) {
      return best;
    }
    if (ys.length >= 2) {
      return { top: ys[0], bottom: ys[ys.length - 1] };
    }
    return null;
  }

  function bestFactorPair(count) {
    var bestA = 1;
    var bestB = count;
    var a;
    var b;

    for (a = 2; a * a <= count; a += 1) {
      if (count % a !== 0) {
        continue;
      }
      b = count / a;
      if (b - a < bestB - bestA) {
        bestA = a;
        bestB = b;
      }
    }
    return bestA === 1 ? null : { a: bestA, b: bestB };
  }

  function planRound(count) {
    var cx = 200;
    var cy = 200;
    var radius = 150;
    var outline = { kind: 'circle', cx: cx, cy: cy, r: radius };
    var bounds = copyBounds(ROUND_BOUNDS);
    var cuts = [];
    var pieces = [];
    var baseAngle = -Math.PI / 2;
    var sectorAngle = Math.PI * 2 / count;
    var i;
    var angle;
    var from;
    var to;
    var midAngle;

    if (count % 2 === 0) {
      for (i = 0; i < count / 2; i += 1) {
        angle = baseAngle + i * sectorAngle;
        from = point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        to = point(cx - radius * Math.cos(angle), cy - radius * Math.sin(angle));
        cuts.push(copyCut(
          from,
          to,
          '第' + (i + 1) + '刀：沿直径从一侧边缘切到对侧，贯穿圆心。'
        ));
      }
    } else {
      for (i = 0; i < count; i += 1) {
        angle = baseAngle + i * sectorAngle;
        to = point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        cuts.push(copyCut(
          point(cx, cy),
          to,
          '第' + (i + 1) + '刀：从圆心向外沿第' + (i + 1) + '条半径直切到边缘。'
        ));
      }
    }

    for (i = 0; i < count; i += 1) {
      midAngle = baseAngle + (i + 0.5) * sectorAngle;
      pieces.push(point(
        cx + radius * 0.56 * Math.cos(midAngle),
        cy + radius * 0.56 * Math.sin(midAngle)
      ));
    }

    return {
      shape: 'round',
      count: count,
      outline: outline,
      bounds: bounds,
      cuts: cuts,
      pieces: pieces,
      hint: count % 2 === 0
        ? '每刀穿过圆心，从一侧直切到对侧。'
        : '从圆心向外逐刀切到圆边。可逐刀看顺序。'
    };
  }

  function planRectangular(shape, count, sourceBounds) {
    var bounds = copyBounds(sourceBounds);
    var outline = {
      kind: 'rect',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
    var factors = bestFactorPair(count);
    var grid = Boolean(factors);
    var cols;
    var rows;
    var cuts = [];
    var pieces = [];
    var i;
    var row;
    var col;
    var x;
    var y;
    var verticalFirst;
    var caption;

    if (grid) {
      if (bounds.width >= bounds.height) {
        cols = factors.b;
        rows = factors.a;
      } else {
        cols = factors.a;
        rows = factors.b;
      }

      for (i = 1; i < cols; i += 1) {
        x = bounds.x + bounds.width * i / cols;
        caption = '第' + (cuts.length + 1) + '刀：从上边直切到下边，完成网格第' + i + '条竖线。';
        cuts.push(copyCut(
          point(x, bounds.y),
          point(x, bounds.y + bounds.height),
          caption
        ));
      }
      for (i = 1; i < rows; i += 1) {
        y = bounds.y + bounds.height * i / rows;
        caption = '第' + (cuts.length + 1) + '刀：从左边直切到右边，完成网格第' + i + '条横线。';
        cuts.push(copyCut(
          point(bounds.x, y),
          point(bounds.x + bounds.width, y),
          caption
        ));
      }

      for (row = 0; row < rows; row += 1) {
        for (col = 0; col < cols; col += 1) {
          pieces.push(point(
            bounds.x + bounds.width * (col + 0.5) / cols,
            bounds.y + bounds.height * (row + 0.5) / rows
          ));
        }
      }
    } else {
      verticalFirst = bounds.width >= bounds.height;
      for (i = 1; i < count; i += 1) {
        if (verticalFirst) {
          x = bounds.x + bounds.width * i / count;
          caption = '第' + i + '刀：沿长边等距定位，从上边直切到下边。';
          cuts.push(copyCut(
            point(x, bounds.y),
            point(x, bounds.y + bounds.height),
            caption
          ));
        } else {
          y = bounds.y + bounds.height * i / count;
          caption = '第' + i + '刀：沿长边等距定位，从左边直切到右边。';
          cuts.push(copyCut(
            point(bounds.x, y),
            point(bounds.x + bounds.width, y),
            caption
          ));
        }
      }

      for (i = 0; i < count; i += 1) {
        if (verticalFirst) {
          pieces.push(point(
            bounds.x + bounds.width * (i + 0.5) / count,
            bounds.y + bounds.height / 2
          ));
        } else {
          pieces.push(point(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height * (i + 0.5) / count
          ));
        }
      }
    }

    if (grid && cols > 1 && rows > 1) {
      verticalFirst = '先按图从上边到下边完成竖直线，再从左边到右边完成水平线。';
    } else if (grid && cols > 1) {
      verticalFirst = '按图从上边到下边完成等距竖直线。';
    } else {
      verticalFirst = '沿长边等距标点，垂直于长边切到对边。';
    }

    return {
      shape: shape,
      count: count,
      outline: outline,
      bounds: bounds,
      cuts: cuts,
      pieces: pieces,
      hint: verticalFirst
    };
  }

  function createHeartPolygon() {
    var raw = [];
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;
    var i;
    var t;
    var x;
    var y;
    var normalizedX;
    var normalizedY;
    var points = [];

    for (i = 0; i < HEART_SAMPLES; i += 1) {
      t = Math.PI * 2 * i / HEART_SAMPLES;
      x = 16 * Math.pow(Math.sin(t), 3);
      y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      raw.push({ x: x, y: y });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    for (i = 0; i < raw.length; i += 1) {
      normalizedX = (raw[i].x - minX) / (maxX - minX);
      normalizedY = (maxY - raw[i].y) / (maxY - minY);
      points.push(point(
        HEART_BOUNDS.x + normalizedX * HEART_BOUNDS.width,
        HEART_BOUNDS.y + normalizedY * HEART_BOUNDS.height
      ));
    }
    return normalizePolygon(points);
  }

  function areaToLeft(polygon, x) {
    return polygonArea(clipPolygonBetween(polygon, -Infinity, x));
  }

  function heartPiecePoint(polygon, slab, minX, maxX) {
    var middleX = (minX + maxX) / 2;
    var span = verticalSpan(polygon, middleX);
    var candidate;
    var centroid;
    var minY = Infinity;
    var maxY = -Infinity;
    var i;
    var row;
    var col;
    var gridCandidate;

    if (span) {
      candidate = point(middleX, (span.top + span.bottom) / 2);
      if (pointInPolygon(candidate, slab)) {
        return candidate;
      }
    }

    centroid = polygonCentroid(slab);
    if (centroid && pointInPolygon(centroid, slab)) {
      return centroid;
    }

    for (i = 0; i < slab.length; i += 1) {
      minY = Math.min(minY, slab[i].y);
      maxY = Math.max(maxY, slab[i].y);
    }
    for (row = 1; row <= 9; row += 1) {
      for (col = 1; col <= 9; col += 1) {
        gridCandidate = point(
          minX + (maxX - minX) * col / 10,
          minY + (maxY - minY) * row / 10
        );
        if (pointInPolygon(gridCandidate, slab)) {
          return gridCandidate;
        }
      }
    }

    return centroid || candidate || point(middleX, (minY + maxY) / 2);
  }

  function planHeart(count) {
    var polygon = createHeartPolygon();
    var outline = { kind: 'polygon', points: polygon.map(copyPoint) };
    var bounds = copyBounds(HEART_BOUNDS);
    var totalArea = polygonArea(polygon);
    var minX = bounds.x;
    var maxX = bounds.x + bounds.width;
    var cuts = [];
    var pieces = [];
    var cutXs = [];
    var i;
    var target;
    var low;
    var high;
    var middle;
    var x;
    var span;
    var percent;
    var percentLabel;
    var left;
    var right;
    var slab;

    for (i = 1; i < count; i += 1) {
      target = totalArea * i / count;
      low = minX;
      high = maxX;
      for (var iteration = 0; iteration < 64; iteration += 1) {
        middle = (low + high) / 2;
        if (areaToLeft(polygon, middle) < target) {
          low = middle;
        } else {
          high = middle;
        }
      }
      x = rounded((low + high) / 2, 4);
      cutXs.push(x);
      span = verticalSpan(polygon, x);
      if (!span) {
        span = { top: bounds.y, bottom: bounds.y + bounds.height };
      }
      percent = (x - bounds.x) / bounds.width * 100;
      percentLabel = String(rounded(percent, 1));
      cuts.push(copyCut(
        point(x, span.top),
        point(x, span.bottom),
        '第' + i + '刀：在左起约' + percentLabel + '%处，从上缘直切到下缘。',
        percent
      ));
    }

    for (i = 0; i < count; i += 1) {
      left = i === 0 ? minX : cutXs[i - 1];
      right = i === count - 1 ? maxX : cutXs[i];
      slab = clipPolygonBetween(polygon, left, right);
      pieces.push(heartPiecePoint(polygon, slab, left, right));
    }

    return {
      shape: 'heart',
      count: count,
      outline: outline,
      bounds: bounds,
      cuts: cuts,
      pieces: pieces,
      hint: '按图中标注的左起百分比位置，从心形上缘直切到下缘，逐刀完成分切。'
    };
  }

  function validate(shape, count) {
    var spec;

    if (!Object.prototype.hasOwnProperty.call(shapes, shape)) {
      throw new RangeError('Unsupported cake shape: ' + shape);
    }
    spec = shapes[shape];
    if (!Number.isInteger(count) || count < spec.min || count > spec.max) {
      throw new RangeError(
        'Count for ' + shape + ' must be an integer from ' + spec.min + ' to ' + spec.max
      );
    }
  }

  function plan(shape, count) {
    validate(shape, count);
    if (shape === 'round') {
      return planRound(count);
    }
    if (shape === 'heart') {
      return planHeart(count);
    }
    if (shape === 'square') {
      return planRectangular(shape, count, SQUARE_BOUNDS);
    }
    return planRectangular(shape, count, RECTANGLE_BOUNDS);
  }

  return {
    shapes: shapes,
    plan: plan
  };
});
