import * as L from "leaflet";

function element<T extends HTMLElement>(selector: string): T {
    const result = document.querySelector<T>(selector);
    if (!result) throw new Error(`Missing trip replay element: ${selector}`);
    return result;
}

type StopTemplate = HTMLTemplateElement & {
    dataset: { day: string; name: string; lat: string; lng: string };
};

const cover = element<HTMLElement>("#cover");
const player = element<HTMLElement>("#player");
const start = element<HTMLButtonElement>("#start");
const stop = element<HTMLElement>("#stop");
const day = element<HTMLSelectElement>("#day");
const play = element<HTMLButtonElement>("#play");
const previous = element<HTMLButtonElement>("#previous");
const next = element<HTMLButtonElement>("#next");
const progress = element<HTMLElement>("#progress");
const fullscreen = element<HTMLButtonElement>("#fullscreen");
const overview = element<HTMLButtonElement>("#overview");
const stages = [...document.querySelectorAll<StopTemplate>("template[data-day]")];
const points: L.LatLngTuple[] = stages.map(({ dataset }) => [
    Number(dataset.lat),
    Number(dataset.lng),
]);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const routeColor = "#a34225";
let map: L.Map;
let marker: L.CircleMarker;
let index = 0;
let timer: number | undefined;

function centerEmbed() {
    window.frameElement?.scrollIntoView({ block: "center", behavior: "instant" });
}

function pause() {
    window.clearInterval(timer);
    timer = undefined;
    play.textContent = index === stages.length - 1 ? "重新播放" : "播放";
}

function showStage(position: number, animate = true) {
    index = position;
    const stage = stages[index];
    stop.replaceChildren(stage.content.cloneNode(true));
    stop.scrollTop = 0;
    day.value = stage.dataset.day;
    previous.disabled = index === 0;
    next.disabled = index === stages.length - 1;
    progress.textContent = `第 ${index + 1} / ${stages.length} 站`;
    marker
        .setLatLng(points[index])
        .bringToFront()
        .setTooltipContent(stage.dataset.name)
        .openTooltip();
    const zoom = stage.dataset.name === "深圳" || stage.dataset.name === "深中通道" ? 10 : 14;
    map.stop();
    if (animate && !reduced.matches) {
        map.flyTo(points[index], zoom, { duration: 1.15 });
    } else {
        map.setView(points[index], zoom, { animate: false });
    }
    if (next.disabled) pause();
}

function togglePlay() {
    if (timer !== undefined) {
        pause();
        return;
    }
    if (index === stages.length - 1) showStage(0, false);
    play.textContent = "暂停";
    timer = window.setInterval(() => showStage(index + 1), 6500);
}

function selectStage(position: number) {
    pause();
    showStage(position);
    if (index < stages.length - 1) play.textContent = "播放";
}

start.addEventListener(
    "click",
    () => {
        centerEmbed();
        cover.hidden = true;
        player.hidden = false;
        map = L.map("map", { scrollWheelZoom: false }).setView(points[0], 14);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        }).addTo(map);
        L.polyline(points, {
            color: routeColor,
            weight: 3,
            dashArray: "5 7",
            opacity: 0.72,
            interactive: false,
        }).addTo(map);
        for (const [i, point] of points.entries()) {
            const pin = L.circleMarker(point, {
                radius: 5,
                color: routeColor,
                fillColor: "white",
                fillOpacity: 1,
                weight: 2,
            }).addTo(map);
            pin.on("click", () => selectStage(i));
        }
        marker = L.circleMarker(points[0], {
            radius: 8,
            weight: 3,
            color: "white",
            fillColor: routeColor,
            fillOpacity: 1,
            interactive: false,
        })
            .addTo(map)
            .bindTooltip(stages[0].dataset.name, {
                permanent: true,
                direction: "top",
                offset: [0, -8],
            });
        map.on("dragstart", pause);
        new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(map.getContainer());
        showStage(0, false);
        if (!reduced.matches) togglePlay();
        play.focus({ preventScroll: true });
    },
    { once: true },
);

previous.addEventListener("click", () => selectStage(index - 1));
next.addEventListener("click", () => selectStage(index + 1));
play.addEventListener("click", togglePlay);
day.addEventListener("change", () =>
    selectStage(stages.findIndex((s) => s.dataset.day === day.value)),
);
const lightbox = element<HTMLDialogElement>("#trip-lightbox");
lightbox.addEventListener("toggle", () => {
    if (lightbox.open) centerEmbed();
});
stop.addEventListener("pointerdown", pause);
stop.addEventListener("focusin", pause);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
});
overview.addEventListener("click", () => {
    pause();
    map.stop().fitBounds(L.latLngBounds(points), { padding: [24, 24], animate: !reduced.matches });
});

if (!document.fullscreenEnabled) {
    fullscreen.textContent = "单独打开";
    fullscreen.hidden = window.top === window.self;
}
fullscreen.addEventListener("click", () => {
    if (!document.fullscreenEnabled) {
        window.open(location.href, "_blank", "noopener");
    } else if (document.fullscreenElement) {
        void document.exitFullscreen();
    } else {
        void document.documentElement.requestFullscreen();
    }
});
document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
});
