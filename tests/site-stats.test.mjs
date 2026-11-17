import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectSiteStats } from "../scripts/site-stats-plugin.mjs";

test("build statistics preserve counts, strip metadata/code and refresh after edits", async () => {
    const root = await mkdtemp(join(tmpdir(), "bokushi-stats-"));
    try {
        for (const c of ["blog", "monthly", "til"])
            await mkdir(join(root, "src/content", c), { recursive: true });
        const post = join(root, "src/content/blog", "sample.mdx");
        await writeFile(post, '---\ntitle: "Not counted"\n---\n你好 world `ignored`\n');
        await writeFile(join(root, "src/content/til", "empty.md"), "");
        await writeFile(join(root, "src/content/monthly", "asset.txt"), "Not a post");
        assert.deepEqual(await collectSiteStats(root), {
            totalChars: 3,
            totalMinutes: 2,
            totalArticles: 2,
        });
        await writeFile(post, "世界 hello there");
        assert.equal((await collectSiteStats(root)).totalChars, 4);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
