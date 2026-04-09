/**
 * GitHub OAuth callback
 *
 * GET /api/auth/github/callback?code=xxx&state=yyy
 * → Validates state, exchanges code for token, upserts user, creates session, redirects back
 */

import { env } from "cloudflare:workers";
import { GitHub } from "arctic";
import type { APIRoute } from "astro";
import { createSession } from "../../../../lib/auth";
import { jsonResponse } from "../../../../lib/utils";

export const prerender = false;

interface GitHubUser {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
}

export const GET: APIRoute = async ({ request }) => {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSIONS || !env.COMMENTS_DB) {
        return jsonResponse({ error: "OAuth not configured" }, 503);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
        return jsonResponse({ error: "Missing code or state" }, 400);
    }

    // Verify and consume state
    const rawRedirect = await env.SESSIONS.get(`oauth_state:${state}`);
    if (rawRedirect === null) {
        return jsonResponse({ error: "Invalid or expired state" }, 400);
    }
    await env.SESSIONS.delete(`oauth_state:${state}`);

    // Defense-in-depth: re-validate redirect URL from KV
    const redirectUrl =
        rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("://")
            ? rawRedirect
            : "/";

    // Exchange code for access token
    const github = new GitHub(
        env.GITHUB_CLIENT_ID,
        env.GITHUB_CLIENT_SECRET,
        `${url.origin}/api/auth/github/callback`,
    );

    let accessToken: string;
    try {
        const tokens = await github.validateAuthorizationCode(code);
        accessToken = tokens.accessToken();
    } catch (error) {
        console.error("GitHub token exchange failed:", error);
        return Response.redirect(
            `${url.origin}${redirectUrl}?auth_error=token_exchange_failed`,
            302,
        );
    }

    // Fetch GitHub user info
    let ghUser: GitHubUser;
    try {
        const res = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "bokushi-oauth" },
        });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        ghUser = (await res.json()) as GitHubUser;
    } catch (error) {
        console.error("GitHub user fetch failed:", error);
        return Response.redirect(`${url.origin}${redirectUrl}?auth_error=github_api_failed`, 302);
    }

    const db = env.COMMENTS_DB;
    const kv = env.SESSIONS;
    const githubId = ghUser.id.toString();
    const displayName = ghUser.name || ghUser.login;
    const isAdmin = githubId === env.ADMIN_GITHUB_ID;
    const now = new Date().toISOString();

    // Upsert user + oauth_account using INSERT OR IGNORE to handle race conditions.
    // If two requests arrive simultaneously for the same GitHub user, only one INSERT
    // will succeed and both will then proceed to the UPDATE path.
    const existing = await db
        .prepare("SELECT user_id FROM oauth_accounts WHERE provider = 'github' AND provider_id = ?")
        .bind(githubId)
        .first<{ user_id: string }>();

    let userId: string;

    if (existing) {
        userId = existing.user_id;
    } else {
        userId = crypto.randomUUID();
        const userResult = await db
            .prepare(
                "INSERT OR IGNORE INTO users (id, name, avatar_url, role, created_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(userId, displayName, ghUser.avatar_url, isAdmin ? "admin" : "user", now)
            .run();
        if (!userResult.success) {
            console.error("Failed to insert user:", userResult);
            return Response.redirect(`${url.origin}${redirectUrl}`, 302);
        }

        const oauthResult = await db
            .prepare(
                "INSERT OR IGNORE INTO oauth_accounts (provider, provider_id, user_id, provider_name, provider_avatar, created_at) VALUES ('github', ?, ?, ?, ?, ?)",
            )
            .bind(githubId, userId, ghUser.login, ghUser.avatar_url, now)
            .run();
        if (!oauthResult.success) {
            console.error("Failed to insert oauth_account:", oauthResult);
            return Response.redirect(`${url.origin}${redirectUrl}`, 302);
        }

        // If INSERT OR IGNORE was a no-op (race: another request already inserted),
        // fetch the existing user_id so we update the correct record
        const raceCheck = await db
            .prepare(
                "SELECT user_id FROM oauth_accounts WHERE provider = 'github' AND provider_id = ?",
            )
            .bind(githubId)
            .first<{ user_id: string }>();
        if (raceCheck && raceCheck.user_id !== userId) {
            userId = raceCheck.user_id;
        }
    }

    // Always update profile info (idempotent)
    await db
        .prepare("UPDATE users SET name = ?, avatar_url = ?, role = ?, updated_at = ? WHERE id = ?")
        .bind(displayName, ghUser.avatar_url, isAdmin ? "admin" : "user", now, userId)
        .run();
    await db
        .prepare(
            "UPDATE oauth_accounts SET provider_name = ?, provider_avatar = ? WHERE provider = 'github' AND provider_id = ?",
        )
        .bind(ghUser.login, ghUser.avatar_url, githubId)
        .run();

    // Create session
    const setCookie = await createSession(kv, userId);

    return new Response(null, {
        status: 302,
        headers: {
            Location: redirectUrl,
            "Set-Cookie": setCookie,
        },
    });
};
