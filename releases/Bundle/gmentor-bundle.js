{ // === GMENTOR-BUNDLE-START ===
// Bundle version: 1.1.1

(function () {
  window.gcReRunHooks = window.gcReRunHooks || [];
  if (window.__gcBundleEvaled) {
    // Fast-path: bundle уже инициализирован, гоняем только re-run hooks.
    for (var i = 0; i < window.gcReRunHooks.length; i++) {
      try { window.gcReRunHooks[i](); }
      catch (e) { if (window.console) console.warn("[gc-bundle] reRunHook[" + i + "] err", e); }
    }
    return;
  }
  window.__gcBundleEvaled = true;
  // ----- First-time init: setup-only IIFE сниппетов ниже -----

// ----- GC-TOGGLER (runtime) -----
try {
// Централизованный enable/disable для сниппетов. Подключать ПЕРВЫМ в <gc-script>. (v1.1.0)
/* Что делает: читает <gc-disabled-snippets> (base64 JSON-массив id групп),
   ставит window.GC_DISABLED_SNIPPETS — это видят guard'ы в остальных сниппетах
   и пропускают свою инициализацию.

   Хранение состояния: тег <gc-disabled-snippets> внутри <char-xml>.
   UI для on/off — в отдельном сниппете gc-toggler-ui.js.

   Экспорт window.gcToggler:
     getGroups()              → копия registry групп
     isDisabled(snippetId)    → boolean
     isGroupDisabled(groupId) → boolean
     getDisabledGroups()      → string[]
     setDisabledGroups(ids)   → нормализует через requires-cascade и сохраняет

   Cascade-логика requires: disable группы A автоматически выключает все группы,
   у которых эта A прописана в requires (например disable engine-fixes
   выключит hit-locations, т.к. он зависит от фиксов).

   Подключать ПЕРВЫМ! Должен инициализировать GC_DISABLED_SNIPPETS до того
   как остальные сниппеты дойдут до своих guard'ов, иначе 0 смысла. */

(function () {
  if (typeof gm !== "function" || typeof globalChar === "undefined") return;
  if (window.gcToggler && window.gcToggler.__bound) return;

  /* Реестр групп сниппетов — ТОЛЬКО структура (связи), без описаний.
     label/desc/category каждого сниппета регистрирует САМ сниппет в
     window.gcSnippetMeta[snippetId]; UI домержит их по snippets[0].
     requires — id групп, без которых эта не работает (cascade).
     parent   — UI-вложение (только визуально, отступ в checkbox-list). */
  var GROUPS = {
    "engine-fixes":   { snippets: ["fix-multiply-zero"], requires: [],               parent: null },
    "hit-locations":  { snippets: ["hit-locations"],     requires: ["engine-fixes"], parent: null },
    "dr-inheritance": { snippets: ["dr-inheritance"],    requires: [],               parent: "hit-locations" }, // hit-locations нужен для смысла, но noop без него — не блокируем
    "perks":          { snippets: ["strong-back"],       requires: [],               parent: null },
    "qol":            { snippets: ["ace-fold-all"],      requires: [],               parent: null },
    "dmg-scale":      { snippets: ["dmg-scale"],         requires: [],               parent: null },
    "cf-mod":         { snippets: ["cf-mod"],            requires: [],               parent: null },
    "spell-attr":     { snippets: ["spell-attr"],        requires: [],               parent: null },
    // SCAFFOLD-GROUP-ANCHOR
  };

  function loadDisabledGroups() {
    var $tag = gm("gc-disabled-snippets");
    if (!$tag.length) return [];
    var txt = String($tag.text() || "").trim();
    if (!txt) return [];
    try {
      var parsed = JSON.parse(base64_to_utf8(txt));
      return Array.isArray(parsed) ? parsed.filter(function (id) { return id in GROUPS; }) : [];
    } catch (e) {
      console.warn("[gc-toggler] failed to parse <gc-disabled-snippets>:", e);
      return [];
    }
  }

  function saveDisabledGroups(ids) {
    var $tag = gm("gc-disabled-snippets");
    if (!$tag.length) $tag = $("<gc-disabled-snippets></gc-disabled-snippets>").appendTo(globalChar);
    $tag.text(utf8_to_base64(JSON.stringify(ids)));
  }

  function resolveSnippets(disabledGroupIds) {
    var disabled = new Set();
    disabledGroupIds.forEach(function (gid) {
      var g = GROUPS[gid];
      if (g) g.snippets.forEach(function (s) { disabled.add(s); });
    });
    return disabled;
  }

  function normalizeCascade(requestedDisabled) {
    var disabled = new Set(requestedDisabled);
    var changed = true;
    var safety = 10;
    while (changed && safety-- > 0) {
      changed = false;
      Object.keys(GROUPS).forEach(function (gid) {
        var g = GROUPS[gid];
        for (var i = 0; i < g.requires.length; i++) {
          if (disabled.has(g.requires[i]) && !disabled.has(gid)) {
            disabled.add(gid);
            changed = true;
            break;
          }
        }
      });
    }
    return Array.from(disabled).sort();
  }

  function cleanupForDisabled(groupId) {
    return cleanupLegacy(groupId);
  }
  /* Некст функция - один огромный задел на будущее, когда копытца дойдут.
     Знаю, что забуду о ней, поэтому и не комменчу. */
  function cleanupLegacy(_groupId) {
    var changed = false;

    try {
      var $cl = gm("gc-custom-locations");
      if ($cl.length) {
        var txt = String($cl.text() || "").trim();
        if (txt) {
          var list = JSON.parse(base64_to_utf8(txt));
          if (Array.isArray(list) && list.some(function (l) { return l && l.__race; })) {
            var filtered = list.filter(function (l) { return !l.__race; });
            $cl.text(utf8_to_base64(JSON.stringify(filtered)));
            changed = true;
          }
        }
      }
    } catch (e) { console.warn("[gc-toggler] cleanup gc-custom-locations:", e); }

    var $tpl = gm("advantage_list > advantage_container[data-race-template]");
    if ($tpl.length) { $tpl.remove(); changed = true; }

    var $race = gm("profile race");
    if ($race.length && !$race.hasClass("editable")) {
      $race.addClass("editable editable-locked");
      changed = true;
    }
    if ($race.length && $race.attr("style")) {
      $race.removeAttr("style");
      changed = true;
    }

    if (changed && typeof saveButtonEnable === "function") saveButtonEnable();
    return changed;
  }

  function syncCharXmlClasses() {
    if (!globalChar || !globalChar.length) return;
    var el = globalChar[0];
    Object.keys(GROUPS).forEach(function (gid) {
      var cls = "gc-" + gid + "-enabled";
      if (currentDisabledGroups.indexOf(gid) !== -1) {
        el.classList.remove(cls);
      } else {
        el.classList.add(cls);
      }
    });
  }


  if (window.gcInternal && window.gcInternal.patched.gcToggler) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  window.gcInternal.patched.gcToggler = true;

  var currentDisabledGroups = loadDisabledGroups();
  var currentDisabledSet = resolveSnippets(currentDisabledGroups);
  window.GC_DISABLED_SNIPPETS = currentDisabledSet;

  syncCharXmlClasses();

  currentDisabledGroups.forEach(function (gid) { cleanupForDisabled(gid); });
  try { cleanupLegacy(null); } catch (e) { console.warn("[gc-toggler] legacy cleanup at init:", e); }

  if (window.gcReRunHooks) {
    window.gcReRunHooks.push(function () {
      syncCharXmlClasses();
      currentDisabledGroups.forEach(function (gid) { cleanupForDisabled(gid); });
    });
  }


  window.gcToggler = {
    __bound: true,
    getGroups: function () {
      var copy = {};
      Object.keys(GROUPS).forEach(function (k) {
        var g = GROUPS[k];
        copy[k] = { snippets: g.snippets.slice(), requires: g.requires.slice(), parent: g.parent || null };
      });
      return copy;
    },
    isDisabled: function (snippetId) {
      return currentDisabledSet.has(snippetId);
    },
    isGroupDisabled: function (groupId) {
      return currentDisabledGroups.indexOf(groupId) !== -1;
    },
    getDisabledGroups: function () {
      return currentDisabledGroups.slice();
    },
    setDisabledGroups: function (ids, opts) {
      opts = opts || {};
      var normalized = normalizeCascade(ids);
      saveDisabledGroups(normalized);
      currentDisabledGroups = normalized;
      currentDisabledSet = resolveSnippets(normalized);
      window.GC_DISABLED_SNIPPETS = currentDisabledSet;
      syncCharXmlClasses();
      if (typeof saveButtonEnable === "function") saveButtonEnable();
      if (opts.save && typeof saveCurrentChar === "function") saveCurrentChar();
      return normalized;
    },
    normalizeCascade: normalizeCascade,
    cleanupForDisabled: cleanupForDisabled
  };
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "GC-TOGGLER (runtime)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "GC-TOGGLER (runtime)" + "]", gcErr);
}

// ----- GC-UTILS (системные хелперы) -----
try {
// Системный сниппет с общими хелперами для остальных. Подключать ВТОРЫМ. (v1.1.1)
/* Что делает: экспортирует window.gcUtils и инициализирует общие namespace'ы.
   Все остальные сниппеты опираются на это — без gc-utils они упадут.

   Экспорт window.gcUtils:
     STD_ZONE_CODES                 — массив стандартных кодов зон.
     gcLog(level, msg[, err])       — console + window.gcErrors[].
     loadBase64Slot(tagName)        — JSON.parse(base64) из <tagName> слота.
     saveBase64Slot(tagName, value) — обратное (создаёт слот если нет).

   Инициализирует:
     window.gcInternal = { patched: {}, bound: {} } — единый namespace для
                                                      guard-флагов сниппетов.
     window.gcErrors   = []                          — runtime ошибки сниппетов.

   У этого сниппета НЕТ guard на GC_DISABLED_SNIPPETS — он системный.
   Подключать вторым после gc-toggler. */

(function () {
  if (window.gcUtils) return;

  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  window.gcErrors = window.gcErrors || [];

  var STD_ZONE_CODES = [
    "skull", "face", "eyes", "neck", "torso", "groin", "vitals",
    "arms", "hands", "legs", "feet",
    "shoulders", "thighs", "shins", "knees", "abdomen",
    "ear", "nose", "jaw"
  ];

  function gcLog(level, msg, err) {
    var L = (level === "error" || level === "warn" || level === "info") ? level : "log";
    if (window.console && typeof console[L] === "function") {
      if (err !== undefined) console[L]("[gc]", msg, err);
      else console[L]("[gc]", msg);
    }
    if (L === "error" || L === "warn") {
      window.gcErrors.push({
        level: L,
        msg: String(msg),
        err: err && err.stack ? err.stack : (err ? String(err) : null),
        at: Date.now()
      });
    }
  }

  function loadBase64Slot(tagName) {
    if (typeof gm !== "function") return null;
    var $slot = gm(tagName);
    if (!$slot.length) return null;
    var txt = String($slot.text() || "").trim();
    if (!txt) return null;
    try {
      var json = (typeof base64_to_utf8 === "function") ? base64_to_utf8(txt) : atob(txt);
      return JSON.parse(json);
    } catch (e) {
      gcLog("warn", "loadBase64Slot('" + tagName + "') parse failed", e);
      return null;
    }
  }

  function saveBase64Slot(tagName, value) {
    if (typeof gm !== "function") return;
    var $slot = gm(tagName);
    if (!$slot.length) {
      if (typeof globalChar === "undefined" || !globalChar.length) return;
      $slot = $("<" + tagName + "></" + tagName + ">").appendTo(globalChar);
    }
    try {
      var json = JSON.stringify(value);
      var enc = (typeof utf8_to_base64 === "function") ? utf8_to_base64(json) : btoa(json);
      $slot.text(enc);
    } catch (e) {
      gcLog("warn", "saveBase64Slot('" + tagName + "') failed", e);
    }
  }

  window.gcUtils = {
    STD_ZONE_CODES: STD_ZONE_CODES,
    gcLog: gcLog,
    loadBase64Slot: loadBase64Slot,
    saveBase64Slot: saveBase64Slot
  };
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "GC-UTILS (системные хелперы)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "GC-UTILS (системные хелперы)" + "]", gcErr);
}

// ----- FIX-MULTIPLY-ZERO -----
try {
// Сниппет-фикс бага движка с multiply-модификаторами. (v1.1.1)
/* Что делает: когда у advantage/effect приходит multiply-модификатор
   со значением 0 (например levels=0 при формуле DR = base * levels),
   движок возвращает строку "N*0" вместо 0. Дальше parseFloat читает
   только первый множитель → DR/HP/FP получают мусор (1 вместо 0).
   Хз почему аффтор Ментора заранее так не сделал, правлю за него.
   Не было бы этой микро-проблемы — всё бы нормально работало.

   Патчит два места:
     - window.modifyField — главный источник, нормализует "N*0" → 0.
     - charCalcDR — подчищает stale "N*0" в <dr>-тегах локаций,
       которые могли остаться с прошлой сессии до подключения фикса.

   Независим от других сниппетов. */

(function () {
  (window.gcSnippetMeta = window.gcSnippetMeta || {})["fix-multiply-zero"] = {
    label: "Фиксы движка",
    desc: "Обход бага modifyField(N, 0, multiply...) → строка \"N*0\" вместо 0. " +
          "Без него ломаются DR/HP/FP-множители. Содержит: fix-multiply-zero.",
    category: "fix"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("fix-multiply-zero")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  if (!gi.patched.modifyField && typeof window.modifyField === "function") {
    gi.patched.modifyField = true;
    var _orig = window.modifyField;
    window.modifyField = function (src, mod, type) {
      if (type === "multiply" || type === "multiply round" || type === "multiply floor" || type === "multiply ceil") {
        if (parseFloat(src) === 0 || parseFloat(mod) === 0 || mod === 0 || mod === "0") return 0;
      }
      var res = _orig.apply(this, arguments);
      // Подстраховка. Лучше перебздеть чем недобздеть.
      if (typeof res === "string" && res.indexOf("*") !== -1) {
        var p = res.split("*");
        if (parseFloat(p[0]) === 0 || parseFloat(p[1]) === 0) return 0;
      }
      return res;
    };
  }

  if (!gi.patched.drStar && typeof window.charCalcDR === "function") {
    gi.patched.drStar = true;
    var _origCalcDR = window.charCalcDR;
    window.charCalcDR = function () {
      var res = _origCalcDR.apply(this, arguments);
      try {
        gm("locations-list").find("dr").each(function () {
          var t = $(this).text();
          if (t.indexOf("*") === -1) return;
          var p = t.split("*");
          if (parseFloat(p[0]) === 0 || parseFloat(p[1]) === 0) $(this).text("0");
        });
      } catch (e) {}
      return res;
    };
  }

  // Форс одноразового calcAll при загрузке, чтобы перетереть stale значения.
  if (!gi.bound.initCalc && typeof calcAll === "function") {
    gi.bound.initCalc = true;
    setTimeout(calcAll);
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "FIX-MULTIPLY-ZERO",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "FIX-MULTIPLY-ZERO" + "]", gcErr);
}

// ----- HIT-LOCATIONS -----
try {
// Сниппет кастомных зон попаданий + UI-редактор «⚔ Зоны». (v1.1.1)
/* Что делает: позволяет переименовывать штатные зоны попаданий, править
   to-hit / базовый DR, удобнее добавлять свои зоны и вложения, 
   переписывать 3d6-таблицу случайного попадания, задавать тултипы и таблицы
   1d6-подлокаций (для sub-location).

   UI: кнопка «⚔ Зоны» в edit-mode тулбаре, рядом с </> — открывает
   модалку с редактором всех зон. Список хранится в <gc-custom-locations>
   (base64-JSON, записи вида {code, name, toHit, roll, custom, dr, hint,
   parent, isParent, subTable, noInheritDR}).

   Зависимости:
     fix-multiply-zero.js  — подключать РАНЬШЕ (иначе stale "N*0" в <dr> на
                             первом рендере не успеет нормализоваться).
     hit-locations.less    — стили модалки и разметка вложенных локаций.
     dr-inheritance.js     — ОБЯЗАТЕЛЬНО ПОСЛЕ при использовании иерархии
                             parent / custom-зон. Без него DR родителей не
                             каскадится в подзоны => атаки игнорирят броню. */
(function () {
  (window.gcSnippetMeta = window.gcSnippetMeta || {})["hit-locations"] = {
    label: "Зоны попадания",
    desc: "Кастомные зоны hit-locations: переименование, custom DR/toHit, " +
          "3d6-таблица random hit, тултипы. UI-кнопка «⚔ Зоны».",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("hit-locations")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;
  if (gi.patched.hitLocations) return;
  gi.patched.hitLocations = true;

  var DEFAULT_LIST = [];
  var HIT_LOCATIONS = loadFromXml() || DEFAULT_LIST;
  var ACTIVE_LIST = HIT_LOCATIONS;

  patchCharCalcDR();
  applyAll(HIT_LOCATIONS);
  mountHitLocationsUI();

  if (!gi.bound.hlDelegate) {
    gi.bound.hlDelegate = true;
    $(document)
      .off('.gcHl')
      .on('mouseenter.gcHl', 'location[data-hint]', function () {
        $(this).parents('location[data-hint]').addClass('gc-child-hover');
      })
      .on('mouseleave.gcHl', 'location[data-hint]', function () {
        $(this).parents('location[data-hint]').removeClass('gc-child-hover');
      });
  }

  window.gcReRunHooks.push(function () {
    if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("hit-locations")) return;
    var freshList = loadFromXml() || DEFAULT_LIST;
    HIT_LOCATIONS = freshList;
    applyAll(freshList);
  });
  
  function applyAll(list) {
    ACTIVE_LIST = list;
    patchLocationHint(list);
    patchRandomLocation(list);
    exportLocationsList(list);
    if (typeof window.charCalcDR === "function") {
      try { window.charCalcDR(); } catch (e) {}
    }
    ensureSubzonePositioning();
  }

  function ensureSubzonePositioning() {
    var $ll = gm("locations-list");
    if (!$ll.length) return;
    $ll.find("location > location").each(function () {
      if (this.style.position !== "relative") this.style.position = "relative";
    });
  }

  function exportLocationsList(list) {
    window.GC_HIT_LOCATIONS_LIST = list;
  }

  function updateLocationAttributes(list) {
    var $ll = gm("locations-list");
    if (!$ll.length) return;
    
    var show = localStorage.getItem("gcHlShowSubMeta") === "yes" ? "yes" : "no";
    if ($ll.attr('data-show-meta') !== show) $ll.attr('data-show-meta', show);

    list.forEach(function (loc) {
      var $node = $ll.find("location[name='" + loc.code + "']");
      if (!$node.length) return;
      
      var n = loc.name;
      if (!n && loc.custom) n = loc.code;
      
      if (n) { if ($node.attr('data-name') !== n) $node.attr('data-name', n); }
      else { if ($node.attr('data-name') !== undefined) $node.removeAttr('data-name'); }
      
      var h = loc.hint || "";
      if (h) { if ($node.attr('data-hint') !== h) $node.attr('data-hint', h); }
      else { if ($node.attr('data-hint') !== undefined) $node.removeAttr('data-hint'); }
    });
  }

  function patchCharCalcDR() {
    if (gi.patched.locDR || typeof window.charCalcDR !== "function") return;
    gi.patched.locDR = true;
    var _orig = window.charCalcDR;
    window.charCalcDR = function () {
      if (window.__gcLock) return _orig.apply(this, arguments);
      window.__gcLock = true;
      try {
        var $ll = gm("locations-list");
        var savedParents = {};
        $ll.find("location > location").each(function () {
          var code = $(this).attr("name");
          var pCode = $(this).parent().attr("name");
          if (code && pCode) savedParents[code] = pCode;
        }).appendTo($ll);
        var r = _orig.apply(this, arguments);
        try {
          $ll.find("dr").each(function () {
            var t = $(this).text();
            if (t.indexOf("*") === -1) return;
            var p = t.split("*");
            if (parseFloat(p[0]) === 0 || parseFloat(p[1]) === 0) $(this).text("0");
          });
          applyCustomLocations(ACTIVE_LIST);
          applyToHitAndRoll(ACTIVE_LIST);
          addBaseDR(ACTIVE_LIST);
          updateLocationAttributes(ACTIVE_LIST);
          var listed = {};
          ACTIVE_LIST.forEach(function (l) { listed[l.code] = true; });
          Object.keys(savedParents).forEach(function (code) {
            if (listed[code]) return;
            var $node = $ll.children("location[name='" + code + "']");
            if (!$node.length) return;
            var $parent = $ll.find("location[name='" + savedParents[code] + "']").first();
            if ($parent.length) $parent.append($node);
          });
        } catch (e) {}
        return r;
      } finally {
        window.__gcLock = false;
      }
    };
  }

  function applyCustomLocations(list) {
    var $ll = gm("locations-list"); if (!$ll.length) return;
    list.forEach(function (loc) {
      var $node = $ll.find("location[name='" + loc.code + "']");
      if (!$node.length && loc.custom) {
        var $new = $("<location>").attr("name", loc.code).addClass("custom-location")
          .append($("<dr>").text("0"))
          .append($("<to-hit>").text(String(loc.toHit == null ? 0 : loc.toHit)));
        if (loc.roll) $new.append($("<roll>").text(loc.roll.join(" ")));
        $ll.append($new);
        $node = $new;
      }
      if ($node.length) {
        var targetParent = loc.parent ? $ll.find("location[name='" + loc.parent + "']") : $ll;
        if (targetParent.length && $node.parent()[0] !== targetParent[0]) targetParent.append($node);
      }
    });
  }

  function applyToHitAndRoll(list) {
    var $ll = gm("locations-list"); if (!$ll.length) return;
    list.forEach(function (loc) {
      var $node = $ll.find("location[name='" + loc.code + "']");
      if (!$node.length) return;
      if (loc.toHit !== undefined) setChild($node, "to-hit", loc.toHit);
      if (loc.roll !== undefined) setChild($node, "roll", Array.isArray(loc.roll) ? loc.roll.join(" ") : (loc.roll || ""));
    });
  }

  function addBaseDR(list) {
    var $ll = gm("locations-list"); if (!$ll.length) return;
    list.forEach(function (loc) {
      if (loc.dr == null) return;
      var add = +loc.dr;
      if (!add) return;
      var $node = $ll.find("location[name='" + loc.code + "']");
      if (!$node.length) return;
      $node.find("> dr").each(function() {
         var cur = parseFloat($(this).text()) || 0;
         $(this).text(cur + add);
      });
    });
  }

  function setChild($node, tag, val) {
    var $c = $node.children(tag);
    var s = String(val === null || val === undefined ? "" : val);
    if ($c.length) { if ($c.text() !== s) $c.text(s); }
    else { $node.append("<" + tag + ">" + s + "</" + tag + ">"); }
  }

  function loadFromXml() {
    var $slot = gm("gc-custom-locations");
    if (!$slot.length) return null;
    var raw = $slot.text();
    if (!raw) return [];
    try {
      var json = (typeof base64_to_utf8 === "function") ? base64_to_utf8(raw) : atob(raw);
      return JSON.parse(json) || [];
    } catch (e) { return []; }
  }

  function saveToXml(list) {
    var $char = gm();
    var $slot = gm("gc-custom-locations");
    if (!$slot.length) {
      $char.append("<gc-custom-locations></gc-custom-locations>");
      $slot = gm("gc-custom-locations");
    }
    var json = JSON.stringify(list || []);
    var enc = (typeof utf8_to_base64 === "function") ? utf8_to_base64(json) : btoa(json);
    $slot.text(enc);
    if (typeof saveButtonEnable === "function") saveButtonEnable();
    if (typeof calcAll === "function") calcAll();
  }

  function patchToolsLocationsSelectTemplate(list) {
    if (typeof window.toolsLocationsSelect !== "string") return;
    if (!window.__gcLocTplOrig) window.__gcLocTplOrig = window.toolsLocationsSelect;
    var tpl = window.__gcLocTplOrig;
    list.forEach(function (loc) {
      if (loc.custom) return;
      var re = new RegExp("(<option\\s+value=\")(-?\\d+)(\"\\s+location=\"" + loc.code + "\"[^>]*>)([^<]*)(</option>)", "g");
      tpl = tpl.replace(re, function (_, a, oldVal, b, oldText, c) {
        var v = (loc.toHit != null) ? String(loc.toHit) : oldVal;
        var t = (loc.name  != null) ? loc.name : oldText;
        if (loc.name != null && !/\(-?\d+\)\s*$/.test(t)) t = t + " (" + v + ")";
        return a + v + b + t + c;
      });
    });
    var custom = "";
    list.forEach(function (loc) {
      if (!loc.custom) return;
      var has = new RegExp('location="' + loc.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"(?:\\s|>)').test(tpl);
      if (has) return;
      var th = loc.toHit != null ? loc.toHit : 0;
      custom += "\n    <option value=\"" + th + "\" location=\"" + loc.code + "\" class=\"custom-location\">" + (loc.name || loc.code) + " (" + th + ")</option>";
    });
    if (custom) tpl = tpl.replace(/<\/select>/i, custom + "\n</select>");
    window.toolsLocationsSelect = tpl;
  }

  function patchLocationHint(list) {
    if (gi.patched.locHint) { window.__gcLocHintList = list; return; }
    gi.patched.locHint = true;
    window.__gcLocHintList = list;
    var orig = window.toolLocationHint;
    window.toolLocationHint = function (obj) {
      var $hints = $("modalpopup .location-hints, .tool-popup .location-hints").first();
      if ($hints.length) {
        (window.__gcLocHintList || []).forEach(function (loc) {
          if (!loc.hint) return;
          var cls = "location-note-" + loc.code;
          if (!$hints.find("." + cls).length) $("<span style='display:none'></span>").addClass(cls).text(loc.hint).appendTo($hints);
        });
      }
      return orig ? orig.apply(this, arguments) : undefined;
    };
  }

  function defaultLocationForRoll(r) {
    var rl = Math.random() > 0.5 ? "/l" : "/r";
    if (r <= 4)  return "skull";
    if (r === 5) return "face";
    if (r <= 7)  return "legs/r";
    if (r === 8) return "arms/r";
    if (r <= 10) return "torso";
    if (r === 11) return "groin";
    if (r === 12) return "arms/l";
    if (r <= 14) return "legs/l";
    if (r === 15) return "hands" + rl;
    if (r === 16) return "feet" + rl;
    return "neck";
  }

  function patchRandomLocation(list) {
    if (!gi.patched.getRandomLocation) {
      gi.patched.getRandomLocation = true;
      var fn = function () {
        var r = 0; for (var i = 0; i < 3; i++) r += 1 + Math.floor(Math.random() * 6);
        var ov = window.__gcLocRolls || {};
        if (ov[r]) return ov[r];
        return defaultLocationForRoll(r);
      };
      var s = window.__gcRandOrig;
      if (s && typeof s.getRandomLocation === 'function') s.getRandomLocation = fn;
      else window.getRandomLocation = fn;
    }
    window.__gcLocRolls = {};
    list.forEach(function (l) {
      if (l.roll) l.roll.forEach(function (n) { window.__gcLocRolls[n] = l.code; });
    });
  }

  function mountHitLocationsUI() {
    if (document.getElementById("gc-hit-locations-btn")) return;
    var $scriptBtn = $('button[onclick*="changeCustomJs"]');
    if (!$scriptBtn.length) return;
    var $btn = $("<button id='gc-hit-locations-btn' class='secondary hide-in-template-mode' title='Зоны попаданий' style='margin-left:5px;'><i class='fa fa-shield'></i> Зоны</button>");
    $btn.on("click", openHitLocationsEditor);
    $scriptBtn.parent().append($btn);
  }

  function openHitLocationsEditor() {
    var list = JSON.parse(JSON.stringify(HIT_LOCATIONS)); 
    var openZones = new Set();
    var $wrapper = $("<div class='mentor'><char-xml class='gc-hit-locations-enabled' style='display:block;'></char-xml></div>");
    var $container = $("<div class='gc-hl'></div>");
    $wrapper.find('char-xml').append($container);
    
    var $topPanel = $("<div class='editor-toolbar' style='overflow:hidden;'></div>").appendTo($container);
    $topPanel.append("<h2 style='float:left; margin:0; border:none;'>Редактор зон попаданий</h2>");
    $("<button style='float:right;'>Документация</button>").on("click", function() { $container.find('help').toggleClass('expand'); }).appendTo($topPanel);
    var $help = $("<help></help>").html(`<div><h2>Как это работает:</h2>• Для <b>правки</b> стандартной зоны впишите её Код (ID) и добавьте нужные поля через меню <b>+</b>.<br>• Для <b>создания</b> новой зоны нажмите кнопку внизу списка и включите <b>Новая зона</b>.<br>• <b>Родитель (ID)</b> — ID зоны, внутрь которой будет вложена текущая.<br>• <b>Является родителем</b> — помечает зону как контейнер для других подлокаций.</div><div><h3>Стандартные коды зон:</h3>skull, face, eyes, neck, torso, groin, arms, hands, legs, feet</div><div><h3>Подлокации:</h3><b>arms</b>: shoulders, upper arms, elbows, forearms<br><b>legs</b>: thighs, knees, shins<br><b>torso</b>: chest, abdomen</div><div><h3>Подлокации (1d6):</h3>Поле <b>Подлокации (1d6)</b> — справочная таблица 1d6 у зоны: каждая из 6 ячеек — либо ссылка на дочернюю зону (с тем же <b>Родителем</b>), либо свободный ввод (имя/DR/hint). Кнопка <b>+</b> справа создаёт новую дочернюю custom-зону и сразу привязывает её к ячейке. В бросок атаки эти таблицы сейчас не подставляются: доп. бросок 1d6 на подлокацию делает all-сниппет «Подлокации» (вкладка «Все листы») по своим таблицам — LT100 либо настраиваемым в его меню.</div><div><h3>Специфические коды:</h3>vitals, spine, ear, jaw, nose, wings, tail, weapon, bigjoint, smalljoint, limbvenus, neckvenus</div><div style="margin-bottom:20px; padding:12px; background:rgba(66,139,202,0.1); border-radius:6px; border:1px solid rgba(66,139,202,0.2);"><label style="cursor:pointer; display:flex; align-items:center; gap:10px; margin:0;"><input type="checkbox" id="gc-hl-show-sub-meta" ${localStorage.getItem("gcHlShowSubMeta") === "yes" ? "checked" : ""} style="margin:0; width:16px; height:16px;"><b style="font-size:13px;">Показывать параметры подлокаций на листе</b></label></div>`).appendTo($container);

    $container.find("#gc-hl-show-sub-meta").on("change", function() {
      localStorage.setItem("gcHlShowSubMeta", this.checked ? "yes" : "no");
      if (typeof window.charCalcDR === "function") window.charCalcDR(); 
    });
    var $listWrap = $("<div class='zones-list-wrapper' style='margin-top:20px;'></div>").appendTo($container);
    var SCHEMA = {
      "name":     { loc: "Название", icon: "fa-tag" },
      "toHit":    { loc: "Штраф", icon: "fa-crosshairs", type: "number" },
      "roll":     { loc: "Броски (3d6)", icon: "fa-random" },
      "dr":       { loc: "Базовый DR", icon: "fa-shield", type: "number" },
      "parent":   { loc: "Родитель (ID)", icon: "fa-level-up" },
      "isParent": { loc: "Является родителем", icon: "fa-sitemap" },
      "custom":   { loc: "Новая зона", icon: "fa-check-square" },
      "hint":     { loc: "Описание", icon: "fa-file-text-o" },
      "subTable": { loc: "Подлокации (1d6)", icon: "fa-th-list", type: "subtable" },
      "noInheritDR": { loc: "Не наследовать DR родителя", icon: "fa-unlink" }
    };

    if (typeof modalPopup === "function") {
      modalPopup($wrapper, 'Применить', 'Отмена', function () {
        HIT_LOCATIONS = list; saveToXml(list); applyAll(list);
      }, function() {
        applyAll(HIT_LOCATIONS);
      });
      render();
    }

    function render() {
      $listWrap.empty();
      list.forEach(function(loc, idx) {
        var $zone = $("<div class='zone-block'></div>").appendTo($listWrap);
        var isOpen = openZones.has(loc.code);
        var $header = $(`<div class='zone-header'><i class="fa fa-caret-${isOpen ? 'down' : 'right'}" style="margin-right:12px; color:#ccc"></i><span class='zone-name'></span><div class='node-actions'><i class="fa fa-plus-circle" title="Добавить поле"></i><i class="fa fa-trash" title="Удалить зону"></i></div></div>`).appendTo($zone);
        $header.find('.zone-name').text(loc.name || loc.code || 'Без названия');
        $header.on("click", function(e) {
          if ($(e.target).hasClass('fa-plus-circle')) { showAddMenu($(e.target), idx); e.stopPropagation(); return; }
          if ($(e.target).hasClass('fa-trash')) { if(confirm("Удалить зону?")) { openZones.delete(loc.code); list.splice(idx, 1); render(); } e.stopPropagation(); return; }
          isOpen = !isOpen; if (isOpen) openZones.add(loc.code); else openZones.delete(loc.code); render();
        });
        if (isOpen) {
          var $body = $("<div class='zone-body'></div>").appendTo($zone);
          renderLine($body, idx, "Код (ID)", loc.code, "code", true);
          Object.keys(SCHEMA).forEach(function(key) {
            if (loc[key] !== undefined) {
              var val = loc[key];
              if (key === "roll" && Array.isArray(val)) val = val.join(", ");
              if ((key === "isParent" || key === "custom" || key === "noInheritDR") && val === true) val = "Да";
              renderLine($body, idx, SCHEMA[key].loc, val, key);
            }
          });
        }
      });
      $("<div style='text-align:center; padding:10px;'><button>+ Создать новую зону</button></div>").on("click", function() {
          var nextId = 1; while(list.some(l => l.code === "custom_" + nextId)) nextId++;
          var newCode = "custom_" + nextId;
          list.push({ code: newCode, custom: true, dr: 0 }); openZones.add(newCode); render();
      }).appendTo($listWrap);
    }

    function renderLine($container, idx, label, val, key, fixed) {
      var $line = $("<line></line>").appendTo($container);
      $line.append(`<span>${label}</span>`);
      if (SCHEMA[key] && SCHEMA[key].type === "subtable") {
        $line.addClass("subtable-line");
        renderSubTable($line, idx);
      } else if (SCHEMA[key] && SCHEMA[key].type === "number") {
        var $spinWrap = $("<div class='spinner-wrap'></div>").appendTo($line);
        $("<i class='fa fa-minus-circle spin-btn'></i>").on("click", function() { updateValue(idx, key, (list[idx][key] || 0) - 1); render(); }).appendTo($spinWrap);
        $("<input type='text' class='num-input inline-edit' style='width:50px; text-align:center;'>").val(val).on("change", function() { updateValue(idx, key, $(this).val()); render(); }).appendTo($spinWrap);
        $("<i class='fa fa-plus-circle spin-btn'></i>").on("click", function() { updateValue(idx, key, (list[idx][key] || 0) + 1); render(); }).appendTo($spinWrap);
      } else {
        $("<input type='text' class='inline-edit' placeholder=''>").val(val).on("change", function() { updateValue(idx, key, $(this).val()); if(key === "name" || key === "code") render(); }).appendTo($line);
      }
      if (!fixed) {
        $(`<div class='node-actions'><i class="fa fa-times" title="Убрать поле"></i></div>`).on("click", function() { deleteField(idx, key); render(); }).appendTo($line);
      }
    }

    /* 6 строк (роллы 1..6). Каждая ячейка subTable хранит:
         - string — code дочерней зоны (name/dr/hint берутся из неё);
         - object {name, dr?, hint?} — свободный ввод.
       Режим выбирается select'ом: «—», «✏ Свой ввод» или «<подзона>».
       Кнопка + рядом создаст новую custom зону с parent = код текущей
       и сразу привязать её к этой ячейке. */
    function renderSubTable($parent, idx) {
      var loc = list[idx];
      var sub = loc.subTable || {};
      var children = list.filter(function (z) { return z.parent === loc.code && z.code !== loc.code; });

      var $wrap = $("<div class='subtable-wrap'></div>").appendTo($parent);
      $("<div class='subtable-head'><span></span><span>Подзона / режим</span><span>Значение</span><span></span></div>").appendTo($wrap);

      for (var r = 1; r <= 6; r++) (function (roll) {
        var cell = sub[roll];
        var mode = "none";
        if (typeof cell === "string" && cell) mode = "ref";
        else if (cell && typeof cell === "object") mode = "custom";

        var $row = $("<div class='subtable-row'></div>").appendTo($wrap);
        $("<span class='subtable-roll'>" + roll + "</span>").appendTo($row);

        // Выбор режим + ссылка
        var $sel = $("<select class='subtable-select inline-edit'></select>").appendTo($row);
        $sel.append("<option value=''>— (нет)</option>");
        $sel.append("<option value='__custom__'>✏ Свой ввод</option>");
        children.forEach(function (c) {
          var $opt = $("<option></option>").attr("value", c.code);
          var lbl = c.name || c.code;
          if (c.code !== lbl) lbl += " [" + c.code + "]";
          $opt.text(lbl).appendTo($sel);
        });
        if (mode === "ref") $sel.val(cell);
        else if (mode === "custom") $sel.val("__custom__");
        else $sel.val("");

        // preview для ref / 3 input'a для custom / пусто для none
        var $content = $("<div class='subtable-content'></div>").appendTo($row);
        if (mode === "ref") {
          var ref = null;
          for (var i = 0; i < list.length; i++) if (list[i].code === cell) { ref = list[i]; break; }
          if (ref) {
            var prev = ref.name || ref.code;
            if (ref.dr != null && ref.dr) prev += " [+" + ref.dr + " DR]";
            if (ref.hint) prev += " — " + ref.hint;
            $("<span class='subtable-preview'></span>").text(prev).appendTo($content);
          } else {
            $("<span class='subtable-preview subtable-preview-err'></span>").text("Зона '" + cell + "' не найдена").appendTo($content);
          }
        } else if (mode === "custom") {
          var entry = cell || {};
          $("<input type='text' class='inline-edit subtable-name-input' placeholder='Имя'>").val(entry.name || "")
            .on("change", function () { updateSubCellField(idx, roll, "name", $(this).val()); }).appendTo($content);
          $("<input type='text' class='inline-edit num-input' placeholder='DR' style='text-align:center;'>").val(entry.dr != null ? entry.dr : "")
            .on("change", function () { updateSubCellField(idx, roll, "dr", $(this).val()); }).appendTo($content);
          $("<input type='text' class='inline-edit subtable-hint-input' placeholder='Подсказка'>").val(entry.hint || "")
            .on("change", function () { updateSubCellField(idx, roll, "hint", $(this).val()); }).appendTo($content);
        }

        // Создание новой дочки + автопривязка
        $("<button class='subtable-create' title='Создать дочернюю зону и привязать'>+</button>")
          .on("click", function (e) {
            e.preventDefault();
            var nextId = 1;
            while (list.some(function (l) { return l.code === "custom_" + nextId; })) nextId++;
            var newCode = "custom_" + nextId;
            list.push({ code: newCode, custom: true, dr: 0, parent: loc.code });
            loc.subTable = loc.subTable || {};
            loc.subTable[roll] = newCode;
            openZones.add(newCode);
            render();
          })
          .appendTo($row);
        $sel.on("change", function () {
          var v = $(this).val();
          loc.subTable = loc.subTable || {};
          if (v === "") {
            delete loc.subTable[roll];
          } else if (v === "__custom__") {
            if (typeof loc.subTable[roll] !== "object") loc.subTable[roll] = {};
          } else {
            loc.subTable[roll] = v;
          }
          if (!Object.keys(loc.subTable).length) delete loc.subTable;
          render();
        });
      })(r);
    }

    // Обновление поля внутри object-ячейки (custom-режим subTable).
    function updateSubCellField(idx, roll, field, val) {
      var loc = list[idx];
      loc.subTable = loc.subTable || {};
      if (typeof loc.subTable[roll] !== "object") loc.subTable[roll] = {};
      var v = String(val == null ? "" : val).trim();
      if (v === "") {
        delete loc.subTable[roll][field];
      } else if (field === "dr") {
        var n = +v;
        if (!isFinite(n)) delete loc.subTable[roll][field];
        else loc.subTable[roll][field] = n;
      } else {
        loc.subTable[roll][field] = v;
      }
      if (!Object.keys(loc.subTable[roll]).length) delete loc.subTable[roll];
      if (!Object.keys(loc.subTable).length) delete loc.subTable;
    }

    function showAddMenu($el, idx) {
      $(".gc-hl-popup-outer-wrapper").remove();
      var $pWrapper = $("<div class='mentor gc-hl-popup-outer-wrapper' style='position:fixed; left:0; top:0; pointer-events:none; z-index:1000000;'><char-xml class='gc-hit-locations-enabled' style='display:block;'></char-xml></div>").appendTo("body");
      var $popup = $("<div class='gc-hl-popup'></div>").appendTo($pWrapper.find('char-xml'));
      var rect = $el[0].getBoundingClientRect();
      var left = rect.left + rect.width + 10;
      if (left + 220 > window.innerWidth) left = rect.left - 230;
      $popup.css({ position: 'fixed', left: left + 'px', top: (rect.top - 5) + 'px', pointerEvents: 'auto', margin: 0, right: 'auto', width: '220px' });
      var loc = list[idx];
      Object.keys(SCHEMA).forEach(function(key) {
        if (loc[key] === undefined) {
          $("<item><i class='fa " + SCHEMA[key].icon + "'></i> " + SCHEMA[key].loc + "</item>").on("click", function() {
            var initVal;
            if (SCHEMA[key].type === "number") initVal = 0;
            else if (SCHEMA[key].type === "subtable") initVal = {};
            else if (key === "custom" || key === "isParent" || key === "noInheritDR") initVal = true;
            else initVal = "";
            list[idx][key] = initVal;
            openZones.add(loc.code); render();
          }).appendTo($popup);
        }
      });
      setTimeout(function() { $(document).one("click", function() { $pWrapper.remove(); }); }, 10);
    }

    function deleteField(idx, key) {
      delete list[idx][key];
    }

    function updateValue(idx, key, val) {
      var loc = list[idx];
      if (!loc || !key) return;
      if (key === "code") {
        if (openZones.has(loc.code)) { openZones.delete(loc.code); openZones.add(val); }
        loc.code = val;
      }
      else if (key === "name") loc.name = (val === null || val === "") ? null : val;
      else if (key === "toHit") loc.toHit = (val === "" || val === null) ? null : +val;
      else if (key === "dr") loc.dr = (val === "" || val === null) ? null : +val;
      else if (key === "parent") loc.parent = (val === null || val === "") ? null : val;
      else if (key === "isParent") loc.isParent = (val === "yes" || val === "Да" || val === true);
      else if (key === "custom") loc.custom = (val === "yes" || val === "Да" || val === true);
      else if (key === "noInheritDR") loc.noInheritDR = (val === "yes" || val === "Да" || val === true);
      else if (key === "hint") loc.hint = (val === null || val === "") ? null : val;
      else if (key === "roll") {
        if (Array.isArray(val)) loc.roll = val;
        else if (!val) loc.roll = null;
        else loc.roll = val.split(/[\s,]+/).map(s => +s.trim()).filter(n => !isNaN(n));
      }
    }
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "HIT-LOCATIONS",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "HIT-LOCATIONS" + "]", gcErr);
}

// ----- DR-INHERITANCE -----
try {
// Сниппет DR-наследования для иерархии зон + фиксы движкового DR-pipeline. (v1.1.1)
/* Что делает: каскадирует DR родительской зоны в её подзоны (B398-399).
   Без этого:  ставишь броню на торс — а в abdomen/vitals/groin DR=0 при попадании.
   С этим:     дочерки наследуют DR родителя и видно прямо в блоке локаций.

   Поддержка флага noInheritDR=true (задаётся в редакторе зон): обрывается
   cascade на конкретной зоне. Полезно для eyes (B399 — попадание в глаз
   игнорирует DR черепа). Потомки этой зоны наследуют от неё нормально.

   Параллельно фиксы багов движка:
     - Custom root-зоны (loc.custom без parent): движок удалил их перед
       fullBody-bonus'ом → они получили 0. Возвращаем fullBody через
       applyFullBodyToCustomRoot.
     - Перемещённые стандартные подзоны (loc.parent, не custom): движок
       применил к ним fullBody напрямую, а cascade добавил бы его ещё раз
       через parent.total. Вычитает заранее через adjustStdSubzoneDR.
     - На нулевом уровне преимущества, добавляющие DR, больше не плодят
       фантомную защиту (для корректной работы fix-multiply-zero + убирает
       появление движкового NaN/NaN). Общий DR (full body) преимуществ
       теперь складывается и с типизированным DR, ранее применение было 
       только к общей строке DR.

   Зависимость: hit-locations.

   Порядок подключения:
     fix-multiply-zero → hit-locations → dr-inheritance
   dr-inheritance оборачивает charCalcDR ПОВЕРХ hit-locations — чтобы видеть
   уже созданные custom-зоны. (all-сниппет «Подлокации», если установлен,
   читает уже наследованный DR.) */
(function () {
  (window.gcSnippetMeta = window.gcSnippetMeta || {})["dr-inheritance"] = {
    label: "DR-наследование",
    desc: "Наследование DR от зоны к подзонам; общий DR складывается с типизированным;" +
          " на нулевом уровне преимущество DR не даёт фантомной защиты.",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("dr-inheritance")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  /* Сколько движок добавил к зоне через 'full body' / 'full body except eyes'
     dr_bonus. Использует globalModifiersOn — там уже отфильтрованы активные
     advantage'и, modifier'ы, non-stopped spells и носимое снаряжение.

     ВАЖНО про damage-type: dr_bonus с <damage-type> движок кладёт в ОТДЕЛЬНЫЙ
     <dr type="X">, А НЕ В ОБЩИЙ <dr>. Такие сразу пропускать — иначе вычтет не то.
     Исключение: <except-damage-type="yes"> + <damage-type>X — движок применяет
     к общему DR ВЕЗДЕ кроме типа X, такой бонус считается нормальным. */
  function getEngineAppliedFullBodyDR(code) {
    if (typeof globalModifiersOn === "undefined" || !globalModifiersOn || !globalModifiersOn.length) return 0;
    var total = 0;
    globalModifiersOn.find(">dr_bonus").each(function () {
      var $b = $(this);
      var locTxt = String($b.children("location").text() || "").trim();
      var apply = false;
      if (locTxt === "full body") apply = true;
      else if (locTxt === "full body except eyes" && code !== "eyes") apply = true;
      if (!apply) return;
      // Пропускаем bonus с <damage-type>, кроме except-mode — он не в общем DR.
      var hasDamageType = $b.children("damage-type").length > 0;
      var isExceptMode = $b.attr("except-damage-type") === "yes";
      if (hasDamageType && !isExceptMode) return;
      /* <dr_bonus> содержит два <amount>:
           <amount class="gc-source-value">          — base per level
           <amount class="nosave gc-modified-value"> — итог (level × base)
         Берёт итоговый, как движок (если интересно, то character.js:621). */
      var amtTxt = $b.find("amount, >dr:first").not(".gc-source-value").first().text() || "0";
      if (String(amtTxt).indexOf("*") !== -1) return;
      var amt = parseInt(String(amtTxt).trim(), 10) || 0;
      total += amt;
    });
    return total;
  }

  function adjustStdSubzoneDR(list) {
    var $ll = $("locations-list"); if (!$ll.length) return;
    list.forEach(function (loc) {
      if (!loc || !loc.parent || loc.custom) return;
      var $node = $ll.find("location[name='" + loc.code + "']");
      if (!$node.length) return;
      var fb = getEngineAppliedFullBodyDR(loc.code);
      if (!fb) return;
      var $dr = $node.children("dr").first();
      var cur = parseInt($dr.text(), 10) || 0;
      $dr.text(Math.max(0, cur - fb));
    });
  }

  function applyFullBodyToCustomRoot(list) {
    var $ll = $("locations-list"); if (!$ll.length) return;
    list.forEach(function (loc) {
      if (!loc || !loc.custom || loc.parent) return;
      var $node = $ll.find("location[name='" + loc.code + "']");
      if (!$node.length) return;
      var fb = getEngineAppliedFullBodyDR(loc.code);
      if (!fb) return;
      var $dr = $node.children("dr").first();
      var cur = parseInt($dr.text(), 10) || 0;
      $dr.text(cur + fb);
    });
  }

  function applyInheritedDR(list) {
    var $ll = $("locations-list"); if (!$ll.length) return;
    function findLoc(code) {
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].code === code) return list[i];
      return null;
    }
    function walk(node, parentDR) {
      var code = node.getAttribute("name");
      var loc = findLoc(code);
      var noInherit = !!(loc && loc.noInheritDR);
      var $dr = $(node).children("dr").first();
      var ownDR = parseInt($dr.text(), 10) || 0;
      var totalDR = noInherit ? ownDR : (ownDR + parentDR);
      if (totalDR !== ownDR) $dr.text(totalDR);
      var $children = $(node).children("location");
      for (var i = 0; i < $children.length; i++) walk($children[i], totalDR);
    }
    $ll.children("location").each(function () { walk(this, 0); });
  }

  function applyFullBodyToTypedDR() {
    var $ll = $("locations-list"); if (!$ll.length) return;
    $ll.find("location").each(function () {
      var $z = $(this);
      var $typed = $z.children("dr[type]");
      if (!$typed.length) return;
      var fb = getEngineAppliedFullBodyDR($z.attr("name"));
      if (!fb) return;
      $typed.each(function () {
        var $d = $(this);
        var parts = String($d.text()).split("/");
        var a = (parseInt(parts[0], 10) || 0) + fb;
        var b = (parts[1] !== undefined ? (parseInt(parts[1], 10) || 0) : (parseInt(parts[0], 10) || 0)) + fb;
        $d.text(a === b ? String(a) : a + "/" + b);
      });
    });
  }

  if (!gi.patched.drInhCharCalc && typeof window.charCalcDR === "function") {
    gi.patched.drInhCharCalc = true;
    var _origCharCalcDR = window.charCalcDR;
    window.charCalcDR = function () {
      var detached = [];
      if (typeof globalModifiersOn !== "undefined" && globalModifiersOn && globalModifiersOn.length) {
        globalModifiersOn.find(">dr_bonus").each(function () {
          var $b = $(this);
          var a = $b.find("amount, >dr:first").not(".gc-source-value").first().text() || "0";
          if (/\*/.test(a) || (parseInt(a, 10) || 0) === 0) {
            var ph = document.createComment("gc-dr0");
            $b[0].parentNode.insertBefore(ph, $b[0]);
            detached.push([$b[0], ph]);
            $b.detach();
          }
        });
      }
      var ret = _origCharCalcDR.apply(this, arguments);
      for (var i = 0; i < detached.length; i++) {
        detached[i][1].parentNode.insertBefore(detached[i][0], detached[i][1]);
        detached[i][1].parentNode.removeChild(detached[i][1]);
      }
      try {
        var list = window.GC_HIT_LOCATIONS_LIST || [];
        if (list.length) {
          adjustStdSubzoneDR(list);
          applyFullBodyToCustomRoot(list);
          applyInheritedDR(list);
        }
        applyFullBodyToTypedDR();
      } catch (e) {}
      return ret;
    };
  }

  /* Если hit-locations уже отработал applyAll до загрузки — DOM есть,
     но cascade не применён. Форс один charCalcDR прямо сейчас. */
  if (typeof window.charCalcDR === "function") {
    try { window.charCalcDR(); } catch (e) {}
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "DR-INHERITANCE",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "DR-INHERITANCE" + "]", gcErr);
}

// ----- STRONG-BACK (perk) -----
try {
//  Сниппет для преимущества Strong Back (Крепкий хребет): 6*ST / 10*ST / 20*ST / 30*ST (v1.1.0)
/*  Срабатывает, если у персонажа есть активное преимущество c каноническим именем
    "Strong Back" из Fallout Revised. Отключение через UI (stopped='yes') автоматически
    возвращает штатный расчёт ST. Может конфликтовать с KYOS.*/

(function () {
  (window.gcSnippetMeta = window.gcSnippetMeta || {})["strong-back"] = {
    label: "Крепкий хребет (Fallout Revised)",
    desc: "Strong Back (Крепкий хребет — подъёмная сила 6/10/20/30×ST). При добавлении преимущества " +
	      "с названием Strong Back меняется расчёт перегруза. Перк из Fallout Revised.",
    category: "perk"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("strong-back")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  if (window.gcInternal.patched.strongBack) return;
  window.gcInternal.patched.strongBack = true;

  function applyLift() {
    if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("strong-back")) return;
    var hasStrongBack = globalChar
      .find("advantage_list advantage:not([stopped='yes']):not([condition='yes']) > name")
      .filter(function () { return $(this).text().trim() === "Strong Back"; })
      .length > 0;
    if (!hasStrongBack) return;

    var st        = 1 * getAttr("ST") + gm("ST_lift_bonus").int();
    var basicLift = getBasicLift(st);
    var lightLbs  = 6  * st;
    var medLbs    = 10 * st;
    var heavyLbs  = 20 * st;
    var extraLbs  = 30 * st;
    var kg = function (lb) { return round(lb * 0.5, 1); };

    gm("lift").html(
      "<item modifier='0'><name>Нет (0)</name>"
        + "<lbs>" + round(basicLift, 1) + "</lbs><kg>" + kg(basicLift) + "</kg></item>"
      + "<item modifier='-1'><name>Легкая(-1)</name>"
        + "<lbs>" + round(lightLbs, 1) + "</lbs><kg>" + kg(lightLbs) + "</kg></item>"
      + "<item modifier='-2'><name>Средняя(-2)</name>"
        + "<lbs>" + round(medLbs, 1)   + "</lbs><kg>" + kg(medLbs)   + "</kg></item>"
      + "<item modifier='-3'><name>Тяжелая(-3)</name>"
        + "<lbs>" + round(heavyLbs, 1) + "</lbs><kg>" + kg(heavyLbs) + "</kg></item>"
      + "<item modifier='-4'><name>Сверх(-4)</name>"
        + "<lbs>" + round(extraLbs, 1) + "</lbs><kg>" + kg(extraLbs) + "</kg></item>"
    );
  }

  applyLift();
  window.gcReRunHooks.push(applyLift);
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "STRONG-BACK (perk)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "STRONG-BACK (perk)" + "]", gcErr);
}

// ----- ACE-FOLD-ALL (QoL) -----
try {
// QoL для Ace-редакторов <gc-script> / <gc-style-less>: автосворачивание bundle. (v1.1.0)
/* Что делает: при открытии Ace-редактора (кнопки SCRIPT и CSS/LESS)
   автоматически сворачивает блоки bundle по маркерам:
     // === SECTION-START ===      ↔   // === SECTION-END ===  		(для JS)
     /* === SECTION-START === * /  ↔   /* === SECTION-END === * /   (для LESS)

   Зачем? bundle занимает много места и без сворачивания просто километры кода.

   Outer-marker skip: контейнер bundle, чьи границы хочется видеть как ориентир:
     - LESS: GMENTOR-LESS-BUNDLE сам не сворачивает, только внутренние секции;
     - JS:   сворачивает всё, включая outer GMENTOR-BUNDLE (одной строкой).

   Также перехватывает клик по gutter-стрелке свёрнутого блока — toggle
   разворачивает блок назад (стандартный Ace fold-widget этого не делает,
   т.к. мои folds сделаны через addFold напрямую, минуя mode.foldingRules). */
(function () {
  (window.gcSnippetMeta = window.gcSnippetMeta || {})["ace-fold-all"] = {
    label: "Quality of Life",
    desc: "Улучшения UX: ace-fold-all — автосворачивание всех блоков при открытии " +
          "Ace-редактора <gc-script>/<gc-basic-xml> через foldAll() + marker-based fold " +
          "для <gc-style-less> по START/END комментариям (с MutationObserver на gutter " +
          "для persistent widget).",
    category: "qol"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("ace-fold-all")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;
  if (window.gcInternal.patched.aceFoldAll || typeof window.createMentorAce !== "function") return;
  window.gcInternal.patched.aceFoldAll = true;

  var START_RE = /^\s*\{?\s*(?:\/\/|\/\*)\s*={3,}\s*(\S+?)-START\s*={3,}(?:\s*\*\/)?\s*$/;
  var END_RE_FOR = function (name) {
    var esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^\\s*\\}?\\s*(?:\\/\\/|\\/\\*)\\s*={3,}\\s*" + esc + "-END\\s*={3,}(?:\\s*\\*\\/)?\\s*$");
  };

  function skipNamesForMode(mode) {
    if (mode === "css" || mode === "less") return ["GMENTOR-LESS-BUNDLE"];
    return [];
  }

  function dbg() {
    if (!window.GC_DEBUG_FOLD) return;
    var args = ["[ace-fold-all]"].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  var gcGutterRegistry = (gi.bound.aceGutters = gi.bound.aceGutters || []);
  function sweepDetachedGutters() {
    for (var i = gcGutterRegistry.length - 1; i >= 0; i--) {
      var rec = gcGutterRegistry[i];
      if (!rec.el || !document.contains(rec.el)) {
        if (rec.cleanup) { try { rec.cleanup(); } catch (e) {} }
        gcGutterRegistry.splice(i, 1);
      }
    }
  }

  var origCreate = window.createMentorAce;
  window.createMentorAce = function (objId, mode) {
    sweepDetachedGutters();
    var editor = origCreate.apply(this, arguments);
    var skipNames = skipNamesForMode(mode);
    setTimeout(function () { try { applyInitialFolds(editor, skipNames, mode); } catch (e) { dbg("initialFolds err", e); } }, 150);
    setupGutterClickInterceptor(editor, skipNames);
    return editor;
  };

  function findFoldAt(session, row, Range, skipNames) {
    var line = session.getLine(row);
    var m = START_RE.exec(line);
    if (!m) return null;
    if (skipNames && skipNames.indexOf(m[1]) !== -1) return null;
    var endRe = END_RE_FOR(m[1]);
    var total = session.getLength();
    for (var i = row + 1; i < total; i++) {
      if (endRe.test(session.getLine(i))) {
        return { row: row, range: new Range(row, line.length, i, 0), name: m[1] };
      }
    }
    return null;
  }

  function applyInitialFolds(editor, skipNames, mode) {
    var session = editor.getSession();
    var Range = window.ace && window.ace.require ? window.ace.require("ace/range").Range : null;
    if (!Range) { dbg("ace.range недоступен"); return; }

    if (mode !== "css" && mode !== "less") {
      try { session.foldAll(); } catch (e) { dbg("foldAll err", e); }
    }

    var total = session.getLength();
    var rows = [];
    for (var i = 0; i < total; i++) {
      var m = START_RE.exec(session.getLine(i));
      if (m && (!skipNames || skipNames.indexOf(m[1]) === -1)) rows.push(i);
    }
    rows.sort(function (a, b) { return b - a; });
    var ok = 0;
    rows.forEach(function (row) {
      var found = findFoldAt(session, row, Range, skipNames);
      if (!found) return;
      try {
        var line = session.getLine(row);
        var existing = session.getFoldAt(row, line.length);
        if (existing) session.expandFold(existing);
        session.addFold(" /* … " + found.name + " … */ ", found.range);
        ok++;
      } catch (e) { dbg("addFold err row=" + row, e); }
    });
    dbg("initial folds applied:", ok, "/", rows.length, "mode=" + mode);
  }

  function setupGutterClickInterceptor(editor, skipNames) {
    if (editor.__gcGutterClickBound) return;
    editor.__gcGutterClickBound = true;

    var session = editor.getSession();
    var Range = window.ace && window.ace.require ? window.ace.require("ace/range").Range : null;
    if (!Range) return;

    var handler = function (ev) {
      var target = ev.target;
      if (!target || !target.classList || !target.classList.contains("ace_fold-widget")) return;
      var cell = target.closest(".ace_gutter-cell, .ace_gutter-cell_svg-icons");
      if (!cell) return;
      var row = parseInt((cell.textContent || "").trim(), 10) - 1;
      if (isNaN(row)) return;
      var found = findFoldAt(session, row, Range, skipNames);
      if (!found) return;

      ev.stopImmediatePropagation();
      ev.stopPropagation();
      ev.preventDefault();

      try {
        var line = session.getLine(row);
        var fold = session.getFoldAt(row, line.length);
        if (fold) {
          session.expandFold(fold);
          dbg("expand row=" + row);
        } else {
          session.addFold(" /* … " + found.name + " … */ ", found.range);
          dbg("add row=" + row);
        }
      } catch (err) { dbg("toggle err", err); }
    };

    var suppressIfOurWidget = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("ace_fold-widget")) return;
      var cell = t.closest(".ace_gutter-cell, .ace_gutter-cell_svg-icons");
      if (!cell) return;
      var row = parseInt((cell.textContent || "").trim(), 10) - 1;
      if (isNaN(row)) return;
      if (!findFoldAt(session, row, Range, skipNames)) return;
      ev.stopImmediatePropagation();
      ev.stopPropagation();
      ev.preventDefault();
    };

    var tries = 0;
    var MAX_TRIES = 25;
    var POLL_MS = 200;
    var waitInterval = setInterval(function () {
      var gutterEl = editor.renderer && editor.renderer.$gutterLayer && editor.renderer.$gutterLayer.element;
      if (!gutterEl) gutterEl = editor.container && editor.container.querySelector(".ace_gutter-layer");
      if (!gutterEl) {
        if (++tries > MAX_TRIES) {
          clearInterval(waitInterval);
          dbg("gutter не появился за " + (MAX_TRIES * POLL_MS) + "ms");
        }
        return;
      }
      clearInterval(waitInterval);
      gutterEl.addEventListener("mousedown", handler, true);
      gutterEl.addEventListener("mouseup", suppressIfOurWidget, true);
      gutterEl.addEventListener("click", suppressIfOurWidget, true);
      editor.__gcGutterClickHandler = handler;
      editor.__gcGutterClickEl = gutterEl;
      dbg("gutter click interceptor attached");

      var cleanup = function () {
        try {
          gutterEl.removeEventListener("mousedown", handler, true);
          gutterEl.removeEventListener("mouseup", suppressIfOurWidget, true);
          gutterEl.removeEventListener("click", suppressIfOurWidget, true);
          dbg("cleanup done");
        } catch (e) {}
      };
      var rec = { el: gutterEl, cleanup: cleanup };
      gcGutterRegistry.push(rec);
      var unregister = function () {
        cleanup();
        var idx = gcGutterRegistry.indexOf(rec);
        if (idx >= 0) gcGutterRegistry.splice(idx, 1);
      };
      if (typeof editor.on === "function") {
        try { editor.on("destroy", unregister); } catch (e) {}
      }
    }, POLL_MS);
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "ACE-FOLD-ALL (QoL)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "ACE-FOLD-ALL (QoL)" + "]", gcErr);
}

// ----- DMG-SCALE (урон от характеристики) -----
try {
// Урон оружия от выбранной характеристики (v1.1.1)
/* Урон скейлится не от ST, а от выбранной характеристики (IQ/DX/Will/...) — сниппет,
   который хорошо подойдёт для магических артефактов.

   Добавляет в меню редактирования оружия дополнительный пункт «Зависимость урона».
   При выборе добавляет «Урон зависит от» с возможностью выбора характеристики на 
   выбор: ST (обычно по-умолчанию), DX, IQ, HT, HP, FP, Will, Per. */
(function () {
  'use strict';
  (window.gcSnippetMeta = window.gcSnippetMeta || {})['dmg-scale'] = {
    label: "Скейл урона от характеристики",
    desc: "Оружие наносит урон от выбранной характеристики (IQ/DX/Will/...), а не только " +
          "от ST. Подходит для магических артефактов. Пункт «Зависимость урона» в меню " +
		  "редактирования оружия.",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has('dmg-scale')) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  var WSEL = 'ranged_weapon, ranged_weapon-tag, melee_weapon, melee_weapon-tag';
  var DMARK = 'gc-dmg-default';
  function isDmgDefault() { return $(this).hasClass(DMARK) || $(this).attr('gc-dmg') != null; }

  function wrapGBD() {
    if (window.__gcGbdWrapped) return;
    if (typeof window.getBestDefault !== 'function') return;
    var orig = window.getBestDefault;
    window.__gcGbdOrig = orig;
    window.getBestDefault = function (obj, urv) {
      var saved = [];
      try {
        $(obj).find('>default').filter(isDmgDefault).each(function () {
          saved.push({ el: this, p: this.parentNode, n: this.nextSibling });
          if (this.parentNode) this.parentNode.removeChild(this);
        });
      } catch (e) {}
      var r;
      try { r = orig.call(this, obj, urv); }
      finally {
        saved.forEach(function (s) {
          if (s.n && s.n.parentNode === s.p) s.p.insertBefore(s.el, s.n); else s.p.appendChild(s.el);
        });
      }
      return r;
    };
    window.__gcGbdWrapped = true;
  }

  var ATTR_NAMES = { st: 'Силы (ST)', dx: 'Ловкости (DX)', iq: 'Интеллекта (IQ)', ht: 'Здоровья (HT)', hp: 'HP', fp: 'FP', will: 'Воли (Will)', per: 'Восприятия (Per)' };
  function injectScaleHint(attr) {
    if ($('modalpopup .gc-scale-hint').length) return;
    var $sr = $('modalpopup skill-roll').first();
    if (!$sr.length) return;
    var name = ATTR_NAMES[attr] || String(attr).toUpperCase();
    $('<line class="gc-scale-hint nosave" style="margin:16px 0 6px;text-align:center;color:var(--color-main,#4e98e0);font-style:italic">Урон скейлится от ' + name + '</line>').insertBefore($sr);
  }
  function wrapAttackTool(name) {
    if (window['__gcAtk_' + name]) return;
    if (typeof window[name] !== 'function') return;
    var store = (window.__gcAtkOrig = window.__gcAtkOrig || {});
    store[name] = window[name];
    window[name] = function (obj) {
      var r = store[name].apply(this, arguments);
      try {
        var $dd = $(obj).find('>default').filter(isDmgDefault).first();
        if ($dd.length) { var attr = ($dd.find('>type').text() || '').trim(); if (attr) injectScaleHint(attr); }
      } catch (e) {}
      return r;
    };
    window['__gcAtk_' + name] = true;
  }

  function applyCore() {
    if (gi.patched.charCalcWeapons_dmg) return;
    if (typeof window.charCalcWeapons !== 'function') return;
    wrapGBD();
    var origCalc = window.charCalcWeapons;
    window.charCalcWeapons = function () {
      var saved = [];
      try {
        $('melee_weapon, ranged_weapon').each(function () {
          var $w = $(this);
          var $dd = $w.find('>default').filter(isDmgDefault).first();
          if (!$dd.length) return;
          var attr = ($dd.find('>type').text() || '').trim();
          if (!attr) return;
          var v = parseInt(getAttr(attr === 'hp' ? 'hp_result' : attr === 'fp' ? 'fp_result' : attr), 10);
          if (!(v > 0)) return;
          var $ss = $w.find('>self_strength:not(.gc-source-value)');
          saved.push({ $w: $w, had: $ss.length > 0, orig: $ss.length ? $ss.text() : null });
          if ($ss.length) $ss.first().text(v);
          else $w.prepend('<self_strength class="gc-dmgscale-tmp">' + v + '</self_strength>');
        });
      } catch (e) { if (window.console) console.error('[gc:dmg-scale] core', e); }
      try {
        return origCalc.apply(this, arguments);
      } finally {
        try {
          saved.forEach(function (s) {
            if (s.had) s.$w.find('>self_strength:not(.gc-source-value)').first().text(s.orig);
            else s.$w.find('>self_strength.gc-dmgscale-tmp').remove();
          });
        } catch (e) {}
      }
    };
    gi.patched.charCalcWeapons_dmg = true;
  }

  function injectMenuItem() {
    var $popup = $('xml-node-popup');
    if (!$popup.length) return;
    if ($popup.find('.gc-ds-menuitem').length) return;
    var $sel = $('.gc-selected-node').filter(WSEL).first();
    if (!$sel.length) return;
    if ($sel.find('>default').filter(isDmgDefault).length) return;
    var $tmpl = $('modalpopup object-edit default').filter(function () {
      return !(($(this).hasClass(DMARK)) || ($(this).attr('gc-dmg') != null)) && $(this).find('>type select').length;
    }).first();
    var $item = $('<item class="gc-ds-menuitem"><i class="fa fa-plus-circle fa-fw"></i> Зависимость урона</item>');
    $item.on('click', function () {
      if (!$tmpl.length) { if (window.console) console.warn('[gc:dmg-scale] нет образца <default> для клона'); $('xml-node-popup').remove(); return; }
      var $nd = $tmpl.clone(true, true);
      $nd.removeClass('gc-selected-node collapsed').addClass(DMARK).attr('gc-dmg', '1');
      $nd.find('>name, >specialization, >modifier').remove();
      var keep = ['st', 'dx', 'iq', 'ht', 'hp', 'fp', 'will', 'per'];
      $nd.find('>type select option').each(function () { if (keep.indexOf($(this).attr('value')) < 0) $(this).remove(); });
      $nd.find('>type select').val('st');
      $sel.append($nd);
      $('xml-node-popup').remove();
      if (typeof calcAllSchedule === 'function') calcAllSchedule();
    });
    var $last = $popup.find('item').last();
    if ($last.length) $last.before($item); else $popup.append($item);
  }
  function filterMenu() {
    var $popup = $('xml-node-popup');
    if (!$popup.length) return;
    var $sel = $('.gc-selected-node');
    if (!$sel.length || !($sel.hasClass(DMARK) || $sel.attr('gc-dmg') != null)) return;
    $popup.find('item').each(function () {
      var $i = $(this);
      if ($i.find('i.fa-clone').length) { $i.remove(); return; }
      if ($i.find('[tag-name="modifier"], modifier').length || /Улучшен|ограничен/i.test($i.text())) { $i.remove(); return; }
      if ($i.find('[tag-name="name"], [tag-name="specialization"], name, specialization').length || /Умение|Специализаци/i.test($i.text())) $i.remove();
    });
  }
  function filterSelectOptions() {
    var keep = ['st', 'dx', 'iq', 'ht', 'hp', 'fp', 'will', 'per'];
    $('modalpopup object-edit default[gc-dmg] > type select option, modalpopup object-edit default.' + DMARK + ' > type select option').each(function () {
      if (keep.indexOf($(this).attr('value')) < 0) $(this).remove();
    });
  }

  function ensureLabelStyle() {
    if (document.getElementById('gc-dmg-label-style')) return;
    var s = document.createElement('style'); s.id = 'gc-dmg-label-style';
    s.textContent = 'default[gc-dmg]::before{content:"Урон зависит от " !important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  applyCore();
  ensureLabelStyle();

  function tick() {
    ensureLabelStyle();
    wrapAttackTool('toolMeleeAttack'); wrapAttackTool('toolRangedAttack');
    injectMenuItem(); filterMenu(); filterSelectOptions();
  }
  if (!gi.bound.dmgScaleUi) {
    gi.bound.dmgScaleUi = true;
    tick();
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; tick(); }, 150);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "DMG-SCALE (урон от характеристики)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "DMG-SCALE (урон от характеристики)" + "]", gcErr);
}

// ----- CF-MOD (Cost Factor LT) -----
try {
// Cost Factor: сложение модификаторов цены из Low-Tech. (v1.0.1)
/* Если вы знаете про Cost Factor, то зачем сюда заглядываете?))
   Ладно, теперь без шуток: в редактор модификаторов добавляет новый тип для раздела
   Цена. CF работает по правилам из LT14, при добавлении модификатора к предмету 
   отображает бейдж «Σ CF» с возможностью регулировки порога (стандартный -0.8). */
(function () {
  'use strict';
  (window.gcSnippetMeta = window.gcSnippetMeta || {})['cf-mod'] = {
    label: "Cost Factor (LT)",
    desc: "Добавляет тип «Cost Factor» в редакторе МОДИФИКАТОРА, а так же " +
          "бейдж «Σ CF» у предмета, порог выставляется кликом по бейджу.",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has('cf-mod')) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  var CFTYPE = 'cost factor';
  var FLOOR = -0.8;

  function floorVal() {
    var $t = (typeof gm === 'function') ? gm('gc-cf-floor') : $();
    var v = $t.length ? parseFloat($t.text()) : NaN;
    return isNaN(v) ? FLOOR : v;
  }
  function setFloorVal(v) {
    var $t = gm('gc-cf-floor');
    if (!$t.length) $t = $('<gc-cf-floor></gc-cf-floor>').appendTo(globalChar);
    $t.text(v);
  }
  function syncFloor() { window.__gcCfFloor = floorVal(); }
  syncFloor();

  function applyCore() {
    if (gi.patched.getEquipmentValue_cf) return;
    if (typeof window.getEquipmentValue !== 'function') return;
    var src = window.getEquipmentValue.toString();
    var p1 = src.replace(/var quantity=\$\(obj\)\.find\(">quantity"\)\.int\(\);/,
      'var __gcCf=0,__gcCfHas=false;$&');
    if (p1 === src) return;
    var p2 = p1.replace(/ret\s*=\s*modifyFieldByTag\s*\(\s*ret\s*,\s*\$\(this\)\)\s*;/,
      'var __gcM=$(this);if((__gcM.attr("type")||"")=="' + CFTYPE + '"){__gcCf+=parseFloat(__gcM.text())||0;__gcCfHas=true;}else ret=modifyFieldByTag(ret,__gcM);');
    if (p2 === p1) return;
    var p3 = p2.replace(/(ret=modifyFieldByTag\(ret,__gcM\);)\s*\}\)\s*;\s*return ret;/,
      '$1});if(__gcCfHas){var __fl=(window.__gcCfFloor!=null?window.__gcCfFloor:' + FLOOR + ');if(__gcCf<__fl)__gcCf=__fl;ret=Math.round(ret*(1+__gcCf)*1e6)/1e6;}return ret;');
    if (p3 === p2) return;
    var fn;
    try { fn = eval('(' + p3 + ')'); }
    catch (e) { if (window.console) console.error('[gc:cf-mod] eval', e); return; }
    if (typeof fn !== 'function') return;
    window.getEquipmentValue = fn;
    gi.patched.getEquipmentValue_cf = true;
  }

  function injectTypeOption() {
    $('modalpopup object-edit equipment_modifier > value > type select').each(function () {
      var $sel = $(this);
      if (!$sel.find('option[value="' + CFTYPE + '"]').length) {
        $sel.append('<option value="' + CFTYPE + '">Cost Factor (CF)</option>');
      }
    });
  }

  function openFloorEdit() {
    if (typeof modalPopup !== 'function') return;
    var cur = floorVal();
    var html = "<h4>Порог Cost Factor</h4>"
      + "<p>Суммарный CF не опускается ниже порога. По RAW LT14: −0.8 (цена ≥20% базы). "
      + "Напр. −0.6 (Monster Hunters), −0.9 (Pyramid «Broken Blade»), 0 — без снижения.</p>"
      + "<line><center>Порог: <input type='number' step='0.1' class='gc-cf-floor-inp' style='width:70px' value='" + cur + "'></center></line>";
    modalPopup(html, 'Применить', 'Отмена', function () {
      var v = parseFloat($('.gc-cf-floor-inp').val());
      if (isNaN(v)) v = FLOOR;
      setFloorVal(v); syncFloor();
      if (typeof saveButtonEnable === 'function') saveButtonEnable();
      if (typeof calcAll === 'function') calcAll();
    });
  }

  function injectCfBadge() {
    var floor = (window.__gcCfFloor != null ? window.__gcCfFloor : FLOOR);
    var seen = [];
    $('character equipment_container, character equipment').each(function () {
      var $owner = $(this);
      var $cfVals = $owner.children('equipment').children('equipment_modifier').children('value[type="' + CFTYPE + '"]');
      if (!$cfVals.length) return;
      var sum = 0; $cfVals.each(function () { sum += parseFloat($(this).text()) || 0; });
      var floored = sum < floor;
      var eff = floored ? floor : sum;
      var mult = Math.round((1 + eff) * 100) / 100;
      var txt = 'Σ CF ' + (sum >= 0 ? '+' : '') + (Math.round(sum * 100) / 100) + ' → ×' + mult + (floored ? ' (порог ' + floor + ')' : '');
      if (typeof window.getEquipmentValue === 'function') {
        var total = window.getEquipmentValue($owner[0]);
        if (isFinite(total)) txt += ' = $' + (Math.round(total * 100) / 100);
      }
      var $anchor = $owner.children('description, description-loc').first();
      if (!$anchor.length) return;
      var $b = $anchor.children('.gc-cf-badge');
      if (!$b.length) {
        $b = $('<span class="gc-cf-badge nosave" title="Cost Factor предмета. Клик — изменить порог"></span>');
        /* Важное гашение mousedown: бейдж находится внутри <description class="editable">, 
           иначе editable перехватывает mousedown раньше клика и модалка не откроется. */
        $b.on('mousedown dblclick', function (e) { e.stopPropagation(); e.preventDefault(); });
        $b.on('click', function (e) { e.stopPropagation(); e.preventDefault(); openFloorEdit(); });
        $anchor.append($b);
      }
      $b.text(txt).toggleClass('gc-cf-floored', floored);
      seen.push($owner[0]);
    });
    // Снос бейджа, если предмет без CF
    $('.gc-cf-badge').each(function () {
      var own = $(this).closest('equipment_container, equipment')[0];
      if (seen.indexOf(own) < 0) $(this).remove();
    });
  }

  applyCore();

  function tick() {
    syncFloor();
    injectTypeOption();
    injectCfBadge();
  }
  if (!gi.bound.cfUi) {
    gi.bound.cfUi = true;
    tick();
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; tick(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "CF-MOD (Cost Factor LT)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "CF-MOD (Cost Factor LT)" + "]", gcErr);
}

// ----- SPELL-ATTR (базовый атрибут заклинания) -----
try {
// Выбор базового атрибута заклинания (Will/Per/DX...). (v1.1.0)
/* Движок считает уровень заклинаний только от IQ. По Thaumatology (p.29) заклинание
   может быть основано на Will/Per/DX/HT/ST (Will-Based Magic и пр.). Сниппет добавляет
   заклинаниям выбор базового атрибута прямо на листе персонажа. */
(function () {
  'use strict';
  (window.gcSnippetMeta = window.gcSnippetMeta || {})['spell-attr'] = {
    label: "Базовый атрибут заклинания",
    desc: "Уровень заклинания можно считать от Will/Per/DX/HT/ST, а не только от IQ " +
          "(Thaumatology p.29). Триггер на строке заклинания → выбор атрибута в " +
          "нативной модалке.",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has('spell-attr')) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  var MAP = { iq: 'IQ', will: 'Will', per: 'Per', dx: 'DX', ht: 'HT', st: 'ST' };
  var ORDER = ['iq', 'will', 'per', 'dx', 'ht', 'st'];
  window.__gcSpellBase = function (node) {
    var v = ($(node).attr('gc-base') || '').toLowerCase();
    return MAP[v] || 'IQ';
  };
  function applyPatch() {
	if (gi.patched.spellAttr) return;
	if (typeof window.getBasicSpellLevel !== 'function' || typeof window.calcSpell !== 'function') return;
	var s1 = window.getBasicSpellLevel.toString();
	var p1 = s1.replace('var level=parseInt(getAttr("IQ"));',
	  'var level=parseInt(getAttr(window.__gcSpellBase?window.__gcSpellBase(obj):"IQ"));');
	var s2 = window.calcSpell.toString();
	var p2 = s2.replace(
	  /var textual='IQ'\+relativeLevel;[\s\S]*?textual='IQ'\+"\+"\+relativeLevel;/,
	  "var __b=(window.__gcSpellBase?window.__gcSpellBase(obj):'IQ'); var textual=__b+relativeLevel; if(relativeLevel==0)textual=__b; if(relativeLevel>0)textual=__b+'+'+relativeLevel;");
	if (p1 === s1 || p2 === s2) { if (window.console) console.warn('[gc:spell-attr] патч пропущен (вероятнее всего разраб Ментора обновил движок?)'); return; }
	var f1, f2;
	try { f1 = eval('(' + p1 + ')'); f2 = eval('(' + p2 + ')'); }
	catch (e) { if (window.console) console.error('[gc:spell-attr] eval', e); return; }
	if (typeof f1 !== 'function' || typeof f2 !== 'function') return;
	window.getBasicSpellLevel = f1; window.calcSpell = f2;
	gi.patched.spellAttr = true;
  }
  function baseOf($sp) { var c = ($sp.attr('gc-base') || 'iq').toLowerCase(); return MAP[c] ? c : 'iq'; }
  function openAttrMenu($sp, $trig) {
	if (typeof modalPopup !== 'function') return;
	var cur = baseOf($sp);
	var btns = ORDER.map(function (k) {
	  return "<button class='btn gc-spell-attr-opt' data-k='" + k + "'"
		+ (k === cur ? " style='font-weight:bold;outline:2px solid var(--color-main,#4e98e0)'" : "") + ">" + MAP[k] + "</button>";
	}).join(' ');
	modalPopup(
	  "<h4>Изменение базового атрибута заклинания</h4>"
	  + "<p>Уровень заклинания считается от выбранного атрибута (Thaumatology p.29, Will-Based Magic и пр.).</p>"
	  + "<line style='text-align:center;line-height:2.4'>" + btns + "</line>",
	  null, 'Закрыть', null, null,
	  function () {
		$('.gc-spell-attr-opt').off('click').on('click', function () {
		  var k = $(this).attr('data-k');
		  $sp.attr('gc-base', k);
		  if ($trig) $trig.html(MAP[k] + ' ▾');
		  if (typeof saveButtonEnable === 'function') saveButtonEnable();
		  if (typeof calcAllSchedule === 'function') calcAllSchedule();
		  if (typeof modalPopupClose === 'function') modalPopupClose();
		});
	  }
	);
  }
  function injectSpellTriggers() {
	$('spell').each(function () {
	  var $sp = $(this);
	  if ($sp.hasClass('empty-container')) return;
	  var $trig = $sp.find('> .gc-spell-trig');
	  if ($trig.length) { $trig.html(MAP[baseOf($sp)] + ' ▾'); return; }
	  $trig = $('<span class="gc-spell-trig nosave" title="Базовый атрибут заклинания — клик для смены">' + MAP[baseOf($sp)] + ' ▾</span>');
	  $trig.on('mousedown dblclick', function (e) { e.stopPropagation(); });
	  $trig.on('click', function (e) { e.stopPropagation(); e.preventDefault(); openAttrMenu($sp, $trig); });
	  var $anchor = $sp.find('> gc-stat'); if (!$anchor.length) $anchor = $sp.find('> gc-level');
	  if ($anchor.length) $anchor.after($trig); else $sp.append($trig);
	});
  }

  applyPatch();

  function tick() { injectSpellTriggers(); }
  if (!gi.bound.spellAttrUi) {
	gi.bound.spellAttrUi = true;
	tick();
	var t = null;
	new MutationObserver(function () {
	  if (t) return;
	  t = setTimeout(function () { t = null; tick(); }, 200);
	}).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "SPELL-ATTR (базовый атрибут заклинания)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "SPELL-ATTR (базовый атрибут заклинания)" + "]", gcErr);
}

// ----- GC-TOGGLER-UI (last) -----
try {
// UI для gc-toggler: кнопка «Сниппеты» рядом с </>. (v1.1.0)
/* Что делает: даёт визуально включать/выключать группы сниппетов
   через checkbox-list в модалке. Cascade-логика requires —
   автоматическая (опирается на window.gcToggler.normalizeCascade).
   Применение изменений требует перезагрузки листа.

   Параллельно: кнопка «⚠ Ошибки (N)» появляется, если bundle try/catch
   wrap'ом или gcUtils.gcLog накопил runtime ошибки в window.gcErrors.

   Зависимости: gc-toggler.js и gc-toggler-ui.less. */
(function () {
  if (typeof gm !== "function" || typeof $ !== "function") return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  if (window.gcInternal.bound.togglerUi) return;
  window.gcInternal.bound.togglerUi = true;

  var mountAttempts = 0;
  var MAX_MOUNT_ATTEMPTS = 20; // 20 * 500ms = 10s. Не обязательно так много, но лучше перебздеть чем недобздеть.

  mountButton();
  (window.gcReRunHooks = window.gcReRunHooks || []).push(function () { mountButton(); });
  function mountButton() {
    if ($("#gc-toggler-btn").length) return;
    // Присоска к </> — она всегда есть в edit-mode
    var $scriptBtn = $('button[onclick*="changeCustomJs"]');
    if (!$scriptBtn.length) {
      if (++mountAttempts > MAX_MOUNT_ATTEMPTS) {
        if (window.gcUtils && window.gcUtils.gcLog) window.gcUtils.gcLog("warn", "[gc-toggler-ui] mountButton: script-button не появился за " + (MAX_MOUNT_ATTEMPTS * 500) + "ms");
        return;
      }
      setTimeout(mountButton, 500); return;
    }
    var $btn = $('<button id="gc-toggler-btn" class="secondary hide-in-template-mode" ' +
      'title="Управление сниппетами" style="margin-left:5px;white-space:nowrap;">' +
      '<i class="fa fa-toggle-on"></i> Сниппеты</button>');
    // Ставим кнопку выше hit-locations (если она есть), иначе рядом со SCRIPT.
    var $hl = $("#gc-hit-locations-btn");
    if ($hl.length) {
      $hl.before($btn);
    } else {
      $scriptBtn.parent().append($btn);
    }
    $(document).off("click.gcTogglerUi").on("click.gcTogglerUi", "#gc-toggler-btn", openModal);

    /* Кнопка «⚠ Ошибки (N)» — только если window.gcErrors непуст.
       Заполняется bundle-wrap'ом (SECTION try/catch) и gcUtils.gcLog.
       Покажет счётчик ВСЕХ записей, но в модалке акцент на errors
       (warn'ы — это ожидаемые проблемы вроде parse-failure / pastFromStorage). */
    if (window.gcErrors && window.gcErrors.length) {
      var $errBtn = $('<button id="gc-errors-btn" class="secondary hide-in-template-mode" ' +
        'title="Runtime ошибки сниппетов" style="margin-left:5px;white-space:nowrap;color:#d9534f;">' +
        '<i class="fa fa-exclamation-triangle"></i> Ошибки (' + (window.gcErrors.length) + ')</button>');
      $btn.after($errBtn);
      $(document).off("click.gcTogglerUiErr").on("click.gcTogglerUiErr", "#gc-errors-btn", openErrorsModal);
    }
  }

  function openErrorsModal() {
    if (typeof modalPopup !== "function") {
      console.warn("[gc-toggler-ui] modalPopup() недоступен");
      return;
    }
    var errors = window.gcErrors || [];
    var $wrapper = $('<div class="mentor"><char-xml style="display:block"></char-xml></div>');
    var $overlay = $('<div class="gc-tog-errors"></div>');
    $overlay.append('<h2 style="margin:0 0 8px 0;font-size:16px">Runtime ошибки сниппетов (' + errors.length + ')</h2>');
    $overlay.append('<p style="margin:0 0 12px 0;font-size:12px;opacity:0.7;line-height:1.4">' +
      'Если сниппет упал во время загрузки bundle — try/catch продолжил исполнение, ' +
      'а ошибка приземлилась сюда. Это безопаснее, чем убить весь bundle одним throw.</p>');
    if (!errors.length) {
      $overlay.append('<div style="opacity:0.6;font-style:italic">Ошибок нет</div>');
    } else {
      errors.forEach(function (err, i) {
        var $row = $('<div class="gc-tog-err-row" style="border:1px solid #d9534f;border-radius:4px;padding:8px 10px;margin-bottom:8px;background:rgba(217,83,79,0.05)"></div>');
        var label = err.section || err.msg || "[?]";
        $row.append('<div style="font-weight:600;color:#d9534f">#' + (i + 1) + ' ' + escapeHtml(String(label)) + '</div>');
        if (err.msg && err.msg !== label) {
          $row.append('<div style="margin-top:4px;font-family:monospace;font-size:12px">' + escapeHtml(err.msg) + '</div>');
        }
        var st = err.stack || err.err;
        if (st) {
          $row.append('<pre style="margin:6px 0 0 0;font-size:11px;opacity:0.7;max-height:200px;overflow:auto;background:rgba(0,0,0,0.04);padding:6px;border-radius:3px">' + escapeHtml(st) + '</pre>');
        }
        if (err.at) {
          $row.append('<div style="font-size:10px;opacity:0.4;margin-top:4px">' + new Date(err.at).toISOString() + '</div>');
        }
        $overlay.append($row);
      });
      var $clearBtn = $('<button style="margin-top:8px">Очистить лог</button>').on("click", function () {
        window.gcErrors = [];
        if (typeof modalPopupClose === "function") modalPopupClose();
        $("#gc-errors-btn").remove();
      });
      $overlay.append($clearBtn);
    }
    $wrapper.find("char-xml").append($overlay);
    modalPopup($wrapper, null, "Закрыть");
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  var DRAFT = new Set();
  var DESC_OPEN = new Set();

  // Категория-бейдж: подпись + класс цвета.
  var CATEGORY_META = {
    fix:      { label: "Fix",      cls: "gc-cat-fix" },
    feature:  { label: "Feature",  cls: "gc-cat-feature" },
    homebrew: { label: "Homebrew", cls: "gc-cat-homebrew" },
    perk:     { label: "Perk",     cls: "gc-cat-perk" },
    qol:      { label: "QoL",      cls: "gc-cat-qol" }
  };
  // Мета инфа сниппета (label/desc/category), указывается самими сниппетами.
  function snippetMetaOf(gid, groups) {
    var g = groups[gid];
    var snip = g && g.snippets && g.snippets[0];
    var m = (snip && window.gcSnippetMeta && window.gcSnippetMeta[snip]) || {};
    return { label: m.label || gid, desc: m.desc || "", category: m.category || null };
  }

  function openModal() {
    if (!window.gcToggler) {
      console.warn("[gc-toggler-ui] window.gcToggler не доступен");
      return;
    }
    if (typeof modalPopup !== "function") {
      console.warn("[gc-toggler-ui] modalPopup() недоступен");
      return;
    }
    DRAFT = new Set(window.gcToggler.getDisabledGroups());
    DESC_OPEN = new Set();

    var $wrapper = $('<div class="mentor"><char-xml style="display:block"></char-xml></div>');
    var $overlay = $(
      '<div class="gc-tog">' +
        '<div class="gc-tog-header">' +
          '<h2>Управление сниппетами</h2>' +
          '<p class="gc-tog-hint">Включение/выключение требует перезагрузки листа. Зависимости применяются автоматически (cascade).</p>' +
        '</div>' +
        '<div class="gc-tog-list"></div>' +
        '<div class="gc-tog-footer"></div>' +
      '</div>'
    );
    $wrapper.find("char-xml").append($overlay);

    renderList($overlay);

    modalPopup($wrapper, "Применить (F5 листа)", "Отмена", function () {
      /* Очистка: при переходе группы в disabled чистим её runtime-следы
         (иначе данные сниппета застрянут в char-xml после перезагрузки). */
      var prevDisabled = new Set(window.gcToggler.getDisabledGroups());
      var willBeDisabled = window.gcToggler.normalizeCascade(Array.from(DRAFT));
      willBeDisabled
        .filter(function (gid) { return !prevDisabled.has(gid); })
        .forEach(function (gid) { window.gcToggler.cleanupForDisabled(gid); });
      window.gcToggler.setDisabledGroups(Array.from(DRAFT), { save: false });
      var reloaded = false;
      var doReload = function () { if (reloaded) return; reloaded = true; location.reload(); };
      if (typeof saveCurrentChar === "function") saveCurrentChar(true, doReload);
      else doReload();
      setTimeout(doReload, 4000);
    });
  }

  function renderList($overlay) {
    var groups = window.gcToggler.getGroups();
    var $list = $overlay.find(".gc-tog-list").empty();
    var $footer = $overlay.find(".gc-tog-footer").empty();
    var allIds = Object.keys(groups);
    var topIds = allIds.filter(function (id) { return !groups[id].parent; })
      .sort(function (a, b) { return groups[a].requires.length - groups[b].requires.length; });
    var childrenOf = function (parentId) {
      return allIds.filter(function (id) { return groups[id].parent === parentId; })
        .sort(function (a, b) { return groups[a].requires.length - groups[b].requires.length; });
    };

    var labelOf = function (gid) { return snippetMetaOf(gid, groups).label; };

    function renderRow(gid, depth) {
      var g = groups[gid];
      var meta = snippetMetaOf(gid, groups);
      var cat = meta.category && CATEGORY_META[meta.category];
      var disabled = DRAFT.has(gid);
      var cascadeDisabled = false;
      g.requires.forEach(function (req) { if (DRAFT.has(req)) cascadeDisabled = true; });
      var $row = $('<div class="gc-tog-row"></div>');
      if (depth > 0) $row.addClass("is-child").attr("data-depth", depth);
      var $label = $('<label class="gc-tog-label"></label>');
      var $cb = $('<input type="checkbox" class="gc-tog-cb">');
      $label.append($cb);
      $label.append($('<span class="gc-tog-name"></span>').text(meta.label));
      if (cat) $label.append($('<span class="gc-tog-badge ' + cat.cls + '"></span>').text(cat.label));
      $row.append($label);
      if (g.requires.length) {
        var reqLabels = g.requires.map(labelOf).join(", ");
        $row.append($('<div class="gc-tog-req"></div>').text("Требует: " + reqLabels));
      }
      if (meta.desc) {
        var open = DESC_OPEN.has(gid);
        var $toggle = $('<a class="gc-tog-desc-toggle" href="#"></a>').text(open ? "Скрыть описание" : "Описание");
        var $desc = $('<div class="gc-tog-desc"></div>').text(meta.desc);
        if (!open) $desc.hide();
        $toggle.on("click", function (e) {
          e.preventDefault();
          if (DESC_OPEN.has(gid)) { DESC_OPEN.delete(gid); $desc.slideUp(120); $toggle.text("Описание"); }
          else { DESC_OPEN.add(gid); $desc.slideDown(120); $toggle.text("Скрыть описание"); }
        });
        $row.append($toggle).append($desc);
      }

      $cb.prop("checked", !disabled && !cascadeDisabled);
      if (cascadeDisabled && !disabled) {
        $cb.prop("disabled", true);
        $row.addClass("cascade-off");
      }

      $cb.on("change", function () {
        var enabled = $(this).is(":checked");
        if (enabled) {
          DRAFT.delete(gid);
          g.requires.forEach(function (req) { DRAFT.delete(req); });
        } else {
          DRAFT.add(gid);
          Object.keys(groups).forEach(function (otherId) {
            if (otherId === gid) return;
            if (groups[otherId].requires.indexOf(gid) !== -1) DRAFT.add(otherId);
          });
        }
        renderList($overlay);
      });

      $list.append($row);

      childrenOf(gid).forEach(function (childId) { renderRow(childId, depth + 1); });
    }

    topIds.forEach(function (id) { renderRow(id, 0); });

    // Подсказка по итоговому состоянию.
    var current = new Set(window.gcToggler.getDisabledGroups());
    var changed = (current.size !== DRAFT.size) ||
                  Array.from(DRAFT).some(function (id) { return !current.has(id); });
    if (changed) {
      var disabledLabels = Array.from(DRAFT).map(labelOf);
      $footer.html('<div class="gc-tog-status changed">⚠ Будет выключено после применения: <b>' +
        (disabledLabels.length ? disabledLabels.join(", ") : "—") + '</b></div>');
    } else {
      $footer.html('<div class="gc-tog-status unchanged">Без изменений</div>');
    }
  }
})();
} catch (gcErr) {
  (window.gcErrors = window.gcErrors || []).push({
    section: "GC-TOGGLER-UI (last)",
    msg: String(gcErr && gcErr.message || gcErr),
    stack: gcErr && gcErr.stack,
    at: Date.now()
  });
  if (window.console) console.error("[gc-bundle:" + "GC-TOGGLER-UI (last)" + "]", gcErr);
}

})();
} // === GMENTOR-BUNDLE-END ===
