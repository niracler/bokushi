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

/** CJK Unified Ideographs + Extension A/B + Compatibility Ideographs */
const CJK_REGEX =
    /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\uf900-\ufaff]/gu;

const CJK_CHARS_PER_MINUTE = 300;
const WORDS_PER_MINUTE = 200;

export function stripMarkdown(text: string): string {
    return (
        text
            // Remove frontmatter
            .replace(/^---[\s\S]*?---\s*/m, "")
            // Remove fenced code blocks
            .replace(/```[\s\S]*?```/g, "")
            // Remove inline code
            .replace(/`[^`]*`/g, "")
            // Remove images
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
            // Remove links (keep link text)
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            // Remove heading markers
            .replace(/^#{1,6}\s+/gm, "")
            // Remove bold/italic markers
            .replace(/(\*{1,2}|_{1,2})([^*_]+)\1/g, "$2")
            // Remove blockquote markers
            .replace(/^>\s+/gm, "")
            // Remove list markers
            .replace(/^[\s]*[-*+]\s+/gm, "")
            .replace(/^[\s]*\d+\.\s+/gm, "")
            // Remove horizontal rules
            .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
            // Remove HTML tags
            .replace(/<[^>]+>/g, "")
            // Collapse whitespace
            .replace(/\s+/g, " ")
            .trim()
    );
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
