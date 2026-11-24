(function (root) {
  'use strict';

  // The codes are deliberately only compact, checksummed data. They are useful
  // for passing a game between friends, but they are not signatures or proof.
  var VERSION = 1;
  var VARIABLE_VERSION = 2;
  var QUESTION_COUNT = 10;
  // Append new counts so earlier version 2 invitations keep their meaning.
  var QUESTION_COUNT_TAGS = [6, 7, 8, 9, 10, 5];
  var QUESTION_COUNTS = QUESTION_COUNT_TAGS.slice().sort(function (a, b) { return a - b; });
  var LEGACY_THEME_COUNT = 3;
  var CHALLENGE_PREFIX = 'Q';
  var CUSTOM_CHALLENGE_PREFIX = 'C.';
  var RECEIPT_PREFIX = 'R';
  // No 0, 1, I, L or O: this is a small, case-insensitive base-31 alphabet.
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var BASE = ALPHABET.length;
  // Challenge payload: version, theme, combination rank, answer bits, nonce.
  // Receipt payload: version, 32-bit challenge fingerprint, guesses, nonce.
  var CHALLENGE_PAYLOAD_LENGTH = 9;
  var RECEIPT_PAYLOAD_LENGTH = 10;
  var CUSTOM_CODE_MAX_LENGTH = 2300;
  var CUSTOM_TITLE_MAX_UNITS = 28;
  var CUSTOM_OPTION_MAX_UNITS = 12;
  var CUSTOM_THEME_SENTINEL = 255;
  var nonceCounter = 0;

  function question(id, title, first, second, firstIcon, secondIcon) {
    return {
      id: id,
      title: title,
      options: [first, second],
      icons: [firstIcon, secondIcon]
    };
  }

  var themes = [
    {
      id: 0,
      name: '好友日常',
      subtitle: '日常习惯和你们才记得的小细节',
      icon: '🫶',
      questions: [
        question(0, '奶茶临时只能选一个，我更像会点？', '去冰少糖', '正常冰三分糖', '🧊', '🧋'),
        question(1, '周末突然空出半天，我更可能？', '窝在家里回血', '马上约人出门', '🛋️', '🚶'),
        question(2, '排队半小时还没轮到，我会？', '再等等，想吃这口', '换一家，不耗了', '⏳', '🔁'),
        question(3, '看到特别好笑的东西，我会？', '立刻发给你', '先自己收藏', '📤', '🔖'),
        question(4, '生气时我更需要？', '先安静一会儿', '马上说清楚', '🌙', '💬'),
        question(5, '出门前最后一分钟，我常在找？', '耳机或充电线', '口红或纸巾', '🎧', '🧻'),
        question(6, '聚餐点菜更像我？', '先把招牌点了', '让大家慢慢挑', '⭐', '📋'),
        question(7, '熬夜后的第二天，我会？', '靠咖啡续命', '能补觉就补觉', '☕', '😴'),
        question(8, '突然下雨没带伞，我会？', '去便利店买伞', '等雨小一点再走', '☔', '🌧️'),
        question(9, '朋友送小礼物，我更在意？', '实不实用', '有没有小心思', '🧰', '💌'),
        question(10, '看剧看到关键处被剧透，我会？', '还是继续看完', '心情会卡很久', '📺', '😵'),
        question(11, '旅行收拾更像我？', '提前列好清单', '出发前凭感觉塞', '✅', '🧳'),
        question(12, '遇到尴尬冷场，我会？', '主动找话题', '假装研究手机', '🎤', '📱'),
        question(13, '冰箱只剩一道菜，我会？', '热一热直接吃', '叫外卖换口味', '🍱', '🛵'),
        question(14, '忙到忘记吃饭时，我会？', '先随便垫一口', '忙完再认真吃', '🥪', '🍜'),
        question(15, '收到消息没及时回，多半是？', '看到了想想再回', '真的忙到忘了', '💭', '🏃'),
        question(16, '拍照时我更常？', '拍很多张再挑', '一张自然就好', '📸', '🌿'),
        question(17, '计划被临时打乱，我会？', '重新安排一下', '顺其自然继续玩', '🗓️', '🎈')
      ]
    },
    {
      id: 1,
      name: '饭搭子',
      subtitle: '一起吃什么，往往比去哪儿更有默契',
      icon: '🍜',
      questions: [
        question(0, '菜单上有没吃过的菜，我会？', '点来试试看', '先点熟悉的', '🧪', '🍽️'),
        question(1, '两家店距离远一点，我会选？', '更好吃的那家', '走路近的那家', '😋', '👟'),
        question(2, '排队半小时还没轮到，我会？', '等到这一口', '马上换一家', '⏱️', '🚪'),
        question(3, '吃火锅调蘸料，我会？', '先按习惯调一碗', '边吃边现场试', '🥣', '🧂'),
        question(4, '甜品端上来只有一份，我会？', '先分好再开吃', '各挖一口再说', '🍰', '🥄'),
        question(5, '饭后还有一点时间，我会？', '找地方散散步', '坐着聊天消化', '🌳', '💬'),
        question(6, '约饭临时提前半小时，我会？', '可以，马上出门', '等等，我要收拾', '🏃', '🪞'),
        question(7, '辣度只能选一个，我会？', '挑战更辣一点', '稳妥选微辣', '🌶️', '🌱'),
        question(8, '吃饭时手机更常放在？', '桌上随时看', '包里专心吃', '📲', '👜'),
        question(9, '饮料喝到一半，我会？', '换一杯新口味', '就把这一杯喝完', '🥤', '✅'),
        question(10, '遇到好吃的新店，我会？', '马上记下来再来', '先推荐给你', '📝', '📣'),
        question(11, '菜没吃完，我会？', '打包明天继续', '今天尽量清空', '🥡', '🍚'),
        question(12, '旅行住店的早餐，我会？', '早起去吃自助', '多睡一会儿再说', '🍳', '🛏️'),
        question(13, '咖啡店里我更想坐？', '靠窗看街景', '角落安静一点', '🪟', '📖'),
        question(14, '吃到特别好吃的菜，我会？', '下次还点同一道', '挨个试别的菜', '🔂', '🧭'),
        question(15, '外卖选地址时，我会？', '看谁送得更快', '看哪家评价更好', '⚡', '👍'),
        question(16, '饭搭子迟到了，我会？', '先点小吃等他', '到店再一起点', '🍢', '🤝'),
        question(17, '餐厅正在放喜欢的歌，我会？', '默默听完整首', '边听边聊起来', '🎵', '🗣️')
      ]
    },
    {
      id: 2,
      name: '异地朋友',
      subtitle: '隔着城市，也能猜中对方的小习惯',
      icon: '🌍',
      questions: [
        question(0, '看到好笑的内容，我会？', '立刻转给你', '先存着晚点发', '📨', '🗂️'),
        question(1, '想联系你却发现已经很晚，我会？', '先留一句晚安', '明天再完整聊', '🌙', '☀️'),
        question(2, '看到你所在的城市下雨，我会？', '提醒你带伞', '等你自己说起', '☔', '💭'),
        question(3, '视频通话突然有空，我会？', '直接打过来', '先发消息问问', '📞', '💬'),
        question(4, '快到朋友纪念日，我会？', '提前准备小惊喜', '当天发句祝福', '🎁', '🎉'),
        question(5, '分享近况时，我更像会？', '发一张照片', '写一大段文字', '🖼️', '✍️'),
        question(6, '聊天突然断掉，我会？', '过一会儿再接着聊', '马上问是不是忙了', '⏲️', '❓'),
        question(7, '想寄东西给你，我会选？', '寄一箱本地小吃', '寄一张手写卡片', '📦', '💌'),
        question(8, '约下次见面的时间，我会？', '先把日期定下来', '等双方都有空再定', '📅', '🌤️'),
        question(9, '你说最近有点累，我会？', '先陪你聊一会儿', '提醒你早点休息', '🫂', '🛌'),
        question(10, '翻到我们以前的照片，我会？', '马上发给你回忆', '自己看着笑一会儿', '📷', '😊'),
        question(11, '一起计划异地旅行，我会？', '先看交通路线', '先收藏想去的地方', '🚄', '📍'),
        question(12, '视频背景里突然出现一只猫，我会？', '立刻问它叫什么', '先看你在做什么', '🐈', '👀'),
        question(13, '收到一条很长的消息，我会？', '认真写长回复', '先回重点再慢慢聊', '📝', '💡'),
        question(14, '有点想念朋友时，我会？', '直接说我想你了', '发个日常当作开场', '💗', '🍜'),
        question(15, '发现彼此都喜欢一部剧，我会？', '约好一起追', '先自己一口气看完', '🍿', '▶️'),
        question(16, '两地刚好有一点时差，我会？', '迁就对方时间', '按各自方便来聊', '🕰️', '🔄'),
        question(17, '很久没打电话了，我会？', '突然拨过去聊聊', '先约好再打', '📱', '🗓️')
      ]
    }
  ];

  if (Array.isArray(root.FriendExtraPacks)) themes = themes.concat(root.FriendExtraPacks);

  function isInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  }

  function themeFor(themeId) {
    if (!isInteger(themeId) || themeId < 0 || themeId >= themes.length) return null;
    return themes[themeId];
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function copyNumbers(values) {
    return values.slice();
  }

  function copyQuestion(item) {
    var copied = {
      title: item.title,
      options: item.options.slice(),
      icons: item.icons.slice()
    };
    if (item.id !== undefined) copied.id = item.id;
    return copied;
  }

  function globalConstructor(name) {
    if (root && typeof root[name] === 'function') return root[name];
    if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name];
    return null;
  }

  function hasUnsafeTextCodeUnit(value) {
    var i;
    var code;
    for (i = 0; i < value.length; i += 1) {
      code = value.charCodeAt(i);
      // C0/C1 controls, line separators, and directionality controls make a
      // code hard to read or allow visually misleading canonical forms.
      if (code <= 0x001F || (code >= 0x007F && code <= 0x009F) ||
          code === 0x2028 || code === 0x2029 || code === 0x200B || code === 0x200E ||
          code === 0x200F || code === 0x2060 || code === 0xFEFF ||
          (code >= 0x202A && code <= 0x202E) || (code >= 0x2066 && code <= 0x2069)) return true;
      // TextEncoder replaces unpaired surrogates. Reject them before encoding
      // so a decoded payload can always be compared byte-for-byte.
      if (code >= 0xD800 && code <= 0xDBFF) {
        if (i + 1 >= value.length) return true;
        code = value.charCodeAt(i + 1);
        if (code < 0xDC00 || code > 0xDFFF) return true;
        i += 1;
      } else if (code >= 0xDC00 && code <= 0xDFFF) {
        return true;
      }
    }
    return false;
  }

  function sameBytes(first, second) {
    var i;
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
    for (i = 0; i < first.length; i += 1) if (first[i] !== second[i]) return false;
    return true;
  }

  function utf8Encode(value) {
    var Encoder = globalConstructor('TextEncoder');
    var encoded;
    var bytes = [];
    var i;
    var code;
    var next;
    var point;
    if (typeof value !== 'string' || hasUnsafeTextCodeUnit(value)) return null;
    if (Encoder) {
      try {
        encoded = new Encoder().encode(value);
        for (i = 0; i < encoded.length; i += 1) bytes.push(encoded[i] & 255);
        return bytes;
      } catch (error) {
        // Fall through to the small ES2017 encoder below.
      }
    }
    for (i = 0; i < value.length; i += 1) {
      code = value.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) {
        next = value.charCodeAt(i + 1);
        point = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00);
        i += 1;
      } else {
        point = code;
      }
      if (point <= 0x7F) bytes.push(point);
      else if (point <= 0x7FF) bytes.push(0xC0 | (point >> 6), 0x80 | (point & 0x3F));
      else if (point <= 0xFFFF) bytes.push(0xE0 | (point >> 12), 0x80 | ((point >> 6) & 0x3F), 0x80 | (point & 0x3F));
      else bytes.push(0xF0 | (point >> 18), 0x80 | ((point >> 12) & 0x3F),
        0x80 | ((point >> 6) & 0x3F), 0x80 | (point & 0x3F));
    }
    return bytes;
  }

  function utf8Decode(bytes) {
    var Decoder = globalConstructor('TextDecoder');
    var typed;
    var decoded;
    var result = '';
    var i = 0;
    var first;
    var second;
    var third;
    var fourth;
    var point;
    if (!Array.isArray(bytes)) return null;
    if (Decoder) {
      try {
        typed = typeof Uint8Array === 'function' ? new Uint8Array(bytes) : bytes;
        decoded = new Decoder('utf-8', { fatal: true }).decode(typed);
        if (sameBytes(utf8Encode(decoded), bytes)) return decoded;
      } catch (error) {
        // Fall through to strict decoding for older TextDecoder versions.
      }
    }
    while (i < bytes.length) {
      first = bytes[i] & 255;
      if (first <= 0x7F) {
        result += String.fromCharCode(first);
        i += 1;
      } else if (first >= 0xC2 && first <= 0xDF) {
        if (i + 1 >= bytes.length) return null;
        second = bytes[i + 1] & 255;
        if (second < 0x80 || second > 0xBF) return null;
        point = ((first & 0x1F) << 6) | (second & 0x3F);
        result += String.fromCharCode(point);
        i += 2;
      } else if (first >= 0xE0 && first <= 0xEF) {
        if (i + 2 >= bytes.length) return null;
        second = bytes[i + 1] & 255;
        third = bytes[i + 2] & 255;
        if (second < 0x80 || second > 0xBF || third < 0x80 || third > 0xBF ||
            (first === 0xE0 && second < 0xA0) || (first === 0xED && second >= 0xA0)) return null;
        point = ((first & 0x0F) << 12) | ((second & 0x3F) << 6) | (third & 0x3F);
        result += String.fromCharCode(point);
        i += 3;
      } else if (first >= 0xF0 && first <= 0xF4) {
        if (i + 3 >= bytes.length) return null;
        second = bytes[i + 1] & 255;
        third = bytes[i + 2] & 255;
        fourth = bytes[i + 3] & 255;
        if (second < 0x80 || second > 0xBF || third < 0x80 || third > 0xBF ||
            fourth < 0x80 || fourth > 0xBF || (first === 0xF0 && second < 0x90) ||
            (first === 0xF4 && second > 0x8F)) return null;
        point = ((first & 0x07) << 18) | ((second & 0x3F) << 12) |
          ((third & 0x3F) << 6) | (fourth & 0x3F);
        point -= 0x10000;
        result += String.fromCharCode(0xD800 | (point >> 10), 0xDC00 | (point & 0x3FF));
        i += 4;
      } else {
        return null;
      }
    }
    return sameBytes(utf8Encode(result), bytes) ? result : null;
  }

  function normalizeCustomQuestion(input) {
    var title;
    var first;
    var second;
    if (!input || typeof input !== 'object' || typeof input.title !== 'string' ||
        !Array.isArray(input.options) || input.options.length !== 2 ||
        typeof input.options[0] !== 'string' || typeof input.options[1] !== 'string') return null;
    title = input.title.trim();
    first = input.options[0].trim();
    second = input.options[1].trim();
    if (!title || !first || !second || first === second || hasUnsafeTextCodeUnit(title) ||
        hasUnsafeTextCodeUnit(first) || hasUnsafeTextCodeUnit(second) ||
        title.length > CUSTOM_TITLE_MAX_UNITS || first.length > CUSTOM_OPTION_MAX_UNITS ||
        second.length > CUSTOM_OPTION_MAX_UNITS) return null;
    if (!utf8Encode(title) || !utf8Encode(first) || !utf8Encode(second)) return null;
    return { title: title, options: [first, second], icons: ['', ''] };
  }

  function validQuestionIds(theme, questionIds) {
    var seen = {};
    var i;
    var id;
    if (!Array.isArray(questionIds) || QUESTION_COUNTS.indexOf(questionIds.length) < 0) return false;
    for (i = 0; i < questionIds.length; i += 1) {
      id = questionIds[i];
      if (!isInteger(id) || id < 0 || id >= theme.questions.length || seen[id]) return false;
      seen[id] = true;
    }
    return true;
  }

  function validAnswers(answers, count) {
    var i;
    if (!Array.isArray(answers) || answers.length !== count) return false;
    for (i = 0; i < answers.length; i += 1) {
      if (!isInteger(answers[i]) || (answers[i] !== 0 && answers[i] !== 1)) return false;
    }
    return true;
  }

  function choose(n, k) {
    var result = 1;
    var i;
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    for (i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
    return result;
  }

  function normalizeSelection(theme, questionIds, answers) {
    var pairs = [];
    var normalizedIds = [];
    var normalizedAnswers = [];
    var i;
    if (!validQuestionIds(theme, questionIds) || !validAnswers(answers, questionIds.length)) return null;
    for (i = 0; i < questionIds.length; i += 1) {
      pairs.push({ id: questionIds[i], answer: answers[i] });
    }
    // The combination rank is canonical. Keep each answer attached to its
    // question while sorting, so a caller may provide selected questions in
    // any order without changing what the owner meant.
    pairs.sort(function (first, second) { return first.id - second.id; });
    for (i = 0; i < pairs.length; i += 1) {
      normalizedIds.push(pairs[i].id);
      normalizedAnswers.push(pairs[i].answer);
    }
    return { questionIds: normalizedIds, answers: normalizedAnswers };
  }

  function combinationRank(questionIds, total) {
    var rank = 0;
    var start = 0;
    var count = questionIds.length;
    var i;
    var candidate;
    for (i = 0; i < count; i += 1) {
      for (candidate = start; candidate < questionIds[i]; candidate += 1) {
        rank += choose(total - candidate - 1, count - i - 1);
      }
      start = questionIds[i] + 1;
    }
    return rank;
  }

  function combinationFromRank(rank, total, size) {
    var questionIds = [];
    var start = 0;
    var i;
    var candidate;
    var count;
    if (!isInteger(rank) || rank < 0 || rank >= choose(total, size)) return null;
    for (i = 0; i < size; i += 1) {
      for (candidate = start; candidate < total; candidate += 1) {
        count = choose(total - candidate - 1, size - i - 1);
        if (rank < count) {
          questionIds.push(candidate);
          start = candidate + 1;
          break;
        }
        rank -= count;
      }
    }
    return questionIds.length === size ? questionIds : null;
  }

  function answerBytes(answers) {
    var first = 0;
    var second = 0;
    var i;
    for (i = 0; i < Math.min(8, answers.length); i += 1) first |= answers[i] << (7 - i);
    for (i = 8; i < answers.length; i += 1) second |= answers[i] << (15 - i);
    return [first, second];
  }

  function readAnswerBytes(first, second, size) {
    var answers = [];
    var i;
    for (i = 0; i < Math.min(8, size); i += 1) answers.push((first >> (7 - i)) & 1);
    for (i = 8; i < size; i += 1) answers.push((second >> (15 - i)) & 1);
    return answers;
  }

  function randomBytes(length) {
    var bytes = [];
    var counter = (nonceCounter + 1) >>> 0;
    var source = root && root.crypto;
    var typed;
    var i;
    var random;
    nonceCounter = counter;

    if (source && typeof source.getRandomValues === 'function') {
      try {
        typed = typeof Uint8Array === 'function' ? new Uint8Array(length) : new Array(length);
        source.getRandomValues(typed);
        for (i = 0; i < length; i += 1) bytes.push(typed[i] & 255);
      } catch (error) {
        bytes = [];
      }
    }
    for (i = bytes.length; i < length; i += 1) {
      random = Math.floor(Math.random() * 256) & 255;
      random = (random + counter + i + (Date.now() & 255)) & 255;
      bytes.push(random);
    }
    // Keep a monotonic component as well as entropy, so test shims returning
    // zeroes and unusually unlucky random draws still produce distinct codes.
    for (i = 0; i < length; i += 1) {
      bytes[i] ^= (counter >>> ((length - i - 1) * 8)) & 255;
    }
    return bytes;
  }

  function crc16(bytes) {
    var crc = 0x1D0F;
    var i;
    var bit;
    for (i = 0; i < bytes.length; i += 1) {
      crc ^= bytes[i] << 8;
      for (bit = 0; bit < 8; bit += 1) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc;
  }

  function withChecksum(payload) {
    var checksum = crc16(payload);
    return payload.concat([(checksum >>> 8) & 255, checksum & 255]);
  }

  // Convert bytes to base-31 without using BigInt. Digits are kept little
  // endian internally, so this remains safe in old JavaScript engines.
  function encodeBase(bytes) {
    var digits = [0];
    var i;
    var j;
    var carry;
    var value;
    var result = '';
    for (i = 0; i < bytes.length; i += 1) {
      carry = bytes[i];
      for (j = 0; j < digits.length; j += 1) {
        value = digits[j] * 256 + carry;
        digits[j] = value % BASE;
        carry = Math.floor(value / BASE);
      }
      while (carry > 0) {
        digits.push(carry % BASE);
        carry = Math.floor(carry / BASE);
      }
    }
    for (i = digits.length - 1; i >= 0; i -= 1) result += ALPHABET.charAt(digits[i]);
    return result;
  }

  function decodeBase(value) {
    var bytes = [0];
    var i;
    var j;
    var carry;
    var digit;
    var number;
    var index;
    for (i = 0; i < value.length; i += 1) {
      index = ALPHABET.indexOf(value.charAt(i));
      if (index < 0) return null;
      carry = index;
      for (j = 0; j < bytes.length; j += 1) {
        number = bytes[j] * BASE + carry;
        bytes[j] = number & 255;
        carry = Math.floor(number / 256);
      }
      while (carry > 0) {
        bytes.push(carry & 255);
        carry = Math.floor(carry / 256);
      }
    }
    bytes.reverse();
    return bytes;
  }

  var BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function encodeBase64Url(bytes) {
    var result = '';
    var i;
    var first;
    var second;
    var third;
    var remaining;
    if (!Array.isArray(bytes)) return '';
    for (i = 0; i < bytes.length; i += 3) {
      first = bytes[i] & 255;
      remaining = bytes.length - i;
      second = remaining > 1 ? bytes[i + 1] & 255 : 0;
      third = remaining > 2 ? bytes[i + 2] & 255 : 0;
      result += BASE64URL.charAt(first >> 2);
      result += BASE64URL.charAt(((first & 3) << 4) | (second >> 4));
      if (remaining > 1) result += BASE64URL.charAt(((second & 15) << 2) | (third >> 6));
      if (remaining > 2) result += BASE64URL.charAt(third & 63);
    }
    return result;
  }

  function decodeBase64Url(value) {
    var bytes = [];
    var i;
    var first;
    var second;
    var third;
    var fourth;
    var remaining;
    if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
    for (i = 0; i < value.length; i += 4) {
      remaining = value.length - i;
      first = BASE64URL.indexOf(value.charAt(i));
      second = BASE64URL.indexOf(value.charAt(i + 1));
      third = remaining > 2 ? BASE64URL.indexOf(value.charAt(i + 2)) : 0;
      fourth = remaining > 3 ? BASE64URL.indexOf(value.charAt(i + 3)) : 0;
      if (first < 0 || second < 0 || (remaining > 2 && third < 0) || (remaining > 3 && fourth < 0)) return null;
      bytes.push((first << 2) | (second >> 4));
      if (remaining > 2) bytes.push(((second & 15) << 4) | (third >> 2));
      if (remaining > 3) bytes.push(((third & 3) << 6) | fourth);
    }
    if (encodeBase64Url(bytes) !== value) return null;
    return bytes;
  }

  function normalizeCode(value) {
    var code;
    if (typeof value !== 'string') return null;
    code = value.replace(/[\s-]+/g, '').toUpperCase();
    if (!/^[QR][A-HJKMNPQRSTUVWXYZ23456789]+$/.test(code)) return null;
    return code;
  }

  function encodeCode(prefix, payload) {
    return prefix + encodeBase(withChecksum(payload));
  }

  function decodeCode(value, prefix, payloadLength) {
    var code = normalizeCode(value);
    var bytes;
    var payload;
    var expected;
    var actual;
    if (!code || code.charAt(0) !== prefix) return null;
    bytes = decodeBase(code.slice(1));
    if (!bytes || bytes.length !== payloadLength + 2 || encodeBase(bytes) !== code.slice(1)) return null;
    payload = bytes.slice(0, payloadLength);
    expected = (bytes[payloadLength] << 8) | bytes[payloadLength + 1];
    actual = crc16(payload);
    if (expected !== actual) return null;
    return { code: code, bytes: payload };
  }

  function isCustomCode(value) {
    return typeof value === 'string' && value.slice(0, CUSTOM_CHALLENGE_PREFIX.length) === CUSTOM_CHALLENGE_PREFIX;
  }

  function questionForId(theme, id) {
    var i;
    if (!theme) return null;
    for (i = 0; i < theme.questions.length; i += 1) {
      if (theme.questions[i].id === id) return theme.questions[i];
    }
    return null;
  }

  // Invitations made before custom authoring was paused can still be played.
  function decodeCustomCode(value, includeBytes) {
    var match;
    var allBytes;
    var payload;
    var expected;
    var actual;
    var cursor = 0;
    var themeMarker;
    var theme;
    var questionCount;
    var questions = [];
    var questionIds = [];
    var seen = {};
    var customCount = 0;
    var marker;
    var id;
    var length;
    var fieldBytes;
    var title;
    var first;
    var second;
    var normalized;
    var answers;
    var nonce;
    var i;

    if (typeof value !== 'string' || value.length > CUSTOM_CODE_MAX_LENGTH) return null;
    match = /^C\.([0-9]+)\.([A-Za-z0-9_-]+)$/.exec(value);
    if (!match || match[1] !== String(VERSION)) return null;
    allBytes = decodeBase64Url(match[2]);
    if (!allBytes || allBytes.length < 2) return null;
    payload = allBytes.slice(0, allBytes.length - 2);
    expected = ((allBytes[allBytes.length - 2] & 255) << 8) | (allBytes[allBytes.length - 1] & 255);
    actual = crc16(payload);
    if (expected !== actual) return null;
    if (payload.length < 3 + 2 + 3 || payload[0] !== VERSION) return null;

    themeMarker = payload[cursor + 1];
    if (themeMarker === CUSTOM_THEME_SENTINEL) {
      theme = null;
    } else {
      theme = themeFor(themeMarker);
      if (!theme) return null;
    }
    questionCount = payload[cursor + 2];
    cursor += 3;
    if (questionCount !== QUESTION_COUNT) return null;

    for (i = 0; i < questionCount; i += 1) {
      if (cursor >= payload.length) return null;
      marker = payload[cursor++];
      if (marker === 0) {
        if (!theme || cursor >= payload.length) return null;
        id = payload[cursor++];
        if (seen[id]) return null;
        if (!questionForId(theme, id)) return null;
        seen[id] = true;
        questionIds.push(id);
        questions.push(copyQuestion(questionForId(theme, id)));
      } else if (marker === 1) {
        customCount += 1;
        if (cursor >= payload.length) return null;
        length = payload[cursor++];
        if (!length || cursor + length > payload.length) return null;
        fieldBytes = payload.slice(cursor, cursor + length);
        cursor += length;
        title = utf8Decode(fieldBytes);
        if (title === null) return null;
        if (cursor >= payload.length) return null;
        length = payload[cursor++];
        if (!length || cursor + length > payload.length) return null;
        fieldBytes = payload.slice(cursor, cursor + length);
        cursor += length;
        first = utf8Decode(fieldBytes);
        if (first === null) return null;
        if (cursor >= payload.length) return null;
        length = payload[cursor++];
        if (!length || cursor + length > payload.length) return null;
        fieldBytes = payload.slice(cursor, cursor + length);
        cursor += length;
        second = utf8Decode(fieldBytes);
        if (second === null) return null;
        normalized = normalizeCustomQuestion({ title: title, options: [first, second] });
        if (!normalized || normalized.title !== title || normalized.options[0] !== first || normalized.options[1] !== second) return null;
        questionIds.push(null);
        questions.push(normalized);
      } else {
        return null;
      }
    }
    if (!customCount || cursor + 5 !== payload.length) return null;
    answers = readAnswerBytes(payload[cursor], payload[cursor + 1], QUESTION_COUNT);
    if (payload[cursor + 1] & 0x3F) return null;
    nonce = payload.slice(cursor + 2, cursor + 5);
    if (nonce.length !== 3) return null;
    var result = {
      code: value,
      themeId: themeMarker === CUSTOM_THEME_SENTINEL ? null : themeMarker,
      questionIds: questionIds,
      questions: questions,
      answers: answers
    };
    if (includeBytes) result.bytes = payload;
    return result;
  }

  function fingerprint32(bytes) {
    var hash = 2166136261 >>> 0;
    var i;
    for (i = 0; i < bytes.length; i += 1) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function challengePayload(themeId, rank, answers, nonce) {
    var packed = answerBytes(answers);
    var version = themeId < LEGACY_THEME_COUNT && answers.length === QUESTION_COUNT ? VERSION : VARIABLE_VERSION;
    // Version 2 uses three unused bits to store the count without lengthening the code.
    if (version === VARIABLE_VERSION) packed[1] |= QUESTION_COUNT_TAGS.indexOf(answers.length) << 3;
    return [version, themeId, (rank >>> 8) & 255, rank & 255].concat(packed, nonce);
  }

  function decodeChallenge(value) {
    var decoded = decodeCode(value, CHALLENGE_PREFIX, CHALLENGE_PAYLOAD_LENGTH);
    var bytes;
    var theme;
    var rank;
    var questionIds;
    var answers;
    var size;
    var countBits;
    var packed;
    if (!decoded) return null;
    bytes = decoded.bytes;
    if (bytes[0] === VERSION && bytes[1] < LEGACY_THEME_COUNT) {
      size = QUESTION_COUNT;
      countBits = 0;
    } else if (bytes[0] === VARIABLE_VERSION) {
      countBits = bytes[5] & 0x38;
      size = QUESTION_COUNT_TAGS[countBits >> 3];
      if (size === undefined) return null;
    } else {
      return null;
    }
    theme = themeFor(bytes[1]);
    if (!theme) return null;
    rank = (bytes[2] << 8) | bytes[3];
    questionIds = combinationFromRank(rank, theme.questions.length, size);
    if (!questionIds) return null;
    answers = readAnswerBytes(bytes[4], bytes[5], size);
    packed = answerBytes(answers);
    if (bytes[4] !== packed[0] || bytes[5] !== (packed[1] | countBits)) return null;
    return {
      code: decoded.code,
      themeId: bytes[1],
      questionIds: questionIds,
      answers: answers
    };
  }

  function sameNumbers(first, second) {
    var i;
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
    for (i = 0; i < first.length; i += 1) if (first[i] !== second[i]) return false;
    return true;
  }

  function challengeFromObject(challenge) {
    var parsed;
    if (!challenge || typeof challenge !== 'object') return null;
    parsed = isCustomCode(challenge.code) ? decodeCustomCode(challenge.code, true) : decodeChallenge(challenge.code);
    if (!parsed || challenge.themeId !== parsed.themeId || !sameNumbers(challenge.answers, parsed.answers)) return null;
    if (Array.isArray(challenge.questionIds)) {
      if (!sameNumbers(challenge.questionIds, parsed.questionIds)) return null;
    } else if (!isCustomCode(challenge.code)) {
      return null;
    }
    return parsed;
  }

  function defaultIds(themeId, count) {
    var theme = themeFor(themeId);
    var ids = [];
    var i;
    var size = count === undefined ? QUESTION_COUNT : count;
    if (!theme || QUESTION_COUNTS.indexOf(size) < 0) return ids;
    for (i = 0; i < size; i += 1) ids.push(theme.questions[i].id);
    return ids;
  }

  function makeChallenge(themeId, questionIds, answers) {
    var theme = themeFor(themeId);
    var normalized;
    var rank;
    var nonce;
    var payload;
    var code;
    normalized = theme && normalizeSelection(theme, questionIds, answers);
    if (!normalized) throw new Error('题单需要 5–10 道不同的题，每题都有一个答案');
    rank = combinationRank(normalized.questionIds, theme.questions.length);
    if (rank > 0xFFFF) throw new Error('这个题包超出短码可表示的范围');
    nonce = randomBytes(3);
    payload = challengePayload(themeId, rank, normalized.answers, nonce);
    code = encodeCode(CHALLENGE_PREFIX, payload);
    return {
      code: code,
      themeId: themeId,
      questionIds: copyNumbers(normalized.questionIds),
      answers: copyNumbers(normalized.answers)
    };
  }

  function readChallenge(code) {
    return isCustomCode(code) ? decodeCustomCode(code) : decodeChallenge(code);
  }

  function makeReceipt(challenge, guesses) {
    var parsed = challengeFromObject(challenge);
    var challengeDecoded;
    var fingerprint;
    var guessPacked;
    var nonce;
    var payload;
    if (!parsed || !validAnswers(guesses, parsed.answers.length)) throw new Error('回执需要与题单对应的作答');
    challengeDecoded = isCustomCode(parsed.code) ? parsed :
      decodeCode(parsed.code, CHALLENGE_PREFIX, CHALLENGE_PAYLOAD_LENGTH);
    if (!challengeDecoded) throw new Error('回执需要与题单对应的作答');
    fingerprint = fingerprint32(challengeDecoded.bytes);
    guessPacked = answerBytes(guesses);
    nonce = randomBytes(3);
    payload = [VERSION, (fingerprint >>> 24) & 255, (fingerprint >>> 16) & 255,
      (fingerprint >>> 8) & 255, fingerprint & 255].concat(guessPacked, nonce);
    return encodeCode(RECEIPT_PREFIX, payload);
  }

  function readReceipt(code, challenge) {
    var parsedChallenge = challengeFromObject(challenge);
    var decoded = decodeCode(code, RECEIPT_PREFIX, RECEIPT_PAYLOAD_LENGTH);
    var challengeDecoded;
    var bytes;
    var expectedFingerprint;
    var guesses;
    var packed;
    var i;
    var score = 0;
    if (!parsedChallenge || !decoded) return null;
    challengeDecoded = isCustomCode(parsedChallenge.code) ? parsedChallenge :
      decodeCode(parsedChallenge.code, CHALLENGE_PREFIX, CHALLENGE_PAYLOAD_LENGTH);
    if (!challengeDecoded) return null;
    bytes = decoded.bytes;
    expectedFingerprint = (bytes[1] * 0x1000000) + (bytes[2] << 16) +
      (bytes[3] << 8) + bytes[4];
    if (bytes[0] !== VERSION || expectedFingerprint !== fingerprint32(challengeDecoded.bytes)) return null;
    guesses = readAnswerBytes(bytes[5], bytes[6], parsedChallenge.answers.length);
    packed = answerBytes(guesses);
    if (bytes[5] !== packed[0] || bytes[6] !== packed[1]) return null;
    for (i = 0; i < guesses.length; i += 1) {
      if (parsedChallenge.answers[i] === guesses[i]) score += 1;
    }
    return { code: decoded.code, score: score, guesses: guesses };
  }

  function formatCode(value) {
    var code = normalizeCode(value);
    var prefix;
    var body;
    var groups = [];
    var i;
    if (isCustomCode(value)) return decodeCustomCode(value) ? value : '';
    if (!code) return '';
    prefix = code.charAt(0);
    body = code.slice(1);
    for (i = 0; i < body.length; i += 4) groups.push(body.slice(i, i + 4));
    return prefix + groups.join('-');
  }

  root.FriendQuiz = {
    themes: themes,
    questionCounts: copyNumbers(QUESTION_COUNTS),
    defaultIds: defaultIds,
    makeChallenge: makeChallenge,
    readChallenge: readChallenge,
    makeReceipt: makeReceipt,
    readReceipt: readReceipt,
    formatCode: formatCode,
    isCustomCode: isCustomCode
  };
}(typeof window !== 'undefined' ? window : this));
