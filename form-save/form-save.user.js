// ==UserScript==
// @name         💾 FormSave - 表单自动保存
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.0.0
// @description  自动保存表单内容，刷新后一键恢复，防止填写丢失
// @author       liuyunss
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/form-save/form-save.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/form-save/form-save.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  /* ═══════════════════════════════════════════
     一、配置
     ═══════════════════════════════════════════ */

  const D = {
    enabled: true,
    siteLimit: 50,       // KB per site
    totalLimit: 5000,    // KB total
    retentionDays: 7,
    restoreDelay: 100,   // ms between fields
    excludeCustom: '',   // user-added exclusions
  };
  const cfg = () => ({
    enabled:       GM_getValue('fs_enabled', D.enabled),
    siteLimit:     GM_getValue('fs_siteLimit', D.siteLimit),
    totalLimit:    GM_getValue('fs_totalLimit', D.totalLimit),
    retentionDays: GM_getValue('fs_retentionDays', D.retentionDays),
    restoreDelay:  GM_getValue('fs_restoreDelay', D.restoreDelay),
    excludeCustom: GM_getValue('fs_excludeCustom', D.excludeCustom),
  });
  const saveCfg = c => { for (const [k, v] of Object.entries(c)) GM_setValue('fs_' + k, v); };

  /* ═══════════════════════════════════════════
     二、URL 归一化 & 别名
     ═══════════════════════════════════════════ */

  function normalizeURL(url) {
    try {
      const u = new URL(url, location.href);
      u.protocol = 'https:';
      u.hash = '';
      // 参数排序
      const params = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      u.search = params.length ? '?' + params.map(p => p[0] + '=' + p[1]).join('&') : '';
      // 去尾部斜杠
      let path = u.pathname;
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
      u.pathname = path;
      return u.origin + u.pathname + u.search;
    } catch { return url; }
  }

  function getAlias(url) {
    const map = GM_getValue('fs_url_map', {});
    const norm = normalizeURL(url);
    for (const [alias, stored] of Object.entries(map)) {
      if (normalizeURL(stored) === norm) return alias;
    }
    // 新建别名
    const alias = Math.random().toString(36).slice(2, 6);
    map[alias] = norm;
    GM_setValue('fs_url_map', map);
    return alias;
  }

  function getDomain() { return location.hostname.replace(/^www\./, ''); }

  /* ═══════════════════════════════════════════
     三、字典加载
     ═══════════════════════════════════════════ */

  const DICT_BASE = 'https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/dict';

  function fetchDict(file) {
    return new Promise(resolve => {
      const cached = GM_getValue('fs_dict_' + file);
      const cachedTime = GM_getValue('fs_dict_' + file + '_time', 0);
      const dayMs = 86400000;
      if (cached && Date.now() - cachedTime < dayMs) { resolve(cached); return; }
      GM_xmlhttpRequest({
        method: 'GET', url: DICT_BASE + '/' + file,
        onload: r => {
          const text = r.status === 200 ? r.responseText : (cached || '');
          GM_setValue('fs_dict_' + file, text);
          GM_setValue('fs_dict_' + file + '_time', Date.now());
          resolve(text);
        },
        onerror: () => resolve(cached || ''),
      });
    });
  }

  function parseDict(text) {
    return text.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => l.replace(/\*\.?/g, ''));
  }

  async function isExcluded() {
    if (!cfg().enabled) return true;
    const domain = getDomain();
    // 用户自定义排除
    const custom = cfg().excludeCustom.split(',').map(s => s.trim()).filter(Boolean);
    if (custom.some(d => domain === d || domain.endsWith('.' + d))) return true;
    // 字典排除
    const [sensitive, autosave] = await Promise.all([fetchDict('sensitive-sites.txt'), fetchDict('autosave-sites.txt')]);
    const all = [...parseDict(sensitive), ...parseDict(autosave)];
    return all.some(d => domain === d || domain.endsWith('.' + d));
  }

  /* ═══════════════════════════════════════════
     四、字段识别
     ═══════════════════════════════════════════ */

  function identifyField(el) {
    if (el.id) return { type: 'id', key: el.id };
    if (el.name) return { type: 'name', key: el.name };
    // CSS 选择器路径
    const path = [];
    let node = el;
    while (node && node !== document.body) {
      let seg = node.tagName.toLowerCase();
      if (node.id) { seg = '#' + node.id; path.unshift(seg); break; }
      if (node.className && typeof node.className === 'string') {
        const cls = node.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) seg += '.' + cls;
      } else {
        const parent = node.parentElement;
        if (parent) {
          const idx = [...parent.children].indexOf(node) + 1;
          seg += ':nth-child(' + idx + ')';
        }
      }
      path.unshift(seg);
      node = node.parentElement;
    }
    return { type: 'css', key: path.join(' > ') };
  }

  function getFormFingerprint(form) {
    const fields = [...form.querySelectorAll('input, textarea, select')].filter(isSaveable);
    return fields.map(f => identifyField(f).key).join('|');
  }

  function isSaveable(el) {
    const t = el.type;
    if (t === 'password' || t === 'file' || t === 'hidden') return false;
    if (el.autocomplete === 'cc-number' || el.autocomplete === 'cc-exp' || el.autocomplete === 'cc-csc') return false;
    if (t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return false;
    return true;
  }

  /* ═══════════════════════════════════════════
     五、保存逻辑
     ═══════════════════════════════════════════ */

  function collectFormData(form) {
    const data = {};
    const fields = [...form.querySelectorAll('input, textarea, select')].filter(isSaveable);
    for (const f of fields) {
      const id = identifyField(f);
      if (f.tagName === 'SELECT') {
        data[id.key] = { tag: 'select', value: f.value, id };
      } else if (f.type === 'checkbox' || f.type === 'radio') {
        data[id.key] = { tag: f.type, checked: f.checked, value: f.value, id };
      } else {
        data[id.key] = { tag: f.tagName.toLowerCase(), type: f.type, value: f.value, id };
      }
    }
    return data;
  }

  function saveForm(form, fingerprint) {
    const domain = getDomain();
    const alias = getAlias(location.href);
    const key = 'fs_' + alias + '_' + fingerprint.slice(0, 16);
    const data = { form: collectFormData(form), time: Date.now(), url: location.href };
    GM_setValue(key, JSON.stringify(data));
    enforceLimits(domain);
    updateIndicators();
  }

  function enforceLimits(domain) {
    const allKeys = GM_listValues().filter(k => k.startsWith('fs_') && k !== 'fs_url_map' && !k.startsWith('fs_dict_') && !k.startsWith('fs_'));
    // 检查总量
    let totalSize = 0;
    const items = [];
    for (const k of allKeys) {
      const v = GM_getValue(k, '');
      const size = typeof v === 'string' ? v.length * 2 : 0;
      totalSize += size;
      items.push({ key: k, size, time: JSON.parse(v || '{}').time || 0 });
    }
    const totalLimit = cfg().totalLimit * 1024;
    if (totalSize > totalLimit) {
      items.sort((a, b) => a.time - b.time);
      while (totalSize > totalLimit && items.length) {
        const oldest = items.shift();
        totalSize -= oldest.size;
        GM_removeValue(oldest.key);
      }
    }
    // 清理过期数据
    const cutoff = Date.now() - cfg().retentionDays * 86400000;
    for (const item of items) {
      if (item.time < cutoff) GM_removeValue(item.key);
    }
    // 清理孤立 url_map
    cleanUrlMap(allKeys);
  }

  function cleanUrlMap(activeKeys) {
    const map = GM_getValue('fs_url_map', {});
    const activeAliases = new Set(Object.keys(map).filter(alias => activeKeys.some(k => k.startsWith('fs_' + alias + '_'))));
    let changed = false;
    for (const alias of Object.keys(map)) {
      if (!activeAliases.has(alias)) { delete map[alias]; changed = true; }
    }
    if (changed) GM_setValue('fs_url_map', map);
  }

  /* ═══════════════════════════════════════════
     六、恢复逻辑
     ═══════════════════════════════════════════ */

  function restoreFormData(form, data) {
    const fields = [...form.querySelectorAll('input, textarea, select')].filter(isSaveable);
    const hasSelect = fields.some(f => f.tagName === 'SELECT');
    const restoreOrder = fields.map((f, i) => ({ field: f, index: i }));

    if (hasSelect) {
      // 有下拉框，顺序恢复带延迟
      restoreSequential(restoreOrder, data, cfg().restoreDelay);
    } else {
      // 无下拉框，一次性恢复
      for (const { field } of restoreOrder) {
        fillField(field, data);
      }
    }
  }

  function restoreSequential(fields, data, delay) {
    let i = 0;
    function next() {
      if (i >= fields.length) return;
      fillField(fields[i].field, data);
      i++;
      if (i < fields.length) setTimeout(next, delay);
    }
    next();
  }

  function fillField(field, data) {
    const id = identifyField(field);
    const saved = data[id.key];
    if (!saved) return;
    if (saved.tag === 'select') {
      field.value = saved.value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (saved.tag === 'checkbox' || saved.tag === 'radio') {
      if (field.checked !== saved.checked) {
        field.checked = saved.checked;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      field.value = saved.value || '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function getSavedData(form) {
    const alias = getAlias(location.href);
    const fingerprint = getFormFingerprint(form);
    const key = 'fs_' + alias + '_' + fingerprint.slice(0, 16);
    try {
      const raw = GM_getValue(key, '');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /* ═══════════════════════════════════════════
     七、悬浮按钮 UI
     ═══════════════════════════════════════════ */

  let _btn = null;
  let _ignored = false;

  function createRestoreButton(savedData, form) {
    if (_btn || _ignored) return;
    _btn = document.createElement('div');
    _btn.id = 'fs-restore-btn';
    _btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;display:flex;align-items:center;gap:4px;pointer-events:auto;';
    _btn.innerHTML = `
      <svg class="fs-arc-left" width="24" height="48" viewBox="0 0 24 48">
        <path class="fs-arc-bg" d="M 22 4 A 20 20 0 0 0 22 44" fill="none" stroke="#eee" stroke-width="3"/>
        <path class="fs-arc-fill" d="M 22 4 A 20 20 0 0 0 22 44" fill="none" stroke="#4caf50" stroke-width="3" stroke-dasharray="62.8" stroke-dashoffset="0"/>
      </svg>
      <div class="fs-btn-main" style="width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;font-size:18px;" title="恢复表单数据">💾</div>
      <svg class="fs-arc-right" width="24" height="48" viewBox="0 0 24 48">
        <path class="fs-arc-bg" d="M 2 4 A 20 20 0 0 1 2 44" fill="none" stroke="#eee" stroke-width="3"/>
        <path class="fs-arc-fill" d="M 2 4 A 20 20 0 0 1 2 44" fill="none" stroke="#4caf50" stroke-width="3" stroke-dasharray="62.8" stroke-dashoffset="0"/>
      </svg>
      <div class="fs-close" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#999;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;">×</div>
    `;
    _btn.querySelector('.fs-btn-main').addEventListener('click', e => {
      e.stopPropagation();
      restoreFormData(form, savedData.form);
      toast('✅ 表单已恢复');
    });
    _btn.querySelector('.fs-close').addEventListener('click', e => {
      e.stopPropagation();
      _btn.remove(); _btn = null; _ignored = true;
    });
    document.body.appendChild(_btn);
    updateIndicators();
  }

  function updateIndicators() {
    if (!_btn) return;
    const leftArc = _btn.querySelector('.fs-arc-left .fs-arc-fill');
    const rightArc = _btn.querySelector('.fs-arc-right .fs-arc-fill');
    if (!leftArc || !rightArc) return;
    const totalLen = 62.8;
    // 站点使用率
    const domain = getDomain();
    const allKeys = GM_listValues().filter(k => k.startsWith('fs_') && !k.startsWith('fs_url_map') && !k.startsWith('fs_dict_') && !k.startsWith('fs_'));
    let domainSize = 0, totalSize = 0;
    for (const k of allKeys) {
      const v = GM_getValue(k, '');
      const size = typeof v === 'string' ? v.length * 2 : 0;
      totalSize += size;
      if (k.includes(getAlias(location.href))) domainSize += size;
    }
    const domainUsage = Math.min(domainSize / (cfg().siteLimit * 1024), 1);
    const totalUsage = Math.min(totalSize / (cfg().totalLimit * 1024), 1);
    leftArc.setAttribute('stroke-dashoffset', totalLen * (1 - domainUsage));
    rightArc.setAttribute('stroke-dashoffset', totalLen * (1 - totalUsage));
    leftArc.setAttribute('stroke', domainUsage > 0.8 ? '#f44336' : domainUsage > 0.5 ? '#ff9800' : '#4caf50');
    rightArc.setAttribute('stroke', totalUsage > 0.8 ? '#f44336' : totalUsage > 0.5 ? '#ff9800' : '#4caf50');
  }

  /* ═══════════════════════════════════════════
     八、Toast
     ═══════════════════════════════════════════ */

  let _t;
  function toast(m) {
    if (!_t) { _t = document.createElement('div'); _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;z-index:999999;opacity:0;transition:opacity .2s;pointer-events:none;'; document.body.appendChild(_t); }
    _t.textContent = m; _t.style.opacity = '1';
    clearTimeout(_t._x); _t._x = setTimeout(() => { _t.style.opacity = '0'; }, 1500);
  }

  /* ═══════════════════════════════════════════
     九、设置面板
     ═══════════════════════════════════════════ */

  let _so = false;
  function openSettings() {
    if (_so) return; _so = true;
    const c = cfg();
    const host = document.createElement('div');
    host.id = 'fs-settings-host';
    host.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;';
    const sh = host.attachShadow({ mode: 'closed' });
    sh.innerHTML = `<style>*{box-sizing:border-box;margin:0;padding:0}.m{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}.p{background:#fff;border-radius:12px;padding:24px;width:400px;box-shadow:0 8px 32px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto}h3{margin:0 0 16px;font-size:16px;font-weight:600}.r{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.r>div:first-child{flex:1;margin-right:12px}.r label{font-size:14px}.h{font-size:12px;color:#999;margin-top:2px}.sw{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;display:block}.sw input{display:none}.sw .sl{position:absolute;inset:0;background:#ccc;border-radius:22px;transition:background .2s}.sw .sl::before{content:'';position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:left .2s}.sw input:checked+.sl{background:#1a73e8}.sw input:checked+.sl::before{left:20px}.nm{width:60px;height:30px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:14px;outline:0}.nm:focus{border-color:#1a73e8}textarea{width:100%;height:50px;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:13px;font-family:monospace;outline:0;resize:vertical}textarea:focus{border-color:#1a73e8}.ft{margin-top:18px;display:flex;justify-content:space-between;align-items:center}.ft button{padding:6px 18px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff}.ft button:hover{background:#1557b0}.ft button.ghost{background:transparent;color:#999}.ft button.ghost:hover{color:#333}.site-list{max-height:200px;overflow-y:auto;margin:8px 0;border:1px solid #eee;border-radius:6px;padding:8px}.site-item{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;border-bottom:1px solid #f5f5f5}.site-item:last-child{border-bottom:none}.site-del{color:#f44336;cursor:pointer;font-size:12px}</style>
    <div class="m"><div class="p">
      <h3>💾 FormSave 设置</h3>
      <div class="r"><div><label>启用保存</label><div class="h">关闭后停止保存和恢复</div></div><label class="sw"><input type="checkbox" id="s-on" ${c.enabled?'checked':''}><span class="sl"></span></label></div>
      <div class="r"><div><label>站点上限 (KB)</label><div class="h">单个站点最大存储</div></div><input type="number" class="nm" id="s-sl" min="10" max="500" value="${c.siteLimit}"></div>
      <div class="r"><div><label>总量上限 (KB)</label><div class="h">所有站点总存储</div></div><input type="number" class="nm" id="s-tl" min="100" max="50000" value="${c.totalLimit}"></div>
      <div class="r"><div><label>保留天数</label><div class="h">超过天数自动清理</div></div><input type="number" class="nm" id="s-rd" min="1" max="365" value="${c.retentionDays}"></div>
      <div class="r"><div><label>恢复延迟 (ms)</label><div class="h">下拉框字段间延迟</div></div><input type="number" class="nm" id="s-rdl" min="0" max="2000" value="${c.restoreDelay}"></div>
      <div class="r" style="flex-direction:column;align-items:stretch"><div style="margin-bottom:6px"><label>排除域名</label><div class="h">逗号分隔，这些站点不生效</div></div><textarea id="s-ex" placeholder="example.com, .company.com">${c.excludeCustom}</textarea></div>
      <div class="ft"><button class="ghost" id="s-clr">清空所有数据</button><button id="s-ok">保存</button></div>
    </div></div>`;
    sh.querySelector('.m').addEventListener('click', e => { if (e.target.classList.contains('m')) closeSettings(); });
    sh.getElementById('s-ok').addEventListener('click', e => {
      e.stopPropagation();
      saveCfg({
        enabled:       sh.getElementById('s-on').checked,
        siteLimit:     Math.max(10, Math.min(500, +sh.getElementById('s-sl').value || 50)),
        totalLimit:    Math.max(100, Math.min(50000, +sh.getElementById('s-tl').value || 5000)),
        retentionDays: Math.max(1, Math.min(365, +sh.getElementById('s-rd').value || 7)),
        restoreDelay:  Math.max(0, Math.min(2000, +sh.getElementById('s-rdl').value || 100)),
        excludeCustom: sh.getElementById('s-ex').value.trim(),
      });
      closeSettings(); toast('✅ 设置已保存');
    });
    sh.getElementById('s-clr').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('确定清空所有保存的表单数据？')) {
        const keys = GM_listValues().filter(k => k.startsWith('fs_') && !k.startsWith('fs_url_map') && !k.startsWith('fs_dict_') && !k.startsWith('fs_'));
        keys.forEach(k => GM_removeValue(k));
        GM_setValue('fs_url_map', {});
        toast('🗑️ 已清空');
      }
    });
    document.body.appendChild(host);
  }
  function closeSettings() { const e = document.getElementById('fs-settings-host'); if (e) e.remove(); _so = false; }

  /* ═══════════════════════════════════════════
     十、主流程
     ═══════════════════════════════════════════ */

  let _userActive = false;
  let _debounce = null;
  let _targetForm = null;

  async function init() {
    if (await isExcluded()) return;
    GM_registerMenuCommand('⚙️ 设置', openSettings);

    // 找表单
    const forms = document.querySelectorAll('form');
    if (!forms.length) return;
    _targetForm = forms[forms.length - 1]; // 最后一个表单

    // 检查是否有保存数据
    const saved = getSavedData(_targetForm);
    if (saved) createRestoreButton(saved, _targetForm);

    // 监听用户操作（暂停自动保存直到首次操作）
    const activate = () => {
      if (_userActive) return;
      _userActive = true;
      document.removeEventListener('mousemove', activate);
      document.removeEventListener('keydown', activate);
      document.removeEventListener('click', activate);
    };
    document.addEventListener('mousemove', activate, { passive: true });
    document.addEventListener('keydown', activate, { passive: true });
    document.addEventListener('click', activate, { passive: true });

    // 自动保存（防抖）
    _targetForm.addEventListener('input', () => {
      if (!_userActive) return;
      clearTimeout(_debounce);
      _debounce = setTimeout(() => {
        const fp = getFormFingerprint(_targetForm);
        saveForm(_targetForm, fp);
      }, 2000);
    });

    // 页面关闭兜底
    window.addEventListener('beforeunload', () => {
      if (!_userActive) return;
      const fp = getFormFingerprint(_targetForm);
      saveForm(_targetForm, fp);
    });
  }

  init();
})();
