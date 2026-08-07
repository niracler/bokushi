import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import sanitizeHtml from "sanitize-html";

const md = MarkdownIt({ html: false, linkify: true, breaks: false }).disable("heading");

md.renderer.rules.table_open = () => '<div class="comment-table-wrapper"><table>';
md.renderer.rules.table_close = () => "</table></div>";

function isHttpsUrl(raw: string): boolean {
    try {
        return new URL(raw).protocol === "https:";
    } catch {
        return false;
    }
}

function renderImage(tokens: Token[], index: number): string {
    const token = tokens[index];
    const src = token.attrGet("src") ?? "";
    const alt = md.utils.escapeHtml(token.content || "图片");
    const escapedSrc = md.utils.escapeHtml(src);

    if (!isHttpsUrl(src)) {
        if (!src) return alt;
        return `<a href="${escapedSrc}">${alt || escapedSrc}</a>`;
    }

    const title = token.attrGet("title");
    const titleAttr = title ? ` title="${md.utils.escapeHtml(title)}"` : "";
    return `<img class="comment-image" src="${escapedSrc}" alt="${alt}"${titleAttr} loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

md.renderer.rules.image = renderImage;

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        "b",
        "i",
        "em",
        "strong",
        "a",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
        "blockquote",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "div",
        "img",
    ],
    allowedAttributes: {
        a: ["href", "target", "rel"],
        img: ["class", "src", "alt", "title", "loading", "decoding", "referrerpolicy"],
        th: ["style"],
        td: ["style"],
        div: ["class"],
    },
    allowedClasses: {
        div: ["comment-table-wrapper"],
        img: ["comment-image"],
    },
    allowedSchemesByTag: {
        a: ["http", "https", "mailto"],
        img: ["https"],
    },
    allowedStyles: {
        "*": {
            "text-align": [/^left$/, /^right$/, /^center$/],
        },
    },
};

export function renderCommentMarkdown(raw: string): string {
    const html = sanitizeHtml(md.render(raw), SANITIZE_OPTIONS);
    const cjk = "\\u2e80-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";
    return html
        .replace(new RegExp(`([${cjk}])\\s+(<(?:strong|em|b|i)>)`, "gu"), "$1$2")
        .replace(new RegExp(`(<\\/(?:strong|em|b|i)>)\\s+([${cjk}])`, "gu"), "$1$2");
}

function visitTokens(tokens: Token[], visitor: (token: Token) => void): void {
    for (const token of tokens) {
        visitor(token);
        if (token.children) visitTokens(token.children, visitor);
    }
}

export interface CommentMarkdownImage {
    url: string;
    alt: string;
}

export function extractCommentMarkdownImages(raw: string): CommentMarkdownImage[] {
    const images: CommentMarkdownImage[] = [];
    const seen = new Set<string>();

    visitTokens(md.parse(raw, {}), (token) => {
        if (token.type !== "image") return;
        const url = token.attrGet("src") ?? "";
        if (!isHttpsUrl(url) || seen.has(url)) return;
        seen.add(url);
        images.push({ url, alt: token.content.trim() || "图片" });
    });

    return images;
}

export function commentMarkdownToPlainText(raw: string): string {
    const parts: string[] = [];

    const collect = (tokens: Token[]): void => {
        for (const token of tokens) {
            if (token.type === "image") {
                parts.push("〔图片〕");
            } else if (token.type === "text" || token.type === "code_inline") {
                parts.push(token.content);
            } else if (token.type === "softbreak" || token.type === "hardbreak") {
                parts.push(" ");
            } else if (token.type === "fence" || token.type === "code_block") {
                parts.push(token.content);
            } else if (token.children) {
                collect(token.children);
            }
        }
    };

    collect(md.parse(raw, {}));

    return parts.join(" ").replace(/\s+/gu, " ").trim();
}
