import { z } from "astro/zod";

export const prerender = false;

// Validation schema
const MangaInfoSchema = z.object({
    manga_name: z.string().max(200),
    count: z.number().int().nonnegative(),
});

const MangasResponseSchema = z.object({
    data: z.array(MangaInfoSchema),
});

export const GET = async () => {
    try {
        const response = await fetch("https://mangashot2bot.cloud-1e0.workers.dev/api/mangas");

        if (!response.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch mangas" }), {
                status: response.status,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        const rawData = await response.json();

        // Validate response data
        const parseResult = MangasResponseSchema.safeParse(rawData);
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
                "Cache-Control": "public, max-age=3600, s-maxage=7200",
            },
        });
    } catch (error) {
        console.error("Error fetching mangas:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
};
