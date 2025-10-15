# Repository Guidelines

## Project Structure & Module Organization

- `src/pages/` defines Astro routes; pair each page with a matching layout from `src/layouts/` when adding new views.
- `src/components/` holds reusable view logic, while `src/utils/` and `src/types/` keep supporting logic and shared types.
- Long-form content lives in `src/content/blog/` as MD or MDX files registered through `src/content.config.ts`; run `pnpm astro sync` after changing collection schemas.
- Static assets belong in `public/`; prefer descriptive kebab-case file names so they map cleanly to generated URLs.

## Build, Test, and Development Commands

- `pnpm install` – install dependencies pinned by `pnpm-lock.yaml`.
- `pnpm dev` – start the Astro dev server with hot reload.
- `pnpm build` – produce the production bundle in `dist/`.
- `pnpm preview` – serve the built site locally to verify deployment output.
- `pnpm astro check` – run Astro’s type and config verification before committing.
- `pnpm exec playwright test` – execute end-to-end suites (configure specs in `tests/`).

## Coding Style & Naming Conventions

- Follow Astro/TypeScript defaults: 2-space indentation, `strictNullChecks`, and module `type: "module"`.
- Name components and layouts in PascalCase (`PostCard.astro`), utilities in camelCase, and content entries using the `YYMM-#` pattern already present in `src/content/blog/`.
- Prefer `const` with explicit return types and keep imports path-based within `src` to preserve tree-shakeable modules.
- Format Astro and MDX via editors that support Prettier with the Astro plugin; keep markdown frontmatter minimal and sorted.

## Testing Guidelines

- Write Playwright specs alongside related features under `tests/` using the `.spec.ts` suffix.
- Cover navigation, content rendering, and mermaid/MDX integrations; add regression tests for critical journeys before large layout changes.
- Run `pnpm exec playwright test --headed` when debugging visually; capture a failure trace with `--trace on` and attach it to pull requests when relevant.

## Commit & Pull Request Guidelines

- Base commit messages on Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in recent history (`chore(deps): bump astro…`); keep subject lines under ~70 chars.
- Group related file changes and avoid bundling content updates with structural refactors.
- Pull requests should describe the motivation, summarize testing (e.g., “`pnpm build` and Playwright smoke suite”), and link any tracking issues.
- For visual changes, add before/after screenshots or local preview URLs to help reviewers verify the result quickly.
