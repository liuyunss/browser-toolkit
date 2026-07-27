// ==UserScript==
// @name         🍪 Cookie 一键复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      2.1.0
// @description  复制当前网站的完整 Cookie（含 HttpOnly），通过 GM_cookie 获取，document.cookie 兜底
// @author       liuyunss
// @match        *://*/*
// @noframes
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_cookie
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js
// @license      MIT
// ==/UserScript==

/**
 * v2.1.0:
 * - 改用 GM_cookie.list 获取完整 Cookie（含 HttpOnly），修复“只能复制到部分 Cookie”的问题
 *   原因：浏览器自动附加的 Cookie 头不经过 setRequestHeader，XHR/fetch 拦截实际拿不到，最终退回 document.cookie，
 *   而 document.cookie 读不到 HttpOnly Cookie，导致大量 Cookie 丢失。
 * - 保留 XHR/fetch 拦截与 document.cookie 作为兜底（GM_cookie 不可用时使用）
 *
 * v2.0.0:
 * - 从 document.cookie 改为拦截 XHR 请求，捕获请求头中的完整 Cookie（含 HttpOnly）
 * - 只取匹配当前域名的请求，一个就够
 * - document.cookie 作为兜底
 */
(function () {
  'use strict';

  /* ── Toast ── */
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

  /* ── XHR 拦截：捕获匹配当前域名的 Cookie header ── */
  let _capturedCookie = '';
  const _origin = location.origin;

  // 追踪每个 XHR 设置的 header
  const _xhrHeaders = new WeakMap();

  const _origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (!this._ckClipHeaders) this._ckClipHeaders = {};
    this._ckClipHeaders[name.toLowerCase()] = value;
    return _origSetHeader.call(this, name, value);
  };

  const _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._ckClipUrl = url;
    this._ckClipMethod = method;
    return _origOpen.apply(this, arguments);
  };

  const _origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    // 只取第一个匹配的，不再覆盖
    if (!_capturedCookie && this._ckClipHeaders && this._ckClipHeaders['cookie']) {
      try {
        const reqUrl = this._ckClipUrl;
        // 匹配当前域名（相对路径 or 同源绝对路径）
        const isSameOrigin = !reqUrl.startsWith('http') || reqUrl.startsWith(_origin);
        if (isSameOrigin) {
          _capturedCookie = this._ckClipHeaders['cookie'];
        }
      } catch (_) {}
    }
    return _origSend.apply(this, arguments);
  };

  /* ── 复制到剪贴板 ── */
  function copyToClipboard(text) {
    if (typeof GM_setClipboard === 'function') GM_setClipboard(text, 'text');
    else navigator.clipboard.writeText(text).catch(() => {});
  }

  /* ── 兜底：用拦截到的 Cookie 或 document.cookie ── */
  function fallbackCopy() {
    const cookie = _capturedCookie || document.cookie;
    if (!cookie) { toast('⚠️ 当前网站没有 Cookie'); return; }
    copyToClipboard(cookie);
    const count = cookie.split(';').filter(s => s.trim()).length;
    const source = _capturedCookie ? '请求头' : 'document.cookie（可能不含 HttpOnly）';
    toast(`✅ 已复制 ${count} 个 Cookie（来源：${source}）`);
  }

  /* ── 复制命令 ── */
  GM_registerMenuCommand('🍪 复制 Cookie', () => {
    // 优先用 GM_cookie 获取完整 Cookie（含 HttpOnly）
    if (typeof GM_cookie !== 'undefined' && GM_cookie && typeof GM_cookie.list === 'function') {
      try {
        GM_cookie.list({ domain: location.hostname }, (cookies, err) => {
          if (!err && cookies && cookies.length) {
            const seen = new Set();
            const parts = [];
            for (const c of cookies) {
              if (!c || c.name == null || seen.has(c.name)) continue;
              seen.add(c.name);
              parts.push(c.name + '=' + (c.value || ''));
            }
            if (parts.length) {
              const cookieStr = parts.join('; ');
              copyToClipboard(cookieStr);
              toast(`✅ 已复制 ${parts.length} 个 Cookie（来源：GM_cookie，含 HttpOnly）`);
              return;
            }
          }
          fallbackCopy();
        });
        return;
      } catch (_) {
        // GM_cookie 不可用，走兜底
      }
    }
    fallbackCopy();
  });

  /* ── 拦截 fetch（补充方案） ── */
  const _origFetch = window.fetch;
  window.fetch = function () {
    if (!_capturedCookie) {
      try {
        const input = arguments[0];
        const opts = arguments[1] || {};
        const url = typeof input === 'string' ? input : input.url;
        const isSameOrigin = !url.startsWith('http') || url.startsWith(_origin);
        if (isSameOrigin && opts.headers) {
          let cookie = '';
          if (opts.headers instanceof Headers) {
            cookie = opts.headers.get('Cookie') || opts.headers.get('cookie') || '';
          } else if (typeof opts.headers === 'object') {
            for (const [k, v] of Object.entries(opts.headers)) {
              if (k.toLowerCase() === 'cookie') { cookie = v; break; }
            }
          }
          if (cookie) _capturedCookie = cookie;
        }
      } catch (_) {}
    }
    return _origFetch.apply(this, arguments);
  };
})();
