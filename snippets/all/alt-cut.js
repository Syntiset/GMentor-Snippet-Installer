// Альт-таблица swing-урона (GnD: +1 за 2 ST). v1.0.1
/* Хоумбрю: альтернативная таблица swing-урона от noschoolgrognard (Adjusting 
   Swing Damage in Dungeon Fantasy). Swing урон растёт +1 ступень за каждые 2
   ST (медленнее RAW), убирая разрыв с thrust на высоких ST => сильные рубящие
   перестают имбовать.

   Чекбокс в настройках листа показывается всегда (по-умолчанию выключен):
     • Если нету хаба (snippets-hub): вставляет чекбокс строкой в штатный список
       настроек, под «Снижение атрибутов идёт в лимит недостатков».
     • Если есть хаб: уходит туда же, но в реестр window.gcFixes.
   Состояние — localStorage 'gc-fix:alt-cut'. */

(function () {
  'use strict';
  var ID = 'alt-cut', DEF = false, RECALC = true;
  var LABEL = 'Альт-таблица swing-урона (GnD: +1 за 2 ST)';
  var HINT = 'Только режущий (swing) урон растёт +1 за каждые 2 ST (noschoolgrognard / reduced swing damage). Thrust не меняется. Снижает имбовость сильных рубящих. Перекрывает swing-ветку KYOS.';
  function flag() { var v = localStorage.getItem('gc-fix:' + ID); return v == null ? DEF : v === '1'; }
  function setFlag(on) { localStorage.setItem('gc-fix:' + ID, on ? '1' : '0'); }
  var LADDER = ['1d-2', '1d-1', '1d', '1d+1', '1d+2', '2d-1', '2d', '2d+1', '2d+2',
                '3d-1', '3d', '3d+1', '3d+2', '4d-1', '4d', '4d+1', '4d+2',
                '5d-1', '5d', '5d+1', '5d+2', '6d-1', '6d', '6d+1', '6d+2', '7d-1', '7d'];
  function ladder(i) { return LADDER[i < 0 ? 0 : (i >= LADDER.length ? LADDER.length - 1 : i)]; }
  function altSwing(st) {
    st = Math.round(Number(st) || 0);
    return ladder(2 + Math.floor((st - 10) / 2));
  }
  function apply() {
    if (window.__gcAltDmgOn) return false;
    if (typeof window.getSw !== 'function') return false;
    if (window.__gcSwOrig == null) window.__gcSwOrig = window.getSw;
    window.getSw = function (st) { return altSwing(st); };
    window.__gcAltDmgOn = true;
    return true;
  }
  function revert() {
    if (!window.__gcAltDmgOn) return false;
    if (window.__gcSwOrig) { window.getSw = window.__gcSwOrig; }
    window.__gcAltDmgOn = false;
    return true;
  }
  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert
  });
  var tries = 0;
  function run() {
    if (typeof window.getSw !== 'function') return false;
    var changed = flag() ? apply() : revert();
    if (changed && flag() && typeof calcAllSchedule === 'function') calcAllSchedule();
    return true;
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
  if (!window.__gcAltCutObs) {
    window.__gcAltCutObs = true;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; injectSolo(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
