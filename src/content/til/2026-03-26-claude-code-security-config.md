---
title: "Claude Code 安全配置指南：减少弹窗，不减安全"
description: "如何用 Sandbox + Permission Rules 替代 dangerously-skip-permissions，在不依赖 Docker/VM 的前提下减少 Claude Code 权限确认弹窗。"
pubDate: "Mar 26, 2026"
tags: ["Claude Code", "安全", "DevTools", "DeepSearch"]
---

> [!NOTE]
> 本文主要由 AI（Claude）协助调研撰写，属于 DeepSearch 系列。

| | |
| :--- | :--- |
| 第一作者 | Claude Opus 4.6 |
| 校对&编辑 | Niracler |
| 调研日期 | 2026-03-26 |

> **核心问题**：如何在不用 `--dangerously-skip-permissions`（DSP）和 Docker/VM 的前提下，让 Claude Code 少弹窗、多干活？
>
> **一句话答案**：启用内置 Sandbox + `autoAllowBashIfSandboxed`，用 OS 级隔离替代逐条审批。

## 为什么需要这份指南

Claude Code 默认每次文件写入和 bash 命令都要手动确认。Anthropic 数据显示用户批准了 93% 的请求[^1]，绝大多数确认是走过场。审批疲劳后反而不认真看，直接点 approve。

常见「解法」是开 DSP，但这跳过所有安全检查[^2]，等于给 Claude 完整 shell 权限。需要更好的方案。

## 四层安全机制速览

| 层 | 机制 | 确定性 | 覆盖范围 | 额外开销 |
|---|------|--------|----------|----------|
| 1 | **Sandbox**（OS 沙箱） | 确定性，内核强制 | Bash 子进程 | 零 |
| 2 | **Permission Rules**（allow/deny 规则） | 确定性，模式匹配 | 所有工具 | 零 |
| 3 | **Auto Mode**（AI 分类器） | 非确定性 | 所有操作 | Token 消耗 |
| 4 | **Hooks**（自定义脚本） | 确定性 | 所有工具 | 低 |

**推荐组合**：Layer 1 + Layer 2，全部确定性、零开销。Layer 3 可选叠加（需 Team plan[^6]）。

## 关键机制详解

### Sandbox：减少弹窗的核心

Sandbox 用 OS 原生隔离（macOS Seatbelt / Linux bubblewrap[^3]）限制 bash 子进程的文件和网络访问。实现细节可参考 Anthropic 的工程博客[^8]。

核心开关 `autoAllowBashIfSandboxed`[^4]：启用后，沙箱内的 bash 命令**自动放行，不弹窗**。

![Claude Code Sandbox 架构图：filesystem + network proxy 隔离示意（来源：Anthropic Engineering Blog）](https://image.niracler.com/2026/03/8032c459bba54d883fab67c23d4758c4.png)

```jsonc
{
  "sandbox": {
    "enabled": true,                    // 启用 OS 级沙箱（默认 false，需手动开启或用 /sandbox 命令）
    "autoAllowBashIfSandboxed": true,   // 沙箱内命令自动放行（默认 true）
    "excludedCommands": ["docker", "git push", "git fetch", "git pull", "git clone"],
    "filesystem": {
      "allowWrite": ["."],              // 白名单：未列出的路径默认不可写
      "denyRead": ["~/.ssh", "~/.aws", "~/.gnupg"]
    },
    "network": {
      "allowedDomains": ["github.com", "registry.npmjs.org"],
      "allowUnixSockets": ["/var/run/docker.sock"],  // 允许 Unix socket
      "allowLocalBinding": true         // 允许本地端口绑定（开发服务器需要）
    }
  }
}
```

**Sandbox filesystem 有四个键**[^4]：

- `allowWrite` — 可写路径白名单，默认只含 `["."]`（当前工作目录）
- `denyWrite` — 禁止写入的路径黑名单
- `denyRead` — 禁止读取的路径黑名单
- `allowRead` — 在 `denyRead` 区域内重新允许读取，优先级高于 `denyRead`

**Sandbox 管辖范围**——注意它只管 Bash[^4]：

| 工具类型 | Sandbox 管辖？ | 减少弹窗的方式 |
|---|---|---|
| Bash 命令 | 是（OS 级） | `autoAllowBashIfSandboxed` |
| Read/Grep/Glob | 否 | 默认免确认（只读） |
| Edit/Write | 否 | `acceptEdits` 模式或 allow 规则 |
| MCP 工具 | **否** | **只能靠 `permissions.allow` 规则** |

### Permission Rules：硬性边界

通过 `allow`/`ask`/`deny` 三个列表做模式匹配。评估顺序：deny → ask → allow，**deny 始终优先**[^2]。

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",    // 允许所有 npm run 子命令
      "Bash(git commit *)"  // 允许 git commit
    ],
    "deny": [
      "Bash(sudo *)",             // 禁止提权
      "Bash(git push --force*)",  // 禁止强推
      "Read(~/.ssh/**)",          // 禁止读 SSH 密钥（仅阻止 Claude 内置 Read 工具）
      "Read(~/.aws/**)"           // bash 子进程需用 sandbox denyRead 阻止
    ]
  }
}
```

> **注意**：Read/Edit deny 规则只阻止 Claude 内置工具，不阻止 Bash 子进程。比如 `deny: ["Read(./.env)"]` 不会阻止 `cat .env`。要 OS 级阻止，得用 sandbox 的 `denyRead`。

### Auto Mode（可选）

独立的 Sonnet 4.6 分类器在每次操作前审核安全性，两层防御（input-layer 探测 + output-layer 分类），误报率仅 0.4%[^1]。Simon Willison 的评价[^5]：

> "I still want my coding agents to run in a robust sandbox by default, one that restricts file access and network connections in a deterministic way. I trust those a whole lot more than prompt-based protections like this new auto mode."

![Auto mode 两阶段分类器流水线（来源：Anthropic Engineering Blog）](https://image.niracler.com/2026/03/017e36e4a2921b9fbf83155ece5d551b.png)

目前需要 Team plan（Enterprise 和 API 即将支持），且要求 Sonnet 4.6 或 Opus 4.6 模型，管理员需先在后台启用[^6]。属于 research preview 阶段。结论：加分项，不是必需项。

### Permission Modes 速查

CLI 中按 **Shift+Tab** 切换[^6]：

| 模式 | 弹窗 | 适用场景 |
|---|---|---|
| `default` | 全部确认 | 敏感操作 |
| `acceptEdits` | 文件编辑免确认 | 日常开发 |
| `plan` | 只读 | 方案探索 |
| `auto` | 几乎无弹窗 | 长任务（需 Team plan[^6]） |
| `dontAsk` | 未预批准则自动拒绝 | CI / 受限环境 |
| `bypassPermissions` | 无弹窗 | 仅限隔离容器 |

## 常见踩坑

### 坑 1：SSH 协议被沙箱网络拦截

沙箱网络通过 HTTP/SOCKS 代理服务器控制出站流量[^4]。SSH 连接是原始 TCP，不走代理，会被 OS 级沙箱直接拦截。因此 `git push`（SSH 协议）在沙箱内必定失败[^9]。

**修复**：将 git 远程操作加入 `excludedCommands`。本地 git 操作（`add`、`commit`）不涉及网络，仍在沙箱内自动放行。

### 坑 2：`excludedCommands` 中的命令仍需手动确认

`excludedCommands` 让命令**跳过沙箱**，但同时也**失去了 `autoAllowBashIfSandboxed` 的自动放行**。这些命令会回到常规权限确认流程——除非你在 `permissions.allow` 中额外添加对应规则。

### 坑 3：默认配置下的隐式写入保护

沙箱默认 `allowWrite` 只覆盖 `["."]`（当前工作目录），因此 `~/.bashrc`、`~/.zshrc` 等路径**默认不可写**。虽然技术上可以通过 `allowWrite` 添加这些路径，但官方**强烈不建议**——允许写入 shell 配置文件或 `$PATH` 中的可执行文件目录可能导致跨安全上下文的代码执行[^4]。

### 其他已知限制

- `docker`、`watchman` 不兼容沙箱，需加入 `excludedCommands`
- 网络过滤基于域名，存在 [domain fronting](https://en.wikipedia.org/wiki/Domain_fronting) 风险（攻击者利用 CDN 共享域名绕过域名白名单）
- Sandbox 只管 Bash 工具，不管 Read/Write/WebSearch/WebFetch/MCP 等[^4]

## 配置作用域

| 作用域 | 文件 | 共享？ |
|---|---|---|
| **User** | `~/.claude/settings.json` | 否 |
| **Project** | `.claude/settings.json` | 是（git） |
| **Local** | `.claude/settings.local.json` | 否（gitignore） |
| **Managed** | 系统级 `managed-settings.json` | IT 部署 |

优先级：Managed > CLI 参数 > Local > Project > User[^7]。**deny 在任何层级生效后，其他层级无法覆盖**。Sandbox 路径跨 scope 合并（merge），不替换。

**最佳实践**：全局底线放 User 级（`~/.claude/settings.json`），项目级只放差异配置。比如你的全局已经配好了 sandbox + deny 规则，项目级只需要加特定工具的放行规则：

```jsonc
// .claude/settings.json（项目级，只放 diff）
{
  "permissions": {
    "allow": [
      "mcp__telegram__*"
    ]
  }
}
```

## 推荐方案：分层安全模型

### 全局底线（`~/.claude/settings.json`）

```jsonc
{
  "permissions": {
    "allow": [
      "Glob", "Grep", "Read", "ToolSearch", "WebFetch", "WebSearch"
    ],
    "deny": [
      "Bash(sudo *)", "Bash(mkfs *)", "Bash(dd *)",
      "Bash(wget *|bash*)", "Bash(curl *|bash*)",
      "Bash(git push --force*)", "Bash(git push *--force*)",
      "Bash(git reset --hard*)",
      "Read(~/.ssh/**)", "Read(~/.gnupg/**)", "Read(~/.aws/**)",
      "Read(~/.config/gh/**)", "Read(~/.docker/config.json)",
      "Edit(~/.bashrc)", "Edit(~/.zshrc)", "Edit(~/.ssh/**)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["docker", "git push", "git fetch", "git pull", "git clone"],
    "filesystem": {
      "denyRead": ["~/.ssh", "~/.gnupg", "~/.aws", "~/.config/gh", "~/.docker/config.json"],
      "allowWrite": ["."]
    }
  }
}
```

### 按项目覆盖

**Level 1 — 信任区**（个人项目）：全局配置已够用，项目级无需额外配置。

**Level 2 — 标准区**（团队项目）：收紧网络 + 保护生产分支。

```jsonc
{
  "sandbox": {
    "network": {
      "allowedDomains": ["github.com", "codeup.aliyun.com", "*.npmjs.org", "pypi.org"]
    }
  },
  "permissions": {
    "deny": ["Bash(git push * main)", "Bash(git push * master)", "Bash(npm publish *)"]
  }
}
```

**Level 3 — 隔离区**（审查外部代码）：只读 + 无网络。

```jsonc
{
  "sandbox": {
    "autoAllowBashIfSandboxed": false,
    "filesystem": {
      "denyRead": ["~"],
      "allowWrite": []
    },
    "network": { "allowedDomains": [] }
  },
  "permissions": { "defaultMode": "plan" }
}
```

### 各等级对比

| | Level 1（信任） | Level 2（标准） | Level 3（隔离） |
|---|---|---|---|
| autoAllowBash | 是 | 是 | 否 |
| 网络限制 | 无 | 域名白名单 | 完全禁止 |
| 写入 | 当前项目 | 当前项目 | 完全禁止 |
| 弹窗频率 | 极低 | 低 | 高（有意为之） |
| 典型场景 | 个人博客 | 公司后端 | 外部 PR review |

## 方案对比总结

| 方案 | 安全 | 弹窗 | 开销 |
|------|------|------|------|
| 纯 DSP | 极低 | 零 | 零 |
| Docker + DSP | 高 | 零 | 重 |
| Auto Mode 单独 | 中 | 低 | Token |
| **Sandbox + deny 规则** | **高** | **低** | **零** |

## 附录：一键审查你的配置

把以下 prompt 复制到 Claude Code 中执行，即可自动审查并优化你的安全配置。

<details>
<summary>点击展开完整 Prompt</summary>

````markdown
请审查我的 Claude Code 安全配置。

## 参考资料

1. 先用 WebFetch 读取这篇指南，理解 Sandbox + Permission Rules 的分层安全模型：
   https://niracler.com/2026-03-26-claude-code-security-config/
2. 再用 context7（resolve-library-id 搜 "claude code"，然后 query-docs）查官方最新文档，
   确认指南中的配置项在当前版本是否仍然适用、是否有新增配置项。

## 执行步骤

1. **收集配置**：读取 `~/.claude/settings.json`（全局）以及所有项目的 `.claude/settings.json` 和 `.claude/settings.local.json`
2. **分析摩擦点**：扫描 `~/.claude/projects/` 下各项目的 session 历史，找出被反复手动确认的高频命令和 bypassPermissions 使用频率
3. **对照指南审查**：按指南中的检查清单（Sandbox、Permission Rules、配置作用域）逐项对照当前配置
4. **输出改动方案**：

| # | 文件 | 现状 | 建议 | 原因 |
|---|------|------|------|------|
| 1 | ... | ... | ... | （引用指南或官方文档中的具体依据） |

以及各项目的摩擦分析表：

| 项目 | 主要摩擦来源 | 建议 allow 规则 |
|------|-------------|----------------|
| ... | ... | ... |

5. **给出修改后的完整 JSON**（可直接复制使用），并列出需要用户手动处理的事项
````

</details>

## 脚注

[^1]: [Claude Code auto mode: a safer way to skip permissions | Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-auto-mode) - Anthropic 工程博客 (2026-03-24)，介绍 auto mode 的设计。文中提到用户批准了 93% 的权限请求，说明大部分确认是走过场。分类器基于 Sonnet 4.6，采用两层防御（input-layer prompt-injection 探测 + output-layer transcript 分类）。

[^2]: [Configure permissions | Claude Code Docs](https://code.claude.com/docs/en/permissions) - 官方权限配置文档，说明 allow/deny/ask 三级规则的评估顺序（deny → ask → allow），以及 Read/Edit deny 规则只阻止内置工具、不阻止 Bash 子进程的重要注意事项。

[^3]: [bubblewrap | GitHub](https://github.com/containers/bubblewrap) - Linux 和 WSL2 上 sandbox 使用的 OS 级隔离工具，提供基于 namespace 的文件系统和网络隔离。macOS 则使用内置的 Seatbelt 框架。

[^4]: [Sandboxing | Claude Code Docs](https://code.claude.com/docs/en/sandboxing) - 官方沙箱文档，说明 sandbox 仅管辖 Bash 子进程，不覆盖 Read/Edit/Write/MCP 等内置工具。包含 filesystem 四个配置键（allowWrite/denyWrite/denyRead/allowRead）、网络隔离（通过代理控制出站流量）的具体配置方式，以及安全限制（domain fronting 风险、Unix socket 提权风险等）。

[^5]: [Auto mode for Claude Code | Simon Willison](https://simonwillison.net/2026/Mar/24/auto-mode-for-claude-code/) - Simon Willison 对 auto mode 的评论 (2026-03-24)。他认为确定性沙箱比基于 prompt 的 AI 分类器更值得信赖。还指出 `pip install -r requirements.txt` 的允许规则无法防御供应链攻击（当天 LiteLLM 事件为例）。

[^6]: [Choose a permission mode | Claude Code Docs](https://code.claude.com/docs/en/permission-modes) - 官方权限模式文档，涵盖 6 种模式（default/acceptEdits/plan/auto/dontAsk/bypassPermissions）的完整对比。CLI 中按 Shift+Tab 循环切换。Auto mode 需要 Team plan（Enterprise 和 API 即将支持），且要求 Sonnet 4.6 或 Opus 4.6 模型，属于 research preview。

[^7]: [Settings | Claude Code Docs](https://code.claude.com/docs/en/settings) - 官方设置文档，列出所有配置项及其作用域（Managed/User/Project/Local）。优先级为 Managed > CLI 参数 > Local > Project > User，deny 在任何层级生效后无法被其他层级覆盖。Sandbox 路径跨 scope 合并（merge）而非替换。

[^8]: [Making Claude Code more secure and autonomous | Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-sandboxing) - Anthropic 工程博客关于沙箱设计的深度技术文章，介绍 Seatbelt (macOS) 和 bubblewrap (Linux) 的实现细节，以及 filesystem + network 双层隔离的安全模型。沙箱运行时已开源为 npm 包 `@anthropic-ai/sandbox-runtime`。

[^9]: 此为根据沙箱网络架构的推断，官方文档未显式提及 SSH 场景。沙箱网络通过 HTTP/SOCKS 代理控制出站流量，SSH 作为原始 TCP 连接不经过代理层，因此会被 OS 级沙箱拦截。
