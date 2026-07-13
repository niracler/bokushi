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

function runPnpm(args) {
    const npmExecPath = process.env.npm_execpath;

    if (npmExecPath) {
        execFileSync(process.execPath, [npmExecPath, ...args], { stdio: "inherit" });
        return;
    }

    execFileSync("pnpm", args, { stdio: "inherit" });
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
