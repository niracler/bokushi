import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { load } from "cheerio";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

test("Astro markdown pipeline uses the unified processor", async () => {
    const config = await readFile(new URL("../astro.config.mjs", import.meta.url), "utf8");

    assert.match(config, /import\s+{\s*unified\s*}\s+from\s+["']@astrojs\/markdown-remark["']/);
    assert.match(config, /processor:\s*unified\(\{/);
    assert.match(config, /unified\(\{[\s\S]*remarkPlugins:[\s\S]*rehypePlugins:/);

    const slugPosition = config.indexOf("rehypeSlug,");
    const autolinkPosition = config.indexOf("[\n                    rehypeAutolinkHeadings,");
    assert.notEqual(slugPosition, -1, "rehypeSlug must be configured");
    assert.notEqual(autolinkPosition, -1, "rehypeAutolinkHeadings must be configured");
    assert.ok(slugPosition < autolinkPosition, "rehypeSlug must run before heading autolinks");
});

test("heading autolinks are injected for numbered heading levels", async () => {
    const processor = await createMarkdownProcessor({
        syntaxHighlight: false,
        rehypePlugins: [
            rehypeSlug,
            [
                rehypeAutolinkHeadings,
                {
                    behavior: "prepend",
                    properties: {
                        class: "anchor-link",
                        ariaHidden: true,
                        tabIndex: -1,
                    },
                },
            ],
        ],
    });
    const result = await processor.render(["## 一级", "", "### 二级", "", "#### 三级"].join("\n"));
    const $ = load(result.code);

    for (const [tag, id] of [
        ["h2", "一级"],
        ["h3", "二级"],
        ["h4", "三级"],
    ]) {
        const heading = $(`${tag}#${id}`);
        const anchor = heading.children("a.anchor-link").first();

        assert.equal(heading.length, 1);
        assert.equal(anchor.attr("href"), `#${id}`);
        assert.equal(anchor.attr("aria-hidden"), "");
        assert.equal(anchor.attr("tabindex"), "-1");
    }
});

test("unified processor renders GFM tables and footnotes", async () => {
    const processor = await createMarkdownProcessor({ syntaxHighlight: false });
    const markdown = [
        "| Name | Value |",
        "| --- | --- |",
        "| Astro | 7 |",
        "",
        "Footnote reference[^1].",
        "",
        "[^1]: Footnote content.",
    ].join("\n");
    const result = await processor.render(markdown);

    assert.match(result.code, /<table>/);
    assert.match(result.code, /data-footnote-ref/);
    assert.match(result.code, /data-footnotes/);
});

test("Astro heading IDs cover Chinese, duplicates, and inline code", async () => {
    const processor = await createMarkdownProcessor({ syntaxHighlight: false });
    const result = await processor.render(
        ["## 中文标题", "", "## 中文标题", "", "## Inline `code` 标题"].join("\n"),
    );

    assert.deepEqual(
        result.metadata.headings.map(({ depth, slug, text }) => ({ depth, slug, text })),
        [
            { depth: 2, slug: "中文标题", text: "中文标题" },
            { depth: 2, slug: "中文标题-1", text: "中文标题" },
            { depth: 2, slug: "inline-code-标题", text: "Inline code 标题" },
        ],
    );
    assert.match(result.code, /<h2 id="inline-code-标题">Inline <code>code<\/code> 标题<\/h2>/);
});
