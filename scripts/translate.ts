#!/usr/bin/env npx tsx
/**
 * AI-assisted Blog Translation Script
 *
 * Translates a Chinese blog post to English using OpenRouter API.
 * Preserves frontmatter structure, translates title/description/body/tags.
 *
 * Usage:
 *   pnpm translate <slug>
 *   pnpm translate elegant
 *   OPENROUTER_API_KEY=sk-or-... pnpm translate elegant
 *
 * Environment:
 *   OPENROUTER_API_KEY  — Required. OpenRouter API key.
 *   TRANSLATE_MODEL     — Optional. Model to use (default: anthropic/claude-sonnet-4).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CONTENT_DIR = join(import.meta.dirname, "../src/content/blog");
const ZH_DIR = join(CONTENT_DIR, "zh");
const EN_DIR = join(CONTENT_DIR, "en");

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

// ─── Frontmatter parsing ────────────────────────────────────────────

interface ParsedPost {
    frontmatter: string;
    body: string;
}

function parseMarkdown(content: string): ParsedPost {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error("Could not parse frontmatter from markdown file");
    }
    return { frontmatter: match[1], body: match[2] };
}

// ─── OpenRouter API ─────────────────────────────────────────────────

async function translate(
    frontmatter: string,
    body: string,
    apiKey: string,
    model: string,
): Promise<string> {
    const prompt = `You are a professional translator specializing in blog post translation from Chinese to English.

## Task
Translate the following Chinese blog post to English. Return ONLY the complete translated markdown file (with frontmatter).

## Rules
1. Translate the frontmatter fields: title, description, and tags
2. Keep these frontmatter fields UNCHANGED: pubDate, updatedDate, heroImage, socialImage, hidden
3. Tags should be translated to natural English equivalents (e.g. "生活" → "lifestyle")
4. Translate the markdown body naturally — maintain the author's voice and tone
5. Preserve all markdown formatting, links, and code blocks exactly
6. Keep URLs unchanged
7. For cultural references, add brief context if needed but don't over-explain
8. Keep emoji and special characters as-is
9. Output the complete file starting with \`---\` frontmatter delimiters

## Source Post

---
${frontmatter}
---
${body}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://niracler.com",
            "X-Title": "Bokushi Blog Translator",
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 16000,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("No content in API response");
    }

    // Strip markdown code fences if the model wrapped the output
    return content.replace(/^```(?:markdown|md)?\n/, "").replace(/\n```\s*$/, "");
}

// ─── CLI ────────────────────────────────────────────────────────────

async function confirm(question: string): Promise<boolean> {
    const rl = createInterface({
        input: process.stdin as unknown as NodeJS.ReadableStream,
        output: process.stdout as unknown as NodeJS.WritableStream,
    });
    return new Promise((resolve) => {
        rl.question(`${question} (y/N) `, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === "y");
        });
    });
}

async function main() {
    const slug = process.argv[2];
    if (!slug) {
        console.error("Usage: pnpm translate <slug>");
        console.error("Example: pnpm translate elegant");
        process.exit(1);
    }

    // Resolve source file (try .md then .mdx)
    const ext = existsSync(join(ZH_DIR, `${slug}.mdx`)) ? ".mdx" : ".md";
    const srcPath = join(ZH_DIR, `${slug}${ext}`);
    const destPath = join(EN_DIR, `${slug}${ext}`);

    if (!existsSync(srcPath)) {
        console.error(`Source file not found: ${srcPath}`);
        process.exit(1);
    }

    // Overwrite protection
    if (existsSync(destPath)) {
        const ok = await confirm(`Target file already exists: ${destPath}\nOverwrite?`);
        if (!ok) {
            console.log("Aborted.");
            process.exit(0);
        }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("OPENROUTER_API_KEY environment variable is required.");
        console.error("Set it via: export OPENROUTER_API_KEY=sk-or-...");
        process.exit(1);
    }

    const model = process.env.TRANSLATE_MODEL || DEFAULT_MODEL;

    console.log(`Translating: ${slug}${ext}`);
    console.log(`Model: ${model}`);
    console.log(`Source: ${srcPath}`);
    console.log(`Target: ${destPath}`);
    console.log();

    const source = readFileSync(srcPath, "utf-8");
    const { frontmatter, body } = parseMarkdown(source);

    console.log("Calling OpenRouter API...");
    const translated = await translate(frontmatter, body, apiKey, model);

    writeFileSync(destPath, translated, "utf-8");
    console.log(`\nDone! Written to: ${destPath}`);
    console.log("Please review the translation before committing.");
}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
