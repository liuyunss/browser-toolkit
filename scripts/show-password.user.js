// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.7.0
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

  const D = { enabled: true, encrypt: false, alwaysShow: false, letterShift: 7, digitShift: 3 };
  const cfg = () => ({
    enabled:     GM_getValue('pw_enabled',     D.enabled),
    encrypt:     GM_getValue('pw_encrypt',     D.encrypt),
    alwaysShow:  GM_getValue('pw_alwaysShow',  D.alwaysShow),
    letterShift: GM_getValue('pw_letterShift', D.letterShift),
    digitShift:  GM_getValue('pw_digitShift',  D.digitShift),
  });
  const saveCfg = c => { for (const [k, v] of Object.entries(c)) GM_setValue('pw_' + k, v); };

  /* ── 加密 ── */
  const sc = (ch, ls, ds) => {
    if (ch >= 'a' && ch <= 'z') return String.fromCharCode(((ch.charCodeAt(0) - 97 + ls) % 26) + 97);
    if (ch >= 'A' && ch <= 'Z') return String.fromCharCode(((ch.charCodeAt(0) - 65 + ls) % 26) + 65);
    if (ch >= '0' && ch <= '9') return String.fromCharCode(((ch.charCodeAt(0) - 48 + ds) % 10) + 48);
    return ch;
  };
  const enc = (t, c) => t.split('').map(ch => sc(ch, c.letterShift, c.digitShift)).join('');

  /* ── SVG ── */
  const SVG = {
    eye:  `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    hide: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    enc:  `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="1.5"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  };

  /* ── 样式 ── */
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
    `;
    document.head.appendChild(s);
  }

  let _t;
  function toast(m) {
    if (!_t) { _t = document.createElement('div'); _t.className = 'pw-tk-toast'; document.body.appendChild(_t); }
    _t.textContent = m; _t.classList.add('show');
    clearTimeout(_t._x); _t._x = setTimeout(() => _t.classList.remove('show'), 1500);
  }

  /* ── 油猴菜单（纯 prompt，零 DOM）─── */
  GM_registerMenuCommand('⚙️ 打开设置', () => {
    const c = cfg();
    const s = `当前设置:\n` +
      `1. 启用脚本: ${c.enabled ? '是' : '否'}\n` +
      `2. 始终显示密码: ${c.alwaysShow ? '是' : '否'}\n` +
      `3. 加密显示: ${c.encrypt ? '是' : '否'}\n` +
      `4. 字母偏移: ${c.letterShift}\n` +
      `5. 数字偏移: ${c.digitShift}\n\n` +
      `示例: MyP@ss123 → ${enc('MyP@ss123', c)}\n\n` +
      `要修改哪项？输入编号(1-5)或取消退出`;
    const choice = prompt(s);
    if (!choice) return;
    const n = parseInt(choice);
    if (n === 1) { saveCfg({ enabled: !c.enabled }); toast(c.enabled ? '⛔ 脚本已关闭' : '✅ 脚本已开启'); }
    else if (n === 2) { saveCfg({ alwaysShow: !c.alwaysShow }); toast(c.alwaysShow ? '👁️ 回退显示模式' : '📄 始终明文显示'); }
    else if (n === 3) { saveCfg({ encrypt: !c.encrypt }); toast(c.encrypt ? '🔓 加密已关闭' : '🔒 加密已开启'); }
    else if (n === 4) { const v = prompt('字母偏移量 (0-25):', c.letterShift); if (v !== null) { saveCfg({ letterShift: Math.max(0, Math.min(25, +v || 0)) }); toast('✅ 已保存'); } }
    else if (n === 5) { const v = prompt('数字偏移量 (0-9):', c.digitShift); if (v !== null) { saveCfg({ digitShift: Math.max(0, Math.min(9, +v || 0)) }); toast('✅ 已保存'); } }
  });

  /* ── 增强密码框 ── */
  function enhance(input) {
    if (input.dataset.pwTk) return;
    input.dataset.pwTk = '1';
    const w = input.closest('div,span,td,li,label,form,p') || input.parentNode;
    if (!w || w.querySelector('.pw-tk')) return;

    const c = cfg();
    const box = document.createElement('span');
    box.className = 'pw-tk';

    if (c.alwaysShow) input.type = 'text';

    if (!c.alwaysShow) {
      let visible = false;
      const tog = document.createElement('button');
      tog.type = 'button'; tog.className = 'pw-tk-btn'; tog.title = '显示/隐藏密码';
      tog.innerHTML = SVG.eye;
      tog.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const cc = cfg(); visible = !visible;
        if (visible) {
          box._real = input.value;
          if (cc.encrypt) { input.value = enc(input.value, cc); tog.innerHTML = SVG.enc; tog.classList.add('on'); }
          else tog.innerHTML = SVG.hide;
          input.type = 'text';
        } else {
          if (cc.encrypt && tog.classList.contains('on')) input.value = box._real;
          input.type = 'password'; tog.innerHTML = SVG.eye; tog.classList.remove('on');
        }
      });
      box.appendChild(tog);
    }

    const cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'pw-tk-btn'; cp.title = '复制密码';
    cp.innerHTML = SVG.copy;
    cp.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const val = box._real || input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      if (typeof GM_setClipboard === 'function') GM_setClipboard(val, 'text');
      else navigator.clipboard.writeText(val).catch(() => {});
      toast('✅ 密码已复制');
    });
    box.appendChild(cp);

    if (input.nextSibling) input.parentNode.insertBefore(box, input.nextSibling);
    else input.parentNode.appendChild(box);
  }

  /* ── 扫描 + Observer ── */
  function scan() {
    if (!cfg().enabled) return;
    document.querySelectorAll('input[type="password"],input[name*="pass"],input[name*="pwd"],input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(enhance);
  }

  let _st;
  new MutationObserver(() => { clearTimeout(_st); _st = setTimeout(scan, 300); })
    .observe(document.documentElement, { childList: true, subtree: true });

  /* ── 启动 ── */
  injectCSS();
  scan();
})();
