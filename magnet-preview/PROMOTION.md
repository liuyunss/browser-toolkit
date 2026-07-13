# 🧲 磁力链接预览

> 一键预览磁力链接里的内容，再也不怕下到葫芦娃

## 痛点

每次在网上看到磁力链接都是一串乱码：
- `magnet:?xt=urn:btih:08ada5a7a6183aae...`

完全不知道里面是啥。有没有字幕？有没有夹带广告？视频多大？只能下载了才知道——有时候下半天发现根本不是想要的东西。

## 解决方案

装上这个脚本，页面上的磁力链接会自动高亮。点一下，弹窗里直接看到：

- 📺 **视频截图预览** — 从 whatslink.info 获取，一眼判断是不是想要的
- 📁 **完整文件列表** — 从 itorrents.org 下载 .torrent 解析，每个文件多大清清楚楚
- 📋 **一键复制链接** — 复制磁力链接去下载

## 技术亮点

- **三层数据源自动 fallback**：直连源优先，失败后自动尝试代理源
- **零后端依赖**：纯前端脚本，所有数据来自公开 API
- **最小 bencode 解析器**：在浏览器里直接解析 .torrent 文件，不依赖任何库
- **暗色弹窗**：Catppuccin 风格，UI 精致不突兀

## 安装

> 需要先装 [Tampermonkey](https://www.tampermonkey.net/)（BETA 版，红色图标）

[📥 安装脚本](https://raw.githubusercontent.com/liuyunss/browser-toolkit/main/magnet-preview/magnet-preview.user.js)

## 数据源

| 来源 | 提供 | 直连 |
|------|------|:--:|
| whatslink.info | 文件名 + 大小 + 截图 | ✅ |
| itorrents.org | 完整文件列表（解析 .torrent） | ✅ |
| btdig.com | 文件列表（fallback） | ❌ |

## 效果

| 信息卡片 | 文件列表 |
|---------|---------|
| 文件名 + 大小 + 类型 | 每个文件的名称和大小 |
| 数据来源标注 | 视频/字幕/图片自动识别图标 |

---

**更多脚本**：[browser-toolkit](https://github.com/liuyunss/browser-toolkit)
