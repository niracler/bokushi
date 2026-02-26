import sanitizeHtml from "sanitize-html";
import { SITE_URL } from "../consts";

/** Strip all HTML tags from a string to prevent injection into Telegram HTML messages. */
function stripHtml(text: string): string {
    return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
}

/** HTML-escape for Telegram HTML parse mode */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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

    // Comment content — send full text, no truncation
    msg += `\n\n${escapeHtml(stripHtml(params.content))}`;

    // Parent comment quote
    if (params.parentId && params.parentContent) {
        msg += `\n\n<blockquote>${escapeHtml(stripHtml(params.parentContent))}</blockquote>`;
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
