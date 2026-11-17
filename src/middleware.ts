import { defineMiddleware } from "astro:middleware";
import { cachedChannelPage } from "./utils/channel-page-cache";

export const onRequest = defineMiddleware(({ request }, next) =>
    cachedChannelPage(request, next, () => caches.open("channel-pages-v1")),
);
