/**
 * Like API - 文章点赞接口（支持多次点赞）
 *
 * GET /api/like?slug=xxx - 获取点赞数和当前用户已点赞次数
 * POST /api/like { slug } - 点赞（每次 +1，每人最多 16 次）
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getClientIP, hashIP, jsonResponse, verifySameOrigin } from "../../lib/utils";

export const prerender = false;

// 每人最多点赞次数
const MAX_LIKES_PER_USER = 16;

interface LikeData {
    count: number;
    // 每个 IP 哈希对应的点赞次数
    likes: Record<string, number>;
}

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
        return jsonResponse({ error: "Missing slug parameter" }, 400);
    }

    try {
        const kv = env.LIKES;

        // 本地开发环境没有 KV，返回模拟数据
        if (!kv) {
            return jsonResponse({ count: 0, userLikes: 0, maxLikes: MAX_LIKES_PER_USER });
        }

        const data = await kv.get<LikeData>(`like:${slug}`, "json");
        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);

        const count = data?.count ?? 0;
        const userLikes = data?.likes?.[ipHash] ?? 0;

        return jsonResponse({ count, userLikes, maxLikes: MAX_LIKES_PER_USER }, 200, {
            "Cache-Control": "no-cache",
        });
    } catch (error) {
        console.error("Error getting like data:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};

export const POST: APIRoute = async ({ request }) => {
    if (!verifySameOrigin(request)) {
        return jsonResponse({ error: "Origin mismatch" }, 403);
    }

    try {
        const body = await request.json();
        const { slug } = body as { slug?: string };

        if (!slug) {
            return jsonResponse({ error: "Missing slug" }, 400);
        }

        const kv = env.LIKES;

        // 本地开发环境没有 KV，返回模拟数据
        if (!kv) {
            return jsonResponse({ count: 1, userLikes: 1, maxLikes: MAX_LIKES_PER_USER });
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
            return jsonResponse(
                {
                    count: data.count,
                    userLikes: currentUserLikes,
                    maxLikes: MAX_LIKES_PER_USER,
                    maxReached: true,
                },
                200,
                { "Cache-Control": "no-cache" },
            );
        }

        // 增加点赞
        data.count += 1;
        data.likes[ipHash] = currentUserLikes + 1;

        // 保存数据
        await kv.put(`like:${slug}`, JSON.stringify(data));

        return jsonResponse(
            {
                count: data.count,
                userLikes: data.likes[ipHash],
                maxLikes: MAX_LIKES_PER_USER,
            },
            200,
            { "Cache-Control": "no-cache" },
        );
    } catch (error) {
        console.error("Error processing like:", error);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
};
