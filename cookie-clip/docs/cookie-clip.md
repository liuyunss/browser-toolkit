# 🍪 Cookie 一键复制

从 Tampermonkey 菜单一键复制当前网站所有 Cookie。

## ✨ 功能

- **一键复制** — 点击菜单即可复制当前网站所有 Cookie
- **数量提示** — 复制后显示复制了多少个 Cookie
- **无 Cookie 提示** — 当前网站没有 Cookie 时给出提示

## 📥 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击 [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js)

## ⚙️ 使用

点击 Tampermonkey 图标 → 🍪 复制 Cookie

复制成功后会在页面底部居中显示提示，1.5 秒后自动消失。

## 🔒 安全

- 仅复制 `document.cookie` 可见的 Cookie（不含 httpOnly）
- 不上传任何服务器
- 不存储任何数据

## 📝 更新日志

### v3.0.0
- 提示框样式优化（底部居中，深色背景）

### v2.0.0
- 添加 @noframes 防止 iframe 内重复注入

### v1.0.0
- 初始版本

## 📄 许可证

MIT License
