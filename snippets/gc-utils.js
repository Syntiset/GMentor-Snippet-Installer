// Системный сниппет с общими хелперами для остальных. Подключать ВТОРЫМ.
/* Что делает: экспортирует window.gcUtils и инициализирует общие namespace'ы.
   Все остальные сниппеты опираются на это — без gc-utils они упадут.

   Экспорт window.gcUtils:
     STD_ZONE_CODES                 — массив стандартных кодов зон.
     gcLog(level, msg[, err])       — console + window.gcErrors[].
     getToolLocation()              — код зоны из открытой модалки атаки
                                      (учитывает loc='random').
     readDRFromDom(code)            — DR из <locations-list> по коду зоны.
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

  function getToolLocation() {
    if (typeof $ !== "function") return null;
    var $sel = $("modalpopup #c_location option:selected, .tool-popup #c_location option:selected").first();
    if (!$sel.length) return null;
    var loc = $sel.attr("location");
    if (loc === "random") return window.__gcLastRandomLocation || null;
    return loc || null;
  }

  function readDRFromDom(code) {
    if (!code || typeof $ !== "function") return 0;
    var safe = String(code).replace(/'/g, "\\'");
    var $node = $("locations-list location[name='" + safe + "']").first();
    if (!$node.length) return 0;
    var v = parseInt($node.children("dr").first().text(), 10);
    return isFinite(v) ? v : 0;
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
    getToolLocation: getToolLocation,
    readDRFromDom: readDRFromDom,
    loadBase64Slot: loadBase64Slot,
    saveBase64Slot: saveBase64Slot
  };
})();
