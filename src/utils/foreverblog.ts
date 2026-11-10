import snapshot from "../data/foreverblog-daily.json";
import { type DailyIssue, parseDailyFeed } from "./foreverblogFeed";

const FEED_URL = "https://www.foreverblog.cn/daily.xml";
const CACHE_TTL_MS = 60 * 60 * 1000;

export type DailyIssueState = DailyIssue & {
    /** 抓不到 daily.xml，用了仓库里的快照 */
    stale: boolean;
};

let cached: { issue: DailyIssueState; at: number } | null = null;

export async function getDailyIssue(): Promise<DailyIssueState> {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.issue;
    }

    try {
        const response = await fetch(FEED_URL, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
            throw new Error(`daily.xml 返回 ${response.status}`);
        }

        const issue: DailyIssueState = { ...parseDailyFeed(await response.text()), stale: false };
        cached = { issue, at: Date.now() };
        return issue;
    } catch (error) {
        console.warn(`[foreverblog] 抓取 daily.xml 失败，改用 ${snapshot.date} 的快照：${error}`);
        return { ...(snapshot as DailyIssue), stale: true };
    }
}
