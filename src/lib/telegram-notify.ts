import { SITE_URL } from "../consts";

/** HTML-escape for Telegram HTML parse mode */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Truncate text to a maximum length, appending "..." if needed */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
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

const COMMENT_TEXT_LENGTH_LIMIT = 100;

/**
 * Build notification message in Remark42 style.
 *
 * Format:
 *   <a href="commentUrl">Author</a> -> <a href="parentUrl">ParentAuthor</a>
 *
 *   Comment text...
 *
 *   "Parent comment text..."
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

    // Comment content
    msg += `\n\n${escapeHtml(truncate(params.content, COMMENT_TEXT_LENGTH_LIMIT))}`;

    // Parent comment quote
    if (params.parentId && params.parentContent) {
        msg += `\n\n"<i>${escapeHtml(truncate(params.parentContent, COMMENT_TEXT_LENGTH_LIMIT))}</i>"`;
    }

    // Post title link
    const title = params.postTitle || params.slug;
    msg += `\n\n↦  <a href="${postUrl}">${escapeHtml(title)}</a>`;

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
