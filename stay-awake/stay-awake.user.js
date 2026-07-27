// ==UserScript==
// @name         🔒 StayAwake - 页面保活
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.1.1
// @description  防止网页因闲置超时退出登录，支持指定网站生效，自动识别当前域名
// @author       liuyunss
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/assets/icon-128.png
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/stay-awake/stay-awake.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/stay-awake/stay-awake.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const D = { enabled: true, idle: 5, interval: 5, strategy: 'both', sites: '' };
  const cfg = () => ({
    enabled:  GM_getValue('sa_enabled',  D.enabled),
    idle:     GM_getValue('sa_idle',     D.idle),
    interval: GM_getValue('sa_interval', D.interval),
    strategy: GM_getValue('sa_strategy', D.strategy),
    sites:    GM_getValue('sa_sites',    D.sites),
  });
  const saveCfg = c => { for (const [k, v] of Object.entries(c)) GM_setValue('sa_' + k, v); };

  /* ── 当前站点检查 ── */
  function shouldRun() {
    const c = cfg();
    if (!c.enabled) return false;
    const list = c.sites.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) return true;
    const h = location.hostname;
    return list.some(s => h === s || h.endsWith('.' + s) || (s.includes('*') && h.match(new RegExp('^' + s.replace(/\*/g, '.*') + '$'))));
  }

  /* ── 状态 ── */
  let lastActive = Date.now();
  let timer = null;
  let alive = false;

  /* ── 活动追踪 ── */
  const touch = () => { lastActive = Date.now(); };
  document.addEventListener('mousemove', touch, { passive: true });
  document.addEventListener('keydown', touch, { passive: true });
  document.addEventListener('click', touch, { passive: true });
  document.addEventListener('scroll', touch, { passive: true });

  /* ── 模拟事件 ── */
  function fakeEvent(type, props) {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'isTrusted', { get: () => true });
    Object.assign(e, props);
    return e;
  }

  function simulateMouse() {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    document.dispatchEvent(fakeEvent('mousemove', { clientX: x, clientY: y, screenX: x, screenY: y }));
  }

  function simulateKey() {
    const keys = [16, 17, 18];
    const key = keys[Math.floor(Math.random() * keys.length)];
    const e = new KeyboardEvent('keydown', { key: ['', 'Shift', 'Control', 'Alt'][key], keyCode: key, which: key, bubbles: true });
    Object.defineProperty(e, 'isTrusted', { get: () => true });
    document.dispatchEvent(e);
  }

  function kick() {
    const c = cfg();
    if (c.strategy === 'mouse' || c.strategy === 'both') simulateMouse();
    if (c.strategy === 'key' || c.strategy === 'both') simulateKey();
    updateIndicator();
  }

  /* ── 状态指示器 ── */
  let indicator = null;
  function createIndicator() {
    indicator = document.createElement('div');
    indicator.id = 'sa-indicator';
    indicator.style.cssText = 'position:fixed;bottom:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#ccc;z-index:999999;transition:background .3s;pointer-events:none;';
    document.body.appendChild(indicator);
  }

  function updateIndicator() {
    if (!indicator) return;
    const c = cfg();
    const idleMs = c.idle * 60000;
    const isIdle = (Date.now() - lastActive) >= idleMs;
    indicator.style.background = isIdle ? '#4caf50' : '#ccc';
    indicator.title = isIdle ? `StayAwake: 保活中 (每${c.interval}分钟)` : 'StayAwake: 等待闲置';
  }

  /* ── 主循环 ── */
  function tick() {
    const c = cfg();
    const idleMs = c.idle * 60000;
    if ((Date.now() - lastActive) >= idleMs) {
      if (!alive) { alive = true; }
      kick();
    } else {
      alive = false;
      updateIndicator();
    }
  }

  function start() {
    if (timer) return;
    createIndicator();
    const c = cfg();
    timer = setInterval(tick, c.interval * 60000);
    tick();
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    alive = false;
    if (indicator) { indicator.remove(); indicator = null; }
  }

  /* ── 油猴菜单（始终注册） ── */
  let _menuOn = true;
  function refreshMenu() {
    if (_menuOn) GM_registerMenuCommand('⏸ 暂停保活', () => { stop(); _menuOn = false; refreshMenu(); });
    else GM_registerMenuCommand('▶️ 恢复保活', () => { _menuOn = true; start(); refreshMenu(); });
    GM_registerMenuCommand('⚙️ 打开设置', openSettings);
  }

  /* ── 设置弹窗 ── */
  let _so = false;
  function openSettings() {
    if (_so) return; _so = true;
    const c = cfg();
    const currentDomain = location.hostname.replace(/^www\./, '');
    const siteList = c.sites.split(',').map(s => s.trim()).filter(Boolean);
    const isCurrentInList = siteList.some(s => currentDomain === s || currentDomain.endsWith('.' + s));

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;';
    const sh = host.attachShadow({ mode: 'closed' });
    sh.innerHTML = `<style>*{box-sizing:border-box;margin:0;padding:0}.m{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}.p{background:#fff;border-radius:12px;padding:24px;width:400px;box-shadow:0 8px 32px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto}h3{margin:0 0 16px;font-size:16px;font-weight:600}.r{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.r>div:first-child{flex:1;margin-right:12px}.r label{font-size:14px}.h{font-size:12px;color:#999;margin-top:2px}.sw{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;display:block}.sw input{display:none}.sw .sl{position:absolute;inset:0;background:#ccc;border-radius:22px;transition:background .2s}.sw .sl::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:left .2s}.sw input:checked+.sl{background:#1a73e8}.sw input:checked+.sl::before{left:20px}.nm{width:60px;height:30px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:14px;outline:0}.nm:focus{border-color:#1a73e8}select{height:30px;border:1px solid #ddd;border-radius:6px;padding:0 8px;font-size:14px;outline:0;background:#fff}select:focus{border-color:#1a73e8}.cur{background:#f0f7ff;border:1px solid #d0e3f7;border-radius:8px;padding:12px;margin-bottom:14px}.cur .cl{font-size:13px;color:#555;margin-bottom:6px}.cur .cd{font-size:14px;font-weight:600;color:#1a73e8;word-break:break-all}.cur .ab{margin-top:8px;display:flex;gap:8px}.cur .ab button{padding:4px 12px;border:none;border-radius:4px;font-size:12px;cursor:pointer;transition:background .15s}.cur .ab .add{background:#e8f5e9;color:#2e7d32}.cur .ab .add:hover{background:#c8e6c9}.cur .ab .rm{background:#ffebee;color:#c62828}.cur .ab .rm:hover{background:#ffcdd2}.cur .ab .dis{background:#f5f5f5;color:#999;cursor:default}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;min-height:28px}.tag{display:inline-flex;align-items:center;background:#e3f2fd;color:#1565c0;padding:3px 8px;border-radius:4px;font-size:12px;gap:4px}.tag .tx{cursor:pointer;font-size:14px;line-height:1;color:#999;transition:color .15s}.tag .tx:hover{color:#c62828}.ft{margin-top:18px;text-align:right}.ft button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}.ft button:hover{background:#1557b0}</style>
    <div class="m"><div class="p">
      <h3>🔒 StayAwake 设置</h3>
      <div class="r"><div><label>启用保活</label><div class="h">关闭后停止所有保活操作</div></div><label class="sw"><input type="checkbox" id="s-on" ${c.enabled?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>闲置时间（分钟）</label><div class="h">用户无操作多久后开始保活</div></div><input type="number" class="nm" id="s-idle" min="1" max="60" value="${c.idle}"></div>
      <div class="r"><div><label>保活间隔（分钟）</label><div class="h">每次保活操作的间隔</div></div><input type="number" class="nm" id="s-int" min="1" max="30" value="${c.interval}"></div>
      <div class="r"><div><label>模拟策略</label><div class="h">选择模拟的事件类型</div></div><select id="s-str"><option value="both" ${c.strategy==='both'?'selected':''}>鼠标+键盘</option><option value="mouse" ${c.strategy==='mouse'?'selected':''}>仅鼠标</option><option value="key" ${c.strategy==='key'?'selected':''}>仅键盘</option></select></div>
      <div class="cur">
        <div class="cl">当前页面</div>
        <div class="cd">${currentDomain}</div>
        <div class="ab">
          <button class="add" id="s-addcur">${isCurrentInList ? '✓ 已添加' : '+ 加入白名单'}</button>
          ${isCurrentInList ? '<button class="rm" id="s-rmcur">移除</button>' : ''}
        </div>
      </div>
      <div class="r" style="flex-direction:column;align-items:stretch">
        <div style="margin-bottom:4px"><label>生效网站</label><div class="h">留空 = 所有站生效。支持通配符如 *.example.com</div></div>
        <div class="tags" id="s-tags"></div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input type="text" id="s-new" placeholder="输入域名，回车添加" style="flex:1;height:30px;border:1px solid #ddd;border-radius:6px;padding:0 8px;font-size:13px;outline:0">
        </div>
      </div>
      <div class="ft"><button id="s-rst" style="background:#666;margin-right:8px">清空站点</button><button id="s-ok">保存</button></div>
    </div></div>`;

    /* ── 标签渲染 ── */
    const tagsEl = sh.getElementById('s-tags');
    const newInput = sh.getElementById('s-new');
    let sites = [...siteList];

    function renderTags() {
      tagsEl.innerHTML = sites.map((s, i) => `<span class="tag">${s}<span class="tx" data-i="${i}">×</span></span>`).join('');
      tagsEl.querySelectorAll('.tx').forEach(el => {
        el.addEventListener('click', () => {
          sites.splice(+el.dataset.i, 1);
          renderTags();
          updateAddBtn();
        });
      });
    }

    function updateAddBtn() {
      const inList = sites.some(s => currentDomain === s || currentDomain.endsWith('.' + s));
      const addBtn = sh.getElementById('s-addcur');
      const rmBtn = sh.getElementById('s-rmcur');
      if (addBtn) {
        addBtn.textContent = inList ? '✓ 已添加' : '+ 加入白名单';
        addBtn.className = inList ? 'dis' : 'add';
      }
      if (rmBtn) rmBtn.style.display = inList ? '' : 'none';
    }

    renderTags();

    /* ── 当前域名操作 ── */
    const addBtn = sh.getElementById('s-addcur');
    if (addBtn) addBtn.addEventListener('click', () => {
      if (!sites.includes(currentDomain)) {
        sites.push(currentDomain);
        renderTags();
        updateAddBtn();
      }
    });
    const rmBtn = sh.getElementById('s-rmcur');
    if (rmBtn) rmBtn.addEventListener('click', () => {
      sites = sites.filter(s => s !== currentDomain);
      renderTags();
      updateAddBtn();
    });

    /* ── 手动输入域名 ── */
    newInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = newInput.value.trim();
        if (v && !sites.includes(v)) {
          sites.push(v);
          renderTags();
          updateAddBtn();
          newInput.value = '';
        }
      }
    });

    /* ── 保存 ── */
    sh.querySelector('.m').addEventListener('click', e => { if (e.target.classList.contains('m')) closeSettings(); });
    sh.getElementById('s-ok').addEventListener('click', e => {
      e.stopPropagation();
      saveCfg({
        enabled:  sh.getElementById('s-on').checked,
        idle:     Math.max(1, Math.min(60, +sh.getElementById('s-idle').value || 5)),
        interval: Math.max(1, Math.min(30, +sh.getElementById('s-int').value || 5)),
        strategy: sh.getElementById('s-str').value,
        sites:    sites.join(', '),
      });
      closeSettings();
      location.reload();
    });
    sh.getElementById('s-rst').addEventListener('click', e => {
      e.stopPropagation();
      sites = [];
      renderTags();
      updateAddBtn();
    });
    document.body.appendChild(host);
  }
  function closeSettings() { const e = document.querySelector('[style*="z-index:999998"]'); if (e) e.remove(); _so = false; }

  refreshMenu();

  /* ── 保活功能（独立于设置 UI） ── */
  if (shouldRun()) {
    start();
  }
})();
