export const prerender = false; // 这个 endpoint 在服务端运行,不预渲染

const WORKER_ENDPOINT =
	"https://mangashot2bot.cloud-1e0.workers.dev/api/mangashots";

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
			return new Response(
				JSON.stringify({ error: "Failed to fetch mangashots" }),
				{
					status: response.status,
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}

		const data = await response.json();

		return new Response(JSON.stringify(data), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				// 搜索结果缓存短一些
				"Cache-Control": titleTerm
					? "public, max-age=120"
					: "public, max-age=300",
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
