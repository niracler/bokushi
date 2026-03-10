import { stripMarkdown } from "./readingTime";

/**
 * 从 Markdown 内容中提取描述
 * @param content - Markdown 内容
 * @param maxLength - 最大长度（默认 80 字符）
 * @returns 提取的描述文本
 */
export function extractDescription(
    content: string,
    maxLength: number = 80,
    fallback: string = "暂无描述",
): string {
    const plainText = stripMarkdown(content);

    if (!plainText) {
        return fallback;
    }

    if (plainText.length <= maxLength) {
        return plainText;
    }

    // 在最后一个完整的句子或词边界处截断
    let truncated = plainText.substring(0, maxLength);

    // 尝试在句号、问号、感叹号处截断
    const lastSentenceEnd = Math.max(
        truncated.lastIndexOf("。"),
        truncated.lastIndexOf("！"),
        truncated.lastIndexOf("？"),
        truncated.lastIndexOf("."),
        truncated.lastIndexOf("!"),
        truncated.lastIndexOf("?"),
    );

    if (lastSentenceEnd > maxLength * 0.8) {
        truncated = truncated.substring(0, lastSentenceEnd + 1);
    } else {
        // 如果没有合适的句子结束符，在最后一个空格处截断
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > maxLength * 0.8) {
            truncated = truncated.substring(0, lastSpace);
        }
        truncated += "...";
    }

    return truncated;
}
