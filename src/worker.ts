import astro from "@astrojs/cloudflare/entrypoints/server";
import { archive } from "./lib/channel/client";

export { ChannelArchive } from "./lib/channel/archive";

export default {
    fetch: astro.fetch,
    async scheduled(_event: unknown, env: Env) {
        await archive(env).refreshHome();
    },
};
