/**
 * Current user info
 *
 * GET /api/auth/me
 * → Returns { user: {...} } if logged in, { user: null } if not.
 *   Also returns linked providers for account linking UI.
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";
import { jsonResponse } from "../../../lib/utils";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    if (!env.SESSIONS || !env.COMMENTS_DB) {
        return jsonResponse({ user: null });
    }

    const user = await getSessionUser(env.COMMENTS_DB, env.SESSIONS, request);
    if (!user) {
        return jsonResponse({ user: null });
    }

    // Get linked providers for this user
    const providers = await env.COMMENTS_DB.prepare(
        "SELECT provider FROM oauth_accounts WHERE user_id = ?",
    )
        .bind(user.id)
        .all<{ provider: string }>();

    const linkedProviders = providers.results?.map((r: { provider: string }) => r.provider) ?? [];

    return jsonResponse({ user: { ...user, linkedProviders } });
};
