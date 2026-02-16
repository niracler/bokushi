/**
 * Logout
 *
 * POST /api/auth/logout
 * → Destroys session, clears cookie
 */

import type { APIRoute } from "astro";
import { destroySession } from "../../../lib/auth";
import { jsonResponse } from "../../../lib/utils";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime?.env;
    if (!env?.SESSIONS) {
        return jsonResponse({ success: true });
    }

    const setCookie = await destroySession(env.SESSIONS, request);
    return jsonResponse({ success: true }, 200, { "Set-Cookie": setCookie });
};
