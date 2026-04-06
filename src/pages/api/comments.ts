/**
 * Comments API
 *
 * GET  /api/comments?slug=xxx&sort=latest|oldest - List comments for a post (tree structure)
 * POST /api/comments           - Create a new comment
 */

import type { APIRoute } from "astro";
import { getSessionUser } from "../../lib/auth";
import { notifyCommentReply } from "../../lib/email-notify";
import { notifyNewComment } from "../../lib/telegram-notify";
import {
    COMMENT_LIMITS,
    getClientIP,
    hashEmail,
    hashIP,
    jsonResponse,
    validateCommentInput,
    verifySameOrigin,
} from "../../lib/utils";

export const prerender = false;

interface CommentRow {
    id: string;
    slug: string;
    parent_id: string | null;
    author: string;
    email: string | null;
    website: string | null;
    content: string;
    ip_hash: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
    is_pinned: number | null;
    user_id: string | null;
    user_name: string | null;
    user_avatar: string | null;
    user_role: string | null;
    user_email: string | null;
    email_notified: string | null;
}

interface CommentNode {
    id: string;
    author: string;
    gravatar_hash: string | null;
    website: string | null;
    content: string;
    status: string;
    created_at: string;
    updated_at: string | null;
    is_pinned: boolean;
    user_id: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    user_email?: string | null;
    email_notified?: string | null;
    replies: CommentNode[];
}

type CommentSortOrder = "latest" | "oldest";

function parseSortOrder(sort: string | null): CommentSortOrder {
    return sort === "oldest" ? "oldest" : "latest";
}

function toTimestamp(iso: string): number {
    const ts = Date.parse(iso);
    return Number.isFinite(ts) ? ts : 0;
}

async function buildCommentTree(
    rows: CommentRow[],
    sortOrder: CommentSortOrder,
    isAdminRequest = false,
): Promise<{ comments: CommentNode[]; total: number }> {
    const topLevel: CommentNode[] = [];
    const repliesByParent = new Map<string, CommentNode[]>();

    // Pre-compute all gravatar hashes in parallel
    const gravatarHashes = await Promise.all(
        rows.map((row) =>
            row.status !== "deleted" && !row.user_id && row.email
                ? hashEmail(row.email)
                : Promise.resolve(null),
        ),
    );

    // Group replies by parent_id
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const isDeleted = row.status === "deleted";
        const gravatarHash = gravatarHashes[i];
        const node: CommentNode = {
            id: row.id,
            author: isDeleted ? "" : row.user_name || row.author,
            gravatar_hash: gravatarHash,
            website: isDeleted ? null : row.website,
            content: isDeleted ? "" : row.content,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            is_pinned: !isDeleted && !row.parent_id && row.is_pinned === 1,
            user_id: isDeleted ? null : row.user_id,
            avatar_url: isDeleted ? null : row.user_avatar,
            is_admin: !isDeleted && row.user_role === "admin",
            ...(isAdminRequest && !isDeleted
                ? {
                      ...(row.user_id ? { user_email: row.user_email } : {}),
                      ...(!row.user_id ? { email: row.email } : {}),
                      ...(row.email_notified ? { email_notified: row.email_notified } : {}),
                  }
                : {}),
            replies: [],
        };

        if (row.parent_id) {
            const siblings = repliesByParent.get(row.parent_id) ?? [];
            siblings.push(node);
            repliesByParent.set(row.parent_id, siblings);
        } else {
            topLevel.push(node);
        }
    }

    // Attach replies to parents; filter out deleted top-level without replies
    const result: CommentNode[] = [];
    for (const parent of topLevel) {
        parent.replies = repliesByParent.get(parent.id) ?? [];
        parent.replies.sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at));
        // Skip deleted comments with no replies
        if (parent.status === "deleted" && parent.replies.length === 0) {
            continue;
        }
        result.push(parent);
    }

    result.sort((a, b) => {
        // Sticky behavior: pinned comments always stay at top.
        if (a.is_pinned !== b.is_pinned) {
            return a.is_pinned ? -1 : 1;
        }
        const delta = toTimestamp(a.created_at) - toTimestamp(b.created_at);
        if (delta !== 0) {
            return sortOrder === "latest" ? -delta : delta;
        }
        return a.id.localeCompare(b.id);
    });

    const total = rows.filter((r) => r.status === "visible").length;
    return { comments: result, total };
}

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const sortOrder = parseSortOrder(url.searchParams.get("sort"));

    if (!slug) {
        return jsonResponse({ error: "Missing slug parameter" }, 400);
    }

    const env = locals.runtime?.env;
    const db = env?.COMMENTS_DB;

    // Mock fallback for local dev without D1
    if (!db) {
        return jsonResponse({ comments: [], total: 0 });
    }

    // Check if requester is admin (optional, for user_email visibility)
    let isAdminRequest = false;
    if (env?.SESSIONS) {
        const sessionUser = await getSessionUser(db, env.SESSIONS, request);
        isAdminRequest = sessionUser?.role === "admin";
    }

    try {
        const { results } = await db
            .prepare(
                `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar,
                        u.role AS user_role, u.email AS user_email
				 FROM comments c
				 LEFT JOIN users u ON c.user_id = u.id
				 WHERE c.slug = ? AND c.status IN ('visible', 'deleted')
				 ORDER BY c.created_at ASC`,
            )
            .bind(slug)
            .all<CommentRow>();

        return jsonResponse(await buildCommentTree(results ?? [], sortOrder, isAdminRequest), 200, {
            "Cache-Control": "public, max-age=0, stale-while-revalidate=30",
        });
    } catch (error) {
        console.error("Error fetching comments:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};

export const POST: APIRoute = async ({ request, locals }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    try {
        const body = (await request.json()) as {
            slug?: string;
            parent_id?: string | null;
            author?: string;
            email?: string;
            website?: string;
            content?: string;
            post_title?: string;
        };

        if (!body.slug) {
            return jsonResponse({ error: "Missing slug" }, 400);
        }
        const slug = body.slug.trim();
        if (!slug) {
            return jsonResponse({ error: "Missing slug" }, 400);
        }
        if (!body.content || body.content.trim().length === 0) {
            return jsonResponse({ error: "content is required" }, 400);
        }
        if (body.content.length > COMMENT_LIMITS.content) {
            return jsonResponse(
                { error: `content exceeds ${COMMENT_LIMITS.content} characters` },
                400,
            );
        }

        const env = locals.runtime?.env;
        const db = env?.COMMENTS_DB;

        // Check if user is logged in
        let sessionUser: {
            id: string;
            name: string;
            avatar_url: string | null;
            role: string;
        } | null = null;
        if (db && env?.SESSIONS) {
            sessionUser = await getSessionUser(db, env.SESSIONS, request);
        }

        let author: string;
        let email: string | null;
        let website: string | null;
        let userId: string | null;
        let avatarUrl: string | null;
        let isAdmin: boolean;

        if (sessionUser) {
            // Logged-in user: use account info, ignore body fields
            author = sessionUser.name;
            email = null;
            website = null;
            userId = sessionUser.id;
            avatarUrl = sessionUser.avatar_url;
            isAdmin = sessionUser.role === "admin";
        } else {
            // Anonymous: validate and use body fields
            const validationError = validateCommentInput(body);
            if (validationError) {
                return jsonResponse({ error: validationError }, 400);
            }
            author = (body.author ?? "").trim();
            email = body.email?.trim() || null;
            website = body.website?.trim() || null;
            userId = null;
            avatarUrl = null;
            isAdmin = false;
        }

        const content = body.content.trim();
        const parentId =
            typeof body.parent_id === "string" && body.parent_id.trim().length > 0
                ? body.parent_id.trim()
                : null;

        // Mock fallback for local dev
        if (!db) {
            const mockComment: CommentNode = {
                id: crypto.randomUUID(),
                author,
                gravatar_hash: await hashEmail(email),
                website,
                content,
                status: "visible",
                created_at: new Date().toISOString(),
                updated_at: null,
                is_pinned: false,
                user_id: userId,
                avatar_url: avatarUrl,
                is_admin: isAdmin,
                replies: [],
            };
            return jsonResponse({ comment: mockComment }, 201);
        }

        // Validate parent comment in the same slug before creating a reply.
        let parentRow: {
            author: string;
            content: string;
            email: string | null;
            user_id: string | null;
            user_name: string | null;
            user_email: string | null;
        } | null = null;
        if (parentId) {
            parentRow = await db
                .prepare(
                    `SELECT c.author, c.content, c.email, c.user_id,
                            u.name AS user_name, u.email AS user_email
                     FROM comments c LEFT JOIN users u ON c.user_id = u.id
                     WHERE c.id = ? AND c.slug = ? AND c.status = 'visible'`,
                )
                .bind(parentId, slug)
                .first<{
                    author: string;
                    content: string;
                    email: string | null;
                    user_id: string | null;
                    user_name: string | null;
                    user_email: string | null;
                }>();

            if (!parentRow) {
                return jsonResponse({ error: "Parent comment not found" }, 400);
            }
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        // Only hash IP for anonymous users; authenticated users are identified by user_id
        const ipHash = userId ? null : await hashIP(getClientIP(request));

        await db
            .prepare(
                `INSERT INTO comments (id, slug, parent_id, author, email, website, content, ip_hash, user_id, status, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)`,
            )
            .bind(id, slug, parentId, author, email, website, content, ipHash, userId, now)
            .run();

        // Fire-and-forget: notify Telegram group
        if (env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_NOTIFY_CHAT_ID) {
            const parentAuthor = parentRow ? parentRow.user_name || parentRow.author : undefined;
            const parentContent = parentRow?.content;

            const notifyPromise = notifyNewComment(
                env.TELEGRAM_BOT_TOKEN,
                env.TELEGRAM_NOTIFY_CHAT_ID,
                {
                    slug,
                    commentId: id,
                    author,
                    content,
                    parentId: parentId ?? undefined,
                    parentAuthor,
                    parentContent,
                    postTitle: body.post_title?.trim() || undefined,
                },
            );
            const ctx = locals.runtime?.ctx;
            if (ctx?.waitUntil) {
                ctx.waitUntil(notifyPromise);
            } else {
                console.warn("ctx.waitUntil unavailable; awaiting Telegram notify inline");
                await notifyPromise;
            }
        }

        // Email notification for replies (fallback to users.email for OAuth users)
        const recipientEmail = parentRow?.email || parentRow?.user_email;
        if (parentId && env?.FASTMAIL_API_TOKEN && parentRow && recipientEmail) {
            const parentName = parentRow.user_name || parentRow.author;
            const jmapConfig = {
                token: env.FASTMAIL_API_TOKEN,
                from: env.NOTIFY_FROM_EMAIL || "noreply@niracler.com",
            };

            // Send email then update delivery status in DB
            const emailAndTrack = notifyCommentReply(jmapConfig, {
                recipientEmail,
                recipientName: parentName,
                replyAuthor: author,
                replyContent: content,
                parentContent: parentRow.content,
                postTitle: body.post_title?.trim() || slug,
                postSlug: slug,
            })
                .then(() =>
                    db
                        .prepare("UPDATE comments SET email_notified = 'sent' WHERE id = ?")
                        .bind(id)
                        .run(),
                )
                .catch(async (err) => {
                    console.error("Email notification failed:", err);
                    await db
                        .prepare("UPDATE comments SET email_notified = 'failed' WHERE id = ?")
                        .bind(id)
                        .run();
                });

            const ctx = locals.runtime?.ctx;
            if (ctx?.waitUntil) {
                ctx.waitUntil(emailAndTrack);
            } else {
                await emailAndTrack;
            }
        }

        const comment: CommentNode = {
            id,
            author,
            gravatar_hash: await hashEmail(email),
            website,
            content,
            status: "visible",
            created_at: now,
            updated_at: null,
            is_pinned: false,
            user_id: userId,
            avatar_url: avatarUrl,
            is_admin: isAdmin,
            replies: [],
        };

        return jsonResponse({ comment }, 201);
    } catch (error) {
        console.error("Error creating comment:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
