// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.1.0
// @description  在所有网站的密码输入框旁添加显示/隐藏、复制按钮，支持加密显示
// @author       liuyunss
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ─── 默认配置 ───
  const DEFAULTS = {
    enabled: true,       // 全局开关
    encrypt: false,      // 加密显示
    letterShift: 7,      // 字母偏移量 (0-25)
    digitShift: 3,       // 数字偏移量 (0-9)
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

  // ─── 加密/解密 ───
  function shiftChar(ch, letterShift, digitShift) {
    if (ch >= 'a' && ch <= 'z') {
      return String.fromCharCode(((ch.charCodeAt(0) - 97 + letterShift) % 26) + 97);
    }
    if (ch >= 'A' && ch <= 'Z') {
      return String.fromCharCode(((ch.charCodeAt(0) - 65 + letterShift) % 26) + 65);
    }
    if (ch >= '0' && ch <= '9') {
      return String.fromCharCode(((ch.charCodeAt(0) - 48 + digitShift) % 10) + 48);
    }
    return ch;
  }

  function encryptText(text, cfg) {
    return text.split('').map(ch => shiftChar(ch, cfg.letterShift, cfg.digitShift)).join('');
  }

  function decryptText(text, cfg) {
    // 解密 = 反向偏移
    const l = (26 - cfg.letterShift) % 26;
    const d = (10 - cfg.digitShift) % 10;
    return text.split('').map(ch => shiftChar(ch, l, d)).join('');
  }

  // ─── 样式 ───
  const STYLES = `
    .pw-toolkit-container {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 6px;
      vertical-align: middle;
    }
    .pw-toolkit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: none;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      padding: 0;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .pw-toolkit-btn:hover { background: rgba(0,0,0,0.08); }
    .pw-toolkit-btn svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: #666;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pw-toolkit-btn:hover svg { stroke: #333; }
    .pw-toolkit-btn.active svg { stroke: #1a73e8; }

    /* 设置面板 */
    .pw-toolkit-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pw-toolkit-panel {
      background: #fff;
      border-radius: 12px;
      padding: 24px 28px;
      min-width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #333;
    }
    .pw-toolkit-panel h3 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
    }
    .pw-toolkit-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .pw-toolkit-row:last-child { margin-bottom: 0; }
    .pw-toolkit-row label {
      font-size: 14px;
      color: #333;
    }
    .pw-toolkit-row .hint {
      font-size: 12px;
      color: #999;
      margin-top: 2px;
    }
    /* 开关 */
    .pw-toolkit-switch {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .pw-toolkit-switch input { display: none; }
    .pw-toolkit-switch .slider {
      position: absolute;
      inset: 0;
      background: #ccc;
      border-radius: 22px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .pw-toolkit-switch .slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 2px;
      top: 2px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .pw-toolkit-switch input:checked + .slider { background: #1a73e8; }
    .pw-toolkit-switch input:checked + .slider::before { transform: translateX(18px); }
    /* 数字输入 */
    .pw-toolkit-num {
      width: 52px;
      height: 30px;
      border: 1px solid #ddd;
      border-radius: 6px;
      text-align: center;
      font-size: 14px;
      outline: none;
    }
    .pw-toolkit-num:focus { border-color: #1a73e8; }
    .pw-toolkit-footer {
      margin-top: 18px;
      text-align: right;
    }
    .pw-toolkit-footer button {
      padding: 6px 18px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    .pw-toolkit-footer .save {
      background: #1a73e8;
      color: #fff;
    }
    .pw-toolkit-footer .save:hover { background: #1557b0; }

    /* Toast */
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
    .pw-toolkit-toast.show { opacity: 1; }
  `;

  // ─── SVG 图标 ───
  const ICONS = {
    eyeOpen:     `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeClosed:   `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    eyeEncrypted:`<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="1.5"/></svg>`,
    copy:        `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    gear:        `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };

  // ─── 注入样式 ───
  function injectStyles() {
    if (document.getElementById('pw-toolkit-style')) return;
    const s = document.createElement('style');
    s.id = 'pw-toolkit-style';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ─── Toast ───
  let toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pw-toolkit-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  // ─── 设置面板 ───
  function showSettingsPanel() {
    if (document.querySelector('.pw-toolkit-overlay')) return;
    const cfg = getConfig();

    const overlay = document.createElement('div');
    overlay.className = 'pw-toolkit-overlay';

    overlay.innerHTML = `
      <div class="pw-toolkit-panel">
        <h3>🔐 密码工具设置</h3>
        <div class="pw-toolkit-row">
          <div>
            <label>启用脚本</label>
            <div class="hint">关闭后所有密码框不再显示按钮</div>
          </div>
          <label class="pw-toolkit-switch">
            <input type="checkbox" id="pw-cfg-enabled" ${cfg.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="pw-toolkit-row">
          <div>
            <label>加密显示</label>
            <div class="hint">显示密码时使用混淆字符，复制时获取真实密码</div>
          </div>
          <label class="pw-toolkit-switch">
            <input type="checkbox" id="pw-cfg-encrypt" ${cfg.encrypt ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="pw-toolkit-row">
          <div>
            <label>字母偏移</label>
            <div class="hint">A→? 的偏移量，自己记住即可</div>
          </div>
          <input type="number" class="pw-toolkit-num" id="pw-cfg-lshift"
                 min="0" max="25" value="${cfg.letterShift}">
        </div>
        <div class="pw-toolkit-row">
          <div>
            <label>数字偏移</label>
            <div class="hint">0→? 的偏移量</div>
          </div>
          <input type="number" class="pw-toolkit-num" id="pw-cfg-dshift"
                 min="0" max="9" value="${cfg.digitShift}">
        </div>
        <div class="pw-toolkit-row">
          <div>
            <label>预览</label>
            <div class="hint" id="pw-cfg-preview"></div>
          </div>
        </div>
        <div class="pw-toolkit-footer">
          <button class="save" id="pw-cfg-save">保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 预览
    const previewEl = document.querySelector('#pw-cfg-preview');
    function updatePreview() {
      const ls = parseInt(document.querySelector('#pw-cfg-lshift').value) || 0;
      const ds = parseInt(document.querySelector('#pw-cfg-dshift').value) || 0;
      const sample = 'MyP@ss123';
      const encrypted = sample.split('').map(ch => shiftChar(ch, ls, ds)).join('');
      previewEl.textContent = `示例: ${sample} → ${encrypted}`;
    }
    updatePreview();

    overlay.querySelector('#pw-cfg-lshift').addEventListener('input', updatePreview);
    overlay.querySelector('#pw-cfg-dshift').addEventListener('input', updatePreview);

    // 关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // 保存
    overlay.querySelector('#pw-cfg-save').addEventListener('click', () => {
      const newCfg = {
        enabled: document.querySelector('#pw-cfg-enabled').checked,
        encrypt: document.querySelector('#pw-cfg-encrypt').checked,
        letterShift: Math.max(0, Math.min(25, parseInt(document.querySelector('#pw-cfg-lshift').value) || 0)),
        digitShift: Math.max(0, Math.min(9, parseInt(document.querySelector('#pw-cfg-dshift').value) || 0)),
      };
      saveConfig(newCfg);
      overlay.remove();
      showToast('✅ 设置已保存');
      // 刷新所有密码框的显示状态
      refreshAllFields(newCfg);
    });
  }

  // ─── 刷新所有已增强的密码框 ───
  function refreshAllFields(cfg) {
    const containers = document.querySelectorAll('.pw-toolkit-container');
    containers.forEach(c => {
      const input = c._inputRef;
      if (!input) return;
      // 如果加密按钮激活中，更新显示
      const encBtn = c.querySelector('.pw-toolkit-btn[data-action="encrypt"]');
      if (encBtn && encBtn.classList.contains('active') && input.type === 'text') {
        if (cfg.encrypt) {
          input.value = encryptText(c._realValue || input.value, cfg);
        } else {
          input.value = c._realValue || input.value;
        }
      }
    });
  }

  // ─── 处理单个密码输入框 ───
  function enhancePasswordField(input) {
    if (input.dataset.pwToolkit) return;
    input.dataset.pwToolkit = '1';

    const wrapper = input.closest('div, span, td, li, label, form, p') || input.parentNode;
    if (!wrapper) return;
    if (wrapper.querySelector('.pw-toolkit-container')) return;

    const container = document.createElement('span');
    container.className = 'pw-toolkit-container';
    container._inputRef = input;
    container._realValue = input.value;

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
      const cfg = getConfig();
      visible = !visible;

      if (visible) {
        container._realValue = input.value;
        if (cfg.encrypt) {
          // 加密模式：显示混淆密码
          input.value = encryptText(input.value, cfg);
          toggleBtn.innerHTML = ICONS.eyeEncrypted;
          toggleBtn.classList.add('active');
        } else {
          toggleBtn.innerHTML = ICONS.eyeClosed;
        }
        input.type = 'text';
      } else {
        // 隐藏
        if (cfg.encrypt && toggleBtn.classList.contains('active')) {
          // 恢复真实密码再隐藏
          input.value = container._realValue;
        }
        input.type = 'password';
        toggleBtn.innerHTML = ICONS.eyeOpen;
        toggleBtn.classList.remove('active');
      }
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
      // 始终复制真实密码
      const realVal = container._realValue || input.value;
      if (!realVal) {
        showToast('⚠️ 输入框为空');
        return;
      }
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(realVal, 'text');
      } else {
        navigator.clipboard.writeText(realVal).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = realVal;
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

    if (input.nextSibling) {
      input.parentNode.insertBefore(container, input.nextSibling);
    } else {
      input.parentNode.appendChild(container);
    }
  }

  // ─── 扫描 + 全局设置按钮 ───
  function scanPasswordFields() {
    if (!getConfig().enabled) return;
    const inputs = document.querySelectorAll(
      'input[type="password"], input[name*="pass"], input[name*="pwd"], input[autocomplete="current-password"], input[autocomplete="new-password"]'
    );
    inputs.forEach(enhancePasswordField);
  }

  // ─── MutationObserver ───
  let debounceTimer = null;
  function startObserver() {
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanPasswordFields, 300);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── 注入全局设置入口（右下角齿轮）───
  function injectSettingsButton() {
    if (document.getElementById('pw-toolkit-settings-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'pw-toolkit-settings-btn';
    btn.type = 'button';
    btn.title = '密码工具设置';
    btn.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: rgba(0,0,0,0.06);
      cursor: pointer;
      z-index: 999997;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.3s;
      opacity: 0.3;
    `;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    btn.addEventListener('click', showSettingsPanel);
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; btn.style.background = 'rgba(0,0,0,0.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.3'; btn.style.background = 'rgba(0,0,0,0.06)'; });
    document.body.appendChild(btn);
  }

  // ─── 启动 ───
  injectStyles();
  if (getConfig().enabled) {
    scanPasswordFields();
  }
  startObserver();
  injectSettingsButton();
})();
