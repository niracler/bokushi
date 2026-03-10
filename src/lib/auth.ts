/**
 * Authentication utilities for OAuth login and session management.
 */

import { bufferToHex } from "./utils";

// Minimal Cloudflare binding types (avoids @cloudflare/workers-types DOM conflicts)
interface KVNamespace {
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
}

interface D1Database {
    prepare(query: string): {
        bind(...values: unknown[]): {
            first<T = unknown>(): Promise<T | null>;
        };
    };
}

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days in seconds
const SESSION_COOKIE_NAME = "session";

interface SessionData {
    userId: string;
    createdAt: string;
}

export interface SessionUser {
    id: string;
    name: string;
    avatar_url: string | null;
    role: string;
}

// --- Session Management ---

/**
 * Create a new session in KV and return the Set-Cookie header value.
 */
export async function createSession(kv: KVNamespace, userId: string): Promise<string> {
    // Use 32 bytes of random data (base64url-encoded) for stronger session tokens
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    const data: SessionData = {
        userId,
        createdAt: new Date().toISOString(),
    };
    await kv.put(`session:${token}`, JSON.stringify(data), { expirationTtl: SESSION_TTL });
    return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

/**
 * Read the session from KV using the cookie in the request.
 * Returns session data or null if not found/expired.
 */
export async function getSession(kv: KVNamespace, request: Request): Promise<SessionData | null> {
    const token = parseCookie(request, SESSION_COOKIE_NAME);
    if (!token) return null;
    const raw = await kv.get(`session:${token}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
}

/**
 * Destroy the session: delete from KV and return a Set-Cookie header that clears the cookie.
 */
export async function destroySession(kv: KVNamespace, request: Request): Promise<string> {
    const token = parseCookie(request, SESSION_COOKIE_NAME);
    if (token) {
        await kv.delete(`session:${token}`);
    }
    return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Get the full user object for the current session.
 * Combines getSession + users table lookup.
 */
export async function getSessionUser(
    db: D1Database,
    kv: KVNamespace,
    request: Request,
): Promise<SessionUser | null> {
    const session = await getSession(kv, request);
    if (!session) return null;

    const row = await db
        .prepare("SELECT id, name, avatar_url, role FROM users WHERE id = ?")
        .bind(session.userId)
        .first<SessionUser>();

    return row ?? null;
}

// --- Telegram Verification ---

export interface TelegramAuthData {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
        result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
}

/**
 * Verify Telegram Login Widget callback data using HMAC-SHA256.
 * Returns true if signature is valid and auth_date is within 10 minutes.
 */
export async function verifyTelegramAuth(
    botToken: string,
    data: TelegramAuthData,
): Promise<boolean> {
    // Check auth_date is within 10 minutes (allows for clock skew and slow networks)
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 600) return false;

    // Build data_check_string: alphabetically sorted key=value pairs (excluding hash)
    const { hash, ...rest } = data;
    const dataCheckString = Object.entries(rest)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

    // secret = SHA256(bot_token)
    const encoder = new TextEncoder();
    const secretKeyData = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));

    // HMAC-SHA256(secret, data_check_string)
    const key = await crypto.subtle.importKey(
        "raw",
        secretKeyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(dataCheckString));

    // Compare hex using constant-time comparison to prevent timing attacks
    const computedHash = bufferToHex(signature);

    return timingSafeEqual(computedHash, hash);
}

// --- Helpers ---

function parseCookie(request: Request, name: string): string | null {
    const header = request.headers.get("Cookie");
    if (!header) return null;
    const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : null;
}
