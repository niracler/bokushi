---
title: "为什么文件要以换行符结尾，以及我们应当如何保证"
description: "梳理 POSIX 对“行”的定义，解释缺少结尾换行会引发的问题，并整理在编辑器、lint、脚本层面的解决方案。"
pubDate: "Sep 1, 2023"
updatedDate: "Sep 13, 2023"
tags: [ "TIL", "工具", "Posix" ]
socialImage: https://image.niracler.com/2025/10/a39d260e6a2ca6333aae02786393a0cf.png
---

只是一个稍微记录一点知识的文章，这个知识点很小。但其实我觉得挺有趣的，而我又能够 handle 住并能讲清楚的。

## 关于行的定义

事情源于下面这样一个提醒，源于 `git diff`，相信大家都是看过的。`\No newline at end of file`

```diff
diff --git a/demo.py b/demo.py
index 8cde782..e75154b 100644
--- a/demo.py
+++ b/demo.py
@@ -1 +1 @@
-print("hello world")
+print("hello world")
\ No newline at end of file            
```

容我思考一个问题，为什么不是减了一行而是对原有的最后一行进行了修改。为什么要区分 `print("hello world")\n` 与 `print("hello world")`

这其实涉及到了 posix 中对行的定义。（[3.206 Line](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_206)）

> A sequence of zero or more non- \<newline\> characters plus a terminating \<newline\> character.

行是由一系列零个或多个非  `<newline>` 字符，**以及** 一个终止的 `<newline>` 字符组成的。注意此处的「**以及**」两个字，这意味着在 posix 的定义中行是必须有一个 `<newline>` 作为结尾， 所以准确来说，**换行符是终止的行的一部分，没有换行符的行不算是一行**。

所以上面这个操作我是将原来的完整的一行里面的 `\n` 给删除了

## 可能会导致的问题

所以嘛，只要遵守 posix 标准的命令或者软件，都会确保一行的结束是为 `\n` 才算是真正的一行。要是文件结尾不为换行符，可能在一些情况下会存在问题。

我此处就只举一个例子 `wc -l`：

![image](https://image.niracler.com/2025/10/14c92dce2e0961c2593dcf1441dfbc21.png)

## 我的解决方案

1. 像 vim 以及 nono 这种工具，是会在保存文件的时候自动帮你在末尾补空行的。
2. **vscode 插件**：在你保存文件的时候，自动保证最后的换行符号。
      ![image](https://image.niracler.com/2025/10/e88744d0f0688809bafe988b58eab997.png)
3. **linter 插件**：可以装一些 linter 插件什么的， 例如 pylint， 在你没有换行符号结尾的时候自动加换行符。
4. **shell 脚本**：自动给目录下的所有文件，没有换行符结尾的话，都加一个换行符。

   ```bash
    nini_ensure_newline(){
        find . -type f | while read -r file; do
            if [ "$(tail -c 1 "$file")" != '' ]; then
                echo "Processing $file"
                echo "" >> "$file"
            fi
        done
    }
    ```

## 参考资料

- [linux - 什么时候程序源码文件末尾要有空行? 是怎么规定和考虑的 - SegmentFault 思否](https://segmentfault.com/q/1010000000614237)
    其实这个链接里面的回答回答了个寂寞，没有认准 posix 标准这个核心，这个事情跟软件的新旧无关的。新软件也可以支持 posix 标准，那也要以换行符作为行的结尾才能将这视为一行。
- [How to force newline at end of files and why you should do it | by Alexey Inkin | Medium](https://medium.com/@alexey.inkin/how-to-force-newline-at-end-of-files-and-why-you-should-do-it-fdf76d1d090e#:~:text=This%20is%20because%20technically%20the,a%20terminating%20character.)
    讲得很详细，就连我的 shell 代码的结局方案的解释都加上了。
- [missing-final-newline / C0304 - Pylint 3.0.0a8-dev0 documentation](https://pylint.readthedocs.io/en/latest/user_guide/messages/convention/missing-final-newline.html)
    Pylint 也有对应的检查项。
