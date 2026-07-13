// ==UserScript==
// @name         🧲 磁力链接预览
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.0.0
// @description  高亮页面中的磁力链接，点击弹窗预览文件列表与视频截图，支持一键复制
// @author       liuyunss
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/magnet-preview/assets/icon-128.png
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      whatslink.info
// @connect      itorrents.org
// @connect      btdig.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/magnet-preview/magnet-preview.user.js
// @downloadURL  https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/magnet-preview/magnet-preview.user.js
// @license      MIT
// ==/UserScript==

/**
 * Magnet Link Preview — 三层数据源自动 fallback
 *
 * 数据源：
 *   1. whatslink.info  → 文件名 + 大小 + 视频截图（直连）
 *   2. itorrents.org   → 完整文件列表，解析 .torrent（直连）
 *   3. btdig.com       → 文件列表 + 做种信息（需代理，仅 fallback）
 *
 * 调用顺序：先直连源，失败后自动尝试代理源
 */

(function () {
  'use strict';

  /* ═══════════════════════ 配置 ═══════════════════════ */
  const MAGNET_RE = /magnet:\?[^\s<>"'`]+/gi;

  /* ═══════════════════════ SVG 图标 ═══════════════════════ */
  const SVG = {
    magnet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15V3h6v12a4 4 0 0 1-8 0h2"/><path d="M14 9V3h6v6a4 4 0 0 1-8 0h2"/><line x1="6" y1="21" x2="6" y2="18"/><line x1="14" y1="21" x2="14" y2="18"/></svg>`,
    close:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    copy:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    file:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
    folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    film:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>`,
    image:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    music:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    archive:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    loader: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"><animate attributeName="stroke-dashoffset" values="32;0" dur="1.5s" repeatCount="indefinite"/></circle></svg>`,
  };

  /* ═══════════════════════ 工具函数 ═══════════════════════ */
  /** 提取 magnet URI（取第一个匹配） */
  function extractMagnet(text) {
    const m = text.match(MAGNET_RE);
    return m ? m[0] : null;
  }

  /** 从 magnet URI 提取 info hash */
  function extractHash(magnet) {
    const m = magnet.match(/btih:([0-9a-fA-F]{40})/);
    return m ? m[1].toLowerCase() : null;
  }

  /** 格式化字节数 */
  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes || 1) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
  }

  /** 根据扩展名返回图标类型 */
  function fileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const map = {
      mp4: 'film', mkv: 'film', avi: 'film', mov: 'film', webm: 'film', m4v: 'film',
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
      mp3: 'music', flac: 'music', wav: 'music', aac: 'music', ogg: 'music',
      zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
      srt: 'file', ass: 'file', sub: 'file', txt: 'file', nfo: 'file', md: 'file',
    };
    return SVG[map[ext]] || SVG.file;
  }

  /* ═══════════════════════ 数据源 ═══════════════════════ */

  /** 数据源1：whatslink.info — 文件名 + 大小 + 截图 */
  function fetchWhatslink(magnet) {
    return new Promise((resolve, reject) => {
      const url = 'https://whatslink.info/api/v1/link?url=' + encodeURIComponent(magnet);
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 8000,
        onload(r) {
          try {
            const d = JSON.parse(r.responseText);
            if (d.error) return reject(new Error(d.error));
            resolve({
              source: 'whatslink.info',
              name: d.name || '',
              size: d.size || 0,
              count: d.count,
              type: d.file_type || '',
              screenshots: (d.screenshots || []).map(s => s.screenshot),
            });
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('whatslink 请求失败')),
        ontimeout: () => reject(new Error('whatslink 超时')),
      });
    });
  }

  /** 数据源2：itorrents.org — 下载 .torrent，解析完整文件列表 */
  function fetchItorrents(hash) {
    return new Promise((resolve, reject) => {
      const url = 'https://itorrents.org/torrent/' + hash.toUpperCase() + '.torrent';
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 10000, responseType: 'arraybuffer',
        onload(r) {
          try {
            const raw = new Uint8Array(r.response);
            const info = parseTorrentInfo(raw);
            if (!info) return reject(new Error('解析 .torrent 失败'));
            resolve({
              source: 'itorrents.org',
              name: info.name,
              files: info.files,   // [{name, size}]
              totalSize: info.totalSize,
            });
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('itorrents 请求失败')),
        ontimeout: () => reject(new Error('itorrents 超时')),
      });
    });
  }

  /** 最小 bencode 解析器 — 只解析 info 字典中的 name + files */
  function parseTorrentInfo(data) {
    let pos = 0;
    const read = (n) => { const v = data.slice(pos, pos + n); pos += n; return v; };
    const peek = () => data[pos];

    function parse() {
      const c = peek();
      if (c === 0x64) { // 'd' → dict
        pos++;
        const dict = {};
        while (peek() !== 0x65) { // until 'e'
          const key = parse(); // string key
          const val = parse();
          dict[new TextDecoder().decode(key)] = val;
        }
        pos++; // skip 'e'
        return dict;
      }
      if (c === 0x6c) { // 'l' → list
        pos++;
        const list = [];
        while (peek() !== 0x65) list.push(parse());
        pos++;
        return list;
      }
      if (c === 0x69) { // 'i' → int
        pos++;
        let end = data.indexOf(0x65, pos);
        const n = parseInt(new TextDecoder().decode(data.slice(pos, end)));
        pos = end + 1;
        return n;
      }
      // string: <length>:<bytes>
      let colon = data.indexOf(0x3a, pos);
      const len = parseInt(new TextDecoder().decode(data.slice(pos, colon)));
      pos = colon + 1;
      const bytes = read(len);
      return bytes;
    }

    try {
      // 找到 "4:info" 标记
      const infoIdx = new TextDecoder().decode(data).indexOf('4:info');
      if (infoIdx === -1) return null;
      pos = infoIdx + 6; // skip "4:info"
      const info = parse();

      const name = new TextDecoder().decode(info['name'] || b'');
      const files = [];

      if (info['files']) {
        for (const f of info['files']) {
          const path = (f['path'] || []).map(p => new TextDecoder().decode(p)).join('/');
          files.push({ name: path, size: f['length'] });
        }
      } else if (info['length'] != null) {
        files.push({ name, size: info['length'] });
      }

      const totalSize = files.reduce((s, f) => s + f.size, 0);
      return { name, files, totalSize };
    } catch {
      return null;
    }
  }

  /** 数据源3：btdig.com — HTML 解析文件列表（需代理，仅 fallback） */
  function fetchBtdig(hash) {
    return new Promise((resolve, reject) => {
      const url = 'https://btdig.com/' + hash;
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 12000,
        onload(r) {
          try {
            const html = r.responseText;
            // 提取种子名
            const titleM = html.match(/<title>(.*?) torrent<\/title>/);
            const name = titleM ? titleM[1] : '';

            // 提取文件列表图标和名称
            const files = [];
            const iconRe = /class="fa fa-([^"]+)"[^>]*>\s*([^<]+)/g;
            let m;
            while ((m = iconRe.exec(html)) !== null) {
              const icon = m[1];
              const rawName = m[2].replace(/&nbsp;/g, ' ').trim();
              // 跳过文件夹图标（folder-open）
              if (icon === 'folder-open') continue;
              // 跳过隐藏文件链接（fa-plus-circle）
              if (icon === 'plus-circle') continue;
              if (rawName && !rawName.startsWith('<')) {
                files.push({ name: rawName, size: 0 });
              }
            }

            // 提取文件大小
            const sizeRe = /([\d.]+)\s*(KB|MB|GB|bytes)/gi;
            const sizes = [];
            while ((m = sizeRe.exec(html)) !== null) {
              const val = parseFloat(m[1]);
              const unit = m[2];
              const bytes = unit === 'GB' ? val * 1073741824 :
                            unit === 'MB' ? val * 1048576 :
                            unit === 'KB' ? val * 1024 : val;
              sizes.push(bytes);
            }
            // 配对大小到文件
            for (let i = 0; i < Math.min(files.length, sizes.length); i++) {
              files[i].size = sizes[i];
            }

            resolve({
              source: 'btdig.com',
              name,
              files: files.length ? files : null,
            });
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('btdig 请求失败（可能需要代理）')),
        ontimeout: () => reject(new Error('btdig 超时（可能需要代理）')),
      });
    });
  }

  /* ═══════════════════════ 主流程：串行 fallback ═══════════════════════ */

  /**
   * 按顺序尝试数据源，收集信息后合并展示
   * 策略：
   *   - 并行请求 whatslink + itorrents（都是直连）
   *   - 两者都失败时，再尝试 btdig（需代理）
   */
  async function fetchAllInfo(magnet) {
    const hash = extractHash(magnet);
    const result = { name: '', size: 0, count: 0, type: '', screenshots: [], files: [], sources: [] };

    // 第1轮：并行直连源
    const promises = [fetchWhatslink(magnet).catch(e => ({ _error: e.message }))];
    if (hash) promises.push(fetchItorrents(hash).catch(e => ({ _error: e.message })));

    const [wl, it] = await Promise.all(promises);

    // 合并 whatslink 结果
    if (wl && !wl._error) {
      result.name = wl.name || result.name;
      result.size = wl.size || result.size;
      result.count = wl.count || result.count;
      result.type = wl.type || result.type;
      result.screenshots = wl.screenshots || [];
      result.sources.push('whatslink.info');
    }

    // 合并 itorrents 结果
    if (it && !it._error) {
      result.name = result.name || it.name;
      result.files = it.files || [];
      if (!result.size) result.size = it.totalSize || 0;
      result.count = result.files.length || result.count;
      result.sources.push('itorrents.org');
    }

    // 第2轮：直连都失败且 hash 可用时，尝试 btdig
    if (!result.name && !result.files.length && hash) {
      const bt = await fetchBtdig(hash).catch(() => null);
      if (bt && bt.name) {
        result.name = bt.name;
        result.files = bt.files || [];
        result.sources.push('btdig.com');
      }
    }

    return result;
  }

  /* ═══════════════════════ UI 组件 ═══════════════════════ */

  function showToast(msg, isErr) {
    const t = document.createElement('div');
    t.className = 'mp-toast';
    t.textContent = msg;
    if (isErr) t.classList.add('mp-toast-err');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function showPreview(magnet) {
    // 移除已有弹窗
    const exist = document.querySelector('.mp-overlay');
    if (exist) exist.remove();

    /* ── 构建 DOM ── */
    const overlay = document.createElement('div');
    overlay.className = 'mp-overlay';
    overlay.innerHTML = `
      <div class="mp-modal">
        <div class="mp-hd">
          <span class="mp-hd-icon">${SVG.magnet}</span>
          <span class="mp-hd-title">磁力链接预览</span>
          <button class="mp-close" title="关闭">${SVG.close}</button>
        </div>
        <div class="mp-body">
          <div class="mp-loading">
            <span class="mp-spinner">${SVG.loader}</span>
            <span class="mp-loading-text">正在获取信息…</span>
          </div>
        </div>
        <div class="mp-ft" style="display:none">
          <button class="mp-btn-copy">
            <span class="mp-btn-icon">${SVG.copy}</span> 复制链接
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const bodyEl = overlay.querySelector('.mp-body');
    const footer = overlay.querySelector('.mp-ft');
    const closeBtn = overlay.querySelector('.mp-close');

    /* ── 关闭逻辑 ── */
    const close = () => overlay.remove();
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    /* ── 复制按钮 ── */
    const copyBtn = overlay.querySelector('.mp-btn-copy');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(magnet).then(
        () => showToast('链接已复制到剪贴板'),
        () => showToast('复制失败，请手动复制', true),
      );
    });

    /* ── 获取数据并渲染 ── */
    fetchAllInfo(magnet).then(data => {
      if (!data.name && !data.files.length) {
        bodyEl.innerHTML = `<div class="mp-empty">
          <div class="mp-empty-icon">!</div>
          <div>未能获取种子信息</div>
          <div class="mp-empty-hint">所有数据源均不可用，请检查网络后重试</div>
        </div>`;
        footer.style.display = 'flex';
        return;
      }

      bodyEl.innerHTML = buildContent(data, magnet);
      footer.style.display = 'flex';

      // 缩略图切换
      const mainImg = bodyEl.querySelector('.mp-main-img');
      if (mainImg) {
        bodyEl.querySelectorAll('.mp-thumb').forEach(t => {
          t.addEventListener('click', () => {
            mainImg.src = t.dataset.full;
            bodyEl.querySelectorAll('.mp-thumb').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
          });
        });
      }
    }).catch(err => {
      bodyEl.innerHTML = `<div class="mp-empty">
        <div class="mp-empty-icon">!</div>
        <div>获取信息失败</div>
        <div class="mp-empty-hint">${err.message}</div>
      </div>`;
      footer.style.display = 'flex';
    });
  }

  function buildContent(data, magnet) {
    const { name, size, count, type, screenshots, files, sources } = data;

    // ── 信息卡片 ──
    let infoHtml = `<div class="mp-info">
      <div class="mp-name" title="${esc(name)}">${esc(name || '未知')}</div>
      <div class="mp-meta">`;

    if (size) infoHtml += `<span>${fmtSize(size)}</span>`;
    if (type && type !== 'unknown') infoHtml += `<span class="mp-meta-tag">${esc(type)}</span>`;
    if (count) infoHtml += `<span>${count} 个文件</span>`;

    infoHtml += `</div>`;

    // 数据源标识
    if (sources.length) {
      infoHtml += `<div class="mp-sources">via ${sources.join(' + ')}</div>`;
    }

    infoHtml += `</div>`;

    // ── 文件列表 ──
    let filesHtml = '';
    if (files.length) {
      const items = files.map(f => {
        const icon = fileIcon(f.name);
        return `<div class="mp-file">
          <span class="mp-file-icon">${icon}</span>
          <span class="mp-file-name" title="${esc(f.name)}">${esc(f.name)}</span>
          <span class="mp-file-size">${fmtSize(f.size)}</span>
        </div>`;
      }).join('');

      filesHtml = `<div class="mp-files-section">
        <div class="mp-section-title">文件列表</div>
        <div class="mp-files">${items}</div>
      </div>`;
    }

    // ── 截图 ──
    let shotsHtml = '';
    if (screenshots.length) {
      const thumbs = screenshots.map((src, i) =>
        `<img class="mp-thumb${i === 0 ? ' active' : ''}" src="${esc(src)}" data-full="${esc(src)}" alt="截图 ${i + 1}">`,
      ).join('');

      shotsHtml = `<div class="mp-shots-section">
        <div class="mp-section-title">预览截图</div>
        <img class="mp-main-img" src="${esc(screenshots[0])}" alt="预览">
        <div class="mp-thumbs">${thumbs}</div>
      </div>`;
    }

    // ── 磁力链接（可折叠） ──
    const linkHtml = `<div class="mp-link-section">
      <div class="mp-link-toggle" onclick="this.nextElementSibling.classList.toggle('show');this.classList.toggle('open')">
        查看磁力链接 ▾
      </div>
      <div class="mp-link-text">${esc(magnet)}</div>
    </div>`;

    return infoHtml + filesHtml + shotsHtml + linkHtml;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ═══════════════════════ CSS 样式 ═══════════════════════ */

  GM_addStyle(`
    /* ── 磁力链接高亮 ── */
    a[href^="magnet:"], .mp-highlight {
      color: #a78bfa !important;
      background: rgba(167, 139, 250, 0.08) !important;
      padding: 1px 5px !important;
      border-radius: 4px !important;
      border: 1px solid rgba(167, 139, 250, 0.25) !important;
      text-decoration: none !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
    }
    a[href^="magnet:"]:hover, .mp-highlight:hover {
      background: rgba(167, 139, 250, 0.16) !important;
      border-color: rgba(167, 139, 250, 0.45) !important;
    }

    /* ── input 旁的预览按钮 ── */
    .mp-input-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; margin-left: 5px;
      background: #a78bfa; color: #fff; border-radius: 4px;
      font-size: 11px; font-weight: 700; cursor: pointer;
      vertical-align: middle; user-select: none; transition: opacity 0.15s;
    }
    .mp-input-btn:hover { opacity: 0.8; }

    /* ── 弹窗遮罩 ── */
    .mp-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      animation: mp-fade .2s ease;
    }
    @keyframes mp-fade { from{opacity:0} to{opacity:1} }

    /* ── 弹窗主体 ── */
    .mp-modal {
      background: #1a1a2e;
      border-radius: 14px; border: 1px solid #2a2a4a;
      max-width: 680px; width: 92vw; max-height: 86vh;
      display: flex; flex-direction: column;
      color: #e2e8f0;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      animation: mp-scale .25s ease;
    }
    @keyframes mp-scale { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }

    /* ── 头部 ── */
    .mp-hd {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 20px;
      border-bottom: 1px solid #2a2a4a;
      flex-shrink: 0;
    }
    .mp-hd-icon { width: 20px; height: 20px; color: #a78bfa; }
    .mp-hd-icon svg { width: 100%; height: 100%; }
    .mp-hd-title { font-size: 15px; font-weight: 600; flex: 1; }
    .mp-close {
      width: 32px; height: 32px; border: none; background: none;
      color: #94a3b8; cursor: pointer; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s; padding: 0;
    }
    .mp-close svg { width: 18px; height: 18px; }
    .mp-close:hover { background: #2a2a4a; color: #e2e8f0; }

    /* ── 内容区 ── */
    .mp-body { padding: 20px; overflow-y: auto; flex: 1; }

    /* ── 加载 ── */
    .mp-loading {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px 20px; color: #64748b; gap: 12px;
    }
    .mp-spinner { width: 32px; height: 32px; color: #a78bfa; }
    .mp-spinner svg { width: 100%; height: 100%; }
    .mp-loading-text { font-size: 13px; }

    /* ── 空状态 ── */
    .mp-empty { text-align: center; padding: 40px 20px; color: #ef4444; }
    .mp-empty-icon { font-size: 36px; margin-bottom: 8px; font-weight: 700; }
    .mp-empty-hint { font-size: 12px; color: #64748b; margin-top: 6px; }

    /* ── 信息卡片 ── */
    .mp-info {
      padding: 14px 16px; background: #16213e; border-radius: 10px;
      margin-bottom: 16px;
    }
    .mp-name {
      font-size: 15px; font-weight: 600; color: #f1f5f9;
      word-break: break-all; margin-bottom: 6px;
    }
    .mp-meta { display: flex; gap: 12px; font-size: 12px; color: #94a3b8; flex-wrap: wrap; }
    .mp-meta-tag {
      background: #a78bfa22; color: #a78bfa; padding: 1px 8px;
      border-radius: 10px; font-size: 11px;
    }
    .mp-sources { font-size: 11px; color: #475569; margin-top: 6px; }

    /* ── 文件列表 ── */
    .mp-files-section { margin-bottom: 16px; }
    .mp-section-title {
      font-size: 12px; color: #64748b; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;
    }
    .mp-files {
      background: #16213e; border-radius: 10px; overflow: hidden;
      max-height: 260px; overflow-y: auto;
    }
    .mp-file {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-bottom: 1px solid #1e2a4a;
      font-size: 13px; transition: background .1s;
    }
    .mp-file:last-child { border-bottom: none; }
    .mp-file:hover { background: #1e2a4a; }
    .mp-file-icon { width: 16px; height: 16px; color: #64748b; flex-shrink: 0; }
    .mp-file-icon svg { width: 100%; height: 100%; }
    .mp-file-name { flex: 1; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mp-file-size { color: #64748b; font-size: 11px; flex-shrink: 0; }

    /* ── 截图 ── */
    .mp-shots-section { margin-bottom: 16px; }
    .mp-main-img {
      width: 100%; max-height: 340px; object-fit: contain;
      border-radius: 10px; background: #0f0f23; margin-bottom: 10px;
    }
    .mp-thumbs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .mp-thumb {
      width: 88px; height: 58px; object-fit: cover; border-radius: 7px;
      cursor: pointer; border: 2px solid transparent; flex-shrink: 0;
      transition: border-color .15s, opacity .15s;
    }
    .mp-thumb:hover { opacity: 0.85; }
    .mp-thumb.active { border-color: #a78bfa; }

    /* ── 磁力链接 ── */
    .mp-link-section { margin-bottom: 4px; }
    .mp-link-toggle {
      font-size: 12px; color: #64748b; cursor: pointer;
      user-select: none; padding: 4px 0;
    }
    .mp-link-toggle:hover { color: #94a3b8; }
    .mp-link-toggle.open { color: #a78bfa; }
    .mp-link-text {
      display: none; margin-top: 6px; padding: 10px 14px;
      background: #0f0f23; border-radius: 8px;
      font-size: 11px; color: #94a3b8; word-break: break-all;
      font-family: monospace; line-height: 1.5;
    }
    .mp-link-text.show { display: block; }

    /* ── 底部按钮 ── */
    .mp-ft {
      display: flex; gap: 10px; padding: 14px 20px;
      border-top: 1px solid #2a2a4a; flex-shrink: 0;
    }
    .mp-btn-copy {
      flex: 1; padding: 10px 16px; border: none; border-radius: 9px;
      cursor: pointer; font-size: 13px; font-weight: 500;
      background: #2a2a4a; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: background .15s;
    }
    .mp-btn-copy:hover { background: #3a3a5a; }
    .mp-btn-icon { width: 16px; height: 16px; }
    .mp-btn-icon svg { width: 100%; height: 100%; }

    /* ── Toast ── */
    .mp-toast {
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      background: #22c55e; color: #1a1a2e; padding: 10px 28px;
      border-radius: 10px; font-size: 13px; font-weight: 600;
      z-index: 2147483647;
      animation: mp-toast-in .25s ease, mp-toast-out .25s ease 2.3s forwards;
    }
    .mp-toast-err { background: #ef4444; color: #fff; }
    @keyframes mp-toast-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
    @keyframes mp-toast-out { from{opacity:1} to{opacity:0} }
  `);

  /* ═══════════════════════ DOM 扫描 ═══════════════════════ */

  /** 跳过这些标签内的文本 */
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'A', 'NOSCRIPT', 'SVG', 'CODE', 'PRE']);

  function shouldSkip(el) {
    let p = el;
    while (p) {
      if (SKIP.has(p.tagName)) return true;
      if (p.classList && p.classList.contains('mp-highlight')) return true;
      p = p.parentElement;
    }
    return false;
  }

  /** 纯文本中的磁力链接 → 转可点击 <a> */
  function processTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return MAGNET_RE.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const tn of nodes) {
      const parent = tn.parentNode;
      if (!parent) continue;

      const text = tn.textContent;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      MAGNET_RE.lastIndex = 0;

      while ((m = MAGNET_RE.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const a = document.createElement('a');
        a.href = m[0];
        a.textContent = m[0].length > 80 ? m[0].slice(0, 77) + '…' : m[0];
        a.className = 'mp-highlight';
        a.target = '_blank';
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

      parent.replaceChild(frag, tn);
    }
  }

  /** <a> 标签中的磁力链接 → 加高亮 class */
  function highlightLinks(root) {
    if (root.querySelectorAll) {
      root.querySelectorAll('a[href^="magnet:"]').forEach(a => {
        if (!a.classList.contains('mp-highlight')) a.classList.add('mp-highlight');
      });
    }
    if (root.tagName === 'A' && root.href && root.href.startsWith('magnet:')) {
      root.classList.add('mp-highlight');
    }
  }

  /** input/textarea 中磁力链接旁加预览按钮 */
  function processInputs(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach(inp => {
      if (inp.dataset.mpDone) return;
      if (!extractMagnet(inp.value)) return;
      inp.dataset.mpDone = '1';

      const btn = document.createElement('span');
      btn.className = 'mp-input-btn';
      btn.textContent = 'M';
      btn.title = '预览磁力链接';
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const url = extractMagnet(inp.value);
        if (url) showPreview(url);
      });
      inp.parentNode.insertBefore(btn, inp.nextSibling);
    });
  }

  function processAll(root) {
    highlightLinks(root);
    processTextNodes(root);
    processInputs(root);
  }

  /* ═══════════════════════ 入口 ═══════════════════════ */

  // 点击委托
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="magnet:"]');
    if (a) {
      e.preventDefault();
      e.stopPropagation();
      showPreview(a.href);
    }
  });

  // 初始扫描
  processAll(document);

  // 动态内容监听
  new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE) processAll(n);
      }
    }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

})();
