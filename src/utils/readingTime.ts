/**
 * Estimate reading time from raw Markdown content.
 *
 * Strategy:
 * - Strip Markdown syntax (code blocks, frontmatter, images, HTML tags, etc.)
 *   so we count only the prose the reader actually reads.
 * - Chinese characters are counted individually (~300 chars/min).
 * - Latin / other words are counted by whitespace splits (~200 words/min).
 * - The two durations are summed and rounded up to at least 1 minute.
 */

import * as cheerio from "cheerio";
import MarkdownIt from "markdown-it";

/** CJK Unified Ideographs + Extension A/B + Compatibility Ideographs */
const CJK_REGEX =
    /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\uf900-\ufaff]/gu;

const CJK_CHARS_PER_MINUTE = 300;
const WORDS_PER_MINUTE = 200;
const markdownParser = new MarkdownIt({ html: true });

function stripFrontmatter(text: string): string {
    const firstLineEnd = text.indexOf("\n");
    if (firstLineEnd === -1) return text;

    const firstLine = text.slice(0, firstLineEnd).replace(/\r$/, "");
    if (firstLine !== "---") return text;

    let lineStart = firstLineEnd + 1;
    while (lineStart <= text.length) {
        const nextLineEnd = text.indexOf("\n", lineStart);
        const lineEnd = nextLineEnd === -1 ? text.length : nextLineEnd;
        const line = text.slice(lineStart, lineEnd).replace(/\r$/, "");

        if (line === "---") {
            return nextLineEnd === -1 ? "" : text.slice(nextLineEnd + 1);
        }
        if (nextLineEnd === -1) break;
        lineStart = nextLineEnd + 1;
    }

    return text;
}

export function stripMarkdown(text: string): string {
    const rendered = markdownParser.render(stripFrontmatter(text));
    const $ = cheerio.load(rendered, null, false);

    $("script, style, textarea, option, noscript, pre, code, img").remove();
    $("br").replaceWith("\n");
    $(
        "address, article, aside, blockquote, div, dl, fieldset, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, section, table, ul",
    ).append("\n");
    $("td, th").append(" ");

    return $.root().text().replace(/\s+/g, " ").trim();
}

export function estimateReadingTime(markdown: string | undefined): number {
    if (!markdown) return 1;

    const plain = stripMarkdown(markdown);
    if (!plain) return 1;

    // Count CJK characters
    const cjkMatches = plain.match(CJK_REGEX);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;

    // Remove CJK characters, then count remaining Latin words
    const withoutCjk = plain.replace(CJK_REGEX, " ").trim();
    const latinWords = withoutCjk ? withoutCjk.split(/\s+/).filter(Boolean).length : 0;

    const minutes = cjkCount / CJK_CHARS_PER_MINUTE + latinWords / WORDS_PER_MINUTE;

    return Math.max(1, Math.ceil(minutes));
}
