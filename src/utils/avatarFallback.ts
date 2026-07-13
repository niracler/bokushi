interface CommentAvatarIdentity {
    author: string;
    avatarUrl: string | null;
    gravatarHash: string | null;
    website: string | null;
}

interface CommentAvatarSources {
    src: string;
    fallbacks: string[];
}

/** Route an external image through the local proxy for CDN caching. */
export function proxiedImageUrl(url: string): string {
    if (!url) return "";
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function gravatarUrl(hash: string | null): string {
    if (!hash) return "";
    return proxiedImageUrl(`https://www.gravatar.com/avatar/${hash}?d=404&s=48`);
}

function dicebearUrl(name: string): string {
    return proxiedImageUrl(
        `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`,
    );
}

function faviconUrl(website: string | null): string {
    if (!website) return "";
    try {
        const { hostname } = new URL(website);
        return proxiedImageUrl(`https://www.google.com/s2/favicons?domain=${hostname}&sz=48`);
    } catch {
        return "";
    }
}

export function getCommentAvatarSources(identity: CommentAvatarIdentity): CommentAvatarSources {
    if (identity.avatarUrl) {
        return {
            src: proxiedImageUrl(identity.avatarUrl),
            fallbacks: [dicebearUrl(identity.author)],
        };
    }

    if (identity.gravatarHash) {
        return {
            src: gravatarUrl(identity.gravatarHash),
            fallbacks: [faviconUrl(identity.website), dicebearUrl(identity.author)].filter(
                Boolean,
            ) as string[],
        };
    }

    if (identity.website) {
        return {
            src: faviconUrl(identity.website),
            fallbacks: [dicebearUrl(identity.author)],
        };
    }

    return { src: dicebearUrl(identity.author), fallbacks: [] };
}

export function bindImageFallbacks(img: HTMLImageElement, fallbacks: readonly string[]): void {
    if (fallbacks.length === 0) return;

    const remainingFallbacks = [...fallbacks];
    const handleError = () => {
        const next = remainingFallbacks.shift();
        if (!next) {
            img.removeEventListener("error", handleError);
            return;
        }

        img.src = next;
        if (remainingFallbacks.length === 0) {
            img.removeEventListener("error", handleError);
        }
    };

    img.addEventListener("error", handleError);
}

export function bindOrderedImageFallbacks(
    images: Iterable<HTMLImageElement>,
    fallbackSets: readonly (readonly string[])[],
): void {
    Array.from(images).forEach((img, index) => {
        bindImageFallbacks(img, fallbackSets[index] ?? []);
    });
}
