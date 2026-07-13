import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const { GET } = await import("../src/pages/channel-rss.xml.js");

function telegramChannelHtml(messageContent) {
    return `
        <div class="tgme_channel_info_header_title">Test channel</div>
        <div class="tgme_channel_info_description">Test description</div>
        <div class="tgme_widget_message_wrap">
            <div class="tgme_widget_message" data-post="tomoko_channel/123">
                <a class="tgme_widget_message_date">
                    <time datetime="2026-07-13T00:00:00+00:00"></time>
                </a>
                <div class="tgme_widget_message_text">${messageContent}</div>
            </div>
        </div>
    `;
}

async function renderChannelRss(messageContent) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(telegramChannelHtml(messageContent));

    try {
        const response = await GET({ site: new URL("https://example.com/") });
        assert.equal(response.status, 200);
        return response.text();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

test("channel RSS description preserves comparison text", async () => {
    const xml = await renderChannelRss("2 &lt; 3 and 5 &gt; 4");

    assert.match(xml, /<description>2 &lt; 3 and 5 &gt; 4<\/description>/);
});

test("channel RSS descriptions use normalized sanitized content", async () => {
    const xml = await renderChannelRss(
        "hello<br>world <script>hidden</script><style>secret</style>Visible",
    );

    assert.match(xml, /<description>hello world Visible<\/description>/);
    assert.doesNotMatch(xml, /hidden|secret/);
});

test("channel RSS titles omit non-text elements and preserve visible text", async () => {
    const xml = await renderChannelRss(
        "<script>hidden</script><style>secret</style>Visible <strong>headline</strong>",
    );

    assert.match(xml, /<title>Visible headline<\/title>/);
    assert.doesNotMatch(xml, /hidden|secret/);
});
