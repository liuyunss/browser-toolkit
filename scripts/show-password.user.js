// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.5.1
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

  /* ── 配置 ── */
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

  /* ── Toast ── */
  let _t;
  function toast(m) {
    if (!_t) { _t = document.createElement('div'); _t.className = 'pw-tk-toast'; document.body.appendChild(_t); }
    _t.textContent = m; _t.classList.add('show');
    clearTimeout(_t._x); _t._x = setTimeout(() => _t.classList.remove('show'), 1500);
  }

  /* ── MutationObserver 控制 ── */
  let _obs;
  let _obsPaused = false;
  function startObserver() {
    _obs = new MutationObserver(() => {
      if (_obsPaused) return;
      clearTimeout(_st); _st = setTimeout(scan, 300);
    });
    _obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ── 设置弹窗（纯 DOM 构建，不用 innerHTML）─── */
  function openSettings() {
    closeSettings();
    _obsPaused = true; // 暂停 Observer
    const c = cfg();

    // 遮罩
    const mask = document.createElement('div');
    mask.id = 'pw-tk-settings';
    Object.assign(mask.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.35)', zIndex: '999998',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    // 面板
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: '#fff', borderRadius: '12px', padding: '24px', width: '340px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      font: '14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      color: '#333',
    });

    const h3 = document.createElement('h3');
    h3.textContent = '🔐 密码工具设置';
    h3.style.margin = '0 0 16px';
    h3.style.fontSize = '16px';
    h3.style.fontWeight = '600';
    panel.appendChild(h3);

    // 开关行
    function addToggle(label, hint, checked, onChange) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' });
      const left = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.textContent = label; lbl.style.fontSize = '14px';
      const h = document.createElement('div');
      h.textContent = hint; h.style.cssText = 'font-size:12px;color:#999;margin-top:2px';
      left.append(lbl, h);
      // 开关
      const sw = document.createElement('label');
      Object.assign(sw.style, { position: 'relative', width: '40px', height: '22px', flexShrink: '0', display: 'block' });
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.checked = checked;
      inp.style.display = 'none';
      inp.addEventListener('change', onChange);
      const sl = document.createElement('span');
      Object.assign(sl.style, { position: 'absolute', inset: '0', background: checked ? '#1a73e8' : '#ccc', borderRadius: '22px', cursor: 'pointer', transition: 'background .2s' });
      const dot = document.createElement('span');
      Object.assign(dot.style, { position: 'absolute', width: '18px', height: '18px', left: checked ? '20px' : '2px', top: '2px', background: '#fff', borderRadius: '50%', transition: 'transform .2s' });
      inp.addEventListener('change', () => {
        sl.style.background = inp.checked ? '#1a73e8' : '#ccc';
        dot.style.left = inp.checked ? '20px' : '2px';
      });
      sl.append(dot);
      sw.append(inp, sl);
      row.append(left, sw);
      panel.appendChild(row);
      return inp;
    }

    const inpOn = addToggle('启用脚本', '关闭后密码框不再显示按钮', c.enabled, () => {});
    const inpAl = addToggle('始终显示密码', '密码直接明文，去掉眼睛按钮', c.alwaysShow, () => {});
    const inpEn = addToggle('加密显示', '显示时混淆，复制时获取真实密码', c.encrypt, () => {});

    // 数字输入行
    function addNumber(label, hint, min, max, val) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' });
      const left = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.textContent = label; lbl.style.fontSize = '14px';
      const h = document.createElement('div');
      h.textContent = hint; h.style.cssText = 'font-size:12px;color:#999;margin-top:2px';
      left.append(lbl, h);
      const num = document.createElement('input');
      num.type = 'number'; num.min = min; num.max = max; num.value = val;
      num.style.cssText = 'width:52px;height:30px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:14px;outline:0';
      row.append(left, num);
      panel.appendChild(row);
      return num;
    }

    const inpLs = addNumber('字母偏移', 'A→? 偏移量 (0-25)', 0, 25, c.letterShift);
    const inpDs = addNumber('数字偏移', '0→? 偏移量 (0-9)', 0, 9, c.digitShift);

    // 预览
    const preRow = document.createElement('div');
    Object.assign(preRow.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' });
    const preLeft = document.createElement('div');
    const preLbl = document.createElement('label');
    preLbl.textContent = '预览'; preLbl.style.fontSize = '14px';
    const preHint = document.createElement('div');
    preHint.style.cssText = 'font-size:12px;color:#999;margin-top:2px';
    preLeft.append(preLbl, preHint);
    preRow.appendChild(preLeft);
    panel.appendChild(preRow);

    function updPreview() {
      preHint.textContent = `MyP@ss123 → ${enc('MyP@ss123', { letterShift: +inpLs.value || 0, digitShift: +inpDs.value || 0 })}`;
    }
    updPreview();
    inpLs.addEventListener('input', updPreview);
    inpDs.addEventListener('input', updPreview);

    // 保存按钮
    const foot = document.createElement('div');
    foot.style.cssText = 'margin-top:18px;text-align:right';
    const btn = document.createElement('button');
    btn.textContent = '保存';
    btn.style.cssText = 'padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff';
    btn.addEventListener('click', () => {
      saveCfg({
        enabled: inpOn.checked, encrypt: inpEn.checked, alwaysShow: inpAl.checked,
        letterShift: Math.max(0, Math.min(25, +inpLs.value || 0)),
        digitShift: Math.max(0, Math.min(9, +inpDs.value || 0)),
      });
      closeSettings();
      toast('✅ 设置已保存');
    });
    foot.appendChild(btn);
    panel.appendChild(foot);

    mask.appendChild(panel);
    mask.addEventListener('click', e => { if (e.target === mask) closeSettings(); });
    document.body.appendChild(mask);
  }

  function closeSettings() {
    const el = document.getElementById('pw-tk-settings');
    if (el) el.remove();
    _obsPaused = false; // 恢复 Observer
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

  /* ── 扫描 ── */
  function scan() {
    if (!cfg().enabled) return;
    document.querySelectorAll('input[type="password"],input[name*="pass"],input[name*="pwd"],input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(enhance);
  }

  let _st;

  /* ── 启动 ── */
  injectCSS();
  GM_registerMenuCommand('打开设置', openSettings);
  startObserver();
  if (cfg().enabled) scan();
})();
