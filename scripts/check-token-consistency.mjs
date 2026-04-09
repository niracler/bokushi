#!/usr/bin/env node

/**
 * Token Consistency Checker
 *
 * Parses tokens.css and verifies that hardcoded values in documentation
 * and showcase components match the source of truth.
 *
 * Loose mode: only checks tokens that are already referenced in target files.
 * Does NOT require all tokens to be documented.
 *
 * Exit 0 = consistent, Exit 1 = mismatches found.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- Step 1: Parse tokens.css ---

function parseTokensCss(filePath) {
    const content = readFileSync(filePath, "utf-8");
    const tokens = new Map();

    const blockRegex = /(:root(?:\[data-theme="dark"\])?)\s*\{([^}]+)\}/g;

    for (const blockMatch of content.matchAll(blockRegex)) {
        const selector = blockMatch[1];
        const isDark = selector.includes("dark");
        const block = blockMatch[2];

        const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;

        for (const varMatch of block.matchAll(varRegex)) {
            const name = varMatch[1].trim();
            const value = varMatch[2].trim();

            // Skip tokens whose values reference other variables
            if (value.includes("var(") || value.includes("color-mix(")) continue;

            const key = isDark ? `dark:${name}` : `light:${name}`;
            tokens.set(key, { name, value, theme: isDark ? "dark" : "light" });
        }
    }

    return tokens;
}

// --- Step 2: Check DESIGN.md tables ---

function checkDesignMd(filePath, tokens) {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, "utf-8");
    const mismatches = [];

    // Match table rows where second column looks like a CSS value
    const rowRegex =
        /\|\s*`?(--[\w-]+)`?\s*\|\s*`?((?:#[0-9a-fA-F]{3,8}|(?:\d+\.?\d*(?:rem|px|em|s)|rgba?\([^)]+\)|0\s)[^|]*))`?\s*\|/g;

    for (const match of content.matchAll(rowRegex)) {
        const tokenName = match[1].trim();
        const docValue = match[2].trim();

        const before = content.substring(0, match.index);
        const lastDark = before.lastIndexOf("Dark Theme");
        const lastLight = before.lastIndexOf("Light Theme");

        // For shadow/elevation tables with both light and dark columns
        const lastShadowHeader = before.lastIndexOf("Shadow Presets");
        if (lastShadowHeader > Math.max(lastDark, lastLight)) {
            checkShadowRow(content, match, tokenName, tokens, mismatches);
            continue;
        }

        const isDark = lastDark > lastLight;
        const key = isDark ? `dark:${tokenName}` : `light:${tokenName}`;
        const token = tokens.get(key);

        if (token && normalizeValue(token.value) !== normalizeValue(docValue)) {
            mismatches.push({
                file: "DESIGN.md",
                token: tokenName,
                theme: isDark ? "dark" : "light",
                expected: token.value,
                actual: docValue,
            });
        }
    }

    return mismatches;
}

function checkShadowRow(content, match, tokenName, tokens, mismatches) {
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const lineEnd = content.indexOf("\n", match.index);
    const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
    const cols = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

    if (cols.length >= 3) {
        const lightVal = cols[1].replace(/`/g, "").trim();
        const darkVal = cols[2].replace(/`/g, "").trim();

        const lightToken = tokens.get(`light:${tokenName}`);
        const darkToken = tokens.get(`dark:${tokenName}`);

        if (lightToken && normalizeValue(lightToken.value) !== normalizeValue(lightVal)) {
            mismatches.push({
                file: "DESIGN.md",
                token: tokenName,
                theme: "light",
                expected: lightToken.value,
                actual: lightVal,
            });
        }
        if (darkToken && normalizeValue(darkToken.value) !== normalizeValue(darkVal)) {
            mismatches.push({
                file: "DESIGN.md",
                token: tokenName,
                theme: "dark",
                expected: darkToken.value,
                actual: darkVal,
            });
        }
    }
}

// --- Step 3: Check Astro component token arrays ---

function checkAstroComponents(dir, tokens) {
    const mismatches = [];
    const files = ["ColorPalette.astro", "TypographyScale.astro", "ComponentShowcase.astro"];

    for (const file of files) {
        const filePath = resolve(dir, file);
        if (!existsSync(filePath)) continue;
        const content = readFileSync(filePath, "utf-8");

        const entryRegex = /name:\s*"(--[\w-]+)"\s*,\s*value:\s*"([^"]+)"/g;

        for (const match of content.matchAll(entryRegex)) {
            const tokenName = match[1];
            const componentValue = match[2];

            const before = content.substring(0, match.index);
            const isDark =
                before.lastIndexOf("darkColors") > before.lastIndexOf("lightColors") ||
                before.lastIndexOf("darkValue") > before.lastIndexOf("lightValue");

            const key = isDark ? `dark:${tokenName}` : `light:${tokenName}`;
            const token = tokens.get(key);

            if (token && normalizeValue(token.value) !== normalizeValue(componentValue)) {
                mismatches.push({
                    file,
                    token: tokenName,
                    theme: isDark ? "dark" : "light",
                    expected: token.value,
                    actual: componentValue,
                });
            }
        }
    }

    return mismatches;
}

// --- Step 4: Check MDX blog post ---

function checkMdxPost(filePath, tokens) {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, "utf-8");
    const mismatches = [];

    const rowRegex = /\|\s*([^|]+)\|\s*`?(#[0-9a-fA-F]{6})`?\s*\|\s*`?(#[0-9a-fA-F]{6})`?\s*\|/g;

    for (const match of content.matchAll(rowRegex)) {
        const lightVal = match[2].trim();
        const darkVal = match[3].trim();

        for (const [, token] of tokens) {
            if (
                token.theme === "light" &&
                normalizeValue(token.value) === normalizeValue(lightVal)
            ) {
                const darkKey = `dark:${token.name}`;
                const darkToken = tokens.get(darkKey);
                if (darkToken && normalizeValue(darkToken.value) !== normalizeValue(darkVal)) {
                    mismatches.push({
                        file: "design.mdx",
                        token: token.name,
                        theme: "dark",
                        expected: darkToken.value,
                        actual: darkVal,
                    });
                }
            }
        }
    }

    return mismatches;
}

// --- Helpers ---

function normalizeValue(val) {
    return val.replace(/\s+/g, " ").replace(/,\s*/g, ", ").trim().toLowerCase();
}

// --- Main ---

const tokensPath = resolve(ROOT, "src/styles/tokens.css");
const designMdPath = resolve(ROOT, "DESIGN.md");
const componentsDir = resolve(ROOT, "src/components/design");
const mdxPath = resolve(ROOT, "src/content/blog/zh/design.mdx");

if (!existsSync(tokensPath)) {
    console.error("Error: tokens.css not found at", tokensPath);
    process.exit(1);
}

const tokens = parseTokensCss(tokensPath);
console.log(`Parsed ${tokens.size} token definitions from tokens.css`);

const allMismatches = [
    ...checkDesignMd(designMdPath, tokens),
    ...checkAstroComponents(componentsDir, tokens),
    ...checkMdxPost(mdxPath, tokens),
];

if (allMismatches.length === 0) {
    console.log("All token references are consistent.");
    process.exit(0);
} else {
    console.error(`\nFound ${allMismatches.length} token mismatch(es):\n`);
    for (const m of allMismatches) {
        console.error(`  ${m.file} | ${m.token} (${m.theme})`);
        console.error(`    Expected: ${m.expected}`);
        console.error(`    Actual:   ${m.actual}`);
        console.error();
    }
    console.error("Hint: screenshots (docs/design-preview-*.png) may also need updating.\n");
    process.exit(1);
}
