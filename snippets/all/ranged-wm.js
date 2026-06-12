// ranged-wm — фикс-сниппет из пожеланий на сайте. v1.0.0
/* ПРИВЕДЕНИЕ К RAW: добавляет опцию «Мастер оружия» в модалку дистанционной
   атаки (в toolRangedAttack). По Basic Set преимущество Weapon Master работает не только
   с оружием ближнего боя, но и с луками. В контактной модалке движок эту опцию рисует,
   а в дистанционной - нет. Сниппет дорисовывает: чекбокс + селектор уровня и подключает 
   бонус к расчёту урона в calcIt.

   Чекбокс в настройках листа показывается всегда (по-умолчанию выключен):
     • Если нету хаба (snippets-hub): вставляет чекбокс строкой в штатный список
       настроек, под «Снижение атрибутов идёт в лимит недостатков».
     • Если есть хаб: уходит туда же, но в реестр window.gcFixes.
   Состояние — localStorage 'gc-fix:ranged-wm'.

   RAW-ограничение "not guns" на совести игрока.

   Как сниппет это фиксит: берёт исходник toolRangedAttack в рантайме (toString) и делает
   две вставки → eval (паттерн perdie):
     1) UI — копия HTML-блока c_wm/c_wm_val из контактной модалки.
     2) Расчёт — в calcIt, сразу после создания dmgObj: при отмеченном c_wm
        dmgObj.modifier += dmgObj.dices * уровень.).
   Фэйлобезопасно: якоря не найдены (изменение в движке) => функция не трогается. */

(function () {
  'use strict';
  var ID = 'ranged-wm', DEF = false, RECALC = false;
  var LABEL = 'Мастер оружия в дистанционной атаке';
  var HINT = 'Добавляет опцию «Мастер оружия» в модалку дистанционной атаки. По RAW Weapon Master работает с луками и метательным ("swords, bows, etc. – not guns", B99); движок рисует её только в контактной атаке.';
  function flag() { var v = localStorage.getItem('gc-fix:' + ID); return v == null ? DEF : v === '1'; }
  function setFlag(on) { localStorage.setItem('gc-fix:' + ID, on ? '1' : '0'); }
  var UI_BLOCK = '\n      <line><label><input type="checkbox" id=c_wm>Мастер оружия</label><span id=c_wm_text> <select id=c_wm_val><option value=1>умение DX+1 (+1 dmg за куб)</option><option value=2>умение DX+2 и больше (+2 dmg за куб)</option></select></span> <span class="note" title="Не использовать для огнестрела, согласно RAW"><i class="fa fa-question-circle"></i></span></line>\n';
  var CALC_FIND = 'var dmgObj=damageStrToObj($("modalpopup damage").text());';
  var CALC_ADD = ' $("#c_wm_text").hide(); if($("#c_wm:checked").length){$("#c_wm_text").show();dmgObj.modifier+=(window.__gcMeleeBaseDice?window.__gcMeleeBaseDice(obj,dmgObj):dmgObj.dices)*$("#c_wm_val").val();}';
  var injectedVia = null, preOrig = null, injectedFn = null;
  function pickTarget() {
    var store = window.__gcAtkOrig;
    if (store && typeof store.toolRangedAttack === 'function') return 'store';
    if (typeof window.toolRangedAttack === 'function') return 'window';
    return null;
  }
  function getFn(via) { return via === 'store' ? window.__gcAtkOrig.toolRangedAttack : window.toolRangedAttack; }
  function setFn(via, fn) { if (via === 'store') window.__gcAtkOrig.toolRangedAttack = fn; else window.toolRangedAttack = fn; }
  function apply() {
    if (window.__gcRangedWmInjected) return false;
    var via = pickTarget();
    if (!via) return false;
    var src = getFn(via).toString();
    var patched = src
      .replace(/Незнакомое оружие или система\s*\(-2\)<\/line>/, function (m) { return m + UI_BLOCK; })
      .replace(CALC_FIND, function (m) { return m + CALC_ADD; });
    if (patched === src) return false;
    var fn;
    try { fn = eval('(' + patched + ')'); }
    catch (e) { if (window.console) console.error('[gc-fix:ranged-wm] eval', e); return false; }
    if (typeof fn !== 'function') return false;
    injectedVia = via; preOrig = getFn(via); injectedFn = fn;
    setFn(via, fn);
    window.__gcRangedWmInjected = true;
    return true;
  }
  function revert() {
    if (!window.__gcRangedWmInjected) return false;
    var via = null;
    if (injectedVia != null && getFn(injectedVia) === injectedFn) via = injectedVia;
    else if (window.__gcAtkOrig && window.__gcAtkOrig.toolRangedAttack === injectedFn) via = 'store';
    else if (window.toolRangedAttack === injectedFn) via = 'window';
    var ok = via != null;
    if (ok) setFn(via, preOrig);
    injectedVia = null; preOrig = null; injectedFn = null; window.__gcRangedWmInjected = false;
    return ok;
  }

  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert
  });
  var tries = 0;
  function run() {
    if (!pickTarget()) return false;
    if (!flag()) { revert(); return true; }
    if (window.__gcRangedWmInjected) return true;
    return apply();
  }
  if (!run()) { var iv = setInterval(function () { if (run() || ++tries > 60) clearInterval(iv); }, 500); }

  function injectSolo() {
    if (window.gcSnippetsHub) return;
    if (document.getElementById('gc-fixrow-' + ID)) return;
    var $anchor = $('.gc-char-settings #attr-as-disadv').closest('line');
    if (!$anchor.length) return;
    var $prev = $('.gc-char-settings [id^="gc-fixrow-"]').last();
    var hint = " <span class='note' title='" + HINT.replace(/'/g, '&#39;') + "'><i class='fa fa-question-circle'></i></span>";
    var $row = $("<line id='gc-fixrow-" + ID + "'><label><input type='checkbox' " + (flag() ? 'checked' : '') + " /> " + LABEL + "</label>" + hint + "</line>");
    $row.find('input').on('change', function () {
      setFlag(this.checked);
      var changed = this.checked ? apply() : revert();
      if (changed && RECALC && typeof calcAll === 'function') calcAll();
    });
    ($prev.length ? $prev : $anchor).after($row);
  }
  injectSolo();
  var t = null;
  new MutationObserver(function () {
    if (t) return;
    t = setTimeout(function () { t = null; injectSolo(); }, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
