import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { CHANNEL_FALLBACK_TIME_ZONE, channelDay, channelDayFormatter } from "./channel-time.ts";

/** Maximum input length for numbered list conversion to prevent ReDoS. */
const MAX_NUMBERED_LIST_INPUT = 50_000;

const TELEGRAM_CONTENT_SANITIZE_OPTIONS = {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ["href", "target", "rel", "class"],
        blockquote: ["expandable"],
        div: ["class"],
        img: ["src", "alt", "loading", "class"],
        span: ["class"],
    },
    allowedClasses: {
        a: ["hashtag-link"],
        div: ["telegram-images"],
        img: ["telegram-post-image"],
        span: ["emoji"],
    },
};

const TELEGRAM_DESCRIPTION_SANITIZE_OPTIONS = {
    allowedTags: ["ol", "li"],
    allowedAttributes: {},
};

/** Convert plain-text numbered lists (1. 2. 3.) into HTML <ol>/<li> markup. */
function convertNumberedLists(text: string): string {
    // Guard against excessively long input that could trigger catastrophic backtracking
    if (text.length > MAX_NUMBERED_LIST_INPUT) return text;

    // Use a line-based approach instead of a single regex with lookahead
    const lines = text.split("\n");
    const result: string[] = [];
    let inList = false;

    for (const line of lines) {
        const match = line.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
            const [, num, content] = match;
            if (!inList && num === "1") {
                result.push(`<ol><li>${content.trim()}</li>`);
                inList = true;
            } else if (inList) {
                result.push(`<li>${content.trim()}</li>`);
            } else {
                // Numbered line that doesn't start with 1 and not in a list - keep as-is
                result.push(line);
            }
        } else {
            if (inList) {
                result.push("</ol>");
                inList = false;
            }
            result.push(line);
        }
    }
    if (inList) {
        result.push("</ol>");
    }

    return result.join("\n");
}

export interface LinkPreview {
    url: string;
    siteName?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
}

export interface ReplyInfo {
    replyToText?: string;
    replyToAuthor?: string;
    replyToLink?: string;
    replyToThumb?: string;
}

export interface TelegramPhotoItem {
    url: string;
    link?: string;
    /** Single-photo height/width percentage from Telegram's padding-top */
    paddingTopPct?: number;
    /** Percentage coordinates inside a grouped album mosaic */
    leftPct?: number;
    topPct?: number;
    widthPct?: number;
    heightPct?: number;
}

export interface TelegramVideoInfo {
    postUrl: string;
    thumbUrl?: string;
    videoUrl?: string;
    /** Current upstream URL used only while preparing a media copy. */
    sourceUrl?: string;
    duration?: string;
    paddingTopPct?: number;
    notSupported?: boolean;
}

export interface TelegramReaction {
    emoji: string;
    count: string;
}

export interface TelegramPost {
    id: string;
    datetime: string;
    title: string;
    content: string;
    /** Sanitized HTML of the message text body without prepended .telegram-images */
    textHtml?: string;
    text: string;
    forwardedFrom?: string;
    forwardedFromLink?: string;
    linkPreview?: LinkPreview;
    replyInfo?: ReplyInfo;
    hashtags?: string[];
    photos?: TelegramPhotoItem[];
    albumAspectRatio?: number;
    missingPhoto?: boolean;
    video?: TelegramVideoInfo;
    views?: string;
    edited?: boolean;
    reactions?: TelegramReaction[];
}

export interface TelegramChannel {
    title: string;
    description: string;
    avatar: string;
    posts: TelegramPost[];
}

export interface FetchOptions {
    before?: string;
    after?: string;
    /**
     * Target minimum number of posts. Telegram's t.me/s/ page returns ~16-20 posts per
     * request; if minPosts exceeds that, we stitch additional older batches until we
     * have enough. Capped by MAX_EXTRA_BATCHES to keep SSR latency bounded.
     */
    minPosts?: number;
}

/**
 * Proxy external image URLs through our image proxy API
 * This ensures images are accessible in regions where direct access may be blocked
 */
function getProxiedImageUrl(imageUrl: string): string {
    if (!imageUrl) return "";
    return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Proxy playable Telegram videos by channel + post ID so expired CDN tokens
 * can be refreshed on demand even when /channel HTML is edge-cached.
 */
function getProxiedVideoUrl(channelUsername: string, postId: string): string {
    if (!channelUsername || !postId) return "";
    return `/api/video-proxy?channel=${encodeURIComponent(channelUsername)}&post=${encodeURIComponent(postId)}`;
}

/**
 * Decode common HTML entities so pipe-table detection works on
 * Telegram's HTML output (e.g. `&amp;`, `&#124;`, `&lt;`, `&gt;`).
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;/g, "'")
        .replace(/&#0*124;/g, "|")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

/**
 * Convert pipe-delimited table text into HTML <table> elements.
 * Uses line-by-line scanning instead of a single regex to handle
 * edge cases with HTML entities and varied newline formats.
 *
 * Handles tables with or without leading/trailing pipes, and
 * decodes HTML entities before testing pipe-line patterns.
 */
function convertPipeTables(html: string): string {
    const lines = html.split("\n");
    const result: string[] = [];
    let i = 0;

    /** Test whether a line looks like a pipe-delimited row. */
    const isPipeLine = (line: string) => {
        const t = decodeHtmlEntities(line).trim();
        // Standard: |col|col|
        if (t.startsWith("|") && t.endsWith("|") && t.length > 2) return true;
        // Variant without outer pipes: col | col
        if (!t.startsWith("|") && t.includes("|") && t.split("|").length >= 2) return true;
        return false;
    };

    /** Test whether a line is the --- separator row. */
    const isSeparator = (line: string) => {
        const t = decodeHtmlEntities(line).trim();
        // With outer pipes: | --- | --- |
        if (/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(t)) return true;
        // Without outer pipes: --- | ---
        if (/^[\s\-:]+(\|[\s\-:]+)+$/.test(t)) return true;
        return false;
    };

    /** Split a pipe-delimited line into cell values. */
    const parseCells = (line: string) => {
        const t = decodeHtmlEntities(line).trim();
        if (t.startsWith("|")) {
            // Standard: |col|col|  — drop first and last empty splits
            return t
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim());
        }
        // Without outer pipes: col | col
        return t.split("|").map((c) => c.trim());
    };

    while (i < lines.length) {
        // Look for a sequence of 3+ pipe lines (header + separator + data)
        if (
            isPipeLine(lines[i]) &&
            i + 2 < lines.length &&
            isPipeLine(lines[i + 1]) &&
            isSeparator(lines[i + 1])
        ) {
            try {
                // Found a table starting at line i
                const headerLine = lines[i];
                // Skip separator (i+1), collect data rows
                let j = i + 2;
                while (j < lines.length && isPipeLine(lines[j]) && !isSeparator(lines[j])) {
                    j++;
                }

                // Only emit a table if there is at least one data row
                if (j > i + 2) {
                    const headers = parseCells(headerLine);
                    let tableHtml = "<table><thead><tr>";
                    for (const h of headers) tableHtml += `<th>${h}</th>`;
                    tableHtml += "</tr></thead><tbody>";

                    for (let k = i + 2; k < j; k++) {
                        const cells = parseCells(lines[k]);
                        tableHtml += "<tr>";
                        for (const c of cells) tableHtml += `<td>${c}</td>`;
                        tableHtml += "</tr>";
                    }
                    tableHtml += "</tbody></table>";
                    result.push(tableHtml);
                    i = j;
                } else {
                    result.push(lines[i]);
                    i++;
                }
            } catch {
                // Malformed table - return original lines as-is
                result.push(lines[i]);
                i++;
            }
        } else {
            result.push(lines[i]);
            i++;
        }
    }

    return result.join("\n");
}

/**
 * Cap on additional stitched batches. Telegram's t.me/s/ page returns ~16-20 posts
 * per request, so 3 extras bounds SSR at ~4 sequential fetches / ~60-80 posts total.
 */
const MAX_EXTRA_BATCHES = 3;

interface ParsedBatch {
    title: string;
    description: string;
    avatar: string;
    /** Posts in Telegram's DOM order (oldest-first); caller decides final ordering. */
    posts: TelegramPost[];
}

/**
 * Parse a single Telegram channel page's HTML. Pure function — no network I/O.
 * Extracted so we can parse multiple batches when stitching a larger result set.
 */
function parseChannelHtml(html: string, channelUsername: string): ParsedBatch {
    const $ = cheerio.load(html);

    const title = $(".tgme_channel_info_header_title").text().trim();
    const $description = $(".tgme_channel_info_description");
    $description.find("br").replaceWith("\n");
    const description = sanitizeHtml(
        convertNumberedLists($description.text().trim()),
        TELEGRAM_DESCRIPTION_SANITIZE_OPTIONS,
    );

    const avatarSrc = $(".tgme_page_photo_image img").attr("src") || "";
    const avatar = getProxiedImageUrl(avatarSrc);

    const posts: TelegramPost[] = [];
    $(".tgme_widget_message[data-post]").each((_index, element) => {
        const $message = $(element);

        // Skip service messages (e.g. "Channel pinned «...»")
        if ($message.hasClass("service_message")) return;

        const id = $message.attr("data-post")?.replace(`${channelUsername}/`, "") || "";

        // Skip if no valid ID
        if (!/^[1-9]\d*$/.test(id)) return;

        // Get datetime
        const datetime = $message.find(".tgme_widget_message_date time").attr("datetime") || "";
        if (!datetime) {
            console.warn(`Missing datetime for message ${id}`);
        }

        // Check if message is forwarded
        const $forwardedFromElem = $message.find(".tgme_widget_message_forwarded_from_name");
        const forwardedFrom = $forwardedFromElem.text().trim();
        const forwardedFromLink = $forwardedFromElem.attr("href") || undefined;

        // Get message body text: exclude reply quote text (.js-message_reply_text)
        // and unwrap grouped-album double-nested .js-message_text containers.
        const $text = $message
            .find(".tgme_widget_message_text")
            .filter((_, el) => {
                const $el = $(el);
                if ($el.closest(".tgme_widget_message_reply").length > 0) return false;
                if ($el.hasClass("js-message_reply_text")) return false;
                if ($el.find(".tgme_widget_message_text").length > 0) return false;
                return true;
            })
            .first();

        // Process content HTML
        const $content = $text.clone();

        // Unwrap <i class="emoji" style="..."><b>🌟</b></i> into upright <span class="emoji">🌟</span>
        $content.find(".emoji").each((_, el) => {
            const $el = $(el);
            $el.replaceWith(`<span class="emoji">${$el.text()}</span>`);
        });

        // Extract hashtags and normalize links (including relative ?q=%23hashtag links)
        const hashtags: string[] = [];
        $content.find("a").each((_, link) => {
            const $link = $(link);
            const href = $link.attr("href") || "";
            let linkText = $link.text().trim();

            // Merge truncated CJK/word hashtag suffixes (e.g. `<a ...>#1</a>月新番` -> `#1月新番`)
            if (linkText.startsWith("#") && link.nextSibling?.type === "text") {
                const nextTextNode = link.nextSibling as unknown as { data?: string };
                const rawAfter = nextTextNode.data || "";
                const suffixMatch = rawAfter.match(/^([\p{L}\p{N}_]+)/u);
                if (suffixMatch?.[1]) {
                    linkText = `${linkText}${suffixMatch[1]}`;
                    $link.text(linkText);
                    nextTextNode.data = rawAfter.slice(suffixMatch[1].length);
                }
            }

            if (
                linkText.startsWith("#") &&
                (href.includes("?q=") || href.includes("/s/") || href.includes("/hashtag/"))
            ) {
                hashtags.push(linkText.slice(1));
            }
            if (
                linkText.startsWith("#") &&
                (href.startsWith("?q=") || href.includes("/hashtag/"))
            ) {
                $link.attr(
                    "href",
                    `https://t.me/s/${channelUsername}?q=%23${encodeURIComponent(linkText.slice(1))}`,
                );
            }
            if (linkText.startsWith("#")) {
                $link.addClass("hashtag-link");
            }
            $link.attr("target", "_blank").attr("rel", "noopener noreferrer");
            $link.removeAttr("onclick");
        });

        // Convert <br> to newlines for line-based list/table converters
        $content.find("br").replaceWith("\n");

        const text = $content.text().trim();

        // Generate title from first sentence or first line
        const title = text.match(/^.*?(?=[。\n]|$)/)?.[0] || text.substring(0, 100);

        // Extract photos (supporting both single photo and grouped album mosaic coordinates)
        const images: string[] = [];
        const photos: TelegramPhotoItem[] = [];
        let albumAspectRatio: number | undefined;
        let missingPhoto = false;

        const $groupedLayer = $message.find(".tgme_widget_message_grouped_layer").first();
        if ($groupedLayer.length) {
            const layerStyle = $groupedLayer.attr("style") || "";
            const layerW = Number(layerStyle.match(/width:\s*([\d.]+)px/i)?.[1] || 0);
            const layerH = Number(layerStyle.match(/height:\s*([\d.]+)px/i)?.[1] || 0);
            if (layerW > 0 && layerH > 0) {
                albumAspectRatio = Number((layerW / layerH).toFixed(4));
            }
            $groupedLayer.find(".tgme_widget_message_photo_wrap").each((_, photo) => {
                const $photo = $(photo);
                const style = $photo.attr("style") || "";
                const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
                if (!match?.[1]) {
                    missingPhoto = true;
                    return;
                }
                const proxiedUrl = getProxiedImageUrl(match[1]);
                images.push(proxiedUrl);

                const left = Number(style.match(/left:\s*([\d.]+)px/i)?.[1] ?? Number.NaN);
                const top = Number(style.match(/top:\s*([\d.]+)px/i)?.[1] ?? Number.NaN);
                const width = Number(style.match(/width:\s*([\d.]+)px/i)?.[1] ?? Number.NaN);
                const height = Number(style.match(/height:\s*([\d.]+)px/i)?.[1] ?? Number.NaN);
                const hasCoords =
                    layerW > 0 &&
                    layerH > 0 &&
                    !Number.isNaN(left) &&
                    !Number.isNaN(top) &&
                    !Number.isNaN(width) &&
                    !Number.isNaN(height);

                photos.push({
                    url: proxiedUrl,
                    link: $photo.attr("href") || undefined,
                    ...(hasCoords && {
                        leftPct: Number(((left / layerW) * 100).toFixed(3)),
                        topPct: Number(((top / layerH) * 100).toFixed(3)),
                        widthPct: Number(((width / layerW) * 100).toFixed(3)),
                        heightPct: Number(((height / layerH) * 100).toFixed(3)),
                    }),
                });
            });
        } else {
            $message.find(".tgme_widget_message_photo_wrap").each((_, photo) => {
                const $photo = $(photo);
                const style = $photo.attr("style") || "";
                const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
                if (!match?.[1]) {
                    missingPhoto = true;
                    return;
                }
                const proxiedUrl = getProxiedImageUrl(match[1]);
                images.push(proxiedUrl);

                const innerStyle = $photo.find(".tgme_widget_message_photo").attr("style") || "";
                const paddingTop = Number(
                    innerStyle.match(/padding-top:\s*([\d.]+)%/i)?.[1] ?? Number.NaN,
                );
                photos.push({
                    url: proxiedUrl,
                    link: $photo.attr("href") || undefined,
                    ...(!Number.isNaN(paddingTop) && { paddingTopPct: paddingTop }),
                });
            });
        }

        // Extract video player (cover thumb, playable <video> if small, duration badge)
        let video: TelegramVideoInfo | undefined;
        const $videoPlayer = $message.find(".tgme_widget_message_video_player").first();
        if ($videoPlayer.length) {
            const postUrl = $videoPlayer.attr("href") || `https://t.me/${channelUsername}/${id}`;
            const thumbStyle =
                $videoPlayer.find(".tgme_widget_message_video_thumb").attr("style") || "";
            const thumbMatch = thumbStyle.match(/url\(['"]?([^'")]+)['"]?\)/i);
            const thumbUrl = thumbMatch?.[1] ? getProxiedImageUrl(thumbMatch[1]) : undefined;
            const rawVideoUrl =
                $videoPlayer.find("video.tgme_widget_message_video, video").attr("src") ||
                undefined;
            const duration =
                $videoPlayer.find(".message_video_duration").text().trim() || undefined;
            const wrapStyle =
                $videoPlayer.find(".tgme_widget_message_video_wrap").attr("style") || "";
            const paddingTop = Number(
                wrapStyle.match(/padding-top:\s*([\d.]+)%/i)?.[1] ?? Number.NaN,
            );
            const notSupported = $videoPlayer.hasClass("not_supported") || !rawVideoUrl;
            const videoUrl = !notSupported ? getProxiedVideoUrl(channelUsername, id) : undefined;

            video = {
                postUrl,
                ...(thumbUrl && { thumbUrl }),
                ...(videoUrl && { videoUrl, sourceUrl: rawVideoUrl }),
                ...(duration && { duration }),
                ...(!Number.isNaN(paddingTop) && { paddingTopPct: paddingTop }),
                notSupported,
            };
        }

        // Build content HTML and convert numbered lists
        let rawTextHtml = convertNumberedLists($content.html() || "");

        // Convert pipe-delimited tables to HTML tables
        rawTextHtml = convertPipeTables(rawTextHtml);

        // Clean up stray newlines around blockquotes so pre-line doesn't double-space them
        rawTextHtml = rawTextHtml
            .replace(/\n*(<blockquote\b[^>]*>)\n*/gi, "$1")
            .replace(/\n*(<\/blockquote>)\n*/gi, "$1");

        const textHtml = sanitizeHtml(rawTextHtml, TELEGRAM_CONTENT_SANITIZE_OPTIONS);
        let contentHtml = rawTextHtml;

        // Add images if any
        if (images.length > 0) {
            const imagesHtml = images
                .map(
                    (img) =>
                        `<img src="${img}" alt="${title}" loading="lazy" class="telegram-post-image" />`,
                )
                .join("");
            contentHtml = `<div class="telegram-images">${imagesHtml}</div>${contentHtml}`;
        }

        // Telegram is a remote HTML source. Sanitize once after every local transformation so
        // all consumers, including Astro set:html, receive the same inert content.
        contentHtml = sanitizeHtml(contentHtml, TELEGRAM_CONTENT_SANITIZE_OPTIONS);

        // Extract link preview
        let linkPreview: LinkPreview | undefined;
        const $linkPreview = $message.find(".tgme_widget_message_link_preview");
        if ($linkPreview.length) {
            const previewUrl = $linkPreview.attr("href") || "";
            const siteName = $linkPreview.find(".link_preview_site_name").text().trim();
            const previewTitle = $linkPreview.find(".link_preview_title").text().trim();
            const previewDescription = $linkPreview.find(".link_preview_description").text().trim();

            // Extract image from style or img tag
            let previewImageUrl = "";
            const $previewImage = $linkPreview.find(
                ".link_preview_image, .link_preview_right_image",
            );
            if ($previewImage.length) {
                const style = $previewImage.attr("style") || "";
                const imgMatch = style.match(/url\(['"](.+?)['"]\)/);
                if (imgMatch?.[1]) {
                    previewImageUrl = getProxiedImageUrl(imgMatch[1]);
                } else {
                    const imgSrc =
                        $previewImage.find("img").attr("src") || $previewImage.attr("src");
                    if (imgSrc) {
                        previewImageUrl = getProxiedImageUrl(imgSrc);
                    }
                }
            }

            if (previewUrl || previewTitle) {
                linkPreview = {
                    url: previewUrl,
                    ...(siteName && { siteName }),
                    ...(previewTitle && { title: previewTitle }),
                    ...(previewDescription && { description: previewDescription }),
                    ...(previewImageUrl && { imageUrl: previewImageUrl }),
                };
            }
        }

        // Extract reply info
        let replyInfo: ReplyInfo | undefined;
        const $reply = $message.find(".tgme_widget_message_reply");
        if ($reply.length) {
            const replyToAuthor = $reply.find(".tgme_widget_message_author_name").text().trim();
            const replyToText = $reply
                .find(".tgme_widget_message_metatext, .tgme_widget_message_text")
                .text()
                .trim();
            const rawReplyHref = $reply.attr("href") || "";
            const replyToLink =
                rawReplyHref && !rawReplyHref.startsWith("https://t.me//")
                    ? rawReplyHref
                    : undefined;
            const replyThumbStyle =
                $reply.find(".tgme_widget_message_reply_thumb").attr("style") || "";
            const replyThumbMatch = replyThumbStyle.match(/url\(['"]?([^'")]+)['"]?\)/i);
            const replyToThumb = replyThumbMatch?.[1]
                ? getProxiedImageUrl(replyThumbMatch[1])
                : undefined;

            if (replyToAuthor || replyToText || replyToThumb) {
                replyInfo = {
                    ...(replyToAuthor && { replyToAuthor }),
                    ...(replyToText && { replyToText }),
                    ...(replyToLink && { replyToLink }),
                    ...(replyToThumb && { replyToThumb }),
                };
            }
        }

        // Extract views, edited flag, and reactions
        const views =
            $message.find(".tgme_widget_message_views").first().text().trim() || undefined;
        const metaText = $message.find(".tgme_widget_message_meta").first().text() || "";
        const edited = /\bedited\b/i.test(metaText);
        const reactions: TelegramReaction[] = [];
        $message.find(".tgme_widget_message_reactions .tgme_reaction").each((_, el) => {
            const $r = $(el).clone();
            const emojiText =
                $r.find(".emoji").text().trim() || ($r.find("tg-emoji").length ? "✨" : "");
            $r.find(".emoji, tg-emoji").remove();
            const count = $r.text().trim();
            if (emojiText && count) {
                reactions.push({ emoji: emojiText, count });
            }
        });

        posts.push({
            id,
            datetime,
            title,
            content: contentHtml,
            textHtml,
            text,
            ...(forwardedFrom && { forwardedFrom }),
            ...(forwardedFromLink && { forwardedFromLink }),
            ...(linkPreview && { linkPreview }),
            ...(replyInfo && { replyInfo }),
            ...(hashtags.length > 0 && { hashtags }),
            ...(photos.length > 0 && { photos }),
            ...(albumAspectRatio && { albumAspectRatio }),
            missingPhoto: missingPhoto || undefined,
            ...(video && { video }),
            ...(views && { views }),
            ...(edited && { edited }),
            ...(reactions.length > 0 && { reactions }),
        });
    });

    return { title, description, avatar, posts };
}

/** Only the explicit missing-post message on a successful embed confirms removal. */
export async function fetchTelegramPost(channel: string, id: string, fetcher = fetch) {
    const response = await fetcher(`https://t.me/${channel}/${id}?embed=1&mode=tme`, {
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Telegram embed returned ${response.status}`);
    const html = await response.text();
    const post = parseChannelHtml(html, channel).posts.find((item) => item.id === id);
    if (post?.datetime && (post.text || post.photos?.length || post.video || post.linkPreview))
        return post;
    const message = cheerio.load(html)(".tgme_widget_message_error").text().trim();
    if (message !== "Post not found") throw new Error("Unrecognized Telegram embed");

    // A private/unavailable channel can make every embed disappear. Require a readable
    // public feed from this channel before retiring a previously published copy.
    const channelPage = await fetcher(`https://t.me/s/${channel}?before=${Number(id) + 1}`, {
        signal: AbortSignal.timeout(8_000),
        redirect: "manual",
    });
    if (!channelPage.ok) throw new Error("Could not confirm the public channel");
    const nearby = parseChannelHtml(await channelPage.text(), channel);
    if (!nearby.title) throw new Error("Could not confirm the public channel");
    return nearby.posts.find((item) => item.id === id) ?? null;
}

/**
 * Fetch and parse Telegram channel information from public web page.
 * When `options.minPosts` exceeds what a single fetch returns (~16-20), we stitch
 * additional older batches using `before=<oldestId>` until we reach the target or
 * hit `MAX_EXTRA_BATCHES`. Duplicates across batches are discarded by post id.
 *
 * @param channelUsername - Telegram channel username (without @)
 * @param options - Pagination cursor + optional minPosts target
 * @returns Channel information including posts (newest-first for display)
 */
export async function fetchTelegramChannel(
    channelUsername: string,
    options: FetchOptions = {},
    transport: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<TelegramChannel> {
    // One deadline covers all batches and response bodies, not 8s per batch.
    const signal = AbortSignal.timeout(transport.timeoutMs ?? 8_000);
    const fetcher = transport.fetch ?? fetch;
    const fetchBatch = async (params: URLSearchParams): Promise<ParsedBatch> => {
        signal.throwIfAborted();
        const queryString = params.toString();
        const url = `https://t.me/s/${channelUsername}${queryString ? `?${queryString}` : ""}`;
        const response = await fetcher(url, { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch channel: ${response.statusText}`);
        }
        return parseChannelHtml(await response.text(), channelUsername);
    };

    try {
        const initialParams = new URLSearchParams();
        if (options.before) initialParams.append("before", options.before);
        if (options.after) initialParams.append("after", options.after);

        const initial = await fetchBatch(initialParams);
        const { title, description, avatar } = initial;

        // Collected posts stay in DOM order (oldest-first) while we stitch.
        let collected = initial.posts;
        const seenIds = new Set(collected.map((p) => p.id));

        const minPosts = options.minPosts ?? 20;
        let extraBatches = 0;

        while (collected.length < minPosts && extraBatches < MAX_EXTRA_BATCHES) {
            const oldestId = collected[0]?.id;
            if (!oldestId) break;

            const nextParams = new URLSearchParams();
            nextParams.append("before", oldestId);
            const next = await fetchBatch(nextParams);

            const newPosts = next.posts.filter((p) => !seenIds.has(p.id));
            if (newPosts.length === 0) break; // reached channel's oldest post
            for (const p of newPosts) seenIds.add(p.id);
            collected = [...newPosts, ...collected];
            extraBatches++;
        }

        return {
            title,
            description,
            avatar,
            posts: collected.reverse(), // newest-first for display
        };
    } catch (error) {
        console.error("Error fetching Telegram channel:", error);
        throw error;
    }
}

/* =================================================================
 * Channel view helpers — card-type detection + aggregations
 * Used by /channel page to drive the v4 剪报本 layout (spine / rail /
 * day dividers / typed cards).
 * ================================================================= */

export type CardType = "text" | "link" | "photo" | "fwd" | "code";

/**
 * Classify a post into one of the 5 card shapes the design supports.
 * This is the only business-logic choice in the display pipeline —
 * which signal wins when a post has multiple (e.g. a forward that
 * also contains an image). Tweak priorities below to taste.
 */
export function detectCardType(post: TelegramPost): CardType {
    // TODO: Customize the priority order or add new signals
    if (post.forwardedFrom) return "fwd";
    if (/<pre[\s>]/i.test(post.content)) return "code";
    if ((post.photos && post.photos.length > 0) || post.video || /<img[\s>]/i.test(post.content)) {
        return "photo";
    }
    if (post.linkPreview) return "link";
    return "text";
}

interface DayGroup {
    /** YYYY-MM-DD */
    date: string;
    /** Local month anchor id, e.g. "m-2026-04" */
    monthAnchor: string;
    /** Year-dot-month label, e.g. "2026·04" */
    monthLabel: string;
    /** Day of month, zero-padded, e.g. "19" */
    day: string;
    /** Month-dot-day label, e.g. "04·19" */
    dayLabel: string;
    /** Uppercase weekday, e.g. "SUN" */
    weekday: string;
    posts: TelegramPost[];
}

/** Group posts by calendar day in the same time zone as the post captions. */
export function groupPostsByDay(
    posts: TelegramPost[],
    timeZone = CHANNEL_FALLBACK_TIME_ZONE,
): DayGroup[] {
    const formatter = channelDayFormatter(timeZone);
    const groups = new Map<string, DayGroup>();

    for (const post of posts) {
        const parsed = post.datetime ? new Date(post.datetime) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) continue;

        const day = channelDay(formatter, parsed);
        let group = groups.get(day.date);
        if (!group) {
            group = { ...day, posts: [] };
            groups.set(day.date, group);
        }
        group.posts.push(post);
    }

    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/** Count posts per card type within the given slice. */
export function tallyByType(posts: TelegramPost[]): Record<CardType, number> {
    const result: Record<CardType, number> = { text: 0, link: 0, photo: 0, fwd: 0, code: 0 };
    for (const post of posts) result[detectCardType(post)]++;
    return result;
}

interface ForwardSource {
    handle: string;
    link?: string;
    count: number;
}

/** Tally forward sources (most frequent first, deduped by handle). */
export function collectForwardSources(posts: TelegramPost[], limit = 4): ForwardSource[] {
    const sources = new Map<string, ForwardSource>();
    for (const post of posts) {
        if (!post.forwardedFrom) continue;
        const handle = post.forwardedFrom;
        const existing = sources.get(handle);
        if (existing) {
            existing.count++;
        } else {
            sources.set(handle, {
                handle,
                count: 1,
                ...(post.forwardedFromLink && { link: post.forwardedFromLink }),
            });
        }
    }
    return Array.from(sources.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
