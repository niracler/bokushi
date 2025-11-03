// @ts-check

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeFigure from "rehype-figure";
import rehypeImgSize from "rehype-img-size";
import rehypeMermaid from "rehype-mermaid";
import rehypePicture from "rehype-picture";
import rehypeSlug from "rehype-slug";
import { remarkAlert } from "remark-github-blockquote-alert";

// https://astro.build/config
export default defineConfig({
    site: "https://niracler.com",
    trailingSlash: "never",
    integrations: [mdx(), sitemap()],
    adapter: cloudflare({
        imageService: "compile",
    }),

    markdown: {
        remarkPlugins: [remarkAlert],
        shikiConfig: {
            theme: "dracula",
            // 如果想要支持浅色/深色模式切换，可以这样配置：
            // themes: {
            //   light: 'github-light',
            //   dark: 'dracula',
            // },
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
                    strategy: "pre-mermaid", // 客户端渲染，无需 Playwright
                },
            ],
            rehypePicture,
            rehypeImgSize,
            rehypeFigure,
        ],
    },

    vite: {
        plugins: [tailwindcss()],
    },
});
