// Фикс-сниппет из пожеланий на сайте. v1.0.1
/* Движковый KYOS-тумблер: Меняет таблицу урона (getThr/getSw) и Basic Lift, но НЕ 
   трогает пересчёты стоимости ST.
   Сниппет (при включённом движковом KYOS):
     1) Сбрасывает ST_cost_modifier и HP_cost_modifier в 1.0 — отменяет авто-скидки
        (Size Modifier + No Fine Manipulators);
     2) Гасит красное предупреждение HP != ST.

   Доп. чекбокс «Изменение цены Lifting ST/Striking ST»: При KYOS Подъёмная сила стоит
   7 очков/ур. (вместо 3), Ударная — 1 (вместо 5). Меняет значения "Цена очков за ур".
   Реактивно к KYOS: если KYOS выключается, то цена возвращается к 3/5 соответственно.

   Чекбоксы в настройках листа показываются ТОЛЬКО при включенном KYOS:
     • Если нету хаба (snippets-hub): вставляет чекбокс строкой в штатный список
       настроек, под «Снижение атрибутов идёт в лимит недостатков».
     • Если есть хаб: уходит туда же, но в реестр window.gcFixes. */

(function () {
  'use strict';
  var ID = 'kyos-full', DEF = false, RECALC = true;
  var PRICE_ID = 'kyos-pricing';
  var LABEL = 'Полная поддержка KYOS';
  var HINT = 'Дополняет штатный KYOS в движке: при включённом KYOS отменяет авто-скидку стоимости ST/HP за Size Modifier и No Fine Manipulators (по KYOS они неуместны) и убирает красное предупреждение при большом отличии HP от ST.';
  var PRICE_LABEL = 'Изменение цены Lifting ST/Striking ST';
  var PRICE_HINT = 'При KYOS Подъёмная сила стоит 7 очков/уровень (вместо 3), Ударная сила — 1 (вместо 5), т.к. BL и урон пересчитаны. Меняет "Цена очков за ур." этих преимуществ на листе.';
  var FIND_SM = /gm\("HP_cost_modifier"\)\.html\(gm\("HP_cost_modifier"\)\.float\(\)\s*-\s*0\.1\s*\*\s*sm\)/;
  var ADD_SM = '$&;if(isCharOption("kyos")){gm("ST_cost_modifier").html(1);gm("HP_cost_modifier").html(1);}';
  var FIND_WARN = /var toHeight = \(Math\.abs\(gm\("HP"\)\.html\(\)\)\s*\/\s*getAttr\('ST'\)\s*>\s*0\.3\);/;
  var REPL_WARN = 'var toHeight = !isCharOption("kyos") && (Math.abs(gm("HP").html()) / getAttr(\'ST\') > 0.3);';
  function flag(id, def) { var v = localStorage.getItem('gc-fix:' + id); return v == null ? !!def : v === '1'; }
  function setFlag(id, on) { localStorage.setItem('gc-fix:' + id, on ? '1' : '0'); }
  function kyosOn() { return typeof isCharOption === 'function' && isCharOption('kyos'); }
  function apply() {
	if (window.__gcKyosFullPatched) return false;
	if (typeof window.charCalcStats !== 'function') return false;
	var src = window.charCalcStats.toString();
	var p1 = src.replace(FIND_SM, ADD_SM);
	if (p1 === src) { if (window.console) console.warn('[gc-fix:kyos-full] SM-якорь не найден'); return false; }
	var p2 = p1.replace(FIND_WARN, REPL_WARN);
	if (p2 === p1) { if (window.console) console.warn('[gc-fix:kyos-full] warning-якорь не найден'); return false; }
	var fn;
	try { fn = eval('(' + p2 + ')'); }
	catch (e) { if (window.console) console.error('[gc-fix:kyos-full] eval', e); return false; }
	if (typeof fn !== 'function') return false;
	if (window.__gcKyosOrig == null) window.__gcKyosOrig = window.charCalcStats;
	window.charCalcStats = fn;
	window.__gcKyosFullPatched = true;
	return true;
  }
  function revert() {
	if (!window.__gcKyosOrig) return false;
	window.charCalcStats = window.__gcKyosOrig; window.__gcKyosFullPatched = false;
	return true;
  }

  function pricingSet(want) {
	var on = want && kyosOn();
	var changed = false;
	gm('advantage_list advantage').each(function () {
	  var $a = $(this);
	  var lim = '';
	  $a.find('attribute_bonus attribute').each(function () {
		if (($(this).text() || '').trim().toLowerCase() !== 'st') return;
		var l = ($(this).attr('limitation') || '').toLowerCase();
		if (l === 'lifting only' || l === 'striking only') lim = l;
	  });
	  if (!lim) return;
	  var $ppl = $a.children('points_per_level');
	  if (!$ppl.length) return;
	  var target = on ? (lim === 'lifting only' ? 7 : 1) : (lim === 'lifting only' ? 3 : 5);
	  if (String($ppl.text()).trim() !== String(target)) { $ppl.text(target); changed = true; }
	});
	return changed;
  }

  (window.gcFixes = window.gcFixes || []).push({
	id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert,
	condition: kyosOn,
	sub: {
	  id: PRICE_ID, default: false, recalc: true, label: PRICE_LABEL, hint: PRICE_HINT,
	  apply: function () { return pricingSet(true); },
	  revert: function () { return pricingSet(false); }
	}
  });

  var tries = 0;
  function run() {
    if (typeof window.charCalcStats !== 'function') return false;
    var changed = flag(ID, DEF) ? apply() : revert();
    pricingSet(flag(PRICE_ID, false));
    if (changed && flag(ID, DEF) && typeof calcAllSchedule === 'function') calcAllSchedule();
    return true;
  }
  if (!run()) { var iv = setInterval(function () { if (run() || ++tries > 60) clearInterval(iv); }, 500); }

  (window.gcReRunHooks = window.gcReRunHooks || []).push(function () {
    var ch = pricingSet(flag(PRICE_ID, false));
    if (ch && !window.__gcKyosPriceReCalc) {
      window.__gcKyosPriceReCalc = true;
      if (typeof calcAllSchedule === 'function') calcAllSchedule();
      setTimeout(function () { window.__gcKyosPriceReCalc = false; }, 50);
    }
  });

  function injectSolo() {
    if (window.gcSnippetsHub) return;
    if (!kyosOn()) { $('#gc-fixrow-' + ID + ',#gc-fixrow-' + PRICE_ID).remove(); return; }
    if (document.getElementById('gc-fixrow-' + ID)) return;
    var $anchor = $('.gc-char-settings #attr-as-disadv').closest('line');
    if (!$anchor.length) return;
    var $prev = $('.gc-char-settings [id^="gc-fixrow-"]').last();
    function hintHtml(h) { return " <span class='note' title='" + h.replace(/'/g, '&#39;') + "'><i class='fa fa-question-circle'></i></span>"; }
    var $row = $("<line id='gc-fixrow-" + ID + "'><label><input type='checkbox' " + (flag(ID, DEF) ? 'checked' : '') + " /> " + LABEL + "</label>" + hintHtml(HINT) + "</line>");
    $row.find('input').on('change', function () {
      setFlag(ID, this.checked);
      var changed = this.checked ? apply() : revert();
      if (changed && RECALC && typeof calcAll === 'function') calcAll();
    });
    var $sub = $("<line id='gc-fixrow-" + PRICE_ID + "' style='margin-left:20px'><label><input type='checkbox' " + (flag(PRICE_ID, false) ? 'checked' : '') + " /> " + PRICE_LABEL + "</label>" + hintHtml(PRICE_HINT) + "</line>");
    $sub.find('input').on('change', function () {
      setFlag(PRICE_ID, this.checked);
      var changed = pricingSet(this.checked);
      if (changed && typeof calcAll === 'function') calcAll();
    });
    ($prev.length ? $prev : $anchor).after($row);
    $row.after($sub);
  }
  injectSolo();
  var t = null;
  new MutationObserver(function () {
    if (t) return;
    t = setTimeout(function () { t = null; injectSolo(); }, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
