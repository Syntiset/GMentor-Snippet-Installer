// ОПЦИОНАЛЬНЫЙ хаб сниппетов в настройках листа. v1.0.2
/* Собирает все установленные сниппеты в одну секцию-менюшку в штатной модалке
   настроек листа (Шестерня справа сверху, там где KYOS). */

(function () {
  'use strict';
  window.gcSnippetsHub = true;
  function flag(id, def) { var v = localStorage.getItem('gc-fix:' + id); return v == null ? !!def : v === '1'; }
  function setFlag(id, on) { localStorage.setItem('gc-fix:' + id, on ? '1' : '0'); }
  function findFix(id) {
    var list = window.gcFixes || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
      if (list[i].sub && list[i].sub.id === id) return list[i].sub;
      var subs = list[i].subs || [];
      for (var j = 0; j < subs.length; j++) if (subs[j].id === id) return subs[j];
    }
    return null;
  }

  function rowHtml(f, isSub) {
    var hint = '';
    if (f.hint) {
      var ht = "class='note' title='" + String(f.hint).replace(/'/g, '&#39;') + "'";
      hint = f.link
        ? " <a " + ht + " href='" + f.link + "' target='_blank' rel='noopener'><i class='fa fa-question-circle'></i></a>"
        : " <span " + ht + "><i class='fa fa-question-circle'></i></span>";
    }
    var style = isSub ? " style='margin-left:20px'" : '';
    return "<line class='gc-fix-row' data-row='" + f.id + "'" + style + "><label><input type='checkbox' class='gc-fix-cb' data-fix='" + f.id + "' " +
           (flag(f.id, f.default) ? 'checked' : '') + " /> " + f.label + "</label>" + hint + "</line>";
  }

  function injectSection() {
    if (document.getElementById('gc-fixes-section')) { updateConditional(); return; }
    var $anchor = $('.gc-char-settings #attr-as-disadv').closest('line');
    if (!$anchor.length) return;
    var fixes = window.gcFixes || [];
    if (!fixes.length) return;

    var rows = fixes.map(function (f) {
      var html = rowHtml(f, false);
      if (f.sub) html += rowHtml(f.sub, true);
      (f.subs || []).forEach(function (s) { html += rowHtml(s, true); });
      return html;
    }).join('');

    var $sec = $(
      "<div id='gc-fixes-section'>" +
        "<h3 class='gc-fixes-head' style='cursor:pointer; user-select:none'>" +
          "<i class='fa fa-caret-down'></i> Фиксы, хоумбрю и прочее <span class='note'>(сниппеты)</span>" +
        "</h3>" +
        "<div class='gc-fixes-body'>" + rows + "</div>" +
      "</div>"
    );

    $sec.find('.gc-fixes-head').on('click', function () {
      $sec.find('.gc-fixes-body').slideToggle(150);
      $(this).find('i').toggleClass('fa-caret-down').toggleClass('fa-caret-right');
    });
    $sec.on('change', '.gc-fix-cb', function () {
      var id = this.getAttribute('data-fix'), on = this.checked;
      setFlag(id, on);
      var f = findFix(id);
      if (!f) return;
      var changed = on ? f.apply() : f.revert();
      if (changed && f.recalc && typeof calcAll === 'function') calcAll();
    });

    $anchor.after($sec);
    updateConditional();
  }

  function updateConditional() {
    var $sec = $('#gc-fixes-section'); if (!$sec.length) return;
    (window.gcFixes || []).forEach(function (f) {
      if (!f.condition) return;
      var show = false; try { show = !!f.condition(); } catch (e) {}
      $sec.find(".gc-fix-row[data-row='" + f.id + "']").toggle(show);
      if (f.sub) $sec.find(".gc-fix-row[data-row='" + f.sub.id + "']").toggle(show);
      (f.subs || []).forEach(function (s) { $sec.find(".gc-fix-row[data-row='" + s.id + "']").toggle(show); });
    });
  }

  injectSection();
  if (!window.__gcSnippetsHubObs) {
    window.__gcSnippetsHubObs = true;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; injectSection(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
