---
title: "从零开始使用 Hugo 在 Cloudflare Pages 上搭建 TIL 博客"
description: "一步步把 Hugo TIL 博客部署到 Cloudflare Pages，涵盖主题选择、仓库配置与常用增强。"
pubDate: "Mar 13, 2025"
socialImage: "https://image.niracler.com/2025/03/e3c2172a09cef870a131c154a70b642a.png"
tags: [ "TIL", "博客", "部署", "Hugo", "DeepSearch" ]
---

> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。

|||
| :--- | :------------------------- |  
| 第一作者    | Grok DeepSearch            |  
| 校对&编辑   | Niracler                   |  
| 排版      | claude-3.7-sonnet-thinking |  
| Hugo 版本 | v0.145.0                   |  

<details> <summary>Prompt</summary>

### Prompt（此处应折叠）

```markdown
我是一个开发者，之前使用过 Hexo 搭建博客系统，但现在想尝试在 Cloudflare Pages 上使用 Hugo 静态网站框架搭建一个 TIL（Today I Learned）博客，用来记录和发布我每天学到的东西。我对 Hugo 是新手，但有一定的技术背景。我希望这个博客有以下特点：

1. **主题要求**：
   - 功能完整且足够多（支持标签、分类、搜索功能等）。
   - 加载速度快，轻量级。
   - 设计风格可爱一些。

2. **GitHub 仓库**：
   - 我需要从头开始创建一个 GitHub 仓库，并连接到 Cloudflare Pages 进行自动部署。

3. **内容结构**：
   - 完全从零开始的 TIL 记录。
   - 按日期排序，并支持标签（tag）功能。

4. **额外功能**：
   - 评论系统。
   - 访问统计。
   - 社交分享按钮。

请提供一个详细的指南，包括以下内容：

- 如何安装和配置 Hugo。
- 推荐一个符合我要求的 Hugo 主题，并说明如何安装和配置。
- 如何创建 GitHub 仓库并连接到 Cloudflare Pages。
- 如何编写和发布 TIL 条目。
- 如何添加评论系统、访问统计和社交分享按钮等额外功能。

请确保指南适合 Hugo 新手，并提供详细的命令和步骤。
```

</details>

PS. 本文也是计划中的一环

## 从零到一的步骤

咱们就一步一步开始吧～

### 安装和配置 Hugo

Hugo 是一个基于 Go 语言的静态网站生成器，以其速度和简单性著称，适合技术背景的用户快速上手。安装方法因操作系统而异：

**macOS**：推荐使用 Homebrew，运行以下命令：（其他系统，请上网查）

```bash
brew install hugo
```

安装完成后，创建新站点以开始构建博客：

- 运行 `hugo new site til`，这会在当前目录下生成一个名为 `til` 的文件夹，包含 Hugo 的基本目录结构。
- 进入站点目录：`cd til`。
- 初始化 Git：`git init`

### 选择并安装 PaperMod 主题

> 主题是博客外观和功能的核心，根据你的需求（支持标签、分类、搜索，加载快，设计可爱），我们推荐使用 PaperMod 主题。它是免费的，功能丰富，设计简洁，可能符合你对“可爱”风格的期待。

添加 PaperMod 主题：(PaperMod 托管在 GitHub 上，通过 Git 子模块添加)

```bash
git submodule add https://github.com/adityatelange/hugo-PaperMod themes/PaperMod
```

配置主题：在 Hugo 的配置文件中设置主题。Hugo 支持 YAML、TOML 或 JSON 格式，推荐使用 YAML 或 TOML。如果使用 `hugo.toml`，添加：(这个是自动生成的，并且趁着这个时候我们将 `hugo.yml` 的信息填对)

```toml
baseURL = "https://til.niracler.com/"
languageCode = "zh-cn"
title = "每日一学 TIL"
theme = "PaperMod"

[params]
  [params.homeInfoParams]
    Title = "欢迎来到我的 TIL 博客"
    Content = "这里记录了我每天学习的新知识，欢迎探索！"

  [[params.socialIcons]]
    name = "github"
    url = "https://github.com/niracler"
```

主题配置：PaperMod 有多种自定义选项，如支持深色/浅色模式、多语言、社交图标等。详细配置请参考 [PaperMod 文档](https://github.com/adityatelange/hugo-PaperMod/wiki)，包括如何启用搜索功能（通常通过 Lunr.js 或 Fuse.js 实现）。（**这里没有校对**）

### 编写和发布 TIL 条目

TIL 博客的内容完全从零开始，按日期排序，并支持标签功能。Hugo 使用 Markdown 文件管理内容，存储在 `content` 目录下。

**创建新帖子**： 使用 Hugo 的 `new` 命令创建帖子 (这会在 `content/post` 目录下生成一个 Markdown 文件，文件名以日期开头，便于按日期排序)。如下：

```bash
hugo new post/2025-03-13-build-til-blog-by-hugo.md
```

**编辑内容**： 打开生成的 Markdown 文件，顶部是前置元数据（front matter），用于定义帖子属性。例如：(就是我当前这篇文章了，呵呵)

```markdown
---
title: "从零开始使用 Hugo 搭建 TIL 博客"
date: 2025-03-13T14:00:00+08:00
tags: ["til", "hugo"]
---
...
```

- `title`：帖子标题。
- `date`：发布日期，建议使用当前日期，如 2025-03-12。
- `tags`：标签列表，支持多个标签，PaperMod 会自动生成标签页面。

内容部分写在 `---` 之后，使用 Markdown 语法。

**本地预览**： 运行 `hugo server` 查看本地预览，访问 `localhost:1313` 查看效果。按 Ctrl+C 停止服务器。

![CleanShot 2025-03-13 at 15.36.10@2x.png](https://image.niracler.com/2025/03/b5483be5d1eadefc27420df489b3503d.png)

**构建和部署**： 运行 `hugo` 构建站点，生成静态文件到 `public` 目录。 提交并推送更改：

```bash
git add .
git commit -m "Added new TIL post"
git push
```

### 创建 GitHub 仓库并连接 Cloudflare Pages

为了实现自动部署，需要将博客项目托管在 GitHub 上，并连接到 Cloudflare Pages。

**创建 GitHub 仓库**： 登录 GitHub，创建一个新仓库，例如 `niracler/til`，保持仓库为空。

添加远程仓库（替换 `niracler` 为你的 GitHub 用户名）

```bash
git remote add origin https://github.com/niracler/til
```

提交初始文件并推送：

```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

**连接 Cloudflare Pages**： 注册 Cloudflare 账户（如果没有），进入 Pages 仪表板，点击“Create a project”。

![](https://image.niracler.com/2025/03/cc12e758a22690d8f6a87a0003d1462d.png)

选择“Connect to Git”

![CleanShot 2025-03-13 at 15.47.48@2x.png](https://image.niracler.com/2025/03/cfb87ed86ae3452296f31fb741690a1b.png)

选择 GitHub 提供商并授权，找到你的仓库。

![CleanShot 2025-03-13 at 15.50.16@2x.png](https://image.niracler.com/2025/03/ac22484d0cb41b63fe9e76bc99c4523f.png)

设置生产分支为 “main”（或你使用的分支）。并配置构建设置，构建命令 `hugo --minify` 输出目录 `public`， 以及最好设置一下 hugo 的版本 `HUGO_VERSION`, 我写这篇文章的时候最新的是 `0.126.1`

![image.png](https://image.niracler.com/2025/03/872cebd57d2bc4dfcc7c0fc5e9d40968.png)

保存后，Cloudflare Pages 会自动从 GitHub 拉取代码并部署。每次推送代码都会触发自动构建和部署。更多细节见 [Cloudflare Pages Hugo 文档](https://developers.cloudflare.com/pages/framework-guides/hugo/)。

（完成部署啦，可喜可贺）  
![CleanShot 2025-03-13 at 16.03.23@2x.png](https://image.niracler.com/2025/03/01d4484fcf47bc75f3ebfb99d7cadd79.png)

### 设置自定义域名

因为上面我设了 `baseURL = "https://til.niracler.com/"`，所以我的博客地址是 `https://til.niracler.com/`，此时需要设置自定义域名。（因为我的域名是托管在 cloudflare 上的，所以直接就用了）

访问 Cloudflare 仪表板，导航至 "Workers & Pages"，选择您的 Pages 项目。进入 "Custom domains" 部分。

![](https://image.niracler.com/2025/03/c5ec3eeee275cb432a384b9af5c917a1.png)

点击 "Set up a custom domain"，输入 "til.niracler.com"，然后选择 "Continue"。 Cloudflare 将提供后续指导，具体取决于域名类型（顶域或子域）。

![](https://image.niracler.com/2025/03/c5ec3eeee275cb432a384b9af5c917a1.png)

好啦，大功告成。请点击：[https://til.niracler.com/](https://til.niracler.com/) 查看效果。（丑爆了，留给未来的自己改吧。）

![](https://image.niracler.com/2025/03/e3c2172a09cef870a131c154a70b642a.png)

## One More Thing

### 将 `public` 目录放到 `gitignore`

其实我们是不需要将 public 目录上传上去的。

- 对于使用 Hugo 和 Cloudflare Pages 的博客，**不建议将 `public` 文件夹上传到 GitHub 仓库**。
- `public` 文件夹是 Hugo 构建生成的静态文件，Cloudflare Pages 会在部署时自动运行 `hugo --minify` 生成这些文件，因此无需手动上传。
- 只需上传源文件（包括 `content`、`themes`、`hugo.toml` 等），保持仓库轻量并避免冗余。

为了确保 `public` 文件夹不会意外上传到 GitHub，建议在项目根目录创建或编辑 `.gitignore` 文件，添加以下内容，这会忽略 `public` 文件夹及其所有内容：（上面流程下来，应该是没有这个文件，不过 anyway，我们使用追加的方式。）

```bash
echo -e "\npublic/" >> .gitignore
```

如果您之前已将 `public` 上传到仓库，可以运行以下命令清理：

```bash
git rm -r --cached public
git add .gitignore
git commit -m "Removed public folder and added .gitignore"
git push
```

验证方法

- 检查当前仓库：访问 `https://github.com/niracler/til`，确认 `public/` 是否已上传。
- 如果已上传，建议删除（参考 `.gitignore` 清理步骤）。
- 查看 Cloudflare Pages 部署日志，确保构建命令 `hugo --minify` 正常运行并生成 `public/`。

### 本地与部署的工作流程

#### 本地开发

- 编辑文章（`content/post/`）和配置文件（`hugo.toml`）。
- 运行 `hugo server` 本地预览，Hugo 会生成 `public/` 文件夹供测试。
- 测试完成后，无需保留 `public/`，它会在下次构建时重新生成。

**推送到 GitHub**，提交并推送源文件：

```bash
git add .
git commit -m "Updated TIL post"
git push
```

#### Cloudflare Pages 部署

- Cloudflare Pages 检测到推送后，运行 `hugo --minify`，生成 `public/` 文件并部署。
- 您无需手动干预 `public/` 的内容。

### 添加额外功能

你希望博客有评论系统、访问统计和社交分享按钮，以下是实现方法：
（略，差不多得了，下篇再写）

## 参考资料

关键文档

- [Hugo 官网安装指南](https://gohugo.io/getting-started/installing/)
- [PaperMod GitHub 仓库](https://github.com/adityatelange/hugo-PaperMod)
- [Cloudflare Pages Hugo 框架指南](https://developers.cloudflare.com/pages/framework-guides/hugo/)
- [Hugo TIL 博客搭建指南 | Shared Grok Conversation](https://grok.com/share/bGVnYWN5_05b6e35e-a110-47ef-9ef9-b271333f1cec) - 与 Grok 的完全对话记录

资源和进一步学习

- 官方 Hugo 文档：[Hugo 官网](https://gohugo.io/)，提供详细教程和 API 参考。
- PaperMod 社区支持：查看 GitHub 讨论区，获取用户经验分享。
- Cloudflare Pages 论坛：解决部署问题，优化性能。

