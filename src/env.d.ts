/// <reference path="../.astro/types.d.ts" />

// Cloudflare KV binding 类型声明
interface Env {
    LIKES: KVNamespace;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
    interface Locals extends Runtime {}
}
