import { DurableObject } from "cloudflare:workers";
import { fetchTelegramChannel, fetchTelegramPost } from "../../utils/telegram";
import { CHANNEL, isChannelCursor } from "./client";
import { MEDIA_PATH, preparePost } from "./media";
import { ArchiveMedia } from "./objects.js";

const HOUR = 3_600_000;
const WEEK = 168 * HOUR;

export class ChannelArchive extends DurableObject {
    writer = Promise.resolve();

    constructor(ctx, env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.media = new ArchiveMedia(this.sql, env.CHANNEL_MEDIA);
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, data TEXT, revision INTEGER NOT NULL DEFAULT 0);
            INSERT OR IGNORE INTO profile(id) VALUES(1);
            CREATE TABLE IF NOT EXISTS pages (cursor TEXT PRIMARY KEY, ids TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, data TEXT NOT NULL, audit INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS posts_audit ON posts(audit);
            CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, source TEXT, fetched INTEGER NOT NULL, due INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS jobs_due ON jobs(due);
            CREATE TABLE IF NOT EXISTS assets (key TEXT PRIMARY KEY, size INTEGER NOT NULL, type TEXT NOT NULL, ready INTEGER NOT NULL, object_key TEXT);
            CREATE TABLE IF NOT EXISTS refs (owner TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY(owner,key));
            CREATE INDEX IF NOT EXISTS refs_asset ON refs(key);
        `);
    }

    // Snapshot reads stay available while a writer awaits Telegram or R2.
    async write(operation) {
        const previous = this.writer;
        let release;
        this.writer = new Promise((resolve) => {
            release = resolve;
        });
        await previous;
        try {
            return await operation();
        } finally {
            release();
        }
    }

    revision() {
        return this.sql.exec("SELECT revision FROM profile WHERE id=1").one().revision;
    }

    assetInfo(key) {
        return (
            this.sql
                .exec(
                    "SELECT size,type,COALESCE(object_key,key) AS objectKey FROM assets WHERE key=? AND ready=1 AND EXISTS (SELECT 1 FROM refs WHERE key=? AND owner NOT LIKE 'pending:%')",
                    key,
                    key,
                )
                .toArray()[0] ?? null
        );
    }

    readPage(cursor) {
        const page = this.sql.exec("SELECT ids FROM pages WHERE cursor=?", cursor).toArray()[0];
        if (!page) return null;
        const profile = JSON.parse(this.sql.exec("SELECT data FROM profile WHERE id=1").one().data);
        const posts = this.sql
            .exec(
                "SELECT data FROM json_each(?) JOIN posts ON posts.id=json_each.value ORDER BY CAST(json_each.key AS INTEGER)",
                page.ids,
            )
            .toArray()
            .map(({ data }) => JSON.parse(data));
        const ids = JSON.parse(page.ids);
        return { ...profile, posts, firstId: ids[0], lastId: ids.at(-1) };
    }

    async page(cursor) {
        if (!isChannelCursor(cursor)) throw new Error("Invalid channel cursor");
        const stored = this.readPage(cursor);
        if (stored) return stored;
        return this.write(async () => {
            const existing = this.readPage(cursor);
            if (existing) return existing;
            // Permit old bookmarks while preventing arbitrary invented cursors from creating pages.
            const boundary = cursor.split("-")[1];
            if (
                boundary &&
                !this.sql.exec("SELECT id FROM posts WHERE id=?", boundary).toArray().length &&
                !(await fetchTelegramPost(CHANNEL, boundary))
            )
                return null;
            await this.refreshPage(cursor);
            return this.readPage(cursor);
        });
    }

    async refreshHome() {
        await this.write(async () => {
            // Schedule cleanup and due jobs even if the upstream homepage is unavailable.
            await this.ctx.storage.setAlarm(Date.now() + 1000);
            this.sql.exec(
                "INSERT OR IGNORE INTO jobs SELECT id,NULL,0,? FROM posts WHERE audit<=?",
                Date.now(),
                Date.now(),
            );
            await this.refreshPage("home", 30_000);
        });
    }

    replaceRefs(owner, keys) {
        this.sql.exec("DELETE FROM refs WHERE owner=?", owner);
        for (const key of keys)
            this.sql.exec("INSERT INTO refs(owner,key) VALUES(?,?)", owner, key);
    }

    async publish(post) {
        // Keep successfully copied pictures across retries of an incomplete album.
        const staging = `pending:${post.id}`;
        const prepared = await preparePost(
            post,
            async (url) => {
                const saved = await this.media.copy(url);
                this.sql.exec(
                    "INSERT OR IGNORE INTO refs(owner,key) VALUES(?,?)",
                    staging,
                    saved.slice(MEDIA_PATH.length),
                );
                return saved;
            },
            (url) => this.media.copy(url, true),
        );
        const data = JSON.stringify(prepared.post);
        const audit = Date.now() + WEEK - (1 + (Number(post.id) % 24)) * HOUR;
        this.ctx.storage.transactionSync(() => {
            const old = this.sql.exec("SELECT data FROM posts WHERE id=?", post.id).toArray()[0];
            this.sql.exec("INSERT OR REPLACE INTO posts VALUES(?,?,?)", post.id, data, audit);
            this.replaceRefs(post.id, prepared.assets);
            this.replaceRefs(staging, []);
            this.sql.exec("DELETE FROM jobs WHERE id=?", post.id);
            if (old?.data !== data)
                this.sql.exec("UPDATE profile SET revision=revision+1 WHERE id=1");
        });
    }

    async refreshPage(cursor, timeoutMs = 8_000) {
        const [direction, id] = cursor.split("-");
        const options = { minPosts: 40, ...(id && { [direction]: id }) };
        const { title, description, avatar, posts } = await fetchTelegramChannel(CHANNEL, options, {
            timeoutMs,
        });
        if (!title || (cursor === "home" && !posts.length))
            throw new Error("Incomplete Telegram channel page");
        const previousProfile = this.sql.exec("SELECT data FROM profile WHERE id=1").one().data;
        let profile = previousProfile;
        if (cursor === "home" || !profile) {
            const previousAvatar = previousProfile && JSON.parse(previousProfile).avatar;
            let image = previousAvatar || "";
            if (avatar) {
                try {
                    image = await this.media.copy(avatar);
                } catch (error) {
                    // A missing avatar must not prevent publishing unrelated ready posts.
                    console.warn("Channel avatar deferred", error.message);
                }
            }
            profile = JSON.stringify({ title, description, avatar: image });
        }
        await this.ctx.storage.setAlarm(Date.now() + 1000);
        const now = Date.now();
        const ids = posts.map((post) => post.id);
        // Publish text immediately. A brand-new page also waits for its first usable media post
        // if necessary. Remaining media jobs are resumed in bounded batches by durable alarms.
        let hasContent = false;
        const pendingMedia = [];
        for (const post of posts) {
            if (this.sql.exec("SELECT id FROM posts WHERE id=?", post.id).toArray().length) {
                hasContent = true;
                if (cursor !== "home") continue;
            }
            this.sql.exec(
                "INSERT OR REPLACE INTO jobs VALUES(?,?,?,?)",
                post.id,
                JSON.stringify(post),
                now,
                now,
            );
            const needsMedia =
                post.missingPhoto ||
                post.photos?.length ||
                post.video ||
                post.replyInfo?.replyToThumb ||
                post.linkPreview?.imageUrl ||
                post.content.includes("<img") ||
                post.textHtml?.includes("<img");
            if (needsMedia) pendingMedia.push(post);
            else if (await this.process(post.id, post)) hasContent = true;
        }
        if (!hasContent) {
            for (const post of pendingMedia) {
                if (await this.process(post.id, post)) {
                    hasContent = true;
                    break;
                }
            }
        }
        if (ids.length && !hasContent) throw new Error("Channel page has no complete posts yet");
        this.ctx.storage.transactionSync(() => {
            const oldProfile = this.sql.exec("SELECT data FROM profile WHERE id=1").one().data;
            const previous = this.sql
                .exec("SELECT ids FROM pages WHERE cursor=?", cursor)
                .toArray()[0]?.ids;
            // Absence inside the current window is not proof of deletion. Keep that post
            // visible until its own embed confirms removal or supplies an updated copy.
            if (previous && ids.length) {
                const oldest = Number(ids.at(-1));
                const newest = Number(ids[0]);
                for (const id of JSON.parse(previous)) {
                    if (Number(id) < oldest || Number(id) > newest || ids.includes(id)) continue;
                    if (!this.sql.exec("SELECT id FROM posts WHERE id=?", id).toArray().length)
                        continue;
                    ids.push(id);
                    this.sql.exec("INSERT OR IGNORE INTO jobs VALUES(?,NULL,0,?)", id, now);
                }
                ids.sort((a, b) => Number(b) - Number(a));
            }
            const members = JSON.stringify(ids);
            const profileImage = JSON.parse(profile).avatar;
            this.sql.exec("INSERT OR REPLACE INTO pages VALUES(?,?)", cursor, members);
            this.replaceRefs(
                "profile",
                profileImage ? [profileImage.slice(MEDIA_PATH.length)] : [],
            );
            if (previous !== members || oldProfile !== profile) {
                this.sql.exec("UPDATE profile SET data=?,revision=revision+1 WHERE id=1", profile);
            }
        });
    }

    async process(id, source) {
        try {
            const post = source ?? (await fetchTelegramPost(CHANNEL, id));
            if (post) {
                await this.publish(post);
            } else {
                this.ctx.storage.transactionSync(() => {
                    this.replaceRefs(id, []);
                    this.replaceRefs(`pending:${id}`, []);
                    this.sql.exec("DELETE FROM posts WHERE id=?", id);
                    this.sql.exec("DELETE FROM jobs WHERE id=?", id);
                    this.sql.exec("UPDATE profile SET revision=revision+1 WHERE id=1");
                });
            }
            return true;
        } catch (error) {
            // Retain the prior complete post; retry with fresh signed URLs.
            console.warn("Channel sync deferred", id, error.message);
            this.sql.exec("UPDATE jobs SET source=NULL,due=? WHERE id=?", Date.now() + HOUR, id);
            return false;
        }
    }

    async alarm() {
        await this.write(async () => {
            const jobs = this.sql
                .exec(
                    "SELECT * FROM jobs WHERE due<=? ORDER BY due, CAST(id AS INTEGER) DESC LIMIT 4",
                    Date.now(),
                )
                .toArray();
            for (const job of jobs) {
                const fresh = job.source && Date.now() - job.fetched < HOUR;
                await this.process(job.id, fresh ? JSON.parse(job.source) : null);
            }
            await this.media.collect();
            const { due } = this.sql.exec("SELECT MIN(due) AS due FROM jobs").one();
            if (due !== null) await this.ctx.storage.setAlarm(Math.max(due, Date.now() + 100));
        });
    }
}
