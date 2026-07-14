# 🧰 Browser Toolkit

> 实用的油猴脚本集合，提升日常浏览体验

---

### 脚本列表

| 脚本 | 说明 | 安装 |
|------|------|------|
| [show-password](./show-password/) | 🔐 密码显示与复制 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/show-password/show-password.user.js) |
| [stay-awake](./stay-awake/) | 🔒 页面保活，防止超时退出 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/stay-awake/stay-awake.user.js) |
| [form-save](./form-save/) | 💾 表单自动保存与恢复 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/form-save/form-save.user.js) |
| [cookie-clip](./cookie-clip/) | 🍪 Cookie 一键复制 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/cookie-clip/cookie-clip.user.js) |
| [magnet-preview](./magnet-preview/) | 🧲 磁力链接预览 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/magnet-preview/magnet-preview.user.js) |

---

### 字典（dict/）

共享的排除列表，多个脚本引用：

| 文件 | 说明 |
|------|------|
| [sensitive-sites.txt](./dict/sensitive-sites.txt) | 金融安全类网站（银行、支付、政务） |
| [autosave-sites.txt](./dict/autosave-sites.txt) | 自带保存功能的网站（文档、笔记等） |

---

### 使用方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击上方「安装脚本」链接
3. 在 Tampermonkey 中确认安装

### 开发

每个脚本独立存放在各自的文件夹中：

```
browser-toolkit/
├── README.md
├── dict/                     # 共享字典（排除列表等）
├── show-password/            # 密码显示脚本
├── stay-awake/               # 页面保活脚本
├── cookie-clip/              # Cookie 一键复制脚本
├── magnet-preview/           # 磁力链接预览脚本
├── form-save/                # 表单保存脚本（开发中）
└── plans/                    # 设计文档
```

### License

MIT
