// UI для gc-toggler: кнопка «Сниппеты» рядом с </>.
/* Что делает: даёт визуально включать/выключать группы сниппетов
   через checkbox-list в модалке. Cascade-логика requires —
   автоматическая (опирается на window.gcToggler.normalizeCascade).
   Применение изменений требует перезагрузки листа.

   Параллельно: кнопка «⚠ Ошибки (N)» появляется, если bundle try/catch
   wrap'ом или gcUtils.gcLog накопил runtime ошибки в window.gcErrors.

   Зависимости: gc-toggler.js и gc-toggler-ui.less. */
(function () {
  if (typeof gm !== "function" || typeof $ !== "function") return;
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("gc-toggler-ui")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  if (window.gcInternal.bound.togglerUi) return;
  window.gcInternal.bound.togglerUi = true;

  mountButton();

  var mountAttempts = 0;
  var MAX_MOUNT_ATTEMPTS = 20; // 20 * 500ms = 10s. Не обязательно так много, но лучше перебздеть чем недобздеть.
  function mountButton() {
    if ($("#gc-toggler-btn").length) return;
    // Присоска к </> — она всегда есть в edit-mode
    var $scriptBtn = $('button[onclick*="changeCustomJs"]');
    if (!$scriptBtn.length) {
      if (++mountAttempts > MAX_MOUNT_ATTEMPTS) {
        if (window.gcUtils && window.gcUtils.gcLog) window.gcUtils.gcLog("warn", "[gc-toggler-ui] mountButton: script-button не появился за " + (MAX_MOUNT_ATTEMPTS * 500) + "ms");
        return;
      }
      setTimeout(mountButton, 500); return;
    }
    var $btn = $('<button id="gc-toggler-btn" class="secondary hide-in-template-mode" ' +
      'title="Управление сниппетами" style="margin-left:5px;white-space:nowrap;">' +
      '<i class="fa fa-toggle-on"></i> Сниппеты</button>');
    // Ставим кнопку выше hit-locations (если она есть), иначе рядом со SCRIPT.
    var $hl = $("#gc-hit-locations-btn");
    if ($hl.length) {
      $hl.before($btn);
    } else {
      $scriptBtn.parent().append($btn);
    }
    $(document).on("click.gcTogglerUi", "#gc-toggler-btn", openModal);

    /* Кнопка «⚠ Ошибки (N)» — только если window.gcErrors непуст.
       Заполняется bundle-wrap'ом (SECTION try/catch) и gcUtils.gcLog.
       Покажет счётчик ВСЕХ записей, но в модалке акцент на errors
       (warn'ы — это ожидаемые проблемы вроде parse-failure / pastFromStorage). */
    var errs = (window.gcErrors || []).filter(function (e) { return e && (e.level !== "warn"); });
    if (errs.length || (window.gcErrors && window.gcErrors.length)) {
      var $errBtn = $('<button id="gc-errors-btn" class="secondary hide-in-template-mode" ' +
        'title="Runtime ошибки сниппетов" style="margin-left:5px;white-space:nowrap;color:#d9534f;">' +
        '<i class="fa fa-exclamation-triangle"></i> Ошибки (' + (window.gcErrors.length) + ')</button>');
      $btn.after($errBtn);
      $(document).on("click.gcTogglerUiErr", "#gc-errors-btn", openErrorsModal);
    }
  }

  function openErrorsModal() {
    if (typeof modalPopup !== "function") {
      console.warn("[gc-toggler-ui] modalPopup() недоступен");
      return;
    }
    var errors = window.gcErrors || [];
    var $wrapper = $('<div class="mentor"><char-xml style="display:block"></char-xml></div>');
    var $overlay = $('<div class="gc-tog-errors"></div>');
    $overlay.append('<h2 style="margin:0 0 8px 0;font-size:16px">Runtime ошибки сниппетов (' + errors.length + ')</h2>');
    $overlay.append('<p style="margin:0 0 12px 0;font-size:12px;opacity:0.7;line-height:1.4">' +
      'Если сниппет упал во время загрузки bundle — try/catch продолжил исполнение, ' +
      'а ошибка приземлилась сюда. Это безопаснее, чем убить весь bundle одним throw.</p>');
    if (!errors.length) {
      $overlay.append('<div style="opacity:0.6;font-style:italic">Ошибок нет</div>');
    } else {
      errors.forEach(function (err, i) {
        var $row = $('<div class="gc-tog-err-row" style="border:1px solid #d9534f;border-radius:4px;padding:8px 10px;margin-bottom:8px;background:rgba(217,83,79,0.05)"></div>');
        var label = err.section || err.msg || "[?]";
        $row.append('<div style="font-weight:600;color:#d9534f">#' + (i + 1) + ' ' + escapeHtml(String(label)) + '</div>');
        if (err.msg && err.msg !== label) {
          $row.append('<div style="margin-top:4px;font-family:monospace;font-size:12px">' + escapeHtml(err.msg) + '</div>');
        }
        if (err.stack) {
          $row.append('<pre style="margin:6px 0 0 0;font-size:11px;opacity:0.7;max-height:200px;overflow:auto;background:rgba(0,0,0,0.04);padding:6px;border-radius:3px">' + escapeHtml(err.stack) + '</pre>');
        }
        if (err.at) {
          $row.append('<div style="font-size:10px;opacity:0.4;margin-top:4px">' + new Date(err.at).toISOString() + '</div>');
        }
        $overlay.append($row);
      });
      var $clearBtn = $('<button style="margin-top:8px">Очистить лог</button>').on("click", function () {
        window.gcErrors = [];
        if (typeof modalPopupClose === "function") modalPopupClose();
        $("#gc-errors-btn").remove();
      });
      $overlay.append($clearBtn);
    }
    $wrapper.find("char-xml").append($overlay);
    modalPopup($wrapper, null, "Закрыть");
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Set id групп, которые юзер выключил в текущем (несохранённом) черновике.
  var DRAFT = new Set();

  function openModal() {
    if (!window.gcToggler) {
      console.warn("[gc-toggler-ui] window.gcToggler не доступен");
      return;
    }
    if (typeof modalPopup !== "function") {
      console.warn("[gc-toggler-ui] modalPopup() недоступен");
      return;
    }
    DRAFT = new Set(window.gcToggler.getDisabledGroups());

    var $wrapper = $('<div class="mentor"><char-xml style="display:block"></char-xml></div>');
    var $overlay = $(
      '<div class="gc-tog">' +
        '<div class="gc-tog-header">' +
          '<h2>Управление сниппетами</h2>' +
          '<p class="gc-tog-hint">Включение/выключение требует перезагрузки листа. Зависимости применяются автоматически (cascade).</p>' +
        '</div>' +
        '<div class="gc-tog-list"></div>' +
        '<div class="gc-tog-footer"></div>' +
      '</div>'
    );
    $wrapper.find("char-xml").append($overlay);

    renderList($overlay);

    modalPopup($wrapper, "Применить (F5 листа)", "Отмена", function () {
      /* Очистка: при переходе группы в disabled чистим её runtime-следы
         (иначе данные сниппета застрянут в char-xml после перезагрузки). */
      var prevDisabled = new Set(window.gcToggler.getDisabledGroups());
      var willBeDisabled = window.gcToggler.normalizeCascade(Array.from(DRAFT));
      willBeDisabled
        .filter(function (gid) { return !prevDisabled.has(gid); })
        .forEach(function (gid) { window.gcToggler.cleanupForDisabled(gid); });

      window.gcToggler.setDisabledGroups(Array.from(DRAFT), { save: true });
      setTimeout(function () { location.reload(); }, 300);
    });
  }

  function renderList($overlay) {
    var groups = window.gcToggler.getGroups();
    var $list = $overlay.find(".gc-tog-list").empty();
    var $footer = $overlay.find(".gc-tog-footer").empty();

    /* top-level сортировка (parent=null) по числу requires; под каждой
       children в том же порядке. Даёт иерархию «Зоны попадания» →
       DR-наследование → 1d6 подлокации (подряд, с отступом). */
    var allIds = Object.keys(groups);
    var topIds = allIds.filter(function (id) { return !groups[id].parent; })
      .sort(function (a, b) { return groups[a].requires.length - groups[b].requires.length; });
    var childrenOf = function (parentId) {
      return allIds.filter(function (id) { return groups[id].parent === parentId; })
        .sort(function (a, b) { return groups[a].requires.length - groups[b].requires.length; });
    };

    function renderRow(gid, depth) {
      var g = groups[gid];
      var disabled = DRAFT.has(gid);
      // cascadeDisabled: автоматически выключится из-за того, что requires выключен.
      var cascadeDisabled = false;
      g.requires.forEach(function (req) { if (DRAFT.has(req)) cascadeDisabled = true; });

      var $row = $(
        '<div class="gc-tog-row">' +
          '<label class="gc-tog-label">' +
            '<input type="checkbox" class="gc-tog-cb">' +
            '<span class="gc-tog-name"></span>' +
            '<span class="gc-tog-id"></span>' +
          '</label>' +
          '<div class="gc-tog-desc"></div>' +
          '<div class="gc-tog-req"></div>' +
        '</div>'
      );
      if (depth > 0) $row.addClass("is-child").attr("data-depth", depth);
      $row.find(".gc-tog-name").text(g.label);
      $row.find(".gc-tog-id").text("[" + gid + "]");
      $row.find(".gc-tog-desc").text(g.desc);

      if (g.requires.length) {
        var reqLabels = g.requires.map(function (r) { return (groups[r] && groups[r].label) || r; }).join(", ");
        $row.find(".gc-tog-req").text("Требует: " + reqLabels);
      }

      var $cb = $row.find(".gc-tog-cb");
      $cb.prop("checked", !disabled && !cascadeDisabled);
      if (cascadeDisabled && !disabled) {
        $cb.prop("disabled", true);
        $row.addClass("cascade-off");
      }

      $cb.on("change", function () {
        var enabled = $(this).is(":checked");
        if (enabled) {
          DRAFT.delete(gid);
          g.requires.forEach(function (req) { DRAFT.delete(req); });
        } else {
          DRAFT.add(gid);
          Object.keys(groups).forEach(function (otherId) {
            if (otherId === gid) return;
            if (groups[otherId].requires.indexOf(gid) !== -1) DRAFT.add(otherId);
          });
        }
        renderList($overlay);
      });

      $list.append($row);

      childrenOf(gid).forEach(function (childId) { renderRow(childId, depth + 1); });
    }

    topIds.forEach(function (id) { renderRow(id, 0); });

    // Подсказка по итоговому состоянию.
    var current = new Set(window.gcToggler.getDisabledGroups());
    var changed = (current.size !== DRAFT.size) ||
                  Array.from(DRAFT).some(function (id) { return !current.has(id); });
    if (changed) {
      var disabledLabels = Array.from(DRAFT).map(function (id) { return groups[id] ? groups[id].label : id; });
      $footer.html('<div class="gc-tog-status changed">⚠ Будет выключено после применения: <b>' +
        (disabledLabels.length ? disabledLabels.join(", ") : "—") + '</b></div>');
    } else {
      $footer.html('<div class="gc-tog-status unchanged">Без изменений</div>');
    }
  }
})();
