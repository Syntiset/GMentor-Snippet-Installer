// Cost Factor: сложение модификаторов цены из Low-Tech. (v1.0.0)
/* Если вы знаете про Cost Factor, то зачем сюда заглядываете?))
   Ладно, теперь без шуток: в редактор модификаторов добавляет новый тип для раздела
   Цена. CF работает по правилам из LT14, при добавлении модификатора к предмету 
   отображает бейдж «Σ CF» с возможностью регулировки порога (стандартный -0.8). */
(function () {
  'use strict';
  (window.gcSnippetMeta = window.gcSnippetMeta || {})['cf-mod'] = {
    label: "Cost Factor (LT)",
    desc: "Добавляет тип «Cost Factor» в редакторе МОДИФИКАТОРА, а так же " +
          "бейдж «Σ CF» у предмета, порог выставляется кликом по бейджу.",
    category: "feature"
  };
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has('cf-mod')) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  var gi = window.gcInternal;

  var CFTYPE = 'cost factor';
  var FLOOR = -0.8;

  function floorVal() {
    var $t = (typeof gm === 'function') ? gm('gc-cf-floor') : $();
    var v = $t.length ? parseFloat($t.text()) : NaN;
    return isNaN(v) ? FLOOR : v;
  }
  function setFloorVal(v) {
    var $t = gm('gc-cf-floor');
    if (!$t.length) $t = $('<gc-cf-floor></gc-cf-floor>').appendTo(globalChar);
    $t.text(v);
  }
  function syncFloor() { window.__gcCfFloor = floorVal(); }
  syncFloor();

  function applyCore() {
    if (gi.patched.getEquipmentValue_cf) return;
    if (typeof window.getEquipmentValue !== 'function') return;
    var src = window.getEquipmentValue.toString();
    var p1 = src.replace(/var quantity=\$\(obj\)\.find\(">quantity"\)\.int\(\);/,
      'var __gcCf=0,__gcCfHas=false;$&');
    if (p1 === src) return;
    var p2 = p1.replace(/ret\s*=\s*modifyFieldByTag\s*\(\s*ret\s*,\s*\$\(this\)\)\s*;/,
      'var __gcM=$(this);if((__gcM.attr("type")||"")=="' + CFTYPE + '"){__gcCf+=parseFloat(__gcM.text())||0;__gcCfHas=true;}else ret=modifyFieldByTag(ret,__gcM);');
    if (p2 === p1) return;
    var p3 = p2.replace(/(ret=modifyFieldByTag\(ret,__gcM\);)\s*\}\)\s*;\s*return ret;/,
      '$1});if(__gcCfHas){var __fl=(window.__gcCfFloor!=null?window.__gcCfFloor:' + FLOOR + ');if(__gcCf<__fl)__gcCf=__fl;ret=Math.round(ret*(1+__gcCf)*1e6)/1e6;}return ret;');
    if (p3 === p2) return;
    var fn;
    try { fn = eval('(' + p3 + ')'); }
    catch (e) { if (window.console) console.error('[gc:cf-mod] eval', e); return; }
    if (typeof fn !== 'function') return;
    window.getEquipmentValue = fn;
    gi.patched.getEquipmentValue_cf = true;
  }

  function injectTypeOption() {
    $('modalpopup object-edit equipment_modifier > value > type select').each(function () {
      var $sel = $(this);
      if (!$sel.find('option[value="' + CFTYPE + '"]').length) {
        $sel.append('<option value="' + CFTYPE + '">Cost Factor (CF)</option>');
      }
    });
  }

  function openFloorEdit() {
    if (typeof modalPopup !== 'function') return;
    var cur = floorVal();
    var html = "<h4>Порог Cost Factor</h4>"
      + "<p>Суммарный CF не опускается ниже порога. По RAW LT14: −0.8 (цена ≥20% базы). "
      + "Напр. −0.6 (Monster Hunters), −0.9 (Pyramid «Broken Blade»), 0 — без снижения.</p>"
      + "<line><center>Порог: <input type='number' step='0.1' class='gc-cf-floor-inp' style='width:70px' value='" + cur + "'></center></line>";
    modalPopup(html, 'Применить', 'Отмена', function () {
      var v = parseFloat($('.gc-cf-floor-inp').val());
      if (isNaN(v)) v = FLOOR;
      setFloorVal(v); syncFloor();
      if (typeof saveButtonEnable === 'function') saveButtonEnable();
      if (typeof calcAll === 'function') calcAll();
    });
  }

  function injectCfBadge() {
    var floor = (window.__gcCfFloor != null ? window.__gcCfFloor : FLOOR);
    var seen = [];
    $('character equipment_container, character equipment').each(function () {
      var $owner = $(this);
      var $cfVals = $owner.children('equipment').children('equipment_modifier').children('value[type="' + CFTYPE + '"]');
      if (!$cfVals.length) return;
      var sum = 0; $cfVals.each(function () { sum += parseFloat($(this).text()) || 0; });
      var floored = sum < floor;
      var eff = floored ? floor : sum;
      var mult = Math.round((1 + eff) * 100) / 100;
      var txt = 'Σ CF ' + (sum >= 0 ? '+' : '') + (Math.round(sum * 100) / 100) + ' → ×' + mult + (floored ? ' (порог ' + floor + ')' : '');
      var $anchor = $owner.children('description, description-loc').first();
      if (!$anchor.length) return;
      var $b = $anchor.children('.gc-cf-badge');
      if (!$b.length) {
        $b = $('<span class="gc-cf-badge nosave" title="Cost Factor предмета. Клик — изменить порог"></span>');
        /* Важное гашение mousedown: бейдж находится внутри <description class="editable">, 
           иначе editable перехватывает mousedown раньше клика и модалка не откроется. */
        $b.on('mousedown dblclick', function (e) { e.stopPropagation(); e.preventDefault(); });
        $b.on('click', function (e) { e.stopPropagation(); e.preventDefault(); openFloorEdit(); });
        $anchor.append($b);
      }
      $b.text(txt).toggleClass('gc-cf-floored', floored);
      seen.push($owner[0]);
    });
    // Снос бейджа, если предмет без CF
    $('.gc-cf-badge').each(function () {
      var own = $(this).closest('equipment_container, equipment')[0];
      if (seen.indexOf(own) < 0) $(this).remove();
    });
  }

  applyCore();

  function tick() {
    syncFloor();
    injectTypeOption();
    injectCfBadge();
  }
  if (!gi.bound.cfUi) {
    gi.bound.cfUi = true;
    tick();
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; tick(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
