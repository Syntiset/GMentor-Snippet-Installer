// Централизованный enable/disable для сниппетов. Подключать ПЕРВЫМ в <gc-script>.
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

  /* Реестр групп сниппетов.
     requires — id групп, без которых эта не работает (cascade).
     parent   — UI-вложение (только визуально, отступ в checkbox-list). */
  var GROUPS = {
    "engine-fixes": {
      label: "Фиксы движка",
      desc: "Обход бага modifyField(N, 0, multiply...) → строка \"N*0\" вместо 0. " +
            "Без него ломаются DR/HP/FP-множители. Содержит: fix-multiply-zero.",
      snippets: ["fix-multiply-zero"],
      requires: [],
      parent: null
    },
    "hit-locations": {
      label: "Зоны попадания",
      desc: "Кастомные зоны hit-locations: переименование, custom DR/toHit, " +
            "3d6-таблица random hit, тултипы. UI-кнопка «⚔ Зоны».",
      snippets: ["hit-locations"],
      requires: ["engine-fixes"],
      parent: null
    },
    "dr-inheritance": {
      label: "DR-наследование",
      desc: "Cascade DR от parent-зоны в подзоны; fullBody DR для root-level custom; " +
            "компенсация двойного учёта fullBody. Без hit-locations работает безвредно " +
            "(просто нет данных).",
      snippets: ["dr-inheritance"],
      requires: [], // hit-locations нужен для смысла, но noop без него — не блокируем
      parent: "hit-locations"
    },
    "sub-location": {
      label: "1d6 подлокации",
      desc: "Доп. бросок 1d6 при попадании в Arm/Leg/Skull/Face → подлокация " +
            "(предплечье/локоть/.../мозг). Дефолтные таблицы — самодостаточны; " +
            "custom-таблицы из hit-locations + DR-наследование от dr-inheritance — опционально.",
      snippets: ["sub-location"],
      requires: [], // дополняют hit-locations/dr-inheritance, но работают и без них
      parent: "hit-locations"
    },
    "perks": {
      label: "Перки",
      desc: "Custom-перки: strong-back (Крепкий хребет — подъёмная сила 6/10/20/30×ST).",
      snippets: ["strong-back"],
      requires: [],
      parent: null
    },
    "qol": {
      label: "Quality of Life",
      desc: "Улучшения UX: ace-fold-all — автосворачивание всех блоков при открытии " +
            "Ace-редактора <gc-script>/<gc-basic-xml> через foldAll() + " +
            "marker-based fold для <gc-style-less> по START/END комментариям " +
            "(с MutationObserver на gutter для persistent widget).",
      snippets: ["ace-fold-all"],
      requires: [],
      parent: null
    }
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
        copy[k] = { label: g.label, desc: g.desc, snippets: g.snippets.slice(), requires: g.requires.slice(), parent: g.parent || null };
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
