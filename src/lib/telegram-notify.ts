import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { SITE_URL } from "../consts";
import { escapeHtml } from "./utils";

// html: false — user markdown cannot inject raw HTML. Double-protected by sanitizeHtml below.
const md = MarkdownIt({ html: false, linkify: true, breaks: true }).disable("heading");

// Telegram HTML supports only: b/strong, i/em, u, s, a, code, pre, blockquote, tg-spoiler.
// Block elements like <p>/<br>/<ul>/<li>/<hr>/<h*> must be flattened to text + newlines first.
const TELEGRAM_ALLOWED: sanitizeHtml.IOptions = {
    allowedTags: ["b", "strong", "i", "em", "u", "s", "a", "code", "pre", "blockquote"],
    allowedAttributes: { a: ["href"] },
};

/** Render markdown to the subset of HTML that Telegram's parse_mode=HTML accepts. */
function markdownToTelegramHtml(raw: string): string {
    const html = md
        .render(raw)
        .replace(/<\/p>\s*<p>/g, "\n\n")
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

export interface NotifyCommentParams {
    slug: string;
    commentId: string;
    author: string;
    content: string;
    parentId?: string;
    parentAuthor?: string;
    parentContent?: string;
    postTitle?: string;
}

/** Telegram message limit is 4096 chars. Truncate final message if needed. */
const TELEGRAM_MSG_LIMIT = 4096;

/**
 * Build notification message in Remark42 style.
 *
 * Format:
 *   <a href="commentUrl">Author</a> -> <a href="parentUrl">ParentAuthor</a>
 *
 *   Comment text...
 *
 *   <blockquote>Parent comment text...</blockquote>
 *
 *   ↦  <a href="postUrl">Post Title</a>
 */
function buildMessage(params: NotifyCommentParams): string {
    const postUrl = `${SITE_URL}/${encodeURIComponent(params.slug)}`;
    const commentUrl = `${postUrl}#comment-${params.commentId}`;

    // Line 1: Author (-> ParentAuthor)
    let msg = `<a href="${commentUrl}">${escapeHtml(params.author)}</a>`;

    if (params.parentId && params.parentAuthor) {
        const parentUrl = `${postUrl}#comment-${params.parentId}`;
        msg += ` → <a href="${parentUrl}">${escapeHtml(params.parentAuthor)}</a>`;
    }

    // Comment content — render markdown to Telegram-flavored HTML.
    msg += `\n\n${markdownToTelegramHtml(params.content)}`;

    // Parent comment quote — render then wrap in blockquote.
    if (params.parentId && params.parentContent) {
        msg += `\n\n<blockquote>${markdownToTelegramHtml(params.parentContent)}</blockquote>`;
    }

    // Post title link
    const title = params.postTitle || params.slug;
    msg += `\n\n↦  <a href="${postUrl}">${escapeHtml(title)}</a>`;

    // Telegram enforces 4096 char limit; truncate final message if needed
    if (msg.length > TELEGRAM_MSG_LIMIT) {
        msg = `${msg.substring(0, TELEGRAM_MSG_LIMIT - 3)}...`;
    }

    return msg;
}

/**
 * Send a notification to Telegram when a new comment is posted.
 * Fire-and-forget: never throws, logs errors to console.
 */
export async function notifyNewComment(
    botToken: string,
    chatId: string,
    params: NotifyCommentParams,
): Promise<void> {
    try {
        const text = buildMessage(params);

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML",
                disable_web_page_preview: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Telegram notify failed (${response.status}): ${errorText}`);
        }
    } catch (error) {
        console.error("Telegram notify error:", error);
    }
}
