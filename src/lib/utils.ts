/**
 * Shared utility functions for API routes.
 */

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

export interface TurnstileResult {
    success: boolean;
    "error-codes"?: string[];
}

/**
 * Verify a Cloudflare Turnstile token via the siteverify API.
 * Returns the full result object for debugging.
 */
export async function verifyTurnstile(
    token: string,
    secretKey: string,
    ip?: string,
): Promise<TurnstileResult> {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData,
    });

    const result = (await response.json()) as TurnstileResult;
    if (!result.success) {
        console.error("Turnstile verification failed:", JSON.stringify(result));
    }
    return result;
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
    if (body.website && body.website.length > COMMENT_LIMITS.website) {
        return `website exceeds ${COMMENT_LIMITS.website} characters`;
    }
    return null;
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
