/**
 * Batch update email for anonymous commenters (admin only)
 *
 * PATCH /api/comments/email-batch
 * Body: { author: string, website: string | null, email: string | null }
 *
 * Updates comments.email for all anonymous comments matching author + website.
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

export const PATCH: APIRoute = async ({ request }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    if (!(await verifyAdmin(request, env))) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const db = env.COMMENTS_DB;
    if (!db) {
        return jsonResponse({ error: "Database not available" }, 503);
    }

    try {
        const body = (await request.json()) as {
            author?: string;
            website?: string | null;
            email?: string | null;
        };

        const author = body.author?.trim();
        if (!author) {
            return jsonResponse({ error: "Missing author" }, 400);
        }

        const email = typeof body.email === "string" ? body.email.trim() || null : null;

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return jsonResponse({ error: "Invalid email format" }, 400);
        }

        // Match by author + website (both must match), anonymous only (user_id IS NULL)
        const website =
            typeof body.website === "string" && body.website.trim() ? body.website.trim() : null;

        const now = new Date().toISOString();

        const result = website
            ? await db
                  .prepare(
                      `UPDATE comments SET email = ?, updated_at = ?
                     WHERE author = ? AND website = ? AND user_id IS NULL`,
                  )
                  .bind(email, now, author, website)
                  .run()
            : await db
                  .prepare(
                      `UPDATE comments SET email = ?, updated_at = ?
                     WHERE author = ? AND (website IS NULL OR website = '') AND user_id IS NULL`,
                  )
                  .bind(email, now, author)
                  .run();

        return jsonResponse({ success: true, updated: result.meta.changes });
    } catch (error) {
        console.error("Error batch updating email:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
