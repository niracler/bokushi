# Repository Guidelines

## Project Structure & Module Organization

- `src/pages/` stores routes; `src/layouts/` shares shells; `src/components/` holds reusable UI (Header, Footer, BaseHead, CommentSection).
- Content lives in `src/content/` with `content.config.ts` validating frontmatter; prefer kebab-case slugs. Shared assets go in `public/`; `dist/` is build output and untracked.
- Styling sits in `src/styles/` (tokens + Tailwind layers); utilities/scripts in `src/utils/`, `src/types/`, and `src/scripts/`; site metadata in `src/consts.ts`.
- `tailwind.config.mjs` maps CSS variables to utilities; `remark-modified-time.mjs` refreshes post metadata when needed.

## Setup, Build, and Development Commands

- Install: `pnpm install`. Dev server: `pnpm dev`.
- Build: `pnpm build`; local preview: `pnpm preview`.
- Quality: `pnpm lint` (Biome) + `pnpm format`; use `pnpm astro check` when adding TS/MDX.

## Coding Style & Naming Conventions

- Biome enforces 4-space indentation, line width 100, double quotes, and organized imports; run format before pushing.
- Naming: PascalCase for components/layouts, kebab-case for content slugs and utilities, clear filenames. Favor semantic Tailwind tokens (`text-secondary`, `bg-surface`) over raw values.
- Keep Astro/TS lean: derive props from data, prune unused imports/variables.

## Testing Guidelines

- No automated suite yet; Playwright is available if you add browser specs. Name them `*.spec.ts` under `tests/` and keep headless-friendly.
- For UI or script changes, at minimum run `pnpm build` then `pnpm preview` and interact with scripts in `src/scripts/`.

## Development Workflow

- **Branch naming**: `feature/...`, `fix/...`, `docs/...`, `refactor/...`, `test/...`.
- **Commit format** (Conventional, <72 chars): `type(scope): concise summary`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. Optional body: up to 3–4 bullets focused on impact; imperative mood; omit obvious diffs. No AI/co-author markers.
- **PR process**: branch from `main`, open a PR with intent + test plan, update docs when needed, prefer squash-and-merge. Include before/after screenshots for visual work; note config/env changes.

## Release & Changelog

- When releasing, bump `package.json` version and keep a `CHANGELOG.md` using Keep a Changelog sections (Added, Fixed, Technical) with issue refs or short hashes.
- Commit release as `chore(release): bump version to x.y.z`, tag `v{x.y.z}`, and align GitHub release notes with the changelog. Follow semantic versioning.

## Design Reference

- **Agent design spec**: `DESIGN.md` (root) — standardized 9-section format with all tokens, components, and usage guidelines. Read this first for any visual/styling work.
- **Human design doc**: `src/content/blog/zh/design.mdx` — narrative design system article following Apple HIG structure.
- **Token source of truth**: `src/styles/tokens.css` — all CSS variables defined here.
- Card components use `.surface-card` and its variants (`--soft`, `--flat`, `--compact`, `--hover-border`, `--hover-none`) defined in `src/styles/global.css`.
- Hover effects should use color/border changes only; avoid `translateY` lift animations.

## Pre-commit Hooks

- `check-font-coverage.py`: validates font subsetting
- `astro check`: TypeScript/MDX type checking
- `lint-staged`: Biome formatting and linting
- `check-token-consistency.mjs`: **runs only when `tokens.css` is staged** — verifies that hardcoded hex values in `DESIGN.md`, showcase components (`src/components/design/*.astro`), and `design.mdx` match `tokens.css`. If it fails, update the stale values before committing.

## Configuration & Security Notes

- Public environment variables: `PUBLIC_TURNSTILE_SITE_KEY`; secrets: `TURNSTILE_SECRET_KEY`, `ADMIN_TOKEN`; set via `.env`/`.dev.vars`/deployment secrets (only `PUBLIC_` values reach the client).
- Respect `import.meta.env.BASE_URL` for links; avoid hardcoded URLs. Keep secrets out of `public/` and content frontmatter.
