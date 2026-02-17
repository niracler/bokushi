/// <reference path="../.astro/types.d.ts" />

// Cloudflare bindings type declarations
interface Env {
    LIKES: KVNamespace;
    SESSIONS: KVNamespace;
    COMMENTS_DB: D1Database;
    TURNSTILE_SECRET_KEY: string;
    ADMIN_TOKEN: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_NOTIFY_CHAT_ID?: string;
    ADMIN_GITHUB_ID: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
    interface Locals extends Runtime {}
}
