import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = new URL("../", import.meta.url);
const testRoot = await mkdtemp(join(tmpdir(), "bokushi-lockfile-"));

try {
    for (const filename of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
        await copyFile(new URL(filename, projectRoot), join(testRoot, filename));
    }

    const result = spawnSync("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"], {
        cwd: testRoot,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status === 0) {
        console.log("Lockfile check passed in a clean workspace.");
    } else {
        process.stderr.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
        process.exitCode = result.status ?? 1;
    }
} finally {
    await rm(testRoot, { force: true, recursive: true });
}
