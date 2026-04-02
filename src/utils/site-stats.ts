import { getCollection } from "astro:content";
import { stripMarkdown } from "./readingTime";

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

interface SiteStats {
    totalChars: number;
    totalMinutes: number;
    totalArticles: number;
}

let cached: SiteStats | null = null;

export async function getSiteStats(): Promise<SiteStats> {
    if (cached) return cached;

    const [blogPosts, monthlyPosts, tilPosts] = await Promise.all([
        getCollection("blog"),
        getCollection("monthly"),
        getCollection("til"),
    ]);
    const allPosts = [...blogPosts, ...monthlyPosts, ...tilPosts];

    let totalChars = 0;
    let totalMinutes = 0;

    for (const post of allPosts) {
        const plain = stripMarkdown(post.body || "");
        const cjk = (plain.match(CJK_RE) || []).length;
        const latin = plain.replace(CJK_RE, " ").trim().split(/\s+/).filter(Boolean).length;
        totalChars += cjk + latin;
        totalMinutes += Math.max(1, Math.ceil(cjk / 300 + latin / 200));
    }

    cached = { totalChars, totalMinutes, totalArticles: allPosts.length };
    return cached;
}
