// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.4.1
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

  const DEFAULTS = { enabled: true, encrypt: false, alwaysShow: false, letterShift: 7, digitShift: 3 };

  const cfg = () => ({
    enabled: GM_getValue('pw_enabled', DEFAULTS.enabled),
    encrypt: GM_getValue('pw_encrypt', DEFAULTS.encrypt),
    alwaysShow: GM_getValue('pw_alwaysShow', DEFAULTS.alwaysShow),
    letterShift: GM_getValue('pw_letterShift', DEFAULTS.letterShift),
    digitShift: GM_getValue('pw_digitShift', DEFAULTS.digitShift),
  });

  const save = c => {
    for (const [k, v] of Object.entries(c)) GM_setValue('pw_' + k, v);
  };

  const shift = (ch, ls, ds) => {
    if (ch >= 'a' && ch <= 'z') return String.fromCharCode(((ch.charCodeAt(0) - 97 + ls) % 26) + 97);
    if (ch >= 'A' && ch <= 'Z') return String.fromCharCode(((ch.charCodeAt(0) - 65 + ls) % 26) + 65);
    if (ch >= '0' && ch <= '9') return String.fromCharCode(((ch.charCodeAt(0) - 48 + ds) % 10) + 48);
    return ch;
  };

  const enc = (t, c) => t.split('').map(ch => shift(ch, c.letterShift, c.digitShift)).join('');

  // ─── 图标 ───
  const I = {
    eye:    `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    eyeEnc: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="1.5"/></svg>`,
    copy:   `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    gear:   `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };

  // ─── 样式 ───
  function injectCSS() {
    if (document.getElementById('pw-tk-css')) return;
    const s = document.createElement('style');
    s.id = 'pw-tk-css';
    s.textContent = `
      .pw-tk{display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle}
      .pw-tk-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:4px;background:0 0;cursor:pointer;padding:0;transition:background .15s;flex-shrink:0}
      .pw-tk-btn:hover{background:rgba(0,0,0,.08)}
      .pw-tk-btn svg{width:18px;height:18px;fill:none;stroke:#666;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .pw-tk-btn:hover svg{stroke:#333}
      .pw-tk-btn.on svg{stroke:#1a73e8}
      .pw-tk-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;z-index:999999;opacity:0;transition:opacity .2s;pointer-events:none}
      .pw-tk-toast.show{opacity:1}
      .pw-tk-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999998;display:flex;align-items:center;justify-content:center}
      .pw-tk-box{background:#fff;border-radius:12px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.2);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}
      .pw-tk-box h3{margin:0 0 16px;font-size:16px;font-weight:600}
      .pw-tk-r{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
      .pw-tk-r label{font-size:14px}
      .pw-tk-r .h{font-size:12px;color:#999;margin-top:2px}
      .pw-tk-sw{position:relative;width:40px;height:22px;flex-shrink:0}
      .pw-tk-sw input{display:none}
      .pw-tk-sw .s{position:absolute;inset:0;background:#ccc;border-radius:22px;cursor:pointer;transition:background .2s}
      .pw-tk-sw .s::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:transform .2s}
      .pw-tk-sw input:checked+.s{background:#1a73e8}
      .pw-tk-sw input:checked+.s::before{transform:translateX(18px)}
      .pw-tk-nm{width:52px;height:30px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:14px;outline:0}
      .pw-tk-nm:focus{border-color:#1a73e8}
      .pw-tk-ft{margin-top:18px;text-align:right}
      .pw-tk-ft button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}
      .pw-tk-ft button:hover{background:#1557b0}
    `;
    document.head.appendChild(s);
  }

  // ─── Toast ───
  let _toast;
  function toast(m) {
    if (!_toast) { _toast = document.createElement('div'); _toast.className = 'pw-tk-toast'; document.body.appendChild(_toast); }
    _toast.textContent = m; _toast.classList.add('show');
    clearTimeout(_toast._t); _toast._t = setTimeout(() => _toast.classList.remove('show'), 1500);
  }

  // ─── 设置面板 ───
  function showSettings() {
    if (document.querySelector('.pw-tk-mask')) return;
    const c = cfg();
    const m = document.createElement('div');
    m.className = 'pw-tk-mask';
    m.innerHTML = `
      <div class="pw-tk-box">
        <h3>🔐 密码工具设置</h3>
        <div class="pw-tk-r"><div><label>启用脚本</label><div class="h">关闭后密码框不再显示按钮</div></div><label class="pw-tk-sw"><input type="checkbox" id="pw-c-on" ${c.enabled?'checked':''}><span class="s"></span></label></div>
        <div class="pw-tk-r"><div><label>始终显示密码</label><div class="h">密码直接明文，去掉眼睛按钮</div></div><label class="pw-tk-sw"><input type="checkbox" id="pw-c-al" ${c.alwaysShow?'checked':''}><span class="s"></span></label></div>
        <div class="pw-tk-r"><div><label>加密显示</label><div class="h">显示时混淆，复制时获取真实密码</div></div><label class="pw-tk-sw"><input type="checkbox" id="pw-c-en" ${c.encrypt?'checked':''}><span class="s"></span></label></div>
        <div class="pw-tk-r"><div><label>字母偏移</label><div class="h">A→? 偏移量 (0-25)</div></div><input type="number" class="pw-tk-nm" id="pw-c-ls" min="0" max="25" value="${c.letterShift}"></div>
        <div class="pw-tk-r"><div><label>数字偏移</label><div class="h">0→? 偏移量 (0-9)</div></div><input type="number" class="pw-tk-nm" id="pw-c-ds" min="0" max="9" value="${c.digitShift}"></div>
        <div class="pw-tk-r"><div><label>预览</label><div class="h" id="pw-c-pre"></div></div></div>
        <div class="pw-tk-ft"><button id="pw-c-ok">保存</button></div>
      </div>`;
    document.body.appendChild(m);

    const pre = m.querySelector('#pw-c-pre');
    const upd = () => { pre.textContent = `MyP@ss123 → ${enc('MyP@ss123', { letterShift: +m.querySelector('#pw-c-ls').value||0, digitShift: +m.querySelector('#pw-c-ds').value||0 })}`; };
    upd();
    m.querySelector('#pw-c-ls').addEventListener('input', upd);
    m.querySelector('#pw-c-ds').addEventListener('input', upd);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    m.querySelector('#pw-c-ok').addEventListener('click', () => {
      save({
        enabled: m.querySelector('#pw-c-on').checked,
        encrypt: m.querySelector('#pw-c-en').checked,
        alwaysShow: m.querySelector('#pw-c-al').checked,
        letterShift: Math.max(0, Math.min(25, +m.querySelector('#pw-c-ls').value||0)),
        digitShift: Math.max(0, Math.min(9, +m.querySelector('#pw-c-ds').value||0)),
      });
      m.remove(); toast('✅ 设置已保存');
    });
  }

  // ─── 增强密码框 ───
  function enhance(input) {
    if (input.dataset.pwTk) return;
    input.dataset.pwTk = '1';
    const wrapper = input.closest('div,span,td,li,label,form,p') || input.parentNode;
    if (!wrapper || wrapper.querySelector('.pw-tk')) return;

    const c = cfg();
    const box = document.createElement('span');
    box.className = 'pw-tk';
    box._real = input.value;

    let visible = c.alwaysShow;
    if (c.alwaysShow) input.type = 'text';

    // 眼睛（始终显示模式下不加）
    if (!c.alwaysShow) {
      const tog = document.createElement('button');
      tog.type = 'button'; tog.className = 'pw-tk-btn'; tog.title = '显示/隐藏密码';
      tog.innerHTML = I.eye;
      tog.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const cc = cfg(); visible = !visible;
        if (visible) {
          box._real = input.value;
          if (cc.encrypt) { input.value = enc(input.value, cc); tog.innerHTML = I.eyeEnc; tog.classList.add('on'); }
          else tog.innerHTML = I.eyeOff;
          input.type = 'text';
        } else {
          if (cc.encrypt && tog.classList.contains('on')) input.value = box._real;
          input.type = 'password'; tog.innerHTML = I.eye; tog.classList.remove('on');
        }
      });
      box.appendChild(tog);
    }

    // 复制
    const cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'pw-tk-btn'; cp.title = '复制密码';
    cp.innerHTML = I.copy;
    cp.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const val = box._real || input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      if (typeof GM_setClipboard === 'function') GM_setClipboard(val, 'text');
      else navigator.clipboard.writeText(val).catch(() => {});
      toast('✅ 密码已复制');
    });

    // 齿轮
    const gear = document.createElement('button');
    gear.type = 'button'; gear.className = 'pw-tk-btn'; gear.title = '密码工具设置';
    gear.innerHTML = I.gear;
    gear.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showSettings(); });

    box.appendChild(cp);
    box.appendChild(gear);
    if (input.nextSibling) input.parentNode.insertBefore(box, input.nextSibling);
    else input.parentNode.appendChild(box);
  }

  // ─── 扫描 ───
  function scan() {
    if (!cfg().enabled) return;
    document.querySelectorAll('input[type="password"],input[name*="pass"],input[name*="pwd"],input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(enhance);
  }

  let _st;
  new MutationObserver(() => { clearTimeout(_st); _st = setTimeout(scan, 300); }).observe(document.documentElement, { childList: true, subtree: true });

  // ─── 启动 ───
  injectCSS();
  GM_registerMenuCommand('⚙️ 打开设置', showSettings);
  if (cfg().enabled) scan();
})();
