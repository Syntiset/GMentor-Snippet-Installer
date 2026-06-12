// initiative-tracker.js — трекер инициативы для ГМских досок. (v1.0.0)
/* Поддерживается импорт персонажей с доски. Кнопка справа снизу, пока что фиксированная. Гибридное 
   хранение: LocalStorage + опциональная синхронизация через ↑/↓, запись идёт в <gc-init-state>. */

(function () {
  if (window.__gcInitTrackerMounted) {
    ['gc-init-toggle', 'gc-init-panel', 'gc-init-tracker-style'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }
  window.__gcInitTrackerMounted = true;

  var STORAGE_KEY = 'gc-initiative';
  var UI_OPEN_KEY = 'gc-init-ui:open';
  var UI_POS_KEY  = 'gc-init-ui:pos';

  function currentBoardId() {
    var cur = document.querySelector('gm-board[current]') || document.querySelector('gm-board');
    return cur ? cur.id : 'default';
  }

  function normalizeState(s) {
    if (!s) return { chars: [], currentIdx: 0 };
    if (s.actors && !s.chars) { s.chars = s.actors; delete s.actors; }
    if (!Array.isArray(s.chars)) s.chars = [];
    if (typeof s.currentIdx !== 'number') s.currentIdx = 0;
    return s;
  }

  function loadState(boardId) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY + ':' + boardId);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (e) { return { chars: [], currentIdx: 0 }; }
  }

  function saveState(boardId, state) {
    try { localStorage.setItem(STORAGE_KEY + ':' + boardId, JSON.stringify(state)); }
    catch (e) { /* quota */ }
  }

  function getRemoteState(boardId) {
    var board = document.getElementById(boardId);
    if (!board) return null;
    var el = board.querySelector(':scope > gc-init-state');
    if (!el) return null;
    var raw = Array.from(el.childNodes)
      .filter(function (n) { return n.nodeType === 3; })
      .map(function (n) { return n.nodeValue; })
      .join('').trim();
    if (!raw) return null;
    try { return normalizeState(JSON.parse(raw)); }
    catch (e) { console.error('[init-tracker] bad remote JSON', e); return null; }
  }

  function saveBoard() {
    try {
      if (typeof saveButtonEnable === 'function') saveButtonEnable();
      if (typeof saveCurrentChar === 'function') saveCurrentChar(true);
      return true;
    } catch (e) {
      if (window.console) console.error('[init-tracker] save failed', e);
      var m = 'Трекер: ошибка сохранения на сервер';
      if (typeof flyAlert === 'function') flyAlert(m); else alert(m);
      return false;
    }
  }

  function setRemoteState(boardId, state) {
    var board = document.getElementById(boardId);
    if (!board) return false;
    var el = board.querySelector(':scope > gc-init-state');
    if (!el) {
      el = document.createElement('gc-init-state');
      board.appendChild(el);
    }
    el.textContent = JSON.stringify(state);
    return saveBoard();
  }

  function pushToServer() {
    var bid = currentBoardId();
    var local = loadState(bid);
    var board = document.getElementById(bid);
    if (!board) { alert('Не удалось push: board не найден'); return; }
    if (!local.chars.length) {
      var existing = board.querySelector(':scope > gc-init-state');
      if (existing) {
        existing.remove();
        saveBoard();
        var m1 = 'Трекер: серверный state удалён (пустой push)';
        if (typeof flyAlert === 'function') flyAlert(m1); else alert(m1);
      } else {
        var m2 = 'Трекер: на сервере и так пусто';
        if (typeof flyAlert === 'function') flyAlert(m2); else alert(m2);
      }
      return;
    }
    if (!setRemoteState(bid, local)) { alert('Не удалось push: board не найден'); return; }
    var msg = 'Трекер: ' + local.chars.length + ' персонажей → сервер';
    if (typeof flyAlert === 'function') flyAlert(msg); else alert(msg);
  }

  function pullFromServer() {
    var bid = currentBoardId();
    var remote = getRemoteState(bid);
    if (!remote) {
      var msg0 = 'Трекер: на сервере нет state для этой доски';
      if (typeof flyAlert === 'function') flyAlert(msg0); else alert(msg0);
      return;
    }
    if (!confirm('Загрузить state с сервера? Локальные изменения будут перезаписаны.')) return;
    saveState(bid, remote);
    render();
    var msg = 'Трекер: ' + remote.chars.length + ' персонажей ← сервер';
    if (typeof flyAlert === 'function') flyAlert(msg); else alert(msg);
  }

  function escapeHtml(s) {
    return (s + '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureStyle() {
    if (document.getElementById('gc-init-tracker-style')) return;
    var st = document.createElement('style');
    st.id = 'gc-init-tracker-style';
    st.className = 'nosave';
    st.textContent = [
      '#gc-init-toggle{',
        'position:fixed;bottom:80px;right:16px;width:48px;height:48px;',
        'border-radius:50%;cursor:pointer;font-size:18px;z-index:9998;',
        'background:var(--color-bg);color:var(--color-text);',
        'border:1px solid var(--color-border);',
        'box-shadow:0 2px 8px rgba(0,0,0,0.3);',
        'display:flex;align-items:center;justify-content:center;',
      '}',
      '#gc-init-toggle:hover{background:var(--color-main);color:#fff}',
      '#gc-init-panel{',
        'position:fixed;top:60px;right:80px;width:280px;',
        'background:var(--color-bg);color:var(--color-text);',
        'border:1px solid var(--color-border);border-radius:6px;',
        'padding:8px;font:13px/1.4 "Roboto Condensed",sans-serif;',
        'z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);',
      '}',
      '#gc-init-panel.gc-hidden{display:none}',
      '.gc-init-header{',
        'display:flex;align-items:center;gap:4px;margin-bottom:6px;',
        'cursor:move;user-select:none;',
      '}',
      '.gc-init-header b{flex:1}',
      '.gc-init-header .btn{',
        'min-width:26px;height:24px;padding:0 6px;font-size:12px;',
        'display:inline-flex;align-items:center;justify-content:center;',
      '}',
      '.gc-init-header .btn .fa{font-size:12px}',
      '.gc-init-sep{width:1px;height:18px;background:var(--color-border);margin:0 2px}',
      '#gc-init-list{margin:0}',
      '#gc-init-list>div{',
        'display:flex;align-items:center;gap:6px;padding:2px 4px;border-radius:3px;',
      '}',
      '#gc-init-list>div.gc-current{background:var(--color-main);color:#fff}',
      '#gc-init-list .gc-num{color:var(--color-border);min-width:18px;text-align:right}',
      '#gc-init-list>div.gc-current .gc-num{color:rgba(255,255,255,0.7)}',
      '#gc-init-list .gc-init-val{opacity:0.7;font-size:11px}',
      '#gc-init-list .gc-del{',
        'font-size:11px;padding:0 5px;cursor:pointer;',
        'background:transparent;color:inherit;border:1px solid var(--color-border);',
        'border-radius:3px;line-height:14px;height:16px;',
      '}',
      '#gc-init-empty{color:var(--color-border);padding:6px 2px;text-align:center;font-style:italic}'
    ].join('');
    document.head.appendChild(st);
  }

  function render() {
    var list = document.getElementById('gc-init-list');
    if (!list) return;
    var s = loadState(currentBoardId());
    if (!s.chars.length) {
      list.innerHTML = '<div id="gc-init-empty">пусто</div>';
      return;
    }
    list.innerHTML = s.chars.map(function (c, i) {
      var cur = (i === s.currentIdx) ? ' class="gc-current"' : '';
      return '<div' + cur + '>' +
        '<span class="gc-num">' + (i + 1) + '.</span>' +
        '<span style="flex:1">' + escapeHtml(c.name) + ' <span class="gc-init-val">(' + c.init + ')</span></span>' +
        '<button data-idx="' + i + '" class="gc-del" title="Удалить">×</button>' +
      '</div>';
    }).join('');
  }

  function isPanelOpen() {
    return localStorage.getItem(UI_OPEN_KEY) !== '0';
  }
  function setPanelOpen(open) {
    localStorage.setItem(UI_OPEN_KEY, open ? '1' : '0');
    var p = document.getElementById('gc-init-panel');
    if (p) p.classList.toggle('gc-hidden', !open);
  }
  function loadPanelPos() {
    try {
      var raw = localStorage.getItem(UI_POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function savePanelPos(left, top) {
    try { localStorage.setItem(UI_POS_KEY, JSON.stringify({ left: left, top: top })); }
    catch (e) {}
  }

  function applyPanelPos(p) {
    var pos = loadPanelPos();
    if (!pos) return;
    var w = p.offsetWidth || 280;
    var left = Math.min(Math.max(0, pos.left), Math.max(0, window.innerWidth - w - 8));
    var top  = Math.min(Math.max(0, pos.top),  Math.max(0, window.innerHeight - 60));
    p.style.left = left + 'px';
    p.style.top  = top  + 'px';
    p.style.right = 'auto';
  }

  function mountToggle() {
    if (document.getElementById('gc-init-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'gc-init-toggle';
    btn.className = 'nosave';
    btn.title = 'Трекер инициативы';
    btn.innerHTML = '<i class="fa fa-bolt"></i>';
    btn.addEventListener('click', function () { setPanelOpen(!isPanelOpen()); });
    document.body.appendChild(btn);
  }

  function mountPanel() {
    if (document.getElementById('gc-init-panel')) return;
    var p = document.createElement('div');
    p.id = 'gc-init-panel';
    p.className = 'nosave' + (isPanelOpen() ? '' : ' gc-hidden');
    p.innerHTML =
      '<div class="gc-init-header">' +
        '<b>Инициатива</b>' +
        '<button class="btn secondary small" id="gc-init-add"  title="Добавить вручную"><i class="fa fa-plus"></i></button>' +
        '<button class="btn secondary small" id="gc-init-scan" title="Импорт с доски"><i class="fa fa-users"></i></button>' +
        '<span class="gc-init-sep"></span>' +
        '<button class="btn secondary small" id="gc-init-push" title="Push на сервер"><i class="fa fa-upload"></i></button>' +
        '<button class="btn secondary small" id="gc-init-pull" title="Pull с сервера"><i class="fa fa-download"></i></button>' +
        '<span class="gc-init-sep"></span>' +
        '<button class="btn secondary small" id="gc-init-next" title="Следующий ход"><i class="fa fa-step-forward"></i></button>' +
        '<button class="btn secondary small" id="gc-init-clr"  title="Очистить (локально + опционально на сервере)"><i class="fa fa-trash"></i></button>' +
      '</div>' +
      '<div id="gc-init-list"></div>';
    document.body.appendChild(p);
    applyPanelPos(p);

    p.querySelector('#gc-init-add').addEventListener('click', function () {
      var name = prompt('Имя персонажа:');
      if (!name || !name.trim()) return;
      var val = parseFloat(prompt('Инициатива (число):'));
      if (isNaN(val)) return;
      var bid = currentBoardId();
      var s = loadState(bid);
      s.chars.push({ name: name.trim(), init: val });
      s.chars.sort(function (a, b) { return b.init - a.init; });
      saveState(bid, s);
      render();
    });

    p.querySelector('#gc-init-scan').addEventListener('click', function () {
      var board = document.querySelector('gm-board[current]') || document.querySelector('gm-board');
      if (!board) return;
      var bid = board.id || currentBoardId();
      var s = loadState(bid);
      var existingNames = {};
      s.chars.forEach(function (c) { existingNames[c.name] = true; });
      var added = 0, skipped = 0, noSpeed = 0;
      board.querySelectorAll('text-block.char').forEach(function (cb) {
        var nameEl = cb.querySelector('profile > name');
        var speedEl = cb.querySelector('speed_result');
        if (!nameEl) return;
        var name = (nameEl.textContent || '').trim();
        if (!name) return;
        var speed = speedEl ? parseFloat(speedEl.textContent) : NaN;
        if (isNaN(speed)) { noSpeed++; return; }
        if (existingNames[name]) { skipped++; return; }
        s.chars.push({ name: name, init: speed });
        existingNames[name] = true;
        added++;
      });
      s.chars.sort(function (a, b) { return b.init - a.init; });
      saveState(bid, s);
      render();
      var msg = added + ' добавлено';
      if (skipped) msg += ', ' + skipped + ' уже в списке';
      if (noSpeed) msg += ', ' + noSpeed + ' без speed_result';
      if (added + skipped + noSpeed === 0) msg = 'На доске нет персонажей';
      if (typeof flyAlert === 'function') flyAlert(msg); else alert(msg);
    });

    p.querySelector('#gc-init-push').addEventListener('click', pushToServer);
    p.querySelector('#gc-init-pull').addEventListener('click', pullFromServer);

    p.querySelector('#gc-init-next').addEventListener('click', function () {
      var bid = currentBoardId();
      var s = loadState(bid);
      if (!s.chars.length) return;
      s.currentIdx = (s.currentIdx + 1) % s.chars.length;
      saveState(bid, s);
      render();
    });

    p.querySelector('#gc-init-clr').addEventListener('click', function () {
      if (!confirm('Очистить трекер локально?')) return;
      var bid = currentBoardId();
      saveState(bid, { chars: [], currentIdx: 0 });
      render();
      var board = document.getElementById(bid);
      var hasRemote = board && board.querySelector(':scope > gc-init-state');
      if (hasRemote && confirm('Также удалить серверный state (gc-init-state)?')) {
        board.querySelector(':scope > gc-init-state').remove();
        saveBoard();
        var m = 'Трекер: удалено локально и на сервере';
        if (typeof flyAlert === 'function') flyAlert(m); else alert(m);
      }
    });

    p.querySelector('#gc-init-list').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON' || e.target.dataset.idx === undefined) return;
      var idx = parseInt(e.target.dataset.idx, 10);
      var bid = currentBoardId();
      var s = loadState(bid);
      s.chars.splice(idx, 1);
      if (s.currentIdx >= s.chars.length) s.currentIdx = 0;
      saveState(bid, s);
      render();
    });

    if (typeof $ === 'function' && typeof $(p).draggable === 'function') {
      $(p).draggable({
        handle: '.gc-init-header b',
        containment: 'window',
        stop: function (event, ui) {
          savePanelPos(ui.position.left, ui.position.top);
        }
      });
    }
  }

  ensureStyle();
  mountToggle();
  mountPanel();
  render();
  window.addEventListener('hashchange', render);
})();
