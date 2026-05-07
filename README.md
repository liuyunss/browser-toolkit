# 🔧 Browser Toolkit

浏览器实用脚本集合，配合 Tampermonkey / Violentmonkey 使用。

## 安装方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击下面的「安装」链接，自动导入脚本

## 脚本列表

### 🔐 密码显示与复制 (`show-password.user.js`)

在所有网站的密码输入框旁添加显示/隐藏、复制按钮，支持加密显示。

[📦 安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/scripts/show-password.user.js) | [📖 使用文档](docs/show-password.md)

## 更新机制

Tampermonkey 会自动检查 `@updateURL` 指向的地址，发现新版本时提示更新。每次发布新版本只需更新脚本中的 `@version` 并推送到 GitHub 即可。

## 开发工作流

```
dev 分支 → 开发/测试 → 合并到 main → 改版本号 → 用户自动更新
```

1. **开发**：在 `dev` 分支修改代码，push 到 `dev`
2. **测试**：本地安装 `dev` 分支的脚本测试
3. **发布**：合并 `dev` → `main`，更新 `@version`，push `main`
4. 用户的 Tampermonkey 自动检测到 `main` 上的新版本

**注意**：不要在开发阶段就改版本号并 push `main`，否则用户会立即收到半成品更新。

## 脚本开发规范

每个脚本放在 `scripts/` 目录下，文件名格式：`功能名.user.js`

对应文档放在 `docs/` 目录下，文件名格式：`功能名.md`

脚本头部必须包含：
- `@updateURL` — 指向 `raw.githubusercontent.com` 上的同文件路径（`main` 分支）
- `@downloadURL` — 同上
- 语义化版本号 (`@version`)

## License

MIT
