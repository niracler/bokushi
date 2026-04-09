#!/usr/bin/env node
/**
 * Capture design preview screenshots for README.
 * Requires: playwright (npx playwright install chromium)
 *
 * Usage: node scripts/capture-design-preview.mjs [--port 4321]
 *
 * Expects a dev server already running. Captures light/dark
 * screenshots, saves to assets/design-preview-{light,dark}.png.
 */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const ASSETS = resolve(ROOT, "assets");
const PORT = process.argv.includes("--port")
    ? process.argv[process.argv.indexOf("--port") + 1]
    : "4321";
const URL = `http://localhost:${PORT}/design-screenshot`;
const WIDTH = 1280;

if (!existsSync(ASSETS)) mkdirSync(ASSETS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: WIDTH, height: 800 },
    deviceScaleFactor: 2,
});

async function capture(theme, filename) {
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });

    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

    await page.waitForTimeout(500);
    const output = resolve(ASSETS, filename);
    await page.screenshot({ path: output, fullPage: true });
    console.log(`Saved ${filename} (${theme})`);
    await page.close();
}

await capture("light", "design-preview-light.png");
await capture("dark", "design-preview-dark.png");

await browser.close();
console.log("Done.");
