/**
 * GitHub OAuth entry point
 *
 * GET /api/auth/github?redirect=/blog/some-post
 * → Generates state, stores in KV, redirects to GitHub authorize URL
 */

import { GitHub, generateState } from "arctic";
import type { APIRoute } from "astro";

export const prerender = false;

const STATE_TTL = 60 * 10; // 10 minutes

export const GET: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime?.env;
    if (!env?.GITHUB_CLIENT_ID || !env?.GITHUB_CLIENT_SECRET || !env?.SESSIONS) {
        return new Response("OAuth not configured", { status: 503 });
    }

    const url = new URL(request.url);
    const redirectUrl = url.searchParams.get("redirect") || "/";

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
