import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const {
    TELEGRAM_CAPTION_LIMIT,
    TELEGRAM_QUOTE_LIMIT,
    TELEGRAM_TEXT_LIMIT,
    buildTelegramMessage,
    notifyNewComment,
    summarizeCommentQuote,
    telegramVisibleLength,
} = await import("../src/lib/telegram-notify.ts");

const baseParams = {
    slug: "post",
    commentId: "new-comment",
    author: "新评论者",
    content: "新的评论内容",
    postTitle: "文章标题",
};

function mockFetch(responses = [new Response("ok", { status: 200 })]) {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), body: JSON.parse(init.body) });
        return responses.shift() ?? new Response("ok", { status: 200 });
    };
    return {
        calls,
        restore() {
            globalThis.fetch = originalFetch;
        },
    };
}

test("Telegram messages point to the exact reply target and summarize its content", () => {
    const replyContent = `${"甲".repeat(90)} ![](https://example.com/quoted.png)`;
    const message = buildTelegramMessage(
        {
            ...baseParams,
            replyToId: "specific-reply",
            replyToAuthor: "目标作者",
            replyToContent: replyContent,
        },
        { limit: TELEGRAM_TEXT_LIMIT, imageMode: "links" },
    );

    assert.match(message, /new-comment">新评论者<\/a> → .*specific-reply">目标作者<\/a>/);
    assert.match(message, /<blockquote>/);
    assert.ok(Array.from(summarizeCommentQuote(replyContent)).length <= TELEGRAM_QUOTE_LIMIT);
    assert.doesNotMatch(message, /quoted\.png/);
});

test("top-level comments send a plain text notification without a quote", async () => {
    const mocked = mockFetch();
    try {
        await notifyNewComment("token", "chat", baseParams);

        assert.equal(mocked.calls.length, 1);
        assert.match(mocked.calls[0].url, /\/sendMessage$/);
        assert.doesNotMatch(mocked.calls[0].body.text, / → |<blockquote>/);
    } finally {
        mocked.restore();
    }
});

test("Telegram notification sends one Markdown image with sendPhoto", async () => {
    const mocked = mockFetch();
    try {
        await notifyNewComment("token", "chat", {
            ...baseParams,
            content: "正文\n\n![示例](https://example.com/image.png)",
        });

        assert.equal(mocked.calls.length, 1);
        assert.match(mocked.calls[0].url, /\/sendPhoto$/);
        assert.equal(mocked.calls[0].body.photo, "https://example.com/image.png");
        assert.equal(mocked.calls[0].body.show_caption_above_media, true);
        assert.ok(telegramVisibleLength(mocked.calls[0].body.caption) <= TELEGRAM_CAPTION_LIMIT);
    } finally {
        mocked.restore();
    }
});

test("Telegram notification deduplicates media and caps albums at ten images", async () => {
    const content = [
        ...Array.from(
            { length: 11 },
            (_, index) => `![图 ${index}](https://example.com/${index}.png)`,
        ),
        "![重复](https://example.com/0.png)",
    ].join("\n");
    const mocked = mockFetch();

    try {
        await notifyNewComment("token", "chat", { ...baseParams, content });
        assert.match(mocked.calls[0].url, /\/sendMediaGroup$/);
        assert.equal(mocked.calls[0].body.media.length, 10);
        assert.match(mocked.calls[0].body.media[0].caption, /另有 1 张图片/);
    } finally {
        mocked.restore();
    }
});

test("Telegram media failures fall back to a text message with image links", async () => {
    const mocked = mockFetch([
        new Response("failed", { status: 400 }),
        new Response("ok", { status: 200 }),
    ]);
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        await notifyNewComment("token", "chat", {
            ...baseParams,
            content: "![示例](https://example.com/image.png)",
        });

        assert.equal(mocked.calls.length, 2);
        assert.match(mocked.calls[0].url, /\/sendPhoto$/);
        assert.match(mocked.calls[1].url, /\/sendMessage$/);
        assert.match(mocked.calls[1].body.text, /href="https:\/\/example\.com\/image\.png"/);
    } finally {
        console.error = originalConsoleError;
        mocked.restore();
    }
});

test("Telegram truncation respects visible text limits and keeps valid HTML", () => {
    const message = buildTelegramMessage(
        { ...baseParams, content: `**${"长内容".repeat(2000)}**` },
        { limit: TELEGRAM_TEXT_LIMIT, imageMode: "links" },
    );
    const caption = buildTelegramMessage(
        { ...baseParams, content: `**${"长内容".repeat(1000)}**` },
        { limit: TELEGRAM_CAPTION_LIMIT, imageMode: "omit" },
    );

    assert.ok(telegramVisibleLength(message) <= TELEGRAM_TEXT_LIMIT);
    assert.ok(telegramVisibleLength(caption) <= TELEGRAM_CAPTION_LIMIT);
    assert.equal((message.match(/<b>/g) ?? []).length, (message.match(/<\/b>/g) ?? []).length);
    assert.equal((caption.match(/<b>/g) ?? []).length, (caption.match(/<\/b>/g) ?? []).length);
});
