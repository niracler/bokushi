// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import rehypeMermaid from "rehype-mermaid";
import { remarkAlert } from 'remark-github-blockquote-alert';

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
      [
        rehypeMermaid,
        {
          strategy: "pre-mermaid", // 生成静态 HTML，客户端渲染
          dark: true, // 启用暗黑模式支持
          colorScheme: "forest", // 使用 forest 配色方案，可根据需要调整
        }
      ]
    ]
  },
});