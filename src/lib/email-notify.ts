/**
 * Email notification for comment replies using Cloudflare Email Workers.
 */

import { SITE_URL } from "../consts";
import { escapeHtml as escapeHtmlBase } from "./utils";

/** Encode a UTF-8 string to base64 without the deprecated `unescape`. */
function utf8ToBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
    return btoa(binString);
}

interface NotifyReplyOptions {
    recipientEmail: string;
    recipientName: string;
    replyAuthor: string;
    replyContent: string;
    parentContent: string;
    postTitle: string;
    postSlug: string;
}

function buildEmailHtml({
    recipientName,
    replyAuthor,
    replyContent,
    parentContent,
    postTitle,
    postUrl,
}: {
    recipientName: string;
    replyAuthor: string;
    replyContent: string;
    parentContent: string;
    postTitle: string;
    postUrl: string;
}): string {
    const escapeHtml = (str: string) => escapeHtmlBase(str).replace(/'/g, "&#039;");

    return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>评论回复通知</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">niracler.com</p>
              <p style="margin:4px 0 0;color:#aaaaaa;font-size:13px;">评论通知</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#333333;font-size:15px;">
                你好 <strong>${escapeHtml(recipientName)}</strong>，
              </p>
              <p style="margin:0 0 24px;color:#333333;font-size:15px;">
                <strong>${escapeHtml(replyAuthor)}</strong> 回复了你在「${escapeHtml(postTitle)}」的评论：
              </p>

              <!-- Parent comment (quoted) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:#f5f5f5;border-left:3px solid #cccccc;padding:12px 16px;border-radius:4px;">
                    <p style="margin:0 0 4px;color:#888888;font-size:12px;">你的评论</p>
                    <p style="margin:0;color:#555555;font-size:14px;line-height:1.6;">${escapeHtml(parentContent)}</p>
                  </td>
                </tr>
              </table>

              <!-- Reply content -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#eef4ff;border-left:3px solid #4a90e2;padding:12px 16px;border-radius:4px;">
                    <p style="margin:0 0 4px;color:#4a90e2;font-size:12px;">${escapeHtml(replyAuthor)} 的回复</p>
                    <p style="margin:0;color:#333333;font-size:14px;line-height:1.6;">${escapeHtml(replyContent)}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1a1a1a;border-radius:6px;">
                    <a href="${escapeHtml(postUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;">查看回复</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #eeeeee;">
              <p style="margin:0;color:#aaaaaa;font-size:12px;">此邮件由 niracler.com 评论系统自动发送，请勿直接回复。</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function notifyCommentReply(
    emailBinding: SendEmail,
    options: NotifyReplyOptions,
): Promise<void> {
    const {
        recipientEmail,
        recipientName,
        replyAuthor,
        replyContent,
        parentContent,
        postTitle,
        postSlug,
    } = options;

    const postUrl = `${SITE_URL}/${postSlug}#comment-section`;
    const subject = `${replyAuthor} 回复了你在「${postTitle}」的评论`;

    const htmlBody = buildEmailHtml({
        recipientName,
        replyAuthor,
        replyContent,
        parentContent,
        postTitle,
        postUrl,
    });

    // Build raw MIME email
    const rawEmail = [
        `From: =?UTF-8?B?${utf8ToBase64("博客评论通知")}?= <noreply@niracler.com>`,
        `To: ${recipientEmail}`,
        `Subject: =?UTF-8?B?${utf8ToBase64(subject)}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        utf8ToBase64(htmlBody),
    ].join("\r\n");

    try {
        const msg = new EmailMessage(
            "noreply@niracler.com",
            recipientEmail,
            new TextEncoder().encode(rawEmail),
        );
        await emailBinding.send(msg);
    } catch (error) {
        console.error("Failed to send email notification:", error);
    }
}
