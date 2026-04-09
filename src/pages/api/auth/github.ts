/**
 * GitHub OAuth entry point
 *
 * GET /api/auth/github?redirect=/blog/some-post
 * → Generates state, stores in KV, redirects to GitHub authorize URL
 */

import { env } from "cloudflare:workers";
import { GitHub, generateState } from "arctic";
import type { APIRoute } from "astro";
import { jsonResponse } from "../../../lib/utils";

export const prerender = false;

const STATE_TTL = 60 * 10; // 10 minutes

export const GET: APIRoute = async ({ request }) => {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSIONS) {
        return jsonResponse({ error: "OAuth not configured" }, 503);
    }

    const url = new URL(request.url);
    const rawRedirect = url.searchParams.get("redirect") || "/";
    const redirectUrl =
        rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("://")
            ? rawRedirect
            : "/";

    const github = new GitHub(
        env.GITHUB_CLIENT_ID,
        env.GITHUB_CLIENT_SECRET,
        `${url.origin}/api/auth/github/callback`,
    );

    const state = generateState();

    // Store state → redirect URL mapping in KV (with TTL)
    await env.SESSIONS.put(`oauth_state:${state}`, redirectUrl, { expirationTtl: STATE_TTL });

    const authUrl = github.createAuthorizationURL(state, ["read:user"]);

    return Response.redirect(authUrl.toString(), 302);
};
