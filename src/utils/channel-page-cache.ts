/** Cache only public channel HTML, before Telegram parsing and SSR run. */
export const CHANNEL_CACHE_SECONDS = 3 * 24 * 60 * 60;
export const CHANNEL_STALE_SECONDS = 7 * 24 * 60 * 60;
const STORED_AT_HEADER = "X-Channel-Stored-At";

type PageCache = {
    match(request: Request): Promise<Response | undefined>;
    put(request: Request, response: Response): Promise<void>;
};

function isCacheableRequest(request: Request): boolean {
    const url = new URL(request.url);
    return (
        request.method === "GET" &&
        /^\/channel(?:\/(?:before|after)-[1-9]\d*)?$/.test(url.pathname) &&
        !url.search &&
        !request.headers.has("Cookie") &&
        !request.headers.has("Authorization")
    );
}

function clientResponse(response: Response, status: string): Response {
    const result = new Response(response.body, response);
    // The edge owns the TTL; browsers must not extend it after a late cache hit.
    result.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    result.headers.set("X-Channel-Cache", status);
    result.headers.delete(STORED_AT_HEADER);
    if (status === "STALE") result.headers.set("Cache-Control", "no-store");
    return result;
}

export async function cachedChannelPage(
    request: Request,
    next: () => Promise<Response>,
    openCache: () => Promise<PageCache>,
    now: () => number = Date.now,
): Promise<Response> {
    if (!isCacheableRequest(request)) return next();

    const key = new Request(request.url);
    let cache: PageCache;
    let fallback: Response | undefined;
    try {
        cache = await openCache();
        const cached = await cache.match(key);
        const storedAt = cached?.headers.get(STORED_AT_HEADER);
        if (cached && storedAt !== null && storedAt !== undefined) {
            const age = (now() - Number(storedAt)) / 1000;
            if (age >= 0 && age < CHANNEL_CACHE_SECONDS) return clientResponse(cached, "HIT");
            if (age >= 0 && age < CHANNEL_CACHE_SECONDS + CHANNEL_STALE_SECONDS) fallback = cached;
        }
    } catch {
        // Cache availability must never prevent an otherwise healthy page load.
        return next();
    }

    let response: Response;
    try {
        response = await next();
    } catch (error) {
        if (fallback) return clientResponse(fallback, "STALE");
        throw error;
    }
    const control = response.headers.get("Cache-Control") ?? "";
    if (
        fallback &&
        response.status >= 500 &&
        !response.headers.has("Set-Cookie") &&
        !response.headers.has("Vary") &&
        !/private/i.test(control)
    ) {
        // Never replace the last successful HTML or extend its retention on failure.
        return clientResponse(fallback, "STALE");
    }
    if (
        response.status !== 200 ||
        !response.headers.get("Content-Type")?.includes("text/html") ||
        response.headers.has("Set-Cookie") ||
        response.headers.has("Vary") ||
        /(?:private|no-store|no-cache)/i.test(control)
    ) {
        return response;
    }

    const stored = new Response(response.clone().body, response);
    stored.headers.set(
        "Cache-Control",
        `public, max-age=${CHANNEL_CACHE_SECONDS + CHANNEL_STALE_SECONDS}`,
    );
    stored.headers.set(STORED_AT_HEADER, String(now()));
    try {
        // Await the write so it finishes even without an execution context.
        await cache.put(key, stored);
    } catch {
        return clientResponse(response, "BYPASS");
    }
    return clientResponse(response, "MISS");
}
