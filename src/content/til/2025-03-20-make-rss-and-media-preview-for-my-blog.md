---
title: "为博客补齐媒体预览与 RSS 支持"
description: "记录在站点里加上社交媒体预览图与 RSS 输出的几个关键步骤。"
pubDate: "Mar 20, 2025"
socialImage: "https://image.niracler.com/2025/03/cbd003b59f85210c39ecd48a558ad65b.png"
tags: [ "TIL", "博客", "RSS", "优化", "DeepSearch" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。


## 1 要干什么

我想为博客增强元数据功能，主要包括两方面：

1. 添加媒体预览功能，使文章在社交平台（如Telegram）上分享时能显示精美的预览图；
2. 实现RSS订阅功能，方便读者及时获取博客更新。这些改进将提升博客的专业性和用户体验。

## 2 开始我们的美化工作吧

### 2.1 设置预览图和摘要

```yaml
---
title: "OpenWRT 设置启用 IPv6 让子设备能拿到 IPv6 的 公网 IP （原理未明）"
summary: '为了可以更方便 Tailscale 穿透。'
cover:
  image: 'https://image.niracler.com/2025/03/5c38aaa0c519bf066184b086c76d5304.png'
---
```

其实这里有点小问题，封面在正文里也会显示。与我的初衷不符，不过下次再改吧。

（效果图什么的）

![](https://image.niracler.com/2025/03/37095dd3c784d5ae7838ae04b1ecce52.png)

（遗憾的是，Telegram Instant View 要申请好像挺困难的。但整个预览区域是可点击的，直接链接到文章。）

![](https://image.niracler.com/2025/03/5a3cc265aed801fdeffba4966c889e89.png)

### 2.2 添加网站图标（Favicon）

为博客添加一个网站图标可以提升专业性，并在浏览器标签页中显示您的品牌标识。以下是添加 favicon 的步骤：

1. **准备图标文件**：建议使用 `.ico` 格式，尺寸为 32×32 或 16×16 像素。也可以使用 PNG 格式。

2. **添加到静态目录**：将图标文件放入项目的 `static` 文件夹中：
   - 直接放入 `favicon.ico` 到 `static` 目录
   - 或创建 `static/images` 目录并放入图标文件

3. **配置设置**：在 `hugo.toml` 配置文件中添加：

```toml
[params]
  favicon = "img/favicon.png"  # 放在 static/img 目录
```

可以使用在线工具如 [favicon.io](https://favicon.io/) 生成各种尺寸的图标。添加图标后，网站在浏览器标签页中会显示您的品牌标识，让博客更加专业化。

(效果图)
![](https://image.niracler.com/2025/03/cbd003b59f85210c39ecd48a558ad65b.png)

### 2.2 添加 RSS 支持

**全文 RSS 设置**  : Hugo 默认生成包含摘要的 RSS 提要，但您可以启用全文。在 PaperMod 主题中，可以在 hugo.toml 中添加：

```toml
[params]
    ShowFullTextinRSS = true

    # 顺便添加 RSS 图标
    [[params.socialIcons]]
    name = "rss"
    url = "index.xml"  # 或使用完整链接 "https://til.niracler.com/index.xml"
```

(效果图)
![](https://image.niracler.com/2025/03/c58fede292d013e7dc78cb5e9817e333.png)

然后顺手做个 Follow 认证吧。

### 2.3 添加 RSS feed 描述以验证所有权

要在 RSS feed 中添加特定的描述文本以便在 RSS 阅读器中声明所有权，需要创建自定义的 RSS 模板：

**创建自定义 RSS 模板**：在项目根目录创建 `layouts/_default/rss.xml` 文件（如果不存在）

**编辑 RSS 模板**：将以下内容复制到该文件中（关键是修改 `<description>` 标签）：

```xml
{{- $pctx := . -}}
{{- if .IsHome -}}{{ $pctx = .Site }}{{- end -}}
{{- $pages := slice -}}
{{- if or $.IsHome $.IsSection -}}
{{- $pages = $pctx.RegularPages -}}
{{- else -}}
{{- $pages = $pctx.Pages -}}
{{- end -}}
{{- $limit := .Site.Config.Services.RSS.Limit -}}
{{- if ge $limit 1 -}}
{{- $pages = $pages | first $limit -}}
{{- end -}}
{{- printf "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>" | safeHTML }}
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{{ if eq  .Title  .Site.Title }}{{ .Site.Title }}{{ else }}{{ with .Title }}{{.}} on {{ end }}{{ .Site.Title }}{{ end }}</title>
    <link>{{ .Permalink }}</link>
    <follow_challenge>
        <feedId>125502964885313536</feedId>
        <userId>41434914948866048</userId>
    </follow_challenge>
    <description>Recent content on Niracler's TIL 每日一学</description>
    <generator>Hugo -- gohugo.io</generator>{{ with .Site.LanguageCode }}
    <language>{{.}}</language>{{end}}{{ with .Site.Author.email }}
    <managingEditor>{{.}}{{ with $.Site.Author.name }} ({{.}}){{end}}</managingEditor>{{end}}{{ with .Site.Author.email }}
    <webMaster>{{.}}{{ with $.Site.Author.name }} ({{.}}){{end}}</webMaster>{{end}}{{ with .Site.Copyright }}
    <copyright>{{.}}</copyright>{{end}}{{ if not .Date.IsZero }}
    <lastBuildDate>{{ .Date.Format "Mon, 02 Jan 2006 15:04:05 -0700" | safeHTML }}</lastBuildDate>{{ end }}
    {{- with .OutputFormats.Get "RSS" -}}
    {{ printf "<atom:link href=%q rel=\"self\" type=%q />" .Permalink .MediaType | safeHTML }}
    {{- end -}}
    {{ range $pages }}
    <item>
      <title>{{ .Title }}</title>
      <link>{{ .Permalink }}</link>
      <pubDate>{{ .Date.Format "Mon, 02 Jan 2006 15:04:05 -0700" | safeHTML }}</pubDate>
      {{ with .Site.Author.email }}<author>{{.}}{{ with $.Site.Author.name }} ({{.}}){{end}}</author>{{end}}
      <guid>{{ .Permalink }}</guid>
      <description>{{ with .Description }}{{ . }}{{ else }}{{ if .Site.Params.ShowFullTextinRSS }}{{ .Content | html }}{{ else }}{{ .Summary | html }}{{ end }}{{ end }}</description>
    </item>
    {{ end }}
  </channel>
</rss>
```

重新构建网站部署

(可以啦)
![](https://image.niracler.com/2025/03/e1ed0212923121b1fd7ea8f60dce7b0a.png)

### 关键引文

- [折腾 Hugo & PaperMod 主题](https://dvel.me/posts/hugo-papermod-config/)
