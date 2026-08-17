import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { SITE_URL } from "../consts";
import { commentMarkdownToPlainText, extractCommentMarkdownImages } from "../utils/commentMarkdown";
import { escapeHtml } from "./utils";

type ImageRenderMode = "omit" | "links";

interface TelegramRenderEnv {
    imageMode: ImageRenderMode;
}

const md = MarkdownIt({ html: false, linkify: true, breaks: true }).disable("heading");

md.renderer.rules.image = (tokens, index, _options, env: TelegramRenderEnv) => {
    if (env.imageMode === "omit") return "";
    const token = tokens[index];
    const url = token.attrGet("src") ?? "";
    let isHttps = false;
    try {
        isHttps = new URL(url).protocol === "https:";
    } catch {
        // Invalid image targets remain a non-clickable marker.
    }
    if (!isHttps) return "〔图片〕";
    const label = token.content.trim() || "图片";
    return `<a href="${escapeHtml(url)}">🖼 ${escapeHtml(label)}</a>`;
};

// Telegram HTML supports only a small subset of tags. Block elements are flattened first.
const TELEGRAM_ALLOWED: sanitizeHtml.IOptions = {
    allowedTags: ["b", "strong", "i", "em", "u", "s", "a", "code", "pre", "blockquote"],
    allowedAttributes: { a: ["href"] },
};

export interface NotifyCommentParams {
    slug: string;
    commentId: string;
    author: string;
    content: string;
    replyToId?: string;
    replyToAuthor?: string;
    replyToContent?: string;
    postTitle?: string;
}

export const TELEGRAM_TEXT_LIMIT = 4096;
export const TELEGRAM_CAPTION_LIMIT = 1024;
export const TELEGRAM_QUOTE_LIMIT = 80;
const TELEGRAM_MEDIA_LIMIT = 10;

function markdownToTelegramHtml(raw: string, imageMode: ImageRenderMode): string {
    const html = md
        .render(raw, { imageMode } satisfies TelegramRenderEnv)
        .replace(/<\/p>\s*<p>/g, "\n\n")
        .replace(/<\/p>\s*<blockquote>/g, "</p>\n\n<blockquote>")
        .replace(/<\/blockquote>\s*<p>/g, "</blockquote>\n\n<p>")
        .replace(/<\/?p>/g, "")
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<li>/g, "• ")
        .replace(/<\/li>/g, "\n")
        .replace(/<\/?(ul|ol)>/g, "")
        .replace(/<hr\s*\/?>/g, "\n———\n")
        .replace(/<h[1-6][^>]*>/g, "<b>")
        .replace(/<\/h[1-6]>/g, "</b>\n");
    return sanitizeHtml(html, TELEGRAM_ALLOWED).trim();
}

function decodeHtmlEntities(raw: string): string {
    return raw
        .replace(/&#x([0-9a-f]+);/giu, (_match, value: string) =>
            String.fromCodePoint(Number.parseInt(value, 16)),
        )
        .replace(/&#(\d+);/gu, (_match, value: string) =>
            String.fromCodePoint(Number.parseInt(value, 10)),
        )
        .replace(/&quot;/gu, '"')
        .replace(/&gt;/gu, ">")
        .replace(/&lt;/gu, "<")
        .replace(/&amp;/gu, "&");
}

export function telegramVisibleLength(html: string): number {
    const plain = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
    // Telegram entity offsets and limits use UTF-16 code units; String.length is conservative
    // for astral emoji compared with counting Unicode code points.
    return decodeHtmlEntities(plain).length;
}

function truncatePlainText(raw: string, limit: number): string {
    const characters = Array.from(raw);
    if (characters.length <= limit) return raw;
    return `${characters.slice(0, Math.max(0, limit - 1)).join("")}…`;
}

export function summarizeCommentQuote(raw: string): string {
    return truncatePlainText(commentMarkdownToPlainText(raw), TELEGRAM_QUOTE_LIMIT);
}

interface BuildMessageOptions {
    limit: number;
    imageMode: ImageRenderMode;
    omittedMediaCount?: number;
}

export function buildTelegramMessage(
    params: NotifyCommentParams,
    options: BuildMessageOptions,
): string {
    const encodedSlug = params.slug.split("/").map(encodeURIComponent).join("/");
    const postUrl = `${SITE_URL}/${encodedSlug}`;
    const commentUrl = `${postUrl}#comment-${encodeURIComponent(params.commentId)}`;
    const author = truncatePlainText(params.author, 50);
    let header = `<a href="${commentUrl}">${escapeHtml(author)}</a>`;

    if (params.replyToId && params.replyToAuthor) {
        const targetUrl = `${postUrl}#comment-${encodeURIComponent(params.replyToId)}`;
        const targetAuthor = truncatePlainText(params.replyToAuthor, 50);
        header += ` → <a href="${targetUrl}">${escapeHtml(targetAuthor)}</a>`;
    }

    const quote =
        params.replyToId && params.replyToContent
            ? summarizeCommentQuote(params.replyToContent)
            : "";
    const title = truncatePlainText(params.postTitle || params.slug, 120);
    const footer = `↦  <a href="${postUrl}">${escapeHtml(title)}</a>`;
    const mediaNote = options.omittedMediaCount
        ? `另有 ${options.omittedMediaCount} 张图片，请打开原评论查看。`
        : "";

    const assemble = (contentHtml: string): string => {
        const blocks = [header];
        if (contentHtml) blocks.push(contentHtml);
        if (quote) blocks.push(`<blockquote>${escapeHtml(quote)}</blockquote>`);
        if (mediaNote) blocks.push(escapeHtml(mediaNote));
        blocks.push(footer);
        return blocks.join("\n\n");
    };

    const fullContent = markdownToTelegramHtml(params.content, options.imageMode);
    const fullMessage = assemble(fullContent);
    if (telegramVisibleLength(fullMessage) <= options.limit) return fullMessage;

    const characters = Array.from(params.content);
    let low = 0;
    let high = characters.length;
    let best = assemble("");

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const source = `${characters.slice(0, middle).join("")}…`;
        const candidate = assemble(markdownToTelegramHtml(source, options.imageMode));
        if (telegramVisibleLength(candidate) <= options.limit) {
            best = candidate;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    return best;
}

async function callTelegram(
    botToken: string,
    method: "sendMessage" | "sendPhoto" | "sendMediaGroup",
    payload: Record<string, unknown>,
): Promise<boolean> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (response.ok) return true;
        console.error("Telegram notification request failed", { method, status: response.status });
    } catch (error) {
        console.error("Telegram notification request failed", {
            method,
            category: error instanceof Error ? error.name : "unknown",
        });
    }
    return false;
}

/** Send a comment notification without allowing delivery failures to affect comment creation. */
export async function notifyNewComment(
    botToken: string,
    chatId: string,
    params: NotifyCommentParams,
): Promise<void> {
    const allImages = extractCommentMarkdownImages(params.content);
    const images = allImages.slice(0, TELEGRAM_MEDIA_LIMIT);

    if (images.length > 0) {
        const caption = buildTelegramMessage(params, {
            limit: TELEGRAM_CAPTION_LIMIT,
            imageMode: "omit",
            omittedMediaCount: allImages.length - images.length,
        });

        const sent =
            images.length === 1
                ? await callTelegram(botToken, "sendPhoto", {
                      chat_id: chatId,
                      photo: images[0].url,
                      caption,
                      parse_mode: "HTML",
                      show_caption_above_media: true,
                  })
                : await callTelegram(botToken, "sendMediaGroup", {
                      chat_id: chatId,
                      media: images.map((image, index) => ({
                          type: "photo",
                          media: image.url,
                          ...(index === 0
                              ? {
                                    caption,
                                    parse_mode: "HTML",
                                    show_caption_above_media: true,
                                }
                              : {}),
                      })),
                  });

        if (sent) return;
    }

    const text = buildTelegramMessage(params, {
        limit: TELEGRAM_TEXT_LIMIT,
        imageMode: "links",
    });
    await callTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });
}
