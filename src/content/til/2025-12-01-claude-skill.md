---
title: "创建个人 Claude Code Skills Marketplace"
description: "从零开始搭建 Claude Code Skills Marketplace，实现 git-workflow 技能的分发和自动更新。"
pubDate: "Dec 01, 2025"
tags: ["TIL", "Claude Code", "工具", "AI", "开发效率"]
---

## 要干什么

最近工作内外涉及的开发仓库颇多，每个仓库都要维护一份 CLAUDE.md，其中有些部分经常重复，而且超出单个仓库的范畴，最典型的就是 Git 工作流（commit 规范、PR 模板、release 流程等）。久而久之，多个仓库同步维护变得繁琐，不仅占用 CLAUDE.md 的篇幅，甚至影响 Claude Code 的输出质量。

偶然读到宝玉翻译的[借助 Skills 提升前端设计](https://baoyu.io/translations/improving-frontend-design-through-skills)，发现许多流程都可以做成 Skill。

这样每次让 Claude 帮我创建 commit 或 PR 时，它就能自动遵循我的标准，无需每次重复说明规范。研究后发现可以创建自己的 Skills Marketplace，不仅自己能用，还能分享给他人。

所以本文的目标是：搭建一个 Claude Code plugin marketplace，实现一次安装、自动更新，并能持续添加新技能。

## 最终成果

创建了一个完整的技能仓库 [niracler/skill](https://github.com/niracler/skill)，里面包含了 `git-workflow` 技能。现在只要运行：

```bash
claude plugin marketplace add https://github.com/niracler/skill.git
```

就能一键安装所有技能，并且仓库更新后会自动同步。

## 关键知识点

### Marketplace 的基本结构

Claude Code 的 marketplace 和普通的独立技能文件（.skill）是两种不同的分发方式。我选择了 marketplace 方式：

**Plugin Marketplace 的优势**：

- ✅ 一次安装，所有技能立即可用
- ✅ 仓库更新后自动同步
- ✅ 方便管理多个技能
- 📦 用户体验好，一行命令搞定

**必需的文件结构**：

```text
skill/
├── .claude-plugin/
│   └── marketplace.json        # 核心配置文件
├── git-workflow/               # 技能目录
│   ├── SKILL.md               # 技能入口（带 frontmatter）
│   ├── references/            # 详细文档
│   └── scripts/               # 工具脚本
└── scripts/                    # 开发辅助工具
```

### marketplace.json 配置详解

这是整个 marketplace 的配置中枢：

```json
{
  "name": "niracler-skills",
  "owner": {
    "name": "Niracler",
    "email": "i@niracler.com"
  },
  "metadata": {
    "description": "Personal collection of Claude Code skills",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "workflow-skills",
      "description": "Collection of workflow automation skills",
      "source": "./",
      "strict": false,
      "skills": ["./git-workflow"]
    }
  ]
}
```

几个要点：

- `source` 设置为 `"./"`，表示技能在根目录
- `skills` 数组列出所有技能路径
- `strict` 设为 `false` 更灵活

### SKILL.md 的结构

每个技能的 `SKILL.md` 是 Claude 识别和触发技能的关键：

```markdown
name: git-workflow
description: Personal Git workflow for commits, pull requests, and releases following conventional commits and semantic versioning. Use when creating commits, pull requests, or releases.

# Git Workflow Skill

这里是技能的主要内容...
```

**关键点**：

- ✨ `description` 字段**超级重要**！Claude 根据这个判断何时触发技能
- ✨ description 要写清楚适用场景（"Use when..."）
- 保持 SKILL.md 精简（<500 行），详细内容放 `references/` 目录

### 渐进式披露模式

这是让技能高效的核心理念：

| 文件位置 | 用途 | 何时加载 |
| :--- | :--- | :--- |
| SKILL.md | 快速参考、常用工作流 | 技能触发时 |
| references/*.md | 详细指南、深入说明 | 按需加载 |
| scripts/*.py | 可执行工具、验证器 | 用户手动调用 |

**我的 git-workflow 示例**：

- `SKILL.md`：Conventional Commits 快速参考
- `references/commit-guide.md`：详细的 commit 消息编写指南
- `references/pr-guide.md`：PR 模板和流程说明
- `references/release-guide.md`：版本发布的完整流程
- `scripts/validate_commit.py`：commit 消息验证工具

这样 Claude 加载技能时只需要读取 SKILL.md，节省 token。

## 开发工作流

### 创建新技能

```bash
# 1. 初始化新技能
python3 scripts/init_skill.py new-skill --path .

# 2. 编辑文件
# - new-skill/SKILL.md（必需）
# - new-skill/references/（可选）
# - new-skill/scripts/（可选）

# 3. 更新 marketplace.json
# 在 plugins[0].skills 数组中添加 "./new-skill"

# 4. 验证格式
./scripts/validate.sh

# 5. 提交
git add .
git commit -m "feat: add new-skill"
git push
```

### 必备的开发工具

我写了几个脚本来简化开发：

```text
scripts/
├── init_skill.py           # 初始化新技能的脚手架
├── quick_validate.py       # 验证 SKILL.md 格式是否正确
└── validate.sh             # 一键验证脚本
```

## 安装和使用

### 正确的安装命令

```bash
claude plugin marketplace add https://github.com/niracler/skill.git
```

### 验证安装

安装后，当你让 Claude 创建 commit、PR 或 release 时，它会自动应用 git-workflow 技能的规范。

## 我的 git-workflow 技能

这是我第一个完整的技能，功能包括：

**✅ Commit 规范**：

- 使用 Conventional Commits 格式（`feat:`, `fix:`, `refactor:` 等）
- commit 消息中**不**包含 AI 签名（`Co-Authored-By: Claude` 等）
- 保持 commit 消息简洁（<72 字符）

**✅ PR 模板**：

- 自动生成 Summary 和 Test Plan
- 包含变更说明和测试步骤

**✅ Release 工作流**：

- 版本号管理（semantic versioning）
- CHANGELOG 自动生成
- Git tag 和 GitHub release

**触发时机**：只要对 Claude 说"创建一个 commit"、"帮我开个 PR"或"发布新版本"，技能就会自动生效。

项目地址：[git-workflow 文档](https://github.com/niracler/skill/blob/main/git-workflow/SKILL.md)

![在 VS Code 的 Claude Code 插件在安装 Marketplace 后可以直接 /git-workflow 呼出 ](https://image.niracler.com/2025/12/64dcea01aaf842b79f4be62587bc9b78.png)

## 参考资料

- [借助 Skills 提升前端设计（宝玉翻译）](https://baoyu.io/translations/improving-frontend-design-through-skills) - 本文的灵感来源
- [Agent Skills 官方文档](https://code.claude.com/docs/en/skills)
- [如何创建自定义技能](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
- [niracler/skill](https://github.com/niracler/skill) - 我的技能仓库
- [Conventional Commits 规范](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## 总结

搭建 Claude Code Skills Marketplace的几个关键点：

1. **Marketplace 和独立技能是不同的** - 选对分发方式很重要
2. **渐进式披露是王道** - SKILL.md 只放核心内容，详细文档放 references
3. **description 是触发的关键** - 写清楚"何时使用"能大幅提升触发准确度
4. **Plugin 模式超简单** - 不需要打包，git push 就能分发
