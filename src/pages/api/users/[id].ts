/**
 * User management API (admin only)
 *
 * PATCH /api/users/:id - Update user email for notifications
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";
import { jsonResponse, verifySameOrigin } from "../../../lib/utils";

export const prerender = false;

async function verifyAdmin(request: Request, env: Env | undefined): Promise<boolean> {
    if (!env) return false;

    if (env.COMMENTS_DB && env.SESSIONS) {
        const user = await getSessionUser(env.COMMENTS_DB, env.SESSIONS, request);
        if (user?.role === "admin") return true;
    }

    if (env.ADMIN_TOKEN) {
        const auth = request.headers.get("Authorization");
        if (auth === `Bearer ${env.ADMIN_TOKEN}`) return true;
    }

    return false;
}

export const PATCH: APIRoute = async ({ params, request }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    const { id } = params;
    if (!id) {
        return jsonResponse({ error: "Missing user id" }, 400);
    }

    if (!(await verifyAdmin(request, env))) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = env.COMMENTS_DB;
    if (!db) {
        return jsonResponse({ error: "Database not available" }, 503);
    }

    try {
        const body = (await request.json()) as { email?: string | null };

        const email = typeof body.email === "string" ? body.email.trim() || null : null;

        // Basic email format validation when provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return jsonResponse({ error: "Invalid email format" }, 400);
        }

        const result = await db
            .prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?")
            .bind(email, new Date().toISOString(), id)
            .run();

        if (result.meta.changes === 0) {
            return jsonResponse({ error: "User not found" }, 404);
        }

        return jsonResponse({ success: true, email });
    } catch (error) {
        console.error("Error updating user:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
