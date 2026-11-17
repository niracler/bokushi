// Deploy independently of the Astro application:
// pnpm exec wrangler deploy --config workers/images/wrangler.jsonc
// Originals and the versioned watermark remain in the existing R2 bucket.
// Watermark: Roboto Regular, @niracler, transparent background, #FB8F68.
// Font source: https://github.com/google/fonts/tree/main/ofl/roboto
// Recreate the PNG with ImageMagick and the Roboto TTF:
// magick -background none -fill '#FB8F68' -font Roboto.ttf -pointsize 240 \
//   'label:@niracler' -trim +repage niracler-fb8f68-v1.png
const ORIGIN = "https://nini-image.niracler.com";
const WATERMARK = `${ORIGIN}/_watermarks/niracler-fb8f68-v1.png`;

function failure(message, status) {
    return new Response(message, {
        status,
        headers: { "Cache-Control": "no-store" },
    });
}

export default {
    async fetch(request) {
        if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response("Method not allowed", {
                status: 405,
                headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
            });
        }

        const url = new URL(request.url);
        if (!/\.(?:jpe?g|png|gif|webp|avif)$/i.test(url.pathname)) {
            return failure("Image not found", 404);
        }

        // Fixed parameters bound the monthly transformation count. Client query
        // strings cannot select another origin, bypass the watermark, or resize.
        const accept = request.headers.get("Accept") ?? "";
        const supported = accept.split(",").map((entry) => {
            const [type, ...parameters] = entry.trim().split(";");
            const quality = parameters.find((value) => value.trim().startsWith("q="));
            return { type, quality: quality ? Number(quality.trim().slice(2)) : 1 };
        });
        const format = ["avif", "webp"].find((value) =>
            supported.some((entry) => entry.type === `image/${value}` && entry.quality > 0),
        );
        const response = await fetch(`${ORIGIN}${url.pathname}`, {
            headers: { "User-Agent": "niracler-image/1.0" },
            cf: {
                image: {
                    width: 1600,
                    fit: "scale-down",
                    quality: 80,
                    ...(format ? { format } : {}),
                    draw: [
                        {
                            url: WATERMARK,
                            width: 0.09406124,
                            fit: "contain",
                            right: 16,
                            bottom: 12,
                        },
                    ],
                },
            },
        });

        if (!response.ok) {
            console.error(JSON.stringify({ path: url.pathname, status: response.status }));
            return failure("Image transformation failed", response.status);
        }
        if (!response.headers.get("Content-Type")?.startsWith("image/")) {
            return failure("Origin did not return an image", 502);
        }
        if (!response.body || response.headers.get("Content-Length") === "0") {
            return failure("Empty image response", 502);
        }

        // Read one chunk before returning 200, including when Content-Length is
        // absent. Continue streaming so large images are never buffered in RAM.
        const reader = response.body.getReader();
        let first = await reader.read();
        while (!first.done && first.value.byteLength === 0) first = await reader.read();
        if (first.done) return failure("Empty image response", 502);

        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "public, max-age=14400, s-maxage=2592000");
        headers.set("Vary", "Accept");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Image-Service", "Cloudflare Images");
        // Large animations can be delivered unchanged by Images. Do not claim
        // that the watermark was applied to a GIF that may have passed through.
        if (headers.get("Content-Type") !== "image/gif") {
            headers.set("X-Image-Watermark", "@niracler; color=#FB8F68; v1");
        }

        if (request.method === "HEAD") {
            await reader.cancel();
            return new Response(null, { headers });
        }

        return new Response(
            new ReadableStream({
                start(controller) {
                    controller.enqueue(first.value);
                },
                async pull(controller) {
                    const chunk = await reader.read();
                    if (chunk.done) controller.close();
                    else controller.enqueue(chunk.value);
                },
                cancel(reason) {
                    return reader.cancel(reason);
                },
            }),
            { headers },
        );
    },
};
