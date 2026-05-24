//  Сниппет для преимущества Strong Back (Крепкий хребет): 6*ST / 10*ST / 20*ST / 30*ST
/*  Срабатывает, если у персонажа есть активное преимущество c каноническим именем
    "Strong Back" из Fallout Revised. Отключение через UI (stopped='yes') автоматически
    возвращает штатный расчёт ST. Может конфликтовать с KYOS.*/

(function () {
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
