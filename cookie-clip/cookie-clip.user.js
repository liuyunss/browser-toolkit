// ==UserScript==
// @name         🍪 Cookie 一键复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      3.0.0
// @description  从 Tampermonkey 菜单一键复制当前网站所有 Cookie
// @author       liuyunss
// @match        *://*/*
// @noframes
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // 提示框样式（与 show-password 一致）
  const CSS = `
    #ck-clip-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #333; color: #fff; padding: 8px 20px; border-radius: 6px;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 999999; opacity: 0; transition: opacity .2s; pointer-events: none;
      white-space: nowrap;
    }
    #ck-clip-toast.show { opacity: 1; }
  `;

  let _t;
  function toast(msg) {
    if (!_t) {
      const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      _t = document.createElement('div'); _t.id = 'ck-clip-toast'; document.body.appendChild(_t);
    }
    _t.textContent = msg; _t.classList.add('show');
    clearTimeout(_t._x); _t._x = setTimeout(() => _t.classList.remove('show'), 1500);
  }

  GM_registerMenuCommand('🍪 复制 Cookie', () => {
    const cookie = document.cookie;
    if (!cookie) { toast('⚠️ 当前网站没有 Cookie'); return; }
    if (typeof GM_setClipboard === 'function') GM_setClipboard(cookie, 'text');
    else navigator.clipboard.writeText(cookie).catch(() => {});
    toast(`✅ 已复制 ${cookie.split(';').length} 个 Cookie`);
  });
})();
