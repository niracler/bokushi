/**
 * Comment management API (admin only)
 *
 * DELETE /api/comments/:id  - Soft delete a comment (status → deleted)
 * PATCH  /api/comments/:id  - Toggle hidden/visible status
 */

import type { APIRoute } from "astro";
import { jsonResponse } from "../../../lib/utils";

export const prerender = false;

function verifyAdmin(request: Request, adminToken: string | undefined): boolean {
    if (!adminToken) return false;
    const auth = request.headers.get("Authorization");
    return auth === `Bearer ${adminToken}`;
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
    const { id } = params;
    if (!id) {
        return jsonResponse({ error: "Missing comment id" }, 400);
    }

    const adminToken = locals.runtime?.env?.ADMIN_TOKEN;
    if (!verifyAdmin(request, adminToken)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = locals.runtime?.env?.COMMENTS_DB;
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
    const { id } = params;
    if (!id) {
        return jsonResponse({ error: "Missing comment id" }, 400);
    }

    const adminToken = locals.runtime?.env?.ADMIN_TOKEN;
    if (!verifyAdmin(request, adminToken)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = locals.runtime?.env?.COMMENTS_DB;
    if (!db) {
        return jsonResponse({ error: "Database not available" }, 503);
    }

    try {
        const body = (await request.json()) as { status?: string };
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
