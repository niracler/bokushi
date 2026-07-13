import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const { extractDescription } = await import("../src/utils/extractDescription.ts");
const { serializeJsonForHtml } = await import("../src/utils/serializeJsonForHtml.ts");

test("HTML-embedded JSON cannot be closed by article description text", () => {
    const description = extractDescription(
        "<xmp></script><script>globalThis.pwned=1</script></xmp>",
        200,
    );
    const serialized = serializeJsonForHtml({ description });

    assert.doesNotMatch(serialized, /</);
    assert.equal(JSON.parse(serialized).description, description);
});
