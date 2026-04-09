/**
 * Link Telegram account to current user
 *
 * POST /api/auth/link/telegram
 * Body: Telegram Login Widget callback data
 * → Requires active session. Verifies Telegram data, links to current user.
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getSessionUser, type TelegramAuthData, verifyTelegramAuth } from "../../../../lib/auth";
import { jsonResponse, verifySameOrigin } from "../../../../lib/utils";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.SESSIONS || !env.COMMENTS_DB) {
        return jsonResponse({ error: "Not configured" }, 503);
    }

    // Must be logged in
    const user = await getSessionUser(env.COMMENTS_DB, env.SESSIONS, request);
    if (!user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let data: TelegramAuthData;
    try {
        data = (await request.json()) as TelegramAuthData;
    } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (!data.id || !data.auth_date || !data.hash) {
        return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const valid = await verifyTelegramAuth(env.TELEGRAM_BOT_TOKEN, data);
    if (!valid) {
        return jsonResponse({ error: "Invalid signature or expired auth" }, 401);
    }

    const db = env.COMMENTS_DB;
    const telegramId = data.id.toString();

    // Check if this Telegram account is already linked
    const existing = await db
        .prepare(
            "SELECT user_id FROM oauth_accounts WHERE provider = 'telegram' AND provider_id = ?",
        )
        .bind(telegramId)
        .first<{ user_id: string }>();

    if (existing) {
        if (existing.user_id === user.id) {
            // Already linked to this user — idempotent success
            return jsonResponse({ success: true });
        }
        // Linked to a different user — conflict
        return jsonResponse(
            { error: "This Telegram account is already linked to another user" },
            409,
        );
    }

    // Link Telegram to current user
    const displayName =
        [data.first_name, data.last_name].filter(Boolean).join(" ") ||
        data.username ||
        "Telegram User";
    await db
        .prepare(
            "INSERT INTO oauth_accounts (provider, provider_id, user_id, provider_name, provider_avatar, created_at) VALUES ('telegram', ?, ?, ?, ?, ?)",
        )
        .bind(
            telegramId,
            user.id,
            data.username || displayName,
            data.photo_url || null,
            new Date().toISOString(),
        )
        .run();

    return jsonResponse({ success: true });
};
