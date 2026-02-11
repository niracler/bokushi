/**
 * Comment count API
 *
 * GET /api/comments/count?slug=xxx         - Count for a single post
 * GET /api/comments/count?slug=a&slug=b    - Batch count for multiple posts
 */

import type { APIRoute } from "astro";
import { jsonResponse } from "../../../lib/utils";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);
    const slugs = url.searchParams.getAll("slug");

    if (slugs.length === 0) {
        return jsonResponse({ error: "Missing slug parameter" }, 400);
    }

    const db = locals.runtime?.env?.COMMENTS_DB;

    // Mock fallback for local dev
    if (!db) {
        const counts: Record<string, number> = {};
        for (const slug of slugs) {
            counts[slug] = 0;
        }
        return jsonResponse({ counts });
    }

    try {
        const placeholders = slugs.map(() => "?").join(", ");
        const { results } = await db
            .prepare(
                `SELECT slug, COUNT(*) as count FROM comments
				 WHERE slug IN (${placeholders}) AND status = 'visible'
				 GROUP BY slug`,
            )
            .bind(...slugs)
            .all<{ slug: string; count: number }>();

        const counts: Record<string, number> = {};
        // Initialize all requested slugs to 0
        for (const slug of slugs) {
            counts[slug] = 0;
        }
        // Fill in actual counts
        for (const row of results ?? []) {
            counts[row.slug] = row.count;
        }

        return jsonResponse({ counts });
    } catch (error) {
        console.error("Error counting comments:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
