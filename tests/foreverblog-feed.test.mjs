import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const { parseDailyFeed } = await import("../src/utils/foreverblogFeed");

function feedItem({ title, link, guid, description, pubDate }) {
    return `
    <item>
        <title>${title}</title>
        <link>${link}</link>
        <guid isPermaLink="true">${guid}</guid>
        <description>${description}</description>
        <pubDate>${pubDate}</pubDate>
    </item>`;
}

function description(note, issueDate, quote = "") {
    return `编辑推荐：${note}
${quote ? `原文：「${quote}」\n` : ""}来自十年之约「今天读什么」：https://www.foreverblog.cn/daily/${issueDate}.html`;
}

test("keeps only the latest issue and trims notes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>${feedItem({
        title: "十月十月",
        link: "https://www.foreverblog.cn/daily/read/37/161111/rss",
        guid: "https://jingxin18.cn/3634.html",
        description: description("作者算了一笔账。", "2026-11-10", "拼有尽头，耗没有。"),
        pubDate: "Tue, 10 Nov 2026 00:00:12 +0800",
    })}${feedItem({
        title: "昨天的文章",
        link: "https://www.foreverblog.cn/daily/read/36/159456/rss",
        guid: "https://example.com/old",
        description: description("旧的一期。", "2026-11-09"),
        pubDate: "Mon, 09 Nov 2026 00:00:17 +0800",
    })}</channel></rss>`;

    const issue = parseDailyFeed(xml);

    assert.equal(issue.date, "2026-11-10");
    assert.equal(issue.issueUrl, "https://www.foreverblog.cn/daily/2026-11-10.html");
    assert.deepEqual(issue.picks, [
        {
            title: "十月十月",
            url: "https://jingxin18.cn/3634.html",
            note: "作者算了一笔账。",
        },
    ]);
});

test("caps the picks at two per issue and decodes entities", () => {
    const items = ["A &amp; B", "第二篇", "第三篇"]
        .map((title, index) =>
            feedItem({
                title,
                link: `https://www.foreverblog.cn/daily/read/37/${index}/rss`,
                guid: `https://example.com/${index}`,
                description: description("值得读。", "2026-11-10"),
                pubDate: "Tue, 10 Nov 2026 00:00:12 +0800",
            }),
        )
        .join("");

    const issue = parseDailyFeed(`<rss><channel>${items}</channel></rss>`);

    assert.equal(issue.picks.length, 2);
    assert.equal(issue.picks[0].title, "A & B");
});

test("throws when the feed carries no usable item", () => {
    assert.throws(() => parseDailyFeed("<rss><channel></channel></rss>"), /没有可用的推荐条目/);
});
