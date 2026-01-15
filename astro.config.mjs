// @ts-check

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import pagefind from "astro-pagefind";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeFigure from "rehype-figure";
import rehypeImgSize from "rehype-img-size";
import rehypeMermaid from "rehype-mermaid";
import rehypePicture from "rehype-picture";
import rehypeSlug from "rehype-slug";
import { remarkAlert } from "remark-github-blockquote-alert";
import { remarkModifiedTime } from "./remark-modified-time.mjs";

// https://astro.build/config
export default defineConfig({
    site: "https://niracler.com",
    trailingSlash: "never",
    output: "static", // 静态模式：全部预渲染（动态页面需要单独配置 prerender: false）
    integrations: [
        mdx(),
        sitemap(),
        icon({
            include: {
                // Only include icons we actually use to reduce bundle size
                ri: [
                    "twitter-fill",
                    "telegram-fill",
                    "github-fill",
                    "steam-fill",
                    "douban-fill",
                    "mail-fill",
                    "rss-fill",
                    "link",
                    "share-line",
                    "check-line",
                    "creative-commons-fill",
                    "creative-commons-by-fill",
                    "creative-commons-nc-fill",
                    "creative-commons-sa-fill",
                ],
                "simple-icons": ["folo"],
            },
        }),
        pagefind(),
    ],
    adapter: cloudflare({
        imageService: "compile",
    }),

    markdown: {
        remarkPlugins: [remarkAlert, remarkModifiedTime],
        shikiConfig: {
            // 双主题配置：通过 CSS 变量控制，无需 !important
            themes: {
                light: "github-light",
                dark: "dracula",
            },
            // 禁用默认颜色，让 CSS 完全控制主题切换
            defaultColor: false,
        },
        syntaxHighlight: {
            excludeLangs: ["mermaid"],
        },
        rehypePlugins: [
            rehypeSlug,
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
                },
            ],
            rehypePicture,
            [rehypeImgSize, { dir: "./public" }],
            rehypeFigure,
        ],
    },

    vite: {
        plugins: [tailwindcss()],
    },
});
