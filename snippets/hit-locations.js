// Сниппет кастомных зон попаданий + UI-редактор «⚔ Зоны».
/* Что делает: позволяет переименовывать штатные зоны попаданий, править
   to-hit / базовый DR, добавлять свои зоны и вложения, переписывать
   3d6-таблицу случайного попадания, задавать тултипы и таблицы
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
    patchToolsLocationsSelectTemplate(list);
    patchLocationHint(list);
    patchRandomLocation(list);
    exportSubTables(list);
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

  /* Экспорт subTable полей зон в window.GC_SUB_LOCATION_TABLES_CUSTOM
     (для sub-location) + плоский список всех зон в window.GC_HIT_LOCATIONS_LIST
     (для resolve ссылок на подзону). Формат ячейки subTable:
       - string (code)               — ссылка на подзону, name/dr/hint оттуда.
       - object {name, dr?, hint?}   — ввод ручками. */
  function exportSubTables(list) {
    var tables = {};
    list.forEach(function (loc) {
      if (!loc || !loc.subTable || typeof loc.subTable !== "object") return;
      var entries = {};
      Object.keys(loc.subTable).forEach(function (k) {
        var n = +k;
        if (n < 1 || n > 6) return;
        var cell = loc.subTable[k];
        if (typeof cell === "string" && cell) entries[n] = cell;
        else if (cell && typeof cell === "object" && cell.name) entries[n] = cell;
      });
      if (Object.keys(entries).length) tables[loc.code] = entries;
    });
    window.GC_SUB_LOCATION_TABLES_CUSTOM = tables;
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
      window.__gcLock = false;
      return r;
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
          if (!$hints.find("." + cls).length) $hints.append("<span class='" + cls + "' style='display:none'>" + loc.hint + "</span>");
        });
      }
      return orig ? orig.apply(this, arguments) : undefined;
    };
  }

  function defaultLocationForRoll(r) {
    if (r <= 4)  return "skull";
    if (r === 5) return "face";
    if (r <= 7)  return "legs";
    if (r === 8) return "arms";
    if (r <= 10) return "torso";
    if (r === 11) return "groin";
    if (r === 12) return "arms";
    if (r <= 14) return "legs";
    if (r === 15) return "hands";
    if (r === 16) return "feet";
    return "neck";
  }

  function patchRandomLocation(list) {
    if (!gi.patched.getRandomLocation) {
      gi.patched.getRandomLocation = true;
      window.getRandomLocation = function () {
        var r = 0; for (var i = 0; i < 3; i++) r += 1 + Math.floor(Math.random() * 6);
        var ov = window.__gcLocRolls || {};
        if (ov[r]) return ov[r];
        return defaultLocationForRoll(r);
      };
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
    var $help = $("<help></help>").html(`<div><h2>Как это работает:</h2>• Для <b>правки</b> стандартной зоны впишите её Код (ID) и добавьте нужные поля через меню <b>+</b>.<br>• Для <b>создания</b> новой зоны нажмите кнопку внизу списка и включите <b>Новая зона</b>.<br>• <b>Родитель (ID)</b> — ID зоны, внутрь которой будет вложена текущая.<br>• <b>Является родителем</b> — помечает зону как контейнер для других подлокаций.</div><div><h3>Стандартные коды зон:</h3>skull, face, eyes, neck, torso, groin, arms, hands, legs, feet</div><div><h3>Подлокации:</h3><b>arms</b>: shoulders, upper arms, elbows, forearms<br><b>legs</b>: thighs, knees, shins<br><b>torso</b>: chest, abdomen</div><div><h3>Подлокации (1d6):</h3>Поле <b>Подлокации (1d6)</b> у любой зоны — таблица для дополнительного броска 1d6 при попадании (через сниппет <b>sub-location.js</b>). Каждая из 6 ячеек — либо ссылка на дочернюю зону (с тем же <b>Родителем</b>), либо свободный ввод (имя/DR/hint). Кнопка <b>+</b> справа создаёт новую дочернюю custom-зону и сразу привязывает её к ячейке. <b>DR прибавляется к параметру dr движковой функции damageRoll</b> — реально вычитается из урона (с учётом drDivisor) и попадает в <code>&lt;mod&gt;-NDR&lt;/mod&gt;</code> результата. Кастомные значения переопределяют дефолтные ячейки arms/legs/skull/face поштучно: задайте только нужные строки, остальные возьмутся из дефолта.</div><div><h3>Специфические коды:</h3>vitals, spine, ear, jaw, nose, wings, tail, weapon, bigjoint, smalljoint, limbvenus, neckvenus</div><div style="margin-bottom:20px; padding:12px; background:rgba(66,139,202,0.1); border-radius:6px; border:1px solid rgba(66,139,202,0.2);"><label style="cursor:pointer; display:flex; align-items:center; gap:10px; margin:0;"><input type="checkbox" id="gc-hl-show-sub-meta" ${localStorage.getItem("gcHlShowSubMeta") === "yes" ? "checked" : ""} style="margin:0; width:16px; height:16px;"><b style="font-size:13px;">Показывать параметры подлокаций на листе</b></label></div>`).appendTo($container);

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
        var isOpen = openZones.has(idx);
        var $header = $(`<div class='zone-header'><i class="fa fa-caret-${isOpen ? 'down' : 'right'}" style="margin-right:12px; color:#ccc"></i><span class='zone-name'>${loc.name || loc.code || 'Без названия'}</span><div class='node-actions'><i class="fa fa-plus-circle" title="Добавить поле"></i><i class="fa fa-trash" title="Удалить зону"></i></div></div>`).appendTo($zone);
        $header.on("click", function(e) {
          if ($(e.target).hasClass('fa-plus-circle')) { showAddMenu($(e.target), idx); e.stopPropagation(); return; }
          if ($(e.target).hasClass('fa-trash')) { if(confirm("Удалить зону?")) { list.splice(idx, 1); if (typeof window.charCalcDR === "function") window.charCalcDR(); render(); } e.stopPropagation(); return; }
          isOpen = !isOpen; if (isOpen) openZones.add(idx); else openZones.delete(idx); render();
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
          list.push({ code: "custom_" + nextId, custom: true, dr: 0 }); openZones.add(list.length - 1); render();
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
            openZones.add(list.length - 1);
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
            openZones.add(idx); render(); if (typeof window.charCalcDR === "function") window.charCalcDR();
          }).appendTo($popup);
        }
      });
      setTimeout(function() { $(document).one("click", function() { $pWrapper.remove(); }); }, 10);
    }

    function deleteField(idx, key) {
      delete list[idx][key];
      if (typeof window.charCalcDR === "function") window.charCalcDR();
    }

    function updateValue(idx, key, val) {
      var loc = list[idx];
      if (!loc || !key) return;
      if (key === "code") loc.code = val;
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
      if (typeof window.charCalcDR === "function") window.charCalcDR();
    }
  }
})();