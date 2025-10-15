// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import rehypeMermaid from "rehype-mermaid";
import { remarkAlert } from 'remark-github-blockquote-alert';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import rehypePicture from 'rehype-picture';
import rehypeImgSize from 'rehype-img-size';
import rehypeFigure from 'rehype-figure';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://niracler.com',
  trailingSlash: 'never',
  integrations: [mdx(), sitemap()],
  adapter: cloudflare(),

  markdown: {
    remarkPlugins: [remarkAlert],
    shikiConfig: {
      theme: 'dracula',
      // 如果想要支持浅色/深色模式切换，可以这样配置：
      // themes: {
      //   light: 'github-light',
      //   dark: 'dracula',
      // },
    },
    syntaxHighlight: {
      excludeLangs: ['mermaid'],
    },
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'prepend',
          properties: {
            class: 'anchor-link',
            ariaHidden: true,
            tabIndex: -1
          }
        }
      ],
      [
        rehypeMermaid,
        {
          strategy: "pre-mermaid", // 生成静态 HTML，客户端渲染
          dark: true, // 启用暗黑模式支持
          colorScheme: "forest", // 使用 forest 配色方案，可根据需要调整
        }
      ],
      rehypePicture,
      rehypeImgSize,
      rehypeFigure
    ]
  },

  vite: {
    plugins: [tailwindcss()],
  },
});