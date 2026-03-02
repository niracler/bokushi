#!/usr/bin/env npx tsx
/**
 * WeChat Official Account Export Script
 *
 * Converts a blog Markdown file to WeChat-compatible HTML with inline CSS.
 * Handles: link→footnotes, image→placeholders, code→shiki highlighting,
 * mermaid→placeholders, and theme-based inline styling.
 *
 * Usage:
 *   pnpm wechat-export <slug>
 *   pnpm wechat-export elegant --theme dark
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Element, ElementContent, Root, Text } from "hast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { codeToHast } from "shiki";
import { unified } from "unified";
import { EXIT, visit } from "unist-util-visit";
import { SITE_URL } from "../src/consts";

// ─── Paths ──────────────────────────────────────────────────────────

const SCRIPT_DIR = import.meta.dirname;
const PROJECT_ROOT = join(SCRIPT_DIR, "..");
const CONTENT_DIR = join(PROJECT_ROOT, "src/content/blog/zh");
const OUTPUT_DIR = join(PROJECT_ROOT, "dist/wechat");
const THEMES_DIR = join(SCRIPT_DIR, "wechat-themes");

// ─── Types ──────────────────────────────────────────────────────────

interface Theme {
    [key: string]: Record<string, string>;
}

interface ExportStats {
    images: Array<{ index: number; src: string; alt: string }>;
    footnotes: Array<{ index: number; text: string; url: string }>;
    skippedElements: string[];
}

// ─── Theme helpers ──────────────────────────────────────────────────

function loadTheme(name: string): Theme {
    const themePath = join(THEMES_DIR, `${name}.json`);
    if (!existsSync(themePath)) {
        console.error(`Theme not found: ${themePath}`);
        console.error(`Available themes: ${listThemes().join(", ")}`);
        process.exit(1);
    }
    try {
        return JSON.parse(readFileSync(themePath, "utf-8"));
    } catch (err) {
        console.error(`Failed to parse theme: ${themePath}`);
        console.error((err as Error).message);
        process.exit(1);
    }
}

function listThemes(): string[] {
    return readdirSync(THEMES_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
}

function styleString(styles: Record<string, string>): string {
    return Object.entries(styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(";");
}

// ─── Frontmatter parsing ────────────────────────────────────────────

function stripFrontmatter(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return match ? match[1] : content;
}

function stripMdxImports(content: string): string {
    return content.replace(/^import\s+.+from\s+['"].+['"]\s*;?\s*$/gm, "").trimStart();
}

// ─── rehypeWechatLinks: convert links to footnotes ──────────────────

function rehypeWechatLinks(stats: ExportStats, theme: Theme) {
    return () => (tree: Root) => {
        const urlToIndex = new Map<string, number>();
        const replacements: Array<{
            parent: Element;
            index: number;
            children: ElementContent[];
            sup: Element;
        }> = [];

        // Collect all link nodes first to avoid index shifting during splice
        visit(
            tree,
            "element",
            (node: Element, index: number | undefined, parent: Root | Element | undefined) => {
                if (node.tagName !== "a" || !parent || index === undefined) return;

                const href = (node.properties?.href as string) || "";
                // Skip anchor links (internal page links)
                if (!href || href.startsWith("#")) return;

                // Get or assign footnote number
                let footnoteIndex: number;
                const existing = urlToIndex.get(href);
                if (existing !== undefined) {
                    footnoteIndex = existing;
                } else {
                    footnoteIndex = stats.footnotes.length + 1;
                    const linkText = textContent(node);
                    stats.footnotes.push({
                        index: footnoteIndex,
                        text: linkText,
                        url: href,
                    });
                    urlToIndex.set(href, footnoteIndex);
                }

                const supStyle = theme["footnote-ref"] || {};
                const sup: Element = {
                    type: "element",
                    tagName: "sup",
                    properties: {
                        style: styleString(
                            Object.keys(supStyle).length > 0
                                ? supStyle
                                : { color: "#1a73e8", "font-size": "12px" },
                        ),
                    },
                    children: [{ type: "text", value: `[${footnoteIndex}]` }],
                };

                replacements.push({
                    parent: parent as Element,
                    index,
                    children: [...node.children],
                    sup,
                });
            },
        );

        // Apply replacements in reverse order to preserve indices
        for (let i = replacements.length - 1; i >= 0; i--) {
            const { parent, index, children, sup } = replacements[i];
            parent.children.splice(index, 1, ...children, sup);
        }

        // Append footnote list at end of document
        if (stats.footnotes.length > 0) {
            const footnoteStyle = theme.footnote || {};
            const hr: Element = {
                type: "element",
                tagName: "hr",
                properties: {
                    style: styleString(
                        theme.hr || { "border-top": "1px solid #ddd", margin: "24px 0" },
                    ),
                },
                children: [],
            };
            const heading: Element = {
                type: "element",
                tagName: "p",
                properties: {
                    style: styleString({
                        ...footnoteStyle,
                        "font-weight": "bold",
                        margin: "12px 0 8px",
                    }),
                },
                children: [{ type: "text", value: "参考链接" }],
            };
            const items: Element[] = stats.footnotes.map((fn) => ({
                type: "element",
                tagName: "p",
                properties: { style: styleString({ ...footnoteStyle, margin: "4px 0" }) },
                children: [
                    {
                        type: "text",
                        value: `[${fn.index}] ${fn.text}: ${fn.url}`,
                    },
                ],
            }));

            tree.children.push(hr, heading, ...items);
        }
    };
}

// ─── rehypeWechatImages: replace images with placeholders ───────────

function rehypeWechatImages(stats: ExportStats, theme: Theme) {
    return () => (tree: Root) => {
        const replacements: Array<{
            parent: Element;
            index: number;
            placeholder: Element;
        }> = [];

        visit(
            tree,
            "element",
            (node: Element, index: number | undefined, parent: Root | Element | undefined) => {
                if (node.tagName !== "img" || !parent || index === undefined) return;

                const src = (node.properties?.src as string) || "";
                const alt = (node.properties?.alt as string) || "";
                const imageIndex = stats.images.length + 1;
                stats.images.push({ index: imageIndex, src, alt });

                const placeholderStyle = theme["image-placeholder"] || {};
                const placeholder: Element = {
                    type: "element",
                    tagName: "p",
                    properties: { style: styleString(placeholderStyle) },
                    children: [
                        {
                            type: "text",
                            value: `[Image ${imageIndex}${alt ? `: ${alt}` : ""} - Please insert in WeChat editor]`,
                        },
                    ],
                };

                replacements.push({ parent: parent as Element, index, placeholder });
            },
        );

        // Apply in reverse to preserve indices
        for (let i = replacements.length - 1; i >= 0; i--) {
            const { parent, index, placeholder } = replacements[i];
            parent.children.splice(index, 1, placeholder);
        }
    };
}

// ─── rehypeWechatCode: shiki inline highlighting ────────────────────

function rehypeWechatCode(stats: ExportStats, theme: Theme) {
    return () => async (tree: Root) => {
        const codeBlocks: Array<{
            node: Element;
            parent: Element;
            index: number;
            lang: string;
            code: string;
        }> = [];

        // Collect code blocks first (can't do async inside visit)
        visit(
            tree,
            "element",
            (node: Element, index: number | undefined, parent: Root | Element | undefined) => {
                if (
                    node.tagName === "pre" &&
                    node.children.length === 1 &&
                    (node.children[0] as Element).tagName === "code"
                ) {
                    const codeEl = node.children[0] as Element;
                    const className = ((codeEl.properties?.className as string[]) || []).join(" ");
                    const langMatch = className.match(/language-(\w+)/);
                    const lang = langMatch ? langMatch[1] : "";
                    const code = textContent(codeEl);

                    if (parent && index !== undefined) {
                        codeBlocks.push({ node, parent: parent as Element, index, lang, code });
                    }
                }

                // Inline code
                if (node.tagName === "code" && parent && (parent as Element).tagName !== "pre") {
                    const inlineStyle = theme["code-inline"] || {};
                    node.properties = {
                        ...node.properties,
                        style: styleString(inlineStyle),
                    };
                }
            },
        );

        // Process code blocks with shiki (reverse order to preserve indices)
        for (let i = codeBlocks.length - 1; i >= 0; i--) {
            const block = codeBlocks[i];
            if (block.lang === "mermaid") {
                // Mermaid → placeholder
                const placeholderStyle = theme["mermaid-placeholder"] || {};
                const placeholder: Element = {
                    type: "element",
                    tagName: "p",
                    properties: { style: styleString(placeholderStyle) },
                    children: [
                        {
                            type: "text",
                            value: "[Diagram - Please screenshot from blog page and insert]",
                        },
                    ],
                };
                block.parent.children.splice(block.index, 1, placeholder);
                stats.skippedElements.push("Mermaid diagram");
                continue;
            }

            try {
                const hast = await codeToHast(block.code, {
                    lang: block.lang || "text",
                    theme: "github-light",
                });

                // Extract the <pre> from shiki's output and apply theme styles
                const preNode = findElement(hast, "pre");
                if (preNode) {
                    const blockStyle = theme["code-block"] || {};
                    const existingStyle = (preNode.properties?.style as string) || "";
                    preNode.properties = {
                        ...preNode.properties,
                        style: [existingStyle, styleString(blockStyle)].filter(Boolean).join(";"),
                    };
                    block.parent.children.splice(block.index, 1, preNode);
                }
            } catch {
                // Fallback: plain code block
                const blockStyle = theme["code-block"] || {};
                block.node.properties = {
                    ...block.node.properties,
                    style: styleString(blockStyle),
                };
            }
        }
    };
}

// ─── rehypeWechatStyle: inject inline CSS from theme ────────────────

function rehypeWechatStyle(theme: Theme) {
    // Keys handled by other plugins or used for non-element purposes
    const SPECIAL_KEYS = new Set([
        "body",
        "code-inline",
        "code-block",
        "footnote",
        "footnote-ref",
        "image-placeholder",
        "mermaid-placeholder",
    ]);

    const elementMap: Record<string, string> = {};
    for (const [key, styles] of Object.entries(theme)) {
        if (SPECIAL_KEYS.has(key)) continue;
        elementMap[key] = styleString(styles);
    }

    return () => (tree: Root) => {
        visit(tree, "element", (node: Element) => {
            const tag = node.tagName;
            if (elementMap[tag] && !node.properties?.style) {
                node.properties = {
                    ...node.properties,
                    style: elementMap[tag],
                };
            }
        });
    };
}

// ─── Helpers ────────────────────────────────────────────────────────

function textContent(node: Element | Text): string {
    if (node.type === "text") return node.value;
    if ("children" in node) {
        return (node.children as Array<Element | Text>).map((c) => textContent(c)).join("");
    }
    return "";
}

function findElement(tree: unknown, tagName: string): Element | null {
    let found: Element | null = null;
    visit(tree as Root, "element", (node: Element) => {
        if (node.tagName === tagName) {
            found = node;
            return EXIT;
        }
    });
    return found;
}

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs(): { slug: string; themeName: string } {
    const args = process.argv.slice(2);
    let slug = "";
    let themeName = "default";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--theme") {
            if (!args[i + 1] || args[i + 1].startsWith("-")) {
                console.error("Error: --theme requires a value");
                process.exit(1);
            }
            themeName = args[i + 1];
            i++;
        } else if (!args[i].startsWith("-")) {
            slug = args[i];
        }
    }

    if (!slug) {
        console.error("Usage: pnpm wechat-export <slug> [--theme <name>]");
        console.error("Example: pnpm wechat-export elegant");
        process.exit(1);
    }

    return { slug, themeName };
}

async function main() {
    const { slug, themeName } = parseArgs();

    // Resolve source file
    const ext = existsSync(join(CONTENT_DIR, `${slug}.mdx`)) ? ".mdx" : ".md";
    const srcPath = join(CONTENT_DIR, `${slug}${ext}`);

    if (!existsSync(srcPath)) {
        console.error(`Source file not found: ${srcPath}`);
        const posts = readdirSync(CONTENT_DIR)
            .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
            .map((f) => f.replace(/\.mdx?$/, ""));
        console.error(`Available posts: ${posts.join(", ")}`);
        process.exit(1);
    }

    // Load theme
    const theme = loadTheme(themeName);

    console.log(`Converting: ${slug}${ext}`);
    console.log(`Theme: ${themeName}`);
    console.log(`Source: ${srcPath}`);
    console.log();

    // Read and strip frontmatter (and MDX imports if applicable)
    const source = readFileSync(srcPath, "utf-8");
    let body = stripFrontmatter(source);
    if (ext === ".mdx") {
        body = stripMdxImports(body);
        console.log("Note: MDX components will be omitted from export.");
    }

    // Build conversion pipeline
    const stats: ExportStats = {
        images: [],
        footnotes: [],
        skippedElements: [],
    };

    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkAlert)
        .use(remarkRehype)
        .use(rehypeWechatLinks(stats, theme))
        .use(rehypeWechatImages(stats, theme))
        .use(rehypeWechatCode(stats, theme))
        .use(rehypeWechatStyle(theme))
        .use(rehypeStringify);

    const result = await processor.process(body);
    const bodyStyle = styleString(theme.body || {});
    const content = `<section style="${bodyStyle}">\n${String(result)}\n</section>`;
    // Wrap in minimal HTML for browser preview (charset needed for CJK)
    const html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>\n${content}\n</body></html>`;

    // Write output
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const outputPath = join(OUTPUT_DIR, `${slug}.html`);
    writeFileSync(outputPath, html, "utf-8");

    // Print summary
    console.log(`\nDone: ${outputPath}`);
    if (stats.images.length > 0) {
        console.log(`\nImages to upload manually (${stats.images.length}):`);
        for (const img of stats.images) {
            console.log(`  [${img.index}] ${img.src}${img.alt ? ` (${img.alt})` : ""}`);
        }
    }
    if (stats.footnotes.length > 0) {
        console.log(`\nLinks converted to footnotes: ${stats.footnotes.length}`);
    }
    if (stats.skippedElements.length > 0) {
        console.log(`\nSkipped elements: ${stats.skippedElements.join(", ")}`);
    }
    console.log(`\nSuggested "Read Original" link: ${SITE_URL}/${slug}`);
}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
