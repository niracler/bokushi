---
title: "给他人开通 SSH 公钥登录"
description: "在服务器上为协作者添加公钥、设置权限并验证登录的最小步骤记录。"
pubDate: "Dec 02, 2025"
tags: [ "TIL", "SSH", "服务器", "安全", "DeepSearch" ]
---

> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。

## 要干什么

给同事或朋友开放 SSH 访问时，用公钥登录比密码安全省心。下面记录在 Linux 服务器（OpenSSH）里为某个用户追加他人公钥的完整流程。

## 准备

- 你在服务器上有目标账号的 shell 或 sudo/root 权限
- SSH 服务已运行（通常是 `sshd`），端口默认 22
- 计划让对方使用哪个系统用户（避免直接用 root）

## 拿到对方的公钥

让对方提供 `.pub` 文件里的那一行（以 `ssh-ed25519` 或 `ssh-rsa` 开头）。如果他们还没有密钥，给出生成命令：

```bash
ssh-keygen -t ed25519 -C "name@example.com"
cat ~/.ssh/id_ed25519.pub
```

复制输出的整行发给你。

## 在服务器添加公钥

> 在**目标用户**的身份下操作（若当前是 root，请 `su - username`），这样文件会写到对方的家目录。

```bash
# 1) 确保 .ssh 目录存在且权限正确
install -d -m 700 ~/.ssh

# 2) 追加公钥，一行一个，保留注释便于识别
echo 'ssh-ed25519 AAAAC3... teammate@example.com' >> ~/.ssh/authorized_keys

# 3) 修正权限（权限不对会被 sshd 拒绝）
chmod 600 ~/.ssh/authorized_keys
```

如果从 root 写入，还需保证归属：

```bash
chown -R username:username /home/username/.ssh
```

## 检查 sshd 配置（通常默认即满足）

`/etc/ssh/sshd_config` 里确认：

```text
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

修改后重载服务：

```bash
sudo systemctl reload sshd  # 或 sudo service ssh restart
```

## 让对方测试

```bash
ssh username@your.server.ip
# 如自定义了密钥文件
ssh -i ~/.ssh/id_ed25519 username@your.server.ip
```

若提示密码或连接失败，在服务器查看日志排查：

```bash
sudo tail -f /var/log/auth.log    # Debian/Ubuntu
# 或
sudo tail -f /var/log/secure      # CentOS/RHEL
```

## 常见坑

- `.ssh` 目录权限应是 700，`authorized_keys` 是 600，家目录别设成 777。
- 云服务要同时开放安全组/防火墙的 22 端口，例如 `sudo ufw allow ssh`。
- 粘贴公钥时避免换行或额外空格；Windows 复制的行尾有时会带 CRLF。
- 每个公钥单独占一行，注释部分可以写姓名或邮箱方便日后清理。
