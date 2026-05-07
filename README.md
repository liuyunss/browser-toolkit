# 🔧 Browser Toolkit

浏览器实用脚本集合，配合 Tampermonkey / Violentmonkey 使用。

## 安装方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击下面的「安装」链接，自动导入脚本

## 脚本列表

### 🔐 密码显示与复制 (`show-password.user.js`)

在所有网站的密码输入框旁添加：
- 👁️ **显示/隐藏** 按钮 — 一键切换密码明文
- 📋 **复制** 按钮 — 一键复制到剪贴板

特点：
- 自动识别动态加载的密码框（SPA 友好）
- 无需特殊权限，纯 DOM 操作
- 支持所有网站

[📦 安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js)

## 更新机制

Tampermonkey 会自动检查脚本顶部 `@updateURL` 字段指向的地址，发现新版本时提示更新。每次发布新版本只需更新脚本中的 `@version` 并推送到 GitHub 即可。

## 脚本开发规范

每个脚本放在 `scripts/` 目录下，文件名格式：`功能名.user.js`

脚本头部必须包含：
- `@updateURL` — 指向 `raw.githubusercontent.com` 上的同文件路径
- `@downloadURL` — 同上
- 语义化版本号 (`@version`)

## License

MIT
