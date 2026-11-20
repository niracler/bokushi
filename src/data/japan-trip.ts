import {
    buildTrip,
    getTripSummary,
    type PlaceMarker,
    shapeTripData,
    type TripDefinition,
    type TripLocation,
} from "@hyoban/trip-map";
import days from "./japan-2025.json";

export const tripId = "2025-japan";
export const basePath = "/trips/japan-2025";
const locations = new Map<string, TripLocation>();
const byId = new Map<string, TripLocation>();
const travel: NonNullable<TripDefinition["straightLegs"]>[number][] = [];
let previous: TripLocation | undefined;

export const entries = days.flatMap((day, dayIndex) =>
    day.stops.map((stop, stopIndex) => {
        const coordinates = `${stop.lat},${stop.lng}`;
        let place = locations.get(coordinates);
        if (!place) {
            place = {
                id: `place-${locations.size + 1}`,
                name: stop.name,
                latitude: stop.lat,
                longitude: stop.lng,
            };
            locations.set(coordinates, place);
            byId.set(place.id, place);
        }
        if (previous && (stop.arrivedBy === "plane" || stop.arrivedBy === "train")) {
            travel.push([previous.id, place.id, stop.arrivedBy]);
        }
        previous = place;
        const dateKey = stop.dateKey ?? `2025-${day.date.slice(0, 5).replace(".", "-")}`;
        return {
            dateKey,
            occurredAt: dateKey,
            locations: [{ ...place, name: stop.name }],
            anchor: `d${dayIndex}-${stopIndex + 1}`,
            article: `/2510/#${day.anchor}`,
            dayTitle: day.title,
            name: stop.name,
            text: stop.note,
            images: stop.photos.map(({ key, caption, width, height }) => {
                const thumbnail = `https://image.niracler.com/trips/japan-2025/${key}/preview.jpg`;
                const src = `${basePath}/photo/${key}`;
                const previewWidth = Math.round(width * Math.min(1, 1200 / width, 1000 / height));
                return {
                    src,
                    thumbnail,
                    width,
                    height,
                    alt: caption,
                    srcset: `${thumbnail} ${previewWidth}w, ${src} ${width}w`,
                };
            }),
        };
    }),
);

const built = buildTrip(
    {
        id: tripId,
        title: "日本七日记",
        start: "2025-09-28",
        end: "2025-10-07",
        straightLegs: travel,
    },
    entries,
    {
        resolveLocation: (id) => {
            const found = byId.get(id);
            if (!found) throw new Error(`Unknown trip location: ${id}`);
            return found;
        },
    },
);
// The diary records visits and flights, but contains no odometer readings.
export const covers = ["平等院", "超级任天堂世界", "秋叶原 RADIO 会馆"].flatMap((name) => {
    const point = entries.find((entry) => entry.name === name);
    return point?.images.slice(0, 1) ?? [];
});
export const trip = shapeTripData(
    { ...built, drivingKm: 0, drivingHours: 0 },
    {
        covers,
        describeStop: (entry) => ({
            anchor: entry.anchor,
            href: entry.article,
            text: entry.text,
            images: entry.images,
        }),
    },
);
export const summary = getTripSummary(built);
export const markers: PlaceMarker[] = Array.from(locations.values(), (place) => {
    const visits = entries.filter((entry) => entry.locations[0].id === place.id);
    return {
        ...place,
        count: visits.length,
        firstYear: 2025,
        years: [2025],
        months: [...new Set(visits.map((v) => v.dateKey.slice(0, 7)))],
        color: "#303631",
        photo: visits.flatMap((v) => v.images)[0]?.thumbnail,
    };
});
export const dates = [...new Set(entries.map((entry) => entry.dateKey))];
