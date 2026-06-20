// techniques-as-spell — доработанные магические техники в раздел Заклинания. v1.0.0
/* Сниппет делает две вещи:
     1. Чинит уровень техник — движок для боевых заклинаний считает его
        неверно (выдаёт мусор вроде 1414 вместо 14).
     2. Показывает такие техники в раздел «Заклинания», рядом с магией
        (а не в «Умения»): уровень, очки и меню работают так же, как у
        заклинаний, а правки идут в саму технику. Лист остаётся корректным
        и без сниппета — этот показ временный, в сохранение не попадает.

   Опции:
     • «Кап уровня по заклинанию» — техника не выше уровня своего заклинания.
     • «Очки техник — в раздел заклинаний» — считать вложенные в них очки
       в статье «Заклинания», а не «Умения». */
(function () {
  'use strict';
  if (window.__gcTasLoaded) return;
  window.__gcTasLoaded = true;

  var ID = 'techniques-as-spell', DEF = false;
  var CAP_ID = 'tas-cap';
  var POINTS_ID = 'tas-points';
  var LABEL = 'Магические техники';
  var HINT = 'Техники с зависимостью от заклинания (как в Тауматологии): чинит их уровень (движок считает его неверно для боевых заклинаний) и переносит такие техники в раздел «Заклинания», скрывая из «Умения». Очки, уровень и меню работают как у заклинаний; правки идут в саму технику.';
  var CAP_LABEL = 'Кап уровня по заклинанию';
  var CAP_HINT = 'Ограничивать уровень магической техники уровнем базового заклинания.';
  var POINTS_LABEL = 'Очки техник — в раздел заклинаний';
  var POINTS_HINT = 'Считать очки, вложенные в магические техники, в статье «Заклинания», а не «Умения» (по умолчанию техника = умение).';

  function flag(id, def) { var v = localStorage.getItem('gc-fix:' + id); return v == null ? !!def : v === '1'; }
  function setFlag(id, on) { localStorage.setItem('gc-fix:' + id, on ? '1' : '0'); }

  function isSpellTech($t) { return (($t.children('default').children('type').text() || '').trim() === 'Spell'); }

  function setChild($n, tag, val) {
    var $c = $n.children(tag), s = String(val == null ? '' : val);
    if ($c.length) { if ($c.text() !== s) $c.text(s); }
    else { $n.append('<' + tag + '>' + s + '</' + tag + '>'); }
  }

  function spellLevel(name, spec) {
    var base = null;
    gm('spell_list spell').each(function () {
      var $s = $(this);
      if ($s.hasClass('empty-container')) return;
      if ((($s.children('name').text() || '').trim()) !== name) return;
      if (spec && (($s.children('specialization').text() || '').trim()) !== spec) return;
      var v = parseInt($s.children('gc-level').text(), 10);
      if (!isNaN(v)) base = v;
    });
    return base;
  }

  function computeLevel($t) {
    var $def = $t.children('default');
    var name = ($def.children('name').text() || '').trim();
    var spec = ($def.children('specialization').text() || '').trim();
    var mod = parseInt($def.children('modifier').text(), 10) || 0;
    var base = spellLevel(name, spec);
    if (base == null) return null;
    var pts = parseInt($t.children('points').text(), 10) || 0;
    var diff = ($t.children('difficulty').text() || '').trim().toLowerCase();
    var hard = (diff.charAt(diff.length - 1) === 'h');
    var techMod = pts - (hard ? 1 : 0);
    if (techMod < 0) techMod = 0;
    var lvl = base + mod + techMod;
    if (flag(CAP_ID, false) && lvl > base) lvl = base;
    return { level: lvl, base: base, mod: mod, name: name };
  }

  function ensureStyle() {
    if (document.getElementById('gc-tas-style')) return;
    var css =
      '.gc-tas-src{display:none !important;}' +
      '.mentor spell_list technique.gc-tas-row{border-left:2px solid var(--color-main);}' +
      '.mentor spell_list technique.gc-tas-row>gc-stat{flex-grow:10;width:auto;text-align:right;}' +
      '.mentor spell_list technique.gc-tas-row>name{flex-grow:0;width:20%;}' +
      '.mentor spell_list technique.gc-tas-row>name-loc{flex-grow:0;width:25%;}' +
      '.mentor spell_list technique.gc-tas-row>default{text-align:right;}' +
      '.mentor spell_list .gc-tas-group>name{color:var(--color-main);}' +
      '.gc-tas-group.gc-collapsed>technique{display:none;}';
    var st = document.createElement('style');
    st.id = 'gc-tas-style'; st.className = 'nosave'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function bindProxy($clone, $t) {
    var orig = $t[0];
    $clone.off('dblclick').on('dblclick', function (e) {
      e.stopPropagation();
      if (typeof changeItem === 'function') changeItem(orig, false);
    });
    $clone.children('list-menu').off('click').on('click', function (e) {
      e.stopPropagation();
      if (typeof showFloatPanel === 'function') showFloatPanel($t);
    });
    $clone.off('click').on('click', function () { return false; });
    $clone.children('points').off('change.tasproxy').on('change.tasproxy', function () {
      var v = $(this).text();
      $t.children('points').text(v).attr('gc-points', v);
      if (typeof saveButtonEnable === 'function') saveButtonEnable();
      if (typeof calcAllSchedule === 'function') calcAllSchedule();
    });
    $clone.children('gc-level').off('click.tasroll').on('click.tasroll', function () {
      if (typeof makeToolRoll === 'function') makeToolRoll(this);
    });
  }

  function upsertClone($t, info, idx) {
    var $list = gm('spell_list').first(); if (!$list.length) return null;
    var key = 'tas-' + idx;
    var $clone = $list.find('.gc-tas-row').filter(function () { return $(this).attr('data-techid') === key; });
    if (!$clone.length) {
      $clone = $($t.clone(false)[0]).addClass('nosave gc-tas-row').removeClass('gc-tas-src gc-tas-caplim').attr('data-techid', key).attr('draggable', 'false');
      $list.append($clone);
      try { renderSkill($clone[0]); } catch (e) {}
      try { bindSpinners($clone); } catch (e) {}
      bindProxy($clone, $t);
    }
    var SKIP = { 'list-menu': 1, 'points': 1 };
    $t.children().each(function () {
      var tag = this.tagName.toLowerCase();
      if (SKIP[tag] || tag.indexOf('gc-') === 0) return;
      var $cc = $clone.children(tag);
      if (!$cc.length) $clone.append($(this).clone());
      else if ($cc.html() !== $(this).html()) $cc.replaceWith($(this).clone());
    });
    $clone.children().each(function () {
      var tag = this.tagName.toLowerCase();
      if (SKIP[tag] || tag.indexOf('gc-') === 0) return;
      if (!$t.children(tag).length) $(this).remove();
    });
    var op = $t.children('points').text();
    var $cp = $clone.children('points');
    if ($cp.text() !== op) $cp.text(op);
    if ($cp.attr('gc-points') !== op) $cp.attr('gc-points', op);
    var lim = $t.attr('limit');
    if (lim != null) $clone.attr('limit', lim); else $clone.removeAttr('limit');
    try { calcSkill($clone[0]); } catch (e) {}
    setChild($clone, 'gc-level', info.level);
    return key;
  }

  function ensureGroup() {
    var $list = gm('spell_list').first(); if (!$list.length) return null;
    var $g = $list.children('.gc-tas-group');
    if (!$g.length) {
      $g = $('<spell_container class="nosave gc-tas-group" draggable="false">' +
            '<expander class="nosave"></expander>' +
            '<name class="nosave">Магические техники</name>' +
            '</spell_container>');
      $g.children('expander').on('click', function (e) { e.stopPropagation(); $g.toggleClass('gc-collapsed'); });
      $list.prepend($g);
    }
    return $g;
  }

  function applyPointsTransfer() {
    if (!flag(POINTS_ID, false)) return;
    var sum = 0;
    gm('skill_list technique').each(function () {
      var $t = $(this);
      if ($t.hasClass('empty-container') || !isSpellTech($t)) return;
      if (!computeLevel($t)) return;
      sum += parseInt($t.children('points').text(), 10) || 0;
    });
    if (sum <= 0) return;
    var $sk = gm('spend_points_skills'), $sp = gm('spend_points_spells');
    if ($sk.length) $sk.text((parseInt($sk.text(), 10) || 0) - sum);
    if ($sp.length) $sp.text((parseInt($sp.text(), 10) || 0) + sum);
  }

  function reRun() {
    ensureStyle();
    var seen = {}, limitChanged = false, idx = 0;
    gm('skill_list technique').each(function () {
      var $t = $(this);
      if ($t.hasClass('empty-container')) return;
      if (!isSpellTech($t)) { $t.removeClass('gc-tas-src'); return; }
      var info = computeLevel($t);
      if (!info) { $t.removeClass('gc-tas-src'); return; }
      if (flag(CAP_ID, false)) {
        if ($t.attr('limit') == null) { $t.attr('limit', '0').addClass('gc-tas-caplim'); limitChanged = true; }
      } else if ($t.hasClass('gc-tas-caplim')) { $t.removeAttr('limit').removeClass('gc-tas-caplim'); limitChanged = true; }
      setChild($t, 'gc-level', info.level);
      $t.addClass('gc-tas-src');
      var key = upsertClone($t, info, idx++);
      if (key) seen[key] = true;
    });
    gm('spell_list technique').each(function () {
      if (!$(this).hasClass('gc-tas-row')) $(this).remove();
    });
    gm('spell_list').find('.gc-tas-row').each(function () {
      if (!seen[$(this).attr('data-techid')]) $(this).remove();
    });
    var $rows = gm('spell_list').find('.gc-tas-row').attr('draggable', 'false');
    if ($rows.length > 1) {
      var $g = ensureGroup();
      if ($g) { $g.append($rows); gm('spell_list').prepend($g); }
    } else {
      if ($rows.length) gm('spell_list').prepend($rows);
      gm('spell_list').children('.gc-tas-group').remove();
    }
    applyPointsTransfer();
    if (limitChanged && !window.__gcTasLimitReCalc) {
      window.__gcTasLimitReCalc = true;
      if (typeof calcAllSchedule === 'function') calcAllSchedule();
      setTimeout(function () { window.__gcTasLimitReCalc = false; }, 50);
    }
  }

  function revert() {
    gm('skill_list technique.gc-tas-src').removeClass('gc-tas-src');
    gm('skill_list technique.gc-tas-caplim').each(function () { $(this).removeAttr('limit').removeClass('gc-tas-caplim'); });
    gm('spell_list').find('.gc-tas-row').remove();
    gm('spell_list').children('.gc-tas-group').remove();
    var st = document.getElementById('gc-tas-style'); if (st && st.parentNode) st.parentNode.removeChild(st);
  }

  var store = (window.__gcTasOrig = window.__gcTasOrig || {});
  function wrap() {
    if (window.__gcTasWrapped) return true;
    if (typeof window.calcAll !== 'function') return false;
    store.calcAll = window.calcAll;
    window.calcAll = function () {
      var r = store.calcAll.apply(this, arguments);
      try { if (flag(ID, DEF)) reRun(); else revert(); }
      catch (e) { if (window.console) console.warn('[gc-fix:' + ID + '] reRun', e); }
      return r;
    };
    window.__gcTasWrapped = true;
    return true;
  }

  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: true, label: LABEL, hint: HINT,
    apply: function () { ensureStyle(); reRun(); return true; },
    revert: function () { revert(); return true; },
    subs: [
      {
        id: CAP_ID, default: false, recalc: true, label: CAP_LABEL, hint: CAP_HINT,
        apply: function () { reRun(); return true; }, revert: function () { reRun(); return true; }
      },
      {
        id: POINTS_ID, default: false, recalc: true, label: POINTS_LABEL, hint: POINTS_HINT,
        apply: function () { reRun(); return true; }, revert: function () { reRun(); return true; }
      }
    ]
  });

  var tries = 0;
  function run() {
    if (!wrap()) return false;
    if (flag(ID, DEF)) { ensureStyle(); reRun(); } else revert();
    return true;
  }
  if (!run()) { var iv = setInterval(function () { if (run() || ++tries > 60) clearInterval(iv); }, 500); }

  function hintHtml(h) { return " <span class='note' title='" + h.replace(/'/g, '&#39;') + "'><i class='fa fa-question-circle'></i></span>"; }
  function subRow(id, label, hint, onChange) {
    var $r = $("<line id='gc-fixrow-" + id + "' style='margin-left:20px'><label><input type='checkbox' " + (flag(id, false) ? 'checked' : '') + " /> " + label + "</label>" + hintHtml(hint) + "</line>");
    $r.find('input').on('change', function () { setFlag(id, this.checked); onChange(); if (typeof calcAll === 'function') calcAll(); });
    return $r;
  }
  function injectSolo() {
    if (window.gcSnippetsHub) return;
    if (document.getElementById('gc-fixrow-' + ID)) return;
    var $anchor = $('.gc-char-settings #attr-as-disadv').closest('line');
    if (!$anchor.length) return;
    var $prev = $('.gc-char-settings [id^="gc-fixrow-"]').last();
    var $row = $("<line id='gc-fixrow-" + ID + "'><label><input type='checkbox' " + (flag(ID, DEF) ? 'checked' : '') + " /> " + LABEL + "</label>" + hintHtml(HINT) + "</line>");
    $row.find('input').on('change', function () {
      setFlag(ID, this.checked);
      if (this.checked) { ensureStyle(); reRun(); } else revert();
      if (typeof calcAll === 'function') calcAll();
    });
    ($prev.length ? $prev : $anchor).after($row);
    var $cap = subRow(CAP_ID, CAP_LABEL, CAP_HINT, reRun);
    var $pts = subRow(POINTS_ID, POINTS_LABEL, POINTS_HINT, reRun);
    $row.after($cap); $cap.after($pts);
  }
  injectSolo();
  if (!window.__gcTasObs) {
    window.__gcTasObs = true;
    var ti = null;
    new MutationObserver(function () {
      if (ti) return;
      ti = setTimeout(function () { ti = null; injectSolo(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
