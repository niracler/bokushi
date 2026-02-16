/**
 * GitHub OAuth callback
 *
 * GET /api/auth/github/callback?code=xxx&state=yyy
 * → Validates state, exchanges code for token, upserts user, creates session, redirects back
 */

import { GitHub } from "arctic";
import type { APIRoute } from "astro";
import { createSession } from "../../../../lib/auth";

export const prerender = false;

interface GitHubUser {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
}

export const GET: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime?.env;
    if (
        !env?.GITHUB_CLIENT_ID ||
        !env?.GITHUB_CLIENT_SECRET ||
        !env?.SESSIONS ||
        !env?.COMMENTS_DB
    ) {
        return new Response("OAuth not configured", { status: 503 });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
    }

    // Verify and consume state
    const redirectUrl = await env.SESSIONS.get(`oauth_state:${state}`);
    if (redirectUrl === null) {
        return new Response("Invalid or expired state", { status: 400 });
    }
    await env.SESSIONS.delete(`oauth_state:${state}`);

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
        return Response.redirect(`${url.origin}${redirectUrl}`, 302);
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
        return Response.redirect(`${url.origin}${redirectUrl}`, 302);
    }

    const db = env.COMMENTS_DB;
    const kv = env.SESSIONS;
    const githubId = ghUser.id.toString();
    const displayName = ghUser.name || ghUser.login;
    const isAdmin = githubId === env.ADMIN_GITHUB_ID;

    // Check if oauth_account exists
    const existing = await db
        .prepare("SELECT user_id FROM oauth_accounts WHERE provider = 'github' AND provider_id = ?")
        .bind(githubId)
        .first<{ user_id: string }>();

    let userId: string;

    if (existing) {
        // Existing user: update provider info and role
        userId = existing.user_id;
        await db
            .prepare(
                "UPDATE oauth_accounts SET provider_name = ?, provider_avatar = ? WHERE provider = 'github' AND provider_id = ?",
            )
            .bind(ghUser.login, ghUser.avatar_url, githubId)
            .run();
        await db
            .prepare(
                "UPDATE users SET name = ?, avatar_url = ?, role = ?, updated_at = ? WHERE id = ?",
            )
            .bind(
                displayName,
                ghUser.avatar_url,
                isAdmin ? "admin" : "user",
                new Date().toISOString(),
                userId,
            )
            .run();
    } else {
        // New user: create user + oauth_account
        userId = crypto.randomUUID();
        const now = new Date().toISOString();
        await db
            .prepare(
                "INSERT INTO users (id, name, avatar_url, role, created_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(userId, displayName, ghUser.avatar_url, isAdmin ? "admin" : "user", now)
            .run();
        await db
            .prepare(
                "INSERT INTO oauth_accounts (provider, provider_id, user_id, provider_name, provider_avatar, created_at) VALUES ('github', ?, ?, ?, ?, ?)",
            )
            .bind(githubId, userId, ghUser.login, ghUser.avatar_url, now)
            .run();
    }

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
