/**
 * 计算文章字数和预估阅读时长
 * 中文按 300 字/分钟，英文按 200 词/分钟
 */

export interface ReadingTimeResult {
    /** 总字数（中文字符 + 英文单词） */
    wordCount: number;
    /** 预估阅读时长（分钟） */
    minutes: number;
    /** 格式化的阅读时长文本 */
    text: string;
}

/**
 * 从 Markdown 内容中计算阅读时长
 */
export function getReadingTime(content: string): ReadingTimeResult {
    // 移除 frontmatter
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---/, "");

    // 移除代码块（不计入阅读时间）
    const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, "");

    // 移除 HTML 标签
    const withoutHtml = withoutCode.replace(/<[^>]*>/g, "");

    // 移除 Markdown 语法符号
    const withoutMarkdown = withoutHtml
        .replace(/!\[.*?\]\(.*?\)/g, "") // 图片
        .replace(/\[.*?\]\(.*?\)/g, "") // 链接
        .replace(/[#*`~_>\-|]/g, "") // 常见符号
        .replace(/\n+/g, " ") // 换行转空格
        .trim();

    // 统计中文字符数
    const chineseChars = withoutMarkdown.match(/[\u4e00-\u9fa5]/g) || [];
    const chineseCount = chineseChars.length;

    // 统计英文单词数（连续的字母数字）
    const englishWords = withoutMarkdown.match(/[a-zA-Z0-9]+/g) || [];
    const englishCount = englishWords.length;

    // 总字数（中文字符 + 英文单词）
    const wordCount = chineseCount + englishCount;

    // 计算阅读时长
    // 中文：约 300 字/分钟
    // 英文：约 200 词/分钟
    const chineseMinutes = chineseCount / 300;
    const englishMinutes = englishCount / 200;
    const totalMinutes = chineseMinutes + englishMinutes;

    // 至少 1 分钟
    const minutes = Math.max(1, Math.ceil(totalMinutes));

    return {
        wordCount,
        minutes,
        text: `${minutes} 分钟`,
    };
}
