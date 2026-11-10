import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const dependencyControlFiles = new Set([
    ".npmrc",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
]);

export function isDependencyControlFile(file) {
    return dependencyControlFiles.has(file);
}

export function buildCheckCommands(mode, stagedFiles) {
    const commands = [["exec", "knip", "--dependencies"]];

    if (mode === "ci") {
        return [...commands, ["dedupe", "--check"], ["audit", "--audit-level=moderate"]];
    }

    if (mode !== "commit") {
        throw new Error(`Unsupported dependency check mode: ${mode}`);
    }

    if (stagedFiles.some(isDependencyControlFile)) {
        commands.push(["dedupe", "--check"], ["audit", "--audit-level=high"]);
    }

    return commands;
}

export function getStagedFiles(exec = execFileSync) {
    return exec("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMRD"], {
        encoding: "utf8",
    })
        .split("\n")
        .filter(Boolean);
}

export function resolvePnpmCommand(npmExecPath) {
    if (!npmExecPath) {
        return { command: "pnpm", args: [] };
    }

    // npm_execpath 只有在是 JS 入口时才需要交给 node；standalone 的 pnpm
    // （如 @pnpm/exe 二进制）本身就是可执行文件，交给 node 会被当成源码解析。
    if (/\.[cm]?js$/.test(npmExecPath)) {
        return { command: process.execPath, args: [npmExecPath] };
    }

    return { command: npmExecPath, args: [] };
}

function runPnpm(args) {
    const { command, args: prefix } = resolvePnpmCommand(process.env.npm_execpath);
    execFileSync(command, [...prefix, ...args], { stdio: "inherit" });
}

function main() {
    const mode = process.argv[2] ?? "commit";
    const stagedFiles = mode === "commit" ? getStagedFiles() : [];

    for (const args of buildCheckCommands(mode, stagedFiles)) {
        runPnpm(args);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
