// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import rehypeMermaid from "rehype-mermaid";

// https://astro.build/config
export default defineConfig({
  site: 'https://niracler.com',
  trailingSlash: 'never',
  integrations: [mdx(), sitemap()],
  adapter: cloudflare(),
  markdown: {
    shikiConfig: {
      theme: 'dracula',
      // 如果想要支持浅色/深色模式切换，可以这样配置：
      // themes: {
      //   light: 'github-light',
      //   dark: 'dracula',
      // },
    },
    syntaxHighlight: false, // 禁用默认语法高亮，避免与 Mermaid 冲突
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