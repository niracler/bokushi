// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://niracler.com',
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
  },
});