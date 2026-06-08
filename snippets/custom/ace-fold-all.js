// QoL для Ace-редакторов <gc-script> / <gc-style-less>: автосворачивание bundle.
/* Что делает: при открытии Ace-редактора (кнопки SCRIPT и CSS/LESS)
   автоматически сворачивает блоки bundle по маркерам:
     // === SECTION-START ===      ↔   // === SECTION-END ===  		(для JS)
     /* === SECTION-START === * /  ↔   /* === SECTION-END === * /   (для LESS)

   Зачем? bundle занимает много места и без сворачивания просто километры кода.

   Outer-marker skip: контейнер bundle, чьи границы хочется видеть как ориентир:
     - LESS: GMENTOR-LESS-BUNDLE сам не сворачивает, только внутренние секции;
     - JS:   сворачивает всё, включая outer GMENTOR-BUNDLE (одной строкой).

   Также перехватывает клик по gutter-стрелке свёрнутого блока — toggle
   разворачивает блок назад (стандартный Ace fold-widget этого не делает,
   т.к. мои folds сделаны через addFold напрямую, минуя mode.foldingRules). */
(function () {
  if (window.GC_DISABLED_SNIPPETS && window.GC_DISABLED_SNIPPETS.has("ace-fold-all")) return;
  window.gcInternal = window.gcInternal || { patched: {}, bound: {} };
  if (window.gcInternal.patched.aceFoldAll || typeof window.createMentorAce !== "function") return;
  window.gcInternal.patched.aceFoldAll = true;

  var START_RE = /^\s*\{?\s*(?:\/\/|\/\*)\s*={3,}\s*(\S+?)-START\s*={3,}(?:\s*\*\/)?\s*$/;
  var END_RE_FOR = function (name) {
    var esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^\\s*\\}?\\s*(?:\\/\\/|\\/\\*)\\s*={3,}\\s*" + esc + "-END\\s*={3,}(?:\\s*\\*\\/)?\\s*$");
  };

  function skipNamesForMode(mode) {
    if (mode === "css" || mode === "less") return ["GMENTOR-LESS-BUNDLE"];
    return [];
  }

  function dbg() {
    if (!window.GC_DEBUG_FOLD) return;
    var args = ["[ace-fold-all]"].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  var origCreate = window.createMentorAce;
  window.createMentorAce = function (objId, mode) {
    var editor = origCreate.apply(this, arguments);
    var skipNames = skipNamesForMode(mode);
    setTimeout(function () { try { applyInitialFolds(editor, skipNames, mode); } catch (e) { dbg("initialFolds err", e); } }, 150);
    setupGutterClickInterceptor(editor, skipNames);
    return editor;
  };

  function findFoldAt(session, row, Range, skipNames) {
    var line = session.getLine(row);
    var m = START_RE.exec(line);
    if (!m) return null;
    if (skipNames && skipNames.indexOf(m[1]) !== -1) return null;
    var endRe = END_RE_FOR(m[1]);
    var total = session.getLength();
    for (var i = row + 1; i < total; i++) {
      if (endRe.test(session.getLine(i))) {
        return { row: row, range: new Range(row, line.length, i, 0), name: m[1] };
      }
    }
    return null;
  }

  function applyInitialFolds(editor, skipNames, mode) {
    var session = editor.getSession();
    var Range = window.ace && window.ace.require ? window.ace.require("ace/range").Range : null;
    if (!Range) { dbg("ace.range недоступен"); return; }

    if (mode !== "css" && mode !== "less") {
      try { session.foldAll(); } catch (e) { dbg("foldAll err", e); }
    }

    var total = session.getLength();
    var rows = [];
    for (var i = 0; i < total; i++) {
      var m = START_RE.exec(session.getLine(i));
      if (m && (!skipNames || skipNames.indexOf(m[1]) === -1)) rows.push(i);
    }
    rows.sort(function (a, b) { return b - a; });
    var ok = 0;
    rows.forEach(function (row) {
      var found = findFoldAt(session, row, Range, skipNames);
      if (!found) return;
      try {
        var line = session.getLine(row);
        var existing = session.getFoldAt(row, line.length);
        if (existing) session.expandFold(existing);
        session.addFold(" /* … " + found.name + " … */ ", found.range);
        ok++;
      } catch (e) { dbg("addFold err row=" + row, e); }
    });
    dbg("initial folds applied:", ok, "/", rows.length, "mode=" + mode);
  }

  function setupGutterClickInterceptor(editor, skipNames) {
    if (editor.__gcGutterClickBound) return;
    editor.__gcGutterClickBound = true;

    var session = editor.getSession();
    var Range = window.ace && window.ace.require ? window.ace.require("ace/range").Range : null;
    if (!Range) return;

    var handler = function (ev) {
      var target = ev.target;
      if (!target || !target.classList || !target.classList.contains("ace_fold-widget")) return;
      var cell = target.closest(".ace_gutter-cell, .ace_gutter-cell_svg-icons");
      if (!cell) return;
      var row = parseInt((cell.textContent || "").trim(), 10) - 1;
      if (isNaN(row)) return;
      var found = findFoldAt(session, row, Range, skipNames);
      if (!found) return;

      ev.stopImmediatePropagation();
      ev.stopPropagation();
      ev.preventDefault();

      try {
        var line = session.getLine(row);
        var fold = session.getFoldAt(row, line.length);
        if (fold) {
          session.expandFold(fold);
          dbg("expand row=" + row);
        } else {
          session.addFold(" /* … " + found.name + " … */ ", found.range);
          dbg("add row=" + row);
        }
      } catch (err) { dbg("toggle err", err); }
    };

    var suppressIfOurWidget = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("ace_fold-widget")) return;
      var cell = t.closest(".ace_gutter-cell, .ace_gutter-cell_svg-icons");
      if (!cell) return;
      var row = parseInt((cell.textContent || "").trim(), 10) - 1;
      if (isNaN(row)) return;
      if (!findFoldAt(session, row, Range, skipNames)) return;
      ev.stopImmediatePropagation();
      ev.stopPropagation();
      ev.preventDefault();
    };

    var tries = 0;
    var MAX_TRIES = 25;
    var POLL_MS = 200;
    var waitInterval = setInterval(function () {
      var gutterEl = editor.renderer && editor.renderer.$gutterLayer && editor.renderer.$gutterLayer.element;
      if (!gutterEl) gutterEl = editor.container && editor.container.querySelector(".ace_gutter-layer");
      if (!gutterEl) {
        if (++tries > MAX_TRIES) {
          clearInterval(waitInterval);
          dbg("gutter не появился за " + (MAX_TRIES * POLL_MS) + "ms");
        }
        return;
      }
      clearInterval(waitInterval);
      gutterEl.addEventListener("mousedown", handler, true);
      gutterEl.addEventListener("mouseup", suppressIfOurWidget, true);
      gutterEl.addEventListener("click", suppressIfOurWidget, true);
      editor.__gcGutterClickHandler = handler;
      editor.__gcGutterClickEl = gutterEl;
      dbg("gutter click interceptor attached");

      var cleanup = function () {
        try {
          gutterEl.removeEventListener("mousedown", handler, true);
          gutterEl.removeEventListener("mouseup", suppressIfOurWidget, true);
          gutterEl.removeEventListener("click", suppressIfOurWidget, true);
          dbg("cleanup done");
        } catch (e) {}
      };
      if (typeof editor.on === "function") {
        try { editor.on("destroy", cleanup); } catch (e) {}
      }
    }, POLL_MS);
  }
})();
