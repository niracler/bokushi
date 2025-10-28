# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

**Always communicate with the project maintainer in Chinese (中文).** Code, comments, and documentation should remain in English, but all conversation and explanations should be in Chinese.

## Project Overview

Bokushi is a personal blog built with Astro 5, deployed to Cloudflare Pages. The site features three content types: blog posts, monthly journals (月记), and TIL (Today I Learned) entries. All content is written in Markdown or MDX with a custom content collection schema.

## Development Commands

```bash
# Install dependencies (uses pnpm workspace)
pnpm install

# Start dev server with hot reload
pnpm dev

# Build for production (outputs to dist/)
pnpm build

# Preview production build locally
pnpm preview

# Type check and validate Astro config
pnpm astro check

# Sync content collections after schema changes
pnpm astro sync

# Deploy to Cloudflare (via wrangler)
pnpm exec wrangler pages deploy dist/
```

## Architecture

### Content Collections System

The site uses Astro's content collections with three types defined in [src/content.config.ts](src/content.config.ts):

- **blog**: Long-form articles in `src/content/blog/`
- **monthly**: Monthly journal entries in `src/content/monthly/`
- **til**: Short learning notes in `src/content/til/`

All collections share a common schema:

- `title` (required)
- `description` (optional, auto-extracted from body if missing)
- `pubDate` (required, coerced to Date)
- `updatedDate` (optional)
- `heroImage` (optional, for article header)
- `socialImage` (optional, for social media previews)
- `tags` (array, defaults to empty)

**Important**: After modifying the schema in `src/content.config.ts`, run `pnpm astro sync` to regenerate TypeScript types.

### Routing Structure

- `src/pages/index.astro` - Homepage with featured categories
- `src/pages/[...slug].astro` - Dynamic catch-all for all blog/monthly/til posts
- `src/pages/blog/index.astro` - Blog listing page
- `src/pages/tags/[tag].astro` - Tag-filtered post listings
- `src/pages/tags/index.astro` - All tags overview
- `src/pages/rss.xml.js` - RSS feed (combines all collections, sorted by date)

The `[...slug].astro` route handles all post URLs by mapping directly from content collection IDs (e.g., `blog/markdown-style-guide.md` → `/blog/markdown-style-guide`).

### Markdown Processing Pipeline

Configured in [astro.config.mjs](astro.config.mjs) with extensive rehype/remark plugins:

**Remark plugins** (process markdown AST):

- `remark-github-blockquote-alert` - GitHub-style alert blocks

**Rehype plugins** (process HTML output):

- `rehype-slug` - Add IDs to headings
- `rehype-autolink-headings` - Generate anchor links for headings
- `rehype-mermaid` - Server-side Mermaid diagram rendering (pre-mermaid strategy)
- `rehype-picture` - Convert images to responsive `<picture>` elements
- `rehype-img-size` - Add width/height attributes to images
- `rehype-figure` - Wrap images in semantic `<figure>` elements

**Syntax highlighting**: Shiki with Dracula theme (excludes mermaid blocks to avoid conflicts)

### Custom Features

#### Post Preview Cards

[src/scripts/postPreview.ts](src/scripts/postPreview.ts) implements hover-based preview cards:

- Preloads images using `requestIdleCallback` for better performance
- Shows post title, description, and social image on hover
- Caches image elements to avoid redundant network requests
- Dynamically positions card to stay within viewport bounds

Usage: The script reads post metadata from a JSON script tag (`#all-posts-meta`) injected by [src/components/PostPreviewSetup.astro](src/components/PostPreviewSetup.astro).

#### RSS Feed

[src/pages/rss.xml.js](src/pages/rss.xml.js) generates a unified feed:

- Combines all three collections (blog, monthly, til)
- Sorts by `pubDate` descending
- Renders markdown to HTML using `markdown-it`
- Sanitizes HTML with `sanitize-html` (allows `<img>` tags)
- Includes custom `<follow_challenge>` block for feed readers
- Applies XSLT stylesheet (`/pretty-feed-v3.xsl`) for browser display

#### Responsive Tables

[src/layouts/BlogPost.astro](src/layouts/BlogPost.astro:76-139) includes client-side logic to transform wide tables (>3 columns) into card-based layouts on mobile:

- Detects table width and applies `data-card-mode` attribute
- Creates label/value pairs using `data-label` attributes
- Unwraps cards when switching back to table mode

#### Embed Iframe Handling

[src/layouts/BlogPost.astro](src/layouts/BlogPost.astro:154-212) gracefully handles failed embed loads:

- Wraps iframes in `.embed-wrapper` with transition styles
- Collapses wrapper after 5-second timeout if iframe doesn't load
- Prevents layout shift from broken embeds

### Styling Architecture

- **Framework**: Tailwind CSS 4.1 (via `@tailwindcss/vite` plugin)
- **Tokens**: Custom CSS variables defined in [src/styles/tokens.css](src/styles/tokens.css)
- **Global styles**: [src/styles/global.css](src/styles/global.css)
- **Typography**: `@fontsource/lxgw-wenkai` for Chinese content
- **Theme system**: Uses CSS variables for colors (e.g., `--color-text-primary`, `--color-bg-surface`)

Key styling patterns:

- Uses `color-mix(in srgb, var(--color-text-muted) 70%, transparent)` for opacity variations
- Border colors: `border-border-subtle`, `border-border-soft`
- Focus states: `focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]`

### Layout Components

- [src/layouts/BlogPost.astro](src/layouts/BlogPost.astro) - Main post layout with title, date, tags, comments
- [src/components/BaseHead.astro](src/components/BaseHead.astro) - SEO meta tags and OpenGraph data
- [src/components/Header.astro](src/components/Header.astro) - Site navigation
- [src/components/Footer.astro](src/components/Footer.astro) - Footer with social links
- [src/components/Prose.astro](src/components/Prose.astro) - Typography wrapper for markdown content
- [src/components/FormattedDate.astro](src/components/FormattedDate.astro) - Locale-aware date formatting

### Utilities

- [src/utils/extractDescription.ts](src/utils/extractDescription.ts) - Extract plain text from markdown body for meta descriptions
- [src/consts.ts](src/consts.ts) - Site-wide constants (title, description, social links)

## Common Development Patterns

### Adding a New Blog Post

1. Create a new `.md` or `.mdx` file in `src/content/blog/` (or `monthly/`, `til/`)
2. Add required frontmatter:

   ```yaml
   ---
   title: "Post Title"
   pubDate: 2025-01-15
   tags: ["tag1", "tag2"]
   description: "Optional description"
   socialImage: "/path/to/image.jpg"  # Optional
   ---
   ```

3. Run `pnpm astro sync` if you modified the schema
4. The post will automatically appear in the blog listing and RSS feed

### Working with Content Collections

When querying collections:

```typescript
import { getCollection } from 'astro:content';

// Get all blog posts
const blogPosts = await getCollection('blog');

// Filter and sort
const published = blogPosts
  .filter(post => !post.data.draft)
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
```

### Testing Mermaid Diagrams

Mermaid blocks are rendered server-side. To test:

1. Add a mermaid code block in markdown:

   ````markdown
   ```mermaid
   graph TD
     A[Start] --> B[End]
   ```
   ````

2. Run `pnpm build` to generate static HTML
3. Check output in `pnpm preview` - diagrams should render without client-side JavaScript

### Debugging Markdown Rendering

If content renders incorrectly:

1. Check `pnpm astro check` for schema validation errors
2. Verify frontmatter matches the schema in `src/content.config.ts`
3. Inspect the rehype plugin order in `astro.config.mjs` - order matters!
4. For images, ensure `rehypeImgSize` runs before `rehypeFigure`

## Deployment

The site deploys to Cloudflare Pages. Build output (`dist/`) is generated via `pnpm build` and uses the `@astrojs/cloudflare` adapter for edge rendering.

**Cloudflare-specific considerations**:

- `pnpm-workspace.yaml` ignores `esbuild` and `workerd` built dependencies
- `trailingSlash: 'never'` in Astro config ensures consistent URLs
- Wrangler CLI available via `pnpm exec wrangler`

## Site Configuration

Key constants in [src/consts.ts](src/consts.ts):

- `SITE_TITLE`: "Niracler 的博物志"
- `SITE_DESCRIPTION`: "长门大明神会梦到外星羊么？"
- `SOCIAL_LINKS`: GitHub, Twitter/X, Email, Telegram, RSS

Base site URL configured in [astro.config.mjs](astro.config.mjs): `https://niracler.com`

## Integration Notes

- **Comments**: Uses Remark42 via [src/components/Remark42Comments.astro](src/components/Remark42Comments.astro)
- **Sitemap**: Auto-generated via `@astrojs/sitemap` integration
- **No testing framework**: Playwright is listed in devDependencies but no tests exist yet
