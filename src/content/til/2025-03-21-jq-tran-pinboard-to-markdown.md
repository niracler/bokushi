---
title: "用 jq 把 Pinboard 文章导出为 Markdown"
description: "编写 jq 脚本批量获取 Pinboard 收藏，并转换成写作时好用的 Markdown 列表。"
pubDate: "Mar 21, 2025"
socialImage: "https://image.niracler.com/2025/03/2e3bf667bb2c02aa253c16a0aae5b762.png"
tags: [ "TIL", "工具", "脚本", "书签" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。

## 要干什么

主要是为了写周记的时候方便，可以直接复制粘贴。

## 偷工减料版

```bash
export PINBOARD_TOKEN=your-api-token
curl -sS "https://api.pinboard.in/v1/posts/all?format=json&auth_token=$PINBOARD_TOKEN" \
    | jq -r '.[] | "- [\(.description)](\(.href)) - \(.extended)"'
```

效果，就是生成像下面这种格式的 markdown 列表

```md
- [simonw/til: Today I Learned](https://github.com/simonw/til/blob/main/ab/apache-bench-length-errors.md) - 可以考虑用这种格式来写 TIL, 纯 markdown 就可以了，大块代码以及图片用外面的链接就好。关键是每一个思路要写完整，不要滥竽充数。然后达到一定的
- [Downloading a video should be “fair use” as recording a song from the radio | Hacker News --- 下载视频应该像从广播中录制歌曲一样“合理使用”|黑客新闻](https://news.ycombinator.com/item?id=37112615) - 其实我还是不懂这种下载是违法还是怎么说
- [一个大学老师决定去送外卖](https://mp.weixin.qq.com/s/cSL-Inf0QDKOPJd4yzkAGw) - <blockquote>长年在象牙塔内，他想从封闭、自负和优越感中突围。</blockquote>
- [中国的防火长城是如何检测和封锁完全加密流量的](https://gfw.report/publications/usenixsecurity23/zh/) -
- [You’re probably using the wrong dictionary « the jsomers.net blog --- 您可能使用了错误的字典 « jsomers.net 博客](https://jsomers.net/blog/dictionary) - 一个好的词典原来作用可以这么大
- [使用自动化工作流聚合信息摄入和输出 | Reorx’s Forge](https://reorx.com/blog/sharing-my-footprints-automation/) - <blockquote>展示我是如何用 n8n 将 Twitter, YouTube, GitHub, Douban 等服务的动态同步到 Telegram Channel，实现个人数字生活的信息聚合。</blockquote>
- [nodebestpractices/README.chinese.md at master · goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.chinese.md) -
- [37%法則 - MBA智库百科](https://wiki.mbalib.com/zh-tw/37%25%E6%B3%95%E5%88%99#:~:text=%5B%E7%B7%A8%E8%BC%AF%5D-,%E4%BB%80%E9%BA%BC%E6%98%AF37%25%E6%B3%95%E5%89%87,%E4%B9%9F%E5%B0%B1%E6%98%AF11%E5%80%8B%E6%88%BF%E5%AD%90%E3%80%82) - <blockquote>37%法則、37%規則37%法則，出自《演算法之美》一書。意思是經過數學家歐拉的實驗，以37%作為分界點，前面的時間用來觀察，後面的時間用來作決策的一種方法。舉例來說，比如要買房子，整個地區的房子有30處，那麼需要先看37%的房子，也就是11個房子。37%前的房子只看不買，但是要記住自己認為最好的是什麼樣子。看完後，從37%以後只有遇到比之前最好的還要好的房子就應該下手買。</blockquote>
- [（译）2023 年每个软件开发者都必须知道的关于 Unicode 的基本知识 | 新世界的大门](https://blog.xinshijiededa.men/unicode/) - <blockquote>自从那时以来，Python 已经进步了，CD-ROM 已经过时了，但其余的仍然停留在 UTF-16 或甚至 UCS-2。因此，UTF-16 作为内存表示而存在。
```

PS. 注意，国内需要代理才能访问 pinboard.in

> 杂鱼想法: 更好的设计是不是应该就是 ny pinboard export --md ? 代理、token 什么都自动设好。 pinboard cli （伪）。

## 参考资料

- [pinboard password](https://pinboard.in/settings/password) - 这里可以找到 token
- [pinboard api](https://pinboard.in/api) - 还可以加更多一些过滤条件，例如 tag 以及时间
- [jq Manual (development version)](https://stedolan.github.io/jq/manual/) - 这个其实问 gpt 即可，' 用 jq 命令去 parse, 格式为每行 [description](href) - extended'
