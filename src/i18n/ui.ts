import type { Locale } from "../utils/i18n";

export const ui = {
    zh: {
        // Navigation
        "nav.home": "首页",
        "nav.blog": "文章",
        "nav.tags": "标签",
        "nav.channel": "动态",
        "nav.mangashots": "表情包",
        "nav.friends": "友链",
        "nav.plrom": "心头好",
        "nav.about": "关于",
        "nav.skipToContent": "跳转到主要内容",
        "nav.mainNav": "主导航",
        "nav.openMenu": "打开导航菜单",
        "nav.closeMenu": "关闭导航菜单",
        "nav.mobileNav": "移动端导航",

        // Blog post
        "post.readingTime": "约 {minutes} 分钟",
        "post.lastUpdated": "最近更新于",
        "post.openToc": "打开目录",
        "post.toc": "目录",
        "post.closeToc": "关闭目录",
        "post.backToTop": "回到顶部",

        // Post list
        "postList.hideDeepSearch": "隐藏 DeepSearch 文章",
        "postList.noMatchingPosts": "（暂无符合条件的文章）",

        // Misc
        "misc.noDescription": "暂无描述",
        "misc.noPreview": "暂无预览图",
        "misc.loading": "加载中...",
    },
    en: {
        // Navigation
        "nav.home": "Home",
        "nav.blog": "Blog",
        "nav.tags": "Tags",
        "nav.channel": "Feed",
        "nav.mangashots": "Manga",
        "nav.friends": "Friends",
        "nav.plrom": "Favorites",
        "nav.about": "About",
        "nav.skipToContent": "Skip to main content",
        "nav.mainNav": "Main navigation",
        "nav.openMenu": "Open navigation menu",
        "nav.closeMenu": "Close navigation menu",
        "nav.mobileNav": "Mobile navigation",

        // Blog post
        "post.readingTime": "~{minutes} min read",
        "post.lastUpdated": "Last updated",
        "post.openToc": "Open table of contents",
        "post.toc": "Contents",
        "post.closeToc": "Close table of contents",
        "post.backToTop": "Back to top",

        // Post list
        "postList.hideDeepSearch": "Hide DeepSearch posts",
        "postList.noMatchingPosts": "(No matching posts)",

        // Misc
        "misc.noDescription": "No description",
        "misc.noPreview": "No preview",
        "misc.loading": "Loading...",
    },
} as const;

export type UIKey = keyof (typeof ui)["zh"];

/**
 * Get translated UI string. Works in Astro components.
 * For interpolation, use {key} placeholders and pass values object.
 */
export function t(
    locale: Locale | string | undefined,
    key: UIKey,
    values?: Record<string, string | number>,
): string {
    const lang = (locale === "en" ? "en" : "zh") as keyof typeof ui;
    let str: string = ui[lang][key] ?? ui.zh[key] ?? key;
    if (values) {
        for (const [k, v] of Object.entries(values)) {
            str = str.replace(`{${k}}`, String(v));
        }
    }
    return str;
}

/**
 * Get locale from Astro's currentLocale or fall back to "zh".
 */
export function getLocale(astroLocale: string | undefined): Locale {
    return astroLocale === "en" ? "en" : "zh";
}
