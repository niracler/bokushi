import assert from "node:assert/strict";
import test from "node:test";

import {
    commentMarkdownToPlainText,
    extractCommentMarkdownImages,
    renderCommentMarkdown,
} from "../src/utils/commentMarkdown.ts";

test("comment markdown renders HTTPS images with safe loading attributes", () => {
    const html = renderCommentMarkdown('![示例](https://example.com/image.png "说明")');

    assert.match(html, /class="comment-image"/);
    assert.match(html, /src="https:\/\/example\.com\/image\.png"/);
    assert.match(html, /alt="示例"/);
    assert.match(html, /title="说明"/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.match(html, /referrerpolicy="no-referrer"/);
});

test("bare image URLs remain links and non-HTTPS images do not render", () => {
    const bare = renderCommentMarkdown("https://example.com/image.webp");
    const insecure = renderCommentMarkdown("![示例](http://example.com/image.png)");

    assert.doesNotMatch(bare, /<img/);
    assert.match(bare, /<a href="https:\/\/example\.com\/image\.webp"/);
    assert.doesNotMatch(insecure, /<img/);
    assert.match(insecure, /<a href="http:\/\/example\.com\/image\.png"/);
});

test("comment markdown strips active HTML and dangerous image targets", () => {
    const html = renderCommentMarkdown(
        '<img src="https://example.com/raw.png" onerror="alert(1)">\n\n![x](javascript:alert(1))',
    );

    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.match(html, /&lt;img/);
});

test("image extraction accepts unique HTTPS markdown images only", () => {
    const images = extractCommentMarkdownImages(
        [
            "![一](https://example.com/one.png)",
            "![重复](https://example.com/one.png)",
            "![二](https://example.com/two.webp)",
            "![不安全](http://example.com/three.png)",
            "https://example.com/bare.png",
        ].join("\n"),
    );

    assert.deepEqual(images, [
        { url: "https://example.com/one.png", alt: "一" },
        { url: "https://example.com/two.webp", alt: "二" },
    ]);
});

test("plain-text summaries collapse markdown and replace images with a marker", () => {
    assert.equal(
        commentMarkdownToPlainText("**正文**\n\n![](https://example.com/image.png)  `代码`"),
        "正文 〔图片〕 代码",
    );
});

test("single newlines wrap as prose while explicit Markdown breaks remain", () => {
    const softBreak = renderCommentMarkdown("第一行\n第二行");
    const hardBreak = renderCommentMarkdown("第一行  \n第二行");

    assert.doesNotMatch(softBreak, /<br/);
    assert.match(hardBreak, /<br/);
});

test("CJK punctuation stays attached to inline emphasis", () => {
    const html = renderCommentMarkdown("感慨「 **加粗内容** 」（补充说明）");

    assert.match(html, /感慨「<strong>加粗内容<\/strong>」（补充说明）/);
});
