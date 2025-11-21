# Repository Guidelines

## Project Structure & Module Organization

- `src/pages/` stores routes; `src/layouts/` shares shells; `src/components/` holds reusable UI (Header, Footer, BaseHead, Remark42).
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

- For visual principles, spacing, and interaction cues, follow `src/content/blog/design-primitives.md`; keep tokens/components aligned to that guide instead of restating it here.

## Configuration & Security Notes

- Public environment variables: `PUBLIC_REMARK_URL`, `PUBLIC_REMARK_SITE_ID`; set via `.env`/deployment secrets (only `PUBLIC_` values reach the client).
- Respect `import.meta.env.BASE_URL` for links; avoid hardcoded URLs. Keep secrets out of `public/` and content frontmatter.
