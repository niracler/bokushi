import { execSync } from "node:child_process";
import { statSync } from "node:fs";

export function remarkModifiedTime() {
    return (_tree, file) => {
        const filepath = file.history[0];
        if (!filepath) return;

        try {
            // 获取最后修改时间
            const timestamp = execSync(`git log -1 --pretty="format:%cI" "${filepath}"`, {
                encoding: "utf-8",
            });
            file.data.astro.frontmatter.lastModified = timestamp.toString().trim();

            // 获取 GitHub 仓库 URL
            const remoteUrl = execSync("git config --get remote.origin.url", {
                encoding: "utf-8",
            }).trim();

            // 将 Git URL 转换为 GitHub web URL
            // 支持 https://github.com/user/repo.git 和 git@github.com:user/repo.git 格式
            const githubUrl = remoteUrl
                .replace(/\.git$/, "")
                .replace(/^git@github\.com:/, "https://github.com/");

            // 生成文件的 commits 历史链接
            // 使用 /commits/{branch}/{filepath} 格式来显示该文件的所有提交历史
            const relativeFilepath = filepath.replace(`${process.cwd()}/`, "");
            file.data.astro.frontmatter.lastModifiedCommitUrl = `${githubUrl}/commits/main/${relativeFilepath}`;
        } catch {
            // 如果 Git 命令失败(比如文件还未提交或不在 Git 仓库中),使用文件系统的修改时间
            try {
                const stats = statSync(filepath);
                file.data.astro.frontmatter.lastModified = stats.mtime.toISOString();
                // 文件系统时间没有 commit URL
                file.data.astro.frontmatter.lastModifiedCommitUrl = null;
            } catch (fsError) {
                console.warn(`无法获取 ${filepath} 的修改时间:`, fsError);
            }
        }
    };
}
