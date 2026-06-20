// ui-fixes — копилка мелких правок интерфейса движка. (v1.0.0)
/* Сейчас внутри два фикса:
   1. Вес в модификации-вкладыше (модификатор веса у предмета, вложенного в
      другой предмет) больше не горит красным: вес применяется правильно,
      подсветка просто врала.
   2. На листах-библиотеках фикс группы предметов (equipment_container)
      приведены к виду обычных предметов. До этого ломалось.

   Чекбокс в настройках листа показывается всегда (по-умолчанию включён):
     • Если нету хаба (snippets-hub): вставляет чекбокс строкой в штатный список
       настроек, под «Снижение атрибутов идёт в лимит недостатков».
     • Если есть хаб: уходит туда же, но в реестр window.gcFixes.
   Состояние — localStorage 'gc-fix:ui-fixes'. */

(function () {
  'use strict';
  var ID = 'ui-fixes', DEF = true, RECALC = true;
  var LABEL = 'UI-фиксы движка';
  var HINT = 'Модификатор веса внутри предмета-модификации не подсвечивается красным: вес применяется корректно, подсветка была ложной. На листах-библиотеках группы предметов выглядят как обычные предметы (ровная колоночная строка вместо развала полей).';
  function flag() { var v = localStorage.getItem('gc-fix:' + ID); return v == null ? DEF : v === '1'; }
  function setFlag(on) { localStorage.setItem('gc-fix:' + ID, on ? '1' : '0'); }

  var LIB_CSS = [
    'body.lib-mode equipment > equipment,body.lib-mode equipment_container > equipment{order:5;flex-basis:100%}',
    'body.lib-mode equipment_container{display:flex;flex-wrap:wrap;align-items:center}',
    'body.lib-mode equipment_container > *{flex:0 0 auto}',
    'body.lib-mode equipment_container > description{flex:1 1 0;min-width:0;width:auto}',
    'body.lib-mode equipment_container > equipment{flex:0 0 100%}',
    'body.lib-mode equipment_container>expander{order:-2}',
    'body.lib-mode equipment_container>gc-container-weight,body.lib-mode equipment_container>gc-container-cost{float:none;order:1;width:auto;min-width:50px;box-sizing:border-box;margin-left:5px}',
    'body.lib-mode equipment_container::after{content:"";order:1;width:33px;margin-left:5px;align-self:stretch;border-left:1px solid rgba(153,153,153,0.2)}',
    'body.lib-mode equipment_container>tech_level,body.lib-mode equipment_container>legality_class{font-size:85%}',
    'body.lib-mode equipment_container>categories{font-size:59.5% !important;margin-right:6px}'
  ].join('\n');
  function ensureLibStyle() {
    if (document.getElementById('gc-uifix-lib')) return;
    var st = document.createElement('style');
    st.id = 'gc-uifix-lib';
    st.textContent = LIB_CSS;
    document.head.appendChild(st);
  }
  function removeLibStyle() {
    var st = document.getElementById('gc-uifix-lib');
    if (st) st.remove();
  }

  function reApply() {
    if (!flag()) return;
    $('character equipment_container > equipment:not([state="not carried"]) > equipment_modifier > weight.gc-warning')
      .removeClass('gc-warning');
    ensureLibStyle();
  }

  function apply() { reApply(); return true; }
  function revert() { removeLibStyle(); return true; }

  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert
  });

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

  reApply();
  injectSolo();
  if (!window.__gcUiFixesObs) {
    window.__gcUiFixesObs = true;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; reApply(); injectSolo(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
})();
