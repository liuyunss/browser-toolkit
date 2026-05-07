// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.8.0
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
    gear: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };

  /* ── 样式（密码框按钮用普通 style）─── */
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

  /* ── Shadow DOM 设置弹窗 ── */
  let _settingsOpen = false;

  function openSettings() {
    if (_settingsOpen) return;
    _settingsOpen = true;

    const c = cfg();

    // 宿主元素
    const host = document.createElement('div');
    host.id = 'pw-tk-settings-host';
    host.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;';

    const shadow = host.attachShadow({ mode: 'closed' });

    // Shadow DOM 内的完整样式
    shadow.innerHTML = `<style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .mask {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
        font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #333;
      }
      .panel {
        background: #fff; border-radius: 12px; padding: 24px; width: 340px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-height: 90vh; overflow-y: auto;
      }
      h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
      .row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .row label { font-size: 14px; }
      .hint { font-size: 12px; color: #999; margin-top: 2px; }
      .sw { position: relative; width: 40px; height: 22px; flex-shrink: 0; cursor: pointer; display: block; }
      .sw input { display: none; }
      .sw .sl { position: absolute; inset: 0; background: #ccc; border-radius: 22px; transition: background .2s; }
      .sw .sl::before { content: ''; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: left .2s; }
      .sw input:checked + .sl { background: #1a73e8; }
      .sw input:checked + .sl::before { left: 20px; }
      .nm { width: 52px; height: 30px; border: 1px solid #ddd; border-radius: 6px; text-align: center; font-size: 14px; outline: none; }
      .nm:focus { border-color: #1a73e8; }
      .ft { margin-top: 18px; text-align: right; }
      .ft button { padding: 6px 18px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; background: #1a73e8; color: #fff; }
      .ft button:hover { background: #1557b0; }
    </style>
    <div class="mask">
      <div class="panel">
        <h3>🔐 密码工具设置</h3>
        <div class="row"><div><label>启用脚本</label><div class="hint">关闭后密码框不再显示按钮</div></div><label class="sw"><input type="checkbox" id="s-on" ${c.enabled ? 'checked' : ''}><span class="sl"></span></label></div>
        <div class="row"><div><label>始终显示密码</label><div class="hint">密码直接明文，去掉眼睛按钮</div></div><label class="sw"><input type="checkbox" id="s-al" ${c.alwaysShow ? 'checked' : ''}><span class="sl"></span></label></div>
        <div class="row"><div><label>加密显示</label><div class="hint">显示时混淆，复制时获取真实密码</div></div><label class="sw"><input type="checkbox" id="s-en" ${c.encrypt ? 'checked' : ''}><span class="sl"></span></label></div>
        <div class="row"><div><label>字母偏移</label><div class="hint">A→? 偏移量 (0-25)</div></div><input type="number" class="nm" id="s-ls" min="0" max="25" value="${c.letterShift}"></div>
        <div class="row"><div><label>数字偏移</label><div class="hint">0→? 偏移量 (0-9)</div></div><input type="number" class="nm" id="s-ds" min="0" max="9" value="${c.digitShift}"></div>
        <div class="row"><div><label>预览</label><div class="hint" id="s-pre"></div></div></div>
        <div class="ft"><button id="s-ok">保存</button></div>
      </div>
    </div>`;

    // 预览
    const pre = shadow.getElementById('s-pre');
    const ls = shadow.getElementById('s-ls');
    const ds = shadow.getElementById('s-ds');
    function updPre() { pre.textContent = `MyP@ss123 → ${enc('MyP@ss123', { letterShift: +ls.value || 0, digitShift: +ds.value || 0 })}`; }
    updPre();
    ls.addEventListener('input', updPre);
    ds.addEventListener('input', updPre);

    // 关闭
    shadow.querySelector('.mask').addEventListener('click', e => { if (e.target.classList.contains('mask')) closeSettings(); });

    // 保存
    shadow.getElementById('s-ok').addEventListener('click', e => {
      e.stopPropagation();
      saveCfg({
        enabled:     shadow.getElementById('s-on').checked,
        encrypt:     shadow.getElementById('s-en').checked,
        alwaysShow:  shadow.getElementById('s-al').checked,
        letterShift: Math.max(0, Math.min(25, +ls.value || 0)),
        digitShift:  Math.max(0, Math.min(9, +ds.value || 0)),
      });
      closeSettings();
      toast('✅ 设置已保存');
    });

    document.body.appendChild(host);
  }

  function closeSettings() {
    const el = document.getElementById('pw-tk-settings-host');
    if (el) el.remove();
    _settingsOpen = false;
  }

  /* ── 油猴菜单 ── */
  GM_registerMenuCommand('打开设置', openSettings);

  /* ── 增强密码框 ── */
  function enhance(input) {
    if (input.dataset.pwTk) return;
    input.dataset.pwTk = '1';
    const w = input.closest('div,span,td,li,label,form,p') || input.parentNode;
    if (!w || w.querySelector('.pw-tk')) return;

    const c = cfg();
    const box = document.createElement('span');
    box.className = 'pw-tk';

    // 始终显示模式：加密则显示密文，否则明文
    if (c.alwaysShow) {
      input.type = 'text';
      if (c.encrypt) {
        box._real = input.value;
        input.value = enc(input.value, c);
        box._encrypted = true;
      }
    }

    // 眼睛按钮（始终显示模式下不加）
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

    // 复制（始终复制真实密码）
    const cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'pw-tk-btn'; cp.title = '复制密码';
    cp.innerHTML = SVG.copy;
    cp.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      // 真实密码：优先用 _real，否则用 input 原始值
      const val = box._real || input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      // 如果当前显示的是加密值，需要解密再复制
      let realVal = val;
      if (box._encrypted && val !== box._real) {
        const cc = cfg();
        const ls2 = (26 - cc.letterShift) % 26;
        const ds2 = (10 - cc.digitShift) % 10;
        realVal = val.split('').map(ch => sc(ch, ls2, ds2)).join('');
      }
      if (typeof GM_setClipboard === 'function') GM_setClipboard(realVal, 'text');
      else navigator.clipboard.writeText(realVal).catch(() => {});
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
