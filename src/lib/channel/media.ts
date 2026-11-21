import * as cheerio from "cheerio";
import type { TelegramPost } from "../../utils/telegram";

export const VIDEO_LIMIT = 25_000_000;
export const VIDEO_BUDGET = 2_000_000_000;
export const MEDIA_PATH = "/channel-media/";
export const OBJECT_PREFIX = "channel/v1/";

export function mediaSource(value: string) {
    const remote = value.startsWith("/api/image-proxy?")
        ? new URL(value, "https://niracler.com").searchParams.get("url")
        : value;
    const url = new URL(remote ?? "");
    const hosts = [
        "t.me",
        "telegra.ph",
        "telesco.pe",
        "telegram.org",
        "cdn-telegram.org",
        "telegram-cdn.org",
    ];
    if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    ) {
        throw new Error("Unrecognized Telegram media host");
    }
    return url;
}

type CopyImage = (url: string) => Promise<string>;
type CopyVideo = (url: string) => Promise<string | null>;

/** Work on a new post. The caller publishes it only after all its pictures exist. */
export async function preparePost(input: TelegramPost, copyImage: CopyImage, copyVideo: CopyVideo) {
    if (input.missingPhoto) throw new Error("Telegram omitted a photo URL");
    const post = structuredClone(input);
    const copied = new Map<string, string>();
    async function image(url: string) {
        const found = copied.get(url);
        if (found) return found;
        const result = await copyImage(url);
        copied.set(url, result);
        return result;
    }
    for (const photo of post.photos ?? []) photo.url = await image(photo.url);
    if (post.linkPreview?.imageUrl)
        post.linkPreview.imageUrl = await image(post.linkPreview.imageUrl);
    if (post.replyInfo?.replyToThumb)
        post.replyInfo.replyToThumb = await image(post.replyInfo.replyToThumb);
    if (post.video?.thumbUrl) post.video.thumbUrl = await image(post.video.thumbUrl);

    for (const field of ["content", "textHtml"] as const) {
        const html = post[field];
        if (!html?.includes("<img")) continue;
        const $ = cheerio.load(html, null, false);
        for (const element of $("img[src]").toArray()) {
            const img = $(element);
            const src = img.attr("src");
            if (src) img.attr("src", await image(src));
        }
        post[field] = $.html();
    }

    const assets = new Set(copied.values());
    if (post.video?.sourceUrl) {
        const video = await copyVideo(post.video.sourceUrl);
        delete post.video.sourceUrl;
        if (video) {
            post.video.videoUrl = video;
            assets.add(video);
        } else {
            delete post.video.videoUrl;
            post.video.notSupported = true;
        }
    }
    return { post, assets: [...assets].map((url) => url.slice(MEDIA_PATH.length)) };
}
