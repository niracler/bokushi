import type { Urls } from "@hyoban/trip-map/client";

const root = "/trips/japan-2025";
const id = "2025-japan";
const playPath = `${root}/play`;
const mapPath = `${root}/map`;
const samePath = (path: string, target: string) => path.replace(/\/$/, "") === target;
const fragment = () => location.hash.slice(1) || undefined;

// Each view has a real Astro route. A fragment selects a card or pin on reload.
const urls: Partial<Urls> = {
    mapPath,
    tripListPath: root,
    getPickedTripId: (path) => (samePath(path, root) ? id : undefined),
    getPickedTripPath: () => root,
    getTripId: (path) => (samePath(path, playPath) ? id : undefined),
    getTripStop: (path) => (samePath(path, playPath) ? fragment() : undefined),
    getTripPath: (_id, stop) => playPath + (stop ? `#${stop}` : ""),
    isMapPath: (path) => samePath(path, mapPath),
    getMapPath: (_period, place) => mapPath + (place ? `#${place}` : ""),
    getPlaceId: (path) => (samePath(path, mapPath) ? fragment() : undefined),
    getTripListPath: () => root,
    getPlaceUrl: () => `${root}/places`,
    getTripDataUrl: () => `${root}/data.json`,
};

async function mount(page: HTMLElement) {
    const fullscreen = page.querySelector<HTMLButtonElement>("#fullscreen");
    if (fullscreen) {
        if (!document.fullscreenEnabled) {
            fullscreen.hidden = window.top === window.self;
            fullscreen.textContent = "单独打开";
        }
        fullscreen.addEventListener("click", () => {
            if (!document.fullscreenEnabled) window.open(location.href, "_blank", "noopener");
            else if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
        });
        document.addEventListener("fullscreenchange", () => {
            fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
        });
    }
    page.querySelector("dialog.lightbox")?.addEventListener("toggle", (event) => {
        if (event.target instanceof HTMLDialogElement && event.target.open)
            window.frameElement?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    // The upstream card links to the day's post. In the embedded diary, open the
    // selected picture with Bokushi's full-resolution viewer instead.
    page.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const cardLink = event.target.closest<HTMLAnchorElement>("[data-trip-map-panel] a");
        if (!cardLink) return;
        const photo = cardLink.querySelector("img");
        if (!photo) {
            cardLink.target = "_top";
            return;
        }
        const path = new URL(photo.src).pathname;
        const source = page.querySelector<HTMLAnchorElement>(
            `[data-trip-map-trip-details] [data-photo-url="${CSS.escape(path)}"]`,
        );
        if (!source) return;
        event.preventDefault();
        page.querySelector<HTMLButtonElement>('[data-trip-map-play][aria-label="暂停"]')?.click();
        source.click();
    });
    if (!page.dataset.tripMapToken) return;

    const { createTripMap } = await import("@hyoban/trip-map/client");
    const map = createTripMap({
        page,
        urls,
        brand: { name: "Niracler" },
        siteLine: "niracler.com",
        messages: { viewDayMoments: "查看照片或当天游记" },
    });
    window.addEventListener(
        "pagehide",
        (event) => {
            if (!event.persisted) map.destroy();
        },
        { once: true },
    );
}
const page = document.querySelector<HTMLElement>("[data-trip-map]");
if (page) void mount(page);
