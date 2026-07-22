import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";

test("Astro markdown pipeline uses the unified processor", async () => {
    const config = await readFile(new URL("../astro.config.mjs", import.meta.url), "utf8");

    assert.match(config, /import\s+{\s*unified\s*}\s+from\s+["']@astrojs\/markdown-remark["']/);
    assert.match(config, /processor:\s*unified\(\{/);
    assert.match(config, /unified\(\{[\s\S]*remarkPlugins:[\s\S]*rehypePlugins:/);
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
