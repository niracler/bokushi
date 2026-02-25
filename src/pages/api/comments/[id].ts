/**
 * Comment management API
 *
 * PUT    /api/comments/:id  - Edit comment content (author only, within 15 min)
 * DELETE /api/comments/:id  - Soft delete a comment (admin only, status → deleted)
 * PATCH  /api/comments/:id  - Admin update (hidden/visible status or pin/unpin)
 */

import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";
import { COMMENT_LIMITS, jsonResponse, verifySameOrigin } from "../../../lib/utils";

export const prerender = false;

/**
 * Verify admin access via session-based role check OR legacy Bearer token.
 * During transition period, both methods are accepted.
 */
async function verifyAdmin(request: Request, env: Env | undefined): Promise<boolean> {
    if (!env) return false;

    // Method 1: Session-based admin check
    if (env.COMMENTS_DB && env.SESSIONS) {
        const user = await getSessionUser(env.COMMENTS_DB, env.SESSIONS, request);
        if (user?.role === "admin") return true;
    }

    // Method 2: Legacy Bearer token (transition period)
    if (env.ADMIN_TOKEN) {
        const auth = request.headers.get("Authorization");
        if (auth === `Bearer ${env.ADMIN_TOKEN}`) return true;
    }

    return false;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const PUT: APIRoute = async ({ params, request, locals }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    const { id } = params;
    if (!id) {
        return jsonResponse({ error: "Missing comment id" }, 400);
    }

    const env = locals.runtime?.env;
    const db = env?.COMMENTS_DB;
    if (!db) {
        return jsonResponse({ error: "Database not available" }, 503);
    }

    // Must be logged in
    if (!env?.SESSIONS) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const sessionUser = await getSessionUser(db, env.SESSIONS, request);
    if (!sessionUser) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Fetch the comment
    const row = await db
        .prepare("SELECT id, user_id, content, created_at, status FROM comments WHERE id = ?")
        .bind(id)
        .first<{
            id: string;
            user_id: string | null;
            content: string;
            created_at: string;
            status: string;
        }>();

    if (!row) {
        return jsonResponse({ error: "Comment not found" }, 404);
    }

    if (row.status === "deleted") {
        return jsonResponse({ error: "Cannot edit a deleted comment" }, 400);
    }

    // Only the comment's author can edit (admins use DELETE/PATCH)
    if (row.user_id !== sessionUser.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
    }

    // Enforce 15-minute edit window
    const createdAt = new Date(row.created_at).getTime();
    if (Date.now() - createdAt > EDIT_WINDOW_MS) {
        return jsonResponse({ error: "Edit window has expired (15 minutes)" }, 403);
    }

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content || content.length === 0) {
        return jsonResponse({ error: "Content cannot be empty" }, 400);
    }
    if (content.length > COMMENT_LIMITS.content) {
        return jsonResponse({ error: `Content exceeds ${COMMENT_LIMITS.content} characters` }, 400);
    }

    const now = new Date().toISOString();
    await db
        .prepare("UPDATE comments SET content = ?, updated_at = ? WHERE id = ?")
        .bind(content, now, id)
        .run();

    return jsonResponse({ success: true, content, updated_at: now });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    const { id } = params;
    if (!id) {
        return jsonResponse({ error: "Missing comment id" }, 400);
    }

    const env = locals.runtime?.env;
    if (!(await verifyAdmin(request, env))) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = env?.COMMENTS_DB;
    if (!db) {
        return jsonResponse({ error: "Database not available" }, 503);
    }

    try {
        const result = await db
            .prepare("UPDATE comments SET status = 'deleted', updated_at = ? WHERE id = ?")
            .bind(new Date().toISOString(), id)
            .run();

        if (result.meta.changes === 0) {
            return jsonResponse({ error: "Comment not found" }, 404);
        }

        return jsonResponse({ success: true });
    } catch (error) {
        console.error("Error deleting comment:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    const { id } = params;
    if (!id) {
        return jsonResponse({ error: "Missing comment id" }, 400);
    }

    const env = locals.runtime?.env;
    if (!(await verifyAdmin(request, env))) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = env?.COMMENTS_DB;
    if (!db) {
        return jsonResponse({ error: "Database not available" }, 503);
    }

    try {
        const body = (await request.json()) as {
            status?: string;
            action?: string;
            pinned?: boolean;
            is_pinned?: boolean;
        };

        const wantsPinUpdate =
            body.action === "pin" ||
            typeof body.pinned === "boolean" ||
            typeof body.is_pinned === "boolean";

        if (wantsPinUpdate) {
            const pinned =
                typeof body.pinned === "boolean"
                    ? body.pinned
                    : typeof body.is_pinned === "boolean"
                      ? body.is_pinned
                      : null;

            if (pinned === null) {
                return jsonResponse({ error: "Invalid pinned value. Must be boolean" }, 400);
            }

            const row = await db
                .prepare("SELECT id, parent_id FROM comments WHERE id = ?")
                .bind(id)
                .first<{ id: string; parent_id: string | null }>();

            if (!row) {
                return jsonResponse({ error: "Comment not found" }, 404);
            }

            if (row.parent_id) {
                return jsonResponse({ error: "Only top-level comments can be pinned" }, 400);
            }

            await db
                .prepare("UPDATE comments SET is_pinned = ?, updated_at = ? WHERE id = ?")
                .bind(pinned ? 1 : 0, new Date().toISOString(), id)
                .run();

            return jsonResponse({ success: true, is_pinned: pinned });
        }

        const newStatus = body.status;

        if (newStatus !== "hidden" && newStatus !== "visible") {
            return jsonResponse({ error: "Invalid status. Must be 'hidden' or 'visible'" }, 400);
        }

        const result = await db
            .prepare("UPDATE comments SET status = ?, updated_at = ? WHERE id = ?")
            .bind(newStatus, new Date().toISOString(), id)
            .run();

        if (result.meta.changes === 0) {
            return jsonResponse({ error: "Comment not found" }, 404);
        }

        return jsonResponse({ success: true, status: newStatus });
    } catch (error) {
        console.error("Error updating comment:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
