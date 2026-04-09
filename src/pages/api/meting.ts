import type { APIRoute } from "astro";
import { SITE_URL } from "../../consts";
import { getPlaylistDetail, getSongDetail, getSongLrc, getSongUrl } from "../../utils/netease";

export const prerender = false;

const VALID_TYPES = new Set(["song", "playlist", "url", "lrc"]);

const CACHE_TTL: Record<string, number> = {
    song: 86400,
    playlist: 3600,
    url: 600,
    lrc: 86400,
};

export const GET: APIRoute = async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    const id = params.get("id");
    const format = params.get("format");

    if (!type || !id || !VALID_TYPES.has(type)) {
        return new Response(JSON.stringify({ error: "Missing or invalid type/id parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        let data: unknown;

        switch (type) {
            case "song": {
                const ids = id
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                data = await getSongDetail(ids);
                break;
            }
            case "playlist":
                data = await getPlaylistDetail(id);
                break;
            case "url":
                data = [{ url: await getSongUrl(id) }];
                break;
            case "lrc": {
                const lrcText = await getSongLrc(id);
                if (format === "text") {
                    return new Response(lrcText, {
                        status: 200,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                            "Cache-Control": `public, max-age=${CACHE_TTL.lrc}`,
                            "Access-Control-Allow-Origin": SITE_URL,
                        },
                    });
                }
                data = [{ lrc: lrcText }];
                break;
            }
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${CACHE_TTL[type] || 3600}`,
                "Access-Control-Allow-Origin": SITE_URL,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Meting API error:", message, error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch from Netease", detail: message }),
            {
                status: 502,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
};
