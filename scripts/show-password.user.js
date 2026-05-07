// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.0.0
// @description  在所有网站的密码输入框旁添加显示/隐藏按钮和复制按钮
// @author       liuyunss
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ─── 配置 ───
  const CONFIG = {
    TOAST_DURATION: 1500,   // 复制成功提示时长 (ms)
    DEBOUNCE_MS: 300,       // DOM 监听防抖间隔 (ms)
    ICON_SIZE: 18,          // 图标大小 (px)
    BUTTON_GAP: 4,          // 按钮间距 (px)
  };

  // ─── 样式 ───
  const STYLES = `
    .pw-toolkit-container {
      display: inline-flex;
      align-items: center;
      gap: ${CONFIG.BUTTON_GAP}px;
      margin-left: 6px;
      vertical-align: middle;
    }
    .pw-toolkit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${CONFIG.ICON_SIZE + 8}px;
      height: ${CONFIG.ICON_SIZE + 8}px;
      border: none;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      padding: 0;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .pw-toolkit-btn:hover {
      background: rgba(0,0,0,0.08);
    }
    .pw-toolkit-btn svg {
      width: ${CONFIG.ICON_SIZE}px;
      height: ${CONFIG.ICON_SIZE}px;
      fill: none;
      stroke: #666;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pw-toolkit-btn:hover svg {
      stroke: #333;
    }
    .pw-toolkit-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .pw-toolkit-toast.show {
      opacity: 1;
    }
  `;

  // ─── SVG 图标 ───
  const ICONS = {
    eyeOpen: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeClosed: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  };

  // ─── 注入样式 ───
  function injectStyles() {
    if (document.getElementById('pw-toolkit-style')) return;
    const style = document.createElement('style');
    style.id = 'pw-toolkit-style';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ─── Toast 提示 ───
  let toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pw-toolkit-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), CONFIG.TOAST_DURATION);
  }

  // ─── 处理单个密码输入框 ───
  function enhancePasswordField(input) {
    // 防重复处理
    if (input.dataset.pwToolkit) return;
    input.dataset.pwToolkit = '1';

    // 找到输入框的最近块级父元素
    const wrapper = input.closest('div, span, td, li, label, form, p') || input.parentNode;
    if (!wrapper) return;

    // 如果已经有容器了，跳过
    if (wrapper.querySelector('.pw-toolkit-container')) return;

    const container = document.createElement('span');
    container.className = 'pw-toolkit-container';

    // ── 显示/隐藏按钮 ──
    let visible = false;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'pw-toolkit-btn';
    toggleBtn.title = '显示/隐藏密码';
    toggleBtn.innerHTML = ICONS.eyeOpen;

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      visible = !visible;
      input.type = visible ? 'text' : 'password';
      toggleBtn.innerHTML = visible ? ICONS.eyeClosed : ICONS.eyeOpen;
    });

    // ── 复制按钮 ──
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'pw-toolkit-btn';
    copyBtn.title = '复制密码';
    copyBtn.innerHTML = ICONS.copy;

    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = input.value;
      if (!val) {
        showToast('⚠️ 输入框为空');
        return;
      }
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(val, 'text');
      } else {
        navigator.clipboard.writeText(val).catch(() => {
          // fallback: 临时创建 textarea
          const ta = document.createElement('textarea');
          ta.value = val;
          ta.style.cssText = 'position:fixed;left:-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        });
      }
      showToast('✅ 密码已复制');
    });

    container.appendChild(toggleBtn);
    container.appendChild(copyBtn);

    // 插入到输入框后面
    if (input.nextSibling) {
      input.parentNode.insertBefore(container, input.nextSibling);
    } else {
      input.parentNode.appendChild(container);
    }
  }

  // ─── 扫描页面上所有密码框 ───
  function scanPasswordFields() {
    const inputs = document.querySelectorAll('input[type="password"], input[name*="pass"], input[name*="pwd"], input[autocomplete="current-password"], input[autocomplete="new-password"]');
    inputs.forEach(enhancePasswordField);
  }

  // ─── MutationObserver 监听动态加载 ───
  let debounceTimer = null;
  function startObserver() {
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanPasswordFields, CONFIG.DEBOUNCE_MS);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── 启动 ───
  injectStyles();
  scanPasswordFields();
  startObserver();
})();
