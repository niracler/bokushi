/**
 * 从 Markdown 内容中提取描述
 * @param content - Markdown 内容
 * @param maxLength - 最大长度（默认 160 字符）
 * @returns 提取的描述文本
 */
export function extractDescription(content: string, maxLength: number = 80): string {
    // 移除 frontmatter
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/m, "");

    // 移除 Markdown 语法
    const plainText = contentWithoutFrontmatter
        // 移除代码块
        .replace(/```[\s\S]*?```/g, "")
        // 移除行内代码
        .replace(/`[^`]*`/g, "")
        // 移除链接
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        // 移除图片
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
        // 移除标题标记
        .replace(/^#{1,6}\s+/gm, "")
        // 移除加粗和斜体标记
        .replace(/(\*{1,2}|_{1,2})([^*_]+)\1/g, "$2")
        // 移除引用标记
        .replace(/^>\s+/gm, "")
        // 移除列表标记
        .replace(/^[\s]*[-*+]\s+/gm, "")
        .replace(/^[\s]*\d+\.\s+/gm, "")
        // 移除水平线
        .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
        // 移除 HTML 标签
        .replace(/<[^>]+>/g, "")
        // 移除多余的空白字符
        .replace(/\s+/g, " ")
        .trim();

    // 如果内容为空，返回默认描述
    if (!plainText) {
        return "暂无描述";
    }

    // 截取指定长度
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
