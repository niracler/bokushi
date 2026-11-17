import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { stripMarkdown } from "../src/utils/readingTime.ts";

const MODULE_ID = "virtual:site-stats";
const RESOLVED_ID = `\0${MODULE_ID}`;
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

export async function collectSiteStats(root, onFile = () => {}) {
    const stats = { totalChars: 0, totalMinutes: 0, totalArticles: 0 };
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.name.startsWith(".")) continue;
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(path);
            } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
                onFile(path);
                const plain = stripMarkdown(await readFile(path, "utf8"));
                const cjk = (plain.match(CJK_RE) || []).length;
                const latin = plain.replace(CJK_RE, " ").trim().split(/\s+/).filter(Boolean).length;
                stats.totalChars += cjk + latin;
                stats.totalMinutes += Math.max(1, Math.ceil(cjk / 300 + latin / 200));
                stats.totalArticles++;
            }
        }
    }
    for (const collection of ["blog", "monthly", "til"]) {
        await visit(resolve(root, "src/content", collection));
    }
    return stats;
}

/** Emit only numeric literals into the Worker; Markdown parsing stays in Node. */
export function siteStatsPlugin() {
    let root;
    return {
        name: "bokushi-site-stats",
        configResolved(config) {
            root = config.root;
        },
        resolveId(id) {
            if (id === MODULE_ID) return RESOLVED_ID;
        },
        async load(id) {
            if (id !== RESOLVED_ID) return;
            const stats = await collectSiteStats(root, (path) => this.addWatchFile(path));
            return `export default ${JSON.stringify(stats)};`;
        },
        configureServer(server) {
            const refresh = (path) => {
                if (!/[/\\]src[/\\]content[/\\](blog|monthly|til)[/\\].*\.mdx?$/.test(path)) return;
                for (const environment of Object.values(server.environments)) {
                    const module = environment.moduleGraph.getModuleById(RESOLVED_ID);
                    if (module) environment.moduleGraph.invalidateModule(module);
                }
                server.ws.send({ type: "full-reload" });
            };
            server.watcher.on("add", refresh).on("change", refresh).on("unlink", refresh);
        },
    };
}
