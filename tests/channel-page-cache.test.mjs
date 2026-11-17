import assert from "node:assert/strict";
import test from "node:test";
import { cachedChannelPage } from "../src/utils/channel-page-cache.ts";

function fixture() {
    let now = 0;
    let renders = 0;
    const entries = new Map();
    const cache = {
        async match(request) {
            const entry = entries.get(request.url);
            return entry && entry.expires > now ? entry.response.clone() : undefined;
        },
        async put(request, response) {
            const ttl = Number(response.headers.get("Cache-Control").match(/max-age=(\d+)/)[1]);
            entries.set(request.url, { response: response.clone(), expires: now + ttl });
        },
    };
    const next = async () =>
        new Response(`render ${++renders}`, {
            headers: { "Content-Type": "text/html" },
        });
    return {
        cache,
        next,
        entries,
        advance(seconds) {
            now += seconds;
        },
        renderCount() {
            return renders;
        },
        run(path = "/channel", init, render = next) {
            return cachedChannelPage(
                new Request(`https://niracler.com${path}`, init),
                render,
                async () => cache,
                () => now * 1000,
            );
        },
    };
}

test("repeated requests skip rendering until the three-day TTL expires", async () => {
    const f = fixture();
    const first = await f.run();
    assert.equal(first.headers.get("X-Channel-Cache"), "MISS");
    assert.equal(await first.text(), "render 1");
    f.advance(259_199);
    const hit = await f.run();
    assert.equal(hit.headers.get("X-Channel-Cache"), "HIT");
    assert.equal(await hit.text(), "render 1");
    assert.equal(hit.headers.get("Cache-Control"), "public, max-age=0, must-revalidate");
    assert.equal(f.renderCount(), 1);
    f.advance(1);
    assert.equal(await (await f.run()).text(), "render 2");
});

test("pagination and origins have independent entries", async () => {
    const f = fixture();
    for (const path of ["/channel", "/channel/before-123", "/channel/after-123"]) {
        assert.equal((await f.run(path)).headers.get("X-Channel-Cache"), "MISS");
        assert.equal((await f.run(path)).headers.get("X-Channel-Cache"), "HIT");
    }
    const other = await cachedChannelPage(
        new Request("https://preview.example/channel"),
        f.next,
        async () => f.cache,
    );
    assert.equal(other.headers.get("X-Channel-Cache"), "MISS");
    assert.equal(f.renderCount(), 4);
});

test("private requests, other routes, query strings and non-GET requests bypass cache", async () => {
    const f = fixture();
    await f.run();
    for (const [path, init] of [
        ["/channel", { headers: { Cookie: "session=test" } }],
        ["/channel", { headers: { Authorization: "Bearer test" } }],
        ["/channel", { method: "HEAD" }],
        ["/channel", { method: "POST" }],
        ["/api/comments"],
        ["/channel?search=test"],
        ["/channel/before-invalid"],
    ]) {
        assert.equal((await f.run(path, init)).headers.get("X-Channel-Cache"), null);
    }
    assert.equal(f.entries.size, 1);
    assert.equal(f.renderCount(), 8);
});

test("error, personalized and uncacheable responses are never stored", async () => {
    for (const [status, headers] of [
        [502, {}],
        [302, { Location: "/login" }],
        [200, { "Set-Cookie": "session=test" }],
        [200, { "Cache-Control": "private" }],
        [200, { "Cache-Control": "no-store" }],
        [200, { Vary: "Cookie" }],
        [200, { "Content-Type": "application/json" }],
    ]) {
        const f = fixture();
        const response = await cachedChannelPage(
            new Request("https://niracler.com/channel"),
            async () =>
                new Response("body", {
                    status,
                    headers: { "Content-Type": "text/html", ...headers },
                }),
            async () => f.cache,
        );
        assert.equal(response.status, status);
        assert.equal(f.entries.size, 0);
    }
});

test("cache failures preserve the live page response", async () => {
    for (const operation of ["open", "match", "put"]) {
        const f = fixture();
        const response = await cachedChannelPage(
            new Request("https://niracler.com/channel"),
            f.next,
            async () => {
                if (operation === "open") throw new Error("unavailable");
                return {
                    ...f.cache,
                    [operation]: async () => {
                        throw new Error("unavailable");
                    },
                };
            },
        );
        assert.equal(await response.text(), "render 1");
        assert.equal(f.renderCount(), 1);
    }
});

test("failed refresh serves retained HTML without extending its deadline", async () => {
    for (const failure of [
        async () =>
            new Response("upstream failed", {
                status: 502,
                headers: { "Cache-Control": "no-store" },
            }),
        async () => {
            throw new Error("timeout");
        },
    ]) {
        const f = fixture();
        await f.run();
        f.advance(259_200);
        const response = await f.run("/channel", undefined, failure);
        assert.equal(response.headers.get("X-Channel-Cache"), "STALE");
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        assert.equal(response.headers.get("X-Channel-Stored-At"), null);
        assert.equal(await response.text(), "render 1");
        f.advance(604_800);
        try {
            const expired = await f.run("/channel", undefined, failure);
            assert.equal(expired.status, 502);
            assert.equal(expired.headers.get("X-Channel-Cache"), null);
        } catch (error) {
            assert.equal(error.message, "timeout");
        }
    }
});

test("successful refresh replaces the fallback and starts a fresh TTL", async () => {
    const f = fixture();
    await f.run();
    f.advance(259_200);
    assert.equal(await (await f.run()).text(), "render 2");
    const hit = await f.run();
    assert.equal(hit.headers.get("X-Channel-Cache"), "HIT");
    assert.equal(await hit.text(), "render 2");
});

test("stale fallback does not mask redirects, missing pages or personalized failures", async () => {
    const f = fixture();
    await f.run();
    f.advance(259_200);
    for (const [status, headers] of [
        [404, {}],
        [302, { Location: "/login" }],
        [502, { "Set-Cookie": "session=x" }],
    ]) {
        const response = await f.run(
            "/channel",
            undefined,
            async () => new Response("live", { status, headers }),
        );
        assert.equal(response.status, status);
        assert.equal(await response.text(), "live");
    }
    const privateResponse = await f.run(
        "/channel",
        { headers: { Cookie: "session=x" } },
        async () => new Response("private", { status: 502 }),
    );
    assert.equal(privateResponse.status, 502);
});
