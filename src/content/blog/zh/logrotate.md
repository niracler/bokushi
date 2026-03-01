---
title: "使用 logrotate 做日志轮换以及自动归档"
pubDate: "Nov 21, 2023"
tags: ["TIL", "Linux", "Shell", "Log"]
socialImage: "https://image.niracler.com/2026/03/a88fc825f1bfd0aab80902683e356ad3.jpeg"
---

logrotate 可以对日志文件进行轮换、压缩并删除旧日志文件，在大多数的 Linux 发行版中都默认安装了 logrotate，而且自动每天执行。

## logrotate 的配置文件

创建并编辑文件 `/etc/logrotate.d/app` ，一般来说，`/etc/logrotate.conf` 中会有 `include /etc/logrotate.d` 这样的配置，这样就会自动加载 `/etc/logrotate.d` 目录下的配置文件。

```bash
/root/app/log/app.log {
    daily          # 每天轮换
    missingok      # 如果日志文件不在也不报错
    rotate 100     # 保留 100 个日志文件
    compress       # 对旧的日志文件进行压缩
    delaycompress  # 延迟压缩直到下一次轮换
    notifempty     # 只有在日志文件不为空的时候才轮换
    dateext             # 使用当前日期作为日志文件的后缀
    dateformat -%Y%m%d  # 设置日期格式
    olddir /root/app/log/old # 设置旧日志文件的存放目录，这个目录必须事先创建好
    sharedscripts # 脚本将在所有日志轮换后一次运行，而不是对每个文件都运行一次
    postrotate    # 日志轮换后执行的脚本
        /usr/bin/docker restart app
    endscript     # 脚本结束
}
```

**注意**：重启服务的时候，可能会导致网络断开，这个需要注意一下。可以使用这种方式来进行测试，测试 restart 过程中的网络是否会断开

```bash
for i in {1..1000}; do { curl -I https://example.com/; sleep 0.3; } ; done
```

## 测试

此处直接使用 logrotate 命令来测试，-d 表示 debug 模式，-f 表示强制执行，-v 表示 verbose 模式，可以看到执行的过程。debug 模式下不会真正执行，只是打印出执行的过程，可以用来测试。

```bash
logrotate -dfv /etc/logrotate.d/app
```

取消 debug 模式后，结果如下

```bash
$ tree
.
├── app.log
└── old
    ├── app.log-20231116.gz
    └── app.log-old

1 directory, 3 files
```

## 可能还存在的问题

1. **权限**: 我当前这边直接用的是 root 用户，所以没有遇到权限问题，如果是其他用户，可能会遇到权限问题，需要注意一下。
2. **重启**: postrotate 中的脚本是在日志轮换后执行的，所以如果是重启服务，可能会导致网络断开，这个需要注意一下。
3. **根据文件大小轮换**: 如果是根据文件大小轮换，那么可能会出现日志文件被截断的情况，这个需要注意一下。我此处没用根据文件大小轮换，所以没遇到这个问题。

## 参考资料

- [Linux 日志切割神器 logrotate 原理介绍和配置详解](https://wsgzao.gitapp.io/post/logrotate/) - 写的很好的一篇文章，里面有讲到 logrotate 的原理。
- [logrotate(8) - Linux man page](https://linux.die.net/man/8/logrotate) - logrotate 的官方文档，用于查看 logrotate 的详细配置。
