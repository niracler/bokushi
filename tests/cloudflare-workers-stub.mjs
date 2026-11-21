export const env = globalThis.__TEST_CLOUDFLARE_ENV__;

export class DurableObject {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
    }
}
