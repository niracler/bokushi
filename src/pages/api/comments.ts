/**
 * Comments API
 *
 * GET  /api/comments?slug=xxx  - List comments for a post (tree structure)
 * POST /api/comments           - Create a new comment
 */

import type { APIRoute } from "astro";
import {
    getClientIP,
    hashIP,
    jsonResponse,
    validateCommentInput,
    verifyTurnstile,
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
}

interface CommentNode {
    id: string;
    author: string;
    email: string | null;
    website: string | null;
    content: string;
    status: string;
    created_at: string;
    replies: CommentNode[];
}

function buildCommentTree(rows: CommentRow[]): { comments: CommentNode[]; total: number } {
    const topLevel: CommentNode[] = [];
    const repliesByParent = new Map<string, CommentNode[]>();

    // Group replies by parent_id
    for (const row of rows) {
        const node: CommentNode = {
            id: row.id,
            author: row.status === "deleted" ? "" : row.author,
            email: row.status === "deleted" ? null : row.email,
            website: row.status === "deleted" ? null : row.website,
            content: row.status === "deleted" ? "" : row.content,
            status: row.status,
            created_at: row.created_at,
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
                `SELECT * FROM comments
				 WHERE slug = ? AND status IN ('visible', 'deleted')
				 ORDER BY created_at ASC`,
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
            turnstile_token?: string;
        };

        // Validate required fields and lengths
        const validationError = validateCommentInput(body);
        if (validationError) {
            return jsonResponse({ error: validationError }, 400);
        }

        if (!body.slug) {
            return jsonResponse({ error: "Missing slug" }, 400);
        }

        if (!body.turnstile_token) {
            return jsonResponse({ error: "Missing Turnstile token" }, 400);
        }

        // Safe to access after validateCommentInput passed
        const author = (body.author ?? "").trim();
        const content = (body.content ?? "").trim();
        const email = body.email?.trim() || null;
        const website = body.website?.trim() || null;

        const db = locals.runtime?.env?.COMMENTS_DB;
        const turnstileSecret = locals.runtime?.env?.TURNSTILE_SECRET_KEY;

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
                replies: [],
            };
            return jsonResponse({ comment: mockComment }, 201);
        }

        // Verify Turnstile token
        if (turnstileSecret) {
            const clientIP = getClientIP(request);
            const token = body.turnstile_token ?? "";
            const result = await verifyTurnstile(token, turnstileSecret, clientIP);
            if (!result.success) {
                return jsonResponse(
                    {
                        error: "Turnstile verification failed",
                        errorCodes: result["error-codes"],
                        debug: {
                            tokenLength: token.length,
                            tokenPrefix: token.substring(0, 20),
                            secretLength: turnstileSecret.length,
                            secretPrefix: turnstileSecret.substring(0, 10),
                            clientIP,
                            siteverifyResponse: result,
                        },
                    },
                    403,
                );
            }
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);

        await db
            .prepare(
                `INSERT INTO comments (id, slug, parent_id, author, email, website, content, ip_hash, status, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)`,
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
                now,
            )
            .run();

        const comment: CommentNode = {
            id,
            author,
            email,
            website,
            content,
            status: "visible",
            created_at: now,
            replies: [],
        };

        return jsonResponse({ comment }, 201);
    } catch (error) {
        console.error("Error creating comment:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
