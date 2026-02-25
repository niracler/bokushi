import rss from "@astrojs/rss";
import sanitizeHtml from "sanitize-html";
import { SITE_TITLE } from "../consts";
import { fetchTelegramChannel } from "../utils/telegram";

/**
 * Detect media type from post content (inspired by RSSHub)
 * Returns emoji prefix for the title
 */
function detectMediaType(content) {
    if (!content) return "";

    // Check for different media types
    if (content.includes("telegram-images")) {
        // Has images
        if (content.match(/<img[^>]*>/g)?.length > 1) {
            return "🖼 "; // Multiple photos
        }
        return "📷 "; // Single photo
    }

    // Could add more types: video 🎬, document 📄, voice 🎙, etc.
    return "";
}

/**
 * Extract plain text from HTML content
 */
function htmlToText(html) {
    if (!html) return "";
    return html
        .replace(/<div[^>]*class="telegram-images"[^>]*>[\s\S]*?<\/div>/g, "") // Remove image containers
        .replace(/<br\s*\/?>/gi, "\n") // Convert br to newlines
        .replace(/<\/p>/gi, "\n") // Convert closing p to newlines
        .replace(/<[^>]+>/g, "") // Remove all HTML tags
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim();
}

/**
 * Generate a clean title for RSS feed (inspired by RSSHub)
 * - Adds media type emoji prefix
 * - Removes redundant emojis from content
 * - Extracts first meaningful line
 * - Limits length to 80 characters
 */
function generateTitle(content, maxLength = 80) {
    // Extract plain text from HTML content (preserves newlines)
    const text = htmlToText(content);

    if (!text) return "无标题";

    // Detect and add media type prefix
    const mediaPrefix = detectMediaType(content);

    // First, clean up text but KEEP newlines for splitting
    let title = text
        .replace(/^[🔖🌟]\s*/u, "") // Remove bookmark emojis
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Remove all other emojis
        .trim();

    // Extract first meaningful line(s)
    let firstLine = title.split("\n")[0].trim();

    // If first line is just hashtag(s) or too short, take the next line too
    if (firstLine.length < 15 || /^[#@\s]+$/.test(firstLine)) {
        const lines = title.split("\n").filter((l) => l.trim().length > 0);
        firstLine = lines.slice(0, 2).join(" ").trim();
    }

    // Now remove hashtags/mentions and normalize whitespace
    firstLine = firstLine
        .replace(/[#@]/g, "") // Remove hashtag and mention symbols
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

    // Try to extract a meaningful sentence
    // Don't split on period if followed by digit (like "1. 2. 3.")
    let extractedTitle = firstLine;

    // If line is too short or looks like a list item, use the whole first line
    if (firstLine.length < 20 || /^\d+\.|^[-•]/.test(firstLine)) {
        extractedTitle = firstLine;
    } else {
        // Try to find first sentence (but avoid splitting numbered lists)
        const sentenceMatch = firstLine.match(/^.+?[。！？]/);
        if (sentenceMatch) {
            extractedTitle = sentenceMatch[0];
        } else {
            // For English/mixed content, split on period followed by space
            const englishSentence = firstLine.match(/^.+?\.\s+/);
            if (englishSentence && !firstLine.match(/^\d+\./)) {
                extractedTitle = englishSentence[0].trim();
            }
        }
    }

    title = extractedTitle;

    // Limit length and add ellipsis if needed
    if (title.length > maxLength) {
        // Try to cut at a natural boundary (space, comma, etc.)
        const cutPoint =
            title.lastIndexOf(" ", maxLength) || title.lastIndexOf("，", maxLength) || maxLength;
        title = `${title.substring(0, cutPoint).trim()}...`;
    }

    return `${mediaPrefix}${title}` || "无标题";
}

/**
 * Generate a plain text description for RSS feed
 * - Strips all HTML tags
 * - Removes emojis
 * - Limits to 200 characters
 */
function generateDescription(html, maxLength = 200) {
    if (!html) return "";

    // Strip HTML tags
    let text = html
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Remove emojis
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

    // Limit length
    if (text.length > maxLength) {
        text = `${text.substring(0, maxLength).trim()}...`;
    }

    return text;
}

/**
 * Fix hashtag links to point to Telegram search
 */
function fixHashtagLinks(html, channelUsername) {
    if (!html) return html;

    return html.replace(
        /<a href="\?q=([^"]+)" target="_blank">(#[^<]+)<\/a>/g,
        (_match, _query, hashtag) => {
            const tag = hashtag.replace("#", "");
            return `<a href="https://t.me/s/${channelUsername}?q=%23${encodeURIComponent(tag)}" target="_blank" rel="noopener noreferrer">${hashtag}</a>`;
        },
    );
}

export async function GET(context) {
    const CHANNEL_USERNAME = "tomoko_channel";

    try {
        // Fetch the latest posts (no pagination parameters)
        const channelData = await fetchTelegramChannel(CHANNEL_USERNAME, {});

        const rssContent = await rss({
            title: `${channelData.title || SITE_TITLE} - 动态`,
            description: channelData.description || "Telegram 频道最新动态",
            site: context.site,
            trailingSlash: false,
            items: channelData.posts.map((post) => {
                const fixedContent = fixHashtagLinks(post.content, CHANNEL_USERNAME);
                const cleanTitle = generateTitle(fixedContent);
                const description = generateDescription(post.text);

                return {
                    title: cleanTitle,
                    description: description,
                    pubDate: new Date(post.datetime),
                    link: `https://t.me/${CHANNEL_USERNAME}/${post.id}`,
                    content: sanitizeHtml(fixedContent, {
                        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
                        allowedAttributes: {
                            ...sanitizeHtml.defaults.allowedAttributes,
                            img: ["src", "alt", "loading", "class"],
                            a: ["href", "target", "rel"],
                        },
                    }),
                    customData: `<guid isPermaLink="true">https://t.me/${CHANNEL_USERNAME}/${post.id}</guid>`,
                };
            }),
            customData: `<language>zh-CN</language>
      <atom:link href="${context.site}channel-rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
            stylesheet: "/pretty-feed-v3.xsl",
        });

        // Return with proper headers
        return new Response(rssContent.body, {
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "x-content-type-options": "nosniff",
                "Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
            },
        });
    } catch (error) {
        console.error("Error generating RSS feed:", error);
        // Return empty feed on error
        const errorFeed = await rss({
            title: `${SITE_TITLE} - 动态`,
            description: "Telegram 频道动态",
            site: context.site,
            items: [],
            customData: `<language>zh-CN</language>`,
        });

        return new Response(errorFeed.body, {
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "x-content-type-options": "nosniff",
                "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
            },
        });
    }
}
