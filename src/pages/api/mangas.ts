import { z } from "astro/zod";
import { jsonResponse } from "../../lib/utils";

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
            return jsonResponse({ error: "Failed to fetch mangas" }, response.status);
        }

        const rawData = await response.json();

        // Validate response data
        const parseResult = MangasResponseSchema.safeParse(rawData);
        if (!parseResult.success) {
            console.error("Invalid response from worker:", parseResult.error);
            return jsonResponse({ error: "Invalid data format from external API" }, 502);
        }

        return jsonResponse(parseResult.data, 200, {
            "Cache-Control": "public, max-age=3600, s-maxage=7200",
        });
    } catch (error) {
        console.error("Error fetching mangas:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
