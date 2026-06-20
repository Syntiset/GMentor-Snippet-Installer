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