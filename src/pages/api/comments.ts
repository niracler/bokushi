/**
 * Comments API
 *
 * GET  /api/comments?slug=xxx  - List comments for a post (tree structure)
 * POST /api/comments           - Create a new comment
 */

import type { APIRoute } from "astro";
import { getSessionUser } from "../../lib/auth";
import { notifyNewComment } from "../../lib/telegram-notify";
import { getClientIP, hashIP, jsonResponse, validateCommentInput } from "../../lib/utils";

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
    user_id: string | null;
    user_name: string | null;
    user_avatar: string | null;
    user_role: string | null;
}

interface CommentNode {
    id: string;
    author: string;
    email: string | null;
    website: string | null;
    content: string;
    status: string;
    created_at: string;
    user_id: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    replies: CommentNode[];
}

function buildCommentTree(rows: CommentRow[]): { comments: CommentNode[]; total: number } {
    const topLevel: CommentNode[] = [];
    const repliesByParent = new Map<string, CommentNode[]>();

    // Group replies by parent_id
    for (const row of rows) {
        const isDeleted = row.status === "deleted";
        const node: CommentNode = {
            id: row.id,
            author: isDeleted ? "" : row.user_name || row.author,
            email: isDeleted ? null : row.email,
            website: isDeleted ? null : row.website,
            content: isDeleted ? "" : row.content,
            status: row.status,
            created_at: row.created_at,
            user_id: isDeleted ? null : row.user_id,
            avatar_url: isDeleted ? null : row.user_avatar,
            is_admin: !isDeleted && row.user_role === "admin",
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
        // Skip deleted comments with no replies
        if (parent.status === "deleted" && parent.replies.length === 0) {
            continue;
        }
        result.push(parent);
    }

    const total = rows.filter((r) => r.status === "visible").length;
    return { comments: result, total };
}

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
        return jsonResponse({ error: "Missing slug parameter" }, 400);
    }

    const db = locals.runtime?.env?.COMMENTS_DB;

    // Mock fallback for local dev without D1
    if (!db) {
        return jsonResponse({ comments: [], total: 0 });
    }

    try {
        const { results } = await db
            .prepare(
                `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar, u.role AS user_role
				 FROM comments c
				 LEFT JOIN users u ON c.user_id = u.id
				 WHERE c.slug = ? AND c.status IN ('visible', 'deleted')
				 ORDER BY c.created_at ASC`,
            )
            .bind(slug)
            .all<CommentRow>();

        return jsonResponse(buildCommentTree(results ?? []));
    } catch (error) {
        console.error("Error fetching comments:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const body = (await request.json()) as {
            slug?: string;
            parent_id?: string;
            author?: string;
            email?: string;
            website?: string;
            content?: string;
        };

        if (!body.slug) {
            return jsonResponse({ error: "Missing slug" }, 400);
        }
        if (!body.content || body.content.trim().length === 0) {
            return jsonResponse({ error: "content is required" }, 400);
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

        // Mock fallback for local dev
        if (!db) {
            const mockComment: CommentNode = {
                id: crypto.randomUUID(),
                author,
                email,
                website,
                content,
                status: "visible",
                created_at: new Date().toISOString(),
                user_id: userId,
                avatar_url: avatarUrl,
                is_admin: isAdmin,
                replies: [],
            };
            return jsonResponse({ comment: mockComment }, 201);
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
            .bind(
                id,
                body.slug,
                body.parent_id || null,
                author,
                email,
                website,
                content,
                ipHash,
                userId,
                now,
            )
            .run();

        // Fire-and-forget: notify Telegram group
        if (env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_NOTIFY_CHAT_ID) {
            let parentAuthor: string | undefined;
            if (body.parent_id && db) {
                const parent = await db
                    .prepare(
                        `SELECT c.author, u.name AS user_name FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
                    )
                    .bind(body.parent_id)
                    .first<{ author: string; user_name: string | null }>();
                if (parent) {
                    parentAuthor = parent.user_name || parent.author;
                }
            }

            const notifyPromise = notifyNewComment(
                env.TELEGRAM_BOT_TOKEN,
                env.TELEGRAM_NOTIFY_CHAT_ID,
                {
                    slug: body.slug,
                    author,
                    content,
                    isReply: !!body.parent_id,
                    parentAuthor,
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

        const comment: CommentNode = {
            id,
            author,
            email,
            website,
            content,
            status: "visible",
            created_at: now,
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
