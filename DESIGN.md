# Bokushi Design System

> Agent-consumable design specification for the Bokushi (博物志) personal blog.
> Source of truth: `src/styles/tokens.css` + `src/styles/global.css`

## 1. Visual Theme & Atmosphere

**Style**: Warm, paper-like reading experience inspired by Japanese stationery
**Framework**: Apple Human Interface Guidelines (Clarity, Consistency, Deference)
**Personality**: Content-first, minimal interaction, generous whitespace
**Font**: jf-openhuninn-2.0 (Chinese-optimized open-source font) with system fallbacks
**Base size**: 17px (1.0625rem) — Apple HIG compliant for readability

The blog uses a warm earth-tone palette with terracotta accents. Dark mode deepens the warmth rather than going cold/blue. Strong text and `<strong>` tags render in the accent color, not bold black.

## 2. Color Palette & Roles

### Light Theme (default)

| Token | Value | Role |
|-------|-------|------|
| `--color-bg-page` | `#fffaf4` | Page background — warm off-white |
| `--color-bg-surface` | `#ffffff` | Card/panel background |
| `--color-bg-muted` | `#f8efe4` | Secondary background, footnotes, pills |
| `--color-text-primary` | `#2a1c17` | Headings, body text |
| `--color-text-secondary` | `#46342a` | Paragraphs, list items |
| `--color-text-muted` | `#5f4d42` | Captions, metadata, markers |
| `--color-text-inverse` | `#fef9f0` | Text on dark backgrounds |
| `--color-accent` | `#fb8f68` | Primary accent — terracotta orange |
| `--color-accent-dark` | `#d67046` | Alert titles, deeper accent |
| `--color-accent-soft` | `#ffe7dc` | Accent background tint |
| `--color-link` | `#c05c3e` | Inline link color |
| `--color-link-hover` | `#9a472f` | Link hover state |
| `--color-border` | `#dcc9ba` | Default border |
| `--color-border-soft` | `rgba(42 28 23 / 0.08)` | Subtle card borders |
| `--color-border-subtle` | `rgba(42 28 23 / 0.12)` | Code blocks, table borders |
| `--color-border-strong` | `#cbb69d` | Emphasized borders |
| `--color-success` | `#4f8b63` | Success state |
| `--color-warning` | `#d8871d` | Warning state |
| `--color-danger` | `#c84c3a` | Danger/caution state |
| `--color-note` | `#8d7bd6` | Note/info state |
| `--color-code-bg` | `#f6f8fa` | Code block background |

### Dark Theme (`[data-theme="dark"]`)

| Token | Value | Role |
|-------|-------|------|
| `--color-bg-page` | `#140e0b` | Deep warm black |
| `--color-bg-surface` | `#1b140f` | Card background |
| `--color-bg-muted` | `#241914` | Secondary surface |
| `--color-text-primary` | `#f8ede1` | Primary text |
| `--color-text-secondary` | `#d7c6b8` | Body text |
| `--color-text-muted` | `#b8a090` | Captions, metadata |
| `--color-text-inverse` | `#1b120c` | Text on light surfaces |
| `--color-accent` | `#fb9f74` | Slightly lighter terracotta |
| `--color-accent-dark` | `#f77342` | Vivid accent |
| `--color-accent-soft` | rgba(251, 159, 116, 0.16) | Transparent tint |
| `--color-link` | `#ffb088` | Warmer link for dark bg |
| `--color-link-hover` | `#ffcfb3` | Link hover |
| `--color-border` | `#3b2b22` | Border |
| `--color-border-strong` | `#4b372d` | Strong border |
| `--color-success` | `#8bcaa0` | Success |
| `--color-warning` | `#f3b05b` | Warning |
| `--color-danger` | `#f18879` | Danger |
| `--color-note` | `#a79fe6` | Note |
| `--color-code-bg` | `#1e1e2e` | Catppuccin Mocha base |

### Accent Tint Scale

Used for hover states, backgrounds, and subtle fills:

| Token | Definition |
|-------|-----------|
| `--color-accent-tint` | `rgba(accent-rgb / 0.16)` (light) or `0.22` (dark) |
| `--color-accent-tint-6` | `color-mix(in srgb, accent 6%, transparent)` |
| `--color-accent-tint-8` | `color-mix(in srgb, accent 8%, transparent)` |
| `--color-accent-tint-12` | `color-mix(in srgb, accent 12%, transparent)` |
| `--color-accent-tint-18` | `color-mix(in srgb, accent 18%, transparent)` |

### Overlay Tokens (theme-invariant)

| Token | Value |
|-------|-------|
| `--color-overlay-dark-35` | `rgba(0, 0, 0, 0.35)` |
| `--color-overlay-dark-40` | `rgba(0, 0, 0, 0.4)` |
| `--color-overlay-dark-60` | `rgba(0, 0, 0, 0.6)` |
| `--color-overlay-light-25` | `rgba(255, 255, 255, 0.25)` |
| `--color-overlay-light-35` | `rgba(255, 255, 255, 0.35)` |
| `--color-overlay-light-50` | `rgba(255, 255, 255, 0.5)` |
| `--color-overlay-light-80` | `rgba(255, 255, 255, 0.8)` |
| `--color-overlay-light-90` | `rgba(255, 255, 255, 0.9)` |

## 3. Typography Rules

**Primary font**: `jf-openhuninn-2.0`, then system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`)
**Code font**: `Fira Code, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace`
**Letter spacing**: `0.01em` on body (aids Chinese readability)

### Font Size Scale

| Token | Size | Typical Use |
|-------|------|-------------|
| `--font-size-2xs` | 0.6875rem (11px) | TOC numbers, fine print |
| `--font-size-xs` | 0.8125rem (13px) | Pills, code-block lang, captions |
| `--font-size-sm` | 0.9375rem (15px) | Figcaptions, footnotes, mobile TOC |
| `--font-size-base` | 1.0625rem (17px) | Body text |
| `--font-size-lg` | 1.25rem (20px) | H4 |
| `--font-size-xl` | 1.5rem (24px) | H3 |
| `--font-size-2xl` | 1.875rem (30px) | H2 |
| `--font-size-3xl` | 2.25rem (36px) | H1 |

### Line Heights

| Token | Value | Use |
|-------|-------|-----|
| `--line-height-base` | 1.75 | Body text, lists |
| `--line-height-relaxed` | 1.65 | Figcaptions |
| `--line-height-tight` | 1.22 | Headings |

### Heading Styles

| Level | Size | Weight | Letter-spacing | Extra |
|-------|------|--------|---------------|-------|
| H1 | 3xl (2.25rem) | 700 | 0 | — |
| H2 | 2xl (1.875rem) | 800 | -0.02em | Auto-numbered via CSS counter |
| H3 | xl (1.5rem) | 700 | -0.01em | Numbered as `h2.h3` |
| H4 | lg (1.25rem) | 700 | 0 | Numbered as `h2.h3.h4` |

### Bold/Strong Convention

`<strong>` and `<b>` inside `.prose` render in `--color-accent` (terracotta) with `font-weight: 600`. This is a deliberate design choice — bold text is an accent highlight, not just heavier weight.

## 4. Component Stylings

### Surface Card (`.surface-card`)

Base: white background, soft border, rounded corners (radius-lg = 16px), soft shadow, 0.2s transition.

| Variant | Class | Behavior |
|---------|-------|----------|
| Default | `.surface-card` | White bg, `border-soft`, `shadow-soft` |
| Soft | `--soft` | No shadow, subtle border, 80/20 surface/muted bg mix |
| Flat | `--flat` | No shadow, subtle border only |
| Compact | `--compact` | Smaller radius (radius-md = 10px) |
| Hover: border | `--hover-border` | Border darkens + shadow appears on hover |
| Hover: none | `--hover-none` | Disables hover transitions |

### Pill / Tag (`.pill`)

Inline badge with `radius-full` (pill shape), muted bg, subtle border, xs font, 600 weight.

| Variant | Selector | Behavior |
|---------|----------|----------|
| Default | `.pill` | Muted bg, secondary text |
| Clickable | `.pill--clickable` | Cursor pointer, opacity:0.8 on hover |
| Accent | `[data-tone="accent"]` | Accent-soft bg, accent text, accent-tinted border |

### Icon Button (`.icon-btn`)

Transparent background, secondary text color, transitions to accent on hover.

| Size | Class | Dimensions |
|------|-------|-----------|
| XS | `--xs` | 2rem × 2rem |
| SM | `--sm` | 2.75rem × 2.75rem |
| MD | `--md` | 3rem × 3rem |

| Shape | Class | Border-radius |
|-------|-------|--------------|
| Round | `--round` | radius-full (9999px) |
| Square | `--square` | radius-md (10px) |
| Bordered | `--bordered` | + 1px border-soft |

### Underline Link (`.underline-link`)

Link-colored text with animated underline: starts at `scaleX(0.6)`, expands to `scaleX(1)` on hover. Border-bottom with 70% link color opacity.

### Eyebrow (`.eyebrow`)

XS font, 0.12em letter-spacing, uppercase, muted color, 700 weight. Used for section labels.

### Focus Style (`.focus-accent`)

2px solid `accent-soft` outline with 2px offset on `:focus-visible`.

### Markdown Alerts

Border-left 4px + tinted background. Colors by type:

| Type | Border Color | Background |
|------|-------------|-----------|
| Note | `--color-note` | note 18% mix |
| Tip | `--color-success` | success 18% mix |
| Warning/Important | `--color-warning` | warning 18% mix |
| Caution | `--color-danger` | danger 15% mix |

### Code Blocks

- Inline code: `0.1em 0.4em` padding, `radius-sm`, muted 15% mix bg, 0.95em size
- Pre blocks: `space-4` padding, `radius-md`, `border-subtle`, `code-bg`
- Code block header: flex row with language label (xs, uppercase, 0.08em tracking) + copy button
- Shiki dual-theme: `--shiki-light` / `--shiki-dark` CSS variables

### Theme Toggle

Three-state cycle: system → light → dark. Icon animation uses `scale + rotate` transitions with spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Two variants: `header` (minimal) and `mobile` (full-width with label).

## 5. Layout Principles

### Page Shell

```css
.page-shell {
    max-width: var(--layout-max-width);  /* 72rem */
    margin-inline: auto;
    padding-block: var(--space-8);       /* 2rem */
    padding-inline: var(--space-4);      /* 1rem, → space-6 at 640px+ */
}
```

### Content Width

- `--layout-max-width`: 72rem (1152px) — outer page container
- `--measure`: 68ch — prose readability limit
- `--measure-wide`: 72ch — wider content areas

### Spacing Scale

| Token | Value | Pixels |
|-------|-------|--------|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-3` | 0.75rem | 12px |
| `--space-4` | 1rem | 16px |
| `--space-5` | 1.25rem | 20px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-12` | 3rem | 48px |

### Section Stack

`.section-stack` uses `display: grid` with `gap: clamp(space-6, 3vw, space-12)` — responsive gap that scales between 24px and 48px.

## 6. Depth & Elevation

### Shadow Presets

| Token | Light Value | Dark Value |
|-------|------------|------------|
| `--shadow-soft` | `0 6px 18px rgba(47,37,25, 0.08)` | `0 10px 28px rgba(0,0,0, 0.32)` |
| `--shadow-strong` | `0 16px 36px rgba(47,37,25, 0.14)` | `0 24px 42px rgba(0,0,0, 0.44)` |
| `--shadow-lightbox` | `0 20px 60px rgba(0,0,0, 0.4)` | `0 20px 60px rgba(0,0,0, 0.6)` |
| `--shadow-button-hover` | `0 6px 20px rgba(251,143,104, 0.3)` | `0 6px 20px rgba(251,159,116, 0.35)` |

### Border Radius Scale

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 2px | Checkboxes |
| `--radius-sm` | 6px | Inline code, focus outlines |
| `--radius-md` | 10px | Code blocks, compact cards, alerts |
| `--radius-lg` | 16px | Cards, images, modals |
| `--radius-full` | 9999px | Pills, round buttons |

### Transition Timing

| Token | Value | Use |
|-------|-------|-----|
| `--transition-fast` | 0.15s ease | Micro-interactions |
| `--transition-base` | 0.2s ease | Most UI transitions |
| `--transition-slow` | 0.3s ease | Panels, drawers |
| `--transition-slower` | 0.5s ease | Theme icon rotation |

## 7. Do's and Don'ts

### Do

- Use CSS variables (`var(--color-*)`) for all colors — never hardcode hex in components
- Use semantic Tailwind tokens (`text-secondary`, `bg-surface`) over raw values
- Keep hover effects to color/border changes only
- Use `--transition-base` (0.2s) for standard interactions
- Render `<strong>` in accent color within prose content
- Use `.surface-card` variants instead of custom card styles
- Respect `prefers-reduced-motion` — all animations have `0.01ms` fallback

### Don't

- Don't use `translateY` lift animations on hover (design principle: subtle, not bouncy)
- Don't add new shadow levels — use `shadow-soft` or `shadow-strong`
- Don't use raw hex values in Astro components — always reference tokens
- Don't introduce new fonts or change the base 17px size
- Don't bypass the three-state theme toggle (system/light/dark)
- Don't use `!important` except in Mermaid diagram overrides (unavoidable due to library inline styles)

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Key Changes |
|-----------|-------|-------------|
| Mobile (default) | < 640px | `padding-inline: space-4` (16px), single column |
| SM | ≥ 640px | `padding-inline: space-6` (24px) |
| MD | ≥ 768px (48rem) | Tables switch from card-mode to table layout |

### Table-to-Card Pattern

Tables with `data-card-mode="cards"` collapse to stacked cards below 48rem:

- `thead` is hidden
- Each `<tr>` becomes a card with `radius-md`, `shadow-soft`
- Each `<td>` renders as label-value pair using `data-label` attribute
- Label is uppercase, xs font, muted color; value takes remaining width

### Mobile-Specific Adaptations

- TOC: floating button → drawer (full-width, larger font)
- Theme toggle: `[data-variant="mobile"]` — full-width button with visible label
- Navigation: responsive header with mobile menu drawer

## 9. Agent Prompt Guide

### Quick Color Reference

When generating UI for this blog, use these semantic mappings:

```text
Page background     → var(--color-bg-page)
Card background     → var(--color-bg-surface)
Muted/secondary bg  → var(--color-bg-muted)
Primary text        → var(--color-text-primary)
Body/paragraph text → var(--color-text-secondary)
Caption/meta text   → var(--color-text-muted)
Primary accent      → var(--color-accent)
Link                → var(--color-link)
Card border         → var(--color-border-soft)
```

### Component Selection Guide

| Need | Use |
|------|-----|
| A card/panel | `.surface-card` + variant modifier |
| A tag/badge | `.pill` (+ `data-tone="accent"` for emphasis) |
| An icon button | `.icon-btn` + size (`--sm`) + shape (`--round`) |
| A text link | `.underline-link` or plain `<a>` inside `.prose` |
| A section label | `.eyebrow` |
| Focus ring | `.focus-accent` |

### Example: Creating a New Card Component

```astro
<div class="surface-card surface-card--soft p-6">
    <span class="eyebrow">Category</span>
    <h3 class="text-lg font-bold mt-2">Title</h3>
    <p class="text-secondary mt-1">Description text...</p>
    <div class="flex gap-2 mt-4">
        <span class="pill" data-tone="accent">Tag</span>
    </div>
</div>
```

### Key Conventions

1. All spacing uses the `--space-*` scale (4px increments up to 48px)
2. Border radius follows the `--radius-*` scale (never use arbitrary values)
3. Shadows are limited to `shadow-soft` and `shadow-strong`
4. Transitions use `--transition-*` tokens (never raw `0.3s ease`)
5. Dark mode is handled by CSS variables — no JS theme logic needed in components
6. Tables should include `data-card-mode="cards"` for responsive mobile layout
