import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { archive, isChannelCursor } from "./lib/channel/client";
import { cachedChannelPage } from "./utils/channel-page-cache";

export const onRequest = defineMiddleware(({ request, url }, next) => {
    const cursor = url.pathname === "/channel" ? "home" : url.pathname.slice("/channel/".length);
    if (
        import.meta.env.DEV ||
        request.method !== "GET" ||
        !(url.pathname === "/channel" || url.pathname.startsWith("/channel/")) ||
        !isChannelCursor(cursor) ||
        request.headers.has("Authorization")
    )
        return next();

    // This route renders the same public snapshot for everyone. Private response guards
    // still apply. Only this explicit route can share HTML between browser sessions.
    const publicPage = new Request(new URL(url.pathname, url.origin));
    const render = request.headers.has("Cookie") || url.search ? () => next(publicPage) : next;
    return cachedChannelPage(
        publicPage,
        render,
        () => caches.open(`channel-pages-${import.meta.env.CHANNEL_BUILD_ID}`),
        Date.now,
        () => archive(env).revision(),
    );
});
