import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCheckCommands,
    getStagedFiles,
    isDependencyControlFile,
    runPnpm,
} from "../scripts/check-dependencies.mjs";

test("launches native pnpm directly and JavaScript pnpm through Node", () => {
    for (const path of ["/tools/pnpm", "/tools/pnpm.exe", "/tools/pnpm.cjs", "/tools/pnpm.js"]) {
        let invocation;
        runPnpm(
            ["exec", "knip"],
            (...args) => {
                invocation = args;
            },
            path,
        );
        const javascript = path.endsWith(".js") || path.endsWith(".cjs");
        assert.deepEqual(invocation, [
            javascript ? process.execPath : path,
            javascript ? [path, "exec", "knip"] : ["exec", "knip"],
            { stdio: "inherit" },
        ]);
    }
});

test("falls back to pnpm on PATH without npm_execpath", () => {
    let invocation;
    runPnpm(
        ["exec", "knip"],
        (...args) => {
            invocation = args;
        },
        "",
    );
    assert.deepEqual(invocation, ["pnpm", ["exec", "knip"], { stdio: "inherit" }]);
});

test("recognizes dependency control files", () => {
    for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
        assert.equal(isDependencyControlFile(file), true, file);
    }

    assert.equal(isDependencyControlFile("src/pages/index.astro"), false);
});

test("commit mode skips network checks for ordinary source changes", () => {
    assert.deepEqual(buildCheckCommands("commit", ["src/pages/index.astro"]), [
        ["exec", "knip", "--dependencies"],
    ]);
});

test("commit mode audits dependency control changes at high severity", () => {
    assert.deepEqual(buildCheckCommands("commit", ["package.json"]), [
        ["exec", "knip", "--dependencies"],
        ["dedupe", "--check"],
        ["audit", "--audit-level=high"],
    ]);
});

test("staged dependency control deletions are included", () => {
    let invocation;
    const files = getStagedFiles((command, args, options) => {
        invocation = { command, args, options };
        return ".npmrc\n";
    });

    assert.deepEqual(files, [".npmrc"]);
    assert.deepEqual(invocation, {
        command: "git",
        args: ["diff", "--cached", "--name-only", "--diff-filter=ACMRD"],
        options: { encoding: "utf8" },
    });
    assert.equal(files.some(isDependencyControlFile), true);
});

test("ci mode always audits at moderate severity", () => {
    assert.deepEqual(buildCheckCommands("ci", []), [
        ["exec", "knip", "--dependencies"],
        ["dedupe", "--check"],
        ["audit", "--audit-level=moderate"],
    ]);
});

test("rejects unsupported modes", () => {
    assert.throws(() => buildCheckCommands("unknown", []), /Unsupported dependency check mode/);
});
