import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") nodeModule.registerHooks({ load, resolve });
else nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);

const { ChannelArchive } = await import("../src/lib/channel/archive.js");
const { VIDEO_LIMIT, VIDEO_BUDGET, OBJECT_PREFIX } = await import("../src/lib/channel/media.ts");

function fixture(t) {
    const db = new DatabaseSync(":memory:");
    t.after(() => db.close());
    const storage = {
        sql: {
            exec(query, ...args) {
                if (query.trim().startsWith("CREATE TABLE")) return db.exec(query);
                const rows = db.prepare(query).all(...args);
                return {
                    toArray: () => rows,
                    one: () => {
                        assert.equal(rows.length, 1);
                        return rows[0];
                    },
                };
            },
        },
        transactionSync(fn) {
            db.exec("BEGIN");
            try {
                fn();
                db.exec("COMMIT");
            } catch (error) {
                db.exec("ROLLBACK");
                throw error;
            }
        },
        async setAlarm() {},
    };
    const objects = new Map();
    const bucket = {
        async put(key, body) {
            const bytes = await new Response(body).arrayBuffer();
            objects.set(key, bytes);
            return { size: bytes.byteLength, etag: Buffer.from(bytes).toString("hex") };
        },
        async delete(key) {
            objects.delete(key);
        },
    };
    const archive = new ChannelArchive({ storage }, { CHANNEL_MEDIA: bucket });
    const remote = new Map();
    const originals = new Map();
    const reads = [];
    let feed = [];
    const message = (
        id,
        text,
        photo,
    ) => `<div class="tgme_widget_message" data-post="tomoko_channel/${id}">
        <div class="tgme_widget_message_text">${text}</div>
        ${photo ? `<a class="tgme_widget_message_photo_wrap" style="background-image:url('${photo}')"></a>` : ""}
        <a class="tgme_widget_message_date"><time datetime="2026-11-21T00:00:00Z"></time></a></div>`;
    t.mock.method(globalThis, "fetch", async (input, init = {}) => {
        const url = new URL(input);
        if (url.pathname === "/s/tomoko_channel")
            return new Response(
                '<b class="tgme_channel_info_header_title">Archive</b>' + feed.join(""),
            );
        if (url.hostname === "t.me") {
            const id = url.pathname.split("/").at(-1);
            const embed = originals.get(id);
            return embed instanceof Response
                ? embed.clone()
                : new Response(
                      embed ?? '<div class="tgme_widget_message_error">Post not found</div>',
                  );
        }
        const asset = remote.get(url.href);
        if (!asset) return new Response(null, { status: 503 });
        const headers = {
            "Content-Type": asset.type ?? "image/jpeg",
            ETag: asset.tag ?? '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
        };
        if (asset.tag === null) delete headers.ETag;
        if (asset.size !== null) headers["Content-Length"] = String(asset.size ?? 3);
        if (init.method === "HEAD") return new Response(null, { headers });
        reads.push(url.href);
        return new Response(asset.bytes ?? new Uint8Array(3), { headers });
    });
    return {
        archive,
        db,
        objects,
        remote,
        originals,
        reads,
        message,
        setFeed(rows) {
            feed = rows;
        },
    };
}

test("publishes complete posts in original order and keeps the last complete edit during an outage", async (t) => {
    const f = fixture(t),
        url = "https://cdn1.telesco.pe/cat",
        replacement = url + "-new";
    const cat = f.message(2, "cat", url),
        first = f.message(1, "first"),
        last = f.message(3, "last");
    f.setFeed([first, cat, last]);
    f.originals.set("2", cat);
    await f.archive.refreshHome();
    await f.archive.alarm();
    const page = () => f.archive.page("home");
    assert.deepEqual(
        (await page()).posts.map((p) => p.id),
        ["3", "1"],
    );
    f.remote.set(url, {});
    f.db.exec("UPDATE jobs SET due=0");
    await f.archive.alarm();
    let posts = (await page()).posts;
    assert.deepEqual(
        posts.map((p) => p.id),
        ["3", "2", "1"],
    );
    const saved = posts[1].photos[0].url;
    assert.match(saved, /^\/channel-media\/[0-9a-f]{64}$/);
    const edited = f.message(2, "edited cat", replacement);
    f.setFeed([first, edited, last]);
    f.originals.set("2", edited);
    await f.archive.refreshHome();
    await f.archive.alarm();
    posts = (await page()).posts;
    assert.equal(posts[1].text, "cat");
    assert.equal(posts[1].photos[0].url, saved);
    f.remote.set(replacement, { tag: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' });
    f.db.exec("UPDATE jobs SET due=0");
    await f.archive.alarm();
    assert.equal((await page()).posts[1].text, "edited cat");
    assert.equal(f.objects.has(OBJECT_PREFIX + saved.split("/").at(-1)), false);
    f.setFeed([]);
    await assert.rejects(f.archive.refreshHome(), /Incomplete/);
    assert.equal((await page()).posts[1].text, "edited cat");
});

test("a missing feed item needs explicit confirmation and shared copies outlive their first owner", async (t) => {
    const f = fixture(t),
        url = "https://cdn1.telesco.pe/a",
        rotated = url + "?sig=2";
    const a = f.message(1, "a", url),
        b = f.message(2, "b", rotated),
        c = f.message(3, "c");
    f.remote.set(url, {});
    f.remote.set(rotated, {});
    f.setFeed([a, b, c]);
    await f.archive.refreshHome();
    await f.archive.alarm();
    const saved = (await f.archive.page("home")).posts[1].photos[0].url.split("/").at(-1);
    assert.equal(f.reads.length, 1); // the second signed URL reused the same verified object
    await f.archive.page("before-3");
    f.setFeed([a, c]);
    f.originals.set("2", new Response(null, { status: 404 }));
    await f.archive.refreshHome();
    await f.archive.alarm();
    assert.ok((await f.archive.page("home")).posts.some((p) => p.id === "2"));
    f.originals.delete("2");
    f.db.exec("UPDATE jobs SET due=0");
    await f.archive.alarm();
    assert.ok(!(await f.archive.page("before-3")).posts.some((p) => p.id === "2"));
    assert.ok(f.archive.assetInfo(saved));
    assert.ok(f.objects.has(OBJECT_PREFIX + saved));
    f.setFeed([c]);
    f.db.exec("UPDATE posts SET audit=0 WHERE id='1'");
    await f.archive.refreshHome();
    await f.archive.alarm();
    assert.equal(f.archive.assetInfo(saved), null);
    assert.equal(f.objects.size, 0);
    assert.equal(await f.archive.page("before-999999"), null);
});

test("video file and total limits, duplicate copies, and an upstream of unknown size", async (t) => {
    const f = fixture(t),
        url = "https://cdn1.telesco.pe/v",
        media = f.archive.media;
    f.remote.set(url, { type: "video/mp4", size: VIDEO_LIMIT + 1 });
    assert.equal(await media.copy(url, true), null);
    assert.equal(f.reads.length, 0);
    f.db
        .prepare("INSERT INTO assets(key,size,type,ready) VALUES('existing',?,'video/mp4',1)")
        .run(VIDEO_BUDGET - 3);
    f.remote.set(url, { type: "video/mp4", size: 4 });
    assert.equal(await media.copy(url, true), null);
    assert.equal(f.reads.length, 0);
    f.remote.set(url, { type: "video/mp4", size: 3 });
    const copy = await media.copy(url, true);
    assert.ok(copy);
    assert.equal(await media.copy(url, true), copy);
    assert.equal(f.reads.length, 1);
    f.remote.set(url, { type: "video/mp4", size: null, tag: '"different"' });
    assert.equal(await media.copy(url, true), null);
    assert.equal(f.objects.size, 1);
});

test("concurrent first visits share one refresh and an incomplete Telegram photo is withheld", async (t) => {
    const f = fixture(t);
    const incomplete = f
        .message(2, "album", "https://cdn1.telesco.pe/old")
        .replace("background-image:url('https://cdn1.telesco.pe/old')", "width:300px");
    f.setFeed([f.message(1, "ready"), incomplete]);
    const refresh = t.mock.method(f.archive, "refreshPage");
    const [first, second] = await Promise.all([f.archive.page("home"), f.archive.page("home")]);
    assert.deepEqual(first, second);
    assert.equal(refresh.mock.callCount(), 1);
    await f.archive.alarm();
    assert.deepEqual(
        (await f.archive.page("home")).posts.map((post) => post.id),
        ["1"],
    );
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM jobs").get().n, 1);
});

test("media without upstream validators shares a stable URL after comparing uploaded bytes", async (t) => {
    const f = fixture(t);
    const url = "https://cdn1.telesco.pe/photo";
    f.remote.set(url, { tag: null });
    const published = await f.archive.media.copy(url);
    const key = published.split("/").at(-1);
    f.archive.replaceRefs("1", [key]);
    f.remote.set(url + "?new", { tag: null });
    assert.equal(await f.archive.media.copy(url + "?new"), published);
    await f.archive.media.collect();
    assert.equal(f.objects.size, 1);
    assert.ok(f.objects.has(OBJECT_PREFIX + f.archive.assetInfo(key).objectKey));
});
