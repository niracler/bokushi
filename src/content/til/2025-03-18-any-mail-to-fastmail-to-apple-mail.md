---
title: "将所有邮箱整合到 Fastmail，并同步到 Apple Mail"
description: "整理异构邮箱账户到 Fastmail，再通过 IMAP 同步到 Apple Mail 的配置笔记。"
pubDate: "Mar 18, 2025"
socialImage: "https://image.niracler.com/2025/03/f7868c3336cca82f05c5a593b6dd959d.jpeg"
tags: [ "TIL", "工具", "邮箱", "自动化" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。


## 1 要干什么

我想把任何邮件都转发到 Fastmail 邮箱，然后 Fastmail 转发到 Apple Mail。

## 2 从其他邮箱到 fastmail 邮箱

### 2.1 QQ 邮箱邮件迁移并同步到 Fastmail

在 QQ 邮箱中启用IMAP服务是同步的前提条件。操作步骤如下：

1. 登录QQ邮箱，进入设置-帐户
2. 勾选"开启IMAP服务"
3. 生成授权码（POP3/IMAP/SMTP服务项）

（中间会有几次发送短信的流程）
![](https://image.niracler.com/2025/03/b4c7c2db6e596c0d226047fd4ed69463.png)

然后来到 Fastmail，在 My email address 中点击 Add address

![](https://image.niracler.com/2025/03/865465ea940fd8ef4c548ca687fe0de3.png)

其实我们要做的是 Migrate an address。

![](https://image.niracler.com/2025/03/6cde11ebd882703e724b50a2a214746c.png)

然后我们选到 Other（同时我们可以看到 Gmail 那种要同步的话，是超级简单的）

![](https://image.niracler.com/2025/03/b4f0dd24c2d939e430ee8a1714fcab6a.png)

就是填上面拿到的授权码，不是你登陆邮箱的密码。

![](https://image.niracler.com/2025/03/500661f8413768405f4b4c78212a3982.png)

那我们来开导吧～～

![](https://image.niracler.com/2025/03/24e39ce4971b5d3637da4ad8202b8af2.png)

也算是将各种乱七八糟的邮箱迁移到 Fastmail 了。

![](https://image.niracler.com/2025/03/2d30cccefd14e62c7fd6be42c91c8df5.png)

### 3 Apple Mail 的 Fastmail 配置

在 Apple Mail 中，添加账户，然后选择其他账户，然后选择 Fastmail。

![](https://image.niracler.com/2025/03/2fdfd38527340c1e281199116f141918.png)

然后在 Fastmail 中的 Privacy & security -> Connected apps & API tokens 点击 Manage app passwords and access

![](https://image.niracler.com/2025/03/a679b5b497a6579254659fa134977a03.png)

我们 new 一个 password

![](https://image.niracler.com/2025/03/ff1efb97e46e714d566fef56ccc72ba7.png)

然后再回到 Apple Mail 中，填入刚才的 password 就可以了。

![](https://image.niracler.com/2025/03/90816d70068cb7048e9077a4fbadce21.png)

## 4 总结

大功告成！

![](https://image.niracler.com/2025/03/40cc47308bdf5fa56bfc6d033aac0d5d.png)
