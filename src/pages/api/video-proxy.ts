/**
 * Video Proxy API
 *
 * Resolves fresh signed Telegram CDN video URLs by channel/post ID so that
 * cached /channel HTML pages do not break when Telegram's 3-hour video token
 * expires, and proxies byte-range streams through Cloudflare.
 *
 * Usage: /api/video-proxy?channel=<channel_username>&post=<post_id>
 */

import type { APIRoute } from "astro";
import { SITE_URL } from "../../consts";

export const prerender = false;

const CHANNEL_RE = /^[a-zA-Z0-9_]{4,64}$/;
const POST_ID_RE = /^[1-9]\d*$/;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const ALLOWED_VIDEO_HOSTS = new Set([
    "telesco.pe",
    "telegram-cdn.org",
    "cdn-telegram.org",
    "telegram.org",
]);

const resolvedVideoCache = new Map<string, { videoUrl: string; expiresAt: number }>();

function isAllowedVideoUrl(raw: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        return false;
    }
    if (parsed.protocol !== "https:") return false;
    for (const host of ALLOWED_VIDEO_HOSTS) {
        if (parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)) {
            return true;
        }
    }
    return false;
}

async function resolveFreshVideoUrl(
    channel: string,
    post: string,
    forceRefresh = false,
): Promise<string | null> {
    const cacheKey = `${channel}/${post}`;
    const now = Date.now();
    if (!forceRefresh) {
        const cached = resolvedVideoCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.videoUrl;
        }
    }

    const embedUrl = `https://t.me/${channel}/${post}?embed=1&mode=tme`;
    const response = await fetch(embedUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Cloudflare)",
        },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/<video[^>]+src=["']([^"']+)["']/i);
    const videoUrl = match?.[1];
    if (!videoUrl || !isAllowedVideoUrl(videoUrl)) return null;

    resolvedVideoCache.set(cacheKey, {
        videoUrl,
        expiresAt: now + TOKEN_TTL_MS,
    });
    return videoUrl;
}

async function fetchUpstreamVideo(
    videoUrl: string,
    method: string,
    rangeHeader: string | null,
): Promise<Response> {
    const headers = new Headers({
        "User-Agent": "Mozilla/5.0 (compatible; Cloudflare)",
    });
    if (rangeHeader) {
        headers.set("Range", rangeHeader);
    }
    return fetch(videoUrl, { method, headers });
}

const handleVideoProxy: APIRoute = async ({ request }) => {
    const method = request.method === "HEAD" ? "HEAD" : "GET";
    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") ?? "";
    const post = url.searchParams.get("post") ?? "";

    if (!CHANNEL_RE.test(channel) || !POST_ID_RE.test(post)) {
        return new Response("Invalid channel or post parameter", { status: 400 });
    }

    try {
        let videoUrl = await resolveFreshVideoUrl(channel, post, false);
        if (!videoUrl) {
            return new Response("Video not found", { status: 404 });
        }

        const rangeHeader = request.headers.get("range");
        let upstream = await fetchUpstreamVideo(videoUrl, method, rangeHeader);

        if (upstream.status === 403 || upstream.status === 410) {
            videoUrl = await resolveFreshVideoUrl(channel, post, true);
            if (!videoUrl) {
                return new Response("Video token refresh failed", { status: 502 });
            }
            upstream = await fetchUpstreamVideo(videoUrl, method, rangeHeader);
        }

        if (!upstream.ok && upstream.status !== 206) {
            return new Response("Failed to fetch video", { status: upstream.status });
        }

        const contentType = upstream.headers.get("content-type") ?? "";
        if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") {
            return new Response("Remote resource is not a video", { status: 400 });
        }

        const responseHeaders = new Headers({
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=7200",
            "Access-Control-Allow-Origin": SITE_URL,
        });

        for (const headerName of ["accept-ranges", "content-length", "content-range", "etag"]) {
            const val = upstream.headers.get(headerName);
            if (val) responseHeaders.set(headerName, val);
        }

        return new Response(method === "HEAD" ? null : upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error("Error proxying video:", error);
        return new Response("Internal server error", { status: 500 });
    }
};

export const GET: APIRoute = handleVideoProxy;
export const HEAD: APIRoute = handleVideoProxy;
