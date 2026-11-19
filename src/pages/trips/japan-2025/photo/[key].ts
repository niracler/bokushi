import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import days from "../../../../data/japan-2025.json";

export const prerender = false;

const published = new Set(
    days.flatMap((day) => day.stops.flatMap((stop) => stop.photos.map((p) => p.key))),
);

export const GET: APIRoute = async ({ params }) => {
    const key = params.key;
    if (!key || !published.has(key)) return new Response(null, { status: 404 });

    const photo = await env.TRIP_PHOTOS.get(`trips/japan-2025/${key}/view.jpg`);
    if (!photo) return new Response(null, { status: 404 });

    return new Response(photo.body, {
        headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(photo.size),
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: photo.httpEtag,
        },
    });
};
