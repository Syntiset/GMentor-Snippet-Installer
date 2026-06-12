// sub-location — зоны подлокаций для модалки бросков. v1.0.0
/* Добавляет в модалку бросков кнопку слева сверху (около кнопки Discord).

   Почему теперь тут: на общих (не-кастомных) листах нет слота <gc-script>,
   поэтому кастом. сниппеты туда не поставить. Этот модуль патчит модалку атаки
   на ЛЮБОМ листе персонажа.

   Модуль SUB-LOCATION (подлокации попадания):
     При попадании в Рука/Нога/Лицо дописывает в результат атаки конкретную
     подзону. Режимы: LT100 (универсально) / свои подтаблицы / выкл.

   Свои зоны попадания:
     Можно добавить свою зону (название + to-hit) - она инжектится в <select>
     атаки (c_location) через патч window.toolsLocationsSelect. Название в
     результате атаки рендерится движком через CSS ::before — для своих зон
     движок правил не объявляет, поэтому самописный инжект (patchZoneNamesCss).
     Опционально свои зоны участвуют в броске «Случайное место».

   Механика (по tools.js): движок зовёт toolLocationsTexts(damage, location,
   specialTarget) с уже развёрнутым location (random → getRandomLocation,
   split('/')). Имя зоны в результате — <gc-location name="X"> + CSS ::before. */

(function () {
  'use strict';
  var LS = {
    mode:         'gc-char-tools:subloc:mode',     // 'lt100' | 'custom' | 'off'
    custom:       'gc-char-tools:subloc:custom',   // JSON: { code: {1:'...',...,6:'...'} }
    coverage:     'gc-char-tools:subloc:coverage', // '1'|'0' — подсказка частичной брони (только для mode:LT100)
    zones:        'gc-char-tools:zones',           // JSON: [ {code, label, toHit} ]
    randomCustom: 'gc-char-tools:zones:random'     // '1'|'0' — свои зоны в «Случайное место»
  };

  var DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  var ZONE_LABELS = {
    arms:  'Рука',
    legs:  'Нога',
    skull: 'Череп',
    face:  'Лицо',
    torso: 'Торс',
    neck:  'Шея',
    hands: 'Кисть',
    feet:  'Стопа'
  };

  // LT100: универсальные подтаблицы (1d6), RAW.
  var LT100 = {
    arms: { 1:'Предплечье', 2:'Предплечье', 3:'Предплечье', 4:'Локоть', 5:'Верхняя часть руки', 6:'Плечо' },
    legs: { 1:'Голень', 2:'Голень', 3:'Голень', 4:'Колено', 5:'Бедро', 6:'Бедро' },
    face: { 1:'Челюсть', 2:'Нос', 3:'Ухо', 4:'Щека', 5:'Щека', 6:'Глаз' }
  };

  /* Armor coverage (RAW Low-Tech): какой элемент брони покрывает подзону.
     Только подсказка (DR вводится вручную). Режим LT100 + чекбокс coverage. */
  var COVERAGE = {
    'Предплечье':          'Наруч (bracer)',
    'Локоть':              'Налокотник (couter)',
    'Верхняя часть руки':  'Наплечье верхнее (rerebrace)',
    'Плечо':               'Наплечье (pauldron)',
    'Голень':              'Поножи (greave)',
    'Колено':              'Наколенник (poleyn)',
    'Бедро':               'Набедренник (cuisse)'
  };

  function isCharSheet() {
    return !!document.body &&
           !document.body.classList.contains('board-mode') &&
           typeof window.toolLocationsTexts === 'function';
  }

  function esc(s) {
    return (s + '').replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function getMode() { return localStorage.getItem(LS.mode) || 'lt100'; }
  function setMode(m) { localStorage.setItem(LS.mode, m); }

  function getCoverage() { return localStorage.getItem(LS.coverage) === '1'; }
  function setCoverage(on) { localStorage.setItem(LS.coverage, on ? '1' : '0'); }

  function getRandomCustom() { return localStorage.getItem(LS.randomCustom) === '1'; }
  function setRandomCustom(on) { localStorage.setItem(LS.randomCustom, on ? '1' : '0'); }

  function getCustom() {
    try { var raw = localStorage.getItem(LS.custom); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function setCustom(obj) {
    if (obj && Object.keys(obj).length) localStorage.setItem(LS.custom, JSON.stringify(obj));
    else localStorage.removeItem(LS.custom);
  }

  function getZones() {
    try { var raw = localStorage.getItem(LS.zones); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function setZones(arr) {
    if (arr && arr.length) localStorage.setItem(LS.zones, JSON.stringify(arr));
    else localStorage.removeItem(LS.zones);
  }

  function nextZoneCode(taken) {
    var n = 1;
    while (taken['czone-' + n]) n++;
    return 'czone-' + n;
  }

  // Патчи движка.
  /* toolsLocationsSelect → оригинал + свои зоны (идемпотентно, из сохранённого
     оригинала). Своя зона появляется в <select id=c_location> модалки атаки. */
  function patchLocationSelect() {
    if (typeof window.toolsLocationsSelect !== 'string') return;
    if (!window.__gcCtLocTplOrig) window.__gcCtLocTplOrig = window.toolsLocationsSelect;
    var tpl = window.__gcCtLocTplOrig;
    var zones = getZones();
    if (zones.length) {
      var extra = '';
      zones.forEach(function (z) {
        if (!z || !z.code) return;
        var th = (z.toHit != null && z.toHit !== '') ? z.toHit : 0;
        extra += "\n    <option value=\"" + th + "\" location=\"" + z.code + "\">" +
                 esc(z.label || z.code) + " (" + th + ")</option>";
      });
      if (extra) tpl = tpl.replace(/<\/select>/i, extra + "\n</select>");
    }
    window.toolsLocationsSelect = tpl;
  }
  /* Имя зоны в результате атаки рендерится через CSS:
       locations-list location[name='X']::before,
       .mentor tool gc-location[name='X']::before { content: 'Имя' }
     Движок объявил правила только для стандартных зон. Для своих (czone-N)
     сделал инжект такого же правила, иначе название пустое (будет писать "в ___"). */
  function patchZoneNamesCss() {
    var zones = getZones();
    var st = document.getElementById('gc-ct-zone-names');
    if (!zones.length) { if (st) st.remove(); return; }
    if (!st) {
      st = document.createElement('style');
      st.id = 'gc-ct-zone-names';
      st.className = 'nosave';
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent = zones.map(function (z) {
      if (!z || !z.code) return '';
      var lbl = (z.label || z.code).replace(/'/g, "\\'");
      return "locations-list location[name='" + z.code + "']::before," +
             ".mentor tool gc-location[name='" + z.code + "']::before{content:'" + lbl + "'}";
    }).join('\n');
  }

  function tableFor(code) {
    var mode = getMode();
    if (mode === 'off') return null;
    if (mode === 'custom') return getCustom()[code] || null;
    return LT100[code] || null;
  }

  function rollSubLocation(code) {
    var tbl = tableFor(code);
    if (!tbl) return null;
    var r = 1 + Math.floor(Math.random() * 6);
    var name = tbl[r] || tbl[String(r)];
    return name ? { roll: r, name: name } : null;
  }

  /* Учёт своих зон в месте случайного попадания. Кастом зоны добавляются к телу
     ПО ВЕСУ их to-hit (мелкая зона = редкое попадание, RAW-логика), а не 50/50.
     Вес кастомной зоны в слотах 3d6 по её to-hit.
     Калибровка по таблице движка (functions.js getRandomLocation + tools.js). */
  var BODY_SLOTS = 216;
  var TOHIT_WEIGHT = { '0':52, '-1':35, '-2':23, '-3':18, '-4':10, '-5':6, '-6':5, '-7':4, '-8':2, '-9':1 };
  function zoneWeight(toHit) {
    var t = parseInt(toHit, 10);
    if (isNaN(t)) t = -2;
    if (t > 0) t = 0;
    if (t < -9) return 1;
    var w = TOHIT_WEIGHT[String(t)];
    return w != null ? w : 1;
  }

  function patchRandomLocation() {
    if (window.__gcCtRandPatched) return;
    if (typeof window.getRandomLocation !== 'function') return;
    window.__gcCtRandPatched = true;

    var store = (window.__gcRandOrig = window.__gcRandOrig || {});
    store.getRandomLocation = window.getRandomLocation;
    window.getRandomLocation = function () {
      if (getRandomCustom()) {
        var zones = getZones();
        if (zones.length) {
          var weights = zones.map(function (z) { return zoneWeight(z.toHit); });
          var totalCustom = weights.reduce(function (a, b) { return a + b; }, 0);
          var pick = Math.random() * (BODY_SLOTS + totalCustom);
          if (pick >= BODY_SLOTS) {
            var acc = BODY_SLOTS;
            for (var i = 0; i < zones.length; i++) {
              acc += weights[i];
              if (pick < acc) return zones[i].code;
            }
          }
        }
      }
      return store.getRandomLocation.apply(this, arguments);
    };
  }

  // Дописывание подлокации в результат атаки.
  function patchLocationsTexts() {
    if (window.__gcCtSubLocPatched) return;
    if (typeof window.toolLocationsTexts !== 'function') return;
    window.__gcCtSubLocPatched = true;

    var orig = window.toolLocationsTexts;
    window.toolLocationsTexts = function (damage, location, specialTargetType) {
      var res = orig.apply(this, arguments);
      try {
        var sub = location ? rollSubLocation(location) : null;
        if (sub) {
          var face = DICE[sub.roll - 1] || sub.roll;
          var bt = "<span style='display:none'>`</span>";
          var cov = '';
          if (getMode() === 'lt100' && getCoverage() && COVERAGE[sub.name]) {
            cov = " <span class='gc-subloc-armor' style='opacity:0.7'>— покрытие: " +
                  COVERAGE[sub.name] + "</span>";
          }
          res += "<br><gc-sublocation>Подлокация (" + face + " = " + bt + sub.roll + bt +
                 "): <b>" + sub.name + "</b>" + cov + "</gc-sublocation>";
        }
      } catch (e) { if (window.console) console.error('[char-tools:subloc]', e); }
      return res;
    };
  }

  function ensureHideStyle() {
    if (document.getElementById('gc-ct-hide-style')) return;
    var st = document.createElement('style');
    st.id = 'gc-ct-hide-style';
    st.className = 'nosave';
    st.textContent = 'gc-sublocation{display:block;opacity:0.85;font-size:0.95em}';
    (document.head || document.documentElement).appendChild(st);
  }

  // Своя модалка поверх движковой.
  function showOverlay(content, saveCb, initCb) {
    var $scrim = $("<div id='gc-ct-overlay' style='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)'></div>");
    content.find('char-xml').css({
      background: 'var(--color-bg,#fff)', color: 'var(--color-text,#000)',
      borderRadius: '8px', padding: '16px', maxHeight: '90vh', overflow: 'auto',
      boxShadow: '0 10px 40px rgba(0,0,0,.35)'
    });
    content.find('.gc-ct-modal').append(
      "<div style='display:flex;gap:8px;justify-content:flex-end;margin-top:14px'>" +
      "<button type='button' class='btn secondary gc-ct-cancel'>Отмена</button>" +
      "<button type='button' class='btn gc-ct-save'>Сохранить</button></div>"
    );
    $scrim.append(content).appendTo('body');
    function close() { $scrim.remove(); }
    $scrim.find('.gc-ct-save').on('click', function () { saveCb(); close(); });
    $scrim.find('.gc-ct-cancel').on('click', close);
    $scrim.on('mousedown', function (e) { if (e.target === $scrim[0]) close(); });
    if (initCb) initCb();
  }

  function openSettings() {
    if (document.getElementById('gc-ct-overlay')) return;

    var mode = getMode();
    var draft = getCustom();
    var editingZone = null;
    var zonesDraft = getZones().map(function (z) { return { code:z.code, label:z.label, toHit:z.toHit }; });

    function allZoneLabels() {
      var map = {};
      Object.keys(ZONE_LABELS).forEach(function (c) { map[c] = ZONE_LABELS[c]; });
      zonesDraft.forEach(function (z) { if (z && z.code) map[z.code] = z.label || z.code; });
      return map;
    }
    function zoneOptionsHtml() {
      var map = allZoneLabels();
      return Object.keys(map).map(function (code) {
        return "<option value='" + code + "'>" + esc(map[code]) + "</option>";
      }).join('');
    }

    function renderZoneEditor($w) {
      var code = $w.find('.gc-ct-zone-select').val();
      var tbl = (code && draft[code]) || {};
      var rows = '';
      for (var i = 1; i <= 6; i++) {
        rows += "<div style='display:flex;align-items:center;gap:8px;margin:3px 0'>" +
          "<span style='width:28px;font-size:16px'>" + DICE[i-1] + "</span>" +
          "<span style='width:18px;opacity:0.6'>" + i + "</span>" +
          "<input type='text' class='gc-ct-cell' data-roll='" + i + "' value='" + esc(tbl[i] || tbl[String(i)] || '') + "' " +
          "style='flex:1;padding:3px 6px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-border);border-radius:3px'>" +
        "</div>";
      }
      $w.find('.gc-ct-editor').html(rows);
      editingZone = code;
    }
    function commitEditor($w) {
      var code = editingZone;
      if (!code) return;
      var tbl = {};
      $w.find('.gc-ct-cell').each(function () {
        var v = ($(this).val() || '').trim();
        if (v) tbl[$(this).data('roll')] = v;
      });
      if (Object.keys(tbl).length) draft[code] = tbl;
      else delete draft[code];
    }
    function renderChips($w) {
      var labels = allZoneLabels();
      var codes = Object.keys(draft);
      $w.find('.gc-ct-chips').html(
        codes.length
          ? codes.map(function (code) {
              return "<span style='display:inline-flex;align-items:center;gap:4px;margin:2px;padding:2px 6px;" +
                "border:1px solid var(--color-border);border-radius:12px;font-size:12px'>" +
                esc(labels[code] || code) + " <b class='gc-ct-chip-del' data-code='" + code + "' style='cursor:pointer;color:#d66'>×</b></span>";
            }).join('')
          : "<span style='opacity:0.5'>пока пусто</span>"
      );
    }
    function renderZonesList($w) {
      $w.find('.gc-ct-zones-list').html(
        zonesDraft.length
          ? zonesDraft.map(function (z) {
              return "<span style='display:inline-flex;align-items:center;gap:4px;margin:2px;padding:2px 6px;" +
                "border:1px solid var(--color-border);border-radius:12px;font-size:12px'>" +
                esc(z.label) + " (" + z.toHit + ") <b class='gc-ct-zone-del' data-code='" + z.code + "' style='cursor:pointer;color:#d66'>×</b></span>";
            }).join('')
          : "<span style='opacity:0.5;font-size:12px'>пока нет своих зон</span>"
      );
    }
    function rebuildZoneSelect($w) {
      var sel = $w.find('.gc-ct-zone-select');
      var cur = sel.val();
      sel.html(zoneOptionsHtml());
      if (cur && sel.find("option[value='" + cur + "']").length) sel.val(cur);
    }
    function syncVisibility($w) {
      var m = $w.find('input[name="gc-ct-mode"]:checked').val();
      $w.find('.gc-ct-lt100-block').css('display', m === 'lt100' ? 'block' : 'none');
      $w.find('.gc-ct-custom-block').css('display', m === 'custom' ? 'block' : 'none');
    }

    var html =
      "<div class='mentor'><char-xml style='display:block'><div class='gc-ct-modal' style='min-width:340px'>" +
        "<h2 style='margin:0 0 10px'>Подлокации при атаке</h2>" +

        "<label style='display:block;margin:5px 0;cursor:pointer'>" +
          "<input type='radio' name='gc-ct-mode' value='lt100'" + (mode==='lt100'?' checked':'') + "> " +
          "LT100 — универсально для человекоподобных</label>" +
        // Чекбокс armor coverage: доп. опция LT100 (видна ток при вкл LT100).
        "<div class='gc-ct-lt100-block' style='margin:0 0 5px'>" +
          "<label style='cursor:pointer;font-size:13px'>" +
            "<input type='checkbox' class='gc-ct-coverage'" + (getCoverage()?' checked':'') + "> " +
            "Учитывать частичную броню (подсказка по покрытию)</label>" +
        "</div>" +
        "<label style='display:block;margin:5px 0;cursor:pointer'>" +
          "<input type='radio' name='gc-ct-mode' value='custom'" + (mode==='custom'?' checked':'') + "> " +
          "Свои подтаблицы</label>" +
        "<label style='display:block;margin:5px 0;cursor:pointer'>" +
          "<input type='radio' name='gc-ct-mode' value='off'" + (mode==='off'?' checked':'') + "> " +
          "Выключено</label>" +

        // Свои зоны попадания.
        "<div style='margin-top:12px;border-top:1px solid var(--color-border);padding-top:10px'>" +
          "<div style='font-weight:bold;margin-bottom:4px'>Свои зоны попадания</div>" +
          "<div style='opacity:0.7;font-size:11px;margin-bottom:6px'>Добавятся в список локаций модалки атаки (на любом листе).</div>" +
          "<div style='display:flex;gap:6px;margin-bottom:6px'>" +
            "<input type='text' class='gc-ct-zone-name' placeholder='Название (напр. Крыло)' " +
              "style='flex:1;padding:3px 6px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-border);border-radius:3px'>" +
            "<input type='number' class='gc-ct-zone-tohit' value='-2' title='to-hit' " +
              "style='width:60px;padding:3px 6px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-border);border-radius:3px'>" +
            "<button type='button' class='btn gc-ct-zone-add'>+</button>" +
          "</div>" +
          "<div class='gc-ct-zones-list'></div>" +
          "<label style='display:block;margin-top:8px;cursor:pointer;font-size:13px'>" +
            "<input type='checkbox' class='gc-ct-random-custom'" + (getRandomCustom()?' checked':'') + "> " +
            "Учитывать свои зоны в «Случайном месте»</label>" +
        "</div>" +

        // Редактор подтаблиц, в режиме кастомных подлок.
        "<div class='gc-ct-custom-block' style='margin-top:12px;border-top:1px solid var(--color-border);padding-top:10px'>" +
          "<div style='font-weight:bold;margin-bottom:6px'>Свои подтаблицы (1d6)</div>" +
          "<div style='display:flex;align-items:center;gap:8px;margin-bottom:6px'>" +
            "<span>Зона:</span>" +
            "<select class='gc-ct-zone-select' style='flex:1;padding:3px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-border);border-radius:3px'>" +
              zoneOptionsHtml() +
            "</select>" +
          "</div>" +
          "<div class='gc-ct-editor'></div>" +
          "<div style='margin-top:8px;opacity:0.7;font-size:11px'>Пустые грани игнорируются. Заданные подтаблицы:</div>" +
          "<div class='gc-ct-chips' style='margin-top:4px'></div>" +
        "</div>" +

      "</div></char-xml></div>";

    var $w = $(html);

    showOverlay($w, function () {
      commitEditor($w);
      setMode($w.find('input[name="gc-ct-mode"]:checked').val() || 'lt100');
      setCoverage($w.find('.gc-ct-coverage').is(':checked'));
      setRandomCustom($w.find('.gc-ct-random-custom').is(':checked'));
      setCustom(draft);
      setZones(zonesDraft);
      patchLocationSelect();
      patchZoneNamesCss();
      if (typeof flyAlert === 'function') flyAlert('Char Tools: настройки сохранены');
    }, function () {
      renderZoneEditor($w);
      renderChips($w);
      renderZonesList($w);
      syncVisibility($w);

      $w.on('change', 'input[name="gc-ct-mode"]', function () { syncVisibility($w); });
      $w.on('change', '.gc-ct-zone-select', function () {
        commitEditor($w); renderZoneEditor($w); renderChips($w);
      });
      $w.on('input', '.gc-ct-cell', function () {
        commitEditor($w); renderChips($w);
      });
      $w.on('click', '.gc-ct-chip-del', function (e) {
        e.stopPropagation();
        var code = $(this).data('code');
        delete draft[code];
        renderChips($w);
        if ($w.find('.gc-ct-zone-select').val() === code) renderZoneEditor($w);
      });
      // Свои зоны: добавить
      $w.on('click', '.gc-ct-zone-add', function () {
        var name = ($w.find('.gc-ct-zone-name').val() || '').trim();
        if (!name) return;
        var toHit = parseInt($w.find('.gc-ct-zone-tohit').val(), 10);
        if (isNaN(toHit)) toHit = 0;
        var taken = {}; Object.keys(ZONE_LABELS).forEach(function (c) { taken[c] = 1; });
        zonesDraft.forEach(function (z) { taken[z.code] = 1; });
        zonesDraft.push({ code: nextZoneCode(taken), label: name, toHit: toHit });
        $w.find('.gc-ct-zone-name').val('');
        $w.find('.gc-ct-zone-tohit').val('-2');
        renderZonesList($w);
        rebuildZoneSelect($w);
      });
      // Свои зоны: удалить
      $w.on('click', '.gc-ct-zone-del', function (e) {
        e.stopPropagation();
        var code = $(this).data('code');
        zonesDraft = zonesDraft.filter(function (z) { return z.code !== code; });
        delete draft[code];
        renderZonesList($w);
        rebuildZoneSelect($w);
        renderChips($w);
        renderZoneEditor($w);
      });
    });
  }

  // Кнопка в модалке.
  function mountButton() {
    if (document.getElementById('gc-ct-btn')) return;
    var discord = document.querySelector('.tool-discord-btn');
    if (!discord) return;

    var btn = document.createElement('button');
    btn.id = 'gc-ct-btn';
    btn.className = 'secondary round small nosave';
    btn.title = 'Подлокации при атаке';
    btn.innerHTML = '<i class="fa fa-crosshairs" style="position:relative;bottom:1.5px"></i>';
    btn.addEventListener('click', openSettings);
    var dbtn = discord.querySelector('button');
    if (dbtn) dbtn.insertAdjacentElement('afterend', btn);
    else discord.appendChild(btn);
  }

  function init() {
    if (!isCharSheet()) return;
    ensureHideStyle();
    patchLocationsTexts();
    patchRandomLocation();
    patchLocationSelect();
    patchZoneNamesCss();
    mountButton();
  }

  init();
  var t = null;
  new MutationObserver(function () {
    if (t) return;
    t = setTimeout(function () { t = null; init(); }, 300);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
