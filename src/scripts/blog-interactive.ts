/**
 * 博客文章交互功能
 * 包含：响应式表格、TOC 目录、移动端抽屉等
 */

// ============ Timing Utilities ============
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timeoutId: number | null = null;
    return ((...args: unknown[]) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    }) as T;
}

function throttle<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timeoutId: number | null = null;
    return ((...args: unknown[]) => {
        if (timeoutId !== null) return;
        timeoutId = window.setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    }) as T;
}

// ============ 响应式表格处理 ============
function unwrapCardCells(table: HTMLTableElement) {
    const cardCells = table.querySelectorAll("[data-cardified]");

    for (const cell of cardCells) {
        const wrapper = cell.querySelector(".table-card-value");
        if (wrapper) {
            while (wrapper.firstChild) {
                cell.insertBefore(wrapper.firstChild, wrapper);
            }
            wrapper.remove();
        }
        cell.removeAttribute("data-cardified");
        cell.removeAttribute("data-label");
    }
}

function applyResponsiveTables() {
    const tables = document.querySelectorAll<HTMLTableElement>(".prose table");

    for (const table of tables) {
        const headers = Array.from(table.querySelectorAll("thead th")).map((th) => {
            return (th.textContent || "").trim();
        });

        const rows = Array.from(table.querySelectorAll("tbody tr"));
        const hasBodyRows = rows.length > 0;
        const columnThreshold = 3;
        const hasWideHeader = headers.length > columnThreshold;
        const hasWideRow = rows.some((row) => {
            return row.querySelectorAll("td, th").length > columnThreshold;
        });
        const shouldCardify = headers.length > 0 && hasBodyRows && (hasWideHeader || hasWideRow);

        table.setAttribute("data-card-mode", shouldCardify ? "cards" : "table");

        if (!shouldCardify) {
            unwrapCardCells(table);
            continue;
        }

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("td, th"));

            cells.forEach((cell, index) => {
                const label = headers[index] || "";
                if (label.length === 0) {
                    cell.removeAttribute("data-label");
                    return;
                }
                cell.setAttribute("data-label", label);
                if (!cell.hasAttribute("data-cardified")) {
                    const valueWrapper = document.createElement("div");
                    valueWrapper.classList.add("table-card-value");
                    while (cell.firstChild) {
                        valueWrapper.appendChild(cell.firstChild);
                    }
                    cell.appendChild(valueWrapper);
                    cell.setAttribute("data-cardified", "true");
                }
            });
        }
    }
}

// ============ Iframe 嵌入处理 ============
function handleEmbedIframes() {
    const iframes = document.querySelectorAll('iframe[data-testid="embed-iframe"]');

    for (const iframe of iframes) {
        const iframeElement = iframe as HTMLIFrameElement;

        // Skip if already processed
        if (iframeElement.dataset.embedProcessed === "true") continue;
        iframeElement.dataset.embedProcessed = "true";

        let hasLoaded = false;
        let timeoutId: number;

        // Wrap in container for smooth transitions
        if (!iframeElement.parentElement?.classList.contains("embed-wrapper")) {
            const wrapper = document.createElement("div");
            wrapper.className = "embed-wrapper";
            wrapper.style.cssText =
                "transition: max-height 0.4s ease, opacity 0.4s ease; overflow: hidden;";
            iframeElement.parentNode?.insertBefore(wrapper, iframeElement);
            wrapper.appendChild(iframeElement);
        }

        const wrapper = iframeElement.parentElement as HTMLElement;

        // Handle successful load
        const handleLoad = () => {
            hasLoaded = true;
            clearTimeout(timeoutId);
            wrapper.style.maxHeight = "";
            wrapper.style.opacity = "1";
        };

        iframeElement.addEventListener("load", handleLoad, { once: true });

        // Timeout: collapse if not loaded within 5 seconds
        timeoutId = window.setTimeout(() => {
            if (!hasLoaded) {
                wrapper.style.maxHeight = "0";
                wrapper.style.opacity = "0";
                wrapper.style.marginBottom = "0";
                setTimeout(() => {
                    wrapper.style.display = "none";
                }, 400);
            }
        }, 5000);
    }
}

// ============ TOC 目录高亮 ============
let currentTocCleanup: (() => void) | null = null;

function initTocObserver() {
    // 清理之前的 observer
    if (currentTocCleanup) {
        currentTocCleanup();
        currentTocCleanup = null;
    }

    const tocLinks = document.querySelectorAll("[data-toc-link]");
    if (tocLinks.length === 0) return;

    const headingElements = Array.from(tocLinks)
        .map((link) => {
            const id = link.getAttribute("data-heading-id");
            return id ? document.getElementById(id) : null;
        })
        .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) return;

    // 追踪所有当前可见的标题
    const visibleHeadings = new Set<string>();

    const observerOptions = {
        rootMargin: "-100px 0px -66% 0px",
        threshold: [0, 1],
    };

    const setActiveLink = (id: string) => {
        // 移除所有 active 类（包含桌面与移动端两个 TOC）
        for (const link of tocLinks) {
            link.classList.remove("active");
        }

        // 针对同一 heading，给所有匹配链接添加 active
        const matches = document.querySelectorAll(`[data-heading-id="${id}"]`);
        for (const el of matches) {
            el.classList.add("active");
        }
    };

    const updateActiveHeading = () => {
        if (visibleHeadings.size === 0) return;

        // 找到第一个可见的标题（从上到下）
        let firstVisibleId: string | null = null;
        for (const heading of headingElements) {
            if (visibleHeadings.has(heading.id)) {
                firstVisibleId = heading.id;
                break;
            }
        }

        if (firstVisibleId) {
            setActiveLink(firstVisibleId);
        }
    };

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const id = entry.target.id;
            if (entry.isIntersecting) {
                visibleHeadings.add(id);
            } else {
                visibleHeadings.delete(id);
            }
        }

        updateActiveHeading();
    }, observerOptions);

    for (const heading of headingElements) {
        observer.observe(heading);
    }

    // 点击处理器映射，用于清理
    const clickHandlers = new Map<Element, () => void>();

    // 添加点击事件处理
    for (const link of tocLinks) {
        const handler = () => {
            const id = link.getAttribute("data-heading-id");
            if (id) {
                setActiveLink(id);
            }
        };
        clickHandlers.set(link, handler);
        link.addEventListener("click", handler);
    }

    // Cleanup function
    currentTocCleanup = () => {
        observer.disconnect();
        for (const [link, handler] of clickHandlers) {
            link.removeEventListener("click", handler);
        }
        clickHandlers.clear();
    };
}

// ============ 移动端 TOC 抽屉 ============
function initMobileTocDrawer() {
    const toggleBtn = document.querySelector("[data-toc-mobile-toggle]");
    const drawer = document.querySelector("[data-toc-mobile-drawer]");
    const overlay = document.querySelector("[data-toc-mobile-overlay]");
    const content = document.querySelector("[data-toc-mobile-content]");
    const closeBtn = document.querySelector("[data-toc-mobile-close]");
    const tocLinks = drawer?.querySelectorAll("[data-toc-link]");

    if (!toggleBtn || !drawer || !overlay || !content || !closeBtn) return;

    let isOpen = false;

    const openDrawer = () => {
        isOpen = true;
        drawer.classList.remove("pointer-events-none");
        drawer.setAttribute("aria-hidden", "false");
        overlay.classList.remove("opacity-0", "pointer-events-none");
        content.classList.remove("translate-x-full");
        document.body.classList.add("scroll-locked");
    };

    const closeDrawer = () => {
        isOpen = false;
        overlay.classList.add("opacity-0", "pointer-events-none");
        content.classList.add("translate-x-full");
        document.body.classList.remove("scroll-locked");
        // 等待动画结束后再隐藏
        setTimeout(() => {
            if (!isOpen) {
                drawer.classList.add("pointer-events-none");
                drawer.setAttribute("aria-hidden", "true");
            }
        }, 300);
    };

    toggleBtn.addEventListener("click", openDrawer);
    closeBtn.addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    // 点击目录链接后自动关闭
    tocLinks?.forEach((link) => {
        link.addEventListener("click", closeDrawer);
    });

    // ESC 键关闭
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen) {
            closeDrawer();
        }
    });
}

// ============ 侧边栏定位（TOC + 分享栏） ============
// 动态计算侧边栏起始位置，实现滚动浮动效果
let sidebarPositionRAF: number | null = null;

function adjustSidebarPositions(): void {
    if (sidebarPositionRAF !== null) cancelAnimationFrame(sidebarPositionRAF);

    sidebarPositionRAF = requestAnimationFrame(() => {
        const tocSidebar = document.querySelector<HTMLElement>("[data-toc-sidebar]");
        const shareSidebar = document.querySelector<HTMLElement>("[data-share-sidebar]");
        const articleHeader = document.querySelector<HTMLElement>("[data-article-header]");

        if (!articleHeader) return;

        // 双重 RAF 确保布局完全稳定后再计算
        requestAnimationFrame(() => {
            const headerBottom = articleHeader.getBoundingClientRect().bottom;
            const minTop = 64; // header 导航栏高度
            const padding = 24; // 与分割线的间距

            // 滚动浮动逻辑：当标题滚出视口时，侧边栏浮动到顶部
            const targetTop =
                headerBottom < minTop
                    ? minTop + padding
                    : Math.max(minTop + padding, headerBottom + padding);

            // 同时更新 TOC 和分享栏位置
            if (tocSidebar) {
                tocSidebar.style.top = `${targetTop}px`;
                tocSidebar.style.opacity = "1";
            }
            if (shareSidebar) {
                shareSidebar.style.top = `${targetTop}px`;
                shareSidebar.style.opacity = "1";
            }

            sidebarPositionRAF = null;
        });
    });
}

// 保持向后兼容的别名
function adjustTocPosition(): void {
    adjustSidebarPositions();
}

const debouncedAdjustTocPosition = debounce(adjustTocPosition, 150);
const throttledAdjustTocPosition = throttle(adjustTocPosition, 16);

// ============ 初始化所有功能 ============
export function initBlogInteractive() {
    // 响应式表格
    const ensureResponsiveTables = () => window.requestAnimationFrame(applyResponsiveTables);
    ensureResponsiveTables();
    window.addEventListener("astro:after-swap", ensureResponsiveTables);

    // Iframe 处理
    handleEmbedIframes();
    window.addEventListener("astro:after-swap", handleEmbedIframes);

    // TOC 功能
    initTocObserver();
    window.addEventListener("astro:after-swap", initTocObserver);

    initMobileTocDrawer();
    window.addEventListener("astro:after-swap", initMobileTocDrawer);

    adjustTocPosition();
    window.addEventListener("resize", debouncedAdjustTocPosition);
    window.addEventListener("scroll", throttledAdjustTocPosition, { passive: true });
    window.addEventListener("astro:after-swap", adjustTocPosition);
}
