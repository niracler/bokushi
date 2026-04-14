/// <reference path="../.astro/types.d.ts" />
/// <reference types="unplugin-icons/types/astro" />

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
    FASTMAIL_API_TOKEN?: string; // Fastmail app password for email notifications
    NOTIFY_FROM_EMAIL?: string; // sender address (must be a Fastmail identity)
}

// Provide type declarations for the cloudflare:workers virtual module
declare module "cloudflare:workers" {
    const env: Env;
    export { env };
}

declare namespace App {
    interface Locals {
        cfContext: ExecutionContext;
    }
}
