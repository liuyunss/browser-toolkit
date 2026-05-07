// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.2.0
// @description  在所有网站的密码输入框旁添加显示/隐藏、复制按钮，支持加密显示
// @author       liuyunss
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/assets/icon-128.png
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ─── 默认配置 ───
  const DEFAULTS = {
    enabled: true,
    encrypt: false,
    letterShift: 7,
    digitShift: 3,
  };

  function getConfig() {
    return {
      enabled: GM_getValue('pw_enabled', DEFAULTS.enabled),
      encrypt: GM_getValue('pw_encrypt', DEFAULTS.encrypt),
      letterShift: GM_getValue('pw_letterShift', DEFAULTS.letterShift),
      digitShift: GM_getValue('pw_digitShift', DEFAULTS.digitShift),
    };
  }

  function saveConfig(cfg) {
    GM_setValue('pw_enabled', cfg.enabled);
    GM_setValue('pw_encrypt', cfg.encrypt);
    GM_setValue('pw_letterShift', cfg.letterShift);
    GM_setValue('pw_digitShift', cfg.digitShift);
  }

  // ─── 加密 ───
  function shiftChar(ch, ls, ds) {
    if (ch >= 'a' && ch <= 'z') return String.fromCharCode(((ch.charCodeAt(0) - 97 + ls) % 26) + 97);
    if (ch >= 'A' && ch <= 'Z') return String.fromCharCode(((ch.charCodeAt(0) - 65 + ls) % 26) + 65);
    if (ch >= '0' && ch <= '9') return String.fromCharCode(((ch.charCodeAt(0) - 48 + ds) % 10) + 48);
    return ch;
  }

  function encryptText(text, cfg) {
    return text.split('').map(ch => shiftChar(ch, cfg.letterShift, cfg.digitShift)).join('');
  }

  // ─── 样式 ───
  const STYLES = `
    .pw-tk { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; vertical-align: middle; }
    .pw-tk-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border: none; border-radius: 4px;
      background: transparent; cursor: pointer; padding: 0; transition: background 0.15s; flex-shrink: 0;
    }
    .pw-tk-btn:hover { background: rgba(0,0,0,0.08); }
    .pw-tk-btn svg { width: 18px; height: 18px; fill: none; stroke: #666; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .pw-tk-btn:hover svg { stroke: #333; }
    .pw-tk-btn.on svg { stroke: #1a73e8; }
    .pw-tk-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #333; color: #fff; padding: 8px 20px; border-radius: 6px;
      font-size: 13px; z-index: 999999; opacity: 0; transition: opacity 0.2s; pointer-events: none;
    }
    .pw-tk-toast.show { opacity: 1; }
  `;

  const ICO = {
    eye:    `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    eyeEnc: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="1.5"/></svg>`,
    copy:   `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  };

  // ─── 工具函数 ───
  function injectStyles() {
    if (document.getElementById('pw-tk-css')) return;
    const s = document.createElement('style');
    s.id = 'pw-tk-css';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  let toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pw-tk-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  // ─── 增强密码框 ───
  function enhance(input) {
    if (input.dataset.pwTk) return;
    input.dataset.pwTk = '1';

    const wrapper = input.closest('div, span, td, li, label, form, p') || input.parentNode;
    if (!wrapper || wrapper.querySelector('.pw-tk')) return;

    const box = document.createElement('span');
    box.className = 'pw-tk';
    box._input = input;
    box._real = input.value;

    let visible = false;

    // 显示/隐藏
    const tog = document.createElement('button');
    tog.type = 'button';
    tog.className = 'pw-tk-btn';
    tog.title = '显示/隐藏密码';
    tog.innerHTML = ICO.eye;
    tog.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cfg = getConfig();
      visible = !visible;
      if (visible) {
        box._real = input.value;
        if (cfg.encrypt) {
          input.value = encryptText(input.value, cfg);
          tog.innerHTML = ICO.eyeEnc;
          tog.classList.add('on');
        } else {
          tog.innerHTML = ICO.eyeOff;
        }
        input.type = 'text';
      } else {
        if (cfg.encrypt && tog.classList.contains('on')) {
          input.value = box._real;
        }
        input.type = 'password';
        tog.innerHTML = ICO.eye;
        tog.classList.remove('on');
      }
    });

    // 复制（始终复制真实密码）
    const cp = document.createElement('button');
    cp.type = 'button';
    cp.className = 'pw-tk-btn';
    cp.title = '复制密码';
    cp.innerHTML = ICO.copy;
    cp.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const val = box._real || input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(val, 'text');
      } else {
        navigator.clipboard.writeText(val).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = val; ta.style.cssText = 'position:fixed;left:-9999px';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy');
          document.body.removeChild(ta);
        });
      }
      toast('✅ 密码已复制');
    });

    box.appendChild(tog);
    box.appendChild(cp);
    if (input.nextSibling) input.parentNode.insertBefore(box, input.nextSibling);
    else input.parentNode.appendChild(box);
  }

  // ─── 扫描 ───
  function scan() {
    if (!getConfig().enabled) return;
    document.querySelectorAll(
      'input[type="password"], input[name*="pass"], input[name*="pwd"], input[autocomplete="current-password"], input[autocomplete="new-password"]'
    ).forEach(enhance);
  }

  let scanTimer = null;
  function startObserver() {
    new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 300);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── 油猴菜单命令 ───
  function registerMenu() {
    // 开关
    GM_registerMenuCommand(() => {
      const cfg = getConfig();
      cfg.enabled = !cfg.enabled;
      saveConfig(cfg);
      toast(cfg.enabled ? '✅ 脚本已开启' : '⛔ 脚本已关闭');
      if (cfg.enabled) scan();
    }, () => {
      return getConfig().enabled ? '🟢 密码工具: 已开启 (点击关闭)' : '🔴 密码工具: 已关闭 (点击开启)';
    });

    // 加密开关
    GM_registerMenuCommand(() => {
      const cfg = getConfig();
      cfg.encrypt = !cfg.encrypt;
      saveConfig(cfg);
      toast(cfg.encrypt ? '🔒 加密显示已开启' : '🔓 加密显示已关闭');
    }, () => {
      return getConfig().encrypt ? '🔒 加密显示: 已开启 (点击关闭)' : '🔓 加密显示: 已关闭 (点击开启)';
    });

    // 设置偏移量
    GM_registerMenuCommand(() => {
      const cfg = getConfig();
      const input = prompt(
        `当前偏移: 字母=${cfg.letterShift}, 数字=${cfg.digitShift}\n\n输入格式: 字母偏移,数字偏移\n例如: 7,3`,
        `${cfg.letterShift},${cfg.digitShift}`
      );
      if (!input) return;
      const parts = input.split(',').map(s => parseInt(s.trim()));
      if (parts.length !== 2 || parts.some(isNaN)) { toast('⚠️ 格式错误'); return; }
      const ls = Math.max(0, Math.min(25, parts[0]));
      const ds = Math.max(0, Math.min(9, parts[1]));
      cfg.letterShift = ls;
      cfg.digitShift = ds;
      saveConfig(cfg);
      toast(`✅ 偏移已设置: 字母=${ls}, 数字=${ds}`);
    }, () => '⚙️ 设置偏移量');
  }

  // ─── 启动 ───
  injectStyles();
  registerMenu();
  if (getConfig().enabled) scan();
  startObserver();
})();
