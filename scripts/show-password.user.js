// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.5.0
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

  /* ── 配置读写 ── */
  const D = { enabled: true, encrypt: false, alwaysShow: false, letterShift: 7, digitShift: 3 };
  const cfg = () => ({
    enabled:      GM_getValue('pw_enabled',      D.enabled),
    encrypt:      GM_getValue('pw_encrypt',      D.encrypt),
    alwaysShow:   GM_getValue('pw_alwaysShow',   D.alwaysShow),
    letterShift:  GM_getValue('pw_letterShift',  D.letterShift),
    digitShift:   GM_getValue('pw_digitShift',   D.digitShift),
  });
  const save = c => { for (const [k, v] of Object.entries(c)) GM_setValue('pw_' + k, v); };

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
    eye: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    hide: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    enc: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="1.5"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  };

  /* ── 样式注入 ── */
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
      #pw-tk-settings{position:fixed!important;inset:0!important;background:rgba(0,0,0,.35)!important;z-index:999998!important;display:flex!important;align-items:center;justify-content:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;color:#333!important}
      #pw-tk-settings>div{background:#fff;border-radius:12px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
      #pw-tk-settings h3{margin:0 0 16px;font-size:16px;font-weight:600}
      #pw-tk-settings .r{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
      #pw-tk-settings .r label{font-size:14px}
      #pw-tk-settings .r .h{font-size:12px;color:#999;margin-top:2px}
      #pw-tk-settings .sw{position:relative;width:40px;height:22px;flex-shrink:0}
      #pw-tk-settings .sw input{display:none}
      #pw-tk-settings .sw .sl{position:absolute;inset:0;background:#ccc;border-radius:22px;cursor:pointer;transition:background .2s}
      #pw-tk-settings .sw .sl::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:transform .2s}
      #pw-tk-settings .sw input:checked+.sl{background:#1a73e8}
      #pw-tk-settings .sw input:checked+.sl::before{transform:translateX(18px)}
      #pw-tk-settings .nm{width:52px;height:30px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:14px;outline:0}
      #pw-tk-settings .nm:focus{border-color:#1a73e8}
      #pw-tk-settings .ft{margin-top:18px;text-align:right}
      #pw-tk-settings .ft button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}
      #pw-tk-settings .ft button:hover{background:#1557b0}
    `;
    document.head.appendChild(s);
  }

  /* ── Toast ── */
  let _t;
  function toast(m) {
    if (!_t) { _t = document.createElement('div'); _t.className = 'pw-tk-toast'; document.body.appendChild(_t); }
    _t.textContent = m; _t.classList.add('show');
    clearTimeout(_t._x); _t._x = setTimeout(() => _t.classList.remove('show'), 1500);
  }

  /* ── 设置弹窗 ── */
  function openSettings() {
    closeSettings(); // 先关闭已有的
    const c = cfg();

    const el = document.createElement('div');
    el.id = 'pw-tk-settings';
    el.innerHTML = `<div>
      <h3>🔐 密码工具设置</h3>
      <div class="r"><div><label>启用脚本</label><div class="h">关闭后密码框不再显示按钮</div></div><label class="sw"><input type="checkbox" id="s-on" ${c.enabled?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>始终显示密码</label><div class="h">密码直接明文，去掉眼睛按钮</div></div><label class="sw"><input type="checkbox" id="s-al" ${c.alwaysShow?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>加密显示</label><div class="h">显示时混淆，复制时获取真实密码</div></div><label class="sw"><input type="checkbox" id="s-en" ${c.encrypt?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>字母偏移</label><div class="h">A→? 偏移量 (0-25)</div></div><input type="number" class="nm" id="s-ls" min="0" max="25" value="${c.letterShift}"></div>
      <div class="r"><div><label>数字偏移</label><div class="h">0→? 偏移量 (0-9)</div></div><input type="number" class="nm" id="s-ds" min="0" max="9" value="${c.digitShift}"></div>
      <div class="r"><div><label>预览</label><div class="h" id="s-pre"></div></div></div>
      <div class="ft"><button id="s-ok">保存</button></div>
    </div>`;
    document.body.appendChild(el);

    // 预览
    const pre = el.querySelector('#s-pre');
    const upd = () => { pre.textContent = `MyP@ss123 → ${enc('MyP@ss123', { letterShift: +el.querySelector('#s-ls').value||0, digitShift: +el.querySelector('#s-ds').value||0 })}`; };
    upd();
    el.querySelector('#s-ls').addEventListener('input', upd);
    el.querySelector('#s-ds').addEventListener('input', upd);

    // 关闭
    el.addEventListener('click', e => { if (e.target === el) closeSettings(); });

    // 保存
    el.querySelector('#s-ok').addEventListener('click', () => {
      save({
        enabled:    el.querySelector('#s-on').checked,
        encrypt:    el.querySelector('#s-en').checked,
        alwaysShow: el.querySelector('#s-al').checked,
        letterShift: Math.max(0, Math.min(25, +el.querySelector('#s-ls').value||0)),
        digitShift:  Math.max(0, Math.min(9, +el.querySelector('#s-ds').value||0)),
      });
      closeSettings();
      toast('✅ 设置已保存');
    });
  }

  function closeSettings() {
    const el = document.getElementById('pw-tk-settings');
    if (el) el.remove();
  }

  /* ── 增强密码框 ── */
  function enhance(input) {
    if (input.dataset.pwTk) return;
    input.dataset.pwTk = '1';
    const w = input.closest('div,span,td,li,label,form,p') || input.parentNode;
    if (!w || w.querySelector('.pw-tk')) return;

    const c = cfg();
    const box = document.createElement('span');
    box.className = 'pw-tk';

    // 始终显示模式
    if (c.alwaysShow) input.type = 'text';

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

    // 复制按钮
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

  /* ── 扫描 ── */
  function scan() {
    if (!cfg().enabled) return;
    document.querySelectorAll('input[type="password"],input[name*="pass"],input[name*="pwd"],input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(enhance);
  }

  let _st;
  new MutationObserver(() => { clearTimeout(_st); _st = setTimeout(scan, 300); }).observe(document.documentElement, { childList: true, subtree: true });

  /* ── 启动 ── */
  injectCSS();
  GM_registerMenuCommand('打开设置', openSettings);
  if (cfg().enabled) scan();
})();
