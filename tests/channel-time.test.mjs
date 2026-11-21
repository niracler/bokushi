import assert from "node:assert/strict";
import test from "node:test";
import { channelClockFormatter } from "../src/utils/channel-time.ts";
import { groupPostsByDay } from "../src/utils/telegram.ts";

test("channel dates and times follow the same time zone across midnight and month boundaries", () => {
    const post = { datetime: "2026-07-01T00:00:00Z" };
    const instant = new Date(post.datetime);
    for (const [zone, time, date, weekday, monthAnchor] of [
        ["Asia/Shanghai", "08:00", "2026-07-01", "WED", "m-2026-07"],
        ["America/Los_Angeles", "17:00", "2026-06-30", "TUE", "m-2026-06"],
        ["UTC", "00:00", "2026-07-01", "WED", "m-2026-07"],
    ]) {
        const [group] = groupPostsByDay([post], zone);
        assert.equal(channelClockFormatter(zone).format(instant), time);
        assert.equal(group.date, date);
        assert.equal(group.weekday, weekday);
        assert.equal(group.monthAnchor, monthAnchor);
        assert.deepEqual(group.posts, [post]);
    }
});

test("channel times respect daylight saving and fractional offsets", () => {
    const winter = new Date("2026-01-01T12:00:00Z");
    const summer = new Date("2026-07-01T12:00:00Z");
    const losAngeles = channelClockFormatter("America/Los_Angeles");

    assert.equal(losAngeles.format(winter), "04:00");
    assert.equal(losAngeles.format(summer), "05:00");
    assert.equal(channelClockFormatter("Asia/Kolkata").format(summer), "17:30");
});
