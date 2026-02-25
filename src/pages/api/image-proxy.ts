/**
 * Image Proxy API
 *
 * This endpoint proxies external images through Cloudflare to ensure accessibility
 * in regions where direct access to the image source may be blocked.
 *
 * Usage: /api/image-proxy?url=<encoded_image_url>
 */

import type { APIRoute } from "astro";
import { SITE_URL } from "../../consts";

export const prerender = false;

// Allowlist of trusted image source hostnames
const ALLOWED_HOSTS = new Set([
    "cdn4.telegra.ph",
    "cdn5.telegra.ph",
    "cdn4.telegram-cdn.org",
    "cdn5.cdn-telegram.org",
    "t.me",
    "telegram.org",
]);

function isAllowedUrl(raw: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        return false;
    }
    if (parsed.protocol !== "https:") return false;
    return [...ALLOWED_HOSTS].some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
}

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
        return new Response("Missing url parameter", { status: 400 });
    }

    if (!isAllowedUrl(imageUrl)) {
        return new Response("URL not allowed", { status: 403 });
    }

    try {
        const response = await fetch(imageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; Cloudflare)",
            },
        });

        if (!response.ok) {
            return new Response("Failed to fetch image", { status: response.status });
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) {
            return new Response("Remote resource is not an image", { status: 400 });
        }

        const imageData = await response.arrayBuffer();

        return new Response(imageData, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": SITE_URL,
            },
        });
    } catch (error) {
        console.error("Error proxying image:", error);
        return new Response("Internal server error", { status: 500 });
    }
};
