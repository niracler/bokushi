export const CHANNEL_FALLBACK_TIME_ZONE = "Asia/Shanghai";

export function channelDayFormatter(timeZone?: string): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
    });
}

export function channelClockFormatter(timeZone?: string): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
}

export function channelDay(formatter: Intl.DateTimeFormat, instant: Date) {
    const { year, month, day, weekday } = Object.fromEntries(
        formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
    );
    return {
        date: `${year}-${month}-${day}`,
        monthAnchor: `m-${year}-${month}`,
        monthLabel: `${year}·${month}`,
        day,
        dayLabel: `${month}·${day}`,
        weekday: weekday.toUpperCase(),
    };
}
