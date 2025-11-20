export const prerender = false; // 这个 endpoint 在服务端运行,不预渲染

export const GET = async ({ url }: { url: URL }) => {
	try {
		// 获取分页参数
		const page = url.searchParams.get("page") || "1";

		// 从 worker 获取数据，传递分页参数
		const response = await fetch(
			`https://mangashot2bot.cloud-1e0.workers.dev/api/mangashots?page=${page}`,
		);

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
				// 缓存 5 分钟,减少对 worker 的请求
				"Cache-Control": "public, max-age=300",
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
