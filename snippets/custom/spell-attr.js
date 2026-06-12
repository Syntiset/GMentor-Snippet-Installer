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
