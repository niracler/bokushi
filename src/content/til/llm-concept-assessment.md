---
title: "理解 LLM 工具链的六个核心概念"
pubDate: 2026-02-11
tags: ["TIL", "LLM", "AI", "Claude Code", "Prompt"]
description: "从 System Prompt 的安全哲学到 Skill 的渐进式披露，梳理 AI Agent 开发中容易混淆的六个核心概念。"
hidden: true
---

## 1 背景

在使用 Claude Code 和 Codex CLI 的过程中，我发现围绕 LLM 工具链有一些概念很容易混淆。于是花了些时间把以下几个术语梳理清楚：

- System Prompt
- User Prompt
- AI Agent
- Agent Tools
- Function Calling
- MCP

一些说明：

1. 这不是八股文，没有标准答案。**关键是，各家厂商对很多概念的理解都是不一样的**。
2. Function Calling 已被 Tool Calling 术语取代（OpenAI 2024 年改名），功能一致但命名更新了。而且与 Agent Tools / MCP 有挺多重叠的地方。

## 2 我也非常好奇的一些问题

1. Talk is cheap, show me the token usage.

    ```bash
    npx @ccusage/codex@latest
    ```

2. Codex CLI 的 System Prompt 可以改么？它是写在哪里的？这个设计是哪家都一样的么？
3. System Prompt / User Prompt / AGENTS.md 的区别？以及他们对 LLM 行为影响程度的权重是一样的么？
4. AI Agent 的核心要点，是会有一个判断循环，LLM 在判断「工作尚未完成」时，不会主动退出进行回复？这理解是对的么？不同模型之间的「放弃任务」的时机也是一样的么？
5. Agent Tools 和 Function Calling 的关系该如何理解？这些 Tools 进行外部调用拿到的结果，是属于 User Prompt 的内容么？
6. Skill 这个概念你如何理解？它解决了什么问题？「渐进式披露」以及「避免反复提及」是它的关键词，你觉得这理解如何？还有什么需要补充的吗？

## 3 我的理解

### 3.1 Q2: Codex CLI 的 System Prompt 可以改么？它是写在哪里的？这个设计是哪家都一样的么？

**结论：可以改，而且各家设计不一样。**

#### 3.1.1 Codex CLI（OpenAI）—— 完全开放

| 层级 | 位置 | 说明 |
|------|------|------|
| 默认系统指令 | `codex-rs/core/` 源码 | 可通过 `--config experimental_instructions_file=<path>` 覆盖 |
| 开发者指令 | CLI 参数 | `--config developer_instructions="..."` |
| AGENTS.md | `~/.codex/` 或项目目录 | 最常用方式，支持 `.override.md` 强制覆盖 |

#### 3.1.2 Claude Code（Anthropic）—— 只能追加

- System Prompt **不可覆盖**，由 Anthropic 内置
- 用户只能通过 `CLAUDE.md` **追加**指令（全局 `~/.claude/` + 项目目录逐层叠加）
- 底层 System Prompt 不公开

#### 3.1.3 API（原始接口）—— 完全自由

API 调用者可以写任意 System Prompt，平台无法限制。

#### 3.1.4 为什么设计不同？—— 安全哲学的差异

```text
安全层级对比
              | Claude Code  |  Codex CLI   |     API
System Prompt | 不可改       | 可改         | 完全自由
主要安全机制   | Prompt + 训练| 沙箱 + 审批  | 纯靠模型训练
设计哲学       | 平台可控     | 用户自负     | 开发者自负
```

**核心洞察**：

1. **本地工具不把 System Prompt 当安全边界** —— 用户本来就能执行任意命令，限制 AI 没意义
2. **云服务需要 System Prompt 作为可信边界** —— 防止用户绕过安全限制
3. **模型训练是最底层的安全层** —— API 用户能绕过任何 prompt 限制，所以必须让模型本身「学会拒绝」

类比：**iOS vs Android** —— 一个封闭可控，一个开放自负。

> **参考资料**
>
> **Codex CLI (OpenAI)**:
>
> - [Custom Prompts](https://developers.openai.com/codex/custom-prompts/) — 介绍如何创建和使用自定义 prompt
> - [Security](https://developers.openai.com/codex/security/) — 安全模型总览：OS 级沙箱、审批策略、网络隔离
> - [AGENTS.md Guide](https://developers.openai.com/codex/guides/agents-md) — AGENTS.md 加载机制
> - [Advanced Configuration](https://developers.openai.com/codex/config-advanced/) — 高级配置选项
>
> **Claude Code (Anthropic)**:
>
> - [Overview](https://docs.anthropic.com/en/docs/claude-code/overview) — Claude Code 功能概述
> - [Memory (CLAUDE.md)](https://docs.anthropic.com/en/docs/claude-code/memory) — 四层记忆系统
> - [GitHub Repo](https://github.com/anthropics/claude-code) — 开源仓库

### 3.2 Q3: System Prompt / User Prompt / AGENTS.md 的区别？以及他们对 LLM 行为影响程度的权重是一样的么？

**结论：权重不同，有明确的优先级层次。**

#### 3.2.1 权重层次总览

| 层级 | 角色 | 权威度 | 说明 |
|------|------|--------|------|
| 1. 模型训练 | 内置于权重 | 最高（不可覆盖） | 安全限制、拒绝有害内容 |
| 2. System Prompt | `system` role | 高 | AI 的身份、行为边界 |
| 3. Developer Prompt | `developer` role | 中高 | 动态规则、业务逻辑 |
| 4. AGENTS.md / CLAUDE.md | 通常以 `user` role 注入 | 中 | 项目约定、代码风格 |
| 5. User Prompt | `user` role | 按位置而定 | 用户的具体问题 |

**权重关系**：模型训练 > System > Developer > User（同级则后出现的覆盖前面的）

#### 3.2.2 关键发现

**1. AGENTS.md 在技术上是 User Role**

根据 Codex 源码，AGENTS.md 是以 **user role** 的消息注入到对话中。这意味着它的权威度**低于** System Prompt，但因为**位置靠后**，在没有冲突时会有较强的影响力。

**2. 用户的显式指令可以覆盖 AGENTS.md**

> If the user's prompt explicitly says otherwise, **the prompt takes precedence**.

所以如果用户在对话中说「忽略 AGENTS.md 的规则」，模型会遵从。

**3. System Prompt 不是绝对的**

> While system prompts are powerful, they're **not absolute**. LLMs may still ignore parts if they conflict with **higher-level alignment guardrails**.

而且不同模型对 System Prompt 的遵守程度不同——Gemini 把它当「建议」而非「硬性约束」。

**4. 位置也是权力**

2025 年的研究论文 *Position is Power* 发现：同样的内容放在 System Prompt vs User Prompt 中，会产生不同的行为偏差。

#### 3.2.3 实际处理流程

```text
模型训练层 (安全对齐)     <- 绝对优先，无法被 prompt 覆盖
       |
System Prompt (平台设定)  <- 高优先级，定义身份和行为边界
       |
Developer Instructions    <- 中高优先级，业务逻辑和规则
       |
AGENTS.md / CLAUDE.md     <- 作为 user role 注入，位置靠前
       |                     可能被后续 user prompt 覆盖
User Prompt (对话内容)    <- 具体任务，位置最后有「最后发言权」
                             但不能违反更高层级的硬性规则
```

#### 3.2.4 这个理解为什么重要？

1. **理解 prompt injection 的原理** —— 攻击者试图用 User Prompt 覆盖 System Prompt 的规则
2. **设计 AI 应用时** —— 关键安全规则应该放在 System Prompt，而不是依赖 AGENTS.md
3. **使用 CLI 工具时** —— 知道你在 CLAUDE.md 写的东西可以被对话中的指令覆盖

> **参考资料**
>
> - [LLM System Prompt vs. User Prompt](https://www.nebuly.com/blog/llm-system-prompt-vs-user-prompt) — System/User Prompt 的处理机制对比
> - [Position is Power (arXiv 2505.21091)](https://arxiv.org/abs/2505.21091) — 2025 年研究：prompt 位置对模型行为的影响
> - [Codex AGENTS.md Guide](https://developers.openai.com/codex/guides/agents-md) — user prompt 可以覆盖 AGENTS.md
> - [Codex Prompt Structure](https://github.com/openai/codex/blob/main/codex-rs/core/prompt.md) — 源码级说明 AGENTS.md 以 user role 注入
> - [OpenAI Model Spec](https://model-spec.openai.com/2025-12-18.html) — 官方定义 system/developer/user 的权威度层次

### 3.3 Q4: AI Agent 的核心是判断循环吗？不同模型的「放弃任务」时机一样吗？

**结论：是的，Agent 的核心是 ReAct 循环；但 LLM 的自我评估不可靠，需要外部机制兜底。**

#### 3.3.1 ReAct 循环架构

这是 Agent 的核心模式（Reasoning + Acting）：

```text
Thought  <- LLM 思考下一步
   |
Action   <- 调用工具执行
   |
Observation <- 获取执行结果
   |
完成了？  <- 关键判断点
   |
No -> 继续循环
Yes -> 输出最终答案
```

#### 3.3.2 关键问题：LLM 的自我评估不可靠

> The self-assessment mechanism of LLMs is **unreliable** — it exits when it **subjectively thinks** it is "complete" rather than when it meets **objectively verifiable** standards.

也就是说：**LLM 可能会「幻觉」认为任务完成了，但实际上并没有**。

#### 3.3.3 解决方案：外部终止机制

| 策略 | 说明 |
|------|------|
| Max Iterations | 设置最大循环次数，防止无限循环（如 `max_iterations=10`） |
| 显式 Submit 工具 | 强制 Agent 调用 `submit()` 表示完成，而非停止调用工具就算完成 |
| 外部验证器 | Ralph Loop：外部函数验证结果，返回 `{complete: false, reason: "..."}` 继续 |
| Token 预算 | 限制总 token 使用量，如 `tokenCountIs(100_000)` |

#### 3.3.4 不同模型的「放弃时机」对比

| 特性 | Claude | GPT |
|------|--------|-----|
| 持续性 | 更倾向于持续、有条理完成任务 | 长链任务可靠性更高（GPT-5.2 达 98.7%） |
| Token 效率 | Opus 4.5 完成同样任务用 48M tokens | GPT-5.1 用 81M tokens |
| 捷径行为 | Claude 4 比早期版本少 65% 的「跳步」行为 | 更激进，可能跳过步骤 |
| Context Window | 200K tokens | GPT-5.2 达 400K tokens |

> Claude takes a more deliberate approach, **breaking problems into sub-tasks** and iterating until solutions are verified.

#### 3.3.5 这个理解为什么重要？

1. **不能完全信任 LLM 的自我判断** —— 所以需要 max_iterations、外部验证器等保底机制
2. **「放弃」时机是可调参数** —— 不是模型固有属性，而是框架设计决定的
3. **不同模型的「韧性」不同** —— Claude 更稳健保守，GPT 更激进但可能跳步
4. **审批机制的意义** —— 不是不信任 LLM 的能力，而是不信任它的自我评估

> **参考资料**
>
> - [From ReAct to Ralph Loop](https://www.alibabacloud.com/blog/from-react-to-ralph-loop-a-continuous-iteration-paradigm-for-ai-agents_602799) — ReAct 的局限性与外部验证器
> - [What is a ReAct Agent (IBM)](https://www.ibm.com/think/topics/react-agent) — ReAct 模式的标准定义
> - [Loop Agents (Google ADK)](https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/) — max_iterations 与终止条件设计
> - [LangChain Max Iterations](https://python.langchain.com/v0.1/docs/modules/agents/how_to/max_iterations/) — early stopping 策略
> - [ChatGPT vs Claude for AI Agent Architects](https://datagrid.com/blog/chatgpt-vs-claude-ai-agent-architects) — Agent 场景下的行为差异对比

### 3.4 Q5: Agent Tools 和 Function Calling 的关系？工具结果属于什么角色？

**结论：Tools 是 Function Calling 的上层封装；工具结果以专用角色注入，权威度等同于 User。**

#### 3.4.1 层次关系

```text
Agent Framework 层
  Agent Tools
  - 工具定义 (schema)
  - 执行逻辑 (implementation)
  - 结果处理 (parsing)
  - 错误处理 (error handling)
          | 调用
LLM API 层
  Function Calling / Tool Calling
  - 模型输出结构化的「调用意图」
  - 模型本身不执行任何代码
```

#### 3.4.2 关键洞察

> **LLM 不执行工具，它只表达使用意图。**
>
> Instead of somehow reaching out to the internet, it outputs a specially formatted message -- essentially saying "I would like to call function X with arguments Y."

完整流程：

1. **模型决策** -> 输出 `tool_use` / `tool_call` 结构
2. **框架执行** -> 你的代码解析并执行实际函数
3. **结果返回** -> 将结果注入对话继续

#### 3.4.3 术语演进

| 时期 | OpenAI 术语 | 说明 |
|------|------------|------|
| 2023 | `function_call` | 单次调用，已废弃 |
| 2024+ | `tools` / `tool_choice` | 支持并行调用、MCP 集成 |

#### 3.4.4 工具结果的角色归属

不同 API 提供商的实现方式不同：

| 提供商 | 角色 | 结构 |
|--------|------|------|
| OpenAI | 专用 `tool` role | `{"role": "tool", "tool_call_id": "...", "content": "..."}` |
| Anthropic | `user` role + `tool_result` 类型 | `{"role": "user", "content": [{"type": "tool_result", ...}]}` |

#### 3.4.5 权威度分析

| 角色 | 权威度 | 说明 |
|------|--------|------|
| System | 高 | 定义行为边界 |
| Developer | 中高 | 业务逻辑 |
| **Tool** | 中（约等于 User） | 外部数据注入点 |
| User | 中 | 用户输入 |

**安全含义**：工具结果是潜在的 **prompt injection 攻击向量**。如果工具返回的内容包含恶意指令（比如爬取的网页中有 `Ignore previous instructions...`），可能影响模型行为。

#### 3.4.6 这个理解为什么重要？

1. **Tools 是 Function Calling 的上层抽象** —— Function Calling 是 API 能力，Tools 是框架概念
2. **工具结果的信任等级等同于用户输入** —— 这是为什么需要对外部数据做 sanitization
3. **读进来的代码也是 User 级别内容** —— 无论是工具读取还是用户粘贴，都在同一信任层级

> **参考资料**
>
> - [Function calling | OpenAI API](https://platform.openai.com/docs/guides/function-calling) — Function Calling 的定义与参数结构
> - [How to implement tool use - Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) — tool_use 和 tool_result 的消息结构
> - [The Anatomy of Tool Calling in LLMs](https://martinuke0.github.io/posts/2026-01-07-the-anatomy-of-tool-calling-in-llms-a-deep-dive/) — tool role 的消息格式深度解析
> - [Agentic Prompt Engineering: LLM Roles](https://www.clarifai.com/blog/agentic-prompt-engineering) — 各角色的权威度和处理机制
> - [LLM01:2025 Prompt Injection - OWASP](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — 工具结果作为 prompt injection 攻击向量

### 3.5 Q6: Skill 这个概念你如何理解？它解决了什么问题？

**结论：Skill 是「延迟加载的知识模块」，核心解决 Context Window 膨胀问题。「渐进式披露」和「避免反复提及」的理解都正确。**

#### 3.5.1 渐进式披露（Progressive Disclosure）

这是 Skill 的**架构设计核心**：

```text
启动时
  只加载 metadata（~100 tokens）
    name + description（用于匹配判断）

触发时
  加载完整指令（<5k tokens）
    SKILL.md 的内容

执行时
  按需加载资源（仅在读取时消耗 token）
    参考文档
    脚本（执行结果才消耗 token，代码本身不消耗）
    示例文件
```

对比：如果把所有内容都塞进 CLAUDE.md，会在**每次对话开始**就消耗大量 context window。

#### 3.5.2 避免反复提及

封装可复用的工作流，一次定义、多次使用、跨项目共享。

#### 3.5.3 需要补充的几点

| 特性 | 说明 |
|------|------|
| **模块化** | 任务导向的独立单元，每个 Skill 解决一类问题 |
| **可移植性** | 同一个 Skill 可跨 repo、跨工具（CLI、IDE、Agent）使用 |
| **自动/手动触发** | Agent 根据描述自动匹配，或用 `/skill-name` 手动调用 |
| **组合性** | 多个 Skill 可以组合使用，Custom Agent 可以编排多个 Skills |

#### 3.5.4 层级结构

```text
Custom Instructions (CLAUDE.md / AGENTS.md)
  -> 全局、始终生效、定义 repo 级别的约定

Agent Skills
  -> 模块化、按需加载、任务导向、可复用

Custom Agents
  -> 工作流编排、组合多个 Skills、端到端复杂任务
```

#### 3.5.5 这个理解为什么重要？

1. **Skill 本质是「延迟加载的知识模块」** —— 解决 CLAUDE.md 膨胀问题
2. **触发机制是关键设计** —— 通过 description 匹配自动触发，避免用户记忆负担
3. **脚本执行的 token 优化** —— 脚本代码不消耗 context，只有执行结果消耗

> **参考资料**
>
> - [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills) — Skill 的定义、结构、加载机制
> - [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — Skill 的设计理念和实际应用
> - [Claude Skills Solve the Context Window Problem](https://tylerfolkman.substack.com/p/the-complete-guide-to-claude-skills) — Skill 如何解决 context window 膨胀问题
> - [Skill authoring best practices - Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) — SKILL.md 保持 <500 行、资源文件分离
> - [Stop Bloating Your CLAUDE.md: Progressive Disclosure](https://alexop.dev/posts/stop-bloating-your-claude-md-progressive-disclosure-ai-coding-tools/) — 为什么 CLAUDE.md 应该 <300 行
> - [GitHub Discussion: Custom Agents vs Skills vs Instructions](https://github.com/orgs/community/discussions/183962) — 三者的区别和使用场景

## 4 实践中的一些观察

在实际使用这些工具的过程中，有几个值得记录的发现：

### 当前的瓶颈

- **Figma MCP 还不够稳定**：Figma MCP 连接经常断连，「设计稿到前端代码」这条 workflow 目前还难以跑通。LLM 辅助对后端开发的帮助明显大于前端，前端侧需要有人先趟出一条可用的 Figma-to-Frontend 路径。
- **大型 SDK 的 Context Window 问题**：某些领域（如嵌入式）的 SDK 体积巨大（GB 级别），直接喂给 LLM 会造成 context 爆炸。可行方案包括：通过 LLM 为大型 SDK 生成渐进式披露的文档索引，或使用 codebase search 类插件辅助。
- **跨平台兼容性**：不少 Skill、MCP 和社区工具在 Windows 环境下存在兼容性问题，macOS/Linux 用户的体验明显更好。

### 概念理解的关键障碍

- **Skill 是最容易被误解的概念**。很多人觉得「花里胡哨，用就是了」，但一旦理解 Skill 本质就是**可复用的工作流/SOP**，使用壁垒会大幅降低。
- 光看视频和文档很难建立具象认知，通过 **API 实际调用一遍**效果好得多。
- **封装好的组件在 LLM 效果会好很多** —— 这是一个有价值的实践发现。
