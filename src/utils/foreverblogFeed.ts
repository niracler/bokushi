export type DailyPick = {
    title: string;
    url: string;
    note: string;
};

export type DailyIssue = {
    date: string;
    issueUrl: string;
    picks: DailyPick[];
};

const PICK_LIMIT = 2;
const ISSUE_URL_RE = /「今天读什么」：(\S+)/;
const ISSUE_DATE_RE = /\/daily\/(\d{4}-\d{2}-\d{2})\.html/;

function readTag(raw: string, tag: string): string {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(raw);
    if (!match) return "";
    return match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

function decodeXml(value: string): string {
    return value
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'")
        .replaceAll("&#39;", "'")
        .replaceAll("&amp;", "&");
}

function parseItem(raw: string): { pick: DailyPick; date: string } | null {
    const title = decodeXml(readTag(raw, "title"));
    const url = decodeXml(readTag(raw, "guid"));
    const description = decodeXml(readTag(raw, "description"));

    const noteLine = description
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("编辑推荐"));

    const issueUrl = ISSUE_URL_RE.exec(description)?.[1] ?? "";
    const date = ISSUE_DATE_RE.exec(issueUrl)?.[1] ?? "";

    if (!title || !url || !noteLine || !date) return null;

    return {
        pick: { title, url, note: noteLine.replace(/^编辑推荐：?/, "").trim() },
        date,
    };
}

/** 解析 daily.xml，只保留最新一期的推荐条目。 */
export function parseDailyFeed(xml: string): DailyIssue {
    const parsed = xml
        .split("<item>")
        .slice(1)
        .map((chunk) => parseItem(chunk.split("</item>")[0]))
        .filter((entry) => entry !== null);

    if (parsed.length === 0) {
        throw new Error("daily.xml 里没有可用的推荐条目");
    }

    const latestDate = parsed
        .map((entry) => entry.date)
        .sort()
        .at(-1) as string;
    const picks = parsed
        .filter((entry) => entry.date === latestDate)
        .slice(0, PICK_LIMIT)
        .map((entry) => entry.pick);

    return {
        date: latestDate,
        issueUrl: `https://www.foreverblog.cn/daily/${latestDate}.html`,
        picks,
    };
}
