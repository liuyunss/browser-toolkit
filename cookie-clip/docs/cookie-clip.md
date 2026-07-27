# 🍪 Cookie 一键复制

从 Tampermonkey 菜单一键复制当前网站的完整 Cookie（含 HttpOnly），与 F12 Network 请求头一致。

## ✨ 功能

- **完整 Cookie** — 通过 `GM_cookie` 读取 Cookie（含 HttpOnly），与 F12 Network 请求头一致
- **兜底机制** — `GM_cookie` 不可用时降级为 `document.cookie`（不含 HttpOnly）
- **数量提示** — 复制后显示复制了多少个 Cookie
- **来源提示** — 显示 Cookie 来源（GM_cookie / document.cookie）

## 📥 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击 [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js)

## ⚙️ 使用

点击 Tampermonkey 图标 → 🍪 复制 Cookie

复制成功后会在页面底部居中显示提示，1.5 秒后自动消失。

## 🔒 安全

- 只读取当前域名的 Cookie，不跨域
- 不上传任何服务器
- 不存储任何数据

## 📝 更新日志

### v2.1.1
- 修复 `GM_cookie` 用 `domain` 查询会漏掉父域 Cookie 的问题（如 Cloudflare 的 `cf_clearance`，domain 为 `.south-plus.net`）
- 改为 `url` + `domain` 双查询合并去重，`url` 查询等价于浏览器实际发送的 Cookie，与请求头一致

### v2.1.0
- 改用 `GM_cookie.list` 获取完整 Cookie（含 HttpOnly），修复“只能复制到部分 Cookie”的问题
- 原因：浏览器自动附加的 Cookie 头不经过 `setRequestHeader`，XHR/fetch 拦截实际拿不到，最终退回 `document.cookie`，而 `document.cookie` 读不到 HttpOnly Cookie
- 保留 `document.cookie` 兜底（`GM_cookie` 不可用时使用）

### v2.0.0
- 从 `document.cookie` 改为拦截 XHR 请求，获取完整 Cookie（含 HttpOnly）
- 支持 fetch 请求拦截
- 匹配当前域名的同源请求，一个就够

### v1.0.0
- 初始版本

## 📄 许可证

MIT License
