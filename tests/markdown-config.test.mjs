import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Astro markdown pipeline enables GitHub Flavored Markdown", async () => {
    const config = await readFile(new URL("../astro.config.mjs", import.meta.url), "utf8");

    assert.match(config, /import\s+remarkGfm\s+from\s+["']remark-gfm["']/);
    assert.match(config, /remarkPlugins:\s*\[[^\]]*\bremarkGfm\b/s);
});
