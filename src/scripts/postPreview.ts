type PostMeta = {
    title: string;
    description: string;
    image?: string;
};

type PostMetaMap = Record<string, PostMeta>;

const CARD_ID = "post-preview-card";

function parsePostIdFromHref(href: string): string | null {
    try {
        const url = new URL(href, window.location.origin);
        return url.pathname.replace(/^\/+/, "");
    } catch {
        return null;
    }
}

function ensurePreviewCard(): HTMLElement {
    let card = document.getElementById(CARD_ID);
    if (card) return card;

    card = document.createElement("div");
    card.id = CARD_ID;
    card.className =
        "fixed z-[60] w-72 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-lg opacity-0 pointer-events-none transition-all duration-300 ease-out";
    card.style.transform = "translateY(-8px) scale(0.96)";

    card.innerHTML = `
		<div class="h-40 w-full bg-muted-bg">
			<img id="${CARD_ID}-image" class="h-full w-full object-cover hidden" alt="" />
			<div id="${CARD_ID}-no-image" class="hidden h-full flex items-center justify-center text-xs text-muted">
				暂无预览图
			</div>
		</div>
		<div class="space-y-2 p-4 text-sm">
			<h5 id="${CARD_ID}-title" class="font-semibold text-primary"></h5>
			<p id="${CARD_ID}-description" class="text-secondary"></p>
		</div>
	`;

    document.body.appendChild(card);
    return card;
}

const imageCache = new Map<string, HTMLImageElement>();

function preloadImage(src: string): Promise<HTMLImageElement> {
    const cached = imageCache.get(src);
    if (cached) {
        return Promise.resolve(cached);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = src;
    });
}

function updatePreviewContent(card: HTMLElement, meta: PostMeta) {
    const imageEl = card.querySelector<HTMLImageElement>(`#${CARD_ID}-image`);
    const noImageEl = card.querySelector<HTMLDivElement>(`#${CARD_ID}-no-image`);
    const titleEl = card.querySelector<HTMLHeadingElement>(`#${CARD_ID}-title`);
    const descriptionEl = card.querySelector<HTMLParagraphElement>(`#${CARD_ID}-description`);

    if (titleEl) titleEl.textContent = meta.title ?? "";
    if (descriptionEl) descriptionEl.textContent = meta.description ?? "";

    if (meta.image && imageEl && noImageEl) {
        const imageSrc = meta.image;
        // Check if image is already cached/loaded
        if (imageCache.has(imageSrc)) {
            imageEl.src = imageSrc;
            imageEl.alt = `Preview of ${meta.title ?? ""}`;
            imageEl.classList.remove("hidden");
            noImageEl.classList.add("hidden");
        } else {
            // Show loading state while image loads
            imageEl.classList.add("hidden");
            noImageEl.classList.remove("hidden");
            noImageEl.textContent = "加载中...";

            preloadImage(imageSrc)
                .then(() => {
                    imageEl.src = imageSrc;
                    imageEl.alt = `Preview of ${meta.title ?? ""}`;
                    imageEl.classList.remove("hidden");
                    noImageEl.classList.add("hidden");
                })
                .catch(() => {
                    noImageEl.textContent = "暂无预览图";
                });
        }
    } else if (imageEl && noImageEl) {
        imageEl.classList.add("hidden");
        noImageEl.classList.remove("hidden");
        noImageEl.textContent = "暂无预览图";
    }
}

function showCard(card: HTMLElement, event: MouseEvent | FocusEvent) {
    card.style.opacity = "1";
    card.style.visibility = "visible";
    card.style.pointerEvents = "auto";
    card.style.transform = "translateY(0) scale(1)";
    updatePosition(card, event);
}

function hideCard(card: HTMLElement) {
    card.style.opacity = "0";
    card.style.visibility = "hidden";
    card.style.pointerEvents = "none";
    card.style.transform = "translateY(-8px) scale(0.96)";
}

function updatePosition(card: HTMLElement, event: MouseEvent | FocusEvent) {
    if (!(event instanceof MouseEvent)) return;

    const cardWidth = 300;
    const cardHeight = card.offsetHeight || 250;
    const offset = 20;

    let x = event.clientX + offset;
    let y = event.clientY - cardHeight / 2;

    if (x + cardWidth > window.innerWidth) {
        x = event.clientX - cardWidth - offset;
    }

    if (y < 0) y = 10;

    if (y + cardHeight > window.innerHeight) {
        y = window.innerHeight - cardHeight - 10;
    }

    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
}

export function initPostPreview(root: ParentNode = document) {
    // 跳过移动端/触摸环境，避免在小屏设备显示预览卡片
    // Coarse pointer 通常表示触摸设备；同时也屏蔽较小视口
    const isCoarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const isSmallViewport = window.matchMedia?.("(max-width: 1024px)").matches ?? false;
    if (isCoarse || isSmallViewport) return;
    const metaScript = document.getElementById("all-posts-meta");
    if (!metaScript || !metaScript.textContent) return;

    let metaMap: PostMetaMap;
    try {
        metaMap = JSON.parse(metaScript.textContent) as PostMetaMap;
    } catch {
        return;
    }

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).filter((link) => {
        if (!link.href) return false;
        // 排除目录与标记禁止预览的区域/链接
        if (link.closest("[data-no-preview]")) return false;
        if (link.closest(".toc")) return false;
        if (link.dataset.preview === "off") return false;
        // 排除站内锚点（如 TOC 链接）
        const rawHref = link.getAttribute("href") || "";
        if (rawHref.startsWith("#")) return false;
        const id = link.dataset.postId || parsePostIdFromHref(link.href);
        return !!(id && metaMap[id]);
    });

    if (links.length === 0) return;

    // Preload images for all posts to improve hover performance
    links.forEach((link) => {
        const id = link.dataset.postId || parsePostIdFromHref(link.href);
        if (id && metaMap[id]?.image) {
            // Use requestIdleCallback to preload images when browser is idle
            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(() => {
                    preloadImage(metaMap[id].image as string).catch(() => {
                        // Silently fail for preload errors
                    });
                });
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => {
                    preloadImage(metaMap[id].image as string).catch(() => {
                        // Silently fail for preload errors
                    });
                }, 100);
            }
        }
    });

    const previewCard = ensurePreviewCard();
    let hoverTimeout: number | null = null;

    const handleEnter = (event: Event) => {
        const target = event.currentTarget as HTMLAnchorElement;
        const id = target.dataset.postId || parsePostIdFromHref(target.href);
        if (!id || !metaMap[id]) return;

        if (hoverTimeout) window.clearTimeout(hoverTimeout);

        updatePreviewContent(previewCard, metaMap[id]);
        hoverTimeout = window.setTimeout(() => {
            showCard(previewCard, event as MouseEvent);
        }, 500);
    };

    const handleLeave = () => {
        if (hoverTimeout) {
            window.clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        hideCard(previewCard);
    };

    const handleMove = (event: MouseEvent) => {
        updatePosition(previewCard, event);
    };

    links.forEach((link) => {
        link.addEventListener("mouseenter", handleEnter);
        link.addEventListener("mouseleave", handleLeave);
        link.addEventListener("focus", handleEnter);
        link.addEventListener("blur", handleLeave);
        link.addEventListener("mousemove", handleMove);
    });
}
