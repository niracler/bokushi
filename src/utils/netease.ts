import crypto from "node:crypto";

export interface MetingSong {
    title: string;
    artist: string;
    pic: string;
    url: string;
    lrc: string;
}

const LINUX_API_KEY = new Uint8Array(Buffer.from("7246674226682325323F5E6544673A51", "hex"));
const LINUX_API_URL = "https://music.163.com/api/linux/forward";
const LINUX_USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36";

function linuxApiEncrypt(payload: object): string {
    const json = JSON.stringify(payload);
    const cipher = crypto.createCipheriv("aes-128-ecb", LINUX_API_KEY, null);
    let encrypted = cipher.update(json, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted.toUpperCase();
}

async function linuxApiRequest<T>(url: string, data: object): Promise<T> {
    const payload = {
        method: "POST",
        url: `https://music.163.com${url}`,
        params: data,
    };

    const eparams = linuxApiEncrypt(payload);

    const response = await fetch(LINUX_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": LINUX_USER_AGENT,
            Referer: "https://music.163.com",
            Cookie: "os=pc",
        },
        body: `eparams=${eparams}`,
    });

    return response.json() as Promise<T>;
}

interface SongDetailResponse {
    songs: Array<{
        name: string;
        ar: Array<{ name: string }>;
        al: { picUrl: string };
        id: number;
    }>;
}

interface SongUrlResponse {
    data: Array<{
        id: number;
        url: string | null;
    }>;
}

interface SongLrcResponse {
    lrc?: {
        lyric: string;
    };
}

export async function getSongUrl(id: string): Promise<string> {
    const result = await linuxApiRequest<SongUrlResponse>("/api/song/enhance/player/url", {
        ids: [Number(id)],
        br: 320000,
    });
    return result.data?.[0]?.url ?? "";
}

export async function getSongLrc(id: string): Promise<string> {
    const result = await linuxApiRequest<SongLrcResponse>("/api/song/lyric", {
        id: Number(id),
        os: "linux",
        lv: -1,
        kv: -1,
        tv: -1,
    });
    return result.lrc?.lyric ?? "";
}

export async function getSongDetail(ids: string[]): Promise<MetingSong[]> {
    const c = JSON.stringify(ids.map((id) => ({ id: Number(id) })));
    const detail = await linuxApiRequest<SongDetailResponse>("/api/v3/song/detail", { c });

    const songs = detail.songs ?? [];

    const [urls, lyrics] = await Promise.all([
        Promise.all(ids.map((id) => getSongUrl(id))),
        Promise.all(ids.map((id) => getSongLrc(id))),
    ]);

    return songs.map((song, i) => ({
        title: song.name,
        artist: song.ar.map((a) => a.name).join(" / "),
        pic: song.al.picUrl ?? "",
        url: urls[i] ?? "",
        lrc: lyrics[i] ?? "",
    }));
}

interface PlaylistDetailResponse {
    playlist: {
        tracks: Array<{
            name: string;
            ar: Array<{ name: string }>;
            al: { picUrl: string };
            id: number;
        }>;
    };
}

export async function getPlaylistDetail(id: string): Promise<MetingSong[]> {
    const detail = await linuxApiRequest<PlaylistDetailResponse>("/api/v3/playlist/detail", {
        id: Number(id),
        n: 100000,
    });

    const tracks = detail.playlist?.tracks ?? [];
    const trackIds = tracks.map((t) => String(t.id));

    const urls = await Promise.all(trackIds.map((tid) => getSongUrl(tid)));

    return tracks.map((track, i) => ({
        title: track.name,
        artist: track.ar.map((a) => a.name).join(" / "),
        pic: track.al.picUrl ?? "",
        url: urls[i] ?? "",
        lrc: "",
    }));
}
