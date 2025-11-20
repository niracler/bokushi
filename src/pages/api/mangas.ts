export const prerender = false;

export const GET = async () => {
    try {
        const response = await fetch(
            "https://mangashot2bot.cloud-1e0.workers.dev/api/mangas",
        );

        if (!response.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch mangas" }), {
                status: response.status,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=300",
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
