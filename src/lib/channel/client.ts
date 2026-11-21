export const CHANNEL = "tomoko_channel";

export function archive(env: Env) {
    return env.CHANNEL_ARCHIVE.getByName(CHANNEL);
}

export function isChannelCursor(cursor: string) {
    return cursor === "home" || /^(before|after)-[1-9]\d{0,9}$/.test(cursor);
}
