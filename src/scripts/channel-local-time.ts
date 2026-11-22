import {
    CHANNEL_FALLBACK_TIME_ZONE,
    channelClockFormatter,
    channelDay,
    channelDayFormatter,
} from "../utils/channel-time";

export function localizeChannelDates(): void {
    const calendar = channelDayFormatter();
    if (calendar.resolvedOptions().timeZone === CHANNEL_FALLBACK_TIME_ZONE) return;

    const list = document.querySelector(".day-list");
    const section = list?.querySelector(".day-group");
    const divider = section?.querySelector(".day");
    const feed = section?.querySelector(".feed");
    if (!list || !section || !divider || !feed) return;

    const clock = channelClockFormatter();
    const groups = new Map<string, { day: ReturnType<typeof channelDay>; cards: HTMLElement[] }>();
    for (const time of list.querySelectorAll<HTMLTimeElement>(".tg-bubble__date > time")) {
        const card = time.closest("article");
        const instant = new Date(time.dateTime);
        if (!card || Number.isNaN(instant.getTime())) continue;

        time.textContent = clock.format(instant);
        const day = channelDay(calendar, instant);
        let group = groups.get(day.date);
        if (!group) {
            group = { day, cards: [] };
            groups.set(day.date, group);
        }
        group.cards.push(card);
    }
    if (groups.size === 0) return;

    const days = [...groups.values()].sort((a, b) => b.day.date.localeCompare(a.day.date));
    const months = new Set<string>();
    const localized = document.createDocumentFragment();
    for (const { day, cards } of days) {
        const localSection = section.cloneNode(false) as HTMLElement;
        const localDivider = divider.cloneNode(true) as HTMLElement;
        const localFeed = feed.cloneNode(false) as HTMLElement;
        const firstOfMonth = !months.has(day.monthAnchor);
        months.add(day.monthAnchor);
        localDivider.classList.toggle("day--month-anchor", firstOfMonth);
        if (firstOfMonth) localDivider.id = day.monthAnchor;
        else localDivider.removeAttribute("id");

        const dateLabel = localDivider.querySelector(".day__date");
        const weekdayLabel = localDivider.querySelector(".day__wk");
        if (dateLabel) dateLabel.textContent = day.dayLabel;
        if (weekdayLabel) weekdayLabel.textContent = day.weekday;
        localFeed.append(...cards);
        localSection.append(localDivider, localFeed);
        localized.append(localSection);
    }
    list.replaceChildren(localized);

    const monthLabel = document.querySelector("[data-channel-month]");
    if (monthLabel) monthLabel.textContent = ` · ${days[0].day.monthLabel}`;

    const target = document.getElementById(location.hash.slice(1));
    if (target && list.contains(target)) target.scrollIntoView();
}
