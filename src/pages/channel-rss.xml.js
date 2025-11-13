import rss from "@astrojs/rss";
import sanitizeHtml from "sanitize-html";
import { SITE_TITLE } from "../consts";
import { fetchTelegramChannel } from "../utils/telegram";

export async function GET(context) {
    const CHANNEL_USERNAME = "tomoko_channel";

    try {
        const channelData = await fetchTelegramChannel(CHANNEL_USERNAME);

        return await rss({
            title: `${channelData.title || SITE_TITLE} - 动态`,
            description: channelData.description || "Telegram 频道最新动态",
            site: context.site,
            trailingSlash: false,
            items: channelData.posts.map((post) => ({
                title: post.title,
                pubDate: new Date(post.datetime),
                link: `https://t.me/${CHANNEL_USERNAME}/${post.id}`,
                content: sanitizeHtml(post.content, {
                    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
                        "img",
                    ]),
                    allowedAttributes: {
                        ...sanitizeHtml.defaults.allowedAttributes,
                        img: ["src", "alt", "loading", "class"],
                    },
                }),
                customData: `<guid isPermaLink="true">https://t.me/${CHANNEL_USERNAME}/${post.id}</guid>`,
            })),
            customData: `<language>zh-CN</language>
      <atom:link href="${context.site}channel-rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
            stylesheet: "/pretty-feed-v3.xsl",
        });
    } catch (error) {
        console.error("Error generating RSS feed:", error);
        // Return empty feed on error
        return await rss({
            title: `${SITE_TITLE} - 动态`,
            description: "Telegram 频道动态",
            site: context.site,
            items: [],
            customData: `<language>zh-CN</language>`,
        });
    }
}
