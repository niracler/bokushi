/**
 * Email notification for comment replies via Fastmail JMAP API.
 *
 * Uses JMAP (RFC 8620/8621) to create and send emails through Fastmail.
 * Requires a Fastmail API token with mail + submission scopes.
 */

import { SITE_URL } from "../consts";
import { escapeHtml as escapeHtmlBase } from "./utils";

const JMAP_SESSION_URL = "https://api.fastmail.com/jmap/session";

interface JmapConfig {
    token: string;
    from: string;
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

interface JmapSession {
    primaryAccounts: Record<string, string>;
    apiUrl: string;
}

/** Fetch JMAP session to get accountId and API endpoint. */
async function getJmapSession(token: string): Promise<JmapSession> {
    const res = await fetch(JMAP_SESSION_URL, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error(`JMAP session failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<JmapSession>;
}

/** Get the primary mail account ID and the identityId for the from address. */
async function getAccountAndIdentity(
    token: string,
    apiUrl: string,
    accountId: string,
    fromEmail: string,
): Promise<{ accountId: string; identityId: string }> {
    const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:submission"],
            methodCalls: [["Identity/get", { accountId }, "id0"]],
        }),
    });

    if (!res.ok) {
        throw new Error(`JMAP Identity/get failed: ${res.status}`);
    }

    const data = (await res.json()) as {
        methodResponses: [string, { list?: { id: string; email: string }[] }, string][];
    };
    const identities = data.methodResponses?.[0]?.[1]?.list ?? [];

    // Find identity matching the from address, or fall back to first
    const match = identities.find((i) => i.email === fromEmail) ?? identities[0];
    if (!match) {
        throw new Error(`No JMAP identity found for ${fromEmail}`);
    }

    return { accountId, identityId: match.id };
}

/** Send an email via JMAP: two requests — (1) find Drafts mailbox, (2) create + submit. */
async function sendViaJmap(
    config: JmapConfig,
    to: { name: string; email: string },
    subject: string,
    htmlBody: string,
): Promise<void> {
    const session = await getJmapSession(config.token);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    if (!accountId) {
        throw new Error("No primary mail account in JMAP session");
    }

    const { identityId } = await getAccountAndIdentity(
        config.token,
        session.apiUrl,
        accountId,
        config.from,
    );

    // Step 1: Find the Drafts mailbox ID (JMAP requires mailboxIds on Email/set)
    const mboxRes = await fetch(session.apiUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
            methodCalls: [["Mailbox/query", { accountId, filter: { role: "drafts" } }, "mbox0"]],
        }),
    });
    if (!mboxRes.ok) {
        throw new Error(`JMAP Mailbox/query failed: ${mboxRes.status}`);
    }
    const mboxData = (await mboxRes.json()) as {
        methodResponses: [string, { ids?: string[] }, string][];
    };
    const draftsId = mboxData.methodResponses?.[0]?.[1]?.ids?.[0];
    if (!draftsId) {
        throw new Error("Drafts mailbox not found");
    }

    // Step 2: Create email in Drafts + submit it in one request
    const res = await fetch(session.apiUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            using: [
                "urn:ietf:params:jmap:core",
                "urn:ietf:params:jmap:mail",
                "urn:ietf:params:jmap:submission",
            ],
            methodCalls: [
                [
                    "Email/set",
                    {
                        accountId,
                        create: {
                            draft: {
                                mailboxIds: { [draftsId]: true },
                                from: [{ name: "博客评论通知", email: config.from }],
                                to: [to],
                                subject,
                                htmlBody: [{ partId: "body", type: "text/html" }],
                                bodyValues: { body: { value: htmlBody } },
                                keywords: { $draft: true },
                            },
                        },
                    },
                    "email0",
                ],
                [
                    "EmailSubmission/set",
                    {
                        accountId,
                        create: {
                            send: {
                                emailId: "#draft",
                                identityId,
                            },
                        },
                        onSuccessDestroyEmail: ["#send"],
                    },
                    "submit0",
                ],
            ],
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`JMAP send failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
        methodResponses: [string, { notCreated?: Record<string, unknown> }, string][];
    };

    // Check for creation errors
    for (const [method, result] of data.methodResponses) {
        if (result.notCreated && Object.keys(result.notCreated).length > 0) {
            throw new Error(`JMAP ${method} failed: ${JSON.stringify(result.notCreated)}`);
        }
    }
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
    config: JmapConfig,
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

    try {
        await sendViaJmap(
            config,
            { name: recipientName, email: recipientEmail },
            subject,
            htmlBody,
        );
    } catch (error) {
        console.error("Failed to send email notification:", error);
    }
}
