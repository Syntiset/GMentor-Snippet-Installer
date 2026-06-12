// Сниппет DR-наследования для иерархии зон + фиксы движкового DR-pipeline. (v1.1.0)
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

   Зависимость: hit-locations (читает window.GC_HIT_LOCATIONS_LIST).

   Порядок подключения:
     fix-multiply-zero → hit-locations → dr-inheritance
   dr-inheritance оборачивает charCalcDR ПОВЕРХ hit-locations — чтобы видеть
   уже созданные custom-зоны. (all-сниппет «Подлокации», если установлен,
   читает уже наследованный DR.) */
(function () {
  (window.gcSnippetMeta = window.gcSnippetMeta || {})["dr-inheritance"] = {
    label: "DR-наследование",
    desc: "Cascade DR от parent-зоны в подзоны; fullBody DR для root-level custom; " +
          "компенсация двойного учёта fullBody. Без hit-locations работает безвредно " +
          "(просто нет данных).",
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

  /* Обёртка charCalcDR — поверх обёртки hit-locations. После _orig DOM
     уже содержит все зоны (custom созданы, addBaseDR отработал). Тут применяются
     три шага: adjustStdSubzoneDR → applyFullBodyToCustomRoot → applyInheritedDR. */
  if (!gi.patched.drInhCharCalc && typeof window.charCalcDR === "function") {
    gi.patched.drInhCharCalc = true;
    var _origCharCalcDR = window.charCalcDR;
    window.charCalcDR = function () {
      var ret = _origCharCalcDR.apply(this, arguments);
      try {
        var list = window.GC_HIT_LOCATIONS_LIST || [];
        if (list.length) {
          adjustStdSubzoneDR(list);
          applyFullBodyToCustomRoot(list);
          applyInheritedDR(list);
        }
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
