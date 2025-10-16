---
title: "用 Caddy 把指定端口的服务暴露到 HTTPS 域名"
description: "记录用 Caddy 反向代理云服务器端口、自动签发证书并上线服务的配置步骤。"
pubDate: "Apr 29, 2025"
socialImage: "https://image.niracler.com/2025/03/2e3bf667bb2c02aa253c16a0aae5b762.png"
tags: [ "TIL", "部署", "Caddy", "证书", "DeepSearch" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。


## 1 要干什么

要使用 Caddy 将运行在云服务器特定端口上的服务通过 HTTPS 暴露在指定域名下。

## 2 要怎么干

### 2.1 安装 Caddy

确保服务器上已安装 Caddy。您可以从 [Caddy 官方网站](https://caddyserver.com/docs/install) 获取安装指南。安装完成后，可以通过以下命令确认 Caddy 的安装路径：

```bash
which caddy
```

### 2.2 配置 DNS

将域名的 DNS 记录指向您的云服务器的公网 IP 地址。

### 2.3 配置 Caddyfile

Caddy 的默认配置文件路径为 `/etc/caddy/Caddyfile`。使用文本编辑器打开配置文件：

```bash
sudo nano /etc/caddy/Caddyfile
```

添加以下配置内容：

```caddy
example.com {
    reverse_proxy localhost:<PORT>
}
```

### 2.4 管理 Caddy 服务

重启 Caddy 服务以应用新配置：

```bash
sudo systemctl restart caddy
```

检查服务状态：

```bash
sudo systemctl status caddy
```

### 2.5 验证 HTTPS

Caddy 会自动为您的域名获取并安装 SSL 证书。在浏览器中访问 `https://example.com`，确认可以通过 HTTPS 访问服务。

## 3 注意事项

Caddy 默认会自动处理 HTTPS 证书的获取和续期，简化了 HTTPS 配置过程。
