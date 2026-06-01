# 🔐 密码显示与复制

> 每次登录都要手动切明文再复制？这个脚本帮你在所有网站的密码框旁一键搞定。

## 痛点

- 浏览器密码框默认用 `••••••` 遮盖，想确认密码内容必须手动切明文
- 某些页面输入密码后无法直接复制，只能再敲一遍
- 想临时看一眼密码内容，但来回切换太麻烦

## 核心功能

- 👁 **显示/隐藏** — 一键切换明文 ↔ 圆点
- 📋 **一键复制** — 复制真实密码到剪贴板，随时粘贴
- 🖱 **悬停预览** — 鼠标移入密码框临时显示明文，移出自动恢复

## 三种模式随心切换

| 模式 | 适用场景 |
|------|---------|
| 默认（切换） | 日常使用，需要时再看明文 |
| 始终明文 | 开发/测试环境，不想来回切换 |
| 仅复制 | 只需复制密码，不需要看明文 |

## 兼容性

- ✅ 支持 React / Vue / Angular 等现代框架的密码输入框
- ✅ 自动监听动态内容（SPA、懒加载等）
- ✅ 覆盖常见选择器：type=password、name*=pass、autocomplete=current-password 等

## 安全

- 🔒 所有数据本地存储，**不上传任何服务器**
- ✅ 表单提交始终发送真实密码
- ✅ 按钮作为输入框的兄弟节点插入，不修改页面 DOM 结构

## 技术亮点

- 按钮以 `inline-flex` 方式自然排列，**不破坏页面布局**
- MutationObserver 暂停机制，注入时避免无限循环
- 剪贴板三级回退：GM_setClipboard → navigator.clipboard → execCommand

---

**安装方式：** 安装 [Tampermonkey](https://www.tampermonkey.net/) → [点击安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/show-password/show-password.user.js)

**兼容：** Chrome / Firefox / Edge / Safari（需 Tampermonkey 或 Violentmonkey）
