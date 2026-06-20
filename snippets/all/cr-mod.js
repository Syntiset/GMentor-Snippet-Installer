// Сниппет учёта состояний в бросках самоконтроля. v1.0.1
/* Что сниппет исправляет: при броске самоконтроля суммирует штрафы из ВСЕХ
   активных (добавленных) состояний (парсит Самоконтроль +-N в notes) и
   прибавляет к броску (напр. Опьянение −4 и Эйфория −3 = −7). В модалке CR-
   броска появляется строка «Самоконтроль от состояний: −7 (Опьянение, Эйфория)».

   Чекбокс в настройках листа показывается всегда (по-умолчанию выключен):
     • Если нету хаба (snippets-hub): вставляет чекбокс строкой в штатный список
       настроек, под «Снижение атрибутов идёт в лимит недостатков».
     • Если есть хаб: уходит туда же, но в реестр window.gcFixes.
   Состояние — localStorage 'gc-fix:cr-mod'.

   Как сниппет это фиксит: патчит toolSkillRoll (общая для умений и самоконтроля; 
   CR помечен классом spinner-control-roll → isControlRoll):
     1) HTML — после поля Модификатор строка с авто-показом штрафа (для CR).
     2) Расчёт — к итогу броска прибавляем сумму штрафов самоконтроля из активных
        состояний, только при isControlRoll.
     3) Показ — строка отображается только если штраф присутствует.
   Фэйлобезопасно: якоря не найдены (изменение в движке) => функция не трогается. */

(function () {
  'use strict';
  var ID = 'cr-mod', DEF = false, RECALC = false;
  var LABEL = 'Учёт состояний в бросках самоконтроля';
  var HINT = 'Активное состояние со штрафом самоконтроля в описании автоматически применяется ко всем броскам самоконтроля недостатков. Движок сам учитывает только атрибутные модификаторы состояния, не самоконтроль.';
  var CR_RE = /амоконтрол[^\d+\-]*([+\-]?\d+)/i;
  function flag() { var v = localStorage.getItem('gc-fix:' + ID); return v == null ? DEF : v === '1'; }
  function setFlag(on) { localStorage.setItem('gc-fix:' + ID, on ? '1' : '0'); }
  window.__gcCrFromConditions = function () {
    var sum = 0, names = [];
    $('condition_list advantage[condition="yes"]').each(function () {
      var $c = $(this);
      var m = CR_RE.exec($c.find('>notes').text());
      if (m) { sum += parseInt(m[1], 10); names.push($c.find('>name-loc').text() || $c.find('>name').text()); }
    });
    return { sum: sum, names: names };
  };

  var HTML_FIND = ', модификатор <var id=\'c_mod\' class=\'editable spinner\'>0</var></line>';
  var HTML_ADD = "\n    <line id='c_cr_auto_block' style='display:none'>Самоконтроль от состояний: <var id='c_cr_auto'>0</var><span id='c_cr_auto_names' class='note'></span></line>";
  var RES_FIND = 'var res=$("#c_skill_level").int()+$("#c_mod").int()+$("#c_time").val()*1;';
  var RES_REPL = 'var res=$("#c_skill_level").int()+$("#c_mod").int()+$("#c_time").val()*1+(isControlRoll&&window.__gcCrFromConditions?window.__gcCrFromConditions().sum:0);';
  var SHOW_FIND = 'if (isControlRoll) $("#c_time_block").hide();';
  var SHOW_ADD = ' if (isControlRoll && window.__gcCrFromConditions){ var __cr=window.__gcCrFromConditions(); if(__cr.sum!==0){ $("#c_cr_auto").text(__cr.sum); $("#c_cr_auto_names").text(__cr.names.length?(" ("+__cr.names.join(", ")+")"):""); $("#c_cr_auto_block").show(); } else { $("#c_cr_auto_block").hide(); } }';
  var orig = null;
  function apply() {
    if (window.__gcCrModPatched) return false;
    if (typeof window.toolSkillRoll !== 'function') return false;
    var src = window.toolSkillRoll.toString();
    var patched = src
      .replace(HTML_FIND, function (m) { return m + HTML_ADD; })
      .replace(RES_FIND, function () { return RES_REPL; })
      .replace(SHOW_FIND, function (m) { return m + SHOW_ADD; });
    if (patched === src) return false;
    var fn;
    try { fn = eval('(' + patched + ')'); }
    catch (e) { if (window.console) console.error('[gc-fix:cr-mod] eval', e); return false; }
    if (typeof fn !== 'function') return false;
    orig = window.toolSkillRoll;
    window.toolSkillRoll = fn;
    window.__gcCrModPatched = true;
    return true;
  }
  function revert() {
    if (!orig) return false;
    window.toolSkillRoll = orig; orig = null; window.__gcCrModPatched = false;
    return true;
  }

  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert
  });

  var tries = 0;
  function run() {
    if (typeof window.toolSkillRoll !== 'function') return false;
    if (!flag()) { revert(); return true; }
    if (window.__gcCrModPatched) return true;
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
  if (!window.__gcCrModObs) {
    window.__gcCrModObs = true;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; injectSolo(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
