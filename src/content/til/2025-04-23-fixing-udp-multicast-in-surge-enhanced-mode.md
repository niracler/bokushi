---
title: "解决 Surge 增强模式下 UDP 组播失效的问题"
description: "定位 Surge Enhanced 模式导致的组播丢包，并通过路由策略修复的过程记录。"
pubDate: "Apr 23, 2025"
socialImage: "https://image.niracler.com/2025/03/2e3bf667bb2c02aa253c16a0aae5b762.png"
tags: [ "TIL", "网络", "Surge", "多播", "DeepSearch" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。


## 要干什么

今天在 macOS 上使用一个 Node.js 脚本通过 UDP 组播 (Multicast) 发现局域网内的智能网关设备。脚本大致逻辑是向组播地址 `239.255.255.250` 的 `1900` 端口发送发现指令，并监听本地端口等待设备响应。

在 Surge 未开启增强模式 (Enhanced Mode) 时，脚本工作正常。但一旦开启增强模式，即使 Surge 规则配置了局域网直连，脚本也无法收到任何设备的响应。同时，开启了 Surge 的 DHCP 功能。

## 探索过程

1. **初步排查:**
    * 确认 Surge 规则中 `FINAL,PROXY` 或类似规则不会拦截局域网通信。
    * 确认 macOS 防火墙允许 Node.js 或相应端口的入站连接。
    * 尝试在脚本中将组播地址改为广播地址 (`192.168.x.255`)，发现可以工作，这暗示问题与组播的路由方式有关。

2. **理解 Surge 增强模式:**
    * Surge 的增强模式会在 macOS 中创建一个虚拟网络接口 (TUN)，通常名为 `utunX`。
    * 系统会将默认路由指向这个 TUN 接口，使得**几乎所有**的网络流量（除少数系统服务或特殊配置外）先经过 Surge 处理，再决定是走代理还是直连。

3. **分析组播与 TUN 的冲突:**
    * UDP 组播依赖于网络接口加入特定的组播组 (`client.addMembership(multicast_addr)`) 以及从正确的接口发送组播包 (`socket.send(..., multicast_addr)`)。
    * 当增强模式开启时，由于默认路由指向 `utunX`，脚本：
        * 发送组播包时，系统倾向于通过 `utunX` 发送，但 TUN 接口本身通常不适合直接处理物理局域网的组播。
        * 监听并加入组播组时，可能也是在 `utunX` 接口上完成的，导致无法接收到来自物理网卡 (如 `en0`) 的组播包。
    * 简单来说，流量被 Surge “劫持”到了 TUN 接口，但组播这种特殊的局域网通信方式在 TUN 接口上“迷路”了。

## 解决方案

核心思路是让发往组播地址的流量**绕过 TUN 接口**，直接通过物理网卡发送和接收。

在 Surge 的配置文件 `config.conf` (或其他你使用的配置文件) 的 `[General]` 部分，添加或修改 `tun-excluded-routes` 选项，将所有 IP 组播地址范围排除掉：

```ini
[General]
# ... 其他通用设置 ...

# 添加 224.0.0.0/4 到排除列表
tun-excluded-routes = 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, 224.0.0.0/4
```

**解释:**

* `224.0.0.0/4` 这个 CIDR 地址块覆盖了从 `224.0.0.0` 到 `239.255.255.255` 的所有 IPv4 组播地址范围 (Class D)。
* `tun-excluded-routes` 的作用是在系统路由表中添加特定的路由规则，告诉 macOS：凡是目标地址匹配这些网段的数据包，**不要**发送给 Surge 创建的 TUN 接口，而是根据系统原有的路由规则（通常是直接走物理网卡）处理。
* 添加 `224.0.0.0/4` 后，当你的脚本向 `239.255.255.250` 发送数据时，系统会匹配到这条排除规则，数据包将直接通过物理网卡发出。同样，物理网卡接收到的组播包也能被正确监听。

**操作:** 修改配置后，在 Surge 菜单中选择「重新载入配置」使设置生效。

## 最小化测试用例 (Python)

可以创建两个简单的 Python 脚本来模拟这个问题和验证解决方案：

**发送端 (`sender.py`):**

```python
import socket
import time

MULTICAST_GROUP = '239.255.255.250'
MULTICAST_PORT = 1900
MESSAGE = b'Simple Multicast Test Message'

# 创建 UDP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)

# 设置 TTL (Time-To-Live)，防止包在网络中无限循环
# 1 表示只在本地子网传播
sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)

print(f"Sending message to {MULTICAST_GROUP}:{MULTICAST_PORT}")
try:
    while True:
        sock.sendto(MESSAGE, (MULTICAST_GROUP, MULTICAST_PORT))
        print(".", end="", flush=True)
        time.sleep(2)
except KeyboardInterrupt:
    print("\nSender stopped.")
finally:
    sock.close()
```

**接收端 (`receiver.py`):**

```python
import socket
import struct

MULTICAST_GROUP = '239.255.255.250'
LISTEN_PORT = 1900
LISTEN_IP = '0.0.0.0' # 监听所有接口

# 创建 UDP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)

# 允许端口复用
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

# 绑定到监听地址和端口
sock.bind((LISTEN_IP, LISTEN_PORT))

# 告诉内核加入组播组
# INADDR_ANY 表示使用默认接口，但当 TUN 存在时可能选错
# 如果需要显式指定接口，可以用物理网卡的 IP 替换 INADDR_ANY
group = socket.inet_aton(MULTICAST_GROUP)
mreq = struct.pack('4sL', group, socket.INADDR_ANY) # Use INADDR_ANY by default
# 或者: mreq = struct.pack('4s4s', group, socket.inet_aton('YOUR_PHYSICAL_IP'))

sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

print(f"Listening on {LISTEN_IP}:{LISTEN_PORT} for multicast group {MULTICAST_GROUP}")

try:
    while True:
        data, addr = sock.recvfrom(1024)
        print(f"Received message: '{data.decode()}' from {addr}")
except KeyboardInterrupt:
    print("\nReceiver stopped.")
finally:
    # 退出组播组
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_DROP_MEMBERSHIP, mreq)
    sock.close()

```

**测试步骤:**

1. **开启 Surge 增强模式，但不加 `tun-excluded-routes` 规则:**
    * 在一台电脑上运行 `python receiver.py`。
    * 在同一局域网的**另一台**电脑 (或本机，如果网络允许) 上运行 `python sender.py`。
    * 预期：接收端**收不到**消息。
2. **在 Surge 配置中添加 `tun-excluded-routes = ..., 224.0.0.0/4` 并重载:**
    * 保持接收端运行。
    * 再次运行发送端。
    * 预期：接收端**能够收到**发送端的消息。

## 关键知识点

* **Surge 增强模式 (TUN):** 通过创建虚拟网卡拦截和重定向系统流量，实现更底层的代理控制。
* **UDP 组播:** 一种一对多的网络通信方式，数据包发送到特定的组播地址，只有加入了该组播组的接口才能收到。常用于设备发现、流媒体等。
* **路由:** 网络数据包根据目标地址选择下一跳和出接口的过程。增强模式会修改默认路由。
* **`tun-excluded-routes`:** Surge 配置项，用于指定哪些目标地址的流量不应被发送到 TUN 接口，从而绕过 Surge 的底层处理，直接按系统原有路由规则转发（通常是物理网卡）。
* **`224.0.0.0/4`:** IPv4 组播地址的标准范围。

## 总结

Surge 的增强模式通过 TUN 接口改变了系统的默认路由行为，这可能干扰依赖特定接口或路由方式的协议，如 UDP 组播。通过在 `tun-excluded-routes` 中排除组播地址范围 (`224.0.0.0/4`)，可以强制组播流量绕过 TUN 接口，恢复其在局域网中的正常通信。

