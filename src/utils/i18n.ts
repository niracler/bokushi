const LOCALES = ["zh", "en"] as const;
const DEFAULT_LOCALE = "zh";

export type Locale = (typeof LOCALES)[number];

/**
 * Extract locale and base slug from a content collection post ID.
 * glob loader produces IDs like "zh/elegant" or "en/elegant".
 */
export function parsePostId(id: string): { locale: Locale; slug: string } {
    const firstSlash = id.indexOf("/");
    if (firstSlash === -1) {
        return { locale: DEFAULT_LOCALE, slug: id };
    }
    const prefix = id.slice(0, firstSlash);
    if ((LOCALES as readonly string[]).includes(prefix)) {
        return { locale: prefix as Locale, slug: id.slice(firstSlash + 1) };
    }
    return { locale: DEFAULT_LOCALE, slug: id };
}

/** Build a locale-prefixed path. zh (default) gets no prefix; en gets `/en`. */
export function localePath(path: string, locale: Locale): string {
    return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/** Build URL path for a post given its collection ID. */
export function postUrl(id: string): string {
    const { locale, slug } = parsePostId(id);
    if (locale === DEFAULT_LOCALE) {
        return `/${slug}`;
    }
    return `/${locale}/${slug}`;
}
