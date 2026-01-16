/**
 * Like API - 文章点赞接口（支持多次点赞）
 *
 * GET /api/like?slug=xxx - 获取点赞数和当前用户已点赞次数
 * POST /api/like { slug } - 点赞（每次 +1，每人最多 16 次）
 */

import type { APIRoute } from "astro";

export const prerender = false;

// 每人最多点赞次数
const MAX_LIKES_PER_USER = 16;

interface LikeData {
    count: number;
    // 每个 IP 哈希对应的点赞次数
    likes: Record<string, number>;
}

/**
 * 将 IP 地址转换为 SHA-256 哈希（保护隐私）
 */
async function hashIP(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 获取客户端 IP 地址
 */
function getClientIP(request: Request): string {
    // Cloudflare 提供的真实 IP
    const cfIP = request.headers.get("CF-Connecting-IP");
    if (cfIP) return cfIP;

    // 标准代理头
    const forwardedFor = request.headers.get("X-Forwarded-For");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();

    // 本地开发环境
    return "127.0.0.1";
}

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
        return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const kv = locals.runtime?.env?.LIKES;

        // 本地开发环境没有 KV，返回模拟数据
        if (!kv) {
            return new Response(
                JSON.stringify({ count: 0, userLikes: 0, maxLikes: MAX_LIKES_PER_USER }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        const data = await kv.get<LikeData>(`like:${slug}`, "json");
        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);

        const count = data?.count ?? 0;
        const userLikes = data?.likes?.[ipHash] ?? 0;

        return new Response(JSON.stringify({ count, userLikes, maxLikes: MAX_LIKES_PER_USER }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        console.error("Error getting like data:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const body = await request.json();
        const { slug } = body as { slug?: string };

        if (!slug) {
            return new Response(JSON.stringify({ error: "Missing slug" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const kv = locals.runtime?.env?.LIKES;

        // 本地开发环境没有 KV，返回模拟数据
        if (!kv) {
            return new Response(
                JSON.stringify({ count: 1, userLikes: 1, maxLikes: MAX_LIKES_PER_USER }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);

        // 获取当前数据
        const data: LikeData = (await kv.get<LikeData>(`like:${slug}`, "json")) ?? {
            count: 0,
            likes: {},
        };

        const currentUserLikes = data.likes[ipHash] ?? 0;

        // 检查是否已达到上限
        if (currentUserLikes >= MAX_LIKES_PER_USER) {
            return new Response(
                JSON.stringify({
                    count: data.count,
                    userLikes: currentUserLikes,
                    maxLikes: MAX_LIKES_PER_USER,
                    maxReached: true,
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache",
                    },
                },
            );
        }

        // 增加点赞
        data.count += 1;
        data.likes[ipHash] = currentUserLikes + 1;

        // 保存数据
        await kv.put(`like:${slug}`, JSON.stringify(data));

        return new Response(
            JSON.stringify({
                count: data.count,
                userLikes: data.likes[ipHash],
                maxLikes: MAX_LIKES_PER_USER,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                },
            },
        );
    } catch (error) {
        console.error("Error processing like:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
