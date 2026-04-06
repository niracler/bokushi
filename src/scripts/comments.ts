import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

// --- Client-side i18n ---

type CommentLocale = "zh" | "en";

let _cachedLocale: CommentLocale | null = null;
function getCommentLocale(): CommentLocale {
    if (_cachedLocale) return _cachedLocale;
    const lang = document.documentElement.lang;
    _cachedLocale = lang === "en" ? "en" : "zh";
    return _cachedLocale;
}

const commentUi: Record<CommentLocale, Record<string, string>> = {
    zh: {
        justNow: "刚刚",
        minutesAgo: "{n} 分钟前",
        hoursAgo: "{n} 小时前",
        daysAgo: "{n} 天前",
        adminBadge: "博主",
        deleted: "该评论已删除",
        pinnedComment: "置顶评论",
        pinBadge: "置顶",
        pinAction: "置顶",
        unpinAction: "取消置顶",
        editedAt: "已于 {time} 编辑",
        edited: "（已编辑）",
        editComment: "编辑评论",
        edit: "编辑",
        unpinComment: "取消置顶评论",
        pinComment: "置顶评论",
        replyTo: "回复 {name}",
        reply: "回复",
        editTimeRemaining: "剩余 {n} 分钟可编辑",
        editWindowClosed: "编辑窗口已关闭",
        editContent: "编辑评论内容",
        cancel: "取消",
        save: "保存",
        replyPlaceholder: "回复 {name}...",
        commentPlaceholder: "写下你的评论... 支持 Markdown",
        linkTelegram: "关联 Telegram",
        linkGitHub: "关联 GitHub",
        logout: "登出",
        namePlaceholder: "昵称 *",
        emailPlaceholder: "邮箱（选填，用于头像）",
        websitePlaceholder: "网站（选填）",
        or: "或",
        login: "登录",
        markdownSupported: "支持 Markdown 语法",
        submitReply: "回复",
        submitComment: "发表评论",
        commentCount: "{n} 条评论",
        sortLabel: "评论排序",
        sortLatest: "最新",
        sortOldest: "最早",
        emptyTitle: "还没有评论",
        emptySubtitle: "来发表第一条吧",
        contentEmpty: "内容不能为空",
        saving: "保存中...",
        saveFailed: "保存失败，请稍后重试",
        unpinning: "取消中...",
        pinning: "置顶中...",
        fillContent: "请填写评论内容",
        deletedCannotReply: "该评论已被删除，无法回复",
        fillNameAndContent: "请填写昵称和评论内容",
        submitting: "提交中...",
        submitFailed: "提交失败，请稍后重试",
        loadFailed: "评论加载失败",
        reload: "重新加载",
        loginFailed: "登录失败，请稍后重试",
        setEmail: "设置邮箱",
        editEmail: "修改邮箱",
        emailLabel: "通知邮箱",
        emailSaving: "保存中...",
        emailSaveFailed: "保存失败",
        emailPlaceholderNotify: "用于回复通知的邮箱",
        emailSent: "已通知",
        emailFailed: "通知失败",
        restore: "恢复",
        restoring: "恢复中...",
        deletedAdmin: "已删除",
        deleteComment: "删除",
        deleting: "删除中...",
    },
    en: {
        justNow: "just now",
        minutesAgo: "{n}m ago",
        hoursAgo: "{n}h ago",
        daysAgo: "{n}d ago",
        adminBadge: "Author",
        deleted: "This comment has been deleted",
        pinnedComment: "Pinned comment",
        pinBadge: "Pinned",
        pinAction: "Pin",
        unpinAction: "Unpin",
        editedAt: "Edited {time}",
        edited: "(edited)",
        editComment: "Edit comment",
        edit: "Edit",
        unpinComment: "Unpin comment",
        pinComment: "Pin comment",
        replyTo: "Reply to {name}",
        reply: "Reply",
        editTimeRemaining: "{n} min left to edit",
        editWindowClosed: "Edit window closed",
        editContent: "Edit comment content",
        cancel: "Cancel",
        save: "Save",
        replyPlaceholder: "Reply to {name}...",
        commentPlaceholder: "Write a comment... Markdown supported",
        linkTelegram: "Link Telegram",
        linkGitHub: "Link GitHub",
        logout: "Log out",
        namePlaceholder: "Name *",
        emailPlaceholder: "Email (optional, for avatar)",
        websitePlaceholder: "Website (optional)",
        or: "or",
        login: "Log in",
        markdownSupported: "Markdown supported",
        submitReply: "Reply",
        submitComment: "Post comment",
        commentCount: "{n} comments",
        sortLabel: "Sort comments",
        sortLatest: "Latest",
        sortOldest: "Oldest",
        emptyTitle: "No comments yet",
        emptySubtitle: "Be the first to comment",
        contentEmpty: "Content cannot be empty",
        saving: "Saving...",
        saveFailed: "Save failed, please try again",
        unpinning: "Unpinning...",
        pinning: "Pinning...",
        fillContent: "Please enter a comment",
        deletedCannotReply: "This comment has been deleted and cannot be replied to",
        fillNameAndContent: "Please enter your name and comment",
        submitting: "Submitting...",
        submitFailed: "Submit failed, please try again",
        loadFailed: "Failed to load comments",
        reload: "Reload",
        loginFailed: "Login failed, please try again",
        setEmail: "Set email",
        editEmail: "Edit email",
        emailLabel: "Notify email",
        emailSaving: "Saving...",
        emailSaveFailed: "Save failed",
        emailPlaceholderNotify: "Email for reply notifications",
        emailSent: "Notified",
        emailFailed: "Notify failed",
        restore: "Restore",
        restoring: "Restoring...",
        deletedAdmin: "Deleted",
        deleteComment: "Delete",
        deleting: "Deleting...",
    },
};

function ct(key: string, values?: Record<string, string | number>): string {
    const locale = getCommentLocale();
    let str = commentUi[locale][key] ?? commentUi.zh[key] ?? key;
    if (values) {
        for (const [k, v] of Object.entries(values)) {
            str = str.replace(`{${k}}`, String(v));
        }
    }
    return str;
}

// --- Types ---

interface CommentNode {
    id: string;
    author: string;
    gravatar_hash: string | null;
    website: string | null;
    content: string;
    status: string;
    created_at: string;
    updated_at?: string | null;
    is_pinned: boolean;
    user_id: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    email?: string | null;
    user_email?: string | null;
    email_notified?: string | null;
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

type CommentSort = "latest" | "oldest";

// --- State ---

let currentUser: AuthUser | null = null;
let currentSort: CommentSort = "latest";

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
    ],
    allowedAttributes: {
        a: ["href", "target", "rel"],
    },
};

function renderMarkdown(raw: string): string {
    const html = md.render(raw);
    return sanitizeHtml(html, SANITIZE_OPTIONS);
}

// --- Avatar helpers ---

/** Route external image through /api/image-proxy for CDN caching. */
function proxied(url: string): string {
    if (!url) return "";
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function gravatarUrl(hash: string | null): string {
    if (!hash) return "";
    return proxied(`https://www.gravatar.com/avatar/${hash}?d=404&s=48`);
}

/** Mask email for display: "lowbee.icu@outlook.com" → "low***@outlook.com" */
function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return "***";
    const visible = local.slice(0, Math.min(3, local.length));
    return `${visible}***@${domain}`;
}

function dicebearUrl(name: string): string {
    return proxied(
        `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`,
    );
}

function faviconUrl(website: string | null): string {
    if (!website) return "";
    try {
        const { hostname } = new URL(website);
        return proxied(`https://www.google.com/s2/favicons?domain=${hostname}&sz=48`);
    } catch {
        return "";
    }
}

function handleAvatarError(img: HTMLImageElement): void {
    const fallbackAttr = img.getAttribute("data-fallback") || "";
    const fallbacks = fallbackAttr.split(",").filter(Boolean);
    if (fallbacks.length === 0) {
        img.removeAttribute("onerror");
        return;
    }
    const next = fallbacks.shift();
    if (!next) {
        img.removeAttribute("onerror");
        return;
    }
    img.setAttribute("data-fallback", fallbacks.join(","));
    img.src = next;
    if (fallbacks.length === 0) {
        img.removeAttribute("onerror");
    }
}

declare global {
    interface Window {
        handleAvatarError: typeof handleAvatarError;
    }
}
window.handleAvatarError = handleAvatarError;

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

// --- API helpers ---

async function fetchComments(slug: string, sort: CommentSort): Promise<CommentsResponse> {
    const res = await fetch(
        `/api/comments?slug=${encodeURIComponent(slug)}&sort=${encodeURIComponent(sort)}`,
    );
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

async function editComment(
    id: string,
    content: string,
): Promise<{ success?: boolean; content?: string; updated_at?: string; error?: string }> {
    const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });
    return res.json();
}

async function setCommentPinned(
    id: string,
    pinned: boolean,
): Promise<{ success?: boolean; is_pinned?: boolean; error?: string }> {
    const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pin", pinned }),
    });
    return res.json();
}

async function setUserEmail(
    userId: string,
    email: string | null,
): Promise<{ success?: boolean; email?: string | null; error?: string }> {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return res.json();
}

async function setAnonEmail(
    author: string,
    website: string | null,
    email: string | null,
): Promise<{ success?: boolean; updated?: number; error?: string }> {
    const res = await fetch("/api/comments/email-batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, website: website || null, email }),
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

    if (diffMin < 1) return ct("justNow");
    if (diffMin < 60) return ct("minutesAgo", { n: diffMin });
    if (diffHour < 24) return ct("hoursAgo", { n: diffHour });
    if (diffDay < 30) return ct("daysAgo", { n: diffDay });

    const dateLocale = getCommentLocale() === "en" ? "en-US" : "zh-CN";
    return date.toLocaleDateString(dateLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// --- DOM rendering ---

const CONTAINER_SELECTOR = "#comment-section";

function createAuthorEl(comment: CommentNode): string {
    const name = escapeHtml(comment.author);
    const adminBadge = comment.is_admin
        ? ` <span class="comment-badge">${ct("adminBadge")}</span>`
        : "";

    if (comment.website && !comment.user_id) {
        const href = escapeHtml(comment.website);
        return `<a href="${href}" target="_blank" rel="nofollow noopener" class="comment-author comment-author--linked">${name}</a>${adminBadge}`;
    }
    return `<span class="comment-author">${name}</span>${adminBadge}`;
}

const _escapeDiv = document.createElement("div");
function escapeHtml(str: string): string {
    _escapeDiv.textContent = str;
    return _escapeDiv.innerHTML;
}

function renderCommentCard(comment: CommentNode, isReply = false, parentOverride?: string): string {
    const replyClass = isReply ? " comment-card--reply" : "";

    if (comment.status === "deleted") {
        const isAdminUser = currentUser?.role === "admin";
        if (!isAdminUser || !comment.content) {
            // Non-admin or no content: show placeholder
            return `
				<div class="comment-card comment-card--deleted${replyClass}">
					<p style="font-style:italic;font-size:var(--font-size-sm);color:var(--color-text-muted)">${ct("deleted")}</p>
				</div>`;
        }
        // Admin: show full content with restore option
        const deletedContent = renderMarkdown(comment.content);
        const authorEl = createAuthorEl(comment);
        const time = formatTime(comment.created_at);
        return `
			<div class="comment-card comment-card--deleted-admin${replyClass}" data-comment-id="${comment.id}">
				<div style="display:flex;gap:0.75rem">
					<div style="min-width:0;flex:1">
						<div class="comment-header">
							${authorEl}
							<span class="comment-badge" style="background:color-mix(in srgb, #ef4444 14%, transparent);color:#ef4444">${ct("deletedAdmin")}</span>
							<span class="comment-time-sep" style="color:var(--color-text-muted);opacity:0.4">·</span>
							<time class="comment-time" datetime="${comment.created_at}">${time}</time>
						</div>
						<div class="comment-body" style="opacity:0.5">${deletedContent}</div>
						<div class="comment-actions">
							<button class="comment-restore-btn" data-restore-id="${comment.id}">${ct("restore")}</button>
						</div>
					</div>
				</div>
			</div>`;
    }

    let avatarSrc: string;
    let fallbacks: string[];

    if (comment.avatar_url) {
        // OAuth user
        avatarSrc = proxied(comment.avatar_url);
        fallbacks = [dicebearUrl(comment.author)];
    } else if (comment.gravatar_hash) {
        // Anonymous with email
        avatarSrc = gravatarUrl(comment.gravatar_hash);
        fallbacks = [faviconUrl(comment.website), dicebearUrl(comment.author)].filter(
            Boolean,
        ) as string[];
    } else if (comment.website) {
        // Anonymous with website only
        avatarSrc = faviconUrl(comment.website);
        fallbacks = [dicebearUrl(comment.author)];
    } else {
        // No identity info
        avatarSrc = dicebearUrl(comment.author);
        fallbacks = [];
    }

    const onerrorAttr =
        fallbacks.length > 0
            ? ` onerror="handleAvatarError(this)" data-fallback="${fallbacks.join(",")}"`
            : "";

    const authorEl = createAuthorEl(comment);
    const pinBadge =
        !isReply && comment.is_pinned
            ? `<span class="comment-pin-badge" title="${ct("pinnedComment")}">${ct("pinBadge")}</span>`
            : "";
    const time = formatTime(comment.created_at);
    const contentHtml = renderMarkdown(comment.content);
    const avatarClass = isReply ? "comment-avatar--sm" : "comment-avatar--md";
    const replyParent = parentOverride || comment.id;

    const isEditableByCurrentUser =
        currentUser && comment.user_id === currentUser.id && comment.status !== "deleted";
    const isAdminUser = currentUser?.role === "admin";
    const isPinEditable = !isReply && Boolean(isAdminUser) && comment.status !== "deleted";
    const editedIndicator = comment.updated_at
        ? `<span class="comment-edited-indicator" title="${ct("editedAt", { time: formatTime(comment.updated_at) })}">${ct("edited")}</span>`
        : "";
    const editBtn = isEditableByCurrentUser
        ? `<button
							class="edit-btn comment-edit-btn"
							data-edit-id="${comment.id}"
							data-edit-content="${escapeHtml(comment.content)}"
							data-created-at="${comment.created_at}"
							aria-label="${ct("editComment")}"
						>
							${ct("edit")}
						</button>`
        : "";
    const pinBtn = isPinEditable
        ? `<button
							class="comment-pin-btn"
							data-pin-id="${comment.id}"
							data-pin-state="${comment.is_pinned ? "1" : "0"}"
							aria-label="${comment.is_pinned ? ct("unpinComment") : ct("pinComment")}"
						>
							${comment.is_pinned ? ct("unpinAction") : ct("pinAction")}
						</button>`
        : "";

    const deleteBtn =
        Boolean(isAdminUser) && comment.status !== "deleted"
            ? `<button class="comment-delete-btn" data-delete-id="${comment.id}">${ct("deleteComment")}</button>`
            : "";

    // Admin-only: email management for OAuth users (excluding self) and anonymous commenters
    const isOAuthOther = comment.user_id && comment.user_id !== currentUser?.id;
    const isAnon = !comment.user_id;
    const isEmailEditable =
        Boolean(isAdminUser) && (isOAuthOther || isAnon) && comment.status !== "deleted";

    // Admin email: split into header badge (masked address) and action button
    let emailBadge = "";
    let emailBtn = "";
    if (isEmailEditable) {
        const hasEmail = comment.user_id ? comment.user_email : comment.email;
        if (hasEmail) {
            emailBadge = `<span class="comment-email-display" title="${ct("emailLabel")}">${maskEmail(hasEmail)}</span>`;
        }
        if (comment.user_id) {
            emailBtn = `<button class="comment-email-btn" data-email-user="${comment.user_id}" data-email-current="${escapeHtml(comment.user_email || "")}">${hasEmail ? ct("editEmail") : ct("setEmail")}</button>`;
        } else {
            emailBtn = `<button class="comment-email-btn" data-email-anon="1" data-email-author="${escapeHtml(comment.author)}" data-email-website="${escapeHtml(comment.website || "")}" data-email-current="${escapeHtml(comment.email || "")}">${hasEmail ? ct("editEmail") : ct("setEmail")}</button>`;
        }
    }

    return `
		<div class="comment-card${replyClass}" data-comment-id="${comment.id}">
			<div style="display:flex;gap:0.75rem">
				<img
					src="${avatarSrc}"
					alt=""
					class="comment-avatar ${avatarClass}"
					loading="lazy"${onerrorAttr}
				/>
				<div style="min-width:0;flex:1">
					<div class="comment-header">
						${authorEl}
						${pinBadge}
						${emailBadge ? `<span class="comment-time-sep" style="color:var(--color-text-muted);opacity:0.4">·</span>${emailBadge}` : ""}
						<span class="comment-time-sep" style="color:var(--color-text-muted);opacity:0.4">·</span>
						<time class="comment-time" datetime="${comment.created_at}">${time}</time>
						${editedIndicator}
						${comment.email_notified === "sent" ? `<span class="comment-email-sent" title="${ct("emailSent")}">✉</span>` : ""}${comment.email_notified === "failed" ? `<span class="comment-email-failed" title="${ct("emailFailed")}">✉</span>` : ""}
					</div>
					<div class="comment-body" data-comment-body="${comment.id}">
						${contentHtml}
					</div>
					<div class="comment-actions">
						<button
							class="reply-btn comment-reply-btn"
							data-reply-to="${comment.id}"
							data-reply-author="${escapeHtml(comment.author)}"
							data-reply-parent="${replyParent}"
							aria-label="${ct("replyTo", { name: escapeHtml(comment.author) })}"
						>
							${ct("reply")}
						</button>
						${pinBtn}
						${editBtn}
						${emailBtn}
						${deleteBtn}
					</div>
				</div>
			</div>
		</div>`;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function renderEditForm(commentId: string, originalContent: string, createdAt: string): string {
    const remaining = Math.max(0, EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime()));
    const remainingMin = Math.ceil(remaining / 60000);
    const timeHint =
        remaining > 0 ? ct("editTimeRemaining", { n: remainingMin }) : ct("editWindowClosed");

    return `
		<div class="comment-edit-form" data-edit-form="${commentId}">
			<textarea
				class="comment-input comment-edit-textarea"
				rows="4"
				maxlength="5000"
				aria-label="${ct("editContent")}"
			>${escapeHtml(originalContent)}</textarea>
			<div class="comment-edit-footer">
				<span class="comment-form-hint">${timeHint}</span>
				<div class="comment-form-actions">
					<button type="button" class="comment-cancel-btn comment-edit-cancel" data-edit-id="${commentId}">${ct("cancel")}</button>
					<button type="button" class="comment-submit-btn comment-edit-save" data-edit-id="${commentId}">${ct("save")}</button>
				</div>
			</div>
			<p class="comment-error comment-edit-error" role="alert" style="display:none"></p>
		</div>`;
}

// Unified comment form: auth is integrated, not separate
function renderCommentForm(parentId?: string, replyAuthor?: string): string {
    const prefix = replyAuthor ? `@${replyAuthor} ` : "";
    const formClass = parentId ? "comment-form comment-form--reply" : "comment-form";
    const cancelBtn = parentId
        ? `<button type="button" class="cancel-reply-btn comment-cancel-btn">${ct("cancel")}</button>`
        : "";

    const placeholder = parentId
        ? ct("replyPlaceholder", { name: replyAuthor || "" })
        : ct("commentPlaceholder");

    // Logged-in: show user bar above textarea
    // Not logged in: show identity fields + login links in footer
    let userBar = "";
    let identityFields = "";
    let loginHint = "";

    if (currentUser) {
        const avatarSrc = currentUser.avatar_url
            ? escapeHtml(proxied(currentUser.avatar_url))
            : proxied("https://www.gravatar.com/avatar/?d=mp&s=48");
        const adminBadge =
            currentUser.role === "admin" ? ` <span class="comment-badge">Admin</span>` : "";

        const linkButtons: string[] = [];
        if (!currentUser.linkedProviders.includes("telegram")) {
            linkButtons.push(
                `<button class="link-telegram-btn comment-inline-action">${ct("linkTelegram")}</button>`,
            );
        }
        if (!currentUser.linkedProviders.includes("github")) {
            linkButtons.push(
                `<a href="/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}" class="comment-inline-action">${ct("linkGitHub")}</a>`,
            );
        }
        const linkSection =
            linkButtons.length > 0
                ? `<span class="comment-inline-sep">·</span>${linkButtons.join('<span class="comment-inline-sep">·</span>')}`
                : "";

        userBar = `
            <div class="comment-user-bar">
                <img src="${avatarSrc}" alt="" />
                <div class="user-meta">
                    <span class="user-name">${escapeHtml(currentUser.name)}</span>
                    ${adminBadge}
                    <span class="comment-inline-sep">·</span>
                    <button class="logout-btn comment-inline-action comment-inline-action--danger">${ct("logout")}</button>
                    ${linkSection}
                </div>
            </div>`;
    } else {
        identityFields = `
            <div class="comment-form-fields">
                <input type="text" name="author" placeholder="${ct("namePlaceholder")}" required maxlength="50" class="comment-input" />
                <input type="email" name="email" placeholder="${ct("emailPlaceholder")}" maxlength="200" class="comment-input" />
                <input type="url" name="website" placeholder="${ct("websitePlaceholder")}" maxlength="200" class="comment-input" />
            </div>`;

        // Small inline login links in the footer
        const redirect = encodeURIComponent(window.location.pathname);
        loginHint = `
            <span class="comment-login-hint">
                <span class="comment-login-hint-text">${ct("or")}</span>
                <a href="/api/auth/github?redirect=${redirect}" class="comment-login-link">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    GitHub
                </a>
                <div id="telegram-login-container" style="display:inline-flex;align-items:center">
                    <button id="telegram-login-btn" class="comment-login-link">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        Telegram
                    </button>
                </div>
                <span class="comment-login-hint-text">${ct("login")}</span>
            </span>`;
    }

    return `
		<form class="${formClass}" data-parent-id="${parentId || ""}">
			${userBar}
			${identityFields}
			<textarea
				name="content"
				placeholder="${escapeHtml(placeholder)}"
				required
				maxlength="5000"
				rows="${parentId ? "3" : "4"}"
				class="comment-input"
				style="margin-top:var(--space-3)"
			>${prefix}</textarea>
			<div class="comment-form-footer">
				<span class="comment-form-hint">${ct("markdownSupported")}</span>
				<div class="comment-form-actions">
					${loginHint}
					${cancelBtn}
					<button type="submit" class="submit-btn comment-submit-btn">${parentId ? ct("submitReply") : ct("submitComment")}</button>
				</div>
			</div>
			<p class="form-error comment-error" role="alert" style="display:none"></p>
		</form>`;
}

function renderLoadingSkeleton(): string {
    return `
		<div class="comment-skeleton" aria-busy="true" aria-label="Loading comments">
			<div class="comment-skeleton-item">
				<div class="comment-skeleton-avatar"></div>
				<div class="comment-skeleton-content">
					<div class="comment-skeleton-line comment-skeleton-line--short"></div>
					<div class="comment-skeleton-line comment-skeleton-line--long"></div>
					<div class="comment-skeleton-line comment-skeleton-line--medium"></div>
				</div>
			</div>
			<div class="comment-skeleton-item">
				<div class="comment-skeleton-avatar"></div>
				<div class="comment-skeleton-content">
					<div class="comment-skeleton-line comment-skeleton-line--short"></div>
					<div class="comment-skeleton-line comment-skeleton-line--medium"></div>
				</div>
			</div>
			<div class="comment-skeleton-item">
				<div class="comment-skeleton-avatar"></div>
				<div class="comment-skeleton-content">
					<div class="comment-skeleton-line comment-skeleton-line--short"></div>
					<div class="comment-skeleton-line comment-skeleton-line--long"></div>
				</div>
			</div>
		</div>`;
}

function renderSortToolbar(total: number): string {
    const latestActive = currentSort === "latest" ? " comment-sort-btn--active" : "";
    const oldestActive = currentSort === "oldest" ? " comment-sort-btn--active" : "";

    return `
		<div class="comment-toolbar">
			<div class="comment-count">${ct("commentCount", { n: total })}</div>
			<div class="comment-sort" role="group" aria-label="${ct("sortLabel")}">
				<button type="button" class="comment-sort-btn${latestActive}" data-sort="latest">${ct("sortLatest")}</button>
				<button type="button" class="comment-sort-btn${oldestActive}" data-sort="oldest">${ct("sortOldest")}</button>
			</div>
		</div>`;
}

function renderCommentList(data: CommentsResponse): string {
    if (data.comments.length === 0) {
        return `
			${renderSortToolbar(data.total)}
			<div class="comment-empty">
				<div class="comment-empty-illustration">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
				</div>
				<p class="comment-empty-title">${ct("emptyTitle")}</p>
				<p class="comment-empty-subtitle">${ct("emptySubtitle")}</p>
			</div>
			${renderCommentForm()}`;
    }

    let html = renderSortToolbar(data.total);
    html += '<div class="comment-list">';
    for (let i = 0; i < data.comments.length; i++) {
        const comment = data.comments[i];
        html += `<div class="comment-thread" style="--thread-index:${i}">`;
        html += renderCommentCard(comment);
        if (comment.replies.length > 0) {
            html += '<div class="comment-replies">';
            for (const reply of comment.replies) {
                html += renderCommentCard(reply, true, comment.id);
            }
            html += "</div>";
        }
        html += "</div>";
    }
    html += "</div>";
    html += renderCommentForm();
    return html;
}

// --- Telegram Widget ---

declare global {
    interface Window {
        onTelegramAuth: (user: Record<string, unknown>) => void;
    }
}

function setupTelegramWidget(container: HTMLElement) {
    const loginBtn = container.querySelector("#telegram-login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            openTelegramLoginPopup();
        });
    }
}

function openTelegramLoginPopup() {
    const widgetContainer = document.getElementById("telegram-login-container");
    if (!widgetContainer) return;

    widgetContainer.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "tomoko_aibot");
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
            console.error("Telegram link failed:", data.error || "关联失败");
        }
    } catch {
        console.error("Telegram link failed");
    }
}

window.onTelegramAuth = (user: Record<string, unknown>) => {
    if (currentUser) {
        handleTelegramLink(user);
    } else {
        handleTelegramAuth(user);
    }
};

// --- Event handling ---

function bindFormAuthEvents(container: HTMLElement) {
    // Logout button (inside form user bar)
    container.querySelector(".logout-btn")?.addEventListener("click", async () => {
        const ok = await logout();
        if (ok) {
            currentUser = null;
            window.location.reload();
        }
    });

    // Link Telegram button
    container.querySelector(".link-telegram-btn")?.addEventListener("click", () => {
        openTelegramLoginPopup();
    });

    // Telegram login button (inside form footer)
    setupTelegramWidget(container);
}

function bindEditEvents(container: HTMLElement) {
    if (container.dataset.editEventsBound === "true") {
        return;
    }
    container.dataset.editEventsBound = "true";

    container.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;

        // Open edit form
        if (target.classList.contains("edit-btn")) {
            e.preventDefault();
            const commentId = target.dataset.editId ?? "";
            const originalContent = target.dataset.editContent ?? "";
            const createdAt = target.dataset.createdAt ?? "";

            // Remove any existing edit form for this comment
            container.querySelector(`[data-edit-form="${commentId}"]`)?.remove();

            const bodyEl = container.querySelector(`[data-comment-body="${commentId}"]`);
            if (!bodyEl) return;

            bodyEl.insertAdjacentHTML(
                "afterend",
                renderEditForm(commentId, originalContent, createdAt),
            );
            const form = container.querySelector(`[data-edit-form="${commentId}"]`);
            (form?.querySelector(".comment-edit-textarea") as HTMLTextAreaElement)?.focus();
            return;
        }

        // Cancel edit
        if (target.classList.contains("comment-edit-cancel")) {
            e.preventDefault();
            const commentId = target.dataset.editId ?? "";
            container.querySelector(`[data-edit-form="${commentId}"]`)?.remove();
            return;
        }

        // Save edit
        if (target.classList.contains("comment-edit-save")) {
            e.preventDefault();
            const commentId = target.dataset.editId ?? "";
            const form = container.querySelector(`[data-edit-form="${commentId}"]`);
            if (!form) return;

            const textarea = form.querySelector<HTMLTextAreaElement>(".comment-edit-textarea");
            const errorEl = form.querySelector<HTMLElement>(".comment-edit-error");
            const saveBtn = target as HTMLButtonElement;
            if (!textarea || !errorEl) return;

            const newContent = textarea.value.trim();
            if (!newContent) {
                errorEl.textContent = ct("contentEmpty");
                errorEl.style.display = "block";
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = ct("saving");
            errorEl.style.display = "none";

            try {
                const result = await editComment(commentId, newContent);
                if (result.error) {
                    errorEl.textContent = result.error;
                    errorEl.style.display = "block";
                    saveBtn.disabled = false;
                    saveBtn.textContent = ct("save");
                    return;
                }

                // Update the comment body in-place
                const bodyEl = container.querySelector(`[data-comment-body="${commentId}"]`);
                if (bodyEl) {
                    bodyEl.innerHTML = renderMarkdown(newContent);
                }

                // Update edit button's data-edit-content for future edits
                const editBtn = container.querySelector<HTMLButtonElement>(
                    `.edit-btn[data-edit-id="${commentId}"]`,
                );
                if (editBtn) {
                    editBtn.dataset.editContent = newContent;
                }

                // Add/update edited indicator in header
                const card = container.querySelector(`[data-comment-id="${commentId}"]`);
                if (card && result.updated_at) {
                    const existing = card.querySelector(".comment-edited-indicator");
                    const indicator = `<span class="comment-edited-indicator" title="${ct("editedAt", { time: formatTime(result.updated_at) })}">${ct("edited")}</span>`;
                    if (existing) {
                        existing.outerHTML = indicator;
                    } else {
                        card.querySelector(".comment-header")?.insertAdjacentHTML(
                            "beforeend",
                            indicator,
                        );
                    }
                }

                // Remove edit form
                form.remove();
            } catch {
                errorEl.textContent = ct("saveFailed");
                errorEl.style.display = "block";
                saveBtn.disabled = false;
                saveBtn.textContent = ct("save");
            }
        }
    });
}

function bindModerationEvents(container: HTMLElement, slug: string) {
    if (container.dataset.moderationEventsBound === "true") {
        return;
    }
    container.dataset.moderationEventsBound = "true";

    container.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;

        // Handle pin button
        const pinBtn = target.closest<HTMLButtonElement>(".comment-pin-btn");
        if (pinBtn) {
            e.preventDefault();
            const commentId = pinBtn.dataset.pinId ?? "";
            const currentlyPinned = pinBtn.dataset.pinState === "1";

            pinBtn.disabled = true;
            pinBtn.textContent = currentlyPinned ? ct("unpinning") : ct("pinning");

            try {
                const result = await setCommentPinned(commentId, !currentlyPinned);
                if (result.error) {
                    console.error("Pin failed:", result.error);
                    pinBtn.disabled = false;
                    pinBtn.textContent = currentlyPinned ? ct("unpinAction") : ct("pinAction");
                    return;
                }

                await loadComments(container, slug);
            } catch {
                console.error("Pin operation failed");
                pinBtn.disabled = false;
                pinBtn.textContent = currentlyPinned ? ct("unpinAction") : ct("pinAction");
            }
            return;
        }

        // Handle email button — toggle inline email input (OAuth or anonymous)
        const emailBtn = target.closest<HTMLButtonElement>(".comment-email-btn");
        if (emailBtn) {
            e.preventDefault();
            const isAnon = emailBtn.dataset.emailAnon === "1";
            const userId = emailBtn.dataset.emailUser ?? "";
            const anonAuthor = emailBtn.dataset.emailAuthor ?? "";
            const anonWebsite = emailBtn.dataset.emailWebsite ?? "";
            const currentEmail = emailBtn.dataset.emailCurrent ?? "";
            const actionsDiv = emailBtn.closest(".comment-actions");
            if (!actionsDiv) return;

            // Remove any existing email form
            actionsDiv.querySelector(".comment-email-form")?.remove();

            const formHtml = `<div class="comment-email-form" style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;width:100%">
                <input type="email" class="comment-email-input" value="${currentEmail}" placeholder="${ct("emailPlaceholderNotify")}" style="flex:1;padding:4px 8px;border:1px solid var(--color-border);border-radius:4px;font-size:13px;background:var(--color-bg-surface);color:var(--color-text-primary)">
                <button class="comment-email-save" style="padding:4px 12px;font-size:13px;border-radius:4px;background:var(--color-text-primary);color:var(--color-bg-surface);border:none;cursor:pointer">${ct("save")}</button>
                <button class="comment-email-cancel" style="padding:4px 8px;font-size:13px;cursor:pointer;background:none;border:none;color:var(--color-text-muted)">${ct("cancel")}</button>
            </div>`;
            actionsDiv.insertAdjacentHTML("beforeend", formHtml);

            const input = actionsDiv.querySelector<HTMLInputElement>(".comment-email-input");
            input?.focus();

            // Save handler — dispatch to the right API
            const saveBtn = actionsDiv.querySelector<HTMLButtonElement>(".comment-email-save");
            saveBtn?.addEventListener("click", async () => {
                const email = input?.value.trim() || null;
                saveBtn.disabled = true;
                saveBtn.textContent = ct("emailSaving");

                try {
                    const result = isAnon
                        ? await setAnonEmail(anonAuthor, anonWebsite || null, email)
                        : await setUserEmail(userId, email);
                    if (result.error) {
                        console.error("Email save failed:", result.error);
                        saveBtn.textContent = ct("emailSaveFailed");
                        saveBtn.disabled = false;
                        return;
                    }
                    await loadComments(container, slug);
                } catch {
                    saveBtn.textContent = ct("emailSaveFailed");
                    saveBtn.disabled = false;
                }
            });

            // Cancel handler
            actionsDiv.querySelector(".comment-email-cancel")?.addEventListener("click", () => {
                actionsDiv.querySelector(".comment-email-form")?.remove();
            });

            return;
        }

        // Handle delete button (soft delete)
        const deleteBtn = target.closest<HTMLButtonElement>(".comment-delete-btn");
        if (deleteBtn) {
            e.preventDefault();
            const commentId = deleteBtn.dataset.deleteId ?? "";
            deleteBtn.disabled = true;
            deleteBtn.textContent = ct("deleting");

            try {
                const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
                if (res.ok) {
                    await loadComments(container, slug);
                } else {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = ct("deleteComment");
                }
            } catch {
                deleteBtn.disabled = false;
                deleteBtn.textContent = ct("deleteComment");
            }
            return;
        }

        // Handle restore button (un-delete)
        const restoreBtn = target.closest<HTMLButtonElement>(".comment-restore-btn");
        if (restoreBtn) {
            e.preventDefault();
            const commentId = restoreBtn.dataset.restoreId ?? "";
            restoreBtn.disabled = true;
            restoreBtn.textContent = ct("restoring");

            try {
                const res = await fetch(`/api/comments/${commentId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "visible" }),
                });
                if (res.ok) {
                    await loadComments(container, slug);
                } else {
                    restoreBtn.disabled = false;
                    restoreBtn.textContent = ct("restore");
                }
            } catch {
                restoreBtn.disabled = false;
                restoreBtn.textContent = ct("restore");
            }
            return;
        }
    });
}

function bindEvents(container: HTMLElement, slug: string) {
    if (container.dataset.eventsBound !== "true") {
        container.dataset.eventsBound = "true";

        // Reply + sort actions (delegated)
        container.addEventListener("click", async (e) => {
            const target = e.target as HTMLElement;

            const sortBtn = target.closest<HTMLButtonElement>(".comment-sort-btn");
            if (sortBtn) {
                e.preventDefault();
                const nextSort = sortBtn.dataset.sort === "oldest" ? "oldest" : "latest";
                if (nextSort === currentSort) return;
                currentSort = nextSort;
                await loadComments(container, slug);
                return;
            }

            const replyBtn = target.closest<HTMLButtonElement>(".reply-btn");
            if (!replyBtn) return;

            e.preventDefault();
            const parentId = replyBtn.dataset.replyParent ?? "";
            const replyTo = replyBtn.dataset.replyTo ?? "";
            const replyAuthor = replyBtn.dataset.replyAuthor ?? "";

            for (const f of container.querySelectorAll(
                ".comment-form[data-parent-id]:not([data-parent-id=''])",
            )) {
                f.remove();
            }

            const card = replyBtn.closest(".comment-card");
            if (!card) return;
            const formHtml = renderCommentForm(parentId, replyAuthor);

            const thread = card.closest(".comment-thread");
            const insertTarget = thread || card;
            insertTarget.insertAdjacentHTML("afterend", formHtml);

            // Store the actual reply target (may differ from parent_id for nested replies)
            const newFormEl = insertTarget.nextElementSibling as HTMLFormElement;
            if (newFormEl && replyTo !== parentId) {
                newFormEl.dataset.replyTo = replyTo;
            }

            const newForm = insertTarget.nextElementSibling as HTMLFormElement;
            newForm?.querySelector("textarea")?.focus();
            newForm?.querySelector(".cancel-reply-btn")?.addEventListener("click", () => {
                newForm.remove();
            });
            bindFormSubmit(newForm, slug, container);
            bindFormAuthEvents(newForm);
        });
    }

    // Bind submit + auth events for main form
    const mainForm = container.querySelector<HTMLFormElement>(".comment-form[data-parent-id='']");
    if (mainForm) {
        bindFormSubmit(mainForm, slug, container);
        bindFormAuthEvents(mainForm);
    }

    // Bind edit events (only relevant when user is logged in)
    if (currentUser) {
        bindEditEvents(container);
        if (currentUser.role === "admin") {
            bindModerationEvents(container, slug);
        }
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
            showError(errorEl, ct("fillContent"));
            return;
        }

        if (parentId) {
            const parentCard = container.querySelector(`[data-comment-id="${parentId}"]`);
            if (!parentCard) {
                showError(errorEl, ct("deletedCannotReply"));
                return;
            }
        }

        const replyTo = form.dataset.replyTo || null;
        const postData: Record<string, string | null> = {
            slug,
            parent_id: parentId,
            content,
            post_title: document.title,
            ...(replyTo ? { reply_to: replyTo } : {}),
        };

        if (!currentUser) {
            const author = (formData.get("author") as string)?.trim();
            if (!author) {
                showError(errorEl, ct("fillNameAndContent"));
                return;
            }
            postData.author = author;
            postData.email = (formData.get("email") as string)?.trim() || null;
            postData.website = (formData.get("website") as string)?.trim() || null;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = ct("submitting");
        hideError(errorEl);

        try {
            const result = await postComment(postData);

            if (result.error) {
                showError(errorEl, result.error);
                submitBtn.disabled = false;
                submitBtn.textContent = parentId ? ct("submitReply") : ct("submitComment");
                return;
            }

            await loadComments(container, slug);
        } catch {
            showError(errorEl, ct("submitFailed"));
            submitBtn.disabled = false;
            submitBtn.textContent = parentId ? ct("submitReply") : ct("submitComment");
        }
    });
}

function showError(el: HTMLElement, msg: string) {
    el.textContent = msg;
    el.style.display = "block";
}

function hideError(el: HTMLElement) {
    el.textContent = "";
    el.style.display = "none";
}

// --- Main init ---

async function loadComments(container: HTMLElement, slug: string) {
    container.innerHTML = renderLoadingSkeleton();

    try {
        const data = await fetchComments(slug, currentSort);
        container.innerHTML = renderCommentList(data);
        bindEvents(container, slug);
    } catch {
        container.innerHTML =
            '<div style="text-align:center;padding:var(--space-4)">' +
            `<p style="font-size:var(--font-size-sm);color:var(--color-danger);margin:0 0 var(--space-3)">${ct("loadFailed")}</p>` +
            `<button type="button" class="comment-retry-btn" style="font-size:var(--font-size-sm);padding:var(--space-2) var(--space-4);border:1px solid var(--color-border-soft);border-radius:var(--radius-md);background:var(--color-bg-surface);color:var(--color-text-secondary);cursor:pointer">${ct("reload")}</button>` +
            "</div>";
        container.querySelector(".comment-retry-btn")?.addEventListener("click", () => {
            loadComments(container, slug);
        });
    }
}

async function initCommentSection() {
    const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
    if (!container) return;

    const slug = container.dataset.commentSlug;
    if (!slug) return;

    // Show auth error toast if redirected back with an error param
    const pageUrl = new URL(window.location.href);
    const authError = pageUrl.searchParams.get("auth_error");
    if (authError) {
        const errorEl = document.createElement("p");
        errorEl.className = "comment-error";
        errorEl.textContent = ct("loginFailed");
        errorEl.style.display = "block";
        container.insertAdjacentElement("afterbegin", errorEl);
        pageUrl.searchParams.delete("auth_error");
        history.replaceState(null, "", pageUrl.toString());
    }

    // Fetch auth state before rendering (auth is integrated into the form)
    currentUser = await fetchCurrentUser();
    loadComments(container, slug);
}

export { initCommentSection };
