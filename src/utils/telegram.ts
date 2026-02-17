import * as cheerio from "cheerio";

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
 * Convert pipe-delimited table text into HTML <table> elements.
 * Uses line-by-line scanning instead of a single regex to handle
 * edge cases with HTML entities and varied newline formats.
 */
function convertPipeTables(html: string): string {
    const lines = html.split("\n");
    const result: string[] = [];
    let i = 0;

    const isPipeLine = (line: string) => {
        const t = line.trim();
        return t.startsWith("|") && t.endsWith("|") && t.length > 2;
    };
    const isSeparator = (line: string) => /^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(line.trim());
    const parseCells = (line: string) =>
        line
            .trim()
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());

    while (i < lines.length) {
        // Look for a sequence of 3+ pipe lines (header + separator + data)
        if (
            isPipeLine(lines[i]) &&
            i + 2 < lines.length &&
            isPipeLine(lines[i + 1]) &&
            isSeparator(lines[i + 1])
        ) {
            // Found a table starting at line i
            const headerLine = lines[i];
            // Skip separator (i+1), collect data rows
            let j = i + 2;
            while (j < lines.length && isPipeLine(lines[j]) && !isSeparator(lines[j])) {
                j++;
            }

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
    }

    return result.join("\n");
}

/**
 * Fetch and parse Telegram channel information from public web page
 * @param channelUsername - Telegram channel username (without @)
 * @param options - Pagination options (before/after message ID)
 * @returns Channel information including posts
 */
export async function fetchTelegramChannel(
    channelUsername: string,
    options: FetchOptions = {},
): Promise<TelegramChannel> {
    const params = new URLSearchParams();
    if (options.before) params.append("before", options.before);
    if (options.after) params.append("after", options.after);

    const queryString = params.toString();
    const url = `https://t.me/s/${channelUsername}${queryString ? `?${queryString}` : ""}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch channel: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract channel info
        const title = $(".tgme_channel_info_header_title").text().trim();
        // Get description HTML to preserve line breaks
        const $description = $(".tgme_channel_info_description");
        $description.find("br").replaceWith("\n");

        // Convert numbered lists in description
        let description = $description.text().trim();
        // Replace numbered lists with HTML
        description = description.replace(
            /(?:^|\n)(\d+)\.\s+(.+?)(?=\n\d+\.\s+|\n\n|$)/gs,
            (_match, num, text) => {
                if (num === "1") {
                    return `<ol><li>${text.trim()}</li>`;
                }
                return `<li>${text.trim()}</li>`;
            },
        );
        // Close the last <ol> tag if there was a list
        if (description.includes("<ol>")) {
            description = description.replace(/(<li>.*?<\/li>)(?!.*<li>)/s, "$1</ol>");
        }

        const avatarSrc = $(".tgme_page_photo_image img").attr("src") || "";
        const avatar = getProxiedImageUrl(avatarSrc);

        // Extract posts
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
            let contentHtml = $content.html() || "";

            // Convert numbered lists (1. 2. 3.) to proper HTML lists
            contentHtml = contentHtml.replace(
                /(?:^|\n)(\d+)\.\s+(.+?)(?=\n\d+\.\s+|\n\n|$)/gs,
                (_match, num, text) => {
                    if (num === "1") {
                        return `<ol><li>${text.trim()}</li>`;
                    }
                    return `<li>${text.trim()}</li>`;
                },
            );
            // Close the last <ol> tag if there was a list
            if (contentHtml.includes("<ol>")) {
                contentHtml = contentHtml.replace(/(<li>.*?<\/li>)(?!.*<li>)/s, "$1</ol>");
            }

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
                const previewDescription = $linkPreview
                    .find(".link_preview_description")
                    .text()
                    .trim();

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

        return {
            title,
            description,
            avatar,
            posts: posts.reverse(), // Reverse to show newest first
        };
    } catch (error) {
        console.error("Error fetching Telegram channel:", error);
        throw error;
    }
}
