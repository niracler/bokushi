import * as cheerio from "cheerio";

/** Maximum input length for numbered list conversion to prevent ReDoS. */
const MAX_NUMBERED_LIST_INPUT = 50_000;

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
}

export interface TelegramPost {
    id: string;
    datetime: string;
    title: string;
    content: string;
    text: string;
    forwardedFrom?: string;
    forwardedFromLink?: string;
    linkPreview?: LinkPreview;
    replyInfo?: ReplyInfo;
    hashtags?: string[];
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
 * Decode common HTML entities so pipe-table detection works on
 * Telegram's HTML output (e.g. `&amp;`, `&#124;`, `&lt;`, `&gt;`).
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;/g, "'")
        .replace(/&#0*124;/g, "|")
        .replace(/&nbsp;/g, " ");
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
    const description = convertNumberedLists($description.text().trim());

    const avatarSrc = $(".tgme_page_photo_image img").attr("src") || "";
    const avatar = getProxiedImageUrl(avatarSrc);

    const posts: TelegramPost[] = [];
    $(".tgme_widget_message_wrap").each((_index, element) => {
        const $message = $(element).find(".tgme_widget_message");
        const id = $message.attr("data-post")?.replace(`${channelUsername}/`, "") || "";

        // Skip if no valid ID
        if (!id) return;

        // Get datetime
        const datetime = $message.find(".tgme_widget_message_date time").attr("datetime") || "";
        if (!datetime) {
            console.warn(`Missing datetime for message ${id}`);
        }

        // Check if message is forwarded
        const $forwardedFromElem = $message.find(".tgme_widget_message_forwarded_from_name");
        const forwardedFrom = $forwardedFromElem.text().trim();
        const forwardedFromLink = $forwardedFromElem.attr("href") || undefined;

        // Get text content
        const $text = $message.find(".tgme_widget_message_text");
        const text = $text.text().trim();

        // Generate title from first sentence or first line
        const title = text.match(/^.*?(?=[。\n]|$)/)?.[0] || text.substring(0, 100);

        // Process content HTML
        const $content = $text.clone();

        // Convert <br> to newlines for better text formatting
        $content.find("br").replaceWith("\n");

        // Remove inline styles from emojis
        $content.find(".emoji").removeAttr("style");

        // Add target and rel to links
        $content.find("a").each((_, link) => {
            $(link).attr("target", "_blank").attr("rel", "noopener noreferrer");
        });

        // Get images
        const images: string[] = [];
        $message.find(".tgme_widget_message_photo_wrap").each((_, photo) => {
            const style = $(photo).attr("style") || "";
            const match = style.match(/url\(['"](.+?)['"]\)/);
            if (match?.[1]) {
                images.push(getProxiedImageUrl(match[1]));
            }
        });

        // Build content HTML and convert numbered lists
        let contentHtml = convertNumberedLists($content.html() || "");

        // Convert pipe-delimited tables to HTML tables
        contentHtml = convertPipeTables(contentHtml);

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
            const replyToLink = $reply.attr("href") || undefined;

            if (replyToAuthor || replyToText) {
                replyInfo = {
                    ...(replyToAuthor && { replyToAuthor }),
                    ...(replyToText && { replyToText }),
                    ...(replyToLink && { replyToLink }),
                };
            }
        }

        // Extract hashtags
        const hashtags: string[] = [];
        $content.find("a").each((_, link) => {
            const href = $(link).attr("href") || "";
            const linkText = $(link).text().trim();
            if (linkText.startsWith("#") && (href.includes("?q=") || href.includes("/s/"))) {
                hashtags.push(linkText.slice(1));
            }
        });

        posts.push({
            id,
            datetime,
            title,
            content: contentHtml,
            text,
            ...(forwardedFrom && { forwardedFrom }),
            ...(forwardedFromLink && { forwardedFromLink }),
            ...(linkPreview && { linkPreview }),
            ...(replyInfo && { replyInfo }),
            ...(hashtags.length > 0 && { hashtags }),
        });
    });

    return { title, description, avatar, posts };
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
): Promise<TelegramChannel> {
    const fetchBatch = async (params: URLSearchParams): Promise<ParsedBatch> => {
        const queryString = params.toString();
        const url = `https://t.me/s/${channelUsername}${queryString ? `?${queryString}` : ""}`;
        const response = await fetch(url);
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
    if (/<img[\s>]/i.test(post.content)) return "photo";
    if (post.linkPreview) return "link";
    return "text";
}

interface DayGroup {
    /** YYYY-MM-DD */
    date: string;
    /** Local month anchor id, e.g. "m-2026-04" */
    monthAnchor: string;
    /** Day of month, zero-padded, e.g. "19" */
    day: string;
    /** Month-dot-day label, e.g. "04·19" */
    dayLabel: string;
    /** Uppercase weekday, e.g. "SUN" */
    weekday: string;
    posts: TelegramPost[];
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/**
 * Group posts by calendar day (in UTC for determinism between SSR runs).
 * Posts without a valid datetime are collected under an "undated" bucket.
 */
export function groupPostsByDay(posts: TelegramPost[]): DayGroup[] {
    const groups = new Map<string, DayGroup>();

    for (const post of posts) {
        const parsed = post.datetime ? new Date(post.datetime) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) continue;

        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
        const day = String(parsed.getUTCDate()).padStart(2, "0");
        const date = `${year}-${month}-${day}`;

        let group = groups.get(date);
        if (!group) {
            group = {
                date,
                monthAnchor: `m-${year}-${month}`,
                day,
                dayLabel: `${month}·${day}`,
                weekday: WEEKDAYS[parsed.getUTCDay()],
                posts: [],
            };
            groups.set(date, group);
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
