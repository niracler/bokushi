import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const testEnv = {};
globalThis.__TEST_CLOUDFLARE_ENV__ = testEnv;

const { POST: postComment } = await import("../src/pages/api/comments.ts");

function replyRow({ id, slug = "post", parentId = null, status = "visible" }) {
    return {
        id,
        slug,
        parent_id: parentId,
        status,
        author: `author-${id}`,
        content: `content-${id}`,
        email: null,
        user_id: null,
        user_name: null,
        user_email: null,
    };
}

function commentsDatabase(rows) {
    const inserted = [];
    return {
        inserted,
        prepare(statement) {
            return {
                bind(...values) {
                    return {
                        async first() {
                            const [id, slug] = values;
                            const row = rows.find(
                                (candidate) =>
                                    candidate.id === id &&
                                    candidate.slug === slug &&
                                    candidate.status === "visible",
                            );
                            if (!row) return null;
                            if (statement.includes("c.parent_id IS NULL") && row.parent_id) {
                                return null;
                            }
                            return row;
                        },
                        async run() {
                            if (statement.includes("INSERT INTO comments")) inserted.push(values);
                            return { success: true };
                        },
                    };
                },
            };
        },
    };
}

async function submitReply(database, overrides = {}, environment = {}) {
    Object.assign(testEnv, {
        COMMENTS_DB: database,
        FASTMAIL_API_TOKEN: undefined,
        SESSIONS: undefined,
        TELEGRAM_BOT_TOKEN: undefined,
        TELEGRAM_NOTIFY_CHAT_ID: undefined,
        ...environment,
    });

    return postComment({
        request: new Request("https://example.com/api/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                slug: "post",
                parent_id: "parent",
                author: "commenter",
                content: "reply",
                ...overrides,
            }),
        }),
        locals: {},
    });
}

test("comments accept an exact reply target in the same flat thread", async () => {
    const database = commentsDatabase([
        replyRow({ id: "parent" }),
        replyRow({ id: "child", parentId: "parent" }),
    ]);

    const response = await submitReply(database, { reply_to: "child" });

    assert.equal(response.status, 201);
    assert.equal(database.inserted.length, 1);
});

test("comments pass the exact nested reply target to Telegram", async () => {
    const database = commentsDatabase([
        replyRow({ id: "parent" }),
        replyRow({ id: "child", parentId: "parent" }),
    ]);
    const originalFetch = globalThis.fetch;
    const originalConsoleWarn = console.warn;
    const calls = [];
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), body: JSON.parse(init.body) });
        return new Response("ok", { status: 200 });
    };
    console.warn = () => {};

    try {
        const response = await submitReply(
            database,
            { reply_to: "child" },
            { TELEGRAM_BOT_TOKEN: "token", TELEGRAM_NOTIFY_CHAT_ID: "chat" },
        );

        assert.equal(response.status, 201);
        assert.equal(calls.length, 1);
        assert.match(calls[0].body.text, /comment-child">author-child<\/a>/);
        assert.doesNotMatch(calls[0].body.text, /comment-parent">author-parent<\/a>/);
    } finally {
        console.warn = originalConsoleWarn;
        globalThis.fetch = originalFetch;
    }
});

test("comments reject reply targets from another article before inserting", async () => {
    const database = commentsDatabase([
        replyRow({ id: "parent" }),
        replyRow({ id: "child", slug: "another-post", parentId: "parent" }),
    ]);

    const response = await submitReply(database, { reply_to: "child" });

    assert.equal(response.status, 400);
    assert.equal(database.inserted.length, 0);
});

test("comments reject deleted and cross-thread reply targets", async (t) => {
    await t.test("deleted target", async () => {
        const database = commentsDatabase([
            replyRow({ id: "parent" }),
            replyRow({ id: "child", parentId: "parent", status: "deleted" }),
        ]);
        const response = await submitReply(database, { reply_to: "child" });
        assert.equal(response.status, 400);
        assert.equal(database.inserted.length, 0);
    });

    await t.test("target in another parent thread", async () => {
        const database = commentsDatabase([
            replyRow({ id: "parent" }),
            replyRow({ id: "child", parentId: "other-parent" }),
        ]);
        const response = await submitReply(database, { reply_to: "child" });
        assert.equal(response.status, 400);
        assert.equal(database.inserted.length, 0);
    });
});

test("comments fall back to the top-level parent when reply_to is absent", async () => {
    const database = commentsDatabase([replyRow({ id: "parent" })]);

    const response = await submitReply(database);

    assert.equal(response.status, 201);
    assert.equal(database.inserted.length, 1);
});

test("comments reject reply_to without parent_id", async () => {
    const database = commentsDatabase([replyRow({ id: "child", parentId: "parent" })]);

    const response = await submitReply(database, { parent_id: null, reply_to: "child" });

    assert.equal(response.status, 400);
    assert.equal(database.inserted.length, 0);
});
