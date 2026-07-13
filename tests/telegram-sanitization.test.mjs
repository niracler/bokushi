import assert from "node:assert/strict";
import test from "node:test";

import * as cheerio from "cheerio";
import { fetchTelegramChannel } from "../src/utils/telegram.ts";

function telegramChannelHtml(messageContent, description = "Test description") {
    return `
        <div class="tgme_channel_info_header_title">Test channel</div>
        <div class="tgme_channel_info_description">${description}</div>
        <div class="tgme_widget_message_wrap">
            <div class="tgme_widget_message" data-post="test_channel/123">
                <a class="tgme_widget_message_date">
                    <time datetime="2026-07-13T00:00:00+00:00"></time>
                </a>
                <div class="tgme_widget_message_text">${messageContent}</div>
            </div>
        </div>
    `;
}

async function parseChannel(messageContent, description) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response(telegramChannelHtml(messageContent, description), {
            status: 200,
            headers: { "Content-Type": "text/html" },
        });

    try {
        return await fetchTelegramChannel("test_channel", { minPosts: 1 });
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function parseSinglePost(messageContent) {
    const channel = await parseChannel(messageContent);
    assert.equal(channel.posts.length, 1);
    return channel.posts[0];
}

test("Telegram channel descriptions cannot inject active HTML", async () => {
    const channel = await parseChannel("Safe post", "1. &lt;img src=x onerror=alert(1)&gt;");
    const description = cheerio.load(channel.description, null, false);

    assert.equal(description("img, script").length, 0);
    assert.equal(description("ol").length, 1);
});

test("Telegram table cells cannot turn nested entities into executable HTML", async () => {
    const post = await parseSinglePost(`
        | Name | Value |
        | --- | --- |
        | Unsafe | &amp;lt;img src=x onerror=alert(1)&amp;gt; |
    `);
    const content = cheerio.load(post.content, null, false);

    assert.equal(content("img[onerror], script").length, 0);
    assert.equal(content("table").length, 1);
    assert.equal(content("tbody td").last().text(), "<img src=x onerror=alert(1)>");
});

test("Telegram content removes active HTML while keeping safe images", async () => {
    const post = await parseSinglePost(`
        <img src="https://example.com/image.png" alt="Example" onerror="alert(1)">
        <script>alert(2)</script>
    `);
    const content = cheerio.load(post.content, null, false);

    assert.equal(content("script, img[onerror]").length, 0);
    assert.equal(content("img").attr("src"), "https://example.com/image.png");
    assert.equal(content("img").attr("alt"), "Example");
});

test("Telegram content keeps supported links and pipe tables", async () => {
    const post = await parseSinglePost(`
        | Project | Link |
        | --- | --- |
        | Bokushi | <a href="https://example.com">Website</a> |
    `);
    const content = cheerio.load(post.content, null, false);

    assert.equal(content("table").length, 1);
    assert.equal(content("tbody td").first().text(), "Bokushi");
    assert.equal(content("a").attr("href"), "https://example.com");
    assert.equal(content("a").attr("target"), "_blank");
    assert.equal(content("a").attr("rel"), "noopener noreferrer");
});
