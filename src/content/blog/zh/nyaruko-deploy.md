---
title: "简单易懂的 Telegram to xLog Shorts 机器人部署方案 - v1.0"
description: ">-"
pubDate: "Jan 21, 2024"
tags: ["telegram", "cloudflare", "auto_sync", "周记"]
socialImage: "https://image.niracler.com/2026/03/a6b1742d23ab0b79f92c73416932e724.png"
---

> 或许，挺不简明易懂的，估计需要 30min 才能操作完。

最近写了个 TG 机器人，可以自动将 TG 的消息转发为 xLog Shorts。功能实现完已经有半个月了，但是真正向别人介绍如何部署的这篇文章，却一直拖到现在。心里还是有很多忐忑的。

具体技术： Cloudlfare Worker + Telegram Bot API + xLog Shorts 。总之免费就是了

> [!NOTE]
> 如果有什么问题的话，欢迎提 issue 或者 pr。请尽管反馈，一般 48 小时内会有回复的

(效果图)
![image](https://image.niracler.com/2026/03/e3d0f40dc1d484d584e040a6660560b1.png)

## 事前准备

### 安装 Wrangler 并登录 Cloudflare 帐号

Cloudflare Workers 是 Cloudflare 提供的一个 Serverless 服务。我们这机器人(我称之为奈亚子) ，这个项目（她的一生）就是部署（活）在这上面的。我之所以选择 Workers，是因为我本职工作要用到，于是拿来练练手🤣。 当然了，也有一些正经理由，比如：

1. Cloudflare Workers 免费版一天有 10w 次请求额度，作为个人使用完全够了
2. 免去了自己搭建服务器的运维成本
3. 不需要开代理就能访问 Telegram API

Wrangler 是 Cloudflare 官方提供的一个命令行工具，用于部署 Cloudflare Workers。安装 Wrangler 并登录 Cloudflare 帐号，可以参考 [官方文档](https://developers.cloudflare.com/workers/cli-wrangler/install-update)。

> 若没有 Cloudflare 帐号的同学，可以趁这个机会注册（[链接](https://dash.cloudflare.com/sign-up)）  
> 没有 nodejs 的同学也可以去安装一下（[链接](https://nodejs.org/zh-cn/download/))

我们在这里执行如下命令，看我们这就登陆成功了，第一步完成 🎉

```bash
npm install -g wrangler
wrangler login
```

通过 `wrangler woami` 确认登陆完成

```bash
$ wrangler whoami
 ⛅️ wrangler 3.23.0
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email it@x-cmd.com!
┌────────────────────────┬──────────────────────────────────┐
│ Account Name           │ Account ID                       │
├────────────────────────┼──────────────────────────────────┤
│ yyy@xxx.com's Account  │ ***                              │
└────────────────────────┴──────────────────────────────────┘
🔓 Token Permissions: If scopes are missing, you may need to logout and re-login.
Scope (Access)
- account (read)
- user (read)
- workers (write)
- workers_kv (write)
- workers_routes (write)
- workers_scripts (write)
- workers_tail (read)
- d1 (write)
- pages (write)
- zone (read)
- ssl_certs (write)
- constellation (write)
- ai (read)
- offline_access
```

### 申请 Telegram Bot API 的 token

接下来我们要找 [Botfather](https://t.me/BotFather) 申请一个 TG 机器人。TG 机器人的申请，可以参考 [官方文档](https://core.telegram.org/bots#6-botfather)。

(像下面这样就可以了，例如此处我的机器人用户名是 xlog_20240110_bot )

<img width="277" alt="image" src="https://image.niracler.com/2026/03/64cc5374907b19809f37c329a33c40f6.png">

### 获取 xLog 的 Token 以及 CharacterId

此时，我们目光转向 xLog。此处参考[辛宝 Otto](https://blog.ijust.cc/) 的 [token 获取教程](https://blog.ijust.cc/play-xlog-02)。要拿到下面两个东西：

1. xLog 的 token
2. xLog 的 characterId

就是在 xSettings 的页面，点开当前的 character，在浏览器的控制台里面输入下面的代码就可以了

```javascript
JSON.parse(localStorage.getItem('connect-kit:account')).state.wallet.siwe.token
JSON.parse(localStorage.getItem('connect-kit:account')).state.wallet.characterId
```

(示意图，有更简单的方式的话，请务必跟我说一下啊～～)
![image](https://image.niracler.com/2026/03/de6b7e56824d21785de3c6ed121a04c4.png)

## 开始部署

咳咳，终于到了部署的时候了，话不多说，直接开始吧

### 克隆并进入项目目录

嗯，就是这样，很简单的一步。在终端运行如下命令，克隆 -> 进入项目目录 -> 安装依赖。（为了保证这个教程的可用性，我克隆时指定了具体的 v0.2.3 版本）

```bash
git clone https://github.com/niracler/nyaruko-telegram-bot -b "v0.2.3" 
cd nyaruko-telegram-bot
npm install
```

### 生成配置文件

我有一个 demo 的配置文件，此处我们将其复制一份（代码块中，不以 `$` 为开头的行就是命令的输出结果）

```bash
$ cp wrangler.demo.toml wrangler.toml
$ cat wrangler.toml
name = "nyaruko-telegram-bot"
main = "src/index.ts"
compatibility_date = "2023-11-21"
compatibility_flags = [ "nodejs_compat" ]

[vars]
ALLOW_USER_IDS = [ ]
TELEGRAM_BOT_USERNAME = ''

[[d1_databases]]
binding = "DB" # i.e. available in your Worker on env.DB
database_name = "tg"
database_id = "..."
```

模版在这，我们先去创建一个 D1 数据库，然后再来填写这个配置文件

### 创建 D1 数据库

因为 media_group 的信息是通过 D1 数据库来存储的，所以需要创建一个 D1 数据库

> 注意⚠️：在奈亚子部署起来之前的多张图的消息，会因为没有在 D1 数据库中找到对应的 media_group_id 而无法同步到 xLog 上。后面会考虑弄一个同步历史消息的脚本

执行如下命令创建 D1 数据库

```bash
wrangler d1 create tg
```

然后将返回的 D1 数据库的名称填入到 `wrangler.toml` 中，将我配置文件中的 database_id 改成你的 D1 数据库 id。将命令输出的 database_id 填入到上面的 `wrangler.toml` 中

```toml
[[d1_databases]]
binding = "DB" # i.e. available in your Worker on env.DB
database_name = "tg"
database_id = "******"
```

执行如下命令，创建 D1 数据库的表 (在此之前，一定要先改好 `wrangler.toml` 中的 database_id)

```bash
wrangler d1 execute tg --file=./schema.sql
```

### 设置各种密钥

然后就要将「事前准备」中的各种密钥设置到 cloudflare worker 的环境变量中了。这三个分别是机器人的 token，xLog 的 token，xLog 的 characterId。

依次执行如下命令，将这三个密钥设置到 cloudflare worker 的环境变量中（注意，XLOG_TOKEN 不要多带上引号了）

```bash
wrangler secret put TELEGRAM_BOT_SECRET
wrangler secret put XLOG_TOKEN
wrangler secret put XLOG_CHARACTER_ID
```

### 部署到 cloudflare worker

好了，我们现在可以将奈亚子部署上 cloudflare worker 试试了。（执行如下命令，代码块中，不以 `$` 为开头的行就是命令的输出结果）

```bash
$ wrangler deploy
 ⛅️ wrangler 3.23.0
Your worker has access to the following bindings:
- D1 Databases:
  - DB: tg (******)
- Vars:
  - ALLOW_USER_IDS: []
  - TELEGRAM_BOT_USERNAME: ""
Total Upload: 708.56 KiB / gzip: 123.29 KiB
Uploaded nyaruko-telegram-bot (2.52 sec)
Published nyaruko-telegram-bot (3.91 sec)
  https://your-worker.your-name.workers.dev
Current Deployment ID: ******
```

### 设置奈亚子的 Webhook

将奈亚子的 Webhook 设置为您 Cloudflare Workers 地址 (上面的命令输出里面有的)，奈亚子需要通过 Webhook 来接收消息。

执行如下命令（请务必将命令中的 `https://your-worker.your-name.workers.dev/` 和 `TELEGRAM_BOT_SECRET` 替换成你自己的）

```bash
curl -F "url=https://your-worker.your-name.workers.dev/" https://api.telegram.org/bot<TELEGRAM_BOT_SECRET>/setWebhook
```

然后确认一下 Webhook 是否设置成功，执行如下命令（请务必将命令中的 `TELEGRAM_BOT_SECRET` 替换成你自己的）

```bash
$ curl https://api.telegram.org/bot<TELEGRAM_BOT_SECRET>/getWebhookInfo
{"ok":true,"result":{"url":"https://nyaruko-telegram-bot.***.workers.dev/","has_custom_certificate":false,"pending_update_count":0,"max_connections":40,"ip_address":"******"}}
```

PS. 此处 api.telegram.org 会被墙，需要使用命令行代理，不知道如何处理的同学可以联系我。

也可以，跟奈亚子聊两句

<img width="277" alt="image" src="https://image.niracler.com/2026/03/5651eb939196a7566002e7efb66274c0.png">

### 奈亚子的命令注册 (可选)

为了方便使用，我们可以将奈亚子的命令注册一下。在 tg 上:

1. 找到 [Botfather](https://t.me/BotFather)
2. 输入 `/setcommands`，然后选择你的机器人
3. 输入以下内容：

```bash
sync_xlog - Sync msg to Twitter.
ping - Test if the bot is online.
getchatid - Get the ID of the current chat.
getuserid - Get the ID of the current user.
```

后续就有命令补全了

### 配置 ALLOW_USER_IDS 用于让奈亚子知道你是她的主人 (逃）

是的，总不能让每个人都可以用奈亚子来转发你的 tg 消息吧。所以我们需要将自己的 tg id 填入到 `wrangler.toml` 中的 ALLOW_USER_IDS 中。这样，奈亚子就知道你是她的主人了。(就是上面的 getuserid 命令的输出结果)

```toml
[vars]
ALLOW_USER_IDS = [ "******" ]
```

然后再次运行 `wrangler deploy`

### 完结撒花

好了，完成了，现在可以去 tg 上测试一下发送消息到 xLog 了。奈亚子会将第一句话作为 Short 的标题，后面的作为 Short 的内容。

(找了一张史前的图文消息转发给奈亚子做测试)
![image](https://image.niracler.com/2026/03/65223255387cda2e46fb899f59115793.png)

## 后记

感觉这个教程写了好久呢，写到我连代码都重构了。我感觉我没有做什么，但是又花了很多时间。我很容易就是那种会闭门造车的人，所以这个项目的代码质量可能不是很好。如果有什么问题的话，欢迎提 issue 或者 pr。请尽管反馈，一般 48 小时内会有回复的

### 关于技术选型为什么是长这样

肯定不是因为我只会写 typescript 啦（逃

1. Cloudflare 是免费的啊，而且又不需要开代理就能访问 Telegram API。
2. crossbell 的 SDK 是 typescript 的，若用其他语言的话，就需要手拼 ipfs 的上传逻辑了。（也肯定不是为了更方便抄辛宝的代码啦）

### 路漫漫其修远兮

怎么说呢，奈亚子还有其他功能的详情可以看。

<https://github.com/niracler/nyaruko-telegram-bot>

> 如何将 sync xlog 独立出来让别人用， 形式应是如何的，我还没想好。本来奈亚子是作为我 allinone 的私人管家设计的。 现在看来，有兴趣的人可能要先将奈亚子整个部署起来，何尝不是一种 NTR （bushi）

还有一些需要考虑的内容，不过我现在还没想好（也不想思考了，我的周末呢？？？）

- [ ] debug 模式
- [ ] 能用的账户列表，其实 CHARACTER_ID 也可以是一个数组
- [ ] 可能会存在区块链钱包没有额度的情况

### 一些杂话

- 写文档的时候，尽量可以用代码块的情况就不要用图片了，这样可以方便复制粘贴
- 我也尽量全程没有进行一个 cloudflare 的截图，为的就是全程可以在命令行上操作

## 参考资料

- [技术角度折腾 xlog】更顺畅的使用体验 2 深入理解 xlog 的鉴权](https://blog.ijust.cc/play-xlog-02) - 辛宝 Otto 的 xlog 教程，写的很详细，而且还有视频教程～～
- [ChatGPT-Telegram-Bot](https://github.com/yym68686/ChatGPT-Telegram-Bot) - 另一个 TG Bot 的项目，一个比我年轻的前辈写的。
- [官方 wrangler 文档](https://developers.cloudflare.com/workers/wrangler/commands/)  - wrangler 文档感觉要比 twitter 文档好懂得多了，起码事例会多很多～～
- [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook) - Telegram Bot API 文档

<details>
<summary>置地题图</summary>

![干杯](https://image.niracler.com/2026/03/a6b1742d23ab0b79f92c73416932e724.png)

</details>
