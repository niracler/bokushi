---
title: "Shadowsocks-Rust + Surge 部署实践"
description: "从零开始部署 Shadowsocks-Rust 服务器，以及如何在 Surge 中配置连接。最大的收获：保持简单就是最好的方案。"
pubDate: "Nov 22, 2025"
tags: ["技术", "网络", "运维", "TIL", "DeepSearch"]
---

> 花了一个早上折腾 Shadowsocks 部署，最大的收获是：**不要试图用 HTTP 反向代理去转发一个本来就不是 HTTP 的协议**。保持简单，直接暴露端口就是最可靠的方案。

## 🎯 为什么要记录这个

最近在云服务器上部署 Shadowsocks 时，一开始想当然地想用 Caddy 做反向代理（毕竟平时习惯了把所有服务藏在反向代理后面）。结果研究了半天才发现：Shadowsocks 是独立的代理协议，本身就有加密，根本不需要也不能通过普通的 HTTP 反向代理转发。

这个认知转变让我意识到，有时候「保持简单」比「看起来专业」更重要。

## 📐 架构设计

```text
Surge 客户端
    ↓
Internet (加密流量)
    ↓
云服务器 (端口 8388)
    ↓
Shadowsocks-Rust (Docker)
```

**核心原则**：Shadowsocks 是独立协议，直接暴露端口即可，无需 HTTP 反向代理。

## 🚀 服务器端部署

### 准备工作

```bash
mkdir -p ~/ss-docker
cd ~/ss-docker
```

生成强密码：

```bash
openssl rand -base64 32
```

### 配置文件

创建 `config.json`：

```json
{
    "server": "0.0.0.0",
    "server_port": 8388,
    "password": "YOUR_STRONG_PASSWORD_HERE",
    "method": "aes-256-gcm",
    "mode": "tcp_and_udp",
    "fast_open": true
}
```

### Docker 部署

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  shadowsocks:
    image: ghcr.io/shadowsocks/ssserver-rust:latest
    container_name: ss-rust
    restart: always
    ports:
      - "0.0.0.0:8388:8388/tcp"
      - "0.0.0.0:8388:8388/udp"
    volumes:
      - ./config.json:/etc/shadowsocks-rust/config.json:ro
    command: ["ssserver", "-c", "/etc/shadowsocks-rust/config.json"]
```

### 防火墙与启动

```bash
# 开放端口
sudo ufw allow 8388/tcp
sudo ufw allow 8388/udp

# 启动服务
docker-compose up -d
docker logs -f ss-rust
```

成功日志示例：

```
INFO shadowsocks server 1.23.4 build ...
INFO shadowsocks tcp server listening on 0.0.0.0:8388
INFO shadowsocks udp server listening on 0.0.0.0:8388
```

## 📱 Surge 客户端配置

在 Surge 配置文件的 `[Proxy]` 部分添加：

```ini
[Proxy]
MySS = ss, ss.niracler.com, 8388, encrypt-method=aes-256-gcm, password=YOUR_PASSWORD, udp-relay=true
```

**参数说明**：

- `ss.niracler.com` - 服务器域名或 IP
- `8388` - 服务器端口
- `encrypt-method=aes-256-gcm` - 加密方式（必须与服务器一致）
- `password` - 密码（必须与 config.json 一致）
- `udp-relay=true` - 启用 UDP 转发

## 🔍 验证与调试

### 服务器端检查

```bash
# 查看容器日志
docker logs -f ss-rust

# 检查端口监听
sudo netstat -tlnp | grep 8388

# 检查防火墙
sudo ufw status
```

### 客户端测试

1. 添加代理配置
2. 选择该节点
3. 测试连接或访问网站
4. 观察服务器日志确认连接成功

## 💡 核心知识点

1. **Shadowsocks 是独立协议**: 不能通过普通 HTTP 反向代理（如 Caddy/Nginx）转发
2. **Surge 原生支持**: 原生支持 Shadowsocks 协议，配置简单
3. **加密已足够**: `aes-256-gcm` 加密安全，无需额外 TLS 层
4. **保持简单**: 直接暴露端口是最可靠的方案

## 📊 配置总结

| 项目 | 配置 |
| ------ | ------ |
| Docker 镜像 | `ghcr.io/shadowsocks/ssserver-rust:latest` |
| 加密方式 | `aes-256-gcm` |
| 服务器端口 | `8388` (TCP & UDP) |
| 客户端 | Surge |
| 是否需要插件 | ❌ 不需要 |
| 是否需要反向代理 | ❌ 不需要 |

---

**优点**: 配置简单、性能优秀、稳定可靠、易于维护。最重要的是：**适合的才是最好的**。
