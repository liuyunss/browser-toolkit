# 🧰 Browser Toolkit

> 实用的油猴脚本集合，提升日常浏览体验

---

### 脚本列表

| 脚本 | 说明 | 安装 |
|------|------|------|
| [show-password](./show-password/) | 🔐 密码显示与复制 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/show-password/show-password.user.js) |
| [stay-awake](./stay-awake/) | 🔒 页面保活，防止超时退出 | [安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/stay-awake/stay-awake.user.js) |

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
├── show-password/
│   ├── show-password.user.js    # 脚本主文件
│   ├── docs/                    # 文档（Greasyfork 描述等）
│   └── assets/                  # 图标资源
└── [future-script]/
    ├── [script].user.js
    ├── docs/
    └── assets/
```

### License

MIT
