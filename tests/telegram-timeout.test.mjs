import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fetchTelegramChannel } from "../src/utils/telegram.ts";

const html = (id) =>
    `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="test/${id}"><div class="tgme_widget_message_text">hello</div></div></div>`;

test("one deadline covers all Telegram batches", async () => {
    const signals = [];
    await assert.rejects(
        fetchTelegramChannel(
            "test",
            { minPosts: 40 },
            {
                timeoutMs: 100,
                fetch: async (_url, { signal }) => {
                    signals.push(signal);
                    if (signals.length === 1) return new Response(html(10));
                    await delay(1000, undefined, { signal });
                    return new Response(html(9));
                },
            },
        ),
        /abort/i,
    );
    assert.equal(signals.length, 2);
    assert.equal(signals[0], signals[1]);
    assert.equal(signals[0].aborted, true);
});

test("response body consumption shares the timeout signal", async () => {
    await assert.rejects(
        fetchTelegramChannel(
            "test",
            { minPosts: 1 },
            {
                timeoutMs: 20,
                fetch: async (_url, { signal }) => ({
                    ok: true,
                    text: async () => {
                        await delay(1000, undefined, { signal });
                        return html(1);
                    },
                }),
            },
        ),
        /abort/i,
    );
});
