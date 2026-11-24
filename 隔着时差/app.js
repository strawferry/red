(function () {
  "use strict";

  const zones = window.TimeZone;
  const platform = window.ClockPlatform;
  const byId = id => document.getElementById(id);
  if (!zones || !platform) {
    byId("startup-status").className = "notice";
    byId("startup-status").textContent = "时间未能加载，请关闭后重新打开。";
    byId("clocks").removeAttribute("aria-busy");
    return;
  }

  const MINUTE = 60000;
  const CARD_TITLES = { current: "当前时刻", meeting: "约个时间" };
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const MEAL_DEFAULTS = Object.freeze({
    breakfastStart: "07:00", breakfastEnd: "10:00",
    dinnerStart: "18:00", dinnerEnd: "20:30",
    restStart: "23:00", restEnd: "07:00",
    freeStart: "09:00", freeEnd: "21:00"
  });
  const PERIODS = [
    ["早餐", "breakfast"], ["晚饭", "dinner"], ["休息", "rest"], ["方便联系", "free"]
  ];
  const TAGS = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escape = value => String(value).replace(/[&<>"']/g, character => TAGS[character]);
  const trim = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const cleanTime = (value, fallback) => /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : fallback;
  const byMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const personLabel = person => person.nickname || person.city;
  const button = (label, action, value, classes) =>
    '<button type="button" class="button ' + (classes || "") + '" data-action="' + action +
    '" data-value="' + escape(value === undefined ? "" : value) + '">' + escape(label) + '</button>';

  function defaultSettings() {
    return {
      pinned: "Asia/Shanghai",
      groups: [
        { zone: "Asia/Shanghai", cities: ["北京"], people: [] },
        { zone: "America/New_York", cities: ["纽约"], people: [] },
        { zone: "Europe/London", cities: ["伦敦"], people: [] }
      ]
    };
  }

  let settings = defaultSettings();
  let settingsReady = false;
  let storageAvailable = false;
  let writeChain = Promise.resolve();
  let revision = 0;
  let personCounter = 0;
  let mode = "now";
  let modifiedAt = null;
  let validComparison = true;
  let referenceZone = settings.pinned;
  let excluded = new Set();
  let timeChoices = [];
  let foldedOpen = new Set();
  let minuteTimer;
  let toastTimer;
  let sheetType = "";
  let sheetZone = "";
  let sheetPerson = "";
  let focusReturn;
  let cardData = null;
  let meetingDraft = null;
  let canvas = null;
  let busyCard = false;
  let searchShown = 10;
  let searchResults = [];

  const app = byId("app");
  const sheet = byId("sheet");
  const sheetBody = byId("sheet-body");
  const dateInput = byId("date");
  const timeInput = byId("time");

  function normalizeSettings(source) {
    if (!source || !Array.isArray(source.groups)) throw new Error("缓存格式有误");
    const merged = new Map();
    for (const item of source.groups) {
      if (!item || typeof item.zone !== "string") continue;
      const zone = zones.normalize(item.zone) || trim(item.zone, 100);
      if (!zone || !/^[a-z0-9_+./-]+$/i.test(zone)) continue;
      const group = merged.get(zone) || { zone, cities: [], people: [] };
      const cities = Array.isArray(item.cities) ? item.cities : [];
      group.cities = Array.from(new Set(group.cities.concat(cities.map(city => trim(city, 55)).filter(Boolean))));
      const people = Array.isArray(item.people) ? item.people : [];
      for (const person of people) {
        if (!person || typeof person !== "object") continue;
        const id = trim(person.id, 45) || newPersonId();
        if (group.people.some(entry => entry.id === id)) continue;
        const periods = {};
        for (const key of Object.keys(MEAL_DEFAULTS)) {
          periods[key] = cleanTime(person.periods && person.periods[key], MEAL_DEFAULTS[key]);
        }
        group.people.push({
          id, city: trim(person.city, 55), nickname: trim(person.nickname, 24),
          note: trim(person.note, 70), showPeriods: person.showPeriods !== false, periods
        });
      }
      merged.set(zone, group);
    }
    const groups = Array.from(merged.values());
    const pinned = zones.normalize(source.pinned) || source.pinned;
    return { groups, pinned: merged.has(pinned) ? pinned : (groups[0] && groups[0].zone || "") };
  }

  function orderedGroups() {
    const pinned = settings.groups.find(group => group.zone === settings.pinned);
    return pinned ? [pinned].concat(settings.groups.filter(group => group !== pinned)) : settings.groups.slice();
  }

  function displayGroup(group) {
    const distinct = Array.from(new Set(group.cities.concat(group.people.map(person => person.city).filter(Boolean))));
    return distinct.length ? distinct.slice(0, 3).join(" · ") + (distinct.length > 3 ? " 等" : "") : zones.name(group.zone);
  }

  function groupByZone(zone) {
    return settings.groups.find(group => group.zone === zone);
  }

  function newPersonId() {
    personCounter += 1;
    return Date.now().toString(36) + "-" + personCounter;
  }

  function difference(minutes) {
    if (minutes === 0) return "同时";
    const absolute = Math.abs(minutes);
    const hours = Math.floor(absolute / 60);
    const remainder = absolute % 60;
    return (minutes > 0 ? "快 " : "慢 ") + (hours ? hours + " 小时" : "") +
      (remainder ? (hours ? " " : "") + remainder + " 分" : "");
  }

  function dateLabel(parts, full) {
    return (full ? parts.year + "年" : "") + parts.month + "月" + parts.day + "日 " + WEEKDAYS[parts.weekday];
  }

  function relativeDate(parts, reference) {
    const days = zones.dayDifference(parts, reference);
    if (days === 0) return "同一天";
    if (days === -1) return "前一天";
    if (days === 1) return "后一天";
    return (days < 0 ? "提前" : "推后") + Math.abs(days) + "天";
  }

  function inPeriod(minute, range, key) {
    const start = byMinutes(range[key + "Start"]);
    const end = byMinutes(range[key + "End"]);
    if (start === end) return false;
    return start < end ? minute >= start && minute < end : minute >= start || minute < end;
  }

  function mealOrRest(parts, person) {
    if (person && !person.showPeriods) return "";
    const periods = person ? person.periods : MEAL_DEFAULTS;
    const minute = parts.hour * 60 + parts.minute;
    if (inPeriod(minute, periods, "rest")) return "休息时段";
    if (inPeriod(minute, periods, "breakfast")) return "早餐时段";
    if (inPeriod(minute, periods, "dinner")) return "晚饭时段";
    if (minute >= 690 && minute < 810) return "午饭参考";
    return "";
  }

  function mood(parts) {
    if (!parts || parts.hour >= 21 || parts.hour < 5) return "night";
    if (parts.hour < 9) return "dawn";
    return parts.hour < 17 ? "day" : "dusk";
  }

  function phase(parts) {
    return { dawn: "清晨", day: "白天", dusk: "傍晚", night: "夜里" }[mood(parts)];
  }

  function shownInstant() {
    return mode === "compare" && modifiedAt !== null ? modifiedAt : Date.now();
  }

  function chosenGroups() {
    return orderedGroups().filter(group => mode !== "compare" || !excluded.has(group.zone));
  }

  function clockMarkup(entry, ref, live) {
    const group = entry.group;
    const parts = entry.parts;
    const name = displayGroup(group);
    const zone = zones.name(group.zone);
    const pinned = group.zone === settings.pinned;
    const title = '<h3>' + escape(name) + '</h3>' + (name === zone ? '' : '<p>' + escape(zone) + '</p>');
    const edit = settingsReady ? '<button type="button" class="detail-button" data-action="details" data-value="' +
      escape(group.zone) + '" aria-label="管理' + escape(name) + '">' + (pinned ? "已置顶" : "详情") + '</button>' : '';
    const summary = '<div class="clock-top"><div>' + title + '</div>' + edit + '</div>';
    const classes = 'class="clock mood-' + mood(parts) + (pinned ? ' main-clock' : '') + '"';
    if (!parts) {
      return '<article ' + classes + '>' + summary +
        '<div class="clock-time">--:--</div><p class="clock-date">当前设备暂不能换算此时区</p></article>';
    }
    const captions = [phase(parts)];
    if (!live) captions.push(zones.offsetText(parts.offset));
    if (!group.people.length && live) captions.push(mealOrRest(parts));
    if (ref && group.zone !== (live ? settings.pinned : referenceZone)) {
      if (!live || parts.offset !== ref.offset) captions.push(difference(parts.offset - ref.offset));
      if (!live || zones.dayDifference(parts, ref)) captions.push(relativeDate(parts, ref));
    }
    const people = group.people.slice(0, 2).map(person => {
      const details = [personLabel(person)];
      if (person.nickname && person.city) details.push(person.city);
      if (person.note) details.push(person.note);
      const hint = live && mealOrRest(parts, person);
      if (hint) details.push(hint);
      return '<p>' + escape(details.join(" · ")) + '</p>';
    });
    if (group.people.length > 2) people.push('<p>另有 ' + (group.people.length - 2) + ' 人</p>');
    return '<article ' + classes + '><div class="sky-icon" aria-hidden="true"><i></i><b></b></div>' + summary +
      '<div class="clock-time">' + zones.clock(parts) + '</div><p class="clock-date">' + dateLabel(parts, !live) + '</p>' +
      '<div class="clock-labels">' + captions.filter(Boolean).map(label => '<span>' + escape(label) + '</span>').join("") + '</div>' +
      (people.length ? '<div class="people-preview">' + people.join("") + '</div>' : '') + '</article>';
  }

  function renderClocks() {
    const host = byId("clocks");
    const instant = shownInstant();
    const entries = chosenGroups().map(group => ({ group, parts: zones.at(instant, group.zone) }));
    const reference = zones.at(instant, mode === "now" ? settings.pinned : referenceZone);
    const buckets = new Map();
    for (const entry of entries) {
      const key = entry.parts ? zones.dateKey(entry.parts) + " " + zones.clock(entry.parts) : entry.group.zone;
      const bucket = buckets.get(key) || [];
      bucket.push(entry);
      buckets.set(key, bucket);
    }
    const stale = mode === "compare" && !validComparison;
    byId("clock-heading").textContent = stale ? "上一次的时间对照" : "各地时间";
    host.classList.toggle("stale-time", stale);
    byId("clock-count").textContent = entries.length + " 个时区";
    byId("make-card").disabled = stale || !entries.some(entry => entry.parts) || !window.TimeCards;
    if (!entries.length) {
      host.innerHTML = '<p class="notice empty">还没有地点。添加一座常看的城市，就能查看当地时间。</p>';
    } else {
      const live = mode === "now";
      const focused = document.activeElement && host.contains(document.activeElement) ? document.activeElement : null;
      const focusZone = focused && focused.getAttribute("data-value");
      const focusBucket = focused && focused.parentNode && focused.parentNode.getAttribute("data-fold");
      host.innerHTML = Array.from(buckets.values()).map(bucket => {
        const cards = bucket.map(entry => clockMarkup(entry, reference, live)).join("");
        if (bucket.length === 1) return cards;
        const key = bucket.map(entry => entry.group.zone).join("|");
        const cities = bucket.map(entry => displayGroup(entry.group)).join("、");
        return '<details class="folded" data-fold="' + escape(key) + '"' + (foldedOpen.has(key) ? ' open' : '') +
          '><summary>此刻同一时间 ' + zones.clock(bucket[0].parts) + ' · ' + escape(cities) +
          '</summary><div class="clock-grid">' + cards + '</div></details>';
      }).join("");
      if (focusZone || focusBucket) {
        const replacement = Array.from(host.querySelectorAll("button, summary")).find(node =>
          focusZone ? node.getAttribute("data-value") === focusZone : node.parentNode.getAttribute("data-fold") === focusBucket);
        if (replacement) replacement.focus();
      }
    }
    host.removeAttribute("aria-busy");
  }

  function settingsNotice(message) {
    const notice = byId("storage-message");
    notice.textContent = message;
    notice.hidden = !message;
  }

  function saveSettings() {
    renderControls();
    renderClocks();
    if (!storageAvailable) {
      const notice = byId("storage-message");
      if (notice.hidden) settingsNotice("当前环境无法保存地点，修改会保留到本次关闭。");
      return;
    }
    const version = ++revision;
    const value = JSON.stringify(settings);
    writeChain = writeChain.then(async () => {
      if (revision !== version) return;
      try {
        await platform.saveSettings(value);
        if (revision === version) settingsNotice("");
      } catch (error) {
        if (revision === version) settingsNotice("保存未获确认，本次修改仍保留在当前页面。");
      }
    });
  }

  async function restore() {
    try {
      const result = await platform.loadSettings();
      if (result.value !== null) settings = normalizeSettings(result.value);
      storageAvailable = result.available;
    } catch (error) {
      settingsNotice("上次保存的地点暂时读不到。可以先使用示例，这次修改仅在当前页面保留。");
    } finally {
      settingsReady = true;
      byId("add").disabled = false;
      renderControls();
      renderClocks();
    }
  }

  function renderControls() {
    const groups = orderedGroups();
    const previousReference = referenceZone;
    if (!groupByZone(referenceZone)) referenceZone = settings.pinned || (groups[0] && groups[0].zone) || "UTC";
    excluded.delete(referenceZone);
    byId("compare").hidden = mode !== "compare" || !groups.length;
    byId("overlap").hidden = byId("compare").hidden;
    document.querySelectorAll("[data-mode]").forEach(item =>
      item.setAttribute("aria-pressed", String(item.getAttribute("data-mode") === mode)));
    if (mode !== "compare" || !groups.length) return;
    byId("reference").innerHTML = groups.map(group =>
      '<option value="' + escape(group.zone) + '">' + escape(displayGroup(group)) + '</option>').join("");
    byId("reference").value = referenceZone;
    if (referenceZone !== previousReference) syncComparison();
    byId("comparison-zones").innerHTML = groups.map(group =>
      '<label><input type="checkbox" value="' + escape(group.zone) + '"' +
      (!excluded.has(group.zone) ? " checked" : "") + (group.zone === referenceZone ? " disabled" : "") +
      '> ' + escape(displayGroup(group)) + (group.zone === referenceZone ? "（参考地点）" : "") + '</label>').join("");
    if (byId("overlap").open) renderOverlap();
  }

  function syncComparison() {
    const parts = zones.at(shownInstant(), referenceZone);
    dateInput.value = parts ? zones.dateKey(parts) : "";
    timeInput.value = parts ? zones.clock(parts) : "";
    validComparison = Boolean(parts);
    clearOptions();
    showTimeStatus(parts ? "" : "此时区暂不可用，请更换参考地点。");
  }

  function showTimeStatus(message) {
    const box = byId("time-status");
    box.textContent = message;
    box.hidden = !message;
  }

  function clearOptions() {
    timeChoices = [];
    byId("time-options").hidden = true;
    byId("time-options").textContent = "";
  }

  function setMode(next, clearCompare) {
    mode = next;
    if (clearCompare) {
      modifiedAt = null;
      validComparison = true;
      showTimeStatus("");
      clearOptions();
    }
    renderControls();
    if (next === "compare") {
      if (modifiedAt === null) modifiedAt = Math.floor(Date.now() / MINUTE) * MINUTE;
      syncComparison();
      if (byId("overlap").open) renderOverlap();
    }
    renderClocks();
  }

  function selectInstant(instant) {
    modifiedAt = instant;
    const focusOption = byId("time-options").contains(document.activeElement);
    syncComparison();
    renderClocks();
    if (byId("overlap").open) renderOverlap();
    if (focusOption) byId("reference").focus();
  }

  function comparisonIssue(message) {
    validComparison = false;
    showTimeStatus(message);
    renderClocks();
    if (byId("overlap").open) renderOverlap();
  }

  function compareTime(parts) {
    clearOptions();
    if (!zones.at(Date.now(), referenceZone)) {
      comparisonIssue("此时区暂不可用，请更换参考地点。");
      return;
    }
    const resolved = zones.resolve(parts, referenceZone);
    if (!resolved.length) {
      comparisonIssue("这个当地时间不存在，可能遇到夏令时跳时。请换一个时间。");
      return;
    }
    if (resolved.length === 1) {
      selectInstant(resolved[0]);
      return;
    }
    timeChoices = resolved;
    comparisonIssue("当地时钟回拨，这个时间出现两次。请选择偏移。");
    const options = byId("time-options");
    options.innerHTML = resolved.map((instant, index) => button(
      (index === 0 ? "第一次 " : "第二次 ") + zones.offsetText(zones.at(instant, referenceZone).offset),
      "choose-time", index)).join("");
    options.hidden = false;
  }

  function quickTime(kind) {
    const local = zones.at(Date.now(), referenceZone);
    if (!local) {
      clearOptions();
      comparisonIssue("此时区暂不可用，请更换参考地点。");
      return;
    }
    const desired = zones.addDay(local, kind === "tomorrow" ? 1 : 0);
    desired.hour = kind === "tomorrow" ? 9 : 20;
    desired.minute = 0;
    dateInput.value = zones.dateKey(desired);
    timeInput.value = zones.clock(desired);
    compareTime(desired);
  }

  function findOverlaps(groups, localDay) {
    const date = new Date(0);
    date.setUTCFullYear(localDay.year, localDay.month - 1, localDay.day);
    const localMidnight = date.getTime();
    const start = localMidnight - 16 * 60 * MINUTE;
    const end = localMidnight + 40 * 60 * MINUTE;
    const dayEnd = localMidnight + 24 * 60 * MINUTE;
    const schedules = groups.map(group => ({
      zone: group.zone,
      periods: group.people.length ? group.people.map(person => person.periods) : [MEAL_DEFAULTS]
    }));
    const ranges = [];
    let from = null;
    const blockLength = 15 * MINUTE;
    function offsetAt(instant, zone) {
      const parts = zones.at(instant, zone);
      return parts ? parts.offset : NaN;
    }
    for (let block = start; block < end; block += blockLength) {
      const last = block + blockLength - MINUTE;
      const firstOffset = offsetAt(block, referenceZone);
      const lastOffset = offsetAt(last, referenceZone);
      const firstLocal = block + firstOffset * MINUTE;
      const lastLocal = last + lastOffset * MINUTE;
      if (Math.max(firstLocal, lastLocal) < localMidnight || Math.min(firstLocal, lastLocal) >= dayEnd) {
        if (from !== null) ranges.push([from, block]);
        from = null;
        continue;
      }
      // Use Intl once per block edge and check every minute. Re-read the offset
      // inside a block only where the local clock changes.
      const offsets = schedules.map(schedule => {
        const first = offsetAt(block, schedule.zone);
        return first === offsetAt(last, schedule.zone) ? first : NaN;
      });
      for (let instant = block; instant <= last; instant += MINUTE) {
        const referenceOffset = firstOffset === lastOffset ? firstOffset : offsetAt(instant, referenceZone);
        const local = instant + referenceOffset * MINUTE;
        const free = local >= localMidnight && local < dayEnd && schedules.every((schedule, index) => {
          const offset = Number.isFinite(offsets[index]) ? offsets[index] : offsetAt(instant, schedule.zone);
          if (!Number.isFinite(offset)) return false;
          const minute = ((instant / MINUTE + offset) % 1440 + 1440) % 1440;
          return schedule.periods.every(periods => inPeriod(minute, periods, "free") && !inPeriod(minute, periods, "rest"));
        });
        if (free && from === null) from = instant;
        if (!free && from !== null) {
          ranges.push([from, instant]);
          from = null;
        }
      }
    }
    return ranges;
  }

  function renderOverlap() {
    const container = byId("overlap-results");
    if (!validComparison) {
      container.textContent = "请先选定有效的日期和时分。";
      return;
    }
    const groups = chosenGroups();
    const parts = zones.at(shownInstant(), referenceZone);
    if (groups.length < 2 || !parts || groups.some(group => !zones.at(shownInstant(), group.zone))) {
      container.textContent = "选择至少两个可用的地点后查看。";
      return;
    }
    const ranges = findOverlaps(groups, parts);
    const intro = '<p class="hint">' + escape(dateLabel(parts, false)) + '，按参考地点显示。未设置时，方便联系按当地 09:00–21:00 参考。</p>';
    if (!ranges.length) {
      container.innerHTML = intro + '<p class="notice">这天没有重合，试试换一天或调整对方的方便时段。</p>';
      return;
    }
    container.innerHTML = intro + '<div class="quick">' + ranges.map(range => {
      const start = zones.at(range[0], referenceZone);
      const end = zones.at(range[1], referenceZone);
      const finish = zones.dayDifference(end, start) ? "次日 " + zones.clock(end) : zones.clock(end);
      const label = zones.clock(start) + "–" + finish +
        (start.offset !== end.offset ? "（跨夏令时切换）" : "");
      return button(label, "select-overlap", range[0]);
    }).join("") + '</div>';
  }

  function showSheet(kind, title, markup) {
    if (!sheetType) {
      focusReturn = document.activeElement;
      document.body.classList.add("locked");
      app.setAttribute("aria-hidden", "true");
      if ("inert" in app) app.inert = true;
      byId("overlay").hidden = false;
    }
    sheetType = kind;
    byId("sheet-title").textContent = title;
    sheetBody.innerHTML = markup;
    sheetBody.scrollTop = 0;
    byId("close-sheet").focus();
  }

  function closeSheet() {
    if (!sheetType || busyCard) return;
    byId("overlay").hidden = true;
    document.body.classList.remove("locked");
    app.removeAttribute("aria-hidden");
    if ("inert" in app) app.inert = false;
    sheetType = "";
    sheetBody.textContent = "";
    byId("card-footer").hidden = true;
    byId("card-actions").textContent = "";
    canvas = null;
    cardData = null;
    if (focusReturn && document.contains(focusReturn)) focusReturn.focus();
    else byId("add").focus();
  }

  function openAdd() {
    searchShown = 10;
    showSheet("add", "添加地点",
      '<label class="field">搜索城市或时区<input type="search" id="city-search" placeholder="如 纽约、UTC、Tokyo" maxlength="100" autocomplete="off"></label>' +
      '<ul class="choice-list" id="city-options"></ul><div id="city-more"></div>');
    updateSearch();
  }

  function updateSearch() {
    const query = byId("city-search").value.trim().toLowerCase();
    searchShown = 10;
    const cities = zones.cities;
    const cityResults = query ? cities.filter(city =>
      [city.name, city.zone, city.search].join(" ").toLowerCase().indexOf(query) >= 0) : cities;
    const zoneResults = query ? Object.keys(zones.zones).filter(zone =>
      [zone, zones.name(zone)].join(" ").toLowerCase().indexOf(query) >= 0) : [];
    searchResults = cityResults.map(city => ({ city: city.name, zone: city.zone }))
      .concat(zoneResults.map(zone => ({ city: "", zone })));
    const exact = query && (query === "utc" || query.indexOf("/") > -1) && zones.normalize(query);
    if (exact && !searchResults.some(result => result.zone === exact && !result.city)) {
      searchResults.unshift({ city: "", zone: exact });
    }
    if (query) searchResults.sort((a, b) => Number((b.city || zones.name(b.zone)).toLowerCase() === query) -
      Number((a.city || zones.name(a.zone)).toLowerCase() === query));
    renderSearch();
  }

  function renderSearch() {
    byId("city-options").innerHTML = searchResults.slice(0, searchShown).map((result, index) => {
      const group = groupByZone(result.zone);
      const existing = group ? (result.city && group.cities.indexOf(result.city) < 0 ? " · 合入已有时区" : " · 已有") : "";
      return '<li><button type="button" class="city-choice" data-action="add-location" data-value="' +
        index + '"><strong>' + escape(result.city || zones.name(result.zone)) +
        '</strong><small>' + escape((result.city ? zones.name(result.zone) : result.zone) + existing) + '</small></button></li>';
    }).join("");
    byId("city-more").innerHTML = searchResults.length > searchShown ? button("查看更多", "show-cities") :
      (!searchResults.length ? '<p class="hint">没找到这个地点，可以试试时区名称或 IANA 标识。</p>' : '');
  }

  function addLocation(result) {
    if (!result) return;
    const zone = zones.normalize(result.zone);
    if (!zone) {
      flash("当前设备暂不能换算这个时区。");
      return;
    }
    let group = groupByZone(zone);
    const existed = Boolean(group);
    if (!group) {
      group = { zone, cities: [], people: [] };
      settings.groups.push(group);
      if (!settings.pinned) {
        settings.pinned = zone;
        referenceZone = zone;
      }
    }
    if (result.city && group.cities.indexOf(result.city) < 0) group.cities.push(result.city);
    excluded.delete(zone);
    saveSettings();
    showGroup(group.zone);
    flash(existed ? "已归入" + zones.name(zone) : "已添加" + (result.city || zones.name(zone)));
  }

  function showGroup(zone) {
    const group = groupByZone(zone);
    if (!group) return closeSheet();
    sheetZone = zone;
    const pinned = settings.pinned === zone;
    const rest = settings.groups.filter(item => item.zone !== settings.pinned);
    const index = rest.indexOf(group);
    const actions = [
      pinned ? "" : button("置顶地点", "pin-zone", zone),
      index > 0 ? button("上移", "move-up", zone) : "",
      index >= 0 && index < rest.length - 1 ? button("下移", "move-down", zone) : ""
    ].join("");
    const people = group.people.map(person => {
      const details = [person.nickname && person.city, person.note].filter(Boolean);
      const schedule = person.periods.freeStart + "–" + person.periods.freeEnd;
      return '<div class="person-row"><div><strong>' + escape(personLabel(person)) + '</strong>' +
        (details.length ? '<small>' + escape(details.join(" · ")) + '</small>' : "") +
        '<small>方便联系 ' + schedule + '</small></div>' + button("编辑", "edit-person", person.id) + '</div>';
    }).join("");
    showSheet("group", displayGroup(group),
      '<p class="hint">' + escape(zones.name(zone)) + ' · ' + escape(zone) + '</p>' +
      '<div class="quick">' + actions + '</div>' +
      '<div class="section-head"><h3>同一时区的人</h3>' + button("＋ 加一个人", "new-person", zone, "small") + '</div>' +
      (people || '<p class="hint">可以加昵称、城市和方便联系的时段。</p>') +
      '<div class="quick">' + button("移除此时区", "ask-remove-zone", zone, "danger") + '</div>');
  }

  function showRemove(zone) {
    const group = groupByZone(zone);
    if (!group) return closeSheet();
    showSheet("remove", "移除" + displayGroup(group),
      '<p>此地点下的城市和人物备注也会一起移除。</p><div class="quick">' +
      button("返回详情", "details", zone) + button("确认移除", "remove-zone", zone, "danger") + '</div>');
  }

  function moveGroup(zone, direction) {
    const group = groupByZone(zone);
    const rest = settings.groups.filter(item => item.zone !== settings.pinned);
    const target = rest[rest.indexOf(group) + direction];
    if (!group || !target || group.zone === settings.pinned) return;
    const a = settings.groups.indexOf(group);
    const b = settings.groups.indexOf(target);
    settings.groups[a] = target;
    settings.groups[b] = group;
    saveSettings();
    showGroup(zone);
  }

  function showPerson(zone, id) {
    const group = groupByZone(zone);
    if (!group) return closeSheet();
    const person = group.people.find(entry => entry.id === id);
    sheetZone = zone;
    sheetPerson = person ? person.id : "";
    const periods = person ? person.periods : MEAL_DEFAULTS;
    const cities = Array.from(new Set(group.cities.concat(zones.cities.filter(item => item.zone === zone).map(item => item.name))));
    const selectedCity = person ? person.city : cities[0] || "";
    const suggestions = Array.from(new Set(cities.concat([selectedCity]).filter(Boolean)));
    const cityOptions = '<option value="">仅时区</option>' + suggestions.map(city =>
      '<option value="' + escape(city) + '"' + (city === selectedCity ? " selected" : "") + '>' + escape(city) + '</option>').join("");
    const inputs = PERIODS.map(pair => {
      const a = pair[1] + "Start";
      const b = pair[1] + "End";
      return '<div class="fields time-pair">' +
        '<label class="field">' + pair[0] + '开始<input type="time" name="' + a + '" value="' + periods[a] + '" required></label>' +
        '<label class="field">结束<input type="time" name="' + b + '" aria-label="' + pair[0] + '结束" value="' + periods[b] + '" required></label></div>';
    }).join("");
    showSheet("person", person ? "编辑人物" : "加一个人",
      '<form id="person-form">' +
      '<div class="fields"><label class="field">昵称<input id="nickname" name="nickname" maxlength="24" placeholder="如 阿宁" value="' + escape(person ? person.nickname : "") + '"></label>' +
      '<label class="field">城市<select name="city">' + cityOptions + '</select></label></div>' +
      '<label class="field">备注<input name="note" maxlength="70" placeholder="如 周末有空视频" value="' + escape(person ? person.note : "") + '"></label>' +
      '<details><summary>设置饭点、休息和方便联系的时段</summary>' +
      '<label class="privacy"><input type="checkbox" name="showPeriods"' +
      (!person || person.showPeriods ? " checked" : "") + '> 显示这位的饭点和休息提示</label>' +
      '<p class="hint">开始晚于结束表示跨午夜。相同则关闭该时段。</p>' + inputs + '</details>' +
      '<div class="editor-actions"><button type="submit" class="button primary">保存人物</button>' +
      (person ? button("移除这个人", "remove-person", person.id, "danger") : button("返回", "details", zone)) + '</div></form>');
  }

  function savePerson(form) {
    const group = groupByZone(sheetZone);
    if (!group) return closeSheet();
    const fields = form.elements;
    const existing = group.people.find(person => person.id === sheetPerson);
    const person = {
      id: sheetPerson || newPersonId(),
      nickname: trim(fields.nickname.value, 24), city: trim(fields.city.value, 55), note: trim(fields.note.value, 70),
      showPeriods: fields.showPeriods.checked, periods: {}
    };
    if (!person.nickname && !person.city) person.nickname = "朋友";
    for (const key of Object.keys(MEAL_DEFAULTS)) person.periods[key] = cleanTime(fields[key].value, MEAL_DEFAULTS[key]);
    if (existing) Object.assign(existing, person);
    else group.people.push(person);
    saveSettings();
    showGroup(group.zone);
    flash(existing ? "已更新人物" : "已添加人物");
  }

  function cardParticipants(currentAt, meetingAt) {
    const participants = [];
    for (const group of orderedGroups()) {
      const current = zones.at(currentAt, group.zone);
      const meeting = currentAt === meetingAt ? current : zones.at(meetingAt, group.zone);
      if (!current && !meeting) continue;
      const parts = { current, meeting };
      const location = group.cities[0] || zones.name(group.zone);
      const pinned = group.zone === settings.pinned;
      const namedSelf = pinned && group.people.some(person => person.nickname === "我");
      if (pinned && !namedSelf) {
        participants.push({ key: "self", person: "我", city: location, zone: group.zone, parts, note: "", suggested: true });
      }
      for (const person of group.people) {
        participants.push({
          key: JSON.stringify([group.zone, person.id]),
          person: person.nickname || "朋友",
          city: person.city || location,
          zone: group.zone, parts, note: person.note,
          suggested: pinned && person.nickname === "我"
        });
      }
      if (!pinned && !group.people.length) {
        participants.push({
          key: "guest:" + group.zone, person: location + "的朋友", city: location,
          zone: group.zone, parts, note: "", suggested: true
        });
      }
    }
    return participants;
  }

  function suggestedCardPeople(participants, template) {
    const available = participants.filter(person => person.parts[template] &&
      (template === "current" || mode !== "compare" || !excluded.has(person.zone)));
    const hasSavedPeople = available.some(person => !person.suggested);
    return available.filter(person => person.suggested && (!hasSavedPeople || person.person === "我"))
      .map(person => person.key);
  }

  function cardReference(participants, template, preferredZone, instant) {
    let zone = preferredZone;
    let parts = zones.at(instant, zone);
    if (!parts) {
      const fallback = participants.find(person => person.parts[template]);
      if (!fallback) return null;
      zone = fallback.zone;
      parts = fallback.parts[template];
    }
    const group = groupByZone(zone);
    const name = (group && group.cities[0]) || zones.name(zone);
    return { zone, parts, name };
  }

  async function makeCard() {
    if (mode === "compare" && !validComparison) return;
    const currentAt = Date.now();
    const instant = mode === "compare" ? shownInstant() : currentAt;
    const participants = cardParticipants(currentAt, instant);
    if (!participants.length || !window.TimeCards) return;
    const template = mode === "compare" ? "meeting" : "current";
    const local = zones.at(currentAt, settings.pinned || "UTC") || zones.at(currentAt, "UTC");
    const draft = template === "meeting" ? meetingDraft : null;
    if (draft) meetingDraft = null;
    const stillAvailable = (template, key) => participants.some(person => person.key === key && person.parts[template]);
    cardData = {
      participants, template, instant,
      current: draft ? draft.current.filter(key => stillAvailable("current", key)) :
        suggestedCardPeople(participants, "current").slice(0, 2),
      meeting: draft ? draft.meeting.filter(key => stillAvailable("meeting", key)) : suggestedCardPeople(participants, "meeting"),
      references: {
        current: cardReference(participants, "current", settings.pinned, currentAt),
        meeting: cardReference(participants, "meeting", mode === "compare" ? referenceZone : settings.pinned, instant)
      },
      stamp: dateLabel(local, true) + " " + zones.clock(local) + " " + zones.offsetText(local.offset),
      page: 1, supportReady: false, includeNotes: Boolean(draft && draft.includeNotes),
      message: draft ? draft.message : { current: "", meeting: "这个时间方便吗？" },
      title: draft ? draft.title : { current: "", meeting: "" }
    };
    showSheet("card", "快速制卡",
      '<div class="quick card-templates" aria-label="时间卡模板">' +
      button("当前时刻", "card-template", "current") + button("约时间卡", "card-template", "meeting") +
      '</div><div id="card-meeting-time" class="section-head" hidden><p class="hint" id="card-time-label"></p>' +
      button("改日期和时间", "edit-card-time", "", "small") +
      '</div><label class="field">卡片标题<input id="card-title" maxlength="18"></label>' +
      '<details id="card-settings"><summary id="card-count">选人</summary>' +
      '<p id="card-scope-hint" class="hint"></p><div class="checks card-members" id="card-members"></div></details>' +
      '<details><summary>编辑卡片文字</summary>' +
      '<label class="field">留言<input id="card-message" maxlength="40" placeholder="选填"></label>' +
      '<label class="privacy"><input id="include-notes" type="checkbox"' + (cardData.includeNotes ? " checked" : "") +
      '>带上备注</label></details>' +
      '<div id="card-preview" class="card-preview" aria-label="时间卡预览"></div>' +
      '<div id="card-pager" class="pager"></div>');
    renderCardControls();
    renderCard();
    const current = cardData;
    const support = await Promise.all([platform.has("saveImageToPhotosAlbum", 9420), platform.has("share", 9530), platform.has("postNote")]);
    if (cardData !== current) return;
    byId("card-actions").innerHTML = [
      support[0] ? button("保存这张", "save-card", "", "primary") : "",
      support[1] ? button("分享这张", "share-card") : "",
      support[2] ? button("带图发笔记", "post-card") : ""
    ].join("");
    byId("card-actions").hidden = !support.some(Boolean);
    byId("card-note").hidden = support.some(Boolean);
    cardData.supportReady = true;
    byId("card-footer").hidden = !canvas;
  }

  function selectedCardRows() {
    const template = cardData.template;
    const selected = cardData[template];
    const reference = cardData.references[template];
    return cardData.participants.filter(person => selected.indexOf(person.key) >= 0 && person.parts[template]).map(person => {
      const parts = person.parts[template];
      return {
        person: person.person, city: person.city, time: zones.clock(parts),
        date: dateLabel(parts, true), offset: zones.offsetText(parts.offset), mood: mood(parts),
        difference: person.zone === reference.zone && person.city === reference.name ?
          "基准时间" : difference(parts.offset - reference.parts.offset),
        note: cardData.includeNotes ? person.note : ""
      };
    });
  }

  function renderCardControls() {
    sheetBody.querySelectorAll("[data-action=card-template]").forEach(control =>
      control.setAttribute("aria-pressed", String(control.dataset.value === cardData.template)));
    const template = cardData.template;
    const selected = cardData[template];
    const meeting = template === "meeting";
    byId("card-meeting-time").hidden = !meeting;
    const reference = cardData.references[template];
    byId("card-time-label").textContent = reference ?
      reference.name + " · " + dateLabel(reference.parts, true) + " " + zones.clock(reference.parts) : "";
    byId("card-title").placeholder = CARD_TITLES[template];
    byId("card-title").value = cardData.title[template];
    byId("card-message").value = cardData.message[template];
    byId("card-scope-hint").textContent = meeting ? "每张最多 5 人，更多人会分页。" : "选 1 或 2 人。";
    byId("card-members").innerHTML = cardData.participants.filter(person => person.parts[template]).map(person =>
      '<label><input type="checkbox" value="' + escape(person.key) + '"' +
      (selected.indexOf(person.key) >= 0 ? " checked" : "") + '><span><strong>' +
      escape(person.person) + '</strong><small>' + escape(person.city) + '</small></span></label>').join("");
  }

  function cardTitle() {
    const template = cardData.template;
    return cardData.title[template].trim() || CARD_TITLES[template];
  }

  function cardPage(rows, page) {
    const template = cardData.template;
    const size = template === "current" ? 2 : 5;
    return window.TimeCards.draw(template, rows.slice((page - 1) * size, page * size), {
      title: cardTitle(), message: cardData.message[template], stamp: cardData.stamp,
      reference: "时差以" + cardData.references[template].name + "为准",
      page, total: Math.ceil(rows.length / size)
    });
  }

  function renderCard() {
    const rows = selectedCardRows();
    const total = Math.ceil(rows.length / (cardData.template === "current" ? 2 : 5));
    byId("card-count").textContent = "选人 · 已选 " + rows.length + " 人";
    if (!total) {
      canvas = null;
      byId("card-settings").open = true;
      byId("card-preview").innerHTML = '<p class="hint card-empty">选一位要放到卡片上的人。</p>';
      byId("card-pager").textContent = "";
      byId("card-footer").hidden = true;
      return;
    }
    cardData.page = Math.min(total, Math.max(1, cardData.page));
    try {
      canvas = cardPage(rows, cardData.page);
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "时间卡预览，第 " + cardData.page + " 页");
      byId("card-preview").textContent = "";
      byId("card-preview").appendChild(canvas);
    } catch (error) {
      canvas = null;
      byId("card-preview").textContent = "当前设备暂时无法生成预览。";
    }
    byId("card-footer").hidden = !canvas || !cardData.supportReady;
    byId("card-pager").innerHTML = total > 1 ?
      (cardData.page > 1 ? button("上一张", "card-page", "-1", "small") : "") +
      cardData.page + " / " + total +
      (cardData.page < total ? button("下一张", "card-page", "1", "small") : "") : "";
  }

  async function exportCard(action) {
    if (!canvas || busyCard) return;
    const buttons = sheet.querySelectorAll("button, input");
    busyCard = true;
    buttons.forEach(control => { control.disabled = true; });
    try {
      if (action === "save-card") {
        const result = await platform.saveImage(canvas);
        if (!result || result.errMsg !== "saveImageToPhotosAlbum:ok") throw new Error("相册未确认保存");
        flash("已保存到相册");
      } else if (action === "share-card") {
        await platform.shareImage(canvas);
      } else {
        const rows = selectedCardRows();
        const pages = Math.ceil(rows.length / (cardData.template === "current" ? 2 : 5));
        const pictures = pages <= 18 ?
          Array.from({ length: pages }, (_, page) => page + 1 === cardData.page ? canvas : cardPage(rows, page + 1)) :
          [canvas];
        await platform.openNote(pictures, cardTitle(), cardData.message[cardData.template]);
      }
    } catch (error) {
      const code = Number(error && error.errCode);
      if (action === "share-card" && code === 15502) flash("分享需要在小红书全屏打开。");
      else if (action === "share-card" && code === 15503) flash("今天的分享次数已用完，可以保存到相册。");
      else flash(action === "save-card" ? "保存未完成，请检查相册权限。" : "操作未完成，可以稍后再试。");
    } finally {
      busyCard = false;
      buttons.forEach(control => { control.disabled = false; });
    }
  }

  function flash(message) {
    const toast = byId("toast");
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2700);
  }

  function refreshClock() {
    window.clearTimeout(minuteTimer);
    if (document.hidden) return;
    if (mode === "now") renderClocks();
    minuteTimer = window.setTimeout(refreshClock, MINUTE - Date.now() % MINUTE + 12);
  }

  const actions = {
    details: showGroup,
    "show-cities": () => { searchShown += 10; renderSearch(); },
    "add-location": index => addLocation(searchResults[Number(index)]),
    "pin-zone": zone => { settings.pinned = zone; saveSettings(); showGroup(zone); },
    "move-up": zone => moveGroup(zone, -1),
    "move-down": zone => moveGroup(zone, 1),
    "ask-remove-zone": showRemove,
    "remove-zone": zone => {
      settings.groups = settings.groups.filter(item => item.zone !== zone);
      if (settings.pinned === zone) settings.pinned = settings.groups.length ? settings.groups[0].zone : "";
      excluded.delete(zone);
      saveSettings();
      closeSheet();
    },
    "new-person": zone => showPerson(zone),
    "edit-person": id => showPerson(sheetZone, id),
    "remove-person": id => {
      const group = groupByZone(sheetZone);
      if (!group) return closeSheet();
      group.people = group.people.filter(person => person.id !== id);
      saveSettings();
      showGroup(sheetZone);
    },
    "choose-time": index => {
      const instant = timeChoices[Number(index)];
      if (Number.isFinite(instant)) selectInstant(instant);
    },
    "select-overlap": instant => selectInstant(Number(instant)),
    "edit-card-time": () => {
      const { current, meeting, includeNotes, title, message, instant } = cardData;
      meetingDraft = { current, meeting, includeNotes, title, message };
      if (mode === "now" && groupByZone(settings.pinned)) referenceZone = settings.pinned;
      modifiedAt = Math.floor(instant / MINUTE) * MINUTE;
      closeSheet();
      setMode("compare", false);
      dateInput.focus();
    },
    "card-template": value => {
      cardData.template = value;
      cardData.page = 1;
      renderCardControls();
      renderCard();
    },
    "card-page": value => { cardData.page += Number(value); renderCard(); },
    "save-card": () => exportCard("save-card"),
    "share-card": () => exportCard("share-card"),
    "post-card": () => exportCard("post-card")
  };

  document.addEventListener("click", event => {
    const control = event.target.closest("button");
    if (!control || control.disabled || busyCard) return;
    const action = control.dataset.action;
    if (action && Object.prototype.hasOwnProperty.call(actions, action)) {
      actions[action](control.dataset.value);
    } else if (control.dataset.mode) {
      setMode(control.dataset.mode, false);
    } else if (control.dataset.quick) {
      quickTime(control.dataset.quick);
    }
  });
  byId("add").addEventListener("click", openAdd);
  byId("back-now").addEventListener("click", () => setMode("now", true));
  byId("make-card").addEventListener("click", makeCard);
  byId("close-sheet").addEventListener("click", closeSheet);
  byId("overlay").addEventListener("click", event => { if (event.target === byId("overlay")) closeSheet(); });
  document.addEventListener("keydown", event => {
    if (!sheetType) return;
    if (event.key === "Escape") closeSheet();
    if (event.key === "Tab") {
      const items = Array.from(sheet.querySelectorAll("button, input, select, summary")).filter(control => !control.disabled && control.getClientRects().length);
      const first = items[0];
      const last = items[items.length - 1];
      if (!items.length || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (items.length ? (event.shiftKey ? last : first) : sheet).focus();
      }
    }
  });

  byId("reference").addEventListener("change", event => {
    referenceZone = event.target.value;
    syncComparison();
    renderControls();
    renderClocks();
  });
  byId("comparison-zones").addEventListener("change", event => {
    if (event.target.checked) excluded.delete(event.target.value);
    else excluded.add(event.target.value);
    renderClocks();
    if (byId("overlap").open) renderOverlap();
  });
  byId("overlap").addEventListener("toggle", () => { if (byId("overlap").open) renderOverlap(); });
  byId("clocks").addEventListener("toggle", event => {
    const key = event.target.getAttribute("data-fold");
    if (!key || !document.contains(event.target)) return;
    if (event.target.open) foldedOpen.add(key);
    else foldedOpen.delete(key);
  }, true);
  function updateTimeFromFields() {
    const date = dateInput.value.split("-").map(Number);
    const time = timeInput.value.split(":").map(Number);
    if (!dateInput.validity.valid || !timeInput.validity.valid || date.length !== 3 || time.length !== 2 || date[0] < 1 || date[0] > 9999) {
      clearOptions();
      comparisonIssue("请选择有效的日期和时分。");
      return;
    }
    compareTime({ year: date[0], month: date[1], day: date[2], hour: time[0], minute: time[1] });
  }
  byId("time-form").addEventListener("change", updateTimeFromFields);
  byId("time-form").addEventListener("submit", event => {
    event.preventDefault();
    updateTimeFromFields();
  });

  sheetBody.addEventListener("input", event => {
    const input = event.target;
    if (input.id === "city-search") updateSearch();
    if (!cardData || busyCard) return;
    if (input.id === "card-title") cardData.title[cardData.template] = input.value;
    else if (input.id === "card-message") cardData.message[cardData.template] = input.value;
    else return;
    renderCard();
  });
  sheetBody.addEventListener("change", event => {
    if (!cardData || busyCard) return;
    const input = event.target;
    if (input.id === "include-notes") cardData.includeNotes = input.checked;
    else if (byId("card-members").contains(input)) {
      const selected = cardData[cardData.template];
      if (input.checked && cardData.template === "current" && selected.length >= 2) {
        input.checked = false;
        flash("当前时刻最多选两人，可以先取消一位。");
        return;
      }
      cardData[cardData.template] = input.checked ? selected.concat(input.value) : selected.filter(zone => zone !== input.value);
      cardData.page = 1;
    } else return;
    renderCard();
  });
  sheetBody.addEventListener("submit", event => {
    event.preventDefault();
    if (event.target.id === "person-form") savePerson(event.target);
  });

  function fitSheet() {
    const viewport = window.visualViewport;
    if (viewport) document.documentElement.style.setProperty("--sheet-height", viewport.height + "px");
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    fitSheet();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(platform.refreshInsets, 120);
  });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fitSheet);
  window.addEventListener("pageshow", refreshClock);
  document.addEventListener("visibilitychange", () => {
    refreshClock();
    if (!document.hidden) platform.refreshInsets();
  });
  document.querySelectorAll("[data-mode]").forEach(control => { control.disabled = false; });
  byId("startup-status").hidden = true;
  fitSheet();
  refreshClock();
  platform.refreshInsets();
  restore();
}());
