const STORAGE_KEY = "theme-preference";

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";
export type ThemeState = {
  theme: ThemeName;
  preference: ThemePreference;
};

type Listener = (state: ThemeState) => void;

const listeners = new Set<Listener>();
const DEFAULT_PREFERENCE: ThemePreference = "system";

let initialized = false;
let hasResolvedState = false;
let currentPreference: ThemePreference = DEFAULT_PREFERENCE;
let currentTheme: ThemeName = "light";

const isPreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

const readStoredPreference = (): ThemePreference | null => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(value) ? value : null;
  } catch {
    return null;
  }
};

const storePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* noop */
  }
};

const getSystemTheme = (): ThemeName =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const resolveTheme = (preference: ThemePreference): ThemeName => {
  switch (preference) {
    case "dark":
      return "dark";
    case "light":
      return "light";
    default:
      return getSystemTheme();
  }
};

const applyThemeToDocument = (
  theme: ThemeName,
  preference: ThemePreference,
  doc: Document = document,
) => {
  const root = doc.documentElement;
  root.dataset.theme = theme;
  root.dataset.themeMode = preference;
};

const notify = () => {
  const state = getThemeState();
  for (const listener of listeners) {
    listener(state);
  }
};

const ensureState = (doc: Document = document) => {
  if (hasResolvedState) return;

  const { dataset } = doc.documentElement;
  const attrPreference = dataset.themeMode;

  if (isPreference(attrPreference)) {
    currentPreference = attrPreference;
    currentTheme = resolveTheme(currentPreference);
    hasResolvedState = true;
    return;
  }

  const storedPreference = readStoredPreference();
  currentPreference = storedPreference ?? DEFAULT_PREFERENCE;
  currentTheme = resolveTheme(currentPreference);
  applyThemeToDocument(currentTheme, currentPreference, doc);
  hasResolvedState = true;
};

const updateState = (
  preference: ThemePreference,
  doc: Document = document,
  { emit } = { emit: true },
) => {
  currentPreference = preference;
  currentTheme = resolveTheme(preference);
  applyThemeToDocument(currentTheme, preference, doc);
  hasResolvedState = true;
  if (emit) {
    notify();
  }
};

export const getThemeState = (): ThemeState => ({
  theme: currentTheme,
  preference: currentPreference,
});

export const getActiveTheme = (doc: Document = document): ThemeName => {
  ensureState(doc);
  return currentTheme;
};

export const getThemePreference = (
  doc: Document = document,
): ThemePreference => {
  ensureState(doc);
  return currentPreference;
};

export const setThemePreference = (
  preference: ThemePreference,
  doc: Document = document,
) => {
  ensureState(doc);
  storePreference(preference);
  updateState(preference, doc);
};

export const onThemeChange = (listener: Listener) => {
  ensureState();
  listeners.add(listener);
  listener(getThemeState());
  return () => {
    listeners.delete(listener);
  };
};

const attachSystemWatcher = (doc: Document) => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = (event: MediaQueryListEvent) => {
    if (currentPreference !== "system") return;
    currentTheme = event.matches ? "dark" : "light";
    applyThemeToDocument(currentTheme, currentPreference, doc);
    notify();
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleMediaChange);
  } else {
    const legacyAddListener = Reflect.get(mediaQuery, "addListener");
    if (typeof legacyAddListener === "function") {
      legacyAddListener.call(mediaQuery, handleMediaChange);
    }
  }
};

export const initTheme = (doc: Document = document): ThemeState => {
  ensureState(doc);

  if (!initialized) {
    attachSystemWatcher(doc);
    initialized = true;
  }

  notify();
  return getThemeState();
};

const cyclePreference = (preference: ThemePreference): ThemePreference => {
  switch (preference) {
    case "system":
      return "light";
    case "light":
      return "dark";
    case "dark":
    default:
      return "system";
  }
};

const preferenceLabel = {
  light: "浅色模式",
  dark: "夜间模式",
  system: "跟随系统",
} satisfies Record<ThemePreference, string>;

const describeState = (state: ThemeState) => {
  const { preference, theme } = state;
  const nextPreference = cyclePreference(preference);
  const currentLabel =
    preference === "system"
      ? `${preferenceLabel.system}（当前${theme === "dark" ? "夜间" : "浅色"}）`
      : preferenceLabel[preference];

  return {
    nextPreference,
    message: `当前主题：${currentLabel}。点击切换为${preferenceLabel[nextPreference]}`,
  };
};

export const bindThemeToggles = (root: ParentNode = document) => {
  const toggles = Array.from(
    root.querySelectorAll<HTMLElement>("[data-theme-toggle]"),
  );
  if (!toggles.length) return;

  const update = (state: ThemeState) => {
    const { nextPreference, message } = describeState(state);
    toggles.forEach((toggle) => {
      toggle.dataset.themePreference = state.preference;
      toggle.dataset.themeState = state.theme;
      toggle.dataset.themeNext = nextPreference;
      toggle.setAttribute("aria-label", message);
      toggle.setAttribute("title", message);

      const srLabel = toggle.querySelector<HTMLElement>(
        "[data-theme-toggle-label]",
      );
      if (srLabel) {
        srLabel.textContent = message;
      }
    });
  };

  const handleClick = (event: Event) => {
    event.preventDefault();
    const next = cyclePreference(getThemePreference());
    setThemePreference(next);
  };

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", handleClick);
  });

  update(initTheme());

  const unsubscribe = onThemeChange(update);

  return () => {
    unsubscribe();
    toggles.forEach((toggle) => {
      toggle.removeEventListener("click", handleClick);
    });
  };
};
