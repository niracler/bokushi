import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { experimental_readRawConfig } from "wrangler";

test("production R2 bindings name pre-provisioned buckets", () => {
    const config = fileURLToPath(new URL("../wrangler.toml", import.meta.url));
    const { rawConfig } = experimental_readRawConfig({ config });
    for (const { binding, bucket_name } of rawConfig.r2_buckets ?? []) {
        assert.ok(
            bucket_name?.trim(),
            `${binding}: provision the production R2 bucket and set bucket_name before deployment`,
        );
    }
});
