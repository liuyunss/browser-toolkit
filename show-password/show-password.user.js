// ==UserScript==
// @name         🔐 密码显示与复制
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      3.0.0
// @description  在所有网站的密码输入框旁添加显示/隐藏密码和复制密码按钮，支持鼠标悬停预览
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

/**
 * v3.0.0 Changes:
 * - Fixed: buttons use inline-flex layout (no more absolute positioning)
 * - Fixed: no longer forces position:relative on parent elements
 * - New: mouse hover preview — hover over input to temporarily show plaintext
 * - Improved: clipboard fallback chain (GM_setClipboard → navigator.clipboard → execCommand)
 * - Improved: MutationObserver pause mechanism to prevent injection loops
 * - Improved: dataset flag set AFTER success (allows retry on failure)
 */
(function () {
  'use strict';

  /* ── Config ── */
  const D = { enabled: true, alwaysShow: false, hideEye: false, hoverPreview: true };
  const cfg = () => ({
    enabled: GM_getValue('pw_enabled', D.enabled),
    alwaysShow: GM_getValue('pw_alwaysShow', D.alwaysShow),
    hideEye: GM_getValue('pw_hideEye', D.hideEye),
    hoverPreview: GM_getValue('pw_hoverPreview', D.hoverPreview),
  });
  const saveCfg = c => { for (const [k, v] of Object.entries(c)) GM_setValue('pw_' + k, v); };

  /* ── SVG icons ── */
  const SVG = {
    eye:  `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    hide: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  };

  /* ── Styles — inline-flex, no absolute positioning ── */
  function injectCSS() {
    if (document.getElementById('pw-tk-css')) return;
    const s = document.createElement('style');
    s.id = 'pw-tk-css';
    s.textContent = `
      .pw-tk{display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle}
      .pw-tk-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:4px;background:transparent;cursor:pointer;padding:0;transition:background .15s;flex-shrink:0}
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

  /* ── Clipboard with fallback chain ── */
  function copyToClipboard(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return;
    }
    navigator.clipboard.writeText(text).catch(() => {
      // Final fallback: textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  /* ── Settings panel (Shadow DOM) ── */
  let _so = false;
  function openSettings() {
    if (_so) return; _so = true;
    const c = cfg(), host = document.createElement('div');
    host.id = 'pw-tk-settings-host';
    host.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;';
    const sh = host.attachShadow({ mode: 'closed' });
    sh.innerHTML = `<style>*{box-sizing:border-box;margin:0;padding:0}.m{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}.p{background:#fff;border-radius:12px;padding:24px;width:360px;box-shadow:0 8px 32px rgba(0,0,0,.2)}h3{margin:0 0 16px;font-size:16px;font-weight:600}.r{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.r label{font-size:14px}.h{font-size:12px;color:#999;margin-top:2px}.sw{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;display:block}.sw input{display:none}.sw .sl{position:absolute;inset:0;background:#ccc;border-radius:22px;transition:background .2s}.sw .sl::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:left .2s}.sw input:checked+.sl{background:#1a73e8}.sw input:checked+.sl::before{left:20px}.ft{margin-top:18px;text-align:right}.ft button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}.ft button:hover{background:#1557b0}</style>
    <div class="m"><div class="p">
      <h3>🔐 密码工具设置</h3>
      <div class="r"><div><label>启用脚本</label><div class="h">关闭后密码框不再显示按钮</div></div><label class="sw"><input type="checkbox" id="s-on" ${c.enabled?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>始终显示密码</label><div class="h">密码直接明文显示，隐藏眼睛按钮</div></div><label class="sw"><input type="checkbox" id="s-al" ${c.alwaysShow?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>关闭眼睛</label><div class="h">隐藏眼睛按钮，密码保持圆点，仅复制</div></div><label class="sw"><input type="checkbox" id="s-he" ${c.hideEye?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>鼠标悬停预览</label><div class="h">鼠标移入密码框时临时显示明文</div></div><label class="sw"><input type="checkbox" id="s-hp" ${c.hoverPreview?'checked':''}><span class="sl"></span></label></div>
      <div class="ft"><button id="s-rst" style="background:#666;margin-right:8px">重置默认</button><button id="s-ok">保存</button></div>
    </div></div>`;
    sh.querySelector('.m').addEventListener('click', e => { if (e.target.classList.contains('m')) closeSettings(); });
    sh.getElementById('s-ok').addEventListener('click', e => {
      e.stopPropagation();
      saveCfg({
        enabled: sh.getElementById('s-on').checked,
        alwaysShow: sh.getElementById('s-al').checked,
        hideEye: sh.getElementById('s-he').checked,
        hoverPreview: sh.getElementById('s-hp').checked,
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

  /* ── Main logic ── */
  let _obsPaused = false;

  function enhance(input) {
    if (input.dataset.pwTk) return;
    const c = cfg();

    // Build button container — inline-flex, no absolute positioning
    const box = document.createElement('span');
    box.className = 'pw-tk';

    let manuallyVisible = false; // track manual toggle state for hover

    // --- Eye toggle (default mode only) ---
    if (!c.alwaysShow && !c.hideEye) {
      let vis = false;
      const tog = document.createElement('button');
      tog.type = 'button'; tog.className = 'pw-tk-btn'; tog.title = '显示/隐藏密码'; tog.innerHTML = SVG.eye;
      tog.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        vis = !vis; manuallyVisible = vis;
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

    // --- Copy button ---
    const cp = document.createElement('button');
    cp.type = 'button'; cp.className = 'pw-tk-btn'; cp.title = '复制密码'; cp.innerHTML = SVG.copy;
    cp.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const val = input.value;
      if (!val) { toast('⚠️ 输入框为空'); return; }
      copyToClipboard(val);
      toast('✅ 密码已复制');
    });
    box.appendChild(cp);

    // --- Always show mode ---
    if (c.alwaysShow) {
      input.type = 'text';
    }

    // --- Hover preview ---
    if (c.hoverPreview && !c.alwaysShow) {
      let hoverVisible = false;
      input.addEventListener('mouseenter', () => {
        if (manuallyVisible) return; // don't interfere with manual toggle
        hoverVisible = true;
        input.type = 'text';
      });
      input.addEventListener('mouseleave', () => {
        if (!hoverVisible) return;
        if (manuallyVisible) return; // manual toggle is active, don't revert
        hoverVisible = false;
        input.type = 'password';
      });
    }

    // --- Insert as sibling, not inside wrapper (no forced position:relative) ---
    // This avoids breaking layouts that depend on static positioning
    try {
      _obsPaused = true;
      if (input.nextSibling) {
        input.parentNode.insertBefore(box, input.nextSibling);
      } else {
        input.parentNode.appendChild(box);
      }
    } finally {
      _obsPaused = false;
    }

    // Mark processed ONLY after successful DOM insertion
    input.dataset.pwTk = '1';
  }

  /* ── Scan with extended selectors ── */
  function scan() {
    if (!cfg().enabled || _obsPaused) return;
    try {
      document.querySelectorAll([
        'input[type="password"]',
        'input[name*="pass"]',
        'input[name*="pwd"]',
        'input[autocomplete="current-password"]',
        'input[autocomplete="new-password"]',
        'input[aria-label*="密码"]',
        'input[placeholder*="密码"]',
        'input[placeholder*="password" i]',
        'input[id*="pass"]',
      ].join(',')).forEach(enhance);
    } catch (_) {}
  }

  /* ── MutationObserver with pause mechanism ── */
  let _st;
  new MutationObserver(() => {
    if (_obsPaused) return;
    clearTimeout(_st);
    _st = setTimeout(scan, 300);
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ── Init ── */
  injectCSS(); scan();
})();
