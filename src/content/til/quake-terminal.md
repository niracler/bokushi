---
title: "下拉式终端的魅力，以及 Mac 上 iTerm2 应该如何配置"
description: "分享下拉式终端的效率优势，并一步步配置 iTerm2 Hotkey 窗口，在 macOS 上复刻 Quake 样式的工作流。"
pubDate: "Aug 30, 2023"
updatedDate: "Aug 30, 2023"
socialImage: https://image.niracler.com/2025/10/2742049a443e544d76b5522335a41fbd.png
tags: [ "TIL", "工具", "终端" ]
---

> 在这篇文章中，我们将一同探索下拉式终端的魅力，以及如何在 Mac 操作系统上配置 iTerm2 的下拉模式。

## 背景

大二那一年，我嫌弃 manjaro 的 xfce 桌面环境不好看。适逢滚动式更新滚挂了系统，于是我用上了 manjaro 的 KDE 桌面环境。从那刻起，我与 Yakuake 下拉式终端结下了不解之缘，这种优雅的工具深深地折服了我，使我再也离不开下拉式终端。

## 为何优雅？- 原理与优势

下拉式终端，如 Yakuake，是一种在屏幕上方滑动展示的终端模拟器。它能够通过简单的快捷键在需要时迅速呼出，为用户提供便利的命令行访问方式。

![image](https://image.niracler.com/2025/10/2742049a443e544d76b5522335a41fbd.png)

下拉式终端的设计思想简单而高效。通过触发全局快捷键（我是直接用了 F1 ），终端会以平滑的动画效果从屏幕顶部滑落，为用户展示一个可交互的命令行界面。再次按下快捷键，终端会优雅地滑回隐藏，不会占用屏幕空间。这样的设计带来了诸多优势：

- **即时可用**：无论当前正在进行何种任务，只需按下快捷键，即可立刻调出终端，无需中断工作流程。
- **节省空间**：与传统终端窗口不同，下拉式终端只在需要时出现，不会长时间占用屏幕空间，不干扰其他应用的展示。
- **提升效率**：无需频繁切换窗口，节省时间和精力，特别适合需要频繁使用终端的用户。重要的是您的手指永远不必离开键盘。这就是效率。

## 如何配置？- Mac 上如何配置 iTerm2 的下拉模式

尽管 Yakuake 主要面向 KDE 环境，但在其他操作系统中同样有类似的工具。比如在 Mac 操作系统上，iTerm2 是一款备受欢迎的终端模拟器，同样拥有类下拉式终端的功能（称之为 Hotkey windows）。以下是配置 iTerm2 的简要步骤：

1. 下载并安装 iTerm2:
  [Downloads - iTerm2 - macOS Terminal Replacement](https://iterm2.com/downloads.html)
2. 打开 iTerm2，点击菜单 **iTerm2 > Settings**。
3. 在 Settings 窗口中，选择 **Keys** 选项卡 > **Create a Dedicated Hotkey Window**
   ![image](https://image.niracler.com/2025/10/79f7968b0436d2c77075b85fe97359cf.png)
4. 点击 Hotkey 录制完快捷键之后按 ok 即可（我是使用暴力的 F1)
  ![image](https://image.niracler.com/2025/10/a3e92c587d3938432be06e1152fcdcc2.png)
5. 在新的 Profile 中，您可以设置外观、颜色、字体等个性化选项。(Screen 那里选择 Screen with Cursor 就能随着光标所在的屏幕打开终端)
  ![image](https://image.niracler.com/2025/10/4450c5f08331b656268498b4ba8a31f9.png)
6. 配置完成后，您可以使用设置好的快捷键呼出和隐藏下拉式终端。

## 考究？- 历史缘由

Yakuake 最初的设计灵感来自于 Quake 游戏中的下拉式控制台。Quake 游戏中的这一特性允许玩家在游戏中打开一个类似终端的界面，以便输入指令。Yakuake 将这一概念引入到了桌面环境中，为用户提供了更为高效和便捷的终端使用方式。

## 参考链接

- 我们应该给这篇文章点赞，感觉国内好少人有了解过这个话题：[Mac下拉式终端的安装与配置 (iTerm2) - 知乎](https://zhuanlan.zhihu.com/p/605764402)
- windows terminal 在 2.0 版本之后也支持了 Quake mode [terminal-v2-roadmap.md](https://github.com/microsoft/terminal/blob/main/doc/terminal-v2-roadmap.md)
- 介绍下拉式终端，以及为什么它应该成为桌面工作流的一部分:[链接](https://www.zdnet.com/article/what-is-a-top-down-terminal-and-why-should-you-be-using-one/)
