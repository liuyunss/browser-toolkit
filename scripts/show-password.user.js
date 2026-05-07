// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.3.0
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

  // ─── 配置 ───
  const DEFAULTS = { enabled: true, encrypt: false, letterShift: 7, digitShift: 3 };
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
    .pw-tk{display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle}
    .pw-tk-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:4px;background:0 0;cursor:pointer;padding:0;transition:background .15s;flex-shrink:0}
    .pw-tk-btn:hover{background:rgba(0,0,0,.08)}
    .pw-tk-btn svg{width:18px;height:18px;fill:none;stroke:#666;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .pw-tk-btn:hover svg{stroke:#333}
    .pw-tk-btn.on svg{stroke:#1a73e8}
    .pw-tk-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;z-index:999999;opacity:0;transition:opacity .2s;pointer-events:none}
    .pw-tk-toast.show{opacity:1}

    /* 设置弹窗 */
    .pw-tk-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999998;display:flex;align-items:center;justify-content:center}
    .pw-tk-modal{background:#fff;border-radius:12px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.2);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}
    .pw-tk-modal h3{margin:0 0 16px;font-size:16px;font-weight:600}
    .pw-tk-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .pw-tk-row label{font-size:14px}
    .pw-tk-row .hint{font-size:12px;color:#999;margin-top:2px}
    .pw-tk-switch{position:relative;width:40px;height:22px;flex-shrink:0}
    .pw-tk-switch input{display:none}
    .pw-tk-switch .sl{position:absolute;inset:0;background:#ccc;border-radius:22px;cursor:pointer;transition:background .2s}
    .pw-tk-switch .sl::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:transform .2s}
    .pw-tk-switch input:checked+.sl{background:#1a73e8}
    .pw-tk-switch input:checked+.sl::before{transform:translateX(18px)}
    .pw-tk-num{width:52px;height:30px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:14px;outline:0}
    .pw-tk-num:focus{border-color:#1a73e8}
    .pw-tk-foot{margin-top:18px;text-align:right}
    .pw-tk-foot button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}
    .pw-tk-foot button:hover{background:#1557b0}
  `;

  const ICO = {
    eye:    `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    eyeEnc: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="1.5"/></svg>`,
    copy:   `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    gear:   `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };

  // ─── 工具 ───
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

  // ─── 设置弹窗（点击齿轮弹出）───
  function showSettings() {
    if (document.querySelector('.pw-tk-modal-mask')) return;
    const cfg = getConfig();

    const mask = document.createElement('div');
    mask.className = 'pw-tk-modal-mask';
    mask.innerHTML = `
      <div class="pw-tk-modal">
        <h3>🔐 密码工具设置</h3>
        <div class="pw-tk-row">
          <div><label>启用脚本</label><div class="hint">关闭后密码框不再显示按钮</div></div>
          <label class="pw-tk-switch"><input type="checkbox" id="pw-c-on" ${cfg.enabled?'checked':''}><span class="sl"></span></label>
        </div>
        <div class="pw-tk-row">
          <div><label>加密显示</label><div class="hint">显示时混淆，复制时获取真实密码</div></div>
          <label class="pw-tk-switch"><input type="checkbox" id="pw-c-enc" ${cfg.encrypt?'checked':''}><span class="sl"></span></label>
        </div>
        <div class="pw-tk-row">
          <div><label>字母偏移</label><div class="hint">A→? 的偏移量 (0-25)</div></div>
          <input type="number" class="pw-tk-num" id="pw-c-ls" min="0" max="25" value="${cfg.letterShift}">
        </div>
        <div class="pw-tk-row">
          <div><label>数字偏移</label><div class="hint">0→? 的偏移量 (0-9)</div></div>
          <input type="number" class="pw-tk-num" id="pw-c-ds" min="0" max="9" value="${cfg.digitShift}">
        </div>
        <div class="pw-tk-row">
          <div><label>预览</label><div class="hint" id="pw-c-pre"></div></div>
        </div>
        <div class="pw-tk-foot"><button id="pw-c-save">保存</button></div>
      </div>
    `;
    document.body.appendChild(mask);

    // 预览
    const pre = mask.querySelector('#pw-c-pre');
    function updPreview() {
      const ls = parseInt(mask.querySelector('#pw-c-ls').value)||0;
      const ds = parseInt(mask.querySelector('#pw-c-ds').value)||0;
      pre.textContent = `MyP@ss123 → ${encryptText('MyP@ss123',{letterShift:ls,digitShift:ds})}`;
    }
    updPreview();
    mask.querySelector('#pw-c-ls').addEventListener('input', updPreview);
    mask.querySelector('#pw-c-ds').addEventListener('input', updPreview);

    // 点击遮罩关闭
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });

    // 保存并关闭
    mask.querySelector('#pw-c-save').addEventListener('click', () => {
      saveConfig({
        enabled: mask.querySelector('#pw-c-on').checked,
        encrypt: mask.querySelector('#pw-c-enc').checked,
        letterShift: Math.max(0, Math.min(25, parseInt(mask.querySelector('#pw-c-ls').value)||0)),
        digitShift: Math.max(0, Math.min(9, parseInt(mask.querySelector('#pw-c-ds').value)||0)),
      });
      mask.remove();
      toast('✅ 设置已保存');
    });
  }

  // ─── 增强密码框 ───
  function enhance(input) {
    if (input.dataset.pwTk) return;
    input.dataset.pwTk = '1';

    const wrapper = input.closest('div,span,td,li,label,form,p') || input.parentNode;
    if (!wrapper || wrapper.querySelector('.pw-tk')) return;

    const box = document.createElement('span');
    box.className = 'pw-tk';
    box._input = input;
    box._real = input.value;

    let visible = false;

    // 眼睛
    const tog = document.createElement('button');
    tog.type = 'button'; tog.className = 'pw-tk-btn'; tog.title = '显示/隐藏密码';
    tog.innerHTML = ICO.eye;
    tog.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const cfg = getConfig();
      visible = !visible;
      if (visible) {
        box._real = input.value;
        if (cfg.encrypt) { input.value = encryptText(input.value, cfg); tog.innerHTML = ICO.eyeEnc; tog.classList.add('on'); }
        else { tog.innerHTML = ICO.eyeOff; }
        input.type = 'text';
      } else {
        if (cfg.encrypt && tog.classList.contains('on')) input.value = box._real;
        input.type = 'password'; tog.innerHTML = ICO.eye; tog.classList.remove('on');
      }
    });

    // 复制
    const cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'pw-tk-btn'; cp.title = '复制密码';
    cp.innerHTML = ICO.copy;
    cp.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const val = box._real || input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      if (typeof GM_setClipboard === 'function') GM_setClipboard(val, 'text');
      else navigator.clipboard.writeText(val).catch(() => {});
      toast('✅ 密码已复制');
    });

    // 齿轮（设置入口）
    const gear = document.createElement('button');
    gear.type = 'button'; gear.className = 'pw-tk-btn'; gear.title = '密码工具设置';
    gear.innerHTML = ICO.gear;
    gear.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showSettings(); });

    box.appendChild(tog);
    box.appendChild(cp);
    box.appendChild(gear);
    if (input.nextSibling) input.parentNode.insertBefore(box, input.nextSibling);
    else input.parentNode.appendChild(box);
  }

  // ─── 扫描 ───
  function scan() {
    if (!getConfig().enabled) return;
    document.querySelectorAll(
      'input[type="password"],input[name*="pass"],input[name*="pwd"],input[autocomplete="current-password"],input[autocomplete="new-password"]'
    ).forEach(enhance);
  }

  let scanTimer = null;
  function startObserver() {
    new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 300); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── 油猴菜单（备用入口）───
  GM_registerMenuCommand('⚙️ 打开设置', showSettings);

  // ─── 启动 ───
  injectStyles();
  if (getConfig().enabled) scan();
  startObserver();
})();
