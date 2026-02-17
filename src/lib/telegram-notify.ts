/** HTML-escape for Telegram HTML parse mode */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

interface NotifyCommentParams {
    slug: string;
    author: string;
    content: string;
    isReply: boolean;
    parentAuthor?: string;
}

const MAX_CONTENT_LENGTH = 500;

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
        const truncatedContent =
            params.content.length > MAX_CONTENT_LENGTH
                ? `${params.content.substring(0, MAX_CONTENT_LENGTH)}...`
                : params.content;

        const replyLine =
            params.isReply && params.parentAuthor
                ? `\n↩️ 回复 <b>${escapeHtml(params.parentAuthor)}</b>`
                : params.isReply
                  ? "\n↩️ 回复了一条评论"
                  : "";

        const text = [
            `💬 <b>新评论</b> · <a href="https://niracler.com/${encodeURIComponent(params.slug)}#comment-section">${escapeHtml(params.slug)}</a>`,
            "",
            `<b>${escapeHtml(params.author)}</b> 写道：${replyLine}`,
            `<blockquote>${escapeHtml(truncatedContent)}</blockquote>`,
        ].join("\n");

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
