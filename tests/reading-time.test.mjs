import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { stripMarkdown } from "../src/utils/readingTime.ts";

test("stripMarkdown removes active HTML together with its contents", () => {
    const markdown = [
        "# Safe title",
        "<strong>Visible text</strong>",
        '<script>alert("internal marker")</script>',
        "<style>.hidden { color: red; }</style>",
    ].join("\n");

    assert.equal(stripMarkdown(markdown), "Safe title Visible text");
});

test("stripMarkdown preserves ordinary Markdown prose", () => {
    const markdown = "Read **carefully** with [the guide](https://example.com) and `code`.";

    assert.equal(stripMarkdown(markdown), "Read carefully with the guide and .");
});

test("stripMarkdown returns decoded plain text instead of HTML entities", () => {
    assert.equal(stripMarkdown("Research & development"), "Research & development");
});

test("stripMarkdown handles malformed Markdown links in linear time", () => {
    const malformedLinks = "![".repeat(24_000);
    const startedAt = performance.now();

    stripMarkdown(malformedLinks);

    assert.ok(
        performance.now() - startedAt < 1_000,
        "malformed links should not trigger polynomial regex backtracking",
    );
});
