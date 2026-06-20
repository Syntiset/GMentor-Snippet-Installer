// Фикс-сниппет из пожеланий на сайте. v1.0.1
/* Багфикс урона «за куб» в модалке контактной атаки (toolMeleeAttack).
   Weapon Master и All-Out Attack (Strong) дают бонус за каждый куб урона. Движок
   множит его на кубы ИТОГОВОГО урона оружия (после конвертации sw+N → +1d), а
   по правилам куб считается от базового Thrust/Swing.
     ST 20 → swing 3d+2 (3 куба). Двуручник с sw+3 → 4d+1 (4 куба).
     WM(+2/куб)+AoA Strong: движок 4x2+4 = 4d+13; правильно 3x2+3 = 4d+10.

   Чекбокс в настройках листа показывается всегда (по-умолчанию выключен):
     • Если нету хаба (snippets-hub): вставляет чекбокс строкой в штатный список
       настроек, под «Снижение атрибутов идёт в лимит недостатков».
     • Если есть хаб: уходит туда же, но в реестр window.gcFixes.
   Состояние — localStorage 'gc-fix:perdie'.

   Как сниппет это фиксит: баг в приватном замыкании calcIt — берём исходник toolMeleeAttack
   в рантайме (toString), заменяем РОВНО 2 подстроки на __gcMeleeBaseDice() → eval.
   Фэйлобезопасно: якоря не найдены (изменение в движке) => функция не трогается. */

(function () {
  'use strict';
  var ID = 'perdie', DEF = true, RECALC = false;
  var LABEL = 'Урон «за куб» от базового броска';
  var HINT = 'Weapon Master / Тотальная атака сильная: бонус «за куб» от кубов базового Thrust/Swing, а не итогового урона оружия.';
  function flag() { var v = localStorage.getItem('gc-fix:' + ID); return v == null ? DEF : v === '1'; }
  function setFlag(on) { localStorage.setItem('gc-fix:' + ID, on ? '1' : '0'); }
  window.__gcMeleeBaseDice = function (obj, dmgObj) {
    try {
      var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
      var $w = $(obj);
      var weaponDmg = norm($w.find('>damage-result:not(.gc-source-value)').text()
                        || $w.find('>damage:not(.gc-source-value)').text());
      var fieldDmg = norm($('modalpopup damage').text());
      if (weaponDmg && fieldDmg && weaponDmg !== fieldDmg) return dmgObj.dices;
      var raw = norm($w.find('>damage:not(.gc-source-value)').text());
      var m = /\b(sw|thr)\b/i.exec(raw);
      if (m) {
        var mod = m[1].toLowerCase();
        var ss = parseInt($w.find('>self_strength:not(.gc-source-value)').text(), 10) || 0;
        var baseStr = (ss > 0) ? ((mod === 'sw') ? getSw(ss) : getThr(ss))
                               : $(mod === 'sw' ? 'damages damage-sw' : 'damages damage-thr').text();
        var n = getBaseDice(baseStr);
        if (n > 0) return n;
      }
    } catch (e) { if (window.console) console.error('[gc-fix:perdie]', e); }
    return dmgObj.dices;
  };

  var injectedVia = null, preOrig = null, injectedFn = null;
  function pickTarget() {
    var store = window.__gcAtkOrig;
    if (store && typeof store.toolMeleeAttack === 'function') return 'store';
    if (typeof window.toolMeleeAttack === 'function') return 'window';
    return null;
  }
  function getFn(via) { return via === 'store' ? window.__gcAtkOrig.toolMeleeAttack : window.toolMeleeAttack; }
  function setFn(via, fn) { if (via === 'store') window.__gcAtkOrig.toolMeleeAttack = fn; else window.toolMeleeAttack = fn; }
  function apply() {
    if (window.__gcPerDieInjected) return false;
    var via = pickTarget();
    if (!via) return false;
    var src = getFn(via).toString();
    var patched = src
      .replace('dmgObj.dices*$("#c_wm_val").val()',
               '__gcMeleeBaseDice(obj,dmgObj)*$("#c_wm_val").val()')
      .replace('dmgObj.dices>2?dmgObj.dices:2',
               '(function(d){return d>2?d:2;})(__gcMeleeBaseDice(obj,dmgObj))');
    if (patched === src) return false;
    var fn;
    try { fn = eval('(' + patched + ')'); }
    catch (e) { if (window.console) console.error('[gc-fix:perdie] eval', e); return false; }
    if (typeof fn !== 'function') return false;
    injectedVia = via; preOrig = getFn(via); injectedFn = fn;
    setFn(via, fn);
    window.__gcPerDieInjected = true;
    return true;
  }
  function revert() {
    if (!window.__gcPerDieInjected) return false;
    var via = null;
    if (injectedVia != null && getFn(injectedVia) === injectedFn) via = injectedVia;
    else if (window.__gcAtkOrig && window.__gcAtkOrig.toolMeleeAttack === injectedFn) via = 'store';
    else if (window.toolMeleeAttack === injectedFn) via = 'window';
    var ok = via != null;
    if (ok) setFn(via, preOrig);
    injectedVia = null; preOrig = null; injectedFn = null; window.__gcPerDieInjected = false;
    return ok;
  }
  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert
  });
  var tries = 0;
  function run() {
    if (!pickTarget()) return false;
    if (!flag()) { revert(); return true; }
    if (window.__gcPerDieInjected) return true;
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
  if (!window.__gcPerdieObs) {
    window.__gcPerdieObs = true;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; injectSolo(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
