import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { getActiveTheme, onThemeChange } from "./theme";

// --- Types ---

interface CommentNode {
    id: string;
    author: string;
    email: string | null;
    website: string | null;
    content: string;
    status: string;
    created_at: string;
    replies: CommentNode[];
}

interface CommentsResponse {
    comments: CommentNode[];
    total: number;
}

// --- Markdown renderer ---

const md = MarkdownIt({ linkify: true, breaks: true }).disable("heading");

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
        "img",
    ],
    allowedAttributes: {
        a: ["href", "target", "rel"],
        img: ["src", "alt"],
    },
};

function renderMarkdown(raw: string): string {
    const html = md.render(raw);
    return sanitizeHtml(html, SANITIZE_OPTIONS);
}

// --- Gravatar ---

async function md5Hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("MD5", data).catch(() => null);
    if (!hashBuffer) {
        // MD5 not available (some browsers), return empty for default avatar
        return "";
    }
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function gravatarUrl(emailHash: string): string {
    if (!emailHash) return "https://www.gravatar.com/avatar/?d=mp&s=48";
    return `https://www.gravatar.com/avatar/${emailHash}?d=mp&s=48`;
}

// --- API helpers ---

async function fetchComments(slug: string): Promise<CommentsResponse> {
    const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return { comments: [], total: 0 };
    return res.json();
}

async function postComment(
    data: Record<string, string | null>,
): Promise<{ comment?: CommentNode; error?: string }> {
    const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

// --- Time formatting ---

function formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 30) return `${diffDay} 天前`;

    return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// --- DOM rendering ---

const CONTAINER_SELECTOR = "#comment-section";

function createAuthorEl(comment: CommentNode): string {
    const name = escapeHtml(comment.author);
    if (comment.website) {
        const href = escapeHtml(comment.website);
        return `<a href="${href}" target="_blank" rel="nofollow noopener" class="font-semibold text-accent hover:underline">${name}</a>`;
    }
    return `<span class="font-semibold text-primary">${name}</span>`;
}

function escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderCommentCard(comment: CommentNode, isReply = false): string {
    if (comment.status === "deleted") {
        return `
			<div class="comment-card deleted ${isReply ? "ml-12" : ""} py-4 ${isReply ? "" : "border-b border-border-subtle"}">
				<p class="text-muted italic text-sm">该评论已删除</p>
			</div>`;
    }

    const avatarUrl = gravatarUrl("");
    const authorEl = createAuthorEl(comment);
    const time = formatTime(comment.created_at);
    const contentHtml = renderMarkdown(comment.content);

    return `
		<div class="comment-card ${isReply ? "ml-12" : ""} py-4 ${isReply ? "" : "border-b border-border-subtle"}" data-comment-id="${comment.id}">
			<div class="flex gap-3">
				<img
					src="${avatarUrl}"
					alt=""
					class="comment-avatar h-10 w-10 shrink-0 rounded-full bg-surface-raised"
					data-email="${comment.email ? escapeHtml(comment.email) : ""}"
					loading="lazy"
				/>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2 text-sm">
						${authorEl}
						<time class="text-muted text-xs" datetime="${comment.created_at}">${time}</time>
					</div>
					<div class="comment-content prose prose-sm mt-1 max-w-none text-secondary">
						${contentHtml}
					</div>
					<button
						class="reply-btn mt-2 text-xs text-muted hover:text-accent transition-colors"
						data-reply-to="${comment.id}"
						data-reply-author="${escapeHtml(comment.author)}"
						data-reply-parent="${comment.id}"
					>
						回复
					</button>
				</div>
			</div>
		</div>`;
}

function renderReplyCard(reply: CommentNode, topLevelId: string): string {
    if (reply.status === "deleted") {
        return `
			<div class="comment-card deleted ml-12 py-3">
				<p class="text-muted italic text-sm">该评论已删除</p>
			</div>`;
    }

    const avatarUrl = gravatarUrl("");
    const authorEl = createAuthorEl(reply);
    const time = formatTime(reply.created_at);
    const contentHtml = renderMarkdown(reply.content);

    return `
		<div class="comment-card ml-12 py-3" data-comment-id="${reply.id}">
			<div class="flex gap-3">
				<img
					src="${avatarUrl}"
					alt=""
					class="comment-avatar h-8 w-8 shrink-0 rounded-full bg-surface-raised"
					data-email="${reply.email ? escapeHtml(reply.email) : ""}"
					loading="lazy"
				/>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2 text-sm">
						${authorEl}
						<time class="text-muted text-xs" datetime="${reply.created_at}">${time}</time>
					</div>
					<div class="comment-content prose prose-sm mt-1 max-w-none text-secondary">
						${contentHtml}
					</div>
					<button
						class="reply-btn mt-1 text-xs text-muted hover:text-accent transition-colors"
						data-reply-to="${reply.id}"
						data-reply-author="${escapeHtml(reply.author)}"
						data-reply-parent="${topLevelId}"
					>
						回复
					</button>
				</div>
			</div>
		</div>`;
}

function renderCommentForm(siteKey: string, parentId?: string, replyAuthor?: string): string {
    const prefix = replyAuthor ? `@${replyAuthor} ` : "";
    const cancelBtn = parentId
        ? `<button type="button" class="cancel-reply-btn text-sm text-muted hover:text-primary transition-colors">取消</button>`
        : "";

    return `
		<form class="comment-form space-y-4 ${parentId ? "ml-12 mt-3 mb-4" : "mt-6"}" data-parent-id="${parentId || ""}">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<input
					type="text"
					name="author"
					placeholder="昵称 *"
					required
					maxlength="50"
					class="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
				/>
				<input
					type="email"
					name="email"
					placeholder="邮箱（选填，用于头像）"
					maxlength="200"
					class="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
				/>
				<input
					type="url"
					name="website"
					placeholder="网站（选填）"
					maxlength="200"
					class="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
				/>
			</div>
			<textarea
				name="content"
				placeholder="写下你的评论... 支持 Markdown"
				required
				maxlength="5000"
				rows="4"
				class="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
			>${prefix}</textarea>
			<div class="flex items-center justify-between">
				<div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="${getActiveTheme()}"></div>
				<div class="flex items-center gap-3">
					${cancelBtn}
					<button
						type="submit"
						class="submit-btn rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						发表评论
					</button>
				</div>
			</div>
			<p class="form-error hidden text-sm text-red-500"></p>
		</form>`;
}

function renderCommentList(data: CommentsResponse, siteKey: string): string {
    if (data.comments.length === 0) {
        return `
			<p class="text-muted text-sm mb-4">暂无评论，来发表第一条吧</p>
			${renderCommentForm(siteKey)}`;
    }

    let html = '<div class="comment-list">';
    for (const comment of data.comments) {
        html += renderCommentCard(comment);
        for (const reply of comment.replies) {
            html += renderReplyCard(reply, comment.id);
        }
    }
    html += "</div>";
    html += renderCommentForm(siteKey);
    return html;
}

// --- Event handling ---

function bindEvents(container: HTMLElement, slug: string, siteKey: string) {
    // Reply buttons
    container.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;

        // Reply button
        if (target.classList.contains("reply-btn")) {
            e.preventDefault();
            const parentId = target.dataset.replyParent ?? "";
            const replyAuthor = target.dataset.replyAuthor ?? "";

            // Remove any existing reply forms
            for (const f of container.querySelectorAll(
                ".comment-form[data-parent-id]:not([data-parent-id=''])",
            )) {
                f.remove();
            }

            // Insert reply form after the comment card
            const card = target.closest(".comment-card");
            if (!card) return;
            const formHtml = renderCommentForm(siteKey, parentId, replyAuthor);
            card.insertAdjacentHTML("afterend", formHtml);

            // Re-render Turnstile in the new form
            renderTurnstileWidgets(container);

            // Focus textarea
            const newForm = card.nextElementSibling as HTMLFormElement;
            newForm?.querySelector("textarea")?.focus();

            // Bind cancel
            newForm?.querySelector(".cancel-reply-btn")?.addEventListener("click", () => {
                newForm.remove();
            });

            // Bind submit for reply form
            bindFormSubmit(newForm, slug, siteKey, container);
        }
    });

    // Bind submit for main form
    const mainForm = container.querySelector<HTMLFormElement>(".comment-form[data-parent-id='']");
    if (mainForm) {
        bindFormSubmit(mainForm, slug, siteKey, container);
    }
}

function bindFormSubmit(
    form: HTMLFormElement,
    slug: string,
    siteKey: string,
    container: HTMLElement,
) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector<HTMLButtonElement>(".submit-btn");
        const errorEl = form.querySelector<HTMLElement>(".form-error");
        if (!submitBtn || !errorEl) return;

        // Get form data
        const formData = new FormData(form);
        const author = (formData.get("author") as string)?.trim();
        const email = (formData.get("email") as string)?.trim() || null;
        const website = (formData.get("website") as string)?.trim() || null;
        const content = (formData.get("content") as string)?.trim();
        const parentId = form.dataset.parentId || null;

        // Get Turnstile token
        const turnstileInput = form.querySelector<HTMLInputElement>(
            "[name='cf-turnstile-response']",
        );
        const turnstileToken = turnstileInput?.value;

        if (!author || !content) {
            showError(errorEl, "请填写昵称和评论内容");
            return;
        }

        if (!turnstileToken) {
            showError(errorEl, "请等待验证完成后再提交");
            return;
        }

        // Loading state
        submitBtn.disabled = true;
        submitBtn.textContent = "提交中...";
        hideError(errorEl);

        try {
            const result = await postComment({
                slug,
                parent_id: parentId,
                author,
                email,
                website,
                content,
                turnstile_token: turnstileToken,
            });

            if (result.error) {
                showError(errorEl, result.error);
                submitBtn.disabled = false;
                submitBtn.textContent = "发表评论";
                return;
            }

            // Success: reload the entire comment list
            await loadComments(container, slug, siteKey);
        } catch {
            showError(errorEl, "提交失败，请稍后重试");
            submitBtn.disabled = false;
            submitBtn.textContent = "发表评论";
        }
    });
}

function showError(el: HTMLElement, msg: string) {
    el.textContent = msg;
    el.classList.remove("hidden");
}

function hideError(el: HTMLElement) {
    el.textContent = "";
    el.classList.add("hidden");
}

// --- Turnstile ---

function renderTurnstileWidgets(container: HTMLElement) {
    // If Turnstile script loaded, render widgets
    const turnstile = (
        window as unknown as {
            turnstile?: { render: (el: HTMLElement, opts: Record<string, string>) => void };
        }
    ).turnstile;
    if (turnstile) {
        container.querySelectorAll<HTMLElement>(".cf-turnstile:empty").forEach((el) => {
            turnstile.render(el, {
                sitekey: el.dataset.sitekey ?? "",
                theme: el.dataset.theme || "auto",
            });
        });
    }
}

function ensureTurnstileScript() {
    if (document.querySelector("script[src*='turnstile']")) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    document.head.appendChild(script);
}

// --- Gravatar async loading ---

async function loadGravatars(container: HTMLElement) {
    const avatars = container.querySelectorAll<HTMLImageElement>(".comment-avatar[data-email]");
    for (const img of avatars) {
        const email = img.dataset.email;
        if (email) {
            const hash = await md5Hash(email);
            img.src = gravatarUrl(hash);
        }
    }
}

// --- Main init ---

async function loadComments(container: HTMLElement, slug: string, siteKey: string) {
    container.innerHTML = '<p class="text-muted text-sm">加载评论中...</p>';

    try {
        const data = await fetchComments(slug);
        container.innerHTML = renderCommentList(data, siteKey);
        bindEvents(container, slug, siteKey);
        renderTurnstileWidgets(container);
        loadGravatars(container);
    } catch {
        container.innerHTML = '<p class="text-red-500 text-sm">评论加载失败</p>';
    }
}

function initCommentSection() {
    const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
    if (!container) return;

    const slug = container.dataset.commentSlug;
    const siteKey = container.dataset.turnstileSiteKey;
    if (!slug || !siteKey) return;

    ensureTurnstileScript();
    loadComments(container, slug, siteKey);
}

// Theme change: update Turnstile widget theme
onThemeChange((state) => {
    const widgets = document.querySelectorAll<HTMLElement>(".cf-turnstile");
    widgets.forEach((el) => {
        el.dataset.theme = state.theme;
    });
});

// Init on load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommentSection, { once: true });
} else {
    initCommentSection();
}

// Re-init on Astro view transitions
window.addEventListener("astro:after-swap", initCommentSection);
