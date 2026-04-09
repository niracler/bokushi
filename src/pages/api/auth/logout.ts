/**
 * Logout
 *
 * POST /api/auth/logout
 * → Destroys session, clears cookie
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { destroySession } from "../../../lib/auth";
import { jsonResponse, verifySameOrigin } from "../../../lib/utils";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    if (!env.SESSIONS) {
        return jsonResponse({ success: true });
    }

    const setCookie = await destroySession(env.SESSIONS, request);
    return jsonResponse({ success: true }, 200, { "Set-Cookie": setCookie });
};
