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

Claude Code 默认每次文件写入和 bash 命令都要手动确认。Anthropic 数据显示用户批准了 93% 的请求[^1]，绝大多数确认是走过场，反而让人疲了，不再认真看就直接点 approve。

常见"解法"是开 DSP，但这跳过所有安全检查[^2]，等于给 Claude 完整 shell 权限。我们需要更好的方案。

## 四层安全机制速览

| 层 | 机制 | 确定性 | 覆盖范围 | 额外开销 |
|---|------|--------|----------|----------|
| 1 | **Sandbox**（OS 沙箱） | 确定性，内核强制 | Bash 子进程 | 零 |
| 2 | **Permission Rules**（allow/deny 规则） | 确定性，模式匹配 | 所有工具 | 零 |
| 3 | **Auto Mode**（AI 分类器） | 非确定性 | 所有操作 | Token 消耗 |
| 4 | **Hooks**（自定义脚本） | 确定性 | 所有工具 | 低 |

**推荐组合**：Layer 1 + Layer 2，全部确定性、零开销。Layer 3 可选叠加（需 Team plan）。

## 关键机制详解

### Sandbox：减少弹窗的核心

Sandbox 用 OS 原生的进程隔离机制（macOS 内置的 Seatbelt / Linux 上的 bubblewrap[^3]）限制 bash 子进程能访问的文件和网络。所有子进程继承相同限制，`kubectl`、`npm`、`terraform` 都受约束。

核心开关是 `autoAllowBashIfSandboxed`[^4]：启用后，能在沙箱内运行的 bash 命令**自动放行，不弹窗**。无法沙箱化的命令回退到常规确认流程。这个开关独立于 permission mode，即使不在 acceptEdits 模式下，沙箱内的命令也会自动执行[^4]。

**配置示例**：

```jsonc
{
  "sandbox": {
    "enabled": true,                    // 启用 OS 级沙箱（macOS Seatbelt / Linux bubblewrap）
    "autoAllowBashIfSandboxed": true,   // 沙箱内的 bash 命令自动放行，不弹窗（核心减摩擦开关）
    "allowUnsandboxedCommands": false,  // 禁止沙箱外执行命令（关闭逃逸出口）
    "excludedCommands": ["docker"],     // 这些命令不走沙箱，回退到常规权限流程
    "filesystem": {
      "denyRead": ["~/.ssh", "~/.aws", "~/.gnupg"],  // OS 级禁读，bash 子进程也无法 cat 这些文件
      "denyWrite": ["~"],               // OS 级禁写整个家目录
      "allowRead": [".", "~/.gitconfig"], // 在 denyRead 范围内重新放行的路径
      "allowWrite": ["."]              // 仅允许写当前项目目录
    },
    "network": {
      "allowedDomains": ["github.com", "registry.npmjs.org"],  // 网络白名单，其他域名全部阻止
      "allowLocalBinding": false,       // 是否允许绑定本地端口
      "httpProxyPort": null,            // 自定义 HTTP 代理端口（企业用）
      "socksProxyPort": null            // 自定义 SOCKS 代理端口（企业用）
    }
  }
}
```

**路径语法**[^4]：

| 前缀 | 含义 | 示例 |
|------|------|------|
| `/` | 绝对路径 | `/tmp/build` |
| `~/` | 家目录 | `~/.kube` → `$HOME/.kube` |
| `./` 或无前缀 | 项目根目录（项目设置中）或 `~/.claude`（用户设置中） | `./output` |

> **注意**：sandbox 路径语法和 Permission Rules 不同。sandbox 中 `/tmp` 是绝对路径；Permission Rules 中 `/src` 是项目相对路径（绝对路径要用 `//path`）[^2][^4]。

**已知限制**[^4]：

- `docker` 和 `watchman` 不兼容沙箱，需加入 `excludedCommands`
- 网络过滤基于域名，不检查流量内容，存在 domain fronting（域前置，利用 CDN 伪装目标域名）风险
- `allowUnixSockets` 配不好可能沙箱逃逸（如允许 `/var/run/docker.sock`）
- 内置逃逸出口：命令因沙箱失败时 Claude 可能用 `dangerouslyDisableSandbox` 参数重试（会回退到常规确认），设 `"allowUnsandboxedCommands": false` 可禁用

Sandbox 的覆盖边界[^2][^4]：

| 工具类型 | Sandbox 管辖？ | 默认需确认？ | 减少弹窗的方式 |
|----------|---------------|-------------|---------------|
| Bash 命令 | 是（OS 级） | 是 | `autoAllowBashIfSandboxed` |
| Read/Grep/Glob | 否 | 否（只读免确认） | 无需额外配置 |
| Edit/Write | 否 | 是 | `acceptEdits` 模式或 allow 规则 |
| MCP 工具 | **否** | **是** | **只能靠 `permissions.allow` 规则** |
| WebFetch | 否 | 是 | allow 规则或 `acceptEdits` 模式 |

值得注意的是，**MCP 工具不受 sandbox 管辖**。如果你用了大量 MCP 工具（GitHub、云效、Home Assistant 等），sandbox 帮不上忙，需要在 `permissions.allow` 中显式放行读操作类的 MCP 工具（如 `mcp__github__get_*`）来减少弹窗。

### Permission Rules：硬性边界

通过 `allow`/`ask`/`deny` 三个列表做模式匹配。评估顺序：deny → ask → allow，**deny 始终优先**[^2]。

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",    // 允许所有 npm run 子命令，不弹窗
      "Bash(git commit *)"  // 允许 git commit，不弹窗
    ],
    "deny": [
      "Bash(sudo *)",             // 禁止提权
      "Bash(git push --force*)",  // 禁止强推
      "Bash(git reset --hard*)",  // 禁止硬重置
      "Read(~/.ssh/**)",          // 禁止读 SSH 密钥（仅阻止 Claude 内置 Read 工具）
      "Read(~/.aws/**)"           // 禁止读 AWS 凭证（同上，bash 子进程需用 sandbox denyRead）
    ]
  }
}
```

有个容易踩的坑：Read/Edit deny 规则只阻止 Claude 内置工具，不阻止 Bash 子进程[^2]。比如 `Read(./.env)` 的 deny 不会阻止 `cat .env`。要 OS 级阻止，得用 sandbox 的 `denyRead`。

### Auto Mode：AI 分类器（可选）

独立的 Sonnet 4.6 分类器在每次操作前审核是否安全[^1]。两阶段架构：快速过滤 → 推理链。最终效果是每 250 次合法操作约 1 次误阻（假阳性 0.4%），但每 6 次应被阻止的危险操作中约有 1 次被放行（假阴性 17%）。

Simon Willison 对此的评价比较直接[^5]：

> "I trust those [deterministic sandboxes] a whole lot more than prompt-based protections like this new auto mode."
>
> （比起这种基于 prompt 的新 auto mode，我更信任确定性的沙箱机制。）

Anthropic 自己也承认[^1]：auto mode 并非高风险基础设施上的人工审查替代品。

可用性方面，目前仅 Team plan 可用（research preview），Enterprise 和 API 即将支持，**Max plan 和 Pro plan 暂不支持**[^1]。

所以结论是：Auto Mode 是加分项，不是必需项。Sandbox + deny 规则已能解决大部分弹窗问题，有 Team plan 的话可以叠加使用。

### Permission Modes 速查

在 CLI 中按 **Shift+Tab** 可实时切换[^6]：

| 模式 | 弹窗 | 安全 | 适用场景 |
|------|------|------|----------|
| `default` | 全部确认 | 手动审查 | 敏感操作 |
| `acceptEdits` | 文件编辑免确认 | 手动审查 | 日常开发 |
| `plan` | 只读，不能改文件 | 只读 | 方案探索 |
| `auto` | 几乎无弹窗 | AI 分类器 | 长任务（仅 Team/Enterprise plan） |
| `bypassPermissions` | 无弹窗 | **无** | 仅限隔离容器 |

## 配置作用域

| 作用域 | 文件 | 影响 | 共享？ |
|--------|------|------|--------|
| **User** | `~/.claude/settings.json` | 所有项目 | 否 |
| **Project** | `.claude/settings.json` | 本仓库所有人 | 是（git） |
| **Local** | `.claude/settings.local.json` | 你在本仓库 | 否（gitignore） |
| **Managed** | 系统级 `managed-settings.json` | 机器所有用户 | IT 部署 |

优先级：Managed > CLI 参数 > Local > Project > User[^7]。**deny 在任何层级生效后，其他层级无法覆盖**。

Sandbox 路径在多个 scope 中合并（merge），不替换[^4]。

## 推荐方案：分层安全模型

### 全局底线（`~/.claude/settings.json`）

所有项目共享的安全基础：

```jsonc
{
  "permissions": {
    "allow": [
      // 内置只读工具，安全无副作用，全局放行
      "Glob", "Grep", "Read", "ToolSearch", "WebFetch", "WebSearch"
    ],
    "deny": [
      // 危险系统操作
      "Bash(sudo *)",                   // 禁止提权
      "Bash(mkfs *)", "Bash(dd *)",     // 禁止磁盘格式化/低级写入
      "Bash(wget *|bash*)", "Bash(curl *|bash*)",  // 禁止下载并执行脚本
      // 危险 git 操作
      "Bash(git push --force*)", "Bash(git push *--force*)",  // 禁止强推
      "Bash(git reset --hard*)",        // 禁止硬重置
      // 敏感文件保护（Claude 内置工具层面）
      "Read(~/.ssh/**)",                // SSH 密钥
      "Read(~/.gnupg/**)",              // GPG 密钥
      "Read(~/.aws/**)",                // AWS 凭证
      "Read(~/.config/gh/**)",          // GitHub CLI token
      "Read(~/.docker/config.json)",    // Docker 注册表凭证
      "Edit(~/.bashrc)", "Edit(~/.zshrc)",  // 禁止修改 shell 配置
      "Edit(~/.ssh/**)"                 // 禁止修改 SSH 配置
    ]
  },
  "sandbox": {
    "enabled": true,                    // 启用沙箱
    "autoAllowBashIfSandboxed": true,   // 沙箱内命令自动放行（核心减摩擦开关）
    "allowUnsandboxedCommands": false,  // 关闭逃逸出口
    "filesystem": {
      // OS 级保护（与上面 deny 互补，防止 bash 子进程通过 cat 等绕过）
      "denyRead": ["~/.ssh", "~/.gnupg", "~/.aws", "~/.config/gh",
                    "~/.docker/config.json"],
      "denyWrite": ["~"],               // 禁写整个家目录
      "allowRead": [".", "~/.gitconfig", "~/.local"],  // 放行项目 + git 配置
      "allowWrite": ["."]               // 仅允许写当前项目
    }
  }
}
```

### 按项目覆盖（`.claude/settings.local.json`）

**Level 1 — 信任区**（个人项目、内部工具）：全局配置已够用，无需额外 local 配置。

**Level 2 — 标准区**（团队项目）：加网络白名单 + 生产保护。

```jsonc
{
  "sandbox": {
    "network": {
      "allowedDomains": [             // 只允许访问这些域名，其余全阻止
        "github.com",                 // 代码托管
        "codeup.aliyun.com",         // 云效代码托管
        "registry.npmjs.org",         // npm 包注册表
        "pypi.org"                    // Python 包注册表
      ]
    }
  },
  "permissions": {
    "deny": [
      "Bash(git push * main)",        // 禁止直接推 main
      "Bash(git push * master)",      // 禁止直接推 master
      "Bash(npm publish *)"           // 禁止发布 npm 包
    ]
  }
}
```

**Level 3 — 隔离区**（审查外部代码）：只读 + 无网络。

```jsonc
{
  "sandbox": {
    "autoAllowBashIfSandboxed": false,  // 关闭自动放行，每个命令都要确认
    "allowUnsandboxedCommands": false,   // 关闭逃逸出口
    "filesystem": {
      "denyRead": ["~"],                 // 禁读整个家目录
      "allowRead": ["."],               // 仅放行当前项目（只读）
      "denyWrite": ["~", "."],          // 禁写一切，包括当前项目
      "allowWrite": []                   // 不允许写任何地方
    },
    "network": { "allowedDomains": [] }  // 完全禁止网络访问
  },
  "permissions": { "defaultMode": "plan" }  // plan 模式：Claude 只能分析，不能修改
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

## 落地步骤

1. **改全局 settings.json**：加入上面的 sandbox + deny 配置。原来的大量 Bash allow 规则可以删掉，sandbox 接管了
2. **测试**：跑一遍日常操作（git、npm/pnpm、python、文件读写），确认没有误阻
3. **按项目加 local 配置**：团队项目加 Level 2，不信任的仓库加 Level 3
4. **用 `/permissions` 微调**：看到被阻止的操作，按需加到 allow 或调整 sandbox 路径
5. **（可选）叠加 Auto Mode**：有 Team plan 的话，`Shift+Tab` 切到 auto 模式，file edit 确认也能省掉
6. **让 Claude 帮你调**：用了一段时间之后，可以直接让 Claude Code 帮你审视配置。它能读你各个项目的 settings.json，翻过去的 session 记录，找出哪些地方反复被权限卡住，然后对照本文的分层模型给出调整建议。比如：

```text
读一下我的 ~/.claude/settings.json 和各项目的 settings.local.json，
再看看我过去各个 project 的 session 里有哪些权限相关的摩擦（反复被弹窗确认、被 deny 阻断、sandbox 误阻等），
结合这篇文章的分层模型，帮我诊断一下当前配置有什么可以优化的地方。
```

## 方案对比总结

| 方案 | 安全 | 弹窗 | 开销 |
|------|------|------|------|
| 纯 DSP | 极低 | 零 | 零 |
| Docker + DSP | 高 | 零 | 重 |
| Auto Mode 单独 | 中 | 低 | Token |
| **Sandbox + deny 规则** | **高** | **低** | **零** |

## 脚注

[^1]: Anthropic Engineering, ["Claude Code auto mode: a safer way to skip permissions"](https://www.anthropic.com/engineering/claude-code-auto-mode), 2026-03-24.

[^2]: Claude Code Docs, ["Configure permissions"](https://code.claude.com/docs/en/permissions).

[^3]: [bubblewrap](https://github.com/containers/bubblewrap) — Linux 上 sandbox 使用的隔离工具.

[^4]: Claude Code Docs, ["Sandboxing"](https://code.claude.com/docs/en/sandboxing).

[^5]: Simon Willison, ["Auto mode for Claude Code"](https://simonwillison.net/2026/Mar/24/auto-mode-for-claude-code/), 2026-03-24.

[^6]: Reddit r/ClaudeAI, ["Claude Code now has auto mode"](https://reddit.com/r/ClaudeAI/comments/1s2ok85/claude_code_now_has_auto_mode/) (729 upvotes, 114 comments), 2026-03. 另见 Claude Code Docs, ["Permission modes"](https://code.claude.com/docs/en/permission-modes).

[^7]: Claude Code Docs, ["Settings"](https://code.claude.com/docs/en/settings).
