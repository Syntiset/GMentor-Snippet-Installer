// Урон оружия от выбранной характеристики (v1.1.1)
/* Урон скейлится не от ST, а от выбранной характеристики (IQ/DX/Will/...) — сниппет,
   который хорошо подойдёт для магических артефактов.

   Добавляет в меню редактирования оружия дополнительный пункт «Зависимость урона».
   При выборе добавляет «Урон зависит от» с возможностью выбора характеристики на 
   выбор: ST (обычно по-умолчанию), DX, IQ, HT, HP, FP, Will, Per. */
(function () {
  'use strict';
  (window.gcSnippetMeta = window.gcSnippetMeta || {})['dmg-scale'] = {
    label: "Скейл урона от характеристики",
    desc: "Оружие наносит урон от выбранной характеристики (IQ/DX/Will/...), а не только " +
          "от ST. Подходит для магических артефактов. Пункт «Зависимость урона» в меню " +
		  "редактирования оружия.",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has('dmg-scale')) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  var WSEL = 'ranged_weapon, ranged_weapon-tag, melee_weapon, melee_weapon-tag';
  var DMARK = 'gc-dmg-default';
  function isDmgDefault() { return $(this).hasClass(DMARK) || $(this).attr('gc-dmg') != null; }

  function wrapGBD() {
    if (window.__gcGbdWrapped) return;
    if (typeof window.getBestDefault !== 'function') return;
    var orig = window.getBestDefault;
    window.__gcGbdOrig = orig;
    window.getBestDefault = function (obj, urv) {
      var saved = [];
      try {
        $(obj).find('>default').filter(isDmgDefault).each(function () {
          saved.push({ el: this, p: this.parentNode, n: this.nextSibling });
          if (this.parentNode) this.parentNode.removeChild(this);
        });
      } catch (e) {}
      var r;
      try { r = orig.call(this, obj, urv); }
      finally {
        saved.forEach(function (s) {
          if (s.n && s.n.parentNode === s.p) s.p.insertBefore(s.el, s.n); else s.p.appendChild(s.el);
        });
      }
      return r;
    };
    window.__gcGbdWrapped = true;
  }

  var ATTR_NAMES = { st: 'Силы (ST)', dx: 'Ловкости (DX)', iq: 'Интеллекта (IQ)', ht: 'Здоровья (HT)', hp: 'HP', fp: 'FP', will: 'Воли (Will)', per: 'Восприятия (Per)' };
  function injectScaleHint(attr) {
    if ($('modalpopup .gc-scale-hint').length) return;
    var $sr = $('modalpopup skill-roll').first();
    if (!$sr.length) return;
    var name = ATTR_NAMES[attr] || String(attr).toUpperCase();
    $('<line class="gc-scale-hint nosave" style="margin:16px 0 6px;text-align:center;color:var(--color-main,#4e98e0);font-style:italic">Урон скейлится от ' + name + '</line>').insertBefore($sr);
  }
  function wrapAttackTool(name) {
    if (window['__gcAtk_' + name]) return;
    if (typeof window[name] !== 'function') return;
    var store = (window.__gcAtkOrig = window.__gcAtkOrig || {});
    store[name] = window[name];
    window[name] = function (obj) {
      var r = store[name].apply(this, arguments);
      try {
        var $dd = $(obj).find('>default').filter(isDmgDefault).first();
        if ($dd.length) { var attr = ($dd.find('>type').text() || '').trim(); if (attr) injectScaleHint(attr); }
      } catch (e) {}
      return r;
    };
    window['__gcAtk_' + name] = true;
  }

  function applyCore() {
    if (gi.patched.charCalcWeapons_dmg) return;
    if (typeof window.charCalcWeapons !== 'function') return;
    wrapGBD();
    var origCalc = window.charCalcWeapons;
    window.charCalcWeapons = function () {
      var saved = [];
      try {
        $('melee_weapon, ranged_weapon').each(function () {
          var $w = $(this);
          var $dd = $w.find('>default').filter(isDmgDefault).first();
          if (!$dd.length) return;
          var attr = ($dd.find('>type').text() || '').trim();
          if (!attr) return;
          var v = parseInt(getAttr(attr === 'hp' ? 'hp_result' : attr === 'fp' ? 'fp_result' : attr), 10);
          if (!(v > 0)) return;
          var $ss = $w.find('>self_strength:not(.gc-source-value)');
          saved.push({ $w: $w, had: $ss.length > 0, orig: $ss.length ? $ss.text() : null });
          if ($ss.length) $ss.first().text(v);
          else $w.prepend('<self_strength class="gc-dmgscale-tmp">' + v + '</self_strength>');
        });
      } catch (e) { if (window.console) console.error('[gc:dmg-scale] core', e); }
      try {
        return origCalc.apply(this, arguments);
      } finally {
        try {
          saved.forEach(function (s) {
            if (s.had) s.$w.find('>self_strength:not(.gc-source-value)').first().text(s.orig);
            else s.$w.find('>self_strength.gc-dmgscale-tmp').remove();
          });
        } catch (e) {}
      }
    };
    gi.patched.charCalcWeapons_dmg = true;
  }

  function injectMenuItem() {
    var $popup = $('xml-node-popup');
    if (!$popup.length) return;
    if ($popup.find('.gc-ds-menuitem').length) return;
    var $sel = $('.gc-selected-node').filter(WSEL).first();
    if (!$sel.length) return;
    if ($sel.find('>default').filter(isDmgDefault).length) return;
    var $tmpl = $('modalpopup object-edit default').filter(function () {
      return !(($(this).hasClass(DMARK)) || ($(this).attr('gc-dmg') != null)) && $(this).find('>type select').length;
    }).first();
    var $item = $('<item class="gc-ds-menuitem"><i class="fa fa-plus-circle fa-fw"></i> Зависимость урона</item>');
    $item.on('click', function () {
      if (!$tmpl.length) { if (window.console) console.warn('[gc:dmg-scale] нет образца <default> для клона'); $('xml-node-popup').remove(); return; }
      var $nd = $tmpl.clone(true, true);
      $nd.removeClass('gc-selected-node collapsed').addClass(DMARK).attr('gc-dmg', '1');
      $nd.find('>name, >specialization, >modifier').remove();
      var keep = ['st', 'dx', 'iq', 'ht', 'hp', 'fp', 'will', 'per'];
      $nd.find('>type select option').each(function () { if (keep.indexOf($(this).attr('value')) < 0) $(this).remove(); });
      $nd.find('>type select').val('st');
      $sel.append($nd);
      $('xml-node-popup').remove();
      if (typeof calcAllSchedule === 'function') calcAllSchedule();
    });
    var $last = $popup.find('item').last();
    if ($last.length) $last.before($item); else $popup.append($item);
  }
  function filterMenu() {
    var $popup = $('xml-node-popup');
    if (!$popup.length) return;
    var $sel = $('.gc-selected-node');
    if (!$sel.length || !($sel.hasClass(DMARK) || $sel.attr('gc-dmg') != null)) return;
    $popup.find('item').each(function () {
      var $i = $(this);
      if ($i.find('i.fa-clone').length) { $i.remove(); return; }
      if ($i.find('[tag-name="modifier"], modifier').length || /Улучшен|ограничен/i.test($i.text())) { $i.remove(); return; }
      if ($i.find('[tag-name="name"], [tag-name="specialization"], name, specialization').length || /Умение|Специализаци/i.test($i.text())) $i.remove();
    });
  }
  function filterSelectOptions() {
    var keep = ['st', 'dx', 'iq', 'ht', 'hp', 'fp', 'will', 'per'];
    $('modalpopup object-edit default[gc-dmg] > type select option, modalpopup object-edit default.' + DMARK + ' > type select option').each(function () {
      if (keep.indexOf($(this).attr('value')) < 0) $(this).remove();
    });
  }

  function ensureLabelStyle() {
    if (document.getElementById('gc-dmg-label-style')) return;
    var s = document.createElement('style'); s.id = 'gc-dmg-label-style';
    s.textContent = 'default[gc-dmg]::before{content:"Урон зависит от " !important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  applyCore();
  ensureLabelStyle();

  function tick() {
    ensureLabelStyle();
    wrapAttackTool('toolMeleeAttack'); wrapAttackTool('toolRangedAttack');
    injectMenuItem(); filterMenu(); filterSelectOptions();
  }
  if (!gi.bound.dmgScaleUi) {
    gi.bound.dmgScaleUi = true;
    tick();
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; tick(); }, 150);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
