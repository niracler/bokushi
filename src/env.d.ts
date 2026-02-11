/// <reference path="../.astro/types.d.ts" />

// Cloudflare bindings type declarations
interface Env {
    LIKES: KVNamespace;
    COMMENTS_DB: D1Database;
    TURNSTILE_SECRET_KEY: string;
    ADMIN_TOKEN: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
    interface Locals extends Runtime {}
}
