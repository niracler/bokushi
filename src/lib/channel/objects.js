import { MEDIA_PATH, mediaSource, OBJECT_PREFIX, VIDEO_BUDGET, VIDEO_LIMIT } from "./media";

const raster = /^image\/(jpeg|png|webp|gif|avif)$/;
const movie = /^video\/(mp4|webm|quicktime)$/;

async function digest(value) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function metadata(response, url, video) {
    let type = response.headers.get("content-type")?.split(";")[0].toLowerCase();
    if (video && type === "application/octet-stream") type = "video/mp4";
    if (!(video ? movie : raster).test(type ?? "")) throw new Error("Unexpected media type");
    const length = response.headers.get("content-length");
    const size = length === null ? null : Number(length);
    if (size !== null && (!Number.isSafeInteger(size) || size <= 0))
        throw new Error("Invalid media length");
    const tag = response.headers.get("etag");
    // Telegram uses content fingerprints for its signed CDN links. Ordinary ETags are scoped to the URL.
    const scope = /^"[0-9a-f]{32,128}"$/i.test(tag ?? "") ? url.origin : url.href;
    const identity = tag && !tag.startsWith("W/") ? [scope, tag, size, type] : null;
    return { type, size, identity };
}

// Called by the archive's single writer. Reserve space before writing R2 so a restart cannot
// create an unaccounted video. Unpublished objects are reaped by the next maintenance pass.
export class ArchiveMedia {
    constructor(sql, bucket) {
        this.sql = sql;
        this.bucket = bucket;
    }

    async copy(value, video = false) {
        const url = mediaSource(value);
        const options = { redirect: "manual", signal: AbortSignal.timeout(30_000) };
        const head = await fetch(url, { ...options, method: "HEAD" });
        if (!head.ok && head.status !== 405) throw new Error(`Media HEAD returned ${head.status}`);
        const budget = video
            ? VIDEO_BUDGET -
              this.sql
                  .exec(
                      "SELECT COALESCE(SUM(size),0) AS bytes FROM assets WHERE type LIKE 'video/%'",
                  )
                  .one().bytes
            : Infinity;
        if (head.ok) {
            const info = metadata(head, url, video);
            if (info.identity) {
                const key = await digest(JSON.stringify(info.identity));
                if (this.ready(key)) return MEDIA_PATH + key;
            }
            if (video && info.size !== null && info.size > Math.min(VIDEO_LIMIT, budget))
                return null;
        }

        const response = await fetch(url, options);
        if (!response.ok || !response.body)
            throw new Error(`Media GET returned ${response.status}`);
        const info = metadata(response, url, video);
        const key = await digest(
            info.identity ? JSON.stringify(info.identity) : crypto.randomUUID(),
        );
        if (this.ready(key)) {
            await response.body.cancel();
            return MEDIA_PATH + key;
        }
        let body = response.body;
        if (video) {
            const limit = Math.min(VIDEO_LIMIT, budget);
            if (info.size !== null && info.size > limit) {
                await body.cancel();
                return null;
            }
            if (info.size === null) {
                const reader = body.getReader();
                const chunks = [];
                let length = 0;
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > limit) {
                        await reader.cancel();
                        return null;
                    }
                    chunks.push(value);
                }
                body = new Blob(chunks);
                info.size = length;
            }
        }

        this.sql.exec(
            "INSERT OR REPLACE INTO assets(key,type,size,ready) VALUES(?,?,?,0)",
            key,
            info.type,
            info.size ?? 0,
        );
        const object = await this.bucket.put(OBJECT_PREFIX + key, body, {
            httpMetadata: { contentType: info.type },
        });
        if (video && (object.size !== info.size || object.size > Math.min(VIDEO_LIMIT, budget))) {
            await this.bucket.delete(OBJECT_PREFIX + key);
            throw new Error("Stored video length differs from the reserved length");
        }
        // Without an upstream validator we must read the file to detect edits. A single-part
        // R2 upload supplies a content ETag, so identical bytes still share one published URL.
        const publishedKey = info.identity
            ? key
            : await digest(JSON.stringify([info.type, object.size, object.etag]));
        if (publishedKey !== key && this.ready(publishedKey)) {
            // This temporary reservation has no references and will be collected.
            return MEDIA_PATH + publishedKey;
        }
        this.sql.exec(
            "UPDATE assets SET key=?,object_key=?,size=?,ready=1 WHERE key=?",
            publishedKey,
            key,
            object.size,
            key,
        );
        return MEDIA_PATH + publishedKey;
    }

    ready(key) {
        return (
            this.sql.exec("SELECT key FROM assets WHERE key=? AND ready=1", key).toArray().length >
            0
        );
    }

    async collect() {
        const unused = this.sql
            .exec(
                "SELECT key,COALESCE(object_key,key) AS objectKey FROM assets WHERE NOT EXISTS (SELECT 1 FROM refs WHERE refs.key=assets.key)",
            )
            .toArray();
        for (const { key, objectKey } of unused) {
            // After a crash between the two deletes, a later writer must upload this key again.
            this.sql.exec("UPDATE assets SET ready=0 WHERE key=?", key);
            await this.bucket.delete(OBJECT_PREFIX + objectKey);
            this.sql.exec("DELETE FROM assets WHERE key=?", key);
        }
    }
}
