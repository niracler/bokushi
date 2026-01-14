# 博物志 (Bokushi)

> "长门大明神会梦到外星羊么？"

Niracler 的个人博客，记录一个话唠的技术与生活。

## 这里有什么

- **长篇文章** — 游戏评测、ACG 作品分析、生活感悟
- **月记** — 流水账式的生活记录（本来想写周记，结果变成了半年记）
- **TIL** — Today I Learned，零散的技术笔记
- **动态频道** — Telegram 频道同步，日常碎碎念
- **漫画表情包库** — 从漫画里截的表情包收藏（Cloudflare D1 驱动）

## 技术栈

[Astro](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/) + [Cloudflare Pages](https://pages.cloudflare.com/)

代码质量由 [Biome](https://biomejs.dev/) 管理，评论系统使用 [Remark42](https://remark42.com/)。

设计思路详见 [博物志 - 一份设计说明书](https://niracler.com/design-primitives)。

## 开发

```bash
pnpm install    # 安装依赖
pnpm dev        # 本地开发 (localhost:4321)
pnpm build      # 构建
pnpm preview    # 预览构建结果
```

## 项目结构

```text
src/
├── content/        # 内容（blog, monthly, til, galleries）
├── pages/          # 路由
├── layouts/        # 页面布局
├── components/     # 组件
└── styles/         # 样式（tokens + global）
```

## 链接

- **博客**: [niracler.com](https://niracler.com)
- **GitHub**: [@niracler](https://github.com/niracler)
- **Telegram**: [@tomoko_channel](https://t.me/tomoko_channel)
