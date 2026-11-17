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

test("Telegram parser fixes reply text override, service messages, albums, videos, blockquotes, and hashtags", async () => {
    const rawHtml = `
        <div class="tgme_channel_info_header_title">Tomoko</div>
        <div class="tgme_channel_info_description">Channel</div>
        <div class="tgme_widget_message_wrap">
            <div class="tgme_widget_message service_message" data-post="test_channel/1944">
                <div class="tgme_widget_message_text js-message_text">Pinned message</div>
            </div>
        </div>
        <div class="tgme_widget_message_wrap">
            <div class="tgme_widget_message" data-post="test_channel/1938">
                <a class="tgme_widget_message_date"><time datetime="2026-11-04T12:15:00+00:00">12:15</time></a>
                <a class="tgme_widget_message_video_player" href="https://t.me/test_channel/1938">
                    <i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn.example.com/v1938.jpg')"></i>
                    <div class="tgme_widget_message_video_wrap" style="width:1920px;padding-top:42.8125%">
                        <video class="tgme_widget_message_video" src="https://cdn5.telesco.pe/file/sample.mp4?token=abc"></video>
                    </div>
                </a>
                <div class="tgme_widget_message_text js-message_text">Playable video</div>
            </div>
        </div>
        <div class="tgme_widget_message_wrap">
            <div class="tgme_widget_message" data-post="test_channel/1946">
                <a class="tgme_widget_message_date"><time datetime="2026-11-12T01:23:07+00:00">01:23</time></a>
                <a class="tgme_widget_message_reply" href="https://t.me/test_channel/100">
                    <i class="tgme_widget_message_reply_thumb" style="background-image:url('https://cdn.example.com/thumb.jpg')"></i>
                    <div class="tgme_widget_message_author"><span class="tgme_widget_message_author_name">Tomoko RD</span></div>
                    <div class="tgme_widget_message_text js-message_reply_text">Quoted reply text</div>
                </a>
                <div class="tgme_widget_message_grouped_wrap">
                    <div class="tgme_widget_message_grouped_layer" style="width:453px;height:604px">
                        <a class="tgme_widget_message_photo_wrap" style="left:0px;top:0px;width:453px;height:301px;background-image:url('https://cdn.example.com/1.jpg')" href="https://t.me/test_channel/1946?single"></a>
                        <a class="tgme_widget_message_photo_wrap" style="left:0px;top:303px;width:453px;height:301px;background-image:url('https://cdn.example.com/2.jpg')" href="https://t.me/test_channel/1947?single"></a>
                    </div>
                </div>
                <div class="tgme_widget_message_text js-message_text">
                    <div class="tgme_widget_message_text js-message_text">Actual body <i class="emoji" style="background-image:url('//telegram.org/e.png')"><b>🚜</b></i> <a href="?q=%23%E8%AF%BB%E5%BA%93">#读库</a> <a href="https://facebook.com/hashtag/1" onclick="return confirm('Open')">#1</a>月新番<br><blockquote expandable="">Line 1<br>Line 2</blockquote></div>
                </div>
                <div class="tgme_widget_message_reactions"><span class="tgme_reaction"><i class="emoji"><b>🥰</b></i>5</span></div>
                <div class="tgme_widget_message_footer"><span class="tgme_widget_message_views">82</span></div>
            </div>
        </div>
        <div class="tgme_widget_message_wrap">
            <div class="tgme_widget_message" data-post="test_channel/1945">
                <a class="tgme_widget_message_date"><time datetime="2026-11-09T14:31:59+00:00">14:31</time></a>
                <a class="tgme_widget_message_video_player not_supported" href="https://t.me/test_channel/1945">
                    <i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn.example.com/vthumb.jpg')"></i>
                    <div class="tgme_widget_message_video_wrap" style="width:1920px;padding-top:56.25%"></div>
                    <time class="message_video_duration">7:44</time>
                </a>
                <div class="tgme_widget_message_text js-message_text">Video caption</div>
            </div>
        </div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response(rawHtml, { status: 200, headers: { "Content-Type": "text/html" } });

    try {
        const channel = await fetchTelegramChannel("test_channel", { minPosts: 1 });
        // Service message #1944 is skipped; #1938, #1945, and #1946 remain (newest-first)
        assert.equal(channel.posts.length, 3);

        const playableVideoPost = channel.posts[2];
        assert.equal(playableVideoPost.id, "1938");
        assert.equal(playableVideoPost.video?.notSupported, false);
        assert.equal(
            playableVideoPost.video?.videoUrl,
            "/api/video-proxy?channel=test_channel&post=1938",
        );

        const videoPost = channel.posts[0];
        assert.equal(videoPost.id, "1945");
        assert.equal(videoPost.video?.duration, "7:44");
        assert.equal(videoPost.video?.notSupported, true);
        assert.match(videoPost.video?.thumbUrl ?? "", /vthumb\.jpg/);

        const albumReplyPost = channel.posts[1];
        assert.equal(albumReplyPost.id, "1946");
        assert.equal(albumReplyPost.replyInfo?.replyToText, "Quoted reply text");
        assert.match(albumReplyPost.replyInfo?.replyToThumb ?? "", /thumb\.jpg/);
        assert.doesNotMatch(albumReplyPost.text, /Quoted reply text/);
        assert.match(albumReplyPost.text, /^Actual body 🚜 #读库 #1月新番/);
        assert.deepEqual(albumReplyPost.hashtags, ["读库", "1月新番"]);
        assert.equal(albumReplyPost.photos?.length, 2);
        assert.equal(albumReplyPost.albumAspectRatio, 0.75);
        assert.equal(albumReplyPost.views, "82");
        assert.deepEqual(albumReplyPost.reactions, [{ emoji: "🥰", count: "5" }]);

        const $body = cheerio.load(albumReplyPost.textHtml ?? "", null, false);
        assert.equal($body("span.emoji").text(), "🚜");
        assert.equal($body("i.emoji").length, 0);
        assert.equal(
            $body("a.hashtag-link").first().attr("href"),
            "https://t.me/s/test_channel?q=%23%E8%AF%BB%E5%BA%93",
        );
        assert.equal($body("a.hashtag-link").last().text(), "#1月新番");
        assert.equal(
            $body("a.hashtag-link").last().attr("href"),
            "https://t.me/s/test_channel?q=%231%E6%9C%88%E6%96%B0%E7%95%AA",
        );
        assert.equal($body("blockquote[expandable]").length, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
