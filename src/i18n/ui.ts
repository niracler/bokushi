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

        // Search modal
        "search.trigger": "搜索 (Cmd+K)",
        "search.dialog": "站内搜索",
        "search.close": "关闭搜索",
        "search.label": "搜索文章",
        "search.placeholder": "搜索文章...",
        "search.emptyHint": "输入关键词开始搜索",
        "search.emptyDetail": "支持搜索所有文章、TIL 和月度总结",
        "search.noResults": "未找到相关内容",
        "search.noResultsHint": "请尝试其他关键词",
        "search.resultList": "搜索结果",
        "search.select": "选择",
        "search.navigate": "导航",
        "search.resultCount": "显示 {shown} / {total} 条结果",
        "search.showMore": "显示更多",

        // Share sidebar
        "share.twitter": "分享到 Twitter",
        "share.telegram": "分享到 Telegram",
        "share.label": "分享文章",
        "share.copyLink": "复制链接",
        "share.like": "点赞",
        "share.unlike": "取消点赞",
        "share.copied": "链接已复制",

        // Lightbox
        "lightbox.viewImage": "查看大图",
        "lightbox.close": "关闭",
        "lightbox.prev": "上一张",
        "lightbox.next": "下一张",

        // Theme
        "theme.toggle": "切换主题模式",
        "theme.light": "浅色模式",
        "theme.dark": "夜间模式",
        "theme.system": "跟随系统",
        "theme.currentSystem": "{system}（当前{active}）",
        "theme.statusMessage": "当前主题：{current}。点击切换为{next}",

        // Related posts
        "related.heading": "相关文章",

        // Footer
        "footer.ccLicense": "本站内容采用 CC BY-NC-SA 4.0 国际许可协议",

        // Spoiler
        "spoiler.reveal": "点击显示隐藏内容",

        // Table of Contents (standalone)
        "toc.heading": "目录",

        // Site metadata
        "site.title": "Niracler 的博物志",
        "site.description": "长门大明神会梦到外星羊么？",

        // Channel sidebar
        "channel.openTelegram": "在 Telegram 中打开",
        "channel.rss": "RSS 订阅",
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

        // Search modal
        "search.trigger": "Search (Cmd+K)",
        "search.dialog": "Site search",
        "search.close": "Close search",
        "search.label": "Search posts",
        "search.placeholder": "Search posts...",
        "search.emptyHint": "Type to start searching",
        "search.emptyDetail": "Search all posts, TILs, and monthly summaries",
        "search.noResults": "No results found",
        "search.noResultsHint": "Try different keywords",
        "search.resultList": "Search results",
        "search.select": "Select",
        "search.navigate": "Navigate",
        "search.resultCount": "Showing {shown} of {total} results",
        "search.showMore": "Show more",

        // Share sidebar
        "share.twitter": "Share on Twitter",
        "share.telegram": "Share on Telegram",
        "share.label": "Share article",
        "share.copyLink": "Copy link",
        "share.like": "Like",
        "share.unlike": "Unlike",
        "share.copied": "Link copied",

        // Lightbox
        "lightbox.viewImage": "View image",
        "lightbox.close": "Close",
        "lightbox.prev": "Previous",
        "lightbox.next": "Next",

        // Theme
        "theme.toggle": "Toggle theme",
        "theme.light": "Light mode",
        "theme.dark": "Dark mode",
        "theme.system": "Follow system",
        "theme.currentSystem": "{system} (currently {active})",
        "theme.statusMessage": "Current theme: {current}. Click to switch to {next}",

        // Related posts
        "related.heading": "Related Posts",

        // Footer
        "footer.ccLicense": "Content licensed under CC BY-NC-SA 4.0",

        // Spoiler
        "spoiler.reveal": "Click to reveal hidden content",

        // Table of Contents (standalone)
        "toc.heading": "Contents",

        // Site metadata
        "site.title": "Niracler's Museum",
        "site.description": "Does the Great God Nagato Dream of Alien Sheep?",

        // Channel sidebar
        "channel.openTelegram": "Open in Telegram",
        "channel.rss": "RSS Feed",
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
