(function (root, factory) {
  var api = factory(root);

  // The file is intended to be loaded as a classic defer script.  Keeping the
  // CommonJS branch makes the same, side-effect-free data module easy to test.
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TimeZone = api;
  }
  if (typeof window !== 'undefined') {
    window.TimeZone = api;
  }
}(typeof window !== 'undefined' ? window :
  (typeof global !== 'undefined' ? global : this), function (root) {
  'use strict';

  var zones = {
    'UTC': '协调世界时',
    'Asia/Shanghai': '中国标准时间',
    'America/New_York': '美国东部时间',
    'America/Toronto': '加拿大东部时间',
    'America/Denver': '美国山地时间',
    'America/Phoenix': '亚利桑那时间',
    'America/Los_Angeles': '美国太平洋时间',
    'America/Chicago': '美国中部时间',
    'America/Vancouver': '加拿大太平洋时间',
    'America/St_Johns': '纽芬兰时间',
    'Europe/London': '英国时间',
    'Europe/Paris': '中欧时间',
    'Europe/Berlin': '德国时间',
    'Europe/Dublin': '爱尔兰时间',
    'Australia/Sydney': '澳大利亚东部时间',
    'Australia/Melbourne': '墨尔本时间',
    'Australia/Brisbane': '布里斯班时间',
    'Australia/Adelaide': '澳大利亚中部时间',
    'Australia/Perth': '澳大利亚西部时间',
    'Pacific/Auckland': '新西兰时间',
    'Asia/Tokyo': '日本时间',
    'Asia/Seoul': '韩国时间',
    'Asia/Singapore': '新加坡时间',
    'Asia/Hong_Kong': '香港时间',
    'Asia/Taipei': '台北时间',
    'Asia/Bangkok': '泰国时间',
    'Asia/Kathmandu': '尼泊尔时间',
    'Asia/Kolkata': '印度时间',
    'Asia/Dubai': '阿联酋时间'
  };

  // A string is deliberately used for search: it works for both Chinese and
  // romanised queries without requiring a network-backed search index.
  var cities = [
    { name: '北京', zone: 'Asia/Shanghai', search: '北京 beijing china 中国 中国标准时间' },
    { name: '上海', zone: 'Asia/Shanghai', search: '上海 shanghai 中国 china' },
    { name: '纽约', zone: 'America/New_York', search: '纽约 new york newyork 美国东部 美国东部时间 usa' },
    { name: '波士顿', zone: 'America/New_York', search: '波士顿 boston 美国东部 美国东部时间 留学' },
    { name: '多伦多', zone: 'America/Toronto', search: '多伦多 toronto 加拿大 canada 留学' },
    { name: '温哥华', zone: 'America/Vancouver', search: '温哥华 vancouver 加拿大 canada 留学' },
    { name: '丹佛', zone: 'America/Denver', search: '丹佛 denver 美国山地 mountain time' },
    { name: '凤凰城', zone: 'America/Phoenix', search: '凤凰城 phoenix 亚利桑那 arizona' },
    { name: '洛杉矶', zone: 'America/Los_Angeles', search: '洛杉矶 los angeles la 美国西部 pacific' },
    { name: '芝加哥', zone: 'America/Chicago', search: '芝加哥 chicago 美国中部 central' },
    { name: '圣约翰斯', zone: 'America/St_Johns', search: '圣约翰斯 st johns st. johns newfoundland 纽芬兰 加拿大' },
    { name: '伦敦', zone: 'Europe/London', search: '伦敦 london 英国 uk united kingdom england' },
    { name: '巴黎', zone: 'Europe/Paris', search: '巴黎 paris 法国 france 欧洲' },
    { name: '柏林', zone: 'Europe/Berlin', search: '柏林 berlin 德国 germany 欧洲' },
    { name: '都柏林', zone: 'Europe/Dublin', search: '都柏林 dublin 爱尔兰 ireland' },
    { name: '悉尼', zone: 'Australia/Sydney', search: '悉尼 sydney 澳大利亚 australia 澳洲 留学' },
    { name: '墨尔本', zone: 'Australia/Melbourne', search: '墨尔本 melbourne 澳大利亚 australia 澳洲 留学' },
    { name: '布里斯班', zone: 'Australia/Brisbane', search: '布里斯班 brisbane 澳大利亚 australia 澳洲' },
    { name: '阿德莱德', zone: 'Australia/Adelaide', search: '阿德莱德 adelaide 澳大利亚 australia 澳洲 半小时' },
    { name: '珀斯', zone: 'Australia/Perth', search: '珀斯 perth 澳大利亚 australia 澳洲' },
    { name: '奥克兰', zone: 'Pacific/Auckland', search: '奥克兰 auckland 新西兰 new zealand 留学' },
    { name: '惠灵顿', zone: 'Pacific/Auckland', search: '惠灵顿 wellington 新西兰 new zealand' },
    { name: '东京', zone: 'Asia/Tokyo', search: '东京 tokyo 日本 japan 留学' },
    { name: '首尔', zone: 'Asia/Seoul', search: '首尔 seoul 韩国 korea 留学' },
    { name: '新加坡', zone: 'Asia/Singapore', search: '新加坡 singapore singapore 留学' },
    { name: '香港', zone: 'Asia/Hong_Kong', search: '香港 hong kong hk' },
    { name: '台北', zone: 'Asia/Taipei', search: '台北 taipei 台湾 taiwan' },
    { name: '曼谷', zone: 'Asia/Bangkok', search: '曼谷 bangkok 泰国 thailand' },
    { name: '加德满都', zone: 'Asia/Kathmandu', search: '加德满都 kathmandu 尼泊尔 nepal 四十五分钟 45' },
    { name: '新德里', zone: 'Asia/Kolkata', search: '新德里 new delhi delhi 印度 india' },
    { name: '迪拜', zone: 'Asia/Dubai', search: '迪拜 dubai 阿联酋 uae' }
  ];

  var aliases = {
    'utc': 'UTC',
    'gmt': 'UTC',
    'z': 'UTC',
    'etc/utc': 'UTC',
    'etc/gmt': 'UTC',
    'etc/gmt+0': 'UTC',
    'etc/gmt-0': 'UTC',
    'etc/gmt0': 'UTC',
    'greenwich': 'UTC',
    '协调世界时': 'UTC',
    '世界时': 'UTC',
    'asia/beijing': 'Asia/Shanghai',
    'asia/chongqing': 'Asia/Shanghai',
    'asia/harbin': 'Asia/Shanghai',
    'prc': 'Asia/Shanghai',
    '中国标准时间': 'Asia/Shanghai',
    '北京时间': 'Asia/Shanghai',
    '北京': 'Asia/Shanghai',
    '上海': 'Asia/Shanghai',
    'shanghai': 'Asia/Shanghai',
    'beijing': 'Asia/Shanghai',
    'us/eastern': 'America/New_York',
    'est5edt': 'America/New_York',
    'eastern': 'America/New_York',
    '美国东部时间': 'America/New_York',
    '纽约': 'America/New_York',
    '波士顿': 'America/New_York',
    'canada/eastern': 'America/Toronto',
    'us/mountain': 'America/Denver',
    'mountain': 'America/Denver',
    'us/arizona': 'America/Phoenix',
    'mst': 'America/Phoenix',
    'us/pacific': 'America/Los_Angeles',
    'pst8pdt': 'America/Los_Angeles',
    'europe/uk': 'Europe/London',
    'eire': 'Europe/Dublin',
    'gb': 'Europe/London',
    'gb-eire': 'Europe/London',
    'uk': 'Europe/London',
    '英国': 'Europe/London',
    '伦敦': 'Europe/London',
    'australia/canberra': 'Australia/Sydney',
    'australia/queensland': 'Australia/Brisbane',
    'australia/yancowinna': 'Australia/Adelaide',
    'nz': 'Pacific/Auckland',
    '新西兰': 'Pacific/Auckland',
    '阿德莱德': 'Australia/Adelaide',
    '加德满都': 'Asia/Kathmandu',
    '圣约翰斯': 'America/St_Johns'
  };

  // Make known canonical IDs case-insensitive in normalize(), while unknown
  // IDs still go through Intl's own validation.
  Object.keys(zones).forEach(function (id) {
    var lower = id.toLowerCase();
    if (!aliases[lower]) {
      aliases[lower] = id;
    }
  });

  var formatterCache = {};
  var zoneCache = {};
  var intl = root && root.Intl;
  var hasIntl = !!(intl && typeof intl.DateTimeFormat === 'function');
  var hasOwn = Object.prototype.hasOwnProperty;
  var MINUTE = 60 * 1000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;

  function own(object, key) {
    return hasOwn.call(object, key);
  }

  function isInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  }

  function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function pad(value, length) {
    var text = String(Math.abs(value));
    while (text.length < length) {
      text = '0' + text;
    }
    return text;
  }

  function leapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year, month) {
    if (month === 2) {
      return leapYear(year) ? 29 : 28;
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
  }

  function validDate(year, month, day) {
    return isInteger(year) && year >= 1 && year <= 9999 &&
      isInteger(month) && month >= 1 && month <= 12 &&
      isInteger(day) && day >= 1 && day <= daysInMonth(year, month);
  }

  function validClock(hour, minute) {
    return isInteger(hour) && hour >= 0 && hour <= 23 &&
      isInteger(minute) && minute >= 0 && minute <= 59;
  }

  function validParts(parts, requireClock) {
    if (!parts || !validDate(parts.year, parts.month, parts.day)) {
      return false;
    }
    if (requireClock) {
      return validClock(parts.hour, parts.minute);
    }
    return true;
  }

  // Date.UTC treats years 0..99 as 1900..1999.  Constructing through
  // setUTCFullYear avoids that legacy special case and keeps date arithmetic
  // independent of the machine's local timezone.
  function utcMillis(year, month, day, hour, minute, second, millisecond) {
    var date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour || 0, minute || 0, second || 0, millisecond || 0);
    return date.getTime();
  }

  function datePartsFromUTC(ms) {
    var date = new Date(ms);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      millisecond: date.getUTCMilliseconds()
    };
  }

  function canonicalAlias(value) {
    var lower = value.toLowerCase();
    return own(aliases, lower) ? aliases[lower] : value;
  }

  function normalize(zone) {
    if (typeof zone !== 'string') {
      return '';
    }
    var value = zone.replace(/^\s+|\s+$/g, '');
    if (!value) {
      return '';
    }
    var alias = canonicalAlias(value);
    if (alias !== value || own(zones, alias)) {
      return alias;
    }
    if (!hasIntl) {
      return '';
    }
    if (own(zoneCache, value)) {
      return zoneCache[value];
    }
    try {
      var formatter = new intl.DateTimeFormat('en-US', { timeZone: value });
      var resolved = formatter.resolvedOptions && formatter.resolvedOptions().timeZone;
      var result = resolved || value;
      result = canonicalAlias(result);
      zoneCache[value] = result;
      return result;
    } catch (error) {
      zoneCache[value] = '';
      return '';
    }
  }

  function formatterFor(zone) {
    if (!hasIntl) {
      return null;
    }
    if (own(formatterCache, zone)) {
      return formatterCache[zone];
    }
    try {
      var formatter = new intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      formatterCache[zone] = formatter;
      return formatter;
    } catch (error) {
      formatterCache[zone] = null;
      return null;
    }
  }

  function partMap(formatter, date) {
    if (formatter && typeof formatter.formatToParts === 'function') {
      try {
        var pieces = formatter.formatToParts(date);
        var result = {};
        pieces.forEach(function (piece) {
          if (piece.type !== 'literal') {
            result[piece.type] = parseInt(piece.value, 10);
          }
        });
        if (isNumber(result.year) && isNumber(result.month) && isNumber(result.day) &&
            isNumber(result.hour) && isNumber(result.minute) && isNumber(result.second)) {
          return result;
        }
      } catch (error) {
        // Use the string fallback below for older or partial Intl builds.
      }
    }
    if (!formatter) {
      return null;
    }
    try {
      // The formatter locale is fixed to en-US, whose order is month/day/year
      // followed by hour/minute/second even where formatToParts is unavailable.
      var numbers = formatter.format(date).match(/\d+/g);
      if (!numbers || numbers.length < 6) {
        return null;
      }
      return {
        month: parseInt(numbers[0], 10),
        day: parseInt(numbers[1], 10),
        year: parseInt(numbers[2], 10),
        hour: parseInt(numbers[3], 10),
        minute: parseInt(numbers[4], 10),
        second: parseInt(numbers[5], 10)
      };
    } catch (error2) {
      return null;
    }
  }

  function localParts(ms, zone) {
    var date = new Date(ms);
    if (isNaN(date.getTime())) {
      return null;
    }
    if (zone === 'UTC' && !hasIntl) {
      return datePartsFromUTC(ms);
    }
    var formatter = formatterFor(zone);
    var parts = partMap(formatter, date);
    if (!parts) {
      if (zone === 'UTC') {
        return datePartsFromUTC(ms);
      }
      return null;
    }
    // Some older Intl implementations express midnight as 24:00.  For this
    // module it is always the start of the displayed calendar day.
    if (parts.hour === 24) {
      parts.hour = 0;
    }
    return parts;
  }

  function sameMinute(a, b) {
    return a && b && a.year === b.year && a.month === b.month &&
      a.day === b.day && a.hour === b.hour && a.minute === b.minute;
  }

  function at(ms, zone) {
    if (!isNumber(ms)) {
      return null;
    }
    var id = normalize(zone);
    if (!id) {
      return null;
    }
    var date = new Date(ms);
    if (isNaN(date.getTime())) {
      return null;
    }
    var local = localParts(ms, id);
    if (!local) {
      return null;
    }
    var wall = utcMillis(local.year, local.month, local.day, local.hour,
      local.minute, local.second, date.getUTCMilliseconds());
    var offset = Math.round((wall - ms) / MINUTE);
    return {
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      weekday: new Date(utcMillis(local.year, local.month, local.day, 0, 0, 0, 0)).getUTCDay(),
      offset: offset
    };
  }

  function resolve(parts, zone) {
    if (!validParts(parts, true)) {
      return [];
    }
    var id = normalize(zone);
    if (!id) {
      return [];
    }
    var naive = utcMillis(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0, 0);
    if (id === 'UTC' && !hasIntl) {
      return [naive];
    }

    var offsets = {};
    function addOffset(value) {
      if (isInteger(value) && value >= -24 * 60 && value <= 24 * 60) {
        offsets[String(value)] = value;
      }
    }

    // The requested wall time can be in either side of a DST transition.  A
    // few days of six-hour probes cover both sides without brute-forcing every
    // minute, including half-hour and 45-minute offsets.
    var span = 4 * DAY;
    var step = 6 * HOUR;
    var delta;
    for (delta = -span; delta <= span; delta += step) {
      var sample = at(naive + delta, id);
      if (sample) {
        addOffset(sample.offset);
      }
    }
    var naiveView = at(naive, id);
    addOffset(naiveView && naiveView.offset);

    var candidates = [];
    Object.keys(offsets).forEach(function (key) {
      var candidate = naive - offsets[key] * MINUTE;
      var observed = at(candidate, id);
      if (sameMinute(observed, parts) && candidates.indexOf(candidate) === -1) {
        candidates.push(candidate);
      }
    });
    candidates.sort(function (a, b) { return a - b; });
    return candidates;
  }

  function dateKey(parts) {
    if (!validParts(parts, false)) {
      return '';
    }
    return pad(parts.year, 4) + '-' + pad(parts.month, 2) + '-' + pad(parts.day, 2);
  }

  function clock(parts) {
    if (!parts || !validClock(parts.hour, parts.minute)) {
      return '';
    }
    return pad(parts.hour, 2) + ':' + pad(parts.minute, 2);
  }

  function offsetText(minutes) {
    if (!isInteger(minutes)) {
      return '';
    }
    var sign = minutes < 0 ? '-' : '+';
    var absolute = Math.abs(minutes);
    var hour = Math.floor(absolute / 60);
    var minute = absolute % 60;
    return 'UTC' + sign + pad(hour, 2) + ':' + pad(minute, 2);
  }

  function addDay(parts, amount) {
    if (!validParts(parts, true) || !isInteger(amount)) {
      return null;
    }
    var date = new Date(utcMillis(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0, 0));
    date.setUTCDate(date.getUTCDate() + amount);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute
    };
  }

  function dayDifference(parts, reference) {
    if (!validParts(parts, false) || !validParts(reference, false)) {
      return null;
    }
    var left = utcMillis(parts.year, parts.month, parts.day, 0, 0, 0, 0);
    var right = utcMillis(reference.year, reference.month, reference.day, 0, 0, 0, 0);
    return Math.round((left - right) / DAY);
  }

  function name(zone) {
    var id = normalize(zone);
    if (id && own(zones, id)) {
      return zones[id];
    }
    if (id) {
      return id;
    }
    return typeof zone === 'string' ? zone : '';
  }

  return {
    cities: cities,
    zones: zones,
    name: name,
    normalize: normalize,
    at: at,
    resolve: resolve,
    dateKey: dateKey,
    clock: clock,
    offsetText: offsetText,
    addDay: addDay,
    dayDifference: dayDifference
  };
}));
