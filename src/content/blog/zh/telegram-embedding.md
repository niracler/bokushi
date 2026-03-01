---
title: "导出 Telegram 频道信息并使用 text-embedding-ada-002 对频道文本进行 embedding - v1"
pubDate: "Dec 17, 2023"
tags: ["embedding", "kb", "TIL", "python"]
---

终极需求: 做一个专属于我的知识库。这个嘛，只是这个终极需求的第一步。这个仅仅是作为 demo，后面还有如山一样多的事情要做。

(先来一个最终的效果图看看)
![image](https://image.niracler.com/2026/03/034b6f15c40676d3ee7c89329c8a388e.png)

## 第一步 - 导出 Telegram 频道信息

在开始之前，你需要确保已经安装 Python 3。你还需要以下内容：

- Telethon、PySocks 库: 可以使用 `pip install telethon PySocks` 安装。
- 确保你是你想要获取消息的频道的成员。
- 一个有效的 Telegram 帐号, 获取 Telegram 应用程序的 API ID 和 API hash, 你可以在 [https://my.telegram.org](https://my.telegram.org) 获取。(保护好你的 API 密钥，不要在公共仓库或公开场合泄露。)
- 代理服务器（可选，如果你处于 gfw 之内的话）

### 代码实现 - 导出频道信息

1. 将下面的 Python 脚本保存为 telegram_to_csv.py：

```python
import csv
import socks
from telethon import TelegramClient
from telethon.tl.functions.messages import GetHistoryRequest

client = TelegramClient(
    'demo',
    'api_id',
    'api_hash',
    proxy=(socks.SOCKS5, '127.0.0.1', 1080)
)

async def export_to_csv(filename, fieldnames, data):
    """
    将数据导出到 CSV 文件中。

    参数:
    filename -- 导出文件的名称
    fieldnames -- CSV 头部字段名称列表
    data -- 要导出的字典列表
    """
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

async def fetch_messages(channel_username):
    """
    获取指定频道的所有消息。

    参数:
    channel_username -- 目标频道的用户名
    """
    channel_entity = await client.get_input_entity(channel_username)
    offset_id = 0  # 初始消息 ID 偏移量
    all_messages = []  # 存储所有消息的列表

    while True:
        # 请求消息记录
        history = await client(GetHistoryRequest(
            peer=channel_entity,
            offset_id=offset_id,
            offset_date=None,
            add_offset=0,
            limit=100,  # 每次请求的消息数量
            max_id=0,
            min_id=0,
            hash=0
        ))
        if not history.messages:  # 当没有更多消息时结束循环
            break

        for message in history.messages:
            if message.message:  # 仅处理有文本内容的消息
                # 将消息序列化为字典形式
                message_dict = {
                    'id': message.id,
                    'date': message.date.strftime('%Y-%m-%d %H:%M:%S'),
                    'text': message.message
                }
                all_messages.append(message_dict)
        offset_id = history.messages[-1].id
        print(f"Fetched messages: {len(all_messages)}")
    return all_messages

async def main():
    """
    主程序：从指定频道获取消息并保存到 CSV 文件中。
    """
    await client.start()  # 启动 Telegram 客户端
    print("Client Created")

    channel_username = 'niracler_channel'  # 你要抓取的 Telegram 频道用户名
    all_messages = await fetch_messages(channel_username)  # 获取消息

    # 定义 CSV 文件的头部，并导出
    headers = ['id', 'date', 'text']
    await export_to_csv('channel_messages.csv', headers, all_messages)

if __name__ == '__main__':
    client.loop.run_until_complete(main())
```

### 运行脚本 telegram_to_csv.py

在终端运行脚本：

```bash
python telegram_to_csv.py
```

脚本会开始运行，并将来自指定 Telegram 频道的所有消息保存到当前目录下名为 channel_messages.csv 的文件中。

完成以上步骤后，你将在 channel_messages.csv 文件中找到频道内的文本消息，包括消息的 ID、日期及其内容。

(结果就不贴出来了～～)

## 第二步 - 使用 openai 的 text-embedding-ada-002 模型对文本进行 embedding

- 安装 openai、pandas 库，可以使用 `pip install openai pandas` 安装。
- 一个有效的 OpenAI API 密钥

### 代码实现 - embedding

将下面的 Python 脚本保存为 embedding_generator.py：

```python
import pandas as pd
from openai import OpenAI

client = OpenAI(api_key='YOUR_API_KEY')

def get_embedding(text, model="text-embedding-ada-002"):
    """
    获取文本的嵌入向量。
    """
    text = text.replace("\n", " ")  # 清理文本中的换行符
    response = client.embeddings.create(input=[text], model=model)  # 请求嵌入向量
    return response.data[0].embedding  # 提取和返回嵌入向量

def embedding_gen():
    """
    生成教程文本嵌入向量数据。
    """
    df = pd.read_csv('channel_messages.csv')  # 读取 CSV 文件到 DataFrame
    df['text_with_date'] = df['date'] + " " + df['text']  # 拼接日期和文本
    df['ada_embedding'] = df[:100].text_with_date.apply(get_embedding)  # 批量应用文本嵌入函数

    del df['text_with_date']  # 删除 'text_with_date' 列
    df.to_csv('embedded_1k_reviews.csv', index=False)  # 保存结果到新的 CSV 文件
    
    # 打印 DataFrame 的前几行进行确认
    print(df.head())

if __name__ == "__main__":
    embedding_gen()
```

### 运行脚本

```bash
python embedding_generator.py
```

## 第三步 - 进行搜索

- 安装 pandas、numpy、tabulate 库，可以使用 `pip install pandas numpy tabulate` 安装。
- tabulate 库用于将 DataFrame 打印为表格形式。

### 代码实现 - 搜索

将下面的 Python 脚本保存为 embedding_search.py：

```python
import ast
import sys
import pandas as pd
import numpy as np
from tabulate import tabulate
from openai import OpenAI

client = OpenAI(api_key='YOUR_API_KEY')

def get_embedding(text, model="text-embedding-ada-002"):
    """
    获取文本的嵌入向量。
    """
    text = text.replace("\n", " ")  # 清理文本中的换行符
    response = client.embeddings.create(input=[text], model=model)  # 请求嵌入向量
    return response.data[0].embedding  # 提取和返回嵌入向量

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def embedding_search(query, df, model="text-embedding-ada-002"):
    """
    使用 OpenAI API 搜索嵌入向量。
    """
    query_embedding = get_embedding(query, model=model)  # 获取查询文本的嵌入向量
    df['similarity'] = df.ada_embedding.apply(lambda x: cosine_similarity(ast.literal_eval(x), query_embedding))  # 计算相似度
    df = df.sort_values(by='similarity', ascending=False)  # 按相似度降序排列
    df = df.drop(columns=['ada_embedding'])  # 删除嵌入向量列
    return df

if __name__ == "__main__":
    df = pd.read_csv('embedded_1k_reviews.csv')  # 读取 CSV 文件到 DataFrame
    query = sys.argv[1]
    df = embedding_search(query, df)  # 搜索嵌入向量
    print(tabulate(df.head(10), headers='keys', tablefmt='psql'))  # 打印前 10 条结果
```

### 运行脚本 - 结果

```bash
$ python embedding_search.py 动物森友会
+------+---------------------+--------------------------------------------------------------+----------------+
|      | date                | text                                                         |   similarities |
|------+---------------------+--------------------------------------------------------------+----------------|
| 1041 | 2021-04-03 06:18:40 | 尼尔 森友会                                                  |       0.843896 |
|  836 | 2021-10-16 02:37:16 | 动森直面会中文视频                                           |       0.826405 |
|      |                     | https://www.youtube.com/watch?v=rI_jWfNd2dc                  |                |
| 1208 | 2019-11-10 00:05:56 | 云养动物好像很有趣啊                                         |       0.822377 |
|  489 | 2023-06-16 09:33:15 | 看着小猫的生活就想起西西佛神话里面的西西佛                   |       0.802677 |
|  369 | 2023-08-16 02:15:54 | 家猫会不会无聊寂寞                                           |       0.797062 |
|   13 | 2023-12-14 13:17:59 | 参加了🤗                                                     |       0.796492 |
| 1177 | 2020-02-12 10:27:45 | 国人吃野生动物这种事情之所以屡屡不绝，和头脑中根深蒂固的中医 |       0.796363 |
|      |                     | 观念亦有直接关系。养生、食疗、进补、药膳、以形补形、补气血…… |                |
|      |                     | 伪科学死灰复燃，现在不加以遏制，以后也还会发生类似的事情。   |                |
|      |                     | 科学才是唯一的道路。                                         |                |
|  801 | 2021-11-07 13:46:21 | 想不到，今年的年度游戏竟然还是动森跟火纹。                   |       0.796246 |
|      |                     | 动森是之前没玩够，火纹是因为某个最大最恶事件导致我要重玩的。 |                |
|  837 | 2021-10-16 02:37:16 | 不会吧，难道我的年度游戏又要变成动森了吗？                   |       0.795871 |
|  423 | 2023-07-29 14:11:22 | 鬼畜到能称之为精神污染的头像了～～                           |       0.794144 |
+------+---------------------+--------------------------------------------------------------+----------------+
```

## 路漫漫其修远兮 - 后面要做的事情还多着呢

- **向量数据库**: 机器人就可以使用这个向量数据库来进行搜索，每次用 csv 文件太低效了。有在考虑用 cloudflare 的 vectorize。只不过想着要先做个简单的实验了解流程再说。毕竟 cloudflare 的 paid plan 才能用 vectorize，而且我也不知道这个功能是否能够满足我的需求。
- **后续持续更新数据库**: 不仅仅是我的频道，还有我的文章什么的也是相应的数据源，甚至是一些我关注的频道，而且用 telegram bot 机器人持续自动更新数据库。
- **Prompt Engineering**: 向 chatgpt 提问时，可以从这个向量数据库中找出相关内容，然后一起拼到 prompt 去问 chatgpt。
- **基础知识**: 我不能等到基础知识够了再去干这些事情吧，我应该是要边干边学的。现在已经将我理解的几步给做了，后面要补充一下对应的知识储备。
- **提高质量**: 一些低质量的内容不应该放进去，而且要尽量减少一些图片相关的内容才行，因为图片是不能被 embedding 的。
- **做成 CLI**: 其实这个功能是写在 奈亚子 CLI 里面，但是代码还没整理好，也完全没有异常处理，所以先作为 demo 放出来。在这里贴这么长串的代码效果也是不太好。

## 参考资料

- [Embedding paragraphs from my blog with E5-large-v2](https://til.simonwillison.net/llms/embed-paragraphs) - 我做这个事情的初心就是这篇文章，不过基本也就看个思路，毕竟我 embedding 是直接用的 openai 的 api，而不是本地模型
- [telethon 的文档](https://docs.telethon.dev/en/stable/) - 这是一个个人帐号的 telegram api 的 python 封装，因为个人帐号用的是 mtproto 协议，所以不能简单地调用接口，使用这个库的必要程度还是很高的
- [openai embeddings use cases](https://platform.openai.com/docs/guides/embeddings/use-cases) - 我就是照着这个例子做 embedding 的

## 后记

也是一个没有什么技术含量的文章，算是记录了我又学到了一些东西吧。
