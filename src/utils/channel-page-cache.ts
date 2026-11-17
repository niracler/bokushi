/** Cache only public channel HTML, before Telegram parsing and SSR run. */
export const CHANNEL_CACHE_SECONDS = 3 * 24 * 60 * 60;

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
    return result;
}

export async function cachedChannelPage(
    request: Request,
    next: () => Promise<Response>,
    openCache: () => Promise<PageCache>,
): Promise<Response> {
    if (!isCacheableRequest(request)) return next();

    const key = new Request(request.url);
    let cache: PageCache;
    try {
        cache = await openCache();
        const cached = await cache.match(key);
        if (cached) return clientResponse(cached, "HIT");
    } catch {
        // Cache availability must never prevent an otherwise healthy page load.
        return next();
    }

    const response = await next();
    const control = response.headers.get("Cache-Control") ?? "";
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
    stored.headers.set("Cache-Control", `public, max-age=${CHANNEL_CACHE_SECONDS}`);
    try {
        // Await the write so it finishes even without an execution context.
        await cache.put(key, stored);
    } catch {
        return clientResponse(response, "BYPASS");
    }
    return clientResponse(response, "MISS");
}
