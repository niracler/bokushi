import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const { trip } = await import("../src/data/japan-trip.ts");
const points = trip.stops.flatMap((stop) => [...stop.waypoints, ...stop.places]);

test("the Japan replay has a continuous ground route from the Shenzhen departure to the return", () => {
    assert.equal(trip.start, "2025-09-27");
    assert.equal(trip.end, "2025-10-07");
    assert.equal(trip.legs.length + 1, points.length);
    assert.equal(new Set(trip.stops.map((stop) => stop.anchor)).size, trip.stops.length);
    assert.equal(trip.stops[0].anchor, "shenzhen-coach");
    assert.equal(trip.stops.at(-1).anchor, "d8-4");
    for (const [i, leg] of trip.legs.entries()) {
        const from = points[i];
        const to = points[i + 1];
        if (
            leg.mode === "plane" ||
            (from.latitude === to.latitude && from.longitude === to.longitude)
        )
            continue;
        assert.ok(leg.line?.length >= 2, `${from.name} → ${to.name} has no surface geometry`);
    }
});

test("the airport railway reaches Narita before the flight and the Macau ground transfer", () => {
    const index = trip.stops.findIndex((stop) => stop.anchor === "d8-1");
    assert.ok(index > 0);
    assert.deepEqual(
        trip.stops.slice(index - 1, index + 3).map((stop) => stop.anchor),
        ["narita-airport-train", "d8-1", "macau-airport", "d8-2"],
    );
    const airport = trip.stops[index].places[0];
    const i = points.indexOf(airport);
    assert.equal(trip.legs[i - 1].mode, "train");
    assert.ok(trip.legs[i - 1].line.length > 2);
    assert.equal(trip.legs[i].mode, "plane");
});
