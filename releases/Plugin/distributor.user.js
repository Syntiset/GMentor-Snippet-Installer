// ==UserScript==
// @name         GMentor Snippet Installer
// @namespace    https://github.com/Syntiset/GMentor-Snippet-Installer
// @version      1.1.0
// @description  Установщик сниппетов gmentor.ru: бандл на кастомные листы, общие сниппеты (любой лист), сниппеты для мастерских досок
// @author       NETango aka Syntiset
// @match        https://gmentor.ru/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Plugin/distributor.user.js
// @updateURL    https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Plugin/distributor.user.js
// @homepageURL  https://github.com/Syntiset/GMentor-Snippet-Installer
// @supportURL   https://github.com/Syntiset/GMentor-Snippet-Installer/issues
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULTS = {
    sourceJsUrl:   'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Bundle/gmentor-bundle.js',
    sourceLessUrl: 'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Bundle/gmentor-bundle.less',
    autoPull: true,
    cachedBundle: null,
    sheetVersions: {},
    allManifestUrl: 'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/snippets/all/_manifest.json',
    allBaseUrl:     'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/snippets/all/',
    allInstalled: {},
    boardManifestUrl: 'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/snippets/board/_manifest.json',
    boardBaseUrl:     'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/snippets/board/',
  };
  const cfg = (k) => GM_getValue(k, DEFAULTS[k]);
  const setCfg = (k, v) => GM_setValue(k, v);

  function getAllInstalled() {
    const v = cfg('allInstalled');
    return (v && typeof v === 'object') ? v : {};
  }
  function runAllSnippets() {
    const installed = getAllInstalled();
    const evaled = (unsafeWindow.__gcAllEvaled = unsafeWindow.__gcAllEvaled || {});
    Object.keys(installed)
      .sort(function (a, b) {
        const oa = installed[a] && installed[a].order != null ? installed[a].order : 999;
        const ob = installed[b] && installed[b].order != null ? installed[b].order : 999;
        return oa - ob;
      })
      .forEach(function (id) {
        if (evaled[id]) return;
        const mod = installed[id];
        if (!mod || !mod.code) return;
        evaled[id] = true;
        try { unsafeWindow.eval(mod.code); }
        catch (e) { if (window.console) console.error('[gc-all]', id, e); }
      });
  }

  function b64ToUtf8(b64) {
    if (typeof unsafeWindow.base64_to_utf8 === 'function') return unsafeWindow.base64_to_utf8(b64);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function cleanTagText(el) {
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue).join('').replace(/\s+/g, '');
  }
  const BOARD_REGISTRY_SRC = `
(function () {
  'use strict';
  if (window.__gcBoardRegistryInit) return;
  window.__gcBoardRegistryInit = true;

  var charTools = [];
  window.gcCharTools = {
    register: function (opts) {
      if (!opts || !opts.id || typeof opts.render !== 'function') return;
      charTools = charTools.filter(function (t) { return t.id !== opts.id; });
      charTools.push(opts);
    },
    unregister: function (id) {
      charTools = charTools.filter(function (t) { return t.id !== id; });
    },
    list: function () { return charTools.slice(); }
  };

  function matchingTools(target) {
    return charTools.filter(function (t) {
      if (!t.matches) return true;
      try { return !!t.matches(target); }
      catch (e) { return false; }
    });
  }

  function ensureSidePanelStyle() {
    if (document.getElementById('gc-side-panel-style')) return;
    var st = document.createElement('style');
    st.id = 'gc-side-panel-style';
    st.className = 'nosave';
    st.textContent = [
      '#gc-side-panel{',
        'display:block!important;',
        'position:fixed!important;',
        'left:auto!important;bottom:auto!important;',
        'width:260px!important;max-height:46.6vh!important;min-height:0!important;',
        'z-index:9990;',
        'opacity:0;transform:translateX(20px);pointer-events:none;',
        'transition:opacity 0.18s ease,transform 0.22s ease;',
        'overflow-y:auto!important;overflow-x:hidden;',
      '}',
      '#gc-side-panel.gc-open{opacity:1;transform:translateX(0);pointer-events:auto}',
      '#gc-side-panel .gc-side-content{padding:8px}',
      '#gc-side-panel .gc-tool-row{margin-bottom:10px;display:flex;flex-direction:column;gap:3px}',
      '#gc-side-panel .gc-tool-row > label{font-size:11px;opacity:0.7;font-weight:bold;}',
      '#gc-side-panel .gc-tool-row > select,',
      '#gc-side-panel .gc-tool-row > input{',
        'font-size:13px;padding:4px 6px;',
        'background:var(--color-bg);color:var(--color-text);',
        'border:1px solid var(--color-border);border-radius:3px;',
        'width:100%;',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  function ensureSidePanel() {
    var p = document.getElementById('gc-side-panel');
    if (p) return p;
    p = document.createElement('board-panel');
    p.id = 'gc-side-panel';
    p.className = 'nosave hide-in-print-mode';
    p.innerHTML = '<div class="gc-side-content"></div>';
    document.body.appendChild(p);
    return p;
  }

  function showSidePanelFor(target, boardPanel) {
    ensureSidePanelStyle();
    var sp = ensureSidePanel();
    var content = sp.querySelector('.gc-side-content');
    content.innerHTML = '';
    var tools = matchingTools(target);
    if (!tools.length) { sp.classList.remove('gc-open'); return; }
    tools.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'gc-tool-row';
      if (t.label) {
        var lbl = document.createElement('label');
        lbl.textContent = t.label;
        row.appendChild(lbl);
      }
      try {
        var ctrl = t.render(target);
        if (ctrl) row.appendChild(ctrl);
      } catch (e) {
        var err = document.createElement('div');
        err.style.cssText = 'color:#f88;font-size:11px';
        err.textContent = '[' + t.id + ' err]: ' + (e && e.message || e);
        row.appendChild(err);
      }
      content.appendChild(row);
    });
    var rect = boardPanel.getBoundingClientRect();
    sp.style.setProperty('right', (window.innerWidth - rect.left + 8) + 'px', 'important');
    sp.style.setProperty('top', rect.top + 'px', 'important');
    sp.style.setProperty('left', 'auto', 'important');
    sp.style.setProperty('bottom', 'auto', 'important');
    sp.classList.add('gc-open');
  }

  function hideSidePanel() {
    var sp = document.getElementById('gc-side-panel');
    if (sp) sp.classList.remove('gc-open');
  }

  function injectSnippetsButton(panel, target) {
    panel.querySelectorAll('.gc-snippets-btn').forEach(function (b) { b.remove(); });
    var tools = matchingTools(target);
    if (!tools.length) return;
    var host = panel.querySelector(':scope > div.hide-when-locked');
    if (!host) return;
    var btn = document.createElement('button');
    btn.className = 'gc-snippets-btn btn';
    btn.innerHTML = '<i class="fa fa-cogs"></i> Сниппеты';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var sp = document.getElementById('gc-side-panel');
      if (sp && sp.classList.contains('gc-open')) { hideSidePanel(); }
      else { showSidePanelFor(target, panel); }
    });
    host.appendChild(btn);
  }

  function getGentorPanel() {
    return document.querySelector('board-panel:not(#gc-side-panel)');
  }

  var pkmObs = null, pkmTimer = null;
  function stopPkmWait() {
    if (pkmObs) { pkmObs.disconnect(); pkmObs = null; }
    if (pkmTimer) { clearTimeout(pkmTimer); pkmTimer = null; }
  }

  document.addEventListener('contextmenu', function (e) {
    hideSidePanel();
    stopPkmWait();
    var target = e.target.closest && e.target.closest(
      'text-block, arrow, marker-block, art-block, group'
    );
    if (!target) return;
    var panel = getGentorPanel();
    if (!panel) return;
    attachBoardPanelCloseObserver(panel);
    if (getComputedStyle(panel).display !== 'none') {
      injectSnippetsButton(panel, target);
      return;
    }
    pkmObs = new MutationObserver(function () {
      if (getComputedStyle(panel).display !== 'none') {
        injectSnippetsButton(panel, target);
        stopPkmWait();
      }
    });
    pkmObs.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
    pkmTimer = setTimeout(stopPkmWait, 2000);
  }, true);

  function attachBoardPanelCloseObserver(panel) {
    panel = panel || getGentorPanel();
    if (!panel || panel.__gcCloseWatched) return;
    panel.__gcCloseWatched = true;
    new MutationObserver(function () {
      if (!panel.isConnected || getComputedStyle(panel).display === 'none') {
        hideSidePanel();
      }
    }).observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  document.addEventListener('mousedown', function (e) {
    var sp = document.getElementById('gc-side-panel');
    if (!sp || !sp.classList.contains('gc-open')) return;
    if (sp.contains(e.target)) return;
    var gp = getGentorPanel();
    if (gp && gp.contains(e.target)) return;
    hideSidePanel();
  }, true);
})();
  `;

  function runBoardSnippets() {
    const evaled = (unsafeWindow.__gcBoardEvaled = unsafeWindow.__gcBoardEvaled || new WeakSet());
    document.querySelectorAll('gc-board-script').forEach((el) => {
      if (evaled.has(el)) return;
      evaled.add(el);
      const b64 = cleanTagText(el);
      if (!b64) return;
      try { unsafeWindow.eval(b64ToUtf8(b64)); }
      catch (e) { if (window.console) console.error('[gc-board-script]', el.id || '(no-id)', e); }
    });
  }
  function ensureBoardHideStyle() {
    if (document.getElementById('gc-bd-hide-style')) return;
    const st = document.createElement('style');
    st.id = 'gc-bd-hide-style';
    st.className = 'nosave';
    st.textContent = 'gc-board-script,gc-init-state{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  }
  function initNonHomeRouter() {
    const onHome = /^\/(index\.phtml)?$/.test(location.pathname);
    if (onHome) return;
    let routedAs = null;

    function detect() {
      if (unsafeWindow.boardMode === true) return 'board';
      if (document.body && document.body.classList.contains('board-mode')) return 'board';
      if (document.querySelector('char-xml gm-root')) return 'board';
      if (unsafeWindow.customCharMode === true) return 'char';
      if (document.querySelector('char-xml character')) return 'char';
      return null;
    }

    function tick() {
      const kind = routedAs || detect();
      if (!kind) return;
      routedAs = kind;
      if (kind === 'board') {
        ensureBoardHideStyle();
        if (!unsafeWindow.__gcBoardRegistryInit) {
          try { unsafeWindow.eval(BOARD_REGISTRY_SRC); }
          catch (e) { if (window.console) console.error('[gc-board-registry]', e); }
        }
        runBoardSnippets();
      } else {
        runAllSnippets();
      }
    }

    tick();
    let t = null;
    new MutationObserver(() => {
      if (t) return;
      t = setTimeout(() => { t = null; tick(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  initNonHomeRouter();

  if (!/^\/(index\.phtml)?$/.test(location.pathname)) return;

  GM_addStyle(`
.gm-distrib {
  --gm-bg: var(--color-bg, #fff);
  --gm-text: var(--color-text, #000);
  --gm-main: var(--color-main, #4e98e0);
  --gm-border: var(--color-border, #999);
  --gm-bg-secondary: color-mix(in srgb, var(--gm-bg) 92%, var(--gm-text));
  --gm-text-muted: color-mix(in srgb, var(--gm-text) 55%, var(--gm-bg));
  --gm-row-hover: color-mix(in srgb, var(--gm-text) 4%, var(--gm-bg));
  --gm-accent-tint: color-mix(in srgb, var(--gm-main) 12%, var(--gm-bg));
  --gm-success: #5cb85c;
  --gm-warning: #f0ad4e;
  --gm-error: #d9534f;
  --gm-success-tint: color-mix(in srgb, var(--gm-success) 14%, var(--gm-bg));
  --gm-warning-tint: color-mix(in srgb, var(--gm-warning) 18%, var(--gm-bg));
  --gm-error-tint: color-mix(in srgb, var(--gm-error) 14%, var(--gm-bg));
  --gm-shadow: rgba(0, 0, 0, 0.18);
}

#gm-distrib-trigger {
}
#gm-distrib-trigger.is-open {
  background: var(--color-main) !important;
  color: #fff !important;
}
#gm-distrib-trigger > svg {
  display: block !important;
  margin: 0 auto !important;
  width: 18px !important; height: 18px !important;
}

.gm-distrib {
  position: fixed; z-index: 2147483647;
  width: 440px; height: min(640px, calc(100vh - 80px));
  background: var(--gm-bg); color: var(--gm-text);
  border: 1px solid var(--gm-border); border-radius: 6px;
  box-shadow: 0 12px 36px var(--gm-shadow);
  display: flex; flex-direction: column; overflow: hidden;
  font-family: inherit; font-size: 13px; line-height: 1.4;
}
.gm-distrib.gm-hidden { display: none; }
.gm-distrib * { box-sizing: border-box; }
.gm-distrib .gm-mono { font-family: Consolas, 'Courier New', monospace; font-variant-ligatures: none; }

.gm-distrib .gm-header {
  flex: 0 0 auto; height: 42px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-bottom: 1px solid var(--gm-border);
}
.gm-distrib .gm-header-left { display: flex; align-items: center; gap: 8px; }
.gm-distrib .gm-logo {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  color: var(--gm-main);
}
.gm-distrib .gm-logo > svg { width: 18px; height: 18px; display: block; }
.gm-distrib .gm-title { font-size: 13px; font-weight: 600; }
.gm-distrib .gm-title-mono { font-family: Consolas, monospace; font-weight: 500; }
.gm-distrib .gm-header-right { display: flex; gap: 2px; }
.gm-distrib .gm-iconbtn {
  width: 28px; height: 28px; padding: 0;
  border: 0; background: transparent;
  color: var(--gm-text-muted); cursor: pointer;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
}
.gm-distrib .gm-iconbtn > svg { display: block; }
.gm-distrib .gm-iconbtn:hover { background: var(--gm-accent-tint) !important; color: var(--gm-main) !important; box-shadow: none !important; }

.gm-distrib .gm-tabs {
  flex: 0 0 auto; display: flex; gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--gm-border);
}
.gm-distrib .gm-tab {
  flex: 1 1 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 28px; padding: 0 6px; border-radius: 4px;
  border: 0;
  color: #fff; opacity: 0.82;
  font-family: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
.gm-distrib .gm-tab > i { font-size: 13px; }
.gm-distrib .gm-tab-active { opacity: 1; }
.gm-distrib .gm-tab:hover { opacity: 1; box-shadow: inset 0 0 0 999px rgba(0, 0, 0, 0.12); }

.gm-distrib .gm-section-head {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px 4px;
}
.gm-distrib .gm-section-title {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  color: var(--gm-text-muted); text-transform: uppercase;
}
.gm-distrib .gm-section-actions { display: flex; gap: 10px; align-items: center; }
.gm-distrib .gm-link {
  font-size: 11.5px; color: var(--gm-main); cursor: pointer; text-decoration: none;
}
.gm-distrib .gm-link:hover { text-decoration: underline; }
.gm-distrib .gm-link-muted { color: var(--gm-text-muted); }

.gm-distrib .gm-search {
  flex: 0 0 auto; position: relative;
  padding: 0 12px 6px;
}
.gm-distrib .gm-search input {
  width: 100%; height: 28px; padding: 0 8px 0 26px;
  border: 1px solid var(--gm-border); border-radius: 4px;
  background: var(--gm-bg-secondary); color: var(--gm-text);
  font-family: inherit; font-size: 12px; outline: none;
}
.gm-distrib .gm-search input:focus { border-color: var(--gm-main); }
.gm-distrib .gm-search-icon {
  position: absolute; left: 21px; top: 7px;
  color: var(--gm-text-muted); pointer-events: none;
  display: flex; align-items: center;
}

.gm-distrib .gm-list {
  flex: 1 1 0; min-height: 0;
  overflow-y: auto;
  padding: 0;
}
.gm-distrib .gm-row {
  display: grid;
  grid-template-columns: 16px 22px 1fr auto auto;
  align-items: center; gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  border-top: 1px solid var(--gm-border);
}
.gm-distrib .gm-row:first-child { border-top: 0; }
.gm-distrib .gm-row:hover { background: var(--gm-row-hover); }
.gm-distrib .gm-row-selected { background: var(--gm-accent-tint); }
.gm-distrib .gm-row-disabled { cursor: default; opacity: 0.55; }
.gm-distrib .gm-row-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  background-size: cover; background-position: center;
  background-color: var(--gm-bg-secondary);
  flex: 0 0 22px;
}
.gm-distrib .gm-row-name {
  font-size: 12.5px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gm-distrib .gm-row-trailing { display: flex; align-items: center; gap: 4px; }
.gm-distrib .gm-extlink {
  width: 18px; height: 18px;
  color: var(--gm-text-muted); opacity: 0.4;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.gm-distrib .gm-extlink > svg { display: block; }
.gm-distrib .gm-row:hover .gm-extlink { opacity: 1; color: var(--gm-main); }

.gm-distrib .gm-check {
  width: 14px; height: 14px; border-radius: 3px;
  border: 1.5px solid var(--gm-border); background: var(--gm-bg);
  display: flex; align-items: center; justify-content: center;
  flex: 0 0 14px;
}
.gm-distrib .gm-check-on {
  background: var(--gm-main); border-color: var(--gm-main);
}
.gm-distrib .gm-check-on::after {
  content: ''; width: 8px; height: 4px;
  border-left: 1.5px solid #fff; border-bottom: 1.5px solid #fff;
  transform: rotate(-45deg) translate(1px, -1px);
}
.gm-distrib .gm-check-disabled { opacity: 0.4; }

.gm-distrib .gm-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 600;
  padding: 1px 5px; border-radius: 3px;
  font-family: Consolas, monospace;
  white-space: nowrap;
}
.gm-distrib .gm-badge-success { background: var(--gm-success-tint); color: var(--gm-success); }
.gm-distrib .gm-badge-warning { background: var(--gm-warning-tint); color: var(--gm-warning); }
.gm-distrib .gm-badge-none {
  background: var(--gm-bg-secondary); color: var(--gm-text-muted);
  font-family: inherit; font-weight: 500;
}
.gm-distrib .gm-badge-viewonly {
  background: transparent; color: var(--gm-text-muted);
}
.gm-distrib .gm-badge-dot {
  width: 5px; height: 5px; border-radius: 50%; display: inline-block;
}
.gm-distrib .dot-success { background: var(--gm-success); }
.gm-distrib .dot-warning { background: var(--gm-warning); }
.gm-distrib .gm-badge-cat-fix      { background: var(--gm-accent-tint);  color: var(--gm-main); }
.gm-distrib .gm-badge-cat-homebrew { background: var(--gm-warning-tint); color: var(--gm-warning); }
.gm-distrib .gm-badge-cat-feature  { background: var(--gm-success-tint); color: var(--gm-success); }
.gm-distrib .gm-badge-cat-service  { background: var(--gm-bg-secondary); color: var(--gm-text-muted); }
.gm-distrib .gm-cat-bar {
  flex: 0 0 auto;
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
  padding: 2px 12px 8px;
}
.gm-distrib .gm-cat-chip {
  cursor: pointer; user-select: none;
  opacity: 0.45; transition: opacity 0.15s ease;
  border: 1px solid transparent;
}
.gm-distrib .gm-cat-chip:hover { opacity: 0.8; }
.gm-distrib .gm-cat-chip.is-active { opacity: 1; }
.gm-distrib .gm-cat-chip-all { background: var(--gm-bg-secondary); color: var(--gm-text-muted); }

.gm-distrib .gm-source {
  flex: 0 0 auto; padding: 10px 12px;
  border-top: 1px solid var(--gm-border);
  display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;
}
.gm-distrib .gm-source-info { font-size: 11px; min-width: 0; }
.gm-distrib .gm-source-line1 {
  font-family: Consolas, monospace; color: var(--gm-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gm-distrib .gm-source-line2 {
  font-size: 10px; color: var(--gm-text-muted); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.gm-distrib .gm-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 28px; padding: 0 12px;
  border-radius: 4px; border: 1px solid transparent;
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
}
.gm-distrib .gm-btn > svg { display: block; }
.gm-distrib .gm-btn:hover { box-shadow: none !important; text-shadow: none !important; }

.gm-distrib .gm-btn-primary { background: var(--gm-main); color: #fff; }
.gm-distrib .gm-btn-primary:hover { background: var(--gm-main) !important; color: #fff !important; filter: brightness(0.92); }

.gm-distrib .gm-btn-accent { background: #dd8e2d; color: #fff; }
.gm-distrib .gm-btn-accent:hover { background: #c78129 !important; color: #fff !important; }

.gm-distrib .gm-btn-success { background: var(--gm-success-tint); border-color: var(--gm-success); color: var(--gm-success); }
.gm-distrib .gm-btn-success:hover { background: var(--gm-success-tint) !important; border-color: var(--gm-success) !important; color: var(--gm-success) !important; filter: brightness(0.96); }

.gm-distrib .gm-btn-secondary {
  background: var(--gm-bg);
  border: 1px solid var(--gm-border);
  color: var(--gm-text-muted);
  font-weight: 400;
}
.gm-distrib .gm-btn-secondary:hover {
  background: var(--gm-row-hover) !important;
  color: var(--gm-text) !important;
  border-color: var(--gm-text-muted);
}
.gm-distrib .gm-btn-error-outline {
  background: var(--gm-bg); border-color: var(--gm-error);
  color: var(--gm-error);
}
.gm-distrib .gm-btn-error-outline:hover { background: var(--gm-error-tint) !important; color: var(--gm-error) !important; }
.gm-distrib .gm-btn-ghost {
  background: transparent; color: var(--gm-text-muted);
  border-color: transparent;
}
.gm-distrib .gm-btn-ghost:hover { background: var(--gm-main) !important; color: #fff !important; }
.gm-distrib .gm-btn-disabled {
  background: var(--gm-bg-secondary) !important;
  color: var(--gm-text-muted) !important;
  border-color: transparent !important;
  cursor: not-allowed !important;
}
.gm-distrib .gm-btn-noclick { cursor: not-allowed; }
.gm-distrib .gm-row-action { width: 124px; }
.gm-distrib .gm-row-action > .gm-btn,
.gm-distrib .gm-row-action > .gm-row-status { width: 100%; }
.gm-distrib .gm-desc-body {
  grid-column: 1 / -1;
  max-height: 0; overflow: hidden;
  transition: max-height 0.25s ease;
}
.gm-distrib .gm-desc-body.gm-desc-open { max-height: 300px; }
.gm-distrib .gm-desc-inner {
  opacity: 0.72; font-size: 11.5px; line-height: 1.4;
  padding-top: 4px;
}

.gm-distrib .gm-footer {
  flex: 0 0 auto; height: 48px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px;
  border-top: 1px solid var(--gm-border);
}
.gm-distrib .gm-footer-info { font-size: 12px; }
.gm-distrib .gm-footer-primary { height: 32px; padding: 0 14px; }

.gm-distrib .gm-row-status {
  font-size: 11px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 4px;
}
.gm-distrib .gm-row-status-muted { color: var(--gm-text-muted); }
.gm-distrib .gm-row-status-active { color: var(--gm-main); }
.gm-distrib .gm-row-status-err { color: var(--gm-error); cursor: pointer; }
.gm-distrib .gm-spinner {
  width: 10px; height: 10px; border-radius: 50%;
  border: 1.5px solid currentColor; border-right-color: transparent;
  animation: gm-spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes gm-spin { to { transform: rotate(360deg); } }

.gm-distrib .gm-blank {
  flex: 1 1 auto; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 20px; text-align: center;
}
.gm-distrib .gm-blank-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: var(--gm-bg-secondary); color: var(--gm-text-muted);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 10px;
}
.gm-distrib .gm-blank-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.gm-distrib .gm-blank-text {
  font-size: 12px; color: var(--gm-text-muted); line-height: 1.5;
  max-width: 300px; margin-bottom: 12px;
}
.gm-distrib .gm-blank-actions { display: flex; gap: 8px; }

.gm-distrib .gm-scrim {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1;
}
.gm-distrib .gm-confirm-scrim { z-index: 3; }
.gm-distrib .gm-confirm-box {
  z-index: 4 !important;
  inset: auto !important; top: 50% !important; left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: calc(100% - 48px) !important; max-height: calc(100% - 48px) !important;
  height: auto !important;
}
.gm-distrib .gm-confirm-box .gm-settings-body {
  flex: 0 0 auto; min-height: 56px;
  align-items: flex-start; justify-content: center;
}
.gm-distrib .gm-settings {
  position: absolute; inset: 16px;
  z-index: 2;
  background: var(--gm-bg); color: var(--gm-text);
  border: 1px solid var(--gm-border); border-radius: 6px;
  box-shadow: 0 8px 20px var(--gm-shadow);
  display: flex; flex-direction: column; overflow: hidden;
}
.gm-distrib .gm-settings-head {
  flex: 0 0 auto; height: 42px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-bottom: 1px solid var(--gm-border);
}
.gm-distrib .gm-settings-title { font-weight: 600; font-size: 13px; }
.gm-distrib .gm-settings-body {
  flex: 1 1 0; overflow-y: auto;
  padding: 12px; display: flex; flex-direction: column; gap: 14px;
}
.gm-distrib .gm-field { display: flex; flex-direction: column; gap: 4px; }
.gm-distrib .gm-field-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  color: var(--gm-text-muted); text-transform: uppercase;
}
.gm-distrib .gm-input {
  height: 30px; padding: 0 8px;
  border: 1px solid var(--gm-border); border-radius: 4px;
  background: var(--gm-bg-secondary); color: var(--gm-text);
  font-family: inherit; font-size: 12px; outline: none;
}
.gm-distrib .gm-input:focus { border-color: var(--gm-main); }
.gm-distrib .gm-input-mono { font-family: Consolas, monospace; }
.gm-distrib .gm-field-help {
  font-size: 10.5px; color: var(--gm-text-muted);
  font-style: italic;
}
.gm-distrib .gm-checkrow {
  display: flex; align-items: flex-start; gap: 8px;
  cursor: pointer;
}
.gm-distrib .gm-checkrow-label { display: flex; flex-direction: column; gap: 2px; }
.gm-distrib .gm-checkrow-sub {
  font-size: 11px; color: var(--gm-text-muted); margin-top: 2px;
}
.gm-distrib .gm-settings-foot {
  flex: 0 0 auto; height: 48px;
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 0 12px;
  background: var(--gm-bg-secondary);
  border-top: 1px solid var(--gm-border);
}
  `);

  function svg(viewBox, body, opts = {}) {
    const size = opts.size || 16;
    const stroke = opts.stroke || 2;
    return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }
  const ICONS = {
    logo: svg('0 0 24 24',
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      { stroke: 2 }),
    cube:     svg('0 0 24 24',
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      { size: 28, stroke: 2 }),
    settings: '<i class="fa fa-cog"></i>',
    refresh:  '<i class="fa fa-refresh"></i>',
    extlink:  '<i class="fa fa-external-link"></i>',
    search:   '<i class="fa fa-search"></i>',
    close:    '<i class="fa fa-times"></i>',
    play:     '<i class="fa fa-play"></i>',
    stop:     '<i class="fa fa-stop"></i>',
  };

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === 'style' && typeof attrs[k] === 'object') {
          Object.assign(el.style, attrs[k]);
        } else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) {
          el.setAttribute(k, attrs[k]);
        }
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function extractAvatarUrl(el) {
    const av = el.querySelector('.my-char-avatar');
    if (!av) return null;
    const clean = (u) => String(u).replace(/["'\\()]/g, '');
    const dataSrc = av.getAttribute('data-src');
    if (dataSrc) return clean(dataSrc.startsWith('http') ? dataSrc : '/' + dataSrc.replace(/^\//, ''));
    const bg = getComputedStyle(av).backgroundImage;
    const m = bg && bg.match(/url\(['"]?([^'")]+)['"]?\)/);
    return m ? clean(m[1]) : null;
  }

  function detectLoggedIn() {
    const auth = document.querySelector('auth');
    const profileEl = auth ? auth.querySelector(
      '.my-profile, .auth-name, .auth-profile, .profile-name, ' +
      'a[href*="profile"], a[href*="logout"], a[href*="exit"], ' +
      '[onclick*="logout"], [onclick*="exit"]'
    ) : null;
    return !!profileEl
      || document.querySelectorAll('.my-char.my-custom').length > 0
      || document.querySelectorAll('.my-char.my-board').length > 0;
  }

  function readCustomSheets() {
    const els = Array.from(document.querySelectorAll('.my-char.my-custom'));
    const seen = new Set();
    const result = [];
    for (const el of els) {
      const charLinkAttr = el.getAttribute('char-link') || '';
      const idMatch = charLinkAttr.replace(/^view_/, '').match(/([a-f0-9]{32})/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const nameEl = el.querySelector('.my-char-name');
      result.push({
        id,
        name: nameEl ? nameEl.textContent.trim() : '(без имени)',
        avatar: extractAvatarUrl(el),
        viewOnly: el.className.includes('view-only'),
        status: 'unknown', current: null, target: null,
      });
    }
    return result;
  }

  function readBoardSheets() {
    const els = Array.from(document.querySelectorAll('.my-char.my-board'));
    const seen = new Set();
    const result = [];
    for (const el of els) {
      const charLinkAttr = el.getAttribute('char-link') || '';
      const idMatch = charLinkAttr.replace(/^view_/, '').match(/([a-f0-9]{32})/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const nameEl = el.querySelector('.my-char-name');
      result.push({
        id,
        name: nameEl ? nameEl.textContent.trim() : '(без имени)',
        avatar: extractAvatarUrl(el),
        viewOnly: el.className.includes('view-only'),
      });
    }
    return result;
  }

  function gmFetch(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 15000,
        onload: r => r.status === 200 ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status)),
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }
  async function pullBundle() {
    const [js, less] = await Promise.all([gmFetch(cfg('sourceJsUrl')), gmFetch(cfg('sourceLessUrl'))]);
    if (!/^\{\s*\/\/\s*===\s*GMENTOR-BUNDLE-START\s*===/.test(js.trim()) || js.indexOf('GMENTOR-BUNDLE-END') === -1) {
      throw new Error('Скачанный JS не похож на бандл (нет маркеров) — проверьте URL в настройках');
    }
    if (less.indexOf('GMENTOR-LESS-BUNDLE-START') === -1 || less.indexOf('GMENTOR-LESS-BUNDLE-END') === -1) {
      throw new Error('Скачанный LESS не похож на бандл (нет маркеров) — проверьте URL в настройках');
    }
    const m = js.match(/\/\/\s*Bundle version:\s*(\S+)/);
    const bundle = { js, less, version: m ? m[1] : null, size: js.length + less.length, fetchedAt: Date.now() };
    setCfg('cachedBundle', bundle);
    return bundle;
  }

  const READ_VERSION_FN_SRC = `
(async function () {
  function b64ToText(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  let attempts = 0;
  while ((!window.globalChar || !window.globalChar.length || !window.gm('gc-script').length) && attempts < 40) {
    await new Promise(r => setTimeout(r, 200)); attempts++;
  }
  if (!window.gm('gc-script').length) return 'none';
  const txt = b64ToText(String(window.gm('gc-script').text() || ''));
  if (txt.indexOf('GMENTOR-BUNDLE-START') === -1) return 'none';   // бандла на листе нет вообще
  const m = txt.match(/\\/\\/\\s*Bundle version:\\s*(\\S+)/);
  return m ? m[1] : 'unversioned';   // 'unversioned' = bundle есть, но без version-строки
})()
  `;
  function readSheetVersion(sheetId) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;border:0';
      iframe.src = 'https://gmentor.ru/' + sheetId;
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; try { iframe.remove(); } catch {} resolve(v); };
      const timer = setTimeout(() => done(null), 20000);
      iframe.onload = async () => {
        try {
          const v = await iframe.contentWindow.eval(READ_VERSION_FN_SRC);
          clearTimeout(timer); done(v);
        } catch { clearTimeout(timer); done(null); }
      };
      iframe.onerror = () => { clearTimeout(timer); done(null); };
      document.body.appendChild(iframe);
    });
  }

  async function recheckAllVersions() {
    if (state.recheckBusy) return;
    state.recheckBusy = true;
    try {
      rerender();
      const queue = state.sheets.filter(s => !s.viewOnly).map(s => s.id);
      const inflight = new Set();
      async function worker(id) {
        const v = await readSheetVersion(id);
        const cur = Object.assign({}, cfg('sheetVersions'));
        cur[id] = { version: v, checkedAt: Date.now() };
        setCfg('sheetVersions', cur);
        applyVersionsToSheets(cur);
        rerender();
      }
      while (queue.length || inflight.size) {
        while (inflight.size < 2 && queue.length) {
          const id = queue.shift();
          const p = worker(id).catch(() => {}).then(() => inflight.delete(p));
          inflight.add(p);
        }
        await Promise.race(Array.from(inflight));
      }
    } finally {
      state.recheckBusy = false;
      rerender();
    }
  }

  function applyVersionsToSheets(versionsMap) {
    const targetV = state.bundle && state.bundle.version;
    for (const s of state.sheets) {
      const stored = versionsMap[s.id];
      if (!stored || stored.version === null) {
        s.status = 'unknown';
      } else if (stored.version === 'none') {
        s.status = 'none';
      } else if (stored.version === 'unversioned') {
        s.status = targetV ? 'outdated' : 'fresh';
        s.current = '?'; s.target = targetV;
      } else if (targetV && stored.version === targetV) {
        s.status = 'fresh'; s.current = stored.version;
      } else if (targetV) {
        s.status = 'outdated'; s.current = stored.version; s.target = targetV;
      } else {
        s.status = 'fresh'; s.current = stored.version;
      }
    }
  }

  const PUSH_FN_SRC = `
(async function (newJs, newLess) {
  function b64ToText(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function textToB64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }
  let attempts = 0;
  while ((!window.globalChar || !window.globalChar.length || !window.gm('gc-script').length) && attempts < 60) {
    await new Promise(r => setTimeout(r, 200)); attempts++;
  }
  if (!window.globalChar || !window.globalChar.length) throw new Error('globalChar not hydrated');
  if (!window.gm('gc-script').length) throw new Error('no <gc-script> tag');

  const $gs = window.gm('gc-script');
  const $gl = window.gm('gc-style-less');
  const curScript = b64ToText(String($gs.text() || ''));
  const curLess = $gl.length ? b64ToText(String($gl.text() || '')) : '';
  const jsMarker = /^\\{\\s*\\/\\/\\s*===\\s*GMENTOR-BUNDLE-START\\s*===[\\s\\S]*?\\n\\}\\s*\\/\\/\\s*===\\s*GMENTOR-BUNDLE-END\\s*===$/mg;
  const lessMarker = /^\\/\\*\\s*===\\s*GMENTOR-LESS-BUNDLE-START\\s*===\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*===\\s*GMENTOR-LESS-BUNDLE-END\\s*===\\s*\\*\\/$/mg;
  const cleanScript = curScript.replace(jsMarker, '').trim();
  const cleanLess = curLess.replace(lessMarker, '').trim();
  if (curScript.indexOf('GMENTOR-BUNDLE-START') !== -1 && cleanScript.indexOf('GMENTOR-BUNDLE-START') !== -1) {
    throw new Error('JS push aborted: старый блок бандла найден, но не вырезался (маркеры повреждены?) — почистите SCRIPT вручную');
  }
  if (curLess.indexOf('GMENTOR-LESS-BUNDLE-START') !== -1 && cleanLess.indexOf('GMENTOR-LESS-BUNDLE-START') !== -1) {
    throw new Error('LESS push aborted: старый блок бандла найден, но не вырезался (маркеры повреждены?) — почистите CSS/LESS вручную');
  }
  const finalScript = (cleanScript ? cleanScript + '\\n\\n' : '') + newJs;
  const finalLess = (cleanLess ? cleanLess + '\\n\\n' : '') + newLess;
  $gs.text(textToB64(finalScript));
  if ($gl.length) $gl.text(textToB64(finalLess));
  if (typeof window.saveButtonEnable === 'function') window.saveButtonEnable();
  const saved = await new Promise((res) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; res(ok); } };
    try { window.saveCurrentChar(true, () => finish(true)); }
    catch (e) { finish(false); }
    setTimeout(() => finish(false), 25000);
  });
  if (!saved) throw new Error('push записан в DOM, но движок не подтвердил сохранение за 25с — проверьте лист');
  return { jsLen: finalScript.length, lessLen: finalLess.length };
})
  `;
  function pushToSheet(sheetId, newJs, newLess) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;border:0';
      iframe.src = 'https://gmentor.ru/' + sheetId;
      let settled = false;
      const finishOk = (r) => { if (settled) return; settled = true; cleanup(); resolve(r); };
      const finishErr = (e) => { if (settled) return; settled = true; cleanup(); reject(e); };
      const cleanup = () => { try { iframe.remove(); } catch {} };
      const timer = setTimeout(() => finishErr(new Error('push timeout (45s)')), 45000);
      iframe.onload = async () => {
        try {
          const fn = iframe.contentWindow.eval(PUSH_FN_SRC);
          const result = await fn(newJs, newLess);
          clearTimeout(timer); finishOk(result);
        } catch (e) { clearTimeout(timer); finishErr(e); }
      };
      iframe.onerror = () => finishErr(new Error('iframe load failed'));
      document.body.appendChild(iframe);
    });
  }

  const BOARD_PUSH_FN_SRC = `
(async function (snippetId, version, rawCode) {
  function textToB64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }
  let attempts = 0;
  while ((!document.querySelector('char-xml gm-root') || typeof window.saveCurrentChar !== 'function') && attempts < 60) {
    await new Promise(r => setTimeout(r, 200)); attempts++;
  }
  const charXml = document.querySelector('char-xml');
  if (!charXml || !charXml.querySelector('gm-root')) throw new Error('board not hydrated (no gm-root)');

  const existing = document.getElementById('gc-snippet-' + snippetId);
  if (existing) existing.remove();
  const el = document.createElement('gc-board-script');
  el.id = 'gc-snippet-' + snippetId;
  el.setAttribute('data-version', version || '');
  el.textContent = textToB64(rawCode);
  charXml.appendChild(el);

  if (typeof window.saveButtonEnable === 'function') window.saveButtonEnable();
  const saved = await new Promise((res) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; res(ok); } };
    try { window.saveCurrentChar(true, () => finish(true)); }
    catch (e) { finish(false); }
    setTimeout(() => finish(false), 25000);
  });
  if (!saved) throw new Error('запись на доску сделана, но движок не подтвердил сохранение за 25с');
  return { id: snippetId, len: el.textContent.length };
})
  `;
  function pushBoardSnippet(boardId, snippet, rawCode) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;border:0';
      iframe.src = 'https://gmentor.ru/' + boardId;
      let settled = false;
      const finishOk = (r) => { if (settled) return; settled = true; cleanup(); resolve(r); };
      const finishErr = (e) => { if (settled) return; settled = true; cleanup(); reject(e); };
      const cleanup = () => { try { iframe.remove(); } catch {} };
      const timer = setTimeout(() => finishErr(new Error('board push timeout (45s)')), 45000);
      iframe.onload = async () => {
        try {
          const fn = iframe.contentWindow.eval(BOARD_PUSH_FN_SRC);
          const result = await fn(snippet.id, snippet.version, rawCode);
          clearTimeout(timer); finishOk(result);
        } catch (e) { clearTimeout(timer); finishErr(e); }
      };
      iframe.onerror = () => finishErr(new Error('iframe load failed'));
      document.body.appendChild(iframe);
    });
  }

  function loadBoardManifest() {
    if (state.boardLoading) return;
    state.boardLoading = true; state.boardError = null; rerender();
    gmFetch(cfg('boardManifestUrl')).then((t) => {
      state.boardManifest = JSON.parse(t);
      state.boardLoading = false; rerender();
    }).catch((e) => {
      state.boardError = e.message; state.boardLoading = false; rerender();
    });
  }

  const BOARD_DETECT_FN_SRC = `
(async function () {
  let attempts = 0;
  while (!document.querySelector('char-xml gm-root') && attempts < 50) {
    await new Promise(r => setTimeout(r, 200)); attempts++;
  }
  const out = {};
  document.querySelectorAll('gc-board-script[id^="gc-snippet-"]').forEach(function (el) {
    out[el.id.replace('gc-snippet-', '')] = el.getAttribute('data-version') || 'unversioned';
  });
  return out;
})()
  `;
  function readBoardInstalled(boardId) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;border:0';
      iframe.src = 'https://gmentor.ru/' + boardId;
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; try { iframe.remove(); } catch {} resolve(v); };
      const timer = setTimeout(() => done(null), 20000);
      iframe.onload = async () => {
        try {
          const v = await iframe.contentWindow.eval(BOARD_DETECT_FN_SRC);
          clearTimeout(timer); done(v);
        } catch { clearTimeout(timer); done(null); }
      };
      iframe.onerror = () => { clearTimeout(timer); done(null); };
      document.body.appendChild(iframe);
    });
  }

  async function recheckBoardInstalled() {
    if (state.boardChecking) return;
    const ids = state.boardSelected.size
      ? Array.from(state.boardSelected)
      : state.boards.filter((b) => !b.viewOnly).map((b) => b.id);
    if (!ids.length) return;
    state.boardChecking = true; rerender();
    try {
      const queue = ids.slice();
      const inflight = new Set();
      async function worker(id) {
        const map = await readBoardInstalled(id);
        state.boardInstalled[id] = map;
        rerender();
      }
      while (queue.length || inflight.size) {
        while (inflight.size < 2 && queue.length) {
          const id = queue.shift();
          const p = worker(id).catch(() => {}).then(() => inflight.delete(p));
          inflight.add(p);
        }
        await Promise.race(Array.from(inflight));
      }
    } finally {
      state.boardChecking = false; rerender();
    }
  }

  function boardSnippetAction(snippet) {
    let need = 0, update = 0, upToDate = 0, unknown = 0, minVer = null;
    state.boardSelected.forEach((bid) => {
      const map = state.boardInstalled[bid];
      if (map == null) { unknown++; return; }
      const v = map[snippet.id];
      if (v == null) { need++; return; }
      if (v === 'unversioned' || cmpVer(v, snippet.version) < 0) {
        update++;
        if (v !== 'unversioned' && (minVer == null || cmpVer(v, minVer) < 0)) minVer = v;
        return;
      }
      upToDate++;
    });
    return { need: need, update: update, upToDate: upToDate, unknown: unknown, minVer: minVer, sel: state.boardSelected.size };
  }

  function boardRowStatus(boardId) {
    const map = state.boardInstalled[boardId];
    if (!map) return null;
    const snippets = (state.boardManifest && state.boardManifest.snippets) || [];
    if (!snippets.length) return null;
    let installed = 0, outdated = 0;
    snippets.forEach((s) => {
      const v = map[s.id];
      if (v == null) return;
      installed++;
      if (v === 'unversioned' || cmpVer(v, s.version) < 0) outdated++;
    });
    return { installed: installed, total: snippets.length, outdated: outdated };
  }
  async function installBoardSnippet(snippet) {
    if (state.boardPushing) return;
    const ids = Array.from(state.boardSelected);
    if (!ids.length) return;
    state.boardBulkResult = null;
    state.boardPushing = true; state.boardPushStates[snippet.id] = { kind: 'pushing', total: ids.length }; rerender();
    try {
      let code;
      try { code = await gmFetch(cfg('boardBaseUrl') + snippet.file); }
      catch (e) {
        state.boardPushStates[snippet.id] = { kind: 'error', msg: 'не скачался' };
        return;
      }
      let ok = 0, err = 0;
      for (const boardId of ids) {
        try {
          await pushBoardSnippet(boardId, snippet, code);
          ok++;
          if (!state.boardInstalled[boardId]) state.boardInstalled[boardId] = {};
          state.boardInstalled[boardId][snippet.id] = snippet.version;
        }
        catch (e) { err++; console.error('[board push]', boardId, e); }
      }
      delete state.boardPushStates[snippet.id];
      if (err) state.boardPushStates[snippet.id] = { kind: 'partial', ok: ok, err: err };
    } finally {
      state.boardPushing = false; rerender();
    }
  }

  let state = {
    open: false,
    sheets: [],
    selected: new Set(),
    bundle: cfg('cachedBundle'),
    pulling: false, pullError: null,
    pushing: false, cancelled: false,
    pushStates: {}, pushProgress: null, pushErrors: {}, expandedErrorId: null,
    searchQuery: '',
    settingsOpen: false,
    recheckBusy: false,
    demoEdge: null,
    loggedOut: false,
    activeTab: 'custom',
    allManifest: null, allLoading: false, allError: null,
    allBusy: {}, allErrors: {},
    boards: [], boardSelected: new Set(),
    boardManifest: null, boardLoading: false, boardError: null,
    boardPushing: false, boardPushStates: {},
    boardInstalled: {},
    boardChecking: false,
    boardBulkResult: null,
    descOpen: {},
    confirmDialog: null,
    boardConfirm: null,
    boardBulk: null,
    allCatFilter: new Set(),
    boardCatFilter: new Set(),
  };
  let panelEl = null;
  let triggerEl = null;

  function positionPanel() {
    if (!panelEl || !triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const panelW = 440;
    const panelH = Math.min(640, window.innerHeight - 80);
    let left = r.right - panelW;
    if (left < 8) left = r.left;
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
    let top = r.bottom + 6;
    if (top + panelH > window.innerHeight - 8) top = Math.max(8, r.top - panelH - 6);
    panelEl.style.left = left + 'px';
    panelEl.style.top = top + 'px';
  }

  function openPanel() {
    state.open = true;
    engineTabColors = probeEngineTabColors();
    state.loggedOut = !detectLoggedIn();
    state.sheets = readCustomSheets();
    state.boards = readBoardSheets();
    const sheetIds = new Set(state.sheets.filter(s => !s.viewOnly).map(s => s.id));
    state.selected.forEach((id) => { if (!sheetIds.has(id)) state.selected.delete(id); });
    const boardIds = new Set(state.boards.filter(b => !b.viewOnly).map(b => b.id));
    state.boardSelected.forEach((id) => { if (!boardIds.has(id)) state.boardSelected.delete(id); });
    applyVersionsToSheets(cfg('sheetVersions'));
    if (triggerEl) triggerEl.classList.add('is-open');
    if (panelEl) panelEl.remove();
    panelEl = renderPanel();
    document.body.appendChild(panelEl);
    positionPanel();
    if (cfg('autoPull') && (!state.bundle || (Date.now() - state.bundle.fetchedAt > 30 * 60 * 1000))) {
      onPull();
    }
  }
  function closePanel() {
    state.open = false;
    if (triggerEl) triggerEl.classList.remove('is-open');
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }
  function rerender() {
    if (!state.open) return;
    const next = renderPanel();
    panelEl.replaceWith(next);
    panelEl = next;
    positionPanel();
  }

  function renderOverlays() {
    const nodes = [];
    if (state.settingsOpen) nodes.push(renderSettings());
    if (state.boardConfirm) nodes.push(renderBoardConfirm());
    if (state.confirmDialog) nodes.push(renderConfirmDialog());
    return nodes.length ? nodes : null;
  }

  function renderPanel() {
    if (state.activeTab === 'all')
      return renderShell(renderAllBody(), null, null,
        renderOverlays());
    if (state.activeTab === 'board')
      return renderShell(renderBoardBody(), renderBoardFooter(), null,
        renderOverlays());

    if (state.demoEdge === 'logged-out' || (state.loggedOut && state.demoEdge !== 'empty'))
      return renderShell(renderNotLoggedIn(), renderEdgeFooter('logged-out'), null,
        renderOverlays());
    if (state.demoEdge === 'empty' || state.sheets.length === 0)
      return renderShell(renderEmpty(), renderEdgeFooter('empty'), null,
        renderOverlays());

    return renderShell(renderListBody(), renderFooter(),
      renderSource(),
      renderOverlays());
  }

  function renderShell(body, footer, source, overlay) {
    return h('div', { class: 'gm-distrib' },
      renderHeader(),
      renderTabs(),
      body,
      source || null,
      footer,
      overlay || null);
  }

  const TABS = [
    { id: 'custom', icon: 'fa fa-puzzle-piece', label: 'Кастом. листы', engineClass: 'btn custom' },
    { id: 'all',    icon: 'i icon-gurps',       label: 'Все листы',     engineClass: 'btn' },
    { id: 'board',  icon: 'i icon-master',      label: 'Доски',         engineClass: 'btn board' },
  ];

  var engineTabColors = null;
  function probeEngineTabColors() {
    var mentor = document.querySelector('.mentor');
    var res = { custom: '#dd8e2d', all: 'var(--color-main, #4e98e0)', board: '#666' };
    if (!mentor) return res;
    TABS.forEach(function (t) {
      try {
        var b = document.createElement('button');
        b.className = t.engineClass;
        b.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        mentor.appendChild(b);
        var bg = getComputedStyle(b).backgroundColor;
        b.remove();
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') res[t.id] = bg;
      } catch (e) {}
    });
    return res;
  }

  function renderTabs() {
    if (!engineTabColors) engineTabColors = probeEngineTabColors();
    return h('div', { class: 'gm-tabs' }, ...TABS.map((t) =>
      h('button', {
        class: 'gm-tab gm-tab-' + t.id + (state.activeTab === t.id ? ' gm-tab-active' : ''),
        style: { backgroundColor: engineTabColors[t.id] },
        html: '<i class="' + t.icon + '"></i><span>' + t.label + '</span>',
        onClick: () => {
          if (state.activeTab === t.id) return;
          state.activeTab = t.id;
          rerender();
          if (t.id === 'all' && !state.allManifest && !state.allLoading) loadAllManifest();
          if (t.id === 'board') {
            state.boards = readBoardSheets();
            if (!state.boardManifest && !state.boardLoading) loadBoardManifest();
            rerender();
            if (!Object.keys(state.boardInstalled).length) recheckBoardInstalled();
          }
        },
      })));
  }

  function renderComingSoon(title, text) {
    return h('div', { class: 'gm-blank' },
      h('div', { class: 'gm-blank-icon', html: ICONS.cube }),
      h('div', { class: 'gm-blank-title' }, title),
      h('div', { class: 'gm-blank-text' }, text || 'Скоро.'));
  }

  function renderAllBody() {
    const m = state.allManifest;
    const installed = getAllInstalled();
    let body;
    if (state.allLoading) {
      body = h('div', { class: 'gm-blank' },
        h('div', { class: 'gm-blank-text' },
          h('span', { class: 'gm-spinner', style: 'margin-right:6px;' }), 'Загрузка манифеста...'));
    } else if (state.allError) {
      body = h('div', { class: 'gm-blank' },
        h('div', { class: 'gm-blank-icon', html: ICONS.cube }),
        h('div', { class: 'gm-blank-title', style: 'color:var(--gm-error);' }, 'Ошибка'),
        h('div', { class: 'gm-blank-text' }, state.allError),
        h('div', { class: 'gm-blank-text gm-mono', style: 'font-size:10.5px;' }, cfg('allManifestUrl')),
        h('div', { class: 'gm-blank-actions' },
          h('button', { class: 'gm-btn gm-btn-secondary', onClick: loadAllManifest,
            html: ICONS.refresh + ' Повторить' })));
    } else if (!m || !m.snippets || !m.snippets.length) {
      body = h('div', { class: 'gm-blank' },
        h('div', { class: 'gm-blank-icon', html: ICONS.cube }),
        h('div', { class: 'gm-blank-title' }, 'Сниппеты для всех листов'),
        h('div', { class: 'gm-blank-text' },
          'Работают на любом листе персонажа. Устанавливаются в браузер.'),
        h('div', { class: 'gm-blank-actions' },
          h('button', { class: 'gm-btn gm-btn-primary', onClick: loadAllManifest,
            html: ICONS.refresh + ' Загрузить список' })));
    } else {
      const filtered = m.snippets.filter((s) => state.allCatFilter.size === 0 || state.allCatFilter.has(s.category));
      body = h('div', { class: 'gm-list' }, ...filtered.map(s => renderAllRow(s, installed)));
    }
    const catBar = (m && m.snippets) ? renderCategoryFilterBar(m.snippets, state.allCatFilter, false) : null;
    return h('div', { style: 'display:contents;' },
      h('div', { class: 'gm-section-head' },
        h('span', { class: 'gm-section-title' }, 'Сниппеты для всех листов'),
        h('div', { class: 'gm-section-actions' },
          h('a', { class: 'gm-link', onClick: loadAllManifest }, 'Обновить манифест'))),
      catBar,
      body);
  }

  function cmpVer(a, b) {
    const pa = String(a || '').split('.'), pb = String(b || '').split('.');
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || '0', y = pb[i] || '0';
      const nx = parseInt(x, 10), ny = parseInt(y, 10);
      if (!isNaN(nx) && !isNaN(ny)) { if (nx !== ny) return nx < ny ? -1 : 1; }
      else if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  function descLinkHtml(open) {
    return open
      ? '<i class="fa fa-caret-up"></i> Скрыть описание'
      : '<i class="fa fa-caret-down"></i> Открыть описание';
  }
  function renderSnippetDesc(s) {
    const link = h('a', { class: 'gm-link', style: 'font-size:11px;display:inline-block;margin-top:3px;',
      'data-desc-id': s.id, html: descLinkHtml(!!state.descOpen[s.id]) });
    link.addEventListener('click', () => {
      const nowOpen = !state.descOpen[s.id];
      state.descOpen[s.id] = nowOpen;
      link.innerHTML = descLinkHtml(nowOpen);
      const row = link.closest('.gm-row');
      const body = row && row.querySelector('.gm-desc-body[data-desc-id="' + s.id + '"]');
      if (body) body.classList.toggle('gm-desc-open', nowOpen);
    });
    return link;
  }
  function renderSnippetDescBody(s) {
    return h('div', {
      class: 'gm-desc-body' + (state.descOpen[s.id] ? ' gm-desc-open' : ''),
      'data-desc-id': s.id
    }, h('div', { class: 'gm-desc-inner' }, s.description || ''));
  }

  const CATEGORY_META = {
    fix:      { label: 'Fix',      cls: 'gm-badge-cat-fix' },
    homebrew: { label: 'Homebrew', cls: 'gm-badge-cat-homebrew' },
    feature:  { label: 'Feature',  cls: 'gm-badge-cat-feature' },
    service:  { label: 'Service',  cls: 'gm-badge-cat-service' },
  };
  function renderCategoryBadge(category) {
    const m = CATEGORY_META[category];
    if (!m) return null;
    return h('div', { style: 'margin:2px 0 0;' },
      h('span', { class: 'gm-badge ' + m.cls }, m.label));
  }

  const CATEGORY_ORDER = ['service', 'feature', 'fix', 'homebrew'];
  function renderCategoryFilterBar(snippets, filterSet, excludeHomebrew) {
    const present = new Set((snippets || []).map((s) => s.category).filter(Boolean));
    let cats = CATEGORY_ORDER.filter((c) => present.has(c));
    if (excludeHomebrew) cats = cats.filter((c) => c !== 'homebrew');
    if (cats.length < 2) return null;
    const allChip = h('span', {
      class: 'gm-badge gm-cat-chip gm-cat-chip-all' + (filterSet.size === 0 ? ' is-active' : ''),
      onClick: () => { filterSet.clear(); rerender(); },
    }, 'All');
    const catChips = cats.map((c) => {
      const m = CATEGORY_META[c];
      return h('span', {
        class: 'gm-badge gm-cat-chip ' + m.cls + (filterSet.has(c) ? ' is-active' : ''),
        onClick: () => { filterSet.has(c) ? filterSet.delete(c) : filterSet.add(c); rerender(); },
      }, m.label);
    });
    return h('div', { class: 'gm-cat-bar' }, allChip, ...catChips);
  }

  function renderAllRow(s, installed) {
    const inst = installed[s.id];
    const isIn = !!inst;
    const outdated = isIn && cmpVer(inst.version, s.version) < 0;
    const busy = state.allBusy[s.id];
    let action;
    if (busy) {
      action = h('span', { class: 'gm-row-status gm-row-status-active' },
        h('span', { class: 'gm-spinner' }), busy === 'installing' ? ' Ставлю...' : ' Удаляю...');
    } else if (isIn && outdated) {
      action = h('button', { class: 'gm-btn gm-btn-accent',
        onClick: () => installAllSnippet(s),
        html: ICONS.refresh + ' Обновить' });
    } else if (isIn) {
      action = h('button', { class: 'gm-btn gm-btn-error-outline',
        onClick: () => removeAllSnippet(s.id),
        html: '<i class="fa fa-times"></i> Удалить' });
    } else {
      action = h('button', { class: 'gm-btn gm-btn-success',
        onClick: () => installAllSnippet(s), html: ICONS.play + ' Установить' });
    }
    const statusBadge = state.allErrors[s.id]
      ? h('span', { class: 'gm-badge gm-badge-warning', title: state.allErrors[s.id] },
          h('span', { class: 'gm-badge-dot dot-warning' }), 'Ошибка')
      : outdated
        ? h('span', { class: 'gm-badge gm-badge-warning' },
            h('span', { class: 'gm-badge-dot dot-warning' }), 'v' + inst.version + ' → v' + s.version)
        : isIn
          ? h('span', { class: 'gm-badge gm-badge-success' },
              h('span', { class: 'gm-badge-dot dot-success' }), 'Установлен')
          : null;
    return h('div', { class: 'gm-row', style: 'grid-template-columns:1fr 124px;cursor:default;align-items:flex-start;' },
      h('div', { style: 'min-width:0;' },
        h('div', { class: 'gm-row-name', style: 'white-space:normal;' },
          s.name,
          h('span', { style: 'opacity:0.6;font-size:11px;font-family:Consolas,monospace;' }, ' v' + s.version)),
        renderCategoryBadge(s.category),
        renderSnippetDesc(s)),
      h('div', { class: 'gm-row-action', style: 'padding-top:2px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;' },
        action,
        statusBadge),
      renderSnippetDescBody(s));
  }

  function renderBoardBody() {
    const boards = state.boards;
    const selCount = state.boardSelected.size;
    const writable = boards.filter(b => !b.viewOnly);

    const boardList = boards.length
      ? h('div', { class: 'gm-list', style: 'flex:0 0 auto;max-height:38%;border-bottom:1px solid var(--gm-border);' },
          ...boards.map(renderBoardCheckRow))
      : h('div', { class: 'gm-blank', style: 'flex:0 0 auto;padding:16px;' },
          h('div', { class: 'gm-blank-text' }, 'Досок не найдено (нет листов с классом my-board).'));

    const m = state.boardManifest;
    let snipBody;
    if (state.boardLoading) {
      snipBody = h('div', { class: 'gm-blank' },
        h('div', { class: 'gm-blank-text' },
          h('span', { class: 'gm-spinner', style: 'margin-right:6px;' }), 'Загрузка манифеста...'));
    } else if (state.boardError) {
      snipBody = h('div', { class: 'gm-blank' },
        h('div', { class: 'gm-blank-title', style: 'color:var(--gm-error);' }, 'Ошибка'),
        h('div', { class: 'gm-blank-text gm-mono', style: 'font-size:10.5px;' }, cfg('boardManifestUrl')),
        h('div', { class: 'gm-blank-text' }, state.boardError),
        h('div', { class: 'gm-blank-actions' },
          h('button', { class: 'gm-btn gm-btn-secondary', onClick: loadBoardManifest,
            html: ICONS.refresh + ' Повторить' })));
    } else if (!m || !m.snippets || !m.snippets.length) {
      snipBody = h('div', { class: 'gm-blank' },
        h('div', { class: 'gm-blank-icon', html: ICONS.cube }),
        h('div', { class: 'gm-blank-title' }, 'Сниппеты для доски' ),
        h('div', { class: 'gm-blank-text' }, 'Устанавливаются в выбранные доски (видно всем за столом).'),
        h('div', { class: 'gm-blank-actions' },
          h('button', { class: 'gm-btn gm-btn-primary', onClick: loadBoardManifest,
            html: ICONS.refresh + ' Загрузить список' })));
    } else {
      const filtered = m.snippets.filter((s) => state.boardCatFilter.size === 0 || state.boardCatFilter.has(s.category));
      snipBody = h('div', { class: 'gm-list' }, ...filtered.map(renderBoardSnippetRow));
    }
    const catBar = (m && m.snippets) ? renderCategoryFilterBar(m.snippets, state.boardCatFilter, true) : null;

    return h('div', { style: 'display:contents;' },
      h('div', { class: 'gm-section-head' },
        h('span', { class: 'gm-section-title' }, `Доски (${writable.length}) · выбрано ${selCount}`),
        h('div', { class: 'gm-section-actions' },
          h('a', { class: 'gm-link', title: 'iframe-fetch выбранных досок (или всех)',
            onClick: state.boardChecking ? null : recheckBoardInstalled },
            state.boardChecking
              ? h('span', null, h('span', { class: 'gm-spinner', style: 'margin-right:4px;' }), 'Проверяю...')
              : 'Проверить версии'),
          h('a', { class: 'gm-link',
            onClick: () => { writable.forEach(b => state.boardSelected.add(b.id)); rerender(); } }, 'Все'),
          h('a', { class: 'gm-link gm-link-muted',
            onClick: () => { state.boardSelected.clear(); rerender(); } }, 'Снять'))),
      boardList,
      h('div', { class: 'gm-section-head' },
        h('span', { class: 'gm-section-title' }, 'Сниппеты'),
        h('div', { class: 'gm-section-actions' },
          h('a', { class: 'gm-link', onClick: loadBoardManifest }, 'Обновить манифест'))),
      catBar,
      snipBody);
  }

  function boardRowBadge(b) {
    if (state.boardChecking && !state.boardInstalled[b.id])
      return h('span', { class: 'gm-row-status gm-row-status-active' }, h('span', { class: 'gm-spinner' }));
    const rs = boardRowStatus(b.id);
    if (!rs) return null;
    if (rs.outdated > 0)
      return h('span', { class: 'gm-badge gm-badge-warning' },
        h('span', { class: 'gm-badge-dot dot-warning' }), 'Обновление ' + rs.installed + '/' + rs.total);
    if (rs.installed > 0)
      return h('span', { class: 'gm-badge gm-badge-success' },
        h('span', { class: 'gm-badge-dot dot-success' }), 'Установлено ' + rs.installed + '/' + rs.total);
    return h('span', { class: 'gm-badge gm-badge-warning' },
      h('span', { class: 'gm-badge-dot dot-warning' }), 'Установлено 0/' + rs.total);
  }

  function renderBoardCheckRow(b) {
    const isSel = state.boardSelected.has(b.id);
    return h('div', {
      class: 'gm-row' + (isSel ? ' gm-row-selected' : '') + (b.viewOnly ? ' gm-row-disabled' : ''),
      style: 'grid-template-columns:16px 22px 1fr auto auto;',
      onClick: (e) => {
        if (e.target.closest('.gm-extlink')) return;
        if (b.viewOnly || state.boardPushing) return;
        if (isSel) state.boardSelected.delete(b.id); else state.boardSelected.add(b.id);
        rerender();
      }
    },
      h('span', { class: 'gm-check' + (isSel ? ' gm-check-on' : '') + (b.viewOnly ? ' gm-check-disabled' : '') }),
      h('span', { class: 'gm-row-avatar', style: b.avatar ? { backgroundImage: `url("${b.avatar}")` } : {} }),
      h('span', { class: 'gm-row-name', title: b.name }, b.name),
      b.viewOnly
        ? h('span', { class: 'gm-badge gm-badge-viewonly gm-mono' }, 'view-only')
        : boardRowBadge(b),
      h('span', { class: 'gm-extlink', title: 'Открыть доску',
        html: ICONS.extlink,
        onClick: (e) => { e.stopPropagation(); window.open('https://gmentor.ru/' + b.id, '_blank'); } }));
  }

  function renderBoardSnippetRow(s) {
    const st = state.boardPushStates[s.id];
    let action;
    if (st && st.kind === 'pushing') {
      action = h('span', { class: 'gm-row-status gm-row-status-active' },
        h('span', { class: 'gm-spinner' }), ' Ставлю...');
    } else if (state.boardSelected.size === 0 || state.boardPushing) {
      action = h('button', { class: 'gm-btn gm-btn-disabled',
        html: ICONS.play + ' Установить' });
    } else {
      const a = boardSnippetAction(s);
      if (a.need > 0 || a.unknown > 0) {
        action = h('button', { class: 'gm-btn gm-btn-success',
          title: a.unknown > 0 ? 'Часть досок не проверена — установка перезапишет сниппет свежей версией' : '',
          onClick: () => installBoardSnippet(s), html: ICONS.play + ' Установить' });
      } else if (a.update > 0) {
        action = h('button', { class: 'gm-btn gm-btn-accent',
          onClick: () => installBoardSnippet(s),
          html: '<i class="fa fa-refresh"></i> Обновить' });
      } else {
        action = h('button', { class: 'gm-btn gm-btn-disabled',
          html: '<i class="fa fa-check"></i> Установлено' });
      }
    }
    let badge = null;
    if (st && st.kind === 'partial') {
      badge = h('span', { class: 'gm-badge gm-badge-warning' },
        h('span', { class: 'gm-badge-dot dot-warning' }), st.ok + ' ok · ' + st.err + ' ошиб.');
    } else if (st && st.kind === 'error') {
      badge = h('span', { class: 'gm-badge gm-badge-warning' },
        h('span', { class: 'gm-badge-dot dot-warning' }), st.msg || 'ошибка');
    } else if (state.boardSelected.size > 0) {
      const a = boardSnippetAction(s);
      if (a.update > 0) {
        badge = h('span', { class: 'gm-badge gm-badge-warning' },
          h('span', { class: 'gm-badge-dot dot-warning' }),
          'v' + (a.minVer || '?') + ' → v' + s.version);
      }
    }
    return h('div', { class: 'gm-row', style: 'grid-template-columns:1fr 124px;cursor:default;align-items:flex-start;' },
      h('div', { style: 'min-width:0;' },
        h('div', { class: 'gm-row-name', style: 'white-space:normal;' },
          s.name,
          h('span', { style: 'opacity:0.6;font-size:11px;font-family:Consolas,monospace;' }, ' v' + s.version)),
        renderCategoryBadge(s.category),
        renderSnippetDesc(s)),
      h('div', { class: 'gm-row-action', style: 'padding-top:2px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;' },
        action,
        badge),
      renderSnippetDescBody(s));
  }

  function renderBoardFooter() {
    if (state.boardBulk) {
      const p = state.boardBulk;
      return h('footer', { class: 'gm-footer' },
        h('div', { class: 'gm-footer-info' },
          'Установка: ', h('b', null, `${p.done} из ${p.total}`)),
        h('button', { class: 'gm-btn gm-btn-disabled gm-footer-primary' },
          h('span', null, h('span', { class: 'gm-spinner', style: 'margin-right:6px;' }), 'Ставлю...')));
    }
    const sel = state.boardSelected.size;
    const writableTotal = state.boards.filter(b => !b.viewOnly).length;
    const snippets = (state.boardManifest && state.boardManifest.snippets) || [];
    const canBulk = sel > 0 && snippets.length > 0 && !state.boardPushing;
    const res = state.boardBulkResult;
    return h('footer', { class: 'gm-footer' },
      res
        ? h('div', { class: 'gm-footer-info', style: res.err ? 'color:var(--gm-warning);' : 'color:var(--gm-success);' },
            res.err
              ? `Готово: ${res.ok} ок · ${res.err} с ошибками (подробности в консоли)`
              : `Готово: ${res.ok} ок`)
        : h('div', { class: 'gm-footer-info' },
            'Выбрано: ', h('b', null, `${sel} из ${writableTotal}`)),
      h('button', {
        class: 'gm-btn gm-footer-primary' + (canBulk ? ' gm-btn-success' : ' gm-btn-error-outline gm-btn-noclick'),
        onClick: canBulk ? openBoardBulkConfirm : null,
        html: canBulk
          ? ICONS.play + ` Установить все (${snippets.length})`
          : (snippets.length ? 'Выберите доски' : 'Загрузите манифест')
      }));
  }

  function plDoska(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'досок';
    if (b > 1 && b < 5) return 'доски';
    if (b === 1) return 'доску';
    return 'досок';
  }

  function buildBoardBulkPlan() {
    const ids = Array.from(state.boardSelected);
    const snippets = (state.boardManifest && state.boardManifest.snippets) || [];
    const rows = [];
    ids.forEach((bid) => {
      const board = state.boards.find(b => b.id === bid);
      const bname = board ? board.name : bid;
      const map = state.boardInstalled[bid];
      snippets.forEach((s) => {
        let kind = 'install';
        if (map) {
          const v = map[s.id];
          if (v != null) {
            kind = (v === 'unversioned' || cmpVer(v, s.version) < 0) ? 'update' : 'skip';
          }
        }
        rows.push({ boardId: bid, boardName: bname, snippet: s, kind: kind });
      });
    });
    return rows;
  }

  function openBoardBulkConfirm() {
    const plan = buildBoardBulkPlan();
    state.boardBulkResult = null;
    state.boardConfirm = { plan: plan };
    rerender();
  }

  function askConfirm(title, onYes) {
    state.confirmDialog = { title: title, onYes: onYes };
    rerender();
  }
  function renderConfirmDialog() {
    const d = state.confirmDialog;
    if (!d) return null;
    return h('div', { style: 'display:contents;' },
      h('div', { class: 'gm-scrim gm-confirm-scrim', onClick: () => { state.confirmDialog = null; rerender(); } }),
      h('div', { class: 'gm-settings gm-confirm-box',
        onClick: (e) => { e.stopPropagation(); } },
        h('div', { class: 'gm-settings-head' },
          h('span', { class: 'gm-settings-title' }, 'Подтверждение'),
          h('button', { class: 'gm-iconbtn', html: ICONS.close,
            onClick: () => { state.confirmDialog = null; rerender(); } })),
        h('div', { class: 'gm-settings-body' },
          h('div', { style: 'font-size:13px;line-height:1.5;' }, d.title)),
        h('div', { class: 'gm-settings-foot' },
          h('button', { class: 'gm-btn gm-btn-error-outline',
            onClick: () => { state.confirmDialog = null; rerender(); },
            html: '<i class="fa fa-times"></i> Нет' }),
          h('button', { class: 'gm-btn gm-btn-success',
            onClick: () => { const cb = d.onYes; state.confirmDialog = null; rerender(); if (cb) cb(); },
            html: '<i class="fa fa-check"></i> Да' }))));
  }

  function renderBoardConfirm() {
    const plan = state.boardConfirm.plan;
    const nBoards = state.boardSelected.size;
    const willInstall = plan.filter(r => r.kind === 'install').length;
    const willUpdate = plan.filter(r => r.kind === 'update').length;
    const willSkip = plan.filter(r => r.kind === 'skip').length;
    const checked = Array.from(state.boardSelected).every(bid => state.boardInstalled[bid] != null);

    const byBoard = {};
    plan.forEach((r) => { (byBoard[r.boardId] = byBoard[r.boardId] || { name: r.boardName, rows: [] }).rows.push(r); });

    const planNodes = Object.keys(byBoard).map((bid) => {
      const g = byBoard[bid];
      return h('div', { style: 'margin-bottom:8px;' },
        h('div', { style: 'font-weight:600;font-size:12px;margin-bottom:2px;' }, g.name),
        ...g.rows.map((r) => {
          const txt = r.kind === 'install'
            ? 'будет установлен: ' + r.snippet.name
            : r.kind === 'update'
              ? 'будет обновлён: ' + r.snippet.name + ' → v' + r.snippet.version
              : 'уже установлен: ' + r.snippet.name;
          const color = r.kind === 'install' ? 'var(--gm-success)'
            : r.kind === 'update' ? 'var(--gm-warning)' : 'var(--gm-text-muted)';
          return h('div', { style: 'font-size:11.5px;padding-left:10px;color:' + color + ';' }, '• ' + txt);
        }));
    });

    return h('div', { style: 'display:contents;' },
      h('div', { class: 'gm-scrim', onClick: () => { state.boardConfirm = null; rerender(); } }),
      h('div', { class: 'gm-settings' },
        h('div', { class: 'gm-settings-head' },
          h('span', { class: 'gm-settings-title' },
            `Установить все сниппеты на ${nBoards} ${plDoska(nBoards)}?`),
          h('button', { class: 'gm-iconbtn', html: ICONS.close,
            onClick: () => { state.boardConfirm = null; rerender(); } })),
        h('div', { class: 'gm-settings-body' },
          h('div', { style: 'font-size:12px;margin-bottom:4px;' },
            `Установить: ${willInstall}`,
            willUpdate ? ` · обновить: ${willUpdate}` : '',
            willSkip ? ` · пропустить: ${willSkip}` : ''),
          checked ? null : h('div', { class: 'gm-field-help', style: 'color:var(--gm-warning);margin-bottom:6px;' },
            'Доски не проверены («Проверить версии») — всё показано как установка.'),
          ...planNodes),
        h('div', { class: 'gm-settings-foot' },
          h('button', { class: 'gm-btn gm-btn-error-outline',
            onClick: () => { state.boardConfirm = null; rerender(); },
            html: '<i class="fa fa-times"></i> Нет' }),
          h('button', { class: 'gm-btn gm-btn-success',
            onClick: runBoardBulkInstall, html: ICONS.play + ' Да, установить' }))));
  }

  async function runBoardBulkInstall() {
    const plan = state.boardConfirm.plan.filter(r => r.kind !== 'skip');
    state.boardConfirm = null;
    if (!plan.length) { rerender(); return; }

    state.boardPushing = true;
    state.boardBulk = { done: 0, total: plan.length };
    state.boardBulkResult = null;
    rerender();

    let err = 0;
    try {
      const codeCache = {};
      for (const r of plan) {
        try {
          if (codeCache[r.snippet.id] == null) {
            codeCache[r.snippet.id] = await gmFetch(cfg('boardBaseUrl') + r.snippet.file);
          }
          await pushBoardSnippet(r.boardId, r.snippet, codeCache[r.snippet.id]);
          if (!state.boardInstalled[r.boardId]) state.boardInstalled[r.boardId] = {};
          state.boardInstalled[r.boardId][r.snippet.id] = r.snippet.version;
        } catch (e) { err++; console.error('[board bulk]', r.boardId, r.snippet.id, e); }
        state.boardBulk.done++;
        rerender();
      }
    } finally {
      state.boardBulkResult = { ok: plan.length - err, err: err };
      state.boardBulk = null;
      state.boardPushing = false;
      rerender();
    }
  }

  function renderHeader() {
    return h('header', { class: 'gm-header' },
      h('div', { class: 'gm-header-left' },
        h('span', { class: 'gm-logo', html: ICONS.logo }),
        h('div', { class: 'gm-title' },
          h('span', { class: 'gm-title-mono' }, 'GMentor Snippet Installer'))),
      h('div', { class: 'gm-header-right' },
        h('button', { class: 'gm-iconbtn', title: 'Настройки',
          html: ICONS.settings,
          onClick: () => { state.settingsOpen = true; rerender(); } }),
        h('button', { class: 'gm-iconbtn', title: 'Перечитать листы/доски + версии',
          html: ICONS.refresh,
          onClick: () => {
            if (state.activeTab === 'board') {
              state.boards = readBoardSheets();
              rerender();
              recheckBoardInstalled();
            } else {
              state.loggedOut = !detectLoggedIn();
              state.sheets = readCustomSheets();
              applyVersionsToSheets(cfg('sheetVersions'));
              rerender();
              recheckAllVersions();
            }
          } }),
        h('button', { class: 'gm-iconbtn', title: 'Закрыть',
          html: ICONS.close, onClick: closePanel })));
  }

  function renderListBody() {
    const { sheets, selected, searchQuery, recheckBusy } = state;
    const filtered = searchQuery
      ? sheets.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : sheets;
    const writableCount = sheets.filter(s => !s.viewOnly).length;

    return h('div', { style: 'display:contents;' },
      h('div', { class: 'gm-section-head' },
        h('span', { class: 'gm-section-title' },
          `Кастомные листы (${writableCount})`),
        h('div', { class: 'gm-section-actions' },
          h('a', { class: 'gm-link', title: 'Iframe-fetch версий со всех листов',
            onClick: recheckBusy ? null : recheckAllVersions },
            recheckBusy
              ? h('span', null, h('span', { class: 'gm-spinner', style: 'margin-right:4px;' }), 'Проверяю...')
              : 'Проверить версии'),
          h('a', { class: 'gm-link',
            onClick: () => { filtered.forEach(s => { if (!s.viewOnly) selected.add(s.id); }); rerender(); } },
            'Все'),
          h('a', { class: 'gm-link gm-link-muted',
            onClick: () => { selected.clear(); rerender(); } }, 'Снять'))),
      h('div', { class: 'gm-search' },
        h('span', { class: 'gm-search-icon', html: ICONS.search }),
        h('input', { placeholder: 'Поиск...', value: searchQuery,
          onInput: e => { state.searchQuery = e.target.value; rerender(); } })),
      h('div', { class: 'gm-list' }, ...filtered.map(renderRow)));
  }

  function renderRow(s) {
    const isSel = state.selected.has(s.id);
    const pushState = state.pushStates[s.id];
    return h('div', {
      class: 'gm-row' + (isSel ? ' gm-row-selected' : '') + (s.viewOnly ? ' gm-row-disabled' : ''),
      onClick: (e) => {
        if (e.target.closest('.gm-extlink')) return;
        if (s.viewOnly || state.pushing) return;
        if (isSel) state.selected.delete(s.id); else state.selected.add(s.id);
        rerender();
      }
    },
      h('span', { class: 'gm-check' + (isSel ? ' gm-check-on' : '') + (s.viewOnly ? ' gm-check-disabled' : '') }),
      h('span', { class: 'gm-row-avatar',
        style: s.avatar ? { backgroundImage: `url("${s.avatar}")` } : {} }),
      h('span', { class: 'gm-row-name', title: s.name }, s.name),
      h('div', { class: 'gm-row-trailing' },
        pushState ? renderPushBadge(pushState, s) : renderStatusBadge(s),
        h('span', { class: 'gm-extlink', title: 'Открыть лист в новой вкладке',
          html: ICONS.extlink,
          onClick: (e) => { e.stopPropagation(); window.open('https://gmentor.ru/' + s.id, '_blank'); } })),
      (state.expandedErrorId === s.id && state.pushErrors && state.pushErrors[s.id])
        ? h('div', { style: 'grid-column:1/-1;font-size:11px;color:var(--gm-error,#d9534f);padding:4px 2px 0;white-space:normal;word-break:break-word;',
            onClick: (e) => e.stopPropagation() },
            state.pushErrors[s.id])
        : null);
  }

  function renderStatusBadge(s) {
    if (s.viewOnly) return h('span', { class: 'gm-badge gm-badge-viewonly gm-mono' }, 'view-only');
    if (s.status === 'fresh') return h('span', { class: 'gm-badge gm-badge-success' },
      h('span', { class: 'gm-badge-dot dot-success' }), 'v' + (s.current || '?'));
    if (s.status === 'outdated') return h('span', { class: 'gm-badge gm-badge-warning' },
      h('span', { class: 'gm-badge-dot dot-warning' }), `v${s.current} → v${s.target}`);
    if (s.status === 'none') return h('span', { class: 'gm-badge gm-badge-none' }, 'нет');
    return h('span', { style: 'width:0;' });
  }

  function renderPushBadge(st, s) {
    if (st === 'queued') return h('span', { class: 'gm-row-status gm-row-status-muted' }, 'в очереди');
    if (st === 'updating') return h('span', { class: 'gm-row-status gm-row-status-active' },
      h('span', { class: 'gm-spinner' }), 'Обновляю...');
    if (st === 'done') return h('span', { class: 'gm-badge gm-badge-success' },
      h('span', { class: 'gm-badge-dot dot-success' }), 'v' + (state.bundle?.version || '?'));
    if (st === 'error') return h('span', {
      class: 'gm-row-status gm-row-status-err',
      style: 'cursor:pointer;',
      title: 'Нажмите, чтобы показать текст ошибки',
      onClick: (e) => {
        e.stopPropagation();
        state.expandedErrorId = state.expandedErrorId === s.id ? null : s.id;
        rerender();
      } }, '✕ Ошибка');
    return null;
  }

  function renderSource() {
    const b = state.bundle;
    let line1;
    if (state.pulling) {
      line1 = h('span', { style: 'color:var(--gm-main);' },
        h('span', { class: 'gm-spinner', style: 'margin-right:6px;' }), 'Загружаю...');
    } else if (state.pullError) {
      line1 = h('span', { style: 'color:var(--gm-error);font-size:10.5px;' }, '✕ ' + state.pullError);
    } else if (b) {
      line1 = `v${b.version || '?'} · ${(b.size / 1024 | 0)} KB`;
    } else {
      line1 = h('span', { style: 'color:var(--gm-text-muted);' }, 'не загружен');
    }
    let line2 = (cfg('sourceJsUrl').replace(/^https?:\/\//, '').split('/')[0]);
    if (b) line2 += ` · ${timeAgo(b.fetchedAt)}`;
    return h('section', { class: 'gm-source' },
      h('div', { class: 'gm-source-info' },
        h('div', { class: 'gm-source-line1' }, line1),
        h('div', { class: 'gm-source-line2' }, line2)),
      h('button', { class: 'gm-btn gm-btn-primary',
        onClick: onPull, disabled: state.pushing || state.pulling,
        html: ICONS.refresh + ' Pull' }));
  }

  function renderFooter() {
    const { pushing, pushProgress, selected, sheets } = state;
    if (pushing) {
      const p = pushProgress || { done: 0, total: 0, queued: 0, errors: 0 };
      return h('footer', { class: 'gm-footer' },
        h('div', { class: 'gm-footer-info' },
          'Прогресс: ', h('b', null, `${p.done} из ${p.total}`),
          p.queued ? ` · ${p.queued} в очереди` : '',
          p.errors ? h('span', { style: 'color:var(--gm-error);' }, ` · ${p.errors} ошибка`) : ''),
        h('button', { class: 'gm-btn gm-btn-error-outline gm-footer-primary',
          onClick: () => { state.cancelled = true; },
          html: ICONS.stop + ' Отменить' }));
    }
    const count = selected.size;
    const hasSel = count > 0 && state.bundle;
    const writableTotal = sheets.filter(s => !s.viewOnly).length;
    return h('footer', { class: 'gm-footer' },
      h('div', { class: 'gm-footer-info' },
        'Выбрано: ', h('b', null, `${count} из ${writableTotal}`)),
      h('button', {
        class: 'gm-btn gm-footer-primary' + (hasSel ? ' gm-btn-success' : ' gm-btn-error-outline gm-btn-noclick'),
        title: hasSel ? 'Закройте открытые вкладки выбранных листов: их автосохранение может перезаписать установку' : '',
        onClick: hasSel ? onPush : null,
        html: hasSel ? ICONS.play + ` Установить (${count})` :
          (state.bundle ? 'Выберите листы' : 'Сначала Pull bundle')
      }));
  }

  function renderEmpty() {
    return h('div', { class: 'gm-blank' },
      h('div', { class: 'gm-blank-icon', html: ICONS.cube }),
      h('div', { class: 'gm-blank-title' }, 'Кастомных листов не найдено'),
      h('div', { class: 'gm-blank-text' },
        'На вашем аккаунте нет листов с классом ',
        h('span', { class: 'gm-mono',
          style: 'background:var(--gm-bg-secondary);padding:1px 5px;border-radius:3px;font-size:10.5px;' },
          'my-custom'),
        '. Клонируйте чужой кастомный лист или дублируйте себе шаблон:'),
      h('div', { class: 'gm-blank-actions' },
        h('button', { class: 'gm-btn gm-btn-accent',
          onClick: () => window.location.href = 'https://gmentor.ru/v2cd481f4075694f3da3a7f9bd3baa1d2' },
          'ТЕСТОВЫЙ ШАБЛОН')));
  }

  function renderNotLoggedIn() {
    return h('div', { class: 'gm-blank' },
      h('div', { class: 'gm-blank-icon', html: ICONS.cube }),
      h('div', { class: 'gm-blank-title' }, 'Войдите в учётную запись'),
      h('div', { class: 'gm-blank-text' },
        'После авторизации список листов подтянется автоматически.'));
  }

  function renderEdgeFooter(kind) {
    return h('footer', { class: 'gm-footer' },
      h('div', { class: 'gm-footer-info', style: 'opacity:0.7;' },
        kind === 'empty' ? 'Листы загружены · 0 кастомных' : 'gmentor.ru · не авторизован'),
      h('button', { class: 'gm-btn gm-btn-ghost', style: 'height:32px;',
        onClick: () => {
          state.demoEdge = null;
          state.loggedOut = !detectLoggedIn();
          state.sheets = readCustomSheets();
          state.boards = readBoardSheets();
          applyVersionsToSheets(cfg('sheetVersions'));
          rerender();
        },
        html: ICONS.refresh + ' Обновить' }));
  }

  function renderSettings() {
    return h('div', { style: 'display:contents;' },
      h('div', { class: 'gm-scrim', onClick: () => { state.settingsOpen = false; rerender(); } }),
      h('div', { class: 'gm-settings' },
        h('div', { class: 'gm-settings-head' },
          h('span', { class: 'gm-settings-title' }, 'Настройки'),
          h('button', { class: 'gm-iconbtn', html: ICONS.close,
            onClick: () => { state.settingsOpen = false; rerender(); } })),
        h('div', { class: 'gm-settings-body' },
          h('div', { class: 'gm-field' },
            h('span', { class: 'gm-field-label' }, 'Кастом. листы')),
          settingsField('URL bundle (.js)', cfg('sourceJsUrl'), v => setCfg('sourceJsUrl', v),
            'По умолчанию — GitHub raw из репозитория проекта. Можно указать форк, свой CDN или локальный HTTP-сервер.'),
          settingsField('URL bundle (.less)', cfg('sourceLessUrl'), v => setCfg('sourceLessUrl', v)),
          h('label', { class: 'gm-checkrow' },
            h('span', { class: 'gm-check' + (cfg('autoPull') ? ' gm-check-on' : ''),
              onClick: (e) => { setCfg('autoPull', !cfg('autoPull')); rerender(); } }),
            h('div', { class: 'gm-checkrow-label' },
              'Pull автоматически при открытии',
              h('span', { class: 'gm-checkrow-sub' }, 'Берёт свежую версию при открытии panel, если кеш > 30 минут'))),
          h('div', { class: 'gm-field' },
            h('span', { class: 'gm-field-label' }, 'Кеш статусов'),
            h('span', { class: 'gm-field-help' },
              `Сохранено версий: ${Object.keys(cfg('sheetVersions') || {}).length}. ` +
              `Bundle в кеше: ${cfg('cachedBundle') ? `v${cfg('cachedBundle').version || '?'} (${timeAgo(cfg('cachedBundle').fetchedAt)})` : 'нет'}`),
            h('div', { style: 'display:flex;gap:8px;margin-top:4px;' },
              h('button', { class: 'gm-btn gm-btn-error-outline',
                onClick: () => askConfirm('Очистить кеш версий листов?', () => { setCfg('sheetVersions', {}); state.sheets.forEach(s => s.status = 'unknown'); rerender(); }),
                html: '<i class="fa fa-trash"></i> Очистить версии' }),
              h('button', { class: 'gm-btn gm-btn-error-outline',
                onClick: () => askConfirm('Очистить кеш bundle?', () => { setCfg('cachedBundle', null); state.bundle = null; rerender(); }),
                html: '<i class="fa fa-trash"></i> Очистить bundle' }))),
          h('div', { class: 'gm-field' },
            h('span', { class: 'gm-field-label', style: 'border-top:1px solid var(--gm-border);padding-top:10px;' },
              'Все листы')),
          settingsField('URL манифеста (Общие)', cfg('allManifestUrl'), v => setCfg('allManifestUrl', v)),
          settingsField('Базовый URL сниппетов (Общие)', cfg('allBaseUrl'), v => setCfg('allBaseUrl', v)),
          h('div', { class: 'gm-field' },
            h('div', null,
              h('button', { class: 'gm-btn gm-btn-error-outline',
                onClick: () => askConfirm('Удалить все общие сниппеты из браузера?', () => { setCfg('allInstalled', {}); rerender(); }),
                html: '<i class="fa fa-trash"></i> Удалить все общие сниппеты' }))),
          h('div', { class: 'gm-field' },
            h('span', { class: 'gm-field-label', style: 'border-top:1px solid var(--gm-border);padding-top:10px;' },
              'Доски')),
          settingsField('URL манифеста (Доски)', cfg('boardManifestUrl'), v => setCfg('boardManifestUrl', v)),
          settingsField('Базовый URL сниппетов (Доски)', cfg('boardBaseUrl'), v => setCfg('boardBaseUrl', v))),
        h('div', { class: 'gm-settings-foot' },
          h('button', { class: 'gm-btn gm-btn-error-outline',
            onClick: () => { state.settingsOpen = false; rerender(); },
            html: '<i class="fa fa-times"></i> Закрыть' }))));
  }

  function settingsField(label, value, onChange, help) {
    return h('div', { class: 'gm-field' },
      h('span', { class: 'gm-field-label' }, label),
      h('input', { class: 'gm-input gm-input-mono', value: value,
        onInput: e => onChange(e.target.value) }),
      help ? h('span', { class: 'gm-field-help' }, help) : null);
  }

  function timeAgo(ts) {
    if (!ts) return '?';
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return `${d | 0} сек назад`;
    if (d < 3600) return `${d / 60 | 0} мин назад`;
    if (d < 86400) return `${d / 3600 | 0} ч назад`;
    return `${d / 86400 | 0} дн назад`;
  }

  async function onPull() {
    if (state.pushing) return;
    state.pulling = true; state.pullError = null; rerender();
    try {
      state.bundle = await pullBundle();
      applyVersionsToSheets(cfg('sheetVersions'));
    } catch (e) {
      state.pullError = e.message;
      console.error('[gm-distrib] pull failed', e);
    } finally {
      state.pulling = false; rerender();
    }
  }

  async function onPush() {
    if (!state.bundle || state.selected.size === 0 || state.pushing) return;
    state.pushing = true; state.cancelled = false; state.pushStates = {}; state.pushErrors = {}; state.expandedErrorId = null;
    rerender();
    try {
      if (cfg('autoPull')) {
        try { state.bundle = await pullBundle(); }
        catch (e) { console.error('[gm-distrib] autoPull failed, пушим из кеша', e); }
      }
      const ids = Array.from(state.selected);
      state.pushProgress = { done: 0, total: ids.length, queued: ids.length, errors: 0 };
      ids.forEach(id => { state.pushStates[id] = 'queued'; });
      rerender();
      for (const id of ids) {
        if (state.cancelled) break;
        state.pushStates[id] = 'updating';
        state.pushProgress.queued--;
        rerender();
        try {
          await pushToSheet(id, state.bundle.js, state.bundle.less);
          state.pushStates[id] = 'done';
          state.pushProgress.done++;
          const versions = Object.assign({}, cfg('sheetVersions'));
          versions[id] = { version: state.bundle.version, checkedAt: Date.now() };
          setCfg('sheetVersions', versions);
        } catch (e) {
          state.pushStates[id] = 'error';
          state.pushErrors[id] = e && e.message ? e.message : String(e);
          state.pushProgress.errors++;
          console.error('[gm-distrib] push failed', id, e);
        }
        rerender();
      }
    } finally {
      state.pushing = false; rerender();
    }
  }

  function loadAllManifest() {
    if (state.allLoading) return;
    state.allLoading = true; state.allError = null; rerender();
    gmFetch(cfg('allManifestUrl')).then(function (t) {
      state.allManifest = JSON.parse(t);
      state.allLoading = false; rerender();
    }).catch(function (e) {
      state.allError = e.message; state.allLoading = false; rerender();
    });
  }
  async function installAllSnippet(snippet) {
    if (state.allBusy[snippet.id]) return;
    state.allBusy[snippet.id] = 'installing';
    delete state.allErrors[snippet.id];
    rerender();
    try {
      const code = await gmFetch(cfg('allBaseUrl') + snippet.file);
      const manifest = (state.allManifest && state.allManifest.snippets) || [];
      const order = manifest.findIndex((m) => m.id === snippet.id);
      const installed = Object.assign({}, getAllInstalled());
      installed[snippet.id] = { version: snippet.version, name: snippet.name, code: code, order: order >= 0 ? order : 999 };
      setCfg('allInstalled', installed);
    } catch (e) {
      state.allErrors[snippet.id] = 'не скачался: ' + (e && e.message ? e.message : e);
      console.error('[gc-all install]', snippet.id, e);
    } finally {
      delete state.allBusy[snippet.id]; rerender();
    }
  }
  function removeAllSnippet(id) {
    const installed = Object.assign({}, getAllInstalled());
    delete installed[id];
    setCfg('allInstalled', installed);
    delete state.allErrors[id];
    rerender();
  }

  function mountTrigger() {
    if (document.getElementById('gm-distrib-trigger')) return true;
    const libBtn = document.querySelector('button[title="Библиотека"].secondary.round, button[title="Библиотека"]');
    if (!libBtn) return false;
    const btn = h('button', {
      id: 'gm-distrib-trigger',
      class: libBtn.className,
      title: 'GMentor Snippet Installer',
      html: ICONS.logo,
      onClick: () => state.open ? closePanel() : openPanel()
    });
    libBtn.insertAdjacentElement('afterend', btn);
    triggerEl = btn;
    return true;
  }
  function init() {
    if (!mountTrigger()) {
      let tries = 0;
      const iv = setInterval(() => {
        if (mountTrigger() || ++tries > 40) clearInterval(iv);
      }, 500);
    }
    setInterval(() => {
      if (!document.getElementById('gm-distrib-trigger')) mountTrigger();
    }, 3000);
  }
  init();

  window.addEventListener('resize', () => state.open && positionPanel());
  window.addEventListener('scroll', () => state.open && positionPanel(), { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.open) {
      if (state.confirmDialog) { state.confirmDialog = null; rerender(); }
      else if (state.boardConfirm) { state.boardConfirm = null; rerender(); }
      else if (state.settingsOpen) { state.settingsOpen = false; rerender(); }
      else closePanel();
    }
  });
  document.addEventListener('mousedown', e => {
    if (!state.open) return;
    if (panelEl && panelEl.contains(e.target)) return;
    if (triggerEl && triggerEl.contains(e.target)) return;
    closePanel();
  });

  const debugHandle = {
    state, open: openPanel, close: closePanel, rerender,
    pull: onPull, push: onPush,
    readCustomSheets, pullBundle, pushToSheet, mountTrigger,
    cfg, setCfg, ICONS,
    recheckAllVersions, readSheetVersion,
    demoEmpty: () => { state.demoEdge = 'empty'; rerender(); },
    demoLoggedOut: () => { state.demoEdge = 'logged-out'; rerender(); },
    demoOff: () => { state.demoEdge = null; rerender(); },
  };
  if (typeof unsafeWindow !== 'undefined') {
    unsafeWindow.__gmDistrib = debugHandle;
  } else {
    window.__gmDistrib = debugHandle;
  }
})();
