(function (root) {
  'use strict';

  var WIDTH = 720;
  var HEIGHT = 960;
  var PAPER_MARGIN = 30;
  var CONTENT_X = PAPER_MARGIN;
  var CONTENT_WIDTH = WIDTH - PAPER_MARGIN * 2;
  var CONTENT_RIGHT = WIDTH - PAPER_MARGIN;
  var PAPER = '#fbf3e5';
  var INK = '#292642';
  var MUTED = '#756b69';
  var SANS = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  var DISPLAY = 'Georgia, "Songti SC", "STSong", serif';

  var MOODS = {
    day: {
      label: '白天',
      top: '#fff1d3',
      bottom: '#f5c993',
      text: '#292642',
      softText: '#68514b',
      accent: '#ef956f',
      art: '#d27c63'
    },
    dawn: {
      label: '天刚亮',
      top: '#ffe2c1',
      bottom: '#ef9f9d',
      text: '#322545',
      softText: '#6d4d59',
      accent: '#ffd184',
      art: '#a35e72'
    },
    dusk: {
      label: '暮色',
      top: '#805568',
      bottom: '#514b73',
      text: '#fff3e3',
      softText: '#f7dbc8',
      accent: '#ffd18d',
      art: '#3d3a62'
    },
    night: {
      label: '深夜',
      top: '#3b3e6c',
      bottom: '#171a35',
      text: '#fff2de',
      softText: '#c8c4db',
      accent: '#e7d5a8',
      art: '#11152d'
    }
  };

  function text(value) {
    return value === null || typeof value === 'undefined' ? '' : String(value);
  }

  function lineText(value) {
    return text(value).replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function hasOption(options, key) {
    return Boolean(options && Object.prototype.hasOwnProperty.call(options, key));
  }

  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function safeMood(value) {
    var key = lineText(value).toLowerCase();
    return MOODS[key] ? key : 'day';
  }

  function readCodePoint(source, index) {
    var first = source.charCodeAt(index);
    var second = source.charCodeAt(index + 1);
    if (first >= 0xD800 && first <= 0xDBFF && second >= 0xDC00 && second <= 0xDFFF) {
      return {
        text: source.substr(index, 2),
        code: (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000,
        length: 2
      };
    }
    return { text: source.charAt(index), code: first, length: 1 };
  }

  function isMarkCode(code) {
    return (code >= 0x0300 && code <= 0x036F) ||
      (code >= 0x1AB0 && code <= 0x1AFF) ||
      (code >= 0x1DC0 && code <= 0x1DFF) ||
      (code >= 0x20D0 && code <= 0x20FF) ||
      (code >= 0xFE00 && code <= 0xFE0F) ||
      (code >= 0xFE20 && code <= 0xFE2F) ||
      (code >= 0x1F3FB && code <= 0x1F3FF) ||
      (code >= 0xE0100 && code <= 0xE01EF);
  }

  function save(context) {
    if (context && typeof context.save === 'function') context.save();
  }

  function restore(context) {
    if (context && typeof context.restore === 'function') context.restore();
  }

  function setAlpha(context, value) {
    if (context) context.globalAlpha = value;
  }

  function fillRect(context, x, y, width, height, color) {
    if (!context || typeof context.fillRect !== 'function') return;
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function roundedPath(context, x, y, width, height, radius) {
    var r = clamp(radius || 0, 0, Math.min(width, height) / 2);
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

  function fillRounded(context, x, y, width, height, radius, color) {
    if (!context) return;
    if (typeof context.beginPath !== 'function' || typeof context.quadraticCurveTo !== 'function') {
      fillRect(context, x, y, width, height, color);
      return;
    }
    roundedPath(context, x, y, width, height, radius);
    context.fillStyle = color;
    context.fill();
  }

  function strokeRounded(context, x, y, width, height, radius, color, lineWidth) {
    if (!context || typeof context.beginPath !== 'function' || typeof context.stroke !== 'function') return;
    roundedPath(context, x, y, width, height, radius);
    context.strokeStyle = color;
    context.lineWidth = lineWidth || 1;
    context.stroke();
  }

  function gradient(context, x, y, width, height, first, last) {
    if (context && typeof context.createLinearGradient === 'function') {
      var value = context.createLinearGradient(x, y, x, y + height);
      value.addColorStop(0, first);
      value.addColorStop(1, last);
      return value;
    }
    return first;
  }

  function measure(context, value, size, weight, family) {
    var content = lineText(value);
    if (context) {
      context.font = (weight || 400) + ' ' + size + 'px ' + (family || SANS);
      if (typeof context.measureText === 'function') {
        return context.measureText(content).width;
      }
    }
    return content.length * size * 0.56;
  }

  function codeUnits(value) {
    var source = text(value);
    var units = [];
    var i = 0;
    var current;
    var next;
    var unit;
    while (i < source.length) {
      current = readCodePoint(source, i);
      unit = current.text;
      i += current.length;
      if (current.code >= 0x1F1E6 && current.code <= 0x1F1FF && i < source.length) {
        next = readCodePoint(source, i);
        if (next.code >= 0x1F1E6 && next.code <= 0x1F1FF) {
          unit += next.text;
          i += next.length;
        }
      }
      while (i < source.length) {
        next = readCodePoint(source, i);
        if (next.code === 0x200D) {
          unit += next.text;
          i += next.length;
          if (i < source.length) {
            next = readCodePoint(source, i);
            unit += next.text;
            i += next.length;
          }
        } else if (isMarkCode(next.code)) {
          unit += next.text;
          i += next.length;
        } else {
          break;
        }
      }
      units.push(unit);
    }
    return units;
  }

  function ellipsize(context, value, width, size, weight, family) {
    var source = lineText(value);
    var mark = '…';
    var units;
    var output;
    var i;
    if (!source || measure(context, source, size, weight, family) <= width) return source;
    units = codeUnits(source);
    output = '';
    for (i = 0; i < units.length; i += 1) {
      if (measure(context, output + units[i] + mark, size, weight, family) > width) break;
      output += units[i];
    }
    return output ? output + mark : mark;
  }

  function fitSize(context, value, width, max, min, weight, family) {
    var size = max;
    var source = lineText(value);
    while (size > min && measure(context, source, size, weight, family) > width) size -= 1;
    return size;
  }

  function wrapped(context, value, width, size, weight, family, maxLines) {
    var source = text(value).replace(/\r/g, '');
    var paragraphs = source.split('\n');
    var lines = [];
    var paragraph;
    var units;
    var current;
    var i;
    var j;
    var candidate;
    var room;
    var lastLine;
    maxLines = Math.max(1, maxLines || 1);
    for (i = 0; i < paragraphs.length; i += 1) {
      paragraph = paragraphs[i];
      units = codeUnits(paragraph);
      current = '';
      if (!units.length) {
        if (lines.length < maxLines) lines.push('');
        continue;
      }
      for (j = 0; j < units.length; j += 1) {
        candidate = current + units[j];
        if (current && measure(context, candidate, size, weight, family) > width) {
          lines.push(current);
          current = units[j];
          if (lines.length >= maxLines) {
            lastLine = lines[maxLines - 1];
            room = Math.max(2, width - measure(context, '…', size, weight, family));
            lines[maxLines - 1] = ellipsize(context, lastLine, room, size, weight, family);
            return lines;
          }
        } else {
          current = candidate;
        }
      }
      if (current || !lines.length) lines.push(current);
      if (lines.length >= maxLines && i < paragraphs.length - 1) {
        lines[maxLines - 1] = ellipsize(context, lines[maxLines - 1],
          Math.max(2, width - measure(context, '…', size, weight, family)), size, weight, family);
        return lines;
      }
    }
    if (!lines.length) lines.push('');
    if (lines.length > maxLines) lines.length = maxLines;
    return lines;
  }

  function drawLines(context, lines, x, firstBaseline, lineHeight, color, align) {
    var i;
    if (!context || typeof context.fillText !== 'function') return;
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    for (i = 0; i < lines.length; i += 1) {
      context.fillText(lines[i], x, firstBaseline + lineHeight * i);
    }
  }

  function drawFit(context, value, x, baseline, width, maxSize, minSize, weight, color, align, family) {
    var size = fitSize(context, value, width, maxSize, minSize, weight, family);
    var content = ellipsize(context, value, width, size, weight, family);
    if (!context || typeof context.fillText !== 'function') return size;
    context.font = (weight || 400) + ' ' + size + 'px ' + (family || SANS);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(content, x, baseline);
    return size;
  }

  function drawPill(context, value, x, y, width, height, background, color, size) {
    var label = ellipsize(context, value, Math.max(8, width - 20), size || 16, 700, SANS);
    fillRounded(context, x, y, width, height, height / 2, background);
    if (!context || typeof context.fillText !== 'function') return;
    context.font = '700 ' + (size || 16) + 'px ' + SANS;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, x + width / 2, y + height / 2 + 1);
  }

  function drawCircle(context, x, y, radius, color) {
    if (!context || typeof context.beginPath !== 'function' || typeof context.arc !== 'function') return;
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();
  }

  function drawSun(context, x, y, radius, color, rayColor) {
    var i;
    var angle;
    var inner;
    var outer;
    drawCircle(context, x, y, radius, color);
    if (!context || typeof context.beginPath !== 'function' || typeof context.moveTo !== 'function') return;
    context.strokeStyle = rayColor || color;
    context.lineWidth = 2;
    for (i = 0; i < 8; i += 1) {
      angle = i * Math.PI / 4;
      inner = radius + 8;
      outer = radius + 15;
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      context.stroke();
    }
  }

  function drawMoon(context, x, y, radius, color, cutout) {
    drawCircle(context, x, y, radius, color);
    drawCircle(context, x + radius * 0.38, y - radius * 0.38, radius * 0.92, cutout);
  }

  function drawStars(context, x, y, width, height, color) {
    var points = [
      [0.10, 0.20, 2], [0.25, 0.38, 1.3], [0.40, 0.14, 1.5],
      [0.57, 0.30, 1.8], [0.77, 0.14, 1.2], [0.90, 0.40, 1.7],
      [0.68, 0.50, 1.0], [0.17, 0.54, 1.1]
    ];
    var i;
    for (i = 0; i < points.length; i += 1) {
      drawCircle(context, x + points[i][0] * width, y + points[i][1] * height, points[i][2], color);
    }
  }

  function drawSkyline(context, x, y, width, height, color) {
    var heights = [0.42, 0.63, 0.34, 0.54, 0.76, 0.46, 0.68, 0.36, 0.58, 0.49];
    var i;
    var buildingWidth = width / heights.length;
    var buildingHeight;
    var buildingX;
    if (!context) return;
    setAlpha(context, 0.40);
    for (i = 0; i < heights.length; i += 1) {
      buildingHeight = height * heights[i];
      buildingX = x + i * buildingWidth - 1;
      fillRect(context, buildingX, y + height - buildingHeight, buildingWidth + 2, buildingHeight, color);
      if (i % 2 === 1) {
        fillRect(context, buildingX + buildingWidth * 0.43, y + height - buildingHeight - 7,
          Math.max(2, buildingWidth * 0.15), 7, color);
      }
    }
    setAlpha(context, 0.22);
    if (typeof context.beginPath === 'function' && typeof context.moveTo === 'function') {
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x, y + height - 1);
      context.lineTo(x + width * 0.24, y + height - 5);
      context.lineTo(x + width * 0.48, y + height - 1);
      context.lineTo(x + width * 0.74, y + height - 6);
      context.lineTo(x + width, y + height - 1);
      context.stroke();
    }
    setAlpha(context, 1);
  }

  function drawPaper(context) {
    var i;
    var x;
    var y;
    if (!context) return;
    fillRect(context, 0, 0, WIDTH, HEIGHT, PAPER);
    setAlpha(context, 0.24);
    for (i = 0; i < 26; i += 1) {
      x = 22 + ((i * 97) % 676);
      y = 22 + ((i * 53) % 908);
      if (typeof context.beginPath === 'function' && typeof context.arc === 'function') {
        context.beginPath();
        context.arc(x, y, i % 3 === 0 ? 1.3 : 0.8, 0, 2 * Math.PI);
        context.fillStyle = i % 2 ? '#d7c5a9' : '#fffaf0';
        context.fill();
      }
    }
    setAlpha(context, 1);
  }

  function drawMoodArt(context, mood, x, y, width, height) {
    var info = MOODS[mood];
    var horizon = y + height * 0.73;
    var skyColor = info.art;
    save(context);
    if (context && typeof context.beginPath === 'function' && typeof context.clip === 'function') {
      roundedPath(context, x, y, width, height, 25);
      context.clip();
    }
    if (context) {
      context.fillStyle = gradient(context, x, y, width, height, info.top, info.bottom);
      if (typeof context.fillRect === 'function') context.fillRect(x, y, width, height);
    }
    if (mood === 'night') {
      drawStars(context, x + 18, y + 18, width - 36, height * 0.58, info.accent);
      drawMoon(context, x + width - 102, y + 77, 28, info.accent, info.top);
    } else {
      var sunY = mood === 'dawn' ? y + height * 0.62 : mood === 'dusk' ? y + height * 0.48 : y + height * 0.30;
      drawSun(context, x + width - 98, sunY, 28, info.accent, info.accent);
      if (mood === 'dusk') drawStars(context, x + 20, y + 14, width - 40, height * 0.48, '#fff0d1');
    }
    drawSkyline(context, x, horizon, width, height * 0.28, skyColor);
    restore(context);
  }

  function drawHeader(context, title, message, reference) {
    var heading = lineText(title);
    var subheading = lineText(message);
    var referenceText = lineText(reference);
    var messageLines;
    if (!heading) heading = '当前时刻';
    if (referenceText) {
      drawFit(context, referenceText, CONTENT_RIGHT, 29, 330, 16, 11, 600, MUTED, 'right', SANS);
    }
    drawFit(context, heading, CONTENT_X, 68, CONTENT_WIDTH, 38, 24, 700, INK, 'left', DISPLAY);
    if (subheading) {
      messageLines = wrapped(context, subheading, CONTENT_WIDTH, 20, 400, SANS, 2);
      drawLines(context, messageLines, CONTENT_X, 105, 25, MUTED, 'left');
    }
  }

  function drawFooter(context, options) {
    var stamp = lineText(options.stamp);
    var page = parseInt(options.page, 10);
    var total = parseInt(options.total, 10);
    var right;
    if (!isFinite(page) || page < 1) page = 1;
    if (!isFinite(total) || total < page) total = page;
    if (stamp) {
      drawFit(context, '生成 ' + stamp, CONTENT_X, 913, 430, 16, 11, 600, MUTED, 'left', SANS);
    } else {
      drawFit(context, '隔着时差', CONTENT_X, 913, 430, 16, 11, 600, MUTED, 'left', SANS);
    }
    if (total > 1) {
      right = '第 ' + page + ' / ' + total + ' 页';
      drawFit(context, right, CONTENT_RIGHT, 913, 180, 16, 11, 700, MUTED, 'right', SANS);
    }
  }

  function rowPerson(row) {
    var person = lineText(row && row.person);
    var city = lineText(row && row.city);
    return person || city || '远方';
  }

  function drawDifference(context, value, x, y, width, color, background, maxSize, minSize, alignRight) {
    var content = lineText(value);
    var size;
    var labelWidth;
    var labelX;
    var pillHeight;
    var label;
    if (!content || width <= 0) return;
    size = fitSize(context, content, Math.max(24, width - 28), maxSize || 24, minSize || 16, 700, SANS);
    label = ellipsize(context, content, Math.max(24, width - 28), size, 700, SANS);
    labelWidth = clamp(measure(context, label, size, 700, SANS) + 28, 104, width);
    pillHeight = size >= 20 ? 35 : 31;
    labelX = alignRight === false ? x : x + width - labelWidth;
    fillRounded(context, labelX, y, labelWidth, pillHeight, pillHeight / 2, background);
    if (!context || typeof context.fillText !== 'function') return;
    context.font = '700 ' + size + 'px ' + SANS;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, labelX + labelWidth / 2, y + pillHeight / 2 + 1);
  }

  function drawGreetingPanel(context, row, x, y, width, height, compact) {
    var city = lineText(row.city) || '远方';
    var person = rowPerson(row);
    var timeValue = lineText(row.time) || '—';
    var date = lineText(row.date);
    var offset = lineText(row.offset);
    var difference = lineText(row.difference);
    var note = lineText(row.note);
    var mood = safeMood(row.mood);
    var info = MOODS[mood];
    var timeSize = compact ? 72 : 108;
    var dateY = y + (compact ? 156 : 212);
    var offsetWidth;
    var titleWidth;
    var noteLines;
    save(context);
    drawMoodArt(context, mood, x, y, width, height);
    setAlpha(context, 0.16);
    fillRounded(context, x, y, width, height, 25, '#ffffff');
    setAlpha(context, 1);
    offsetWidth = offset ? clamp(measure(context, offset, 15, 700, SANS) + 28, 72, 154) : 0;
    titleWidth = width - 56 - (offset ? offsetWidth + 20 : 0);
    drawFit(context, person, x + 28, y + (compact ? 48 : 58), Math.max(120, titleWidth),
      compact ? 31 : 43, compact ? 16 : 22, 700, info.text, 'left', DISPLAY);
    drawFit(context, city, x + 30, y + (compact ? 74 : 88), width - 60,
      compact ? 19 : 23, compact ? 12 : 14, 600, info.softText, 'left', SANS);
    if (offset) {
      drawPill(context, offset, x + width - offsetWidth - 26, y + 20, offsetWidth, 31,
        info.text === '#fff3e3' || info.text === '#fff2de' ? 'rgba(20, 24, 48, .30)' : 'rgba(255, 255, 255, .45)',
        info.text, 15);
    }
    drawFit(context, timeValue, x + 28, y + (compact ? 150 : 210), width - 56,
      timeSize, compact ? 42 : 54, 700, info.text, 'left', SANS);
    if (date) {
      drawFit(context, date, x + 30, dateY + (compact ? 22 : 39), width - 60,
        compact ? 19 : 24, compact ? 12 : 14, 600, info.softText, 'left', SANS);
    }
    if (difference) {
      drawDifference(context, difference, x + 28, y + (compact ? 201 : 286), width - 56, INK,
        info.accent, compact ? 22 : 25, 16, false);
    }
    drawPill(context, info.label, x + 28, y + height - (compact ? 68 : 83), compact ? 70 : 82,
      compact ? 25 : 29, info.text === '#fff3e3' || info.text === '#fff2de' ? 'rgba(255, 255, 255, .15)' : 'rgba(255, 255, 255, .55)',
      info.text, compact ? 13 : 14);
    if (note) {
      noteLines = wrapped(context, note, width - (compact ? 124 : 142), compact ? 14 : 17, 500, SANS,
        compact ? 1 : 2);
      drawLines(context, noteLines, x + (compact ? 112 : 126), y + height - (compact ? 49 : 46),
        compact ? 17 : 19, info.text, 'left');
    }
    restore(context);
  }

  function drawGreeting(context, rows, options) {
    var count = Math.min(2, rows.length);
    var i;
    var x = CONTENT_X;
    var width = CONTENT_WIDTH;
    var y;
    var height;
    drawHeader(context, lineText(options.title) || '当前时刻',
      hasOption(options, 'message') ? options.message : '', options.reference);
    if (!count) {
      fillRounded(context, x, 188, width, 438, 25, '#f1e5d2');
      drawFit(context, '选一位想念的人', WIDTH / 2, 402, 500, 42, 24, 700, INK, 'center', DISPLAY);
      drawFit(context, '把远方的此刻留在一张卡里', WIDTH / 2, 446, 500, 20, 14, 500, MUTED, 'center', SANS);
    } else if (count === 1) {
      drawGreetingPanel(context, rows[0] || {}, x, 172, width, 548, false);
    } else {
      y = 158;
      height = 326;
      for (i = 0; i < count; i += 1) {
        drawGreetingPanel(context, rows[i] || {}, x, y + i * (height + 20), width, height, true);
      }
      if (context && typeof context.beginPath === 'function' && typeof context.moveTo === 'function') {
        setAlpha(context, 0.45);
        context.strokeStyle = '#b59d8b';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 36, 504);
        context.lineTo(x + width - 36, 504);
        context.stroke();
        setAlpha(context, 1);
      }
    }
    drawFooter(context, options);
  }

  function drawMeetingRow(context, row, x, y, width, height, index) {
    var mood = safeMood(row.mood);
    var info = MOODS[mood];
    var person = rowPerson(row);
    var city = lineText(row.city) || '远方';
    var timeValue = lineText(row.time) || '—';
    var date = lineText(row.date);
    var offset = lineText(row.offset);
    var difference = lineText(row.difference);
    var note = lineText(row.note);
    var leftWidth = clamp(width * 0.42, 240, 276);
    var rightX = x + leftWidth + 22;
    var rightWidth = width - leftWidth - 44;
    var spacious = height >= 175;
    var contentTop = y + (spacious ? (height - 154) / 2 : 0);
    var timeSize = fitSize(context, timeValue, leftWidth - 44, spacious ? 66 : 42, 28, 700, SANS);
    var noteLines;
    var offsetWidth = offset ? clamp(measure(context, offset, 14, 700, SANS) + 24, 68, 136) : 0;
    var stripe = info.accent;
    var background = index % 2 ? '#f2e4d1' : '#f6ead9';
    save(context);
    fillRounded(context, x, y, width, height, 20, background);
    fillRounded(context, x, y, 9, height, 5, stripe);
    drawFit(context, person, x + 27, contentTop + (spacious ? 40 : 33),
      leftWidth - 50, spacious ? 36 : 24, 14, 700, INK, 'left', DISPLAY);
    drawFit(context, city, x + 27, contentTop + (spacious ? 67 : 56),
      leftWidth - 50, spacious ? 19 : 16, 12, 600, MUTED, 'left', SANS);
    if (context && typeof context.fillText === 'function') {
      context.font = '700 ' + timeSize + 'px ' + SANS;
      context.fillStyle = INK;
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      context.fillText(ellipsize(context, timeValue, leftWidth - 44, timeSize, 700, SANS), x + 27,
        contentTop + (spacious ? 133 : 105));
    }
    if (offset) {
      drawPill(context, offset, rightX + rightWidth - offsetWidth, contentTop + 15, offsetWidth, 27, '#e9c4a3', INK, 14);
    }
    if (date) {
      drawFit(context, date, rightX, contentTop + 34,
        rightWidth - offsetWidth - 13, height > 130 ? 20 : 17, 12, 600, MUTED, 'left', SANS);
    }
    drawPill(context, info.label, rightX, contentTop + 44, clamp(measure(context, info.label, 13, 700, SANS) + 24, 57, 86), 25,
      '#ead9c5', INK, 13);
    if (note) {
      noteLines = wrapped(context, note, rightWidth - 2, height > 130 ? 17 : 15, 500, SANS,
        height > 140 ? 2 : 1);
      drawLines(context, noteLines, rightX, contentTop + (height > 140 ? 85 : 84), height > 140 ? 18 : 17, MUTED, 'left');
    }
    if (difference) {
      drawDifference(context, difference, rightX,
        contentTop + (spacious ? 111 : Math.max(88, height - 38)), rightWidth,
        INK, '#e9c4a3', spacious ? 24 : 22, 16);
    }
    restore(context);
  }

  function drawMeeting(context, rows, options) {
    var count = Math.min(5, rows.length);
    var top = 164;
    var bottom = 858;
    var gap = 12;
    var height;
    var i;
    drawHeader(context, lineText(options.title) || '约个时间',
      hasOption(options, 'message') ? options.message : '这个时间方便吗？', options.reference);
    if (!count) {
      fillRounded(context, CONTENT_X, 188, CONTENT_WIDTH, 400, 25, '#f1e5d2');
      drawFit(context, '还没有参加的人', WIDTH / 2, 388, 500, 36, 24, 700, INK, 'center', DISPLAY);
      drawFit(context, '选好时间后，再把大家放进同一张卡', WIDTH / 2, 432, 500, 20, 14, 500, MUTED, 'center', SANS);
    } else {
      height = (bottom - top - gap * (count - 1)) / count;
      for (i = 0; i < count; i += 1) {
        drawMeetingRow(context, rows[i] || {}, CONTENT_X, top + i * (height + gap), CONTENT_WIDTH, height, i);
      }
    }
    drawFooter(context, options);
  }

  function makeCanvas() {
    var documentObject = root && root.document;
    var canvas;
    var context;
    if (!documentObject || typeof documentObject.createElement !== 'function') return null;
    canvas = documentObject.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    context = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!context) return null;
    return { canvas: canvas, context: context };
  }

  function draw(template, rows, options) {
    var made = makeCanvas();
    var context;
    var list;
    var settings = options || {};
    if (!made) return null;
    context = made.context;
    list = Object.prototype.toString.call(rows) === '[object Array]' ? rows : [];
    drawPaper(context);
    if (template === 'meeting') drawMeeting(context, list, settings);
    else drawGreeting(context, list, settings);
    return made.canvas;
  }

  root.TimeCards = root.TimeCards || {};
  root.TimeCards.draw = draw;
}(typeof window !== 'undefined' ? window : this));
