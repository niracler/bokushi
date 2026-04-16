import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { postUrl } from "../utils/i18n";

const parser = new MarkdownIt();

// Strip MDX-specific syntax that MarkdownIt cannot render:
// - import statements (e.g. `import Foo from "..."`)
// - self-closing JSX components (e.g. `<ColorPalette />`)
// - opening/closing JSX component tags, keeping inner text (e.g. `<Spoiler>text</Spoiler>`)
function stripMdx(body) {
    if (!body) return "";
    return body
        .replace(/^import\s+.*$/gm, "")
        .replace(/<[A-Z]\w*\s*\/>/g, "")
        .replace(/<[A-Z]\w*[^>]*>/g, "")
        .replace(/<\/[A-Z]\w*>/g, "");
}

export async function GET(context) {
    const blogPosts = await getCollection("blog");
    const monthlyPosts = await getCollection("monthly");
    const tilPosts = await getCollection("til");
    const posts = [...blogPosts, ...monthlyPosts, ...tilPosts]
        .filter((post) => !post.data.hidden)
        .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
    const rssContent = await rss({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        site: context.site,
        trailingSlash: false,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.pubDate,
            link: postUrl(post.id),
            categories: post.data.tags,
            content: sanitizeHtml(parser.render(stripMdx(post.body)), {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
            }),
        })),
        customData: `<language>zh-CN</language>
<atom:link href="${context.site}rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />
<follow_challenge>
    <feedId>151531310966515712</feedId>
    <userId>41434914948866048</userId>
</follow_challenge>`,
        stylesheet: "/pretty-feed-v3.xsl",
    });

    // 返回带有正确响应头的 Response
    return new Response(rssContent.body, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "x-content-type-options": "nosniff",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
        },
    });
}
