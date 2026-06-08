// Сниппет для дополнительного броска 1d при попадании по конечностям.
/* Что делает: после случайного броска попадания в Arm / Leg / Skull / Face
   (или в любую зону с настроенной табличкой «Подлокации (1d6)» в редакторе
   «⚔ Зоны») бросает ещё 1d и дописывает в результат атаки конкретную
   подлокацию: предплечье / локоть / плечо / бедро / колено / голень / мозг.
  
   Дефолтные таблицы (B552 + хоумрул для головы):
     arms:  1-3 предплечье, 4 локоть, 5 верх руки, 6 плечо
     legs:  1-3 голень, 4 колено, 5-6 бедро
     skull: 1 мозг (vitals), 2-6 череп
     face:  1 мозг (vitals), 2-6 лицо
   Если в редакторе «⚔ Зоны» заданы свои таблицы — используются они.
  
   Если у подлокации задан DR — он автоматически прибавляется к броску
   повреждений (через обёртку damageRoll), если раскомментить в конце.
  
   Подключать ПОСЛЕ hit-locations.js (читает оттуда кастомные таблицы и зоны). */

(function () {
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("sub-location")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  /* Дефолтные таблицы. Формат ячейки: { name, dr?, hint? }.
     Либо править ручками здесь, либо переопределять через редактор «⚔ Зоны»
     в поле «Подлокации (1d6)» — оттуда custom-таблица перебивает default. */
  var DEFAULTS = {
    arms: {
      1: { name: "предплечье" }, 2: { name: "предплечье" }, 3: { name: "предплечье" },
      4: { name: "локоть" }, 5: { name: "верхняя часть руки" }, 6: { name: "плечо" }
    },
    legs: {
      1: { name: "голень" }, 2: { name: "голень" }, 3: { name: "голень" },
      4: { name: "колено" }, 5: { name: "бедро" }, 6: { name: "бедро" }
    },
    skull: {
      1: { name: "мозг (vitals)" }, 2: { name: "череп" }, 3: { name: "череп" },
      4: { name: "череп" }, 5: { name: "череп" }, 6: { name: "череп" }
    },
    face: {
      1: { name: "мозг (vitals)" }, 2: { name: "лицо" }, 3: { name: "лицо" },
      4: { name: "лицо" }, 5: { name: "лицо" }, 6: { name: "лицо" }
    }
  };

  function getCustomTables() { return window.GC_SUB_LOCATION_TABLES_CUSTOM || {}; }
  function getZonesList() { return window.GC_HIT_LOCATIONS_LIST || []; }

  function hasSubTable(code) {
    if (!code) return false;
    return !!(DEFAULTS[code] || getCustomTables()[code]);
  }

  function resolveRef(code) {
    var list = getZonesList();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].code === code) {
        var z = list[i];
        return { name: z.name || z.code, dr: z.dr, hint: z.hint };
      }
    }
    return null;
  }

  /* Custom-ячейка может быть string (code дочерней зоны → resolveRef)
     или object {name, dr?, hint?}. Битая string → fallthrough на default,
     чтобы атака не молчала. */
  function getCell(parent, roll) {
    var custom = getCustomTables()[parent];
    if (custom && custom[roll] != null) {
      var cell = custom[roll];
      if (typeof cell === "string" && cell) {
        var resolved = resolveRef(cell);
        if (resolved && resolved.name) return resolved;
      } else if (cell && typeof cell === "object" && cell.name) {
        return cell;
      }
    }
    var def = DEFAULTS[parent];
    if (def && def[roll] && def[roll].name) return def[roll];
    return null;
  }

  function rollSubLocation(parent) {
    if (!hasSubTable(parent)) return null;
    var r = 1 + Math.floor(Math.random() * 6);
    var cell = getCell(parent, r);
    if (!cell) return null;
    return { parent: parent, name: cell.name, dr: cell.dr, hint: cell.hint, roll: r };
  }

  function getToolLocation() {
    var $sel = $("modalpopup #c_location option:selected, .tool-popup #c_location option:selected").first();
    if (!$sel.length) return null;
    var loc = $sel.attr("location");
    if (loc === "random") return window.__gcLastRandomLocation || null;
    return loc || null;
  }

  function ensureSubLocation(loc) {
    if (!hasSubTable(loc)) return null;
    if (window.__gcSubLocation && window.__gcSubLocation.parent === loc) {
      return window.__gcSubLocation;
    }
    var sub = rollSubLocation(loc);
    window.__gcSubLocation = sub;
    return sub;
  }
  if (!gi.patched.subLocRand && typeof window.getRandomLocation === "function") {
    gi.patched.subLocRand = true;
    var _origRand = window.getRandomLocation;
    window.getRandomLocation = function () {
      var code = _origRand.apply(this, arguments);
      window.__gcLastRandomLocation = code;
      window.__gcSubLocation = hasSubTable(code) ? rollSubLocation(code) : null;
      return code;
    };
  }

  if (!gi.patched.subLocDamageRoll && typeof window.damageRoll === "function") {
    gi.patched.subLocDamageRoll = true;
    var _origDR = window.damageRoll;
    window.damageRoll = function (damage, outputPlace, dr, cb) {
      var loc = getToolLocation();
      var sub = loc ? ensureSubLocation(loc) : null;
      if (sub && sub.dr != null) dr = (dr || 0) + sub.dr;
      return _origDR.call(this, damage, outputPlace, dr, cb);
    };
  }

  if (!gi.patched.subLocTexts && typeof window.toolLocationsTexts === "function") {
    gi.patched.subLocTexts = true;
    var _origT = window.toolLocationsTexts;
    window.toolLocationsTexts = function (damage, location, specialTargetType) {
      var res = _origT.apply(this, arguments);
      var sub = ensureSubLocation(location);
      if (sub) {
        window.__gcSubLocation = null;
        var DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        var face = DICE[sub.roll - 1] || sub.roll;
        var bt = "<span style='display:none'>`</span>";
        var html = "Подлокация (" + face + " = " + bt + sub.roll + bt + "): <b>" + sub.name + "</b>";
		// if (sub.dr != null) html += " <span class='sub-dr'>[+" + sub.dr + " DR]</span>";
        if (sub.hint) html += "<br><span class='sub-hint'>" + sub.hint + "</span>";
        res += "<br><gc-sublocation>" + html + "</gc-sublocation>";
      }
      return res;
    };
  }
})();
