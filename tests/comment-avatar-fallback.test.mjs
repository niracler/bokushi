import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    bindImageFallbacks,
    bindOrderedImageFallbacks,
    getCommentAvatarSources,
} from "../src/utils/avatarFallback.ts";

class FakeImage {
    src = "";
    errorListeners = new Set();

    addEventListener(type, listener) {
        assert.equal(type, "error");
        this.errorListeners.add(listener);
    }

    removeEventListener(type, listener) {
        assert.equal(type, "error");
        this.errorListeners.delete(listener);
    }

    dispatchError() {
        for (const listener of [...this.errorListeners]) listener();
    }
}

test("comment avatar fallbacks stay in JavaScript closures", async () => {
    const source = await readFile(new URL("../src/scripts/comments.ts", import.meta.url), "utf8");
    const fallbackSource = await readFile(
        new URL("../src/utils/avatarFallback.ts", import.meta.url),
        "utf8",
    );

    assert.doesNotMatch(source, /onerror=["'][^"']*handleAvatarError/);
    assert.doesNotMatch(source, /getAttribute\(["']data-fallback["']\)/);
    assert.doesNotMatch(source, /window\.handleAvatarError/);
    assert.match(fallbackSource, /addEventListener\(["']error["']/);
    assert.match(source, /bindOrderedImageFallbacks/);
});

test("OAuth avatar failure falls back once to DiceBear and exhausts its listener", () => {
    const sources = getCommentAvatarSources({
        author: "OAuth User",
        avatarUrl: "https://avatars.example/user.png",
        gravatarHash: "unused",
        website: "https://example.com",
    });
    const image = new FakeImage();
    image.src = sources.src;

    bindImageFallbacks(image, sources.fallbacks);
    image.dispatchError();

    assert.match(sources.src, /avatars\.example/);
    assert.match(image.src, /api\.dicebear\.com/);
    assert.equal(image.errorListeners.size, 0);
});

test("avatar batches preserve index mapping and can bind a fresh reload", () => {
    const oauth = getCommentAvatarSources({
        author: "OAuth User",
        avatarUrl: "https://avatars.example/user.png",
        gravatarHash: null,
        website: null,
    });
    const anonymous = getCommentAvatarSources({
        author: "Anonymous User",
        avatarUrl: null,
        gravatarHash: "abc123",
        website: "https://blog.example.com/about",
    });
    const firstLoad = [new FakeImage(), new FakeImage()];

    bindOrderedImageFallbacks(firstLoad, [oauth.fallbacks, anonymous.fallbacks]);
    firstLoad[0].dispatchError();
    firstLoad[1].dispatchError();

    assert.match(firstLoad[0].src, /api\.dicebear\.com/);
    assert.match(firstLoad[1].src, /google\.com%2Fs2%2Ffavicons/);

    const reloadedImage = new FakeImage();
    bindOrderedImageFallbacks([reloadedImage], [anonymous.fallbacks]);
    reloadedImage.dispatchError();

    assert.match(reloadedImage.src, /google\.com%2Fs2%2Ffavicons/);
    assert.equal(reloadedImage.errorListeners.size, 1);
});

test("anonymous avatar failures advance Gravatar to favicon to DiceBear in order", () => {
    const sources = getCommentAvatarSources({
        author: "Anonymous User",
        avatarUrl: null,
        gravatarHash: "abc123",
        website: "https://blog.example.com/about",
    });
    const image = new FakeImage();
    image.src = sources.src;

    bindImageFallbacks(image, sources.fallbacks);
    image.dispatchError();
    const favicon = image.src;
    assert.equal(image.errorListeners.size, 1);

    image.dispatchError();

    assert.match(sources.src, /gravatar\.com/);
    assert.match(favicon, /google\.com%2Fs2%2Ffavicons/);
    assert.match(image.src, /api\.dicebear\.com/);
    assert.equal(image.errorListeners.size, 0);
});
