import { z } from "astro/zod";

export const prerender = false; // 这个 endpoint 在服务端运行,不预渲染

const WORKER_ENDPOINT = "https://mangashot2bot.cloud-1e0.workers.dev/api/mangashots";

// Validation schemas
const MangaShotSchema = z.object({
    id: z.string(),
    title: z.string().max(500),
    manga_name: z.string().max(200),
    photo_url: z.string().url(),
    thumbnail_url: z.string().url().optional(),
    caption: z.string().max(1000).nullable().optional(),
    created_at: z.string().optional(),
});

const MangashotsResponseSchema = z.object({
    data: z.array(MangaShotSchema),
    pagination: z.object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().positive(),
    }),
});

export const GET = async ({ url }: { url: URL }) => {
    try {
        const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
        const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
        const mangaName = url.searchParams.get("manga_name");
        // 接受 title/search/q 三种参数名
        const title =
            url.searchParams.get("title") ??
            url.searchParams.get("search") ??
            url.searchParams.get("q") ??
            "";
        const titleTerm = title.trim();

        const workerUrl = new URL(WORKER_ENDPOINT);
        workerUrl.searchParams.set("page", String(page));
        if (mangaName) workerUrl.searchParams.set("manga_name", mangaName);
        if (titleTerm) {
            workerUrl.searchParams.set("title", titleTerm);
            // 兼容旧接口参数名
            workerUrl.searchParams.set("search", titleTerm);
            workerUrl.searchParams.set("query", titleTerm);
        }

        const response = await fetch(workerUrl);

        if (!response.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch mangashots" }), {
                status: response.status,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        const rawData = await response.json();

        // Validate response data
        const parseResult = MangashotsResponseSchema.safeParse(rawData);
        if (!parseResult.success) {
            console.error("Invalid response from worker:", parseResult.error);
            return new Response(
                JSON.stringify({ error: "Invalid data format from external API" }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const data = parseResult.data;

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                // 搜索结果缓存短一些,CDN缓存更长
                "Cache-Control": titleTerm
                    ? "public, max-age=300, s-maxage=600"
                    : "public, max-age=3600, s-maxage=7200",
            },
        });
    } catch (error) {
        console.error("Error fetching mangashots:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
};
