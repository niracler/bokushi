import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { archive } from "../../lib/channel/client";
import { OBJECT_PREFIX } from "../../lib/channel/media";

export const prerender = false;

const serve: APIRoute = async ({ params, request }) => {
    const key = params.key;
    if (!key || !/^[a-f0-9]{64}$/.test(key)) return new Response(null, { status: 404 });
    const info = await archive(env).assetInfo(key);
    if (!info) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    const etag = `"${key}"`;
    const headers = new Headers({
        "Content-Type": info.type,
        "Content-Length": String(info.size),
        "Accept-Ranges": "bytes",
        ETag: etag,
        "Cache-Control": "public, no-cache",
        "X-Content-Type-Options": "nosniff",
    });
    if (request.headers.get("If-None-Match")?.split(/,\s*/).includes(etag)) {
        headers.delete("Content-Length");
        return new Response(null, { status: 304, headers });
    }

    let range: { offset: number; length: number } | undefined;
    const raw = request.headers.get("Range");
    const ifRange = request.headers.get("If-Range");
    if (raw && (!ifRange || ifRange === etag)) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(raw);
        if (match && (match[1] || match[2])) {
            const start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
            const end =
                match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
            if (start > end || !Number.isSafeInteger(start)) {
                return new Response(null, {
                    status: 416,
                    headers: { "Content-Range": `bytes */${info.size}` },
                });
            }
            range = { offset: start, length: end - start + 1 };
            headers.set("Content-Length", String(range.length));
            headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
        }
    }
    const init = { status: range ? 206 : 200, headers };
    if (request.method === "HEAD") return new Response(null, init);
    const object = await env.CHANNEL_MEDIA.get(OBJECT_PREFIX + info.objectKey, { range });
    if (!object)
        return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(object.body, init);
};

export const GET = serve;
export const HEAD = serve;
