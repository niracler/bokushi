import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const { GET } = await import("../src/pages/api/meting.ts");

test("Meting API keeps upstream errors out of public responses", async () => {
    const sensitiveMessage = "upstream request exposed an internal endpoint";
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const loggedErrors = [];

    globalThis.fetch = async () => {
        throw new Error(sensitiveMessage);
    };
    console.error = (...args) => loggedErrors.push(args);

    try {
        const response = await GET({
            request: new Request("https://example.com/api/meting?type=url&id=123"),
        });
        const body = await response.json();

        assert.equal(response.status, 502);
        assert.deepEqual(body, { error: "Failed to fetch from Netease" });
        assert.doesNotMatch(JSON.stringify(body), new RegExp(sensitiveMessage));
        assert.match(loggedErrors.flat().join(" "), new RegExp(sensitiveMessage));
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalConsoleError;
    }
});
