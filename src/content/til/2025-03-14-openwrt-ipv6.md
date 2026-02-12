---
title: "OpenWRT 启用 IPv6，让子设备拿到公网地址"
description: "在 OpenWRT 上开启 IPv6 分发的流程与踩坑，方便后续给 Tailscale 等服务使用。"
pubDate: "Mar 14, 2025"
socialImage: "https://image.niracler.com/2025/03/5c38aaa0c519bf066184b086c76d5304.png"
tags: [ "TIL", "网络", "OpenWrt", "IPv6", "DeepSearch" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。

## 要干什么

我想给我宿舍的 window 配置好公网的 IPv6 然后方便可以使用 tailscale 进行穿透。

## 关键要点（未经校对）

- 研究表明，配置 OpenWrt 的 IPv6 需要通过 WAN6 接口使用 DHCPv6 从 ISP 获取前缀。  
- 证据倾向于 LAN 接口设置 ip6assign 64，以分配 /64 前缀给子设备，方便它们通过 SLAAC 或 DHCPv6 获取地址。  
- 防火墙配置需要允许 LAN 到 WAN6 的流量转发，可能涉及额外的安全考虑。  
- 测试连通性可使用 [test-ipv6.com](https://test-ipv6.com) 确保子设备能访问 IPv6 站点。  

## 配置步骤  

注意：以下的配置文件修改改的都是 `/etc/config/network` 这个文件。

### 确认 ISP 支持和接口名称  

首先，确保你的 ISP 提供 IPv6 支持，并确定 OpenWrt 中的 WAN 和 LAN 接口名称。通常为 'wan' 和 'lan'，可通过查看 `/etc/config/network` 确认。  

### 配置 WAN 接口（IPv4）  

确保 WAN 接口已正确配置 IPv4（如 DHCP 或静态 IP）。示例配置（DHCP）：  

```text
config interface 'wan'
    option device 'eth0'
    option proto 'dhcp'
```

如果 ISP 使用 PPPoE，需相应调整。  

### 配置 WAN6 接口（IPv6）  

创建或配置 WAN6 接口，使用 dhcpv6 协议从 ISP 获取 IPv6 前缀。示例：  

```text
config interface 'wan6'
    option device 'eth0'  # 与 WAN 接口相同
    option proto 'dhcpv6'
```

### 配置 LAN 接口（IPv6）  

将 LAN 接口设置为桥接模式，协议为静态，并设置 ip6assign 64 以分配 /64 前缀。示例：  

```text
config interface 'lan'
    option type 'bridge'
    option ifname 'eth1'  # 替换为实际 LAN 接口名称
    option proto 'static'
    option ipaddr '192.168.2.1'  # IPv4 地址（可选）
    option netmask '255.255.255.0'  # IPv4 子网掩码（可选）
    option ip6assign '64'
```

### 配置 DHCP 服务器（IPv6）  

确保 DHCP 服务器为 LAN 接口提供路由器广告（RA）和/或 DHCPv6 服务。示例：  

```text
config dhcp 'lan'
    option interface 'lan'
    option dhcpv6 'server'
    option ra 'server'
```

### 配置防火墙（IPv6）  

为 WAN6 接口创建单独的防火墙区域，并允许从 LAN 到 WAN6 的流量转发。示例：  

```text
config zone
    option name 'wan6'
    option network 'wan6'
    option family 'ipv6'
    option input 'ACCEPT'
    option output 'ACCEPT'
    option forward 'REJECT'
config forwarding
    option dest 'wan6'
    option src 'lan'
```

### 应用更改  

保存配置并重启网络和防火墙服务：  

```text
uci commit
service network restart
service firewall restart
```

### 最终结果

这是我最后得到的 `/etc/config/network`

```bash
$cat /etc/config/network

config interface 'loopback'
 option device 'lo'
 option proto 'static'
 option ipaddr '127.0.0.1'
 option netmask '255.0.0.0'

config globals 'globals'
 option ula_prefix 'fdd4:40f1:2b71::/48'

config device
 option name 'br-lan'
 option type 'bridge'
 list ports 'eth0'

config interface 'lan'
 option type 'bridge'
        option ifname 'eth0'
 option proto 'static'
        option ipaddr '192.168.2.1'
        option netmask '255.255.255.0'
        option ip6assign '64'
        option interface 'lan'
        option dhcpv6 'server'
        option ra 'server'

config zone
    option name 'wan6'
    option network 'wan6'
    option family 'ipv6'
    option input 'ACCEPT'
    option output 'ACCEPT'
    option forward 'REJECT'

config forwarding
    option dest 'wan6'
    option src 'lan'

config interface 'wan'
 option device 'eth1'
 option proto 'dhcp'

config interface 'wan6'
 option device 'eth1'
 option proto 'dhcpv6'
```

## 测试和验证  

从路由器 ping IPv6 地址测试连通性，例如：  

```bash
$ ping6 2001:4860:4860::8888
PING 2001:4860:4860::8888 (2001:4860:4860::8888): 56 data bytes
64 bytes from 2001:4860:4860::8888: seq=0 ttl=54 time=21.947 ms
64 bytes from 2001:4860:4860::8888: seq=1 ttl=54 time=21.384 ms
64 bytes from 2001:4860:4860::8888: seq=2 ttl=54 time=22.012 ms
64 bytes from 2001:4860:4860::8888: seq=3 ttl=54 time=21.772 ms
^C
--- 2001:4860:4860::8888 ping statistics ---
4 packets transmitted, 4 packets received, 0% packet loss
round-trip min/avg/max = 21.384/21.778/22.012 ms
```

从子设备进行相同测试，确保能访问 IPv6 站点。使用 [test-ipv6.com](https://test-ipv6.com) 验证 IPv6 连通性。

(虽然说感觉有什么问题，但大体上是可以的)
![test-ipv6.com IPv6 连通性测试结果](https://image.niracler.com/2025/03/5c38aaa0c519bf066184b086c76d5304.png)

到此，我 windows 设备使用 `tailscale netcheck` 能拿到公网 IPv6 了。

![tailscale netcheck 显示已获取公网 IPv6](https://image.niracler.com/2025/03/6b6464bf6599c8edf0a3b32d7ac286c0.png)

## 关键引文（未经校对）

- [OpenWrt Wiki IPv6 configuration about 10 words](https://openwrt.org/docs/guide-user/network/ipv6/config)  
- [OpenWrt Wiki IPv6 firewall examples about 10 words](https://openwrt.org/docs/guide-user/firewall/fw3_configurations/fw3_ipv6_examples)  
- [Simple IPv6 setup with OpenWRT Necromancer's notes about 10 words](https://ncrmnt.org/2018/11/25/simple-ipv6-setup-with-openwrt/)  
- [IPv6 with OpenWrt onemarcfifty video guide about 10 words](https://www.onemarcfifty.com/blog/video/IPv6_with_OpenWrt/)  
- [IPv6 connectivity test website about 10 words](https://test-ipv6.com)
