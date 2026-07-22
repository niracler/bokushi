// @ts-check

import { existsSync } from "node:fs";
import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import pagefind from "astro-pagefind";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMermaid from "rehype-mermaid";
import { remarkAlert } from "remark-github-blockquote-alert";
import Icons from "unplugin-icons/vite";
import { rehypeFigure } from "./rehype-figure.mjs";
import { remarkModifiedTime } from "./remark-modified-time.mjs";

const localChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// https://astro.build/config
export default defineConfig({
    site: "https://niracler.com",
    trailingSlash: "never",
    output: "static", // 静态模式：全部预渲染（动态页面需要单独配置 prerender: false）
    integrations: [
        mdx(),
        sitemap({
            i18n: {
                defaultLocale: "zh",
                locales: {
                    zh: "zh-CN",
                    en: "en-US",
                },
            },
        }),
        pagefind(),
    ],
    adapter: cloudflare({
        imageService: "compile",
    }),

    markdown: {
        processor: unified({
            remarkPlugins: [remarkAlert, remarkModifiedTime],
            rehypePlugins: [
                [
                    rehypeAutolinkHeadings,
                    {
                        behavior: "prepend",
                        properties: {
                            class: "anchor-link",
                            ariaHidden: true,
                            tabIndex: -1,
                        },
                    },
                ],
                [
                    rehypeMermaid,
                    {
                        strategy: "inline-svg", // 服务端渲染为内联 SVG
                        launchOptions: existsSync(localChromePath)
                            ? { executablePath: localChromePath }
                            : undefined,
                    },
                ],
                rehypeFigure,
            ],
        }),
        shikiConfig: {
            // 双主题配置：通过 CSS 变量控制，无需 !important
            themes: {
                light: "github-light",
                dark: "catppuccin-mocha",
            },
            // 禁用默认颜色，让 CSS 完全控制主题切换
            defaultColor: false,
        },
        syntaxHighlight: {
            excludeLangs: ["mermaid"],
        },
    },

    i18n: {
        defaultLocale: "zh",
        locales: ["zh", "en"],
        routing: {
            prefixDefaultLocale: false,
        },
    },

    vite: {
        plugins: [
            tailwindcss(),
            Icons({
                compiler: "astro",
                autoInstall: false,
            }),
        ],
    },
});
