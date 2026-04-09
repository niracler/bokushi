/**
 * Netease Cloud Music API client using LinuxAPI encryption.
 * Uses aes-js for AES-128-ECB (pure JS, no node:crypto dependency).
 */
// @ts-expect-error aes-js has no type declarations
import aesjs from "aes-js";

export interface MetingSong {
    title: string;
    artist: string;
    pic: string;
    url: string;
    lrc: string;
}

function httpsify(url: string): string {
    return url.replace(/^http:\/\//, "https://");
}

// LinuxAPI AES key: hex "7246674226682325323F5E6544673A51" = "rFgB&h#%2?^eDg:Q"
const LINUX_API_KEY = [
    0x72, 0x46, 0x67, 0x42, 0x26, 0x68, 0x23, 0x25, 0x32, 0x3f, 0x5e, 0x65, 0x44, 0x67, 0x3a, 0x51,
];
const LINUX_API_URL = "https://music.163.com/api/linux/forward";
const LINUX_USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36";

function pkcs7Pad(data: Uint8Array): Uint8Array {
    const padLen = 16 - (data.length % 16);
    const padded = new Uint8Array(data.length + padLen);
    padded.set(data);
    for (let i = data.length; i < padded.length; i++) padded[i] = padLen;
    return padded;
}

function linuxApiEncrypt(payload: object): string {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    const padded = pkcs7Pad(json);
    const ecb = new aesjs.ModeOfOperation.ecb(LINUX_API_KEY);
    const encrypted = ecb.encrypt(padded);
    return aesjs.utils.hex.fromBytes(encrypted).toUpperCase();
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

async function getSongUrls(ids: number[]): Promise<Record<number, string>> {
    if (ids.length === 0) return {};
    const result = await linuxApiRequest<SongUrlResponse>("/api/song/enhance/player/url", {
        ids,
        br: 320000,
    });
    const map: Record<number, string> = {};
    for (const item of result.data ?? []) {
        if (item.url) map[item.id] = httpsify(item.url);
    }
    return map;
}

export async function getSongUrl(id: string): Promise<string> {
    const urls = await getSongUrls([Number(id)]);
    return urls[Number(id)] ?? "";
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

    const numericIds = songs.map((s) => s.id);
    const [urlMap, lyrics] = await Promise.all([
        getSongUrls(numericIds),
        Promise.all(ids.map((id) => getSongLrc(id))),
    ]);

    return songs.map((song, i) => ({
        title: song.name,
        artist: song.ar.map((a) => a.name).join(" / "),
        pic: httpsify(song.al.picUrl ?? ""),
        url: urlMap[song.id] ?? "",
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
    const numericIds = tracks.map((t) => t.id);
    const urlMap = await getSongUrls(numericIds);

    return tracks.map((track) => ({
        title: track.name,
        artist: track.ar.map((a) => a.name).join(" / "),
        pic: httpsify(track.al.picUrl ?? ""),
        url: urlMap[track.id] ?? "",
        lrc: `/api/meting?type=lrc&id=${track.id}&format=text`,
    }));
}
