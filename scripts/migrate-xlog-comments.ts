#!/usr/bin/env npx tsx
/**
 * xLog Comment Migration Script
 *
 * Reads the local xLog backup exported from Crossbell and outputs SQL INSERT
 * statements to import comments into the D1 comments database.
 *
 * Backup format (from xLog export tool):
 *   <backup-dir>/notes/<characterId>-<noteId>.json  — one note per file
 *
 * Usage:
 *   npx tsx scripts/migrate-xlog-comments.ts \
 *     [--backup-dir /path/to/backup/niracler] \
 *     [--character-id 57410] \
 *     [--output comments-import.sql] \
 *     [--dry-run]
 *
 * After reviewing the output, run it against D1:
 *   wrangler d1 execute <DB_NAME> --file=comments-import.sql --remote
 *
 * Schema (migrations/0001_create_comments.sql + 0003_add_comment_user_id.sql):
 *   comments(id TEXT PK, slug TEXT, parent_id TEXT, author TEXT,
 *            email TEXT, website TEXT, content TEXT, ip_hash TEXT,
 *            status TEXT, created_at TEXT, updated_at TEXT, user_id TEXT)
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types matching the Crossbell backup JSON format
// ---------------------------------------------------------------------------

interface NoteMetadataContent {
    title?: string;
    content?: string;
    tags?: string[];
    sources?: string[];
    attributes?: Array<{ trait_type: string; value: string | boolean }>;
    external_url?: string;
    date_published?: string;
}

interface Note {
    characterId: number;
    noteId: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    owner: string;
    // These fields are absent (not null) on blog post notes; present on comment notes
    toCharacterId?: number;
    toNoteId?: number;
    metadata?: {
        content?: NoteMetadataContent;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic UUID-shaped ID from a note's identity so that
 * re-running the script produces the same IDs (enabling INSERT OR IGNORE).
 */
function deterministicId(characterId: number, noteId: number): string {
    const hash = createHash("sha256")
        .update(`xlog-migration:${characterId}:${noteId}`)
        .digest("hex");
    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        `4${hash.slice(13, 16)}`,
        ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
        hash.slice(20, 32),
    ].join("-");
}

function sqlStr(value: string | null): string {
    if (value === null) return "NULL";
    return `'${value.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Load all notes from backup directory
// ---------------------------------------------------------------------------

function loadNotes(backupDir: string): Note[] {
    const notesDir = join(backupDir, "notes");
    const files = readdirSync(notesDir).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
        const raw = readFileSync(join(notesDir, f), "utf-8");
        return JSON.parse(raw) as Note;
    });
}

// ---------------------------------------------------------------------------
// Main migration logic
// ---------------------------------------------------------------------------

function migrate(
    backupDir: string,
    characterId: number,
): {
    sqlInserts: string[];
    skipped: Array<{ noteId: number; reason: string }>;
} {
    const notes = loadNotes(backupDir);
    console.error(`Loaded ${notes.length} notes from backup`);

    // Build noteId -> xlog_slug map for this character's blog posts
    const noteToSlug = new Map<number, string>();
    for (const note of notes) {
        if (note.characterId !== characterId) continue;
        if (note.toCharacterId !== undefined) continue; // skip comment notes (they have toCharacterId)
        const tags = note.metadata?.content?.tags ?? [];
        if (tags.includes("comment")) continue;

        const attrs = note.metadata?.content?.attributes ?? [];
        const slugAttr = attrs.find(
            (a) => a.trait_type === "xlog_slug" && typeof a.value === "string",
        );
        if (slugAttr) {
            noteToSlug.set(note.noteId, slugAttr.value as string);
        }
    }
    console.error(`Resolved ${noteToSlug.size} post slugs`);

    // Build set of noteIds that are comments on this character's blog
    // (needed to resolve parent_id for threaded replies)
    const myCommentNoteIds = new Set<number>();
    for (const note of notes) {
        if (note.toCharacterId === characterId) {
            myCommentNoteIds.add(note.noteId);
        }
    }

    // Index all notes by noteId for chain-walking
    const noteById = new Map<number, Note>();
    for (const note of notes) {
        noteById.set(note.noteId, note);
    }

    // Filter: only comments that point TO this character's notes
    const myComments = notes
        .filter((n) => n.toCharacterId === characterId)
        .sort((a, b) => a.noteId - b.noteId);
    console.error(`Found ${myComments.length} comments on your blog`);

    const skipped: Array<{ noteId: number; reason: string }> = [];
    const sqlInserts: string[] = [];

    for (const note of myComments) {
        const toNoteId = note.toNoteId;
        if (toNoteId === undefined) {
            skipped.push({ noteId: note.noteId, reason: "toNoteId is missing" });
            continue;
        }

        let slug: string | null = null;
        let parentId: string | null = null;

        if (noteToSlug.has(toNoteId)) {
            // Direct reply to a blog post
            slug = noteToSlug.get(toNoteId) ?? "";
        } else if (myCommentNoteIds.has(toNoteId)) {
            // Reply to another comment — walk up the chain to find the post slug
            parentId = deterministicId(characterId, toNoteId);

            let cursor = noteById.get(toNoteId);
            while (cursor) {
                const parentNoteId = cursor.toNoteId;
                if (parentNoteId === undefined) break;
                if (noteToSlug.has(parentNoteId)) {
                    slug = noteToSlug.get(parentNoteId) ?? "";
                    break;
                }
                cursor = noteById.get(parentNoteId);
            }

            if (!slug) {
                skipped.push({
                    noteId: note.noteId,
                    reason: `Reply chain for noteId=${toNoteId} could not resolve to a post slug`,
                });
                continue;
            }
        } else {
            skipped.push({
                noteId: note.noteId,
                reason: `toNoteId=${toNoteId} not in backup (deleted or outside backup range)`,
            });
            continue;
        }

        const content = note.metadata?.content?.content?.trim() ?? "";
        if (!content || content === "该评论已删除") {
            skipped.push({ noteId: note.noteId, reason: "Empty or deleted content" });
            continue;
        }

        const id = deterministicId(characterId, note.noteId);
        const author = "niracler";
        const website = "https://xlog.app/@niracler";

        sqlInserts.push(
            `-- xLog noteId=${note.noteId} -> slug=${slug}` +
                (parentId ? ` parent=${parentId}` : "") +
                "\n" +
                `INSERT OR IGNORE INTO comments (id, slug, parent_id, author, email, website, content, ip_hash, user_id, status, created_at) VALUES (\n` +
                `  ${sqlStr(id)},\n` +
                `  ${sqlStr(slug)},\n` +
                `  ${sqlStr(parentId)},\n` +
                `  ${sqlStr(author)},\n` +
                `  NULL,\n` +
                `  ${sqlStr(website)},\n` +
                `  ${sqlStr(content)},\n` +
                `  NULL,\n` +
                `  NULL,\n` +
                `  'visible',\n` +
                `  ${sqlStr(note.createdAt)}\n` +
                `);`,
        );
    }

    return { sqlInserts, skipped };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): {
    backupDir: string;
    characterId: number;
    output: string | null;
    dryRun: boolean;
} {
    const args = process.argv.slice(2);
    let backupDir = "/Users/sueharakyoko/Documents/Backup_Data/Backup/niracler";
    let characterId = 57410;
    let output: string | null = null;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--backup-dir":
                backupDir = args[++i];
                break;
            case "--character-id":
                characterId = parseInt(args[++i], 10);
                break;
            case "--output":
                output = args[++i];
                break;
            case "--dry-run":
                dryRun = true;
                break;
            default:
                console.error(`Unknown argument: ${args[i]}`);
        }
    }

    return { backupDir, characterId, output, dryRun };
}

function main() {
    const { backupDir, characterId, output, dryRun } = parseArgs();

    console.error(`\nxLog Comment Migration`);
    console.error(`  Backup dir:   ${backupDir}`);
    console.error(`  Character ID: ${characterId}`);
    console.error(
        `  Mode:         ${dryRun ? "dry-run (no output)" : output ? `SQL -> ${output}` : "SQL -> stdout"}`,
    );
    console.error("");

    const { sqlInserts, skipped } = migrate(backupDir, characterId);

    console.error(`\nResults:`);
    console.error(`  Migrated: ${sqlInserts.length}`);
    console.error(`  Skipped:  ${skipped.length}`);

    if (skipped.length > 0) {
        console.error("\n  Skipped details:");
        for (const s of skipped) {
            console.error(`    noteId=${s.noteId}: ${s.reason}`);
        }
    }

    if (dryRun) {
        console.error("\nDry-run complete. Pass --output <file.sql> to write SQL.");
        return;
    }

    const lines = [
        "-- xLog comment migration",
        `-- Generated: ${new Date().toISOString()}`,
        `-- Character ID: ${characterId}`,
        `-- Backup dir:   ${backupDir}`,
        `-- Total:        ${sqlInserts.length} comments`,
        "--",
        "-- Review this file before running:",
        "--   wrangler d1 execute <DB_NAME> --file=comments-import.sql --remote",
        "--",
        "",
        "BEGIN TRANSACTION;",
        "",
        ...sqlInserts.map((s) => `${s}\n`),
        "COMMIT;",
        "",
    ];

    const sql = lines.join("\n");

    if (output) {
        writeFileSync(output, sql, "utf-8");
        console.error(`\nSQL written to: ${output}`);
        console.error(`Run with:`);
        console.error(`  wrangler d1 execute <DB_NAME> --file=${output} --remote`);
    } else {
        process.stdout.write(sql);
    }
}

main();
