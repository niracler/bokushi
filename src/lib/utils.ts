/**
 * Shared utility functions for API routes.
 */

/**
 * Hash an email address using SHA-256 for Gravatar lookups (privacy-preserving).
 * Returns empty string if input is falsy.
 */
export async function hashEmail(email: string | null | undefined): Promise<string> {
    if (!email) return "";
    const encoder = new TextEncoder();
    const data = encoder.encode(email.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash an IP address using SHA-256 for privacy.
 */
export async function hashIP(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract the client IP address from the request headers.
 * Prefers CF-Connecting-IP (Cloudflare), then X-Forwarded-For, then falls back to 127.0.0.1.
 */
export function getClientIP(request: Request): string {
    const cfIP = request.headers.get("CF-Connecting-IP");
    if (cfIP) return cfIP;

    const forwardedFor = request.headers.get("X-Forwarded-For");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();

    return "127.0.0.1";
}

/** Input length limits for comment fields. */
export const COMMENT_LIMITS = {
    author: 50,
    content: 5000,
    website: 200,
    email: 200,
} as const;

/**
 * Validate comment input fields. Returns an error message string if invalid, or null if valid.
 */
export function validateCommentInput(body: {
    author?: string;
    content?: string;
    email?: string;
    website?: string;
}): string | null {
    if (!body.author || body.author.trim().length === 0) {
        return "author is required";
    }
    if (!body.content || body.content.trim().length === 0) {
        return "content is required";
    }
    if (body.author.length > COMMENT_LIMITS.author) {
        return `author exceeds ${COMMENT_LIMITS.author} characters`;
    }
    if (body.content.length > COMMENT_LIMITS.content) {
        return `content exceeds ${COMMENT_LIMITS.content} characters`;
    }
    if (body.email && body.email.length > COMMENT_LIMITS.email) {
        return `email exceeds ${COMMENT_LIMITS.email} characters`;
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return "email format is invalid";
    }
    if (body.website && body.website.length > COMMENT_LIMITS.website) {
        return `website exceeds ${COMMENT_LIMITS.website} characters`;
    }
    if (body.website && !/^https?:\/\//i.test(body.website)) {
        return "website must start with http:// or https://";
    }
    return null;
}

/**
 * Verify the request Origin matches the request URL origin.
 * Returns true when Origin is absent (non-browser clients like curl).
 * Returns false when Origin is present but does not match, indicating a cross-origin request.
 */
export function verifySameOrigin(request: Request): boolean {
    const origin = request.headers.get("Origin");
    if (!origin) return true; // Allow non-browser clients (curl, etc.)
    const url = new URL(request.url);
    return origin === url.origin;
}

/** JSON response helper. */
export function jsonResponse(
    data: unknown,
    status = 200,
    headers: Record<string, string> = {},
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}
