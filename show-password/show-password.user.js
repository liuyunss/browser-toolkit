// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      2.0.0
// @description  在所有网站的密码输入框旁添加显示/隐藏密码和复制密码按钮，支持常显明文或隐藏眼睛
// @author       liuyunss
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/show-password/assets/icon-128.png
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/show-password/show-password.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/show-password/show-password.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const D = { enabled: true, alwaysShow: false, hideEye: false };
  const cfg = () => ({
    enabled: GM_getValue('pw_enabled', D.enabled),
    alwaysShow: GM_getValue('pw_alwaysShow', D.alwaysShow),
    hideEye: GM_getValue('pw_hideEye', D.hideEye),
  });
  const saveCfg = c => { for (const [k, v] of Object.entries(c)) GM_setValue('pw_' + k, v); };

  const SVG = {
    eye:  `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    hide: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  };

  function injectCSS() {
    if (document.getElementById('pw-tk-css')) return;
    const s = document.createElement('style');
    s.id = 'pw-tk-css';
    s.textContent = `.pw-tk{position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:2;display:inline-flex;align-items:center;gap:2px;background:rgba(255,255,255,.9);border-radius:4px;padding:2px 4px;box-shadow:0 1px 3px rgba(0,0,0,.1)}.pw-tk-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:4px;background:0 0;cursor:pointer;padding:0;transition:background .15s;flex-shrink:0}.pw-tk-btn:hover{background:rgba(0,0,0,.08)}.pw-tk-btn svg{width:18px;height:18px;fill:none;stroke:#666;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.pw-tk-btn:hover svg{stroke:#333}.pw-tk-btn.on svg{stroke:#1a73e8}.pw-tk-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;z-index:999999;opacity:0;transition:opacity .2s;pointer-events:none}.pw-tk-toast.show{opacity:1}`;
    document.head.appendChild(s);
  }

  let _t;
  function toast(m) {
    if (!_t) { _t = document.createElement('div'); _t.className = 'pw-tk-toast'; document.body.appendChild(_t); }
    _t.textContent = m; _t.classList.add('show');
    clearTimeout(_t._x); _t._x = setTimeout(() => _t.classList.remove('show'), 1500);
  }

  let _so = false;
  function openSettings() {
    if (_so) return; _so = true;
    const c = cfg(), host = document.createElement('div');
    host.id = 'pw-tk-settings-host';
    host.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;';
    const sh = host.attachShadow({ mode: 'closed' });
    sh.innerHTML = `<style>*{box-sizing:border-box;margin:0;padding:0}.m{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}.p{background:#fff;border-radius:12px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.2)}h3{margin:0 0 16px;font-size:16px;font-weight:600}.r{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.r label{font-size:14px}.h{font-size:12px;color:#999;margin-top:2px}.sw{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;display:block}.sw input{display:none}.sw .sl{position:absolute;inset:0;background:#ccc;border-radius:22px;transition:background .2s}.sw .sl::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:left .2s}.sw input:checked+.sl{background:#1a73e8}.sw input:checked+.sl::before{left:20px}.ft{margin-top:18px;text-align:right}.ft button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}.ft button:hover{background:#1557b0}</style>
    <div class="m"><div class="p">
      <h3>🔐 密码工具设置</h3>
      <div class="r"><div><label>启用脚本</label><div class="h">关闭后密码框不再显示按钮</div></div><label class="sw"><input type="checkbox" id="s-on" ${c.enabled?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>始终显示密码</label><div class="h">密码直接明文显示，隐藏眼睛按钮</div></div><label class="sw"><input type="checkbox" id="s-al" ${c.alwaysShow?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>关闭眼睛</label><div class="h">隐藏眼睛按钮，密码保持圆点，仅复制</div></div><label class="sw"><input type="checkbox" id="s-he" ${c.hideEye?'checked':''}><span class="sl"></span></label></div>
      <div class="ft"><button id="s-rst" style="background:#666;margin-right:8px">重置默认</button><button id="s-ok">保存</button></div>
    </div></div>`;
    sh.querySelector('.m').addEventListener('click', e => { if (e.target.classList.contains('m')) closeSettings(); });
    sh.getElementById('s-ok').addEventListener('click', e => {
      e.stopPropagation();
      saveCfg({
        enabled: sh.getElementById('s-on').checked,
        alwaysShow: sh.getElementById('s-al').checked,
        hideEye: sh.getElementById('s-he').checked,
      });
      closeSettings(); toast('✅ 设置已保存');
    });
    sh.getElementById('s-rst').addEventListener('click', e => {
      e.stopPropagation();
      saveCfg(D);
      closeSettings(); toast('✅ 已重置为默认设置');
    });
    document.body.appendChild(host);
  }
  function closeSettings() { const e = document.getElementById('pw-tk-settings-host'); if (e) e.remove(); _so = false; }

  GM_registerMenuCommand('打开设置', openSettings);

  /* ---------- 主逻辑 ---------- */

  function enhance(input) {
    if (input.dataset.pwTk) return;
    const w = input.closest('div,span,td,li,label,p') || input.parentNode;
    if (!w || w.querySelector('.pw-tk')) return;
    if (getComputedStyle(w).position === 'static') w.style.position = 'relative';
    const c = cfg(), box = document.createElement('span');
    box.className = 'pw-tk';

    if (c.alwaysShow) {
      // 密码常显：明文 + 复制，无眼睛
      input.type = 'text';
    } else if (c.hideEye) {
      // 关闭眼睛：圆点 + 复制，无眼睛
    } else {
      // 默认：眼睛切换 + 复制
      let vis = false;
      const tog = document.createElement('button');
      tog.type = 'button'; tog.className = 'pw-tk-btn'; tog.title = '显示/隐藏密码'; tog.innerHTML = SVG.eye;
      tog.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        vis = !vis;
        if (vis) {
          input.type = 'text';
          tog.innerHTML = SVG.hide; tog.classList.add('on');
        } else {
          input.type = 'password';
          tog.innerHTML = SVG.eye; tog.classList.remove('on');
        }
      });
      box.appendChild(tog);
    }

    const cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'pw-tk-btn'; cp.title = '复制密码'; cp.innerHTML = SVG.copy;
    cp.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const val = input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      if (typeof GM_setClipboard === 'function') GM_setClipboard(val, 'text');
      else navigator.clipboard.writeText(val).catch(() => {});
      toast('✅ 密码已复制');
    });
    box.appendChild(cp);
    w.appendChild(box);
    input.dataset.pwTk = '1';
  }

  function scan() {
    if (!cfg().enabled) return;
    try {
      document.querySelectorAll('input[type="password"],input[name*="pass"],input[name*="pwd"],input[autocomplete="current-password"],input[autocomplete="new-password"],input[aria-label*="密码"],input[placeholder*="密码"],input[placeholder*="password" i],input[id*="pass"]').forEach(enhance);
    } catch (_) {}
  }
  let _st;
  new MutationObserver(() => { clearTimeout(_st); _st = setTimeout(scan, 500); }).observe(document.body, { childList: true, subtree: true });

  injectCSS(); scan();
})();
