import { defineMiddleware } from "astro:middleware";
import { cachedChannelPage } from "./utils/channel-page-cache";

export const onRequest = defineMiddleware(({ request }, next) =>
    import.meta.env.DEV
        ? next()
        : cachedChannelPage(request, next, () =>
              caches.open(`channel-pages-${import.meta.env.CHANNEL_BUILD_ID}`),
          ),
);
