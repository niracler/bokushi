/**
 * Telegram Login Widget callback
 *
 * POST /api/auth/telegram/callback
 * Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
 * → Verifies HMAC-SHA256 signature, upserts user, creates session
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createSession, type TelegramAuthData, verifyTelegramAuth } from "../../../../lib/auth";
import { jsonResponse, verifySameOrigin } from "../../../../lib/utils";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.SESSIONS || !env.COMMENTS_DB) {
        return jsonResponse({ error: "Telegram auth not configured" }, 503);
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

    // Verify signature and auth_date
    const valid = await verifyTelegramAuth(env.TELEGRAM_BOT_TOKEN, data);
    if (!valid) {
        return jsonResponse({ error: "Invalid signature or expired auth" }, 401);
    }

    const db = env.COMMENTS_DB;
    const kv = env.SESSIONS;
    const telegramId = data.id.toString();
    const displayName =
        [data.first_name, data.last_name].filter(Boolean).join(" ") ||
        data.username ||
        "Telegram User";
    const avatarUrl = data.photo_url || null;
    const now = new Date().toISOString();

    // Upsert user + oauth_account using INSERT OR IGNORE to handle race conditions
    const existing = await db
        .prepare(
            "SELECT user_id FROM oauth_accounts WHERE provider = 'telegram' AND provider_id = ?",
        )
        .bind(telegramId)
        .first<{ user_id: string }>();

    let userId: string;

    if (existing) {
        userId = existing.user_id;
    } else {
        userId = crypto.randomUUID();
        const userResult = await db
            .prepare(
                "INSERT OR IGNORE INTO users (id, name, avatar_url, role, created_at) VALUES (?, ?, ?, 'user', ?)",
            )
            .bind(userId, displayName, avatarUrl, now)
            .run();
        if (!userResult.success) {
            console.error("Failed to insert user:", userResult);
            return jsonResponse({ error: "Internal server error" }, 500);
        }

        const oauthResult = await db
            .prepare(
                "INSERT OR IGNORE INTO oauth_accounts (provider, provider_id, user_id, provider_name, provider_avatar, created_at) VALUES ('telegram', ?, ?, ?, ?, ?)",
            )
            .bind(telegramId, userId, data.username || displayName, avatarUrl, now)
            .run();
        if (!oauthResult.success) {
            console.error("Failed to insert oauth_account:", oauthResult);
            return jsonResponse({ error: "Internal server error" }, 500);
        }

        // Handle race condition: if INSERT was a no-op, use existing user_id
        const raceCheck = await db
            .prepare(
                "SELECT user_id FROM oauth_accounts WHERE provider = 'telegram' AND provider_id = ?",
            )
            .bind(telegramId)
            .first<{ user_id: string }>();
        if (raceCheck && raceCheck.user_id !== userId) {
            userId = raceCheck.user_id;
        }
    }

    // Always update profile info (idempotent)
    await db
        .prepare("UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?")
        .bind(displayName, avatarUrl, now, userId)
        .run();
    await db
        .prepare(
            "UPDATE oauth_accounts SET provider_name = ?, provider_avatar = ? WHERE provider = 'telegram' AND provider_id = ?",
        )
        .bind(data.username || displayName, avatarUrl, telegramId)
        .run();

    const setCookie = await createSession(kv, userId);

    // Get user info for response
    const user = await db
        .prepare("SELECT id, name, avatar_url, role FROM users WHERE id = ?")
        .bind(userId)
        .first();

    return jsonResponse({ success: true, user }, 200, { "Set-Cookie": setCookie });
};
