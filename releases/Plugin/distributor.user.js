// ==UserScript==
// @name         GMentor Snippet Installer
// @namespace    https://github.com/Syntiset/GMentor-Snippet-Installer
// @version      1.0.0
// @description  Установка bundle на выбранные кастомные листы gmentor.ru одним кликом
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

  // CONFIG (в GM_setValue, дефолты ниже)
  const DEFAULTS = {
    sourceJsUrl:   'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Bundle/gmentor-bundle.js',
    sourceLessUrl: 'https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Bundle/gmentor-bundle.less',
    autoPull: true,
    cachedBundle: null,           // { js, less, version, size, fetchedAt }
    sheetVersions: {},            // { sheetId: { version, checkedAt } }
  };
  const cfg = (k) => GM_getValue(k, DEFAULTS[k]);
  const setCfg = (k, v) => GM_setValue(k, v);

  if (!/^\/(index\.phtml)?$/.test(location.pathname)) return;

  // STYLES
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
.gm-distrib .gm-iconbtn:hover { background: var(--gm-accent-tint); color: var(--gm-main); }

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
.gm-distrib .gm-btn-primary { background: var(--gm-main); color: #fff; }
.gm-distrib .gm-btn-primary:hover { filter: brightness(0.92); }

.gm-distrib .gm-btn-accent { background: #dd8e2d; color: #fff; }
.gm-distrib .gm-btn-accent:hover { background: #c78129; }

.gm-distrib .gm-btn-secondary {
  background: var(--gm-bg);
  border: 1px solid var(--gm-border);
  color: var(--gm-text-muted);
  font-weight: 400;
}
.gm-distrib .gm-btn-secondary:hover {
  background: var(--gm-row-hover);
  color: var(--gm-text);
  border-color: var(--gm-text-muted);
}
.gm-distrib .gm-btn-error-outline {
  background: var(--gm-bg); border-color: var(--gm-error);
  color: var(--gm-error);
}
.gm-distrib .gm-btn-error-outline:hover { background: var(--gm-error-tint); }
.gm-distrib .gm-btn-ghost {
  background: transparent; color: var(--gm-text-muted);
  border-color: transparent;
}
.gm-distrib .gm-btn-ghost:hover { background: var(--gm-main); color: #fff; }
.gm-distrib .gm-btn-disabled {
  background: var(--gm-bg-secondary) !important;
  color: var(--gm-text-muted) !important;
  border-color: transparent !important;
  cursor: not-allowed !important;
}

.gm-distrib .gm-footer {
  flex: 0 0 auto; height: 48px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px;
  background: var(--gm-bg-secondary);
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

  // ICONS
  function svg(viewBox, body, opts = {}) {
    const size = opts.size || 16;
    const stroke = opts.stroke || 2;
    return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }
  const ICONS = {
    box: svg('0 0 24 24',
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      { stroke: 2 }),
    settings: svg('0 0 24 24',
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      { size: 14 }),
    refresh: svg('0 0 24 24',
      '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 10 15 10"/>',
      { size: 14 }),
    extlink: svg('0 0 24 24',
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
      { size: 12 }),
    search: svg('0 0 24 24',
      '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      { size: 13 }),
    close: svg('0 0 24 24',
      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      { size: 14 }),
    play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    stop: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
  };

  // DOM HELPER
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

  // GMENTOR PARSER
  function extractAvatarUrl(el) {
    const av = el.querySelector('.my-char-avatar');
    if (!av) return null;
    // Немного объяснения для забравшихся сюда: GMentor применяет lazy-bg класс lazy-bg + data-src="show-avatar.php?a=...".
    // Реальный URL подставляется в background-image только при scroll-into-view.
    // Без скролла getComputedStyle().backgroundImage === 'none'. Тут берём data-src напрямую.
    const dataSrc = av.getAttribute('data-src');
    if (dataSrc) return dataSrc.startsWith('http') ? dataSrc : '/' + dataSrc.replace(/^\//, '');
    const bg = getComputedStyle(av).backgroundImage;
    const m = bg && bg.match(/url\(['"]?([^'")]+)['"]?\)/);
    return m ? m[1] : null;
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

  // BUNDLE FETCH + CACHE
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
    const m = js.match(/\/\/\s*Bundle version:\s*(\S+)/);
    const bundle = { js, less, version: m ? m[1] : null, size: js.length + less.length, fetchedAt: Date.now() };
    setCfg('cachedBundle', bundle);
    return bundle;
  }

  // VERSION-DETECT через iframe-fetch листа (lazy, по требованию)
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
  if (!window.gm('gc-script').length) return null;
  const txt = b64ToText(String(window.gm('gc-script').text() || ''));
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
    const versions = Object.assign({}, cfg('sheetVersions'));
    rerender();
    // Параллельность 2 — чтобы не перегружать сервер
    const queue = state.sheets.filter(s => !s.viewOnly).map(s => s.id);
    const inflight = new Set();
    async function worker(id) {
      const v = await readSheetVersion(id);
      versions[id] = { version: v, checkedAt: Date.now() };
      setCfg('sheetVersions', versions);
      applyVersionsToSheets(versions);
      rerender();
    }
    while (queue.length || inflight.size) {
      while (inflight.size < 2 && queue.length) {
        const id = queue.shift();
        const p = worker(id).finally(() => inflight.delete(p));
        inflight.add(p);
      }
      await Promise.race(Array.from(inflight));
    }
    state.recheckBusy = false;
    rerender();
  }

  function applyVersionsToSheets(versionsMap) {
    const targetV = state.bundle && state.bundle.version;
    for (const s of state.sheets) {
      const stored = versionsMap[s.id];
      if (!stored || stored.version === null) {
        s.status = 'unknown';
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

  // PUSH ENGINE (iframe injection)
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
  const jsMarker = /^\\{\\s*\\/\\/\\s*===\\s*GMENTOR-BUNDLE-START\\s*===[\\s\\S]*?\\n\\}\\s*\\/\\/\\s*===\\s*GMENTOR-BUNDLE-END\\s*===$/m;
  const lessMarker = /^\\/\\*\\s*===\\s*GMENTOR-LESS-BUNDLE-START\\s*===\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*===\\s*GMENTOR-LESS-BUNDLE-END\\s*===\\s*\\*\\/$/m;
  const cleanScript = curScript.replace(jsMarker, '').trim();
  const cleanLess = curLess.replace(lessMarker, '').trim();
  const finalScript = (cleanScript ? cleanScript + '\\n\\n' : '') + newJs;
  const finalLess = (cleanLess ? cleanLess + '\\n\\n' : '') + newLess;
  const expectedMax = Math.max(curScript.length, newJs.length) + newJs.length * 0.1;
  if (finalScript.length > expectedMax) {
    throw new Error('JS push aborted: final size ' + finalScript.length + ' > expected max ' + expectedMax + ' (curScript=' + curScript.length + ', newJs=' + newJs.length + ')');
  }
  $gs.text(textToB64(finalScript));
  if ($gl.length) $gl.text(textToB64(finalLess));
  if (typeof window.saveButtonEnable === 'function') window.saveButtonEnable();
  if (typeof window.saveCurrentChar === 'function') window.saveCurrentChar(true);
  await new Promise(r => setTimeout(r, 8000));
  if (typeof window.saveCurrentChar === 'function') window.saveCurrentChar(true);
  await new Promise(r => setTimeout(r, 4000));
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

  // STATE
  let state = {
    open: false,
    sheets: [],
    selected: new Set(),
    bundle: cfg('cachedBundle'),
    pulling: false, pullError: null,
    pushing: false, cancelled: false,
    pushStates: {}, pushProgress: null,
    searchQuery: '',
    settingsOpen: false,
    recheckBusy: false,
    demoEdge: null,                  // 'empty' | 'logged-out' | null
  };
  let panelEl = null;
  let triggerEl = null;

  // POSITIONING
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

  // RENDER
  function openPanel() {
    state.open = true;
    state.sheets = readCustomSheets();
    applyVersionsToSheets(cfg('sheetVersions'));
    if (triggerEl) triggerEl.classList.add('is-open');
    if (panelEl) panelEl.remove();
    panelEl = renderPanel();
    document.body.appendChild(panelEl);
    positionPanel();
    if (cfg('autoPull') && (!state.bundle || (Date.now() - state.bundle.fetchedAt > 30 * 60 * 1000))) {
      onPull();   // тихо обновляет bundle если кеш > 30 мин
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

  function renderPanel() {
    if (state.demoEdge === 'empty' || state.sheets.length === 0)
      return renderShell(renderEmpty(), renderEdgeFooter('empty'));
    if (state.demoEdge === 'logged-out')
      return renderShell(renderNotLoggedIn(), renderEdgeFooter('logged-out'));

    return renderShell(renderListBody(), renderFooter(),
      renderSource(),
      state.settingsOpen ? renderSettings() : null);
  }

  function renderShell(body, footer, source, overlay) {
    return h('div', { class: 'gm-distrib' },
      renderHeader(),
      body,
      source || null,
      footer,
      overlay || null);
  }

  function renderHeader() {
    return h('header', { class: 'gm-header' },
      h('div', { class: 'gm-header-left' },
        h('span', { class: 'gm-logo', html: ICONS.box }),
        h('div', { class: 'gm-title' },
          h('span', { class: 'gm-title-mono' }, 'GMentor Snippet Installer'))),
      h('div', { class: 'gm-header-right' },
        h('button', { class: 'gm-iconbtn', title: 'Настройки',
          html: ICONS.settings,
          onClick: () => { state.settingsOpen = true; rerender(); } }),
        h('button', { class: 'gm-iconbtn', title: 'Перечитать листы + версии',
          html: ICONS.refresh,
          onClick: () => {
            state.sheets = readCustomSheets();
            applyVersionsToSheets(cfg('sheetVersions'));
            rerender();
            recheckAllVersions();
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
              ? h('span', null, h('span', { class: 'gm-spinner', style: 'margin-right:4px;' }), 'Проверяю…')
              : 'Проверить версии'),
          h('a', { class: 'gm-link',
            onClick: () => { filtered.forEach(s => { if (!s.viewOnly) selected.add(s.id); }); rerender(); } },
            'Все'),
          h('a', { class: 'gm-link gm-link-muted',
            onClick: () => { selected.clear(); rerender(); } }, 'Снять'))),
      h('div', { class: 'gm-search' },
        h('span', { class: 'gm-search-icon', html: ICONS.search }),
        h('input', { placeholder: 'Поиск…', value: searchQuery,
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
          onClick: (e) => { e.stopPropagation(); window.open('https://gmentor.ru/' + s.id, '_blank'); } })));
  }

  function renderStatusBadge(s) {
    if (s.viewOnly) return h('span', { class: 'gm-badge gm-badge-viewonly gm-mono' }, 'view-only');
    if (s.status === 'fresh') return h('span', { class: 'gm-badge gm-badge-success' },
      h('span', { class: 'gm-badge-dot dot-success' }), 'v' + (s.current || '?'));
    if (s.status === 'outdated') return h('span', { class: 'gm-badge gm-badge-warning' },
      h('span', { class: 'gm-badge-dot dot-warning' }), `v${s.current} → v${s.target}`);
    if (s.status === 'none') return h('span', { class: 'gm-badge gm-badge-none' }, 'нет');
    return h('span', { style: 'width:0;' });   // unknown — пусто
  }

  function renderPushBadge(st, s) {
    if (st === 'queued') return h('span', { class: 'gm-row-status gm-row-status-muted' }, 'в очереди');
    if (st === 'updating') return h('span', { class: 'gm-row-status gm-row-status-active' },
      h('span', { class: 'gm-spinner' }), 'обновляю…');
    if (st === 'done') return h('span', { class: 'gm-badge gm-badge-success' },
      h('span', { class: 'gm-badge-dot dot-success' }), 'v' + (state.bundle?.version || '?'));
    if (st === 'error') return h('span', { class: 'gm-row-status gm-row-status-err',
      title: 'Push failed' }, '✕ Ошибка');
    return null;
  }

  function renderSource() {
    const b = state.bundle;
    let line1;
    if (state.pulling) {
      line1 = h('span', { style: 'color:var(--gm-main);' },
        h('span', { class: 'gm-spinner', style: 'margin-right:6px;' }), 'Загружаю…');
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
        class: 'gm-btn gm-btn-primary gm-footer-primary' + (hasSel ? '' : ' gm-btn-disabled'),
        onClick: hasSel ? onPush : null,
        html: hasSel ? ICONS.play + ` Установить (${count})` :
          (state.bundle ? 'Выберите листы' : 'Сначала Pull bundle')
      }));
  }

  function renderEmpty() {
    return h('div', { class: 'gm-blank' },
      h('div', { class: 'gm-blank-icon', html: ICONS.box }),
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
      h('div', { class: 'gm-blank-icon', html: ICONS.box }),
      h('div', { class: 'gm-blank-title' }, 'Войдите в учётную запись'),
      h('div', { class: 'gm-blank-text' },
        'После авторизации список листов подтянется автоматически.'));
  }

  function renderEdgeFooter(kind) {
    return h('footer', { class: 'gm-footer' },
      h('div', { class: 'gm-footer-info', style: 'opacity:0.7;' },
        kind === 'empty' ? 'Листы загружены · 0 кастомных' : 'gmentor.ru · не авторизован'),
      h('button', { class: 'gm-btn gm-btn-ghost', style: 'height:32px;',
        onClick: () => { state.demoEdge = null; rerender(); },
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
              h('button', { class: 'gm-btn gm-btn-secondary',
                onClick: () => { setCfg('sheetVersions', {}); state.sheets.forEach(s => s.status = 'unknown'); rerender(); } },
                'Очистить версии'),
              h('button', { class: 'gm-btn gm-btn-secondary',
                onClick: () => { setCfg('cachedBundle', null); state.bundle = null; rerender(); } },
                'Очистить bundle')))),
        h('div', { class: 'gm-settings-foot' },
          h('button', { class: 'gm-btn gm-btn-ghost',
            onClick: () => { state.settingsOpen = false; rerender(); } }, 'Закрыть'))));
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

  // ACTIONS
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
    if (cfg('autoPull')) { try { await onPull(); } catch {} }
    state.pushing = true; state.cancelled = false; state.pushStates = {};
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
        // сохранение версии в кеш — после перезагрузки она будет видна
        const versions = Object.assign({}, cfg('sheetVersions'));
        versions[id] = { version: state.bundle.version, checkedAt: Date.now() };
        setCfg('sheetVersions', versions);
      } catch (e) {
        state.pushStates[id] = 'error';
        state.pushProgress.errors++;
        console.error('[gm-distrib] push failed', id, e);
      }
      rerender();
    }
    state.pushing = false; rerender();
  }

  // MOUNT trigger button
  function mountTrigger() {
    if (document.getElementById('gm-distrib-trigger')) return true;
    const libBtn = document.querySelector('button[title="Библиотека"].secondary.round, button[title="Библиотека"]');
    if (!libBtn) return false;
    const btn = h('button', {
      id: 'gm-distrib-trigger',
      class: libBtn.className,
      title: 'GMentor Snippet Installer',
      html: ICONS.box,
      onClick: () => state.open ? closePanel() : openPanel()
    });
    libBtn.insertAdjacentElement('afterend', btn);
    triggerEl = btn;
    return true;
  }
  function init() {
    if (mountTrigger()) return;
    let tries = 0;
    const iv = setInterval(() => {
      if (mountTrigger() || ++tries > 40) clearInterval(iv);
    }, 500);
  }
  init();

  window.addEventListener('resize', () => state.open && positionPanel());
  window.addEventListener('scroll', () => state.open && positionPanel(), { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.open) {
      if (state.settingsOpen) { state.settingsOpen = false; rerender(); }
      else closePanel();
    }
  });
  document.addEventListener('mousedown', e => {
    if (!state.open) return;
    if (panelEl && panelEl.contains(e.target)) return;
    if (triggerEl && triggerEl.contains(e.target)) return;
    closePanel();
  });

  // Debug handle — экспортируем в `unsafeWindow` (= реальный page-context),
  // чтобы был доступен из DevTools консоли. Без unsafeWindow Tampermonkey
  // изолирует window в content-script scope, и консоль его не видит.
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
