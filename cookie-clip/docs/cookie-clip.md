# 🍪 Cookie 一键复制

从 Tampermonkey 菜单一键复制当前网站的完整 Cookie（含 HttpOnly），与 F12 Network 请求头一致。

## ✨ 功能

- **完整 Cookie** — 拦截 XHR/fetch 请求，获取请求头中的 Cookie（含 HttpOnly）
- **匹配当前域名** — 只取同源请求的 Cookie，不会误抓其他域名
- **兜底机制** — 无 XHR 请求时自动降级为 `document.cookie`
- **数量提示** — 复制后显示复制了多少个 Cookie
- **来源提示** — 显示 Cookie 来源（请求头 / document.cookie）

## 📥 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击 [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js)

## ⚙️ 使用

点击 Tampermonkey 图标 → 🍪 复制 Cookie

复制成功后会在页面底部居中显示提示，1.5 秒后自动消失。

## 🔒 安全

- 仅捕获匹配当前域名的请求 Cookie，不跨域
- 不上传任何服务器
- 不存储任何数据

## 📝 更新日志

### v2.0.0
- 从 `document.cookie` 改为拦截 XHR 请求，获取完整 Cookie（含 HttpOnly）
- 支持 fetch 请求拦截
- 匹配当前域名的同源请求，一个就够

### v1.0.0
- 初始版本

## 📄 许可证

MIT License
