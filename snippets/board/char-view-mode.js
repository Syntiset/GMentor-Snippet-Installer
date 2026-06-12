// char-view-mode.js — изменение режима отображения блоков персонажей на досках. (v1.0.0)
/* При нажатии ПКМ на блок персонажа (или NPC), в board-panel появляется кнопка «Сниппеты». 
   Клик открывает боковую панель. Этот сниппет добавляет селектор «Режим отображения» 
   с тремя опциями:
     * Полный          — стандартный вид (default, ничего не меняеncz)
     * Аватарка        — круглый портрет 80x80
     * Аватарка + имя  — портрет 80x80 + имя ниже, контейнер 120x112 */

(function () {
  if (window.__gcCharViewMode && typeof window.__gcCharViewMode.teardown === 'function') {
    try { window.__gcCharViewMode.teardown(); } catch (e) {}
  }
  window.__gcCharViewModeMounted = true;

  var STYLE_ID       = 'gc-char-view-mode-style';
  var OVERLAY_CLASS  = 'gc-avatar-overlay';
  var NAME_CLASS     = 'gc-avatar-name';
  var CLS_AVATAR     = 'gc-view-avatar';
  var CLS_AVATAR_NAME = 'gc-view-avatar-name';
  var AVATAR_SIZE    = 80;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.className = 'nosave';
    st.textContent = [
      'text-block.char.' + CLS_AVATAR + '{',
        'width:' + AVATAR_SIZE + 'px!important;',
        'height:' + AVATAR_SIZE + 'px!important;',
        'min-width:' + AVATAR_SIZE + 'px!important;',
        'min-height:' + AVATAR_SIZE + 'px!important;',
        'border-radius:50%!important;',
        'overflow:hidden!important;',
        'padding:0!important;',
      '}',
      'text-block.char.' + CLS_AVATAR + '>*:not(.' + OVERLAY_CLASS + '):not(.ui-resizable-handle){display:none!important}',
      'text-block.char.' + CLS_AVATAR_NAME + '{',
        'width:auto!important;min-width:' + AVATAR_SIZE + 'px!important;max-width:160px!important;',
        'height:auto!important;min-height:0!important;',
        'border-radius:0!important;overflow:visible!important;',
        'padding:0!important;background:transparent!important;',
        'border-width:0!important;box-shadow:none!important;',
        'display:flex!important;flex-direction:column!important;align-items:center!important;',
      '}',
      'text-block.char.' + CLS_AVATAR_NAME + '>*:not(.' + OVERLAY_CLASS + '):not(.' + NAME_CLASS + '):not(.ui-resizable-handle){display:none!important}',
      '.' + OVERLAY_CLASS + '{',
        'position:absolute;background:#444 center/cover no-repeat;',
        'display:flex;align-items:center;justify-content:center;',
        'font:bold 22px sans-serif;color:#fff;pointer-events:none;',
      '}',
      'text-block.char.' + CLS_AVATAR + ' .' + OVERLAY_CLASS + '{inset:0;border-radius:50%}',
      'text-block.char.' + CLS_AVATAR_NAME + ' .' + OVERLAY_CLASS + '{',
        'position:static!important;transform:none!important;',
        'width:' + AVATAR_SIZE + 'px;height:' + AVATAR_SIZE + 'px;',
        'border-radius:50%;flex-shrink:0;',
        'border:2.5px solid;border-color:inherit;box-sizing:border-box;',
      '}',
      'text-block.char.' + CLS_AVATAR_NAME + ' .' + NAME_CLASS + '{',
        'position:static!important;margin-top:5px;',
        'text-align:center;font:bold 13px "Roboto Condensed",sans-serif;',
        'color:var(--color-text);',
        'white-space:normal;word-break:break-word;max-width:160px;',
        'text-shadow:0 1px 3px var(--color-bg),0 0 4px var(--color-bg);',
        'pointer-events:none;line-height:1.2;',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  function isCharBlock(el) {
    if (!el || !el.tagName || el.tagName.toLowerCase() !== 'text-block') return false;
    if (!el.classList.contains('char')) return false;
    return !!el.querySelector('.npc-view');
  }

  function getMode(cb) {
    if (cb.classList.contains(CLS_AVATAR)) return 'avatar';
    if (cb.classList.contains(CLS_AVATAR_NAME)) return 'avatar-name';
    return 'full';
  }

  function setMode(cb, mode) {
    cb.classList.remove(CLS_AVATAR);
    cb.classList.remove(CLS_AVATAR_NAME);
    removeOverlay(cb);
    removeName(cb);
    if (mode === 'avatar') {
      cb.classList.add(CLS_AVATAR);
      applyOverlay(cb);
    } else if (mode === 'avatar-name') {
      cb.classList.add(CLS_AVATAR_NAME);
      applyOverlay(cb);
      applyName(cb);
    }
    if (typeof saveButtonEnable === 'function') saveButtonEnable();
    if (typeof saveCurrentChar === 'function') saveCurrentChar(true);
  }

  function getPortraitSrc(cb) {
    var pi = cb.querySelector('portrait-img');
    if (!pi) return '';
    var bg = pi.style.backgroundImage || getComputedStyle(pi).backgroundImage || '';
    var m = bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (m && m[1] && m[1] !== 'none') return m[1];
    var img = pi.querySelector('img');
    if (img) return img.getAttribute('src') || img.getAttribute('data-src') || '';
    return pi.getAttribute('data-src') || pi.getAttribute('src') || '';
  }

  function getDisplayName(cb) {
    var n = cb.querySelector('profile > name');
    return n ? (n.textContent || '').trim() : '';
  }

  function applyOverlay(cb) {
    var src = getPortraitSrc(cb);
    var letter = (getDisplayName(cb)[0] || '?').toUpperCase();
    var existing = cb.querySelector(':scope > .' + OVERLAY_CLASS);
    if (existing) {
      if (existing.dataset.gcSrc === src && existing.dataset.gcLetter === letter) return;
      existing.remove();
    }
    var ov = document.createElement('div');
    ov.className = OVERLAY_CLASS + ' nosave';
    ov.dataset.gcSrc = src;
    ov.dataset.gcLetter = letter;
    if (src) ov.style.backgroundImage = 'url("' + src.replace(/"/g, '\\"') + '")';
    else ov.textContent = letter;
    cb.appendChild(ov);
  }

  function removeOverlay(cb) {
    var ov = cb.querySelector(':scope > .' + OVERLAY_CLASS);
    if (ov) ov.remove();
  }

  function applyName(cb) {
    var name = getDisplayName(cb) || '?';
    var existing = cb.querySelector(':scope > .' + NAME_CLASS);
    if (existing) {
      if (existing.textContent === name) return;
      existing.remove();
    }
    var n = document.createElement('div');
    n.className = NAME_CLASS + ' nosave';
    n.textContent = name;
    n.title = name;
    cb.appendChild(n);
  }

  function removeName(cb) {
    var n = cb.querySelector(':scope > .' + NAME_CLASS);
    if (n) n.remove();
  }

  function reapplyAll() {
    document.querySelectorAll('text-block.char').forEach(function (cb) {
      if (!isCharBlock(cb)) return;
      var mode = getMode(cb);
      if (mode === 'avatar' || mode === 'avatar-name') applyOverlay(cb);
      else removeOverlay(cb);
      if (mode === 'avatar-name') applyName(cb);
      else removeName(cb);
    });
  }

  function renderModeSelector(target) {
    var sel = document.createElement('select');
    sel.innerHTML =
      '<option value="full">Полный</option>' +
      '<option value="avatar">Аватарка</option>' +
      '<option value="avatar-name">Аватарка + имя</option>';
    sel.value = getMode(target);
    sel.addEventListener('change', function () {
      setMode(target, sel.value);
    });
    return sel;
  }

  function registerWhenReady() {
    if (window.gcCharTools && typeof window.gcCharTools.register === 'function') {
      window.gcCharTools.register({
        id: 'char-view-mode',
        label: 'Режим отображения',
        matches: isCharBlock,
        render: renderModeSelector
      });
      return true;
    }
    return false;
  }

  ensureStyle();
  reapplyAll();

  var registerObs = null;
  if (!registerWhenReady()) {
    registerObs = new MutationObserver(function () {
      if (registerWhenReady()) { registerObs.disconnect(); registerObs = null; }
    });
    registerObs.observe(document.body, { childList: true, subtree: true });
  }

  var reapplyTimer = null;
  var reapplyObs = new MutationObserver(function () {
    clearTimeout(reapplyTimer);
    reapplyTimer = setTimeout(reapplyAll, 200);
  });
  reapplyObs.observe(document.body, { childList: true, subtree: true });

  window.__gcCharViewMode = {
    teardown: function () {
      if (registerObs) { registerObs.disconnect(); registerObs = null; }
      reapplyObs.disconnect();
      clearTimeout(reapplyTimer);
      var st = document.getElementById(STYLE_ID);
      if (st && st.parentNode) st.parentNode.removeChild(st);
    }
  };
})();
