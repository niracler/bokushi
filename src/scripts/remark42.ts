import {
  getThemeState,
  initTheme,
  onThemeChange,
  type ThemeName,
  type ThemeState,
} from "./theme";

type Remark42Config = {
  host: string;
  site_id: string;
  url: string;
  components: string[];
  theme: ThemeName;
  locale: string;
  show_email_subscription: boolean;
  simple_view: boolean;
  no_footer: boolean;
};

type Remark42Global = {
  createInstance?: (config: Remark42Config) => void;
  changeTheme?: (theme: ThemeName) => void;
};

declare global {
  interface Window {
    REMARK42?: Remark42Global;
    remark_config?: Remark42Config;
  }
}

const SCRIPT_ATTR = "data-remark42";
const CONTAINER_SELECTOR = "[data-remark-host]";

const ensureEmbedScript = (host: string) => {
  const normalizedHost = host.replace(/\/$/, "");
  let script = document.querySelector<HTMLScriptElement>(
    `script[${SCRIPT_ATTR}]`,
  );

  if (!script) {
    script = document.createElement("script");
    script.src = `${normalizedHost}/web/embed.js`;
    script.defer = true;
    script.setAttribute(SCRIPT_ATTR, normalizedHost);
    document.head.appendChild(script);
  }

  return script;
};

const initRemark42 = (container: HTMLElement) => {
  const { remarkHost, remarkSiteId, remarkUrl } = container.dataset as {
    remarkHost?: string;
    remarkSiteId?: string;
    remarkUrl?: string;
  };

  if (!remarkHost || !remarkSiteId || !remarkUrl) {
    return;
  }

  const host = remarkHost.replace(/\/$/, "");
  const { theme } = initTheme();
  const config: Remark42Config = {
    host,
    site_id: remarkSiteId,
    url: remarkUrl,
    components: ["embed"],
    theme,
    locale: "zh",
    show_email_subscription: true,
    simple_view: false,
    no_footer: false,
  };

  const applyTheme = (state: ThemeState) => {
    config.theme = state.theme;
    window.REMARK42?.changeTheme?.(state.theme);
  };

  applyTheme(getThemeState());
  onThemeChange(applyTheme);

  const invokeCreateInstance = () => {
    window.REMARK42?.createInstance?.(config);
  };

  const script = ensureEmbedScript(host);

  if (window.REMARK42 && typeof window.REMARK42.createInstance === "function") {
    invokeCreateInstance();
  } else {
    window.remark_config = config;
    window.REMARK42 = window.REMARK42 || {};

    if (typeof window.REMARK42.createInstance !== "function") {
      window.REMARK42.createInstance = (cfg: Remark42Config) => {
        window.remark_config = cfg;
      };
    }

    script?.addEventListener("load", invokeCreateInstance, { once: true });
  }

  // Astro generally renders once per navigation; cleanup if needed.
};

const containers = Array.from(
  document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR),
);
containers.forEach((container) => initRemark42(container));
