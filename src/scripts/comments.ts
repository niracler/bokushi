import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

// --- Types ---

interface CommentNode {
    id: string;
    author: string;
    email: string | null;
    website: string | null;
    content: string;
    status: string;
    created_at: string;
    user_id: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    replies: CommentNode[];
}

interface CommentsResponse {
    comments: CommentNode[];
    total: number;
}

interface AuthUser {
    id: string;
    name: string;
    avatar_url: string | null;
    role: string;
    linkedProviders: string[];
}

// --- State ---

let currentUser: AuthUser | null = null;

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
    if (!hashBuffer) return "";
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function gravatarUrl(emailHash: string): string {
    if (!emailHash) return "https://www.gravatar.com/avatar/?d=mp&s=48";
    return `https://www.gravatar.com/avatar/${emailHash}?d=mp&s=48`;
}

// --- Auth helpers ---

async function fetchCurrentUser(): Promise<AuthUser | null> {
    try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return null;
        const data = (await res.json()) as { user: AuthUser | null };
        return data.user;
    } catch {
        return null;
    }
}

async function logout(): Promise<boolean> {
    try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        return res.ok;
    } catch {
        return false;
    }
}

// --- Auth bar rendering ---

function renderAuthBar(user: AuthUser | null): string {
    if (user) {
        const avatar = user.avatar_url
            ? `<img src="${escapeHtml(user.avatar_url)}" alt="" class="h-8 w-8 rounded-full" />`
            : `<img src="https://www.gravatar.com/avatar/?d=mp&s=48" alt="" class="h-8 w-8 rounded-full" />`;

        const adminBadge =
            user.role === "admin"
                ? `<span class="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">Admin</span>`
                : "";

        // Build link buttons for missing providers
        const linkButtons: string[] = [];
        if (!user.linkedProviders.includes("telegram")) {
            linkButtons.push(
                `<button class="link-telegram-btn text-xs text-muted hover:text-accent transition-colors">关联 Telegram</button>`,
            );
        }
        if (!user.linkedProviders.includes("github")) {
            linkButtons.push(
                `<a href="/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}" class="text-xs text-muted hover:text-accent transition-colors">关联 GitHub</a>`,
            );
        }

        const linkSection = linkButtons.length > 0 ? ` · ${linkButtons.join(" · ")}` : "";

        return `
            <div class="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-2.5">
                ${avatar}
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span class="font-medium text-primary">${escapeHtml(user.name)}</span>
                    ${adminBadge}
                    <span class="text-muted">·</span>
                    <button class="logout-btn text-xs text-muted hover:text-red-500 transition-colors">登出</button>
                    ${linkSection}
                </div>
            </div>`;
    }

    // Not logged in: show login buttons + divider
    return `
        <div class="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-3">
            <div class="flex gap-3">
                <a href="/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}"
                   class="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-hover">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    GitHub 登录
                </a>
                <div id="telegram-login-container" class="flex items-center">
                    <button id="telegram-login-btn"
                        class="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-hover">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        Telegram 登录
                    </button>
                </div>
            </div>
            <div class="flex w-full items-center gap-3 text-xs text-muted">
                <div class="h-px flex-1 bg-border-subtle"></div>
                <span>或匿名评论</span>
                <div class="h-px flex-1 bg-border-subtle"></div>
            </div>
        </div>`;
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
const AUTH_BAR_SELECTOR = "#comment-auth-bar";

function createAuthorEl(comment: CommentNode): string {
    const name = escapeHtml(comment.author);

    // Admin badge
    const adminBadge = comment.is_admin
        ? ` <span class="rounded bg-accent/10 px-1 py-0.5 text-[10px] text-accent">博主</span>`
        : "";

    if (comment.website && !comment.user_id) {
        // Anonymous with website: link to website
        const href = escapeHtml(comment.website);
        return `<a href="${href}" target="_blank" rel="nofollow noopener" class="font-semibold text-accent hover:underline">${name}</a>${adminBadge}`;
    }
    return `<span class="font-semibold text-primary">${name}</span>${adminBadge}`;
}

function escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function getCommentAvatarUrl(comment: CommentNode): string {
    // Logged-in user: use OAuth avatar
    if (comment.avatar_url) return comment.avatar_url;
    // Anonymous: will be resolved via Gravatar async loading
    return gravatarUrl("");
}

function renderCommentCard(comment: CommentNode, isReply = false): string {
    if (comment.status === "deleted") {
        return `
			<div class="comment-card deleted ${isReply ? "ml-12" : ""} py-4 ${isReply ? "" : "border-b border-border-subtle"}">
				<p class="text-muted italic text-sm">该评论已删除</p>
			</div>`;
    }

    const avatarUrl = getCommentAvatarUrl(comment);
    const authorEl = createAuthorEl(comment);
    const time = formatTime(comment.created_at);
    const contentHtml = renderMarkdown(comment.content);
    const avatarSize = isReply ? "h-8 w-8" : "h-10 w-10";

    return `
		<div class="comment-card ${isReply ? "ml-12" : ""} py-4 ${isReply ? "" : "border-b border-border-subtle"}" data-comment-id="${comment.id}">
			<div class="flex gap-3">
				<img
					src="${avatarUrl}"
					alt=""
					class="comment-avatar ${avatarSize} shrink-0 rounded-full bg-surface-raised"
					data-email="${!comment.user_id && comment.email ? escapeHtml(comment.email) : ""}"
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
    return renderCommentCard({ ...reply }, true).replace(
        `data-reply-parent="${reply.id}"`,
        `data-reply-parent="${topLevelId}"`,
    );
}

function renderCommentForm(parentId?: string, replyAuthor?: string): string {
    const prefix = replyAuthor ? `@${replyAuthor} ` : "";
    const cancelBtn = parentId
        ? `<button type="button" class="cancel-reply-btn text-sm text-muted hover:text-primary transition-colors">取消</button>`
        : "";

    // Logged-in users don't need author/email/website fields
    const identityFields = currentUser
        ? ""
        : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
			</div>`;

    return `
		<form class="comment-form space-y-4 ${parentId ? "ml-12 mt-3 mb-4" : "mt-6"}" data-parent-id="${parentId || ""}">
			${identityFields}
			<textarea
				name="content"
				placeholder="写下你的评论... 支持 Markdown"
				required
				maxlength="5000"
				rows="4"
				class="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
			>${prefix}</textarea>
			<div class="flex items-center justify-end gap-3">
				${cancelBtn}
				<button
					type="submit"
					class="submit-btn rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					发表评论
				</button>
			</div>
			<p class="form-error hidden text-sm text-red-500"></p>
		</form>`;
}

function renderCommentList(data: CommentsResponse): string {
    if (data.comments.length === 0) {
        return `
			<p class="text-muted text-sm mb-4">暂无评论，来发表第一条吧</p>
			${renderCommentForm()}`;
    }

    let html = '<div class="comment-list">';
    for (const comment of data.comments) {
        html += renderCommentCard(comment);
        for (const reply of comment.replies) {
            html += renderReplyCard(reply, comment.id);
        }
    }
    html += "</div>";
    html += renderCommentForm();
    return html;
}

// --- Telegram Widget ---

// Global callback for Telegram Login Widget
declare global {
    interface Window {
        onTelegramAuth: (user: Record<string, unknown>) => void;
    }
}

function setupTelegramWidget(container: HTMLElement) {
    // For the login button in auth bar (when not logged in)
    const loginBtn = container.querySelector("#telegram-login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            // We need to create the Telegram widget dynamically
            // The widget will call window.onTelegramAuth on success
            openTelegramLoginPopup();
        });
    }
}

function openTelegramLoginPopup() {
    // Telegram Login Widget requires a real bot name.
    // The widget script is loaded dynamically and creates a popup.
    // We use the data-auth-url approach: Telegram sends data to our callback.
    const widgetContainer = document.getElementById("telegram-login-container");
    if (!widgetContainer) return;

    // Replace button with actual Telegram widget
    widgetContainer.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "tomoko_aibot"); // bot username
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    widgetContainer.appendChild(script);
}

async function handleTelegramAuth(telegramData: Record<string, unknown>) {
    try {
        const res = await fetch("/api/auth/telegram/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(telegramData),
        });
        if (res.ok) {
            // Reload to reflect logged-in state
            window.location.reload();
        }
    } catch {
        console.error("Telegram auth failed");
    }
}

async function handleTelegramLink(telegramData: Record<string, unknown>) {
    try {
        const res = await fetch("/api/auth/link/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(telegramData),
        });
        if (res.ok) {
            window.location.reload();
        } else {
            const data = (await res.json()) as { error?: string };
            alert(data.error || "关联失败");
        }
    } catch {
        alert("关联失败，请稍后重试");
    }
}

// Set up global Telegram callback
window.onTelegramAuth = (user: Record<string, unknown>) => {
    // Determine if this is login or linking based on current state
    if (currentUser) {
        handleTelegramLink(user);
    } else {
        handleTelegramAuth(user);
    }
};

// --- Event handling ---

function bindAuthBarEvents(authBar: HTMLElement) {
    // Logout button
    authBar.querySelector(".logout-btn")?.addEventListener("click", async () => {
        const ok = await logout();
        if (ok) {
            currentUser = null;
            window.location.reload();
        }
    });

    // Link Telegram button
    authBar.querySelector(".link-telegram-btn")?.addEventListener("click", () => {
        openTelegramLoginPopup();
    });

    // Telegram login (when not logged in)
    setupTelegramWidget(authBar);
}

function bindEvents(container: HTMLElement, slug: string) {
    // Reply buttons
    container.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;

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

            const card = target.closest(".comment-card");
            if (!card) return;
            const formHtml = renderCommentForm(parentId, replyAuthor);
            card.insertAdjacentHTML("afterend", formHtml);

            const newForm = card.nextElementSibling as HTMLFormElement;
            newForm?.querySelector("textarea")?.focus();
            newForm?.querySelector(".cancel-reply-btn")?.addEventListener("click", () => {
                newForm.remove();
            });
            bindFormSubmit(newForm, slug, container);
        }
    });

    // Bind submit for main form
    const mainForm = container.querySelector<HTMLFormElement>(".comment-form[data-parent-id='']");
    if (mainForm) {
        bindFormSubmit(mainForm, slug, container);
    }
}

function bindFormSubmit(form: HTMLFormElement, slug: string, container: HTMLElement) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector<HTMLButtonElement>(".submit-btn");
        const errorEl = form.querySelector<HTMLElement>(".form-error");
        if (!submitBtn || !errorEl) return;

        const formData = new FormData(form);
        const content = (formData.get("content") as string)?.trim();
        const parentId = form.dataset.parentId || null;

        if (!content) {
            showError(errorEl, "请填写评论内容");
            return;
        }

        // Build post data based on auth state
        const postData: Record<string, string | null> = {
            slug,
            parent_id: parentId,
            content,
        };

        if (!currentUser) {
            // Anonymous: need author
            const author = (formData.get("author") as string)?.trim();
            if (!author) {
                showError(errorEl, "请填写昵称和评论内容");
                return;
            }
            postData.author = author;
            postData.email = (formData.get("email") as string)?.trim() || null;
            postData.website = (formData.get("website") as string)?.trim() || null;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "提交中...";
        hideError(errorEl);

        try {
            const result = await postComment(postData);

            if (result.error) {
                showError(errorEl, result.error);
                submitBtn.disabled = false;
                submitBtn.textContent = "发表评论";
                return;
            }

            await loadComments(container, slug);
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

async function loadComments(container: HTMLElement, slug: string) {
    container.innerHTML = '<p class="text-muted text-sm">加载评论中...</p>';

    try {
        const data = await fetchComments(slug);
        container.innerHTML = renderCommentList(data);
        bindEvents(container, slug);
        loadGravatars(container);
    } catch {
        container.innerHTML = '<p class="text-red-500 text-sm">评论加载失败</p>';
    }
}

async function initCommentSection() {
    const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
    const authBar = document.querySelector<HTMLElement>(AUTH_BAR_SELECTOR);
    if (!container) return;

    const slug = container.dataset.commentSlug;
    if (!slug) return;

    // Fetch auth state and render auth bar
    currentUser = await fetchCurrentUser();
    if (authBar) {
        authBar.innerHTML = renderAuthBar(currentUser);
        bindAuthBarEvents(authBar);
    }

    loadComments(container, slug);
}

// Init on load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommentSection, { once: true });
} else {
    initCommentSection();
}

// Re-init on Astro view transitions
window.addEventListener("astro:after-swap", initCommentSection);
