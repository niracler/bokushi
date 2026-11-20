import {
    buildTrip,
    getLegKey,
    getTripSummary,
    type PlaceMarker,
    shapeTripData,
    type TravelMode,
    type TripLocation,
    type TripRoute,
} from "@hyoban/trip-map";
import itinerary from "./japan-2025.json" with { type: "json" };
import { streetRoutes } from "./japan-streets";
import { transitSections, transitStops } from "./japan-transit";

interface DiaryStop {
    name: string;
    lat: number;
    lng: number;
    note: string;
    photos: { key: string; caption: string; width: number; height: number }[];
    dateKey?: string;
    anchor?: string;
    arrivedBy?: string;
    localTransport?: string;
    transit?: string;
    rides?: string[][];
}
const days: {
    date: string;
    key: string;
    title: string;
    anchor: string;
    localTransport?: string;
    stops: DiaryStop[];
}[] = itinerary;

export const tripId = "2025-japan";
export const basePath = "/trips/japan-2025";
const locations = new Map<string, TripLocation>();
const byId = new Map<string, TripLocation>();
const legModes: TravelMode[] = [];
function placeAt(name: string, lng: number, lat: number): TripLocation {
    const coordinates = `${lat},${lng}`;
    let place = locations.get(coordinates);
    if (!place) {
        place = { id: `place-${locations.size + 1}`, name, latitude: lat, longitude: lng };
        locations.set(coordinates, place);
        byId.set(place.id, place);
    }
    return place;
}

// Register the original diary stops first to preserve published /map#place-N links.
for (const day of days) {
    for (const stop of day.stops) {
        if (!stop.anchor) placeAt(stop.name, stop.lng, stop.lat);
    }
}
function station(name: string) {
    const [lng, lat] = transitStops[name];
    return { ...placeAt(name, lng, lat), name };
}

const transitRoutes = new Map<string, { mode: "train" | "bus" | "plane"; route: TripRoute }>();
for (const { fromStation, toStation, mode, route } of transitSections) {
    const from = station(fromStation);
    const to = station(toStation);
    transitRoutes.set(getLegKey(from, to), { mode, route });
    if (mode === "train") {
        transitRoutes.set(getLegKey(to, from), {
            mode,
            route: { ...route, coordinates: [...route.coordinates].reverse() },
        });
    }
}
let previous: TripLocation | undefined;
export const entries = days.flatMap((day) => {
    let originalIndex = 0;
    return day.stops.map((stop) => {
        const destination = { ...placeAt(stop.name, stop.lng, stop.lat), name: stop.name };
        const points: TripLocation[] = [];
        function arrive(point: TripLocation, mode: TravelMode) {
            if (previous) legModes.push(mode);
            points.push(point);
            previous = point;
        }
        for (const [fromName, toName] of stop.rides ?? []) {
            const from = station(fromName);
            const to = station(toName);
            const transit = transitRoutes.get(getLegKey(from, to));
            if (!transit)
                throw new Error(`Missing public transport section: ${fromName} → ${toName}`);
            if (previous?.id !== from.id) arrive(from, "visit");
            arrive(to, transit.mode);
        }
        if (points.length && previous?.id === destination.id) {
            points[points.length - 1] = destination;
        } else {
            const mode = stop.rides ? "visit" : (stop.arrivedBy ?? "visit");
            if (
                mode !== "train" &&
                mode !== "bus" &&
                mode !== "visit" &&
                mode !== "plane" &&
                mode !== "car"
            ) {
                throw new Error(`Unknown transport mode: ${mode}`);
            }
            arrive(destination, mode);
        }
        const dateKey = stop.dateKey ?? `2025-${day.date.slice(0, 5).replace(".", "-")}`;
        const access = stop.localTransport ?? day.localTransport;
        const localLabel = access === "bus" ? "市内巴士" : "轨道交通";
        const transit =
            access && stop.arrivedBy === "visit" ? `${localLabel} · ${stop.transit}` : stop.transit;
        return {
            dateKey,
            occurredAt: dateKey,
            locations: points,
            destination,
            via: points.slice(0, -1),
            access,
            transit,
            anchor: stop.anchor ?? `${day.key}-${++originalIndex}`,
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
    });
});

const itineraryTrip = buildTrip(
    {
        id: tripId,
        title: "日本七日记",
        start: entries[0].dateKey,
        end: entries[entries.length - 1].dateKey,
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
// Transport belongs to a visit, not to a pair of places: the return can use a different mode.
const built = {
    ...itineraryTrip,
    drivingKm: 0,
    drivingHours: 0,
    legs: itineraryTrip.legs.map((leg, index) => {
        const by = legModes[index];
        const key = getLegKey(leg.from, leg.to);
        const route = transitRoutes.get(key)?.route ?? streetRoutes[key];
        if (!route && by !== "plane" && leg.from.id !== leg.to.id) {
            throw new Error(`Missing ground route: ${leg.from.name} → ${leg.to.name}`);
        }
        return { ...leg, by, route };
    }),
};
// The diary records visits and flights, but contains no odometer readings.
export const covers = ["平等院", "超级任天堂世界", "秋叶原 RADIO 会馆"].flatMap((name) => {
    const point = entries.find((entry) => entry.name === name);
    return point?.images.slice(0, 1) ?? [];
});
export const trip = shapeTripData(
    {
        ...built,
        // Stations on the way animate along the route without becoming photo stops.
        stops: built.stops.map((stop) => ({
            ...stop,
            locations: [stop.destination],
            waypoints: stop.via.map((location) => ({ dateKey: stop.dateKey, location })),
        })),
    },
    {
        covers,
        describeStop: (entry) => ({
            anchor: entry.anchor,
            access: entry.access,
            href: entry.article,
            text: [entry.transit, entry.text].filter(Boolean).join("\n"),
            images: entry.images,
        }),
    },
);
export const summary = {
    ...getTripSummary(built),
    // The upstream overview simplifies to ~200 m. Keep street corners when zooming in.
    segments: built.legs
        .filter((leg) => leg.from.id !== leg.to.id)
        .map((leg) => ({
            straight: leg.by === "plane",
            line: [
                [leg.from.longitude, leg.from.latitude] as [number, number],
                ...(leg.route?.coordinates ?? []),
                [leg.to.longitude, leg.to.latitude] as [number, number],
            ],
        })),
};
export const markers: PlaceMarker[] = Array.from(locations.values(), (place) => {
    const visits = entries.filter((entry) =>
        entry.locations.some((point) => point.id === place.id),
    );
    return {
        ...place,
        count: visits.length,
        firstYear: 2025,
        years: [2025],
        months: [...new Set(visits.map((v) => v.dateKey.slice(0, 7)))],
        color: "#303631",
        photo: visits.find((v) => v.destination.id === place.id && v.images.length)?.images[0]
            .thumbnail,
    };
});
export const dates = [...new Set(entries.map((entry) => entry.dateKey))];
