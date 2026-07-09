#!/usr/bin/env node

import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = new URL("../", import.meta.url);
const astroBin = new URL("../node_modules/.bin/astro", import.meta.url);
const designUrl = "http://127.0.0.1:4321/design";
const startupTimeoutMs = 90_000;

async function fetchDesignPage() {
    try {
        const response = await fetch(designUrl);
        return {
            html: await response.text(),
            status: response.status,
        };
    } catch {
        return undefined;
    }
}

function analyzeDesignPage(html) {
    return {
        footnoteRefCount: (html.match(/data-footnote-ref|class="footnote-ref"/g) ?? []).length,
        footnotesCount: (html.match(/class="footnotes"|data-footnotes/g) ?? []).length,
        rawFootnote: /\[\^\d+\]/.test(html),
        rawPipeTable: html.includes("| HIG 原则"),
        tableCount: (html.match(/<table/g) ?? []).length,
    };
}

function assertDesignRendering(page) {
    const result = analyzeDesignPage(page.html);
    const failures = [];

    if (page.status !== 200) failures.push(`expected HTTP 200, got ${page.status}`);
    if (result.tableCount < 1) failures.push("expected at least one rendered table");
    if (result.footnotesCount < 1) failures.push("expected rendered footnotes");
    if (result.footnoteRefCount < 1) failures.push("expected rendered footnote references");
    if (result.rawPipeTable) failures.push("raw pipe table text is visible");
    if (result.rawFootnote) failures.push("raw footnote markers are visible");

    if (failures.length > 0) {
        console.error(JSON.stringify({ failures, ...result }, null, 2));
        process.exitCode = 1;
        return;
    }

    console.log(JSON.stringify({ status: page.status, ...result }, null, 2));
}

async function startAstroDevServer() {
    await rm(new URL("../.astro", import.meta.url), { force: true, recursive: true });
    await rm(new URL("../node_modules/.vite", import.meta.url), { force: true, recursive: true });

    const child = spawn(astroBin.pathname, ["dev", "--host", "127.0.0.1", "--port", "4321"], {
        cwd: repoRoot.pathname,
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));

    const startedAt = Date.now();
    while (Date.now() - startedAt < startupTimeoutMs) {
        if (child.exitCode !== null) {
            throw new Error(`Astro dev server exited with code ${child.exitCode}`);
        }

        const page = await fetchDesignPage();
        if (page) return { child, page };
        await delay(1_000);
    }

    child.kill("SIGTERM");
    throw new Error(`Timed out waiting for ${designUrl}`);
}

let devServer;
let page = await fetchDesignPage();

if (!page) {
    const started = await startAstroDevServer();
    devServer = started.child;
    page = started.page;
}

assertDesignRendering(page);

if (devServer) {
    devServer.kill("SIGTERM");
}
