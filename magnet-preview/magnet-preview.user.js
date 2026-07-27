// ==UserScript==
// @name         🧲 磁力链接预览
// @namespace    https://github.com/liuyunss/browser-toolkit
// @version      1.4.0
// @description  高亮磁力链接，点击弹窗预览文件列表与截图，支持一键复制
// @author       liuyunss
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/assets/icon-128.png
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
 * v1.4.0:
 * - 链接旁的预览按钮改为图标按钮（眼睛图标），去掉“预览”文字
 * - 预览按钮后新增复制按钮（复制图标），一键复制磁力链接
 */

(function(){
'use strict';
const RE=/magnet:\?[^\s<>"'`]+/gi;
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','A','NOSCRIPT','SVG','CODE','PRE']);
const H=m=>(m.match(/btih:([0-9a-fA-F]{40})/)||[])[1]?.toLowerCase();
const E=s=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML;};
const F=b=>{if(!b)return'';const u=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(b)/Math.log(1024));return(b/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i];};
const I=n=>({mp4:'🎬',mkv:'🎬',avi:'🎬',mov:'🎬',webm:'🎬',jpg:'🖼',jpeg:'🖼',png:'🖼',gif:'🖼',webp:'🖼',mp3:'🎵',flac:'🎵',wav:'🎵',zip:'📦',rar:'📦','7z':'📦',tar:'📦',gz:'📦',srt:'📝',ass:'📝',sub:'📝',txt:'📝',nfo:'📝'})[(n||'').split('.').pop()]||'📄';

const SVG={
eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
};

const GM=(u,o={})=>new Promise((ok,no)=>GM_xmlhttpRequest({method:'GET',url:u,timeout:o.t||8000,responseType:o.b?'arraybuffer':'',onload:r=>{try{ok(o.b?r.response:JSON.parse(r.responseText))}catch(e){no(e)}},onerror:()=>no(Error('fail')),ontimeout:()=>no(Error('timeout'))}));

function WL(m){return GM('https://whatslink.info/api/v1/link?url='+encodeURIComponent(m)).then(d=>{if(d.error)throw Error(d.error);return{name:d.name,size:d.size,count:d.count,type:d.file_type,shots:(d.screenshots||[]).map(s=>s.screenshot)};}).catch(()=>null);}
function IT(h){return GM('https://itorrents.org/torrent/'+h.toUpperCase()+'.torrent',{t:10000,b:true}).then(raw=>{const info=PT(new Uint8Array(raw));if(!info)throw Error('parse');return{name:info.name,files:info.files,total:info.total};}).catch(()=>null);}
function BD(h){return GM('https://btdig.com/'+h,{t:12000}).then(html=>{if(typeof html!=='string')html=new TextDecoder().decode(html);const nm=(html.match(/<title>([^<]+)/)||[])[1]?.replace(/\s*-\s*BTDigg.*/,'').trim()||'';const fs=[],ir=/class="fa fa-([^"]+)"[^>]*>\s*([^<]+)/g;let m;while((m=ir.exec(html))!==null){if(m[1]==='folder-open'||m[1]==='plus-circle')continue;const r=m[2].replace(/&nbsp;/g,' ').trim();if(r&&!r.startsWith('<'))fs.push({name:r,size:0});}const sz=[],sr=/([\d.]+)\s*(KB|MB|GB|bytes)/gi;while((m=sr.exec(html))!==null){const v=parseFloat(m[1]);sz.push(m[2]==='GB'?v*1073741824:m[2]==='MB'?v*1048576:m[2]==='KB'?v*1024:v);}for(let i=0;i<Math.min(fs.length,sz.length);i++)fs[i].size=sz[i];return{name:nm,files:fs.length?fs:null};}).catch(()=>null);}

function PT(d){let p=0;const r=n=>{const v=d.slice(p,p+n);p+=n;return v;},k=()=>d[p];
function parse(){const c=k();
if(c===0x64){p++;const o={};while(k()!==0x65)o[new TextDecoder().decode(parse())]=parse();p++;return o;}
if(c===0x6c){p++;const l=[];while(k()!==0x65)l.push(parse());p++;return l;}
if(c===0x69){p++;const e=d.indexOf(0x65,p);const n=parseInt(new TextDecoder().decode(d.slice(p,e)));p=e+1;return n;}
const col=d.indexOf(0x3a,p);const len=parseInt(new TextDecoder().decode(d.slice(p,col)));p=col+1;return r(len);}
try{const i=new TextDecoder().decode(d).indexOf('4:info');if(i===-1)return null;p=i+6;const inf=parse();
const nm=new TextDecoder().decode(inf.name||new Uint8Array(0));
let fs=[];if(inf.files)fs=inf.files.map(f=>({name:f.path.map(x=>new TextDecoder().decode(x)).join('/'),size:f.length}));
else if(inf.length!=null)fs=[{name:nm,size:inf.length}];
return{name:nm,files:fs,total:fs.reduce((s,f)=>s+f.size,0)};}catch(e){return null;}}

// ═══ UI ═══
function toast(msg,err){const t=document.createElement('div');t.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:10px 28px;border-radius:10px;font-size:13px;font-weight:600;z-index:2147483647;color:#fff;background:'+(err?'#dc2626':'#22c55e')+';animation:mp-toast .25s ease,mp-toast 2.3s .25s reverse forwards';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800);}

function copyMagnet(m){navigator.clipboard.writeText(m).then(()=>toast('已复制'),()=>toast('复制失败',1));}

function render(d){
let h='<div class="mp-info">';
if(d.size)h+='<span>📀 '+F(d.size)+'</span>';
if(d.type&&d.type!=='unknown')h+='<span class="mp-tag">'+E(d.type)+'</span>';
if(d.count)h+='<span>📁 '+d.count+' 个文件</span>';
if(d.src.length)h+='<span class="mp-src">🔗 '+d.src.join(' + ')+'</span>';
h+='</div>';
if(d.files.length){h+='<div class="mp-sec">📂 文件列表</div><div class="mp-files">'+d.files.map(f=>'<div class="mp-file"><span>'+I(f.name)+'</span><span title="'+E(f.name)+'">'+E(f.name)+'</span><span>'+F(f.size)+'</span></div>').join('')+'</div>';}
if(d.shots.length){h+='<div class="mp-sec">🖼 预览截图 ('+d.shots.length+'张)</div><div class="mp-shots">'+d.shots.map(s=>'<img class="mp-shot" data-src="'+E(s)+'">').join('')+'</div>';}
return h;
}

function preview(magnet){
const ex=document.querySelector('.mp-overlay');if(ex)ex.remove();
const ov=document.createElement('div');ov.className='mp-overlay';
ov.innerHTML='<div class="mp-modal"><div class="mp-hd"><span class="mp-hd-title">磁力链接预览</span><button class="mp-btn-copy" style="display:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button><button class="mp-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="mp-body"><div class="mp-spin"></div></div></div>';
document.body.appendChild(ov);
const body=ov.querySelector('.mp-body'),title=ov.querySelector('.mp-hd-title'),cp=ov.querySelector('.mp-btn-copy'),spin=ov.querySelector('.mp-spin');
const close=()=>ov.remove();ov.querySelector('.mp-close').onclick=close;ov.onclick=e=>{if(e.target===ov)close();};
document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc);}});
cp.onclick=()=>copyMagnet(magnet);

const h=H(magnet);
const R={name:'',size:0,count:0,type:'',shots:[],files:[],src:[]};
const tasks=[WL(magnet).then(d=>{if(d){Object.assign(R,{name:d.name,size:d.size,count:d.count,type:d.type,shots:d.shots});R.src.push('whatslink');}})];
if(h){tasks.push(IT(h).then(d=>{if(d){R.name=R.name||d.name;R.files=d.files;R.count=R.files.length||R.count;if(!R.size)R.size=d.total;R.src.push('itorrents');}}));
tasks.push(BD(h).then(d=>{if(d&&!R.files.length&&d.files){R.files=d.files;R.src.push('btdig');}}));}

Promise.all(tasks).then(()=>{
spin.style.display='none';cp.style.display='';
if(R.name||R.files.length||R.shots.length){body.innerHTML=render(R);title.textContent=R.name||'磁力链接预览';lazyLoad(body);}
else{body.innerHTML='<div class="mp-empty">未能获取种子信息</div>';}
});
}

function lazyLoad(root){root.querySelectorAll('.mp-shot[data-src]').forEach(img=>{const s=img.dataset.src;const r=new Image();r.onload=()=>{img.src=s;img.classList.add('mp-loaded');};r.onerror=()=>{img.style.display='none';};r.src=s;});}

// ═══ 截图大图 ═══
document.addEventListener('click',e=>{
const s=e.target.closest('.mp-shot');if(!s)return;
const src=s.dataset.src||s.src;if(!src||!src.startsWith('http'))return;
const ex=document.querySelector('.mp-img-ov');if(ex)ex.remove();
const ov=document.createElement('div');ov.className='mp-img-ov';
ov.innerHTML='<img class="mp-img-big" src="'+E(src)+'"><button class="mp-close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>';
document.body.appendChild(ov);
ov.querySelector('.mp-close').onclick=()=>ov.remove();ov.onclick=e=>{if(e.target===ov)ov.remove();};
document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){ov.remove();document.removeEventListener('keydown',esc);}});
});

// ═══ DOM 扫描 ═══
function skip(el){let p=el;while(p){if(SKIP.has(p.tagName)||p.classList?.contains('mp-highlight'))return true;p=p.parentElement;}return false;}

function textNodes(root){
const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>skip(n.parentElement)||!RE.test(n.textContent)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
const ns=[];while(w.nextNode())ns.push(w.currentNode);
for(const n of ns){const p=n.parentNode;if(!p)continue;const t=n.textContent,f=document.createDocumentFragment();let l=0,m;RE.lastIndex=0;
while((m=RE.exec(t))!==null){if(m.index>l)f.appendChild(document.createTextNode(t.slice(l,m.index)));const a=document.createElement('a');a.href=m[0];a.textContent=m[0].length>80?m[0].slice(0,77)+'…':m[0];a.className='mp-highlight';a.target='_blank';f.appendChild(a);f.appendChild(btn(a));l=m.index+m[0].length;}
if(l<t.length)f.appendChild(document.createTextNode(t.slice(l)));p.replaceChild(f,n);}}

function links(root){
if(root.querySelectorAll)root.querySelectorAll('a[href^="magnet:"]').forEach(a=>{a.classList.add('mp-highlight');if(!a.dataset.mb){a.dataset.mb='1';a.insertAdjacentElement('afterend',btn(a));}});
if(root.tagName==='A'&&root.href?.startsWith('magnet:')){root.classList.add('mp-highlight');if(!root.dataset.mb){root.dataset.mb='1';root.insertAdjacentElement('afterend',btn(root));}}}

function btn(a){const g=document.createElement('span');g.className='mp-btn-group';const pv=document.createElement('span');pv.className='mp-icon-btn';pv.title='预览磁力链接';pv.innerHTML=SVG.eye;pv.onclick=e=>{e.preventDefault();e.stopPropagation();preview(a.href);};const cp=document.createElement('span');cp.className='mp-icon-btn';cp.title='复制磁力链接';cp.innerHTML=SVG.copy;cp.onclick=e=>{e.preventDefault();e.stopPropagation();copyMagnet(a.href);};g.appendChild(pv);g.appendChild(cp);return g;}

function inputs(root){
if(!root.querySelectorAll)return;
root.querySelectorAll('input[type="text"],input:not([type]),textarea').forEach(inp=>{if(inp.dataset.md)return;const m=inp.value.match(RE);if(!m)return;inp.dataset.md='1';const b=document.createElement('span');b.className='mp-input-btn';b.textContent='M';b.title='预览磁力链接';b.onclick=e=>{e.preventDefault();e.stopPropagation();preview(m[0]);};inp.parentNode.insertBefore(b,inp.nextSibling);});}

function scan(root){links(root);textNodes(root);inputs(root);}

document.addEventListener('click',e=>{const a=e.target.closest('a[href^="magnet:"]');if(a){e.preventDefault();e.stopPropagation();preview(a.href);}});
scan(document);
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===Node.ELEMENT_NODE&&!n.closest?.('.mp-overlay')&&!n.closest?.('.mp-img-ov'))scan(n);}).observe(document.body||document.documentElement,{childList:true,subtree:true});

GM_addStyle(`
.mp-btn-group{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}
.mp-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;cursor:pointer;box-shadow:0 1px 3px rgba(22,163,74,.25);transition:transform .15s,background .15s;user-select:none}
.mp-icon-btn:hover{transform:translateY(-1px);background:linear-gradient(135deg,#15803d,#16a34a)}
.mp-icon-btn svg{width:13px;height:13px}
.mp-input-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:5px;background:#16a34a;color:#fff;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;vertical-align:middle;user-select:none}.mp-input-btn:hover{opacity:.85}
a[href^="magnet:"],.mp-highlight{color:#16a34a!important;background:rgba(22,163,74,.06)!important;padding:1px 5px!important;border-radius:4px!important;border:1px solid rgba(22,163,74,.2)!important;text-decoration:none!important;font-weight:500!important;cursor:pointer!important}.mp-highlight:hover,a[href^="magnet:"]:hover{background:rgba(22,163,74,.12)!important;border-color:rgba(22,163,74,.4)!important}
.mp-overlay,.mp-img-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2147483647;display:flex;align-items:center;justify-content:center;animation:mp-fade .2s ease}
.mp-img-ov{background:rgba(0,0,0,.75)}.mp-img-ov .mp-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center}.mp-img-ov .mp-close:hover{background:rgba(255,255,255,.25)}.mp-img-big{max-width:92vw;max-height:88vh;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.3);animation:mp-scale .25s ease}
@keyframes mp-fade{from{opacity:0}to{opacity:1}}
@keyframes mp-scale{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes mp-toast{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes mp-spin{to{transform:rotate(360deg)}}
.mp-modal{background:#fff;border-radius:14px;border:1px solid #e2e8f0;max-width:680px;width:92vw;max-height:86vh;display:flex;flex-direction:column;color:#334155;box-shadow:0 12px 40px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.06);animation:mp-scale .25s ease}
.mp-hd{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #f1f5f9;flex-shrink:0}
.mp-hd-title{font-size:15px;font-weight:600;flex:1;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mp-close,.mp-btn-copy{width:32px;height:32px;border:none;background:none;color:#94a3b8;cursor:pointer;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0}.mp-close:hover,.mp-btn-copy:hover{background:#f1f5f9;color:#475569}
.mp-btn-copy{color:#16a34a}.mp-btn-copy:hover{background:#f0fdf4;color:#15803d}
.mp-body{padding:20px;overflow-y:auto;flex:1}
.mp-spin{width:32px;height:32px;margin:40px auto;border:3px solid #f1f5f9;border-top-color:#22c55e;border-radius:50%;animation:mp-spin .8s linear infinite}
.mp-empty{text-align:center;padding:40px 20px;color:#dc2626}
.mp-info{display:flex;gap:12px;padding:12px 16px;background:#f8fafc;border-radius:10px;margin-bottom:16px;border:1px solid #f1f5f9;font-size:12px;color:#64748b;flex-wrap:wrap;align-items:center}
.mp-tag{background:#dcfce7;color:#16a34a;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:500}
.mp-src{background:#eff6ff;color:#2563eb;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:500}
.mp-sec{font-size:13px;color:#16a34a;margin-bottom:8px;font-weight:700}
.mp-files{background:#f8fafc;border-radius:10px;overflow:hidden;max-height:260px;overflow-y:auto;border:1px solid #f1f5f9;margin-bottom:16px}
.mp-file{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}.mp-file:last-child{border-bottom:none}.mp-file:hover{background:#f1f5f9}
.mp-file>:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155}
.mp-file>:last-child{color:#94a3b8;font-size:11px;flex-shrink:0}
.mp-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.mp-shot{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;cursor:pointer;opacity:.5;transition:opacity .3s;background:#f1f5f9}.mp-shot.mp-loaded{opacity:1}
`.trim());
})();
