# Repository Guidelines

## Project Structure & Module Organization

- `src/` groups code by domain: `src/flex/` houses the TCP command client and radio model, `src/vita/` contains UDP/VITA parsers, and `src/util/` provides cross-cutting helpers. `src/index.ts` re-exports the domains for consumers.
- `tests/` contains Vitest suites (`*.spec.ts`) and shared utilities in `helpers.ts`; mirror the source layout when adding coverage across `flex`, `vita`, and `util`.
- `messages.json` and `messages.txt` track wire-format constants used for reference when porting commands.
- `official/` stores upstream C# FlexLib snapshots; do not modify or import them, but consult when validating behaviour.
- `tsdown.config.ts` defines bundler entrypoints and build targets for `index`, `flex`, `vita`, and `util`; update it whenever a new public surface is introduced.
- Avoid introducing TS path aliases inside `src/`; relative imports keep the workspace-friendly build layout intact.

## Build, Test, and Development Commands

- `pnpm install` (or `npm install`) syncs dependencies.
- `pnpm run dev` launches `tsdown --watch` for incremental builds.
- `pnpm run build` produces ESM/CJS output and declarations in `dist/`.
- `pnpm run typecheck` runs `tsc --noEmit` under `strict` settings; keep zero errors.
- `pnpm run test` executes the Vitest suite; use `pnpm run test -- --run` filters while iterating.
- `pnpm run lint` checks the codebase with ESLint and TypeScript-aware rules; pair with `pnpm run lint:fix` when resolving reports.
- `pnpm run format` validates Prettier formatting; run `pnpm run format:write` before committing style-only fixes.

## Coding Style & Naming Conventions

- TypeScript modules use ESNext syntax with 2-space indentation and trailing commas; prefer named exports over defaults.
- Use `camelCase` for variables/functions, `PascalCase` for classes, controllers, and types, and `UPPER_SNAKE_CASE` for protocol constants.
- Derive discriminated unions and event payload typings from existing patterns in `events.ts` and `protocol.ts`.
- Run `pnpm run build` before submitting to ensure emitted declarations stay in sync.

## Testing Guidelines

- Write unit tests with Vitest; place them under `tests/` with filenames matching `module-name.spec.ts`.
- Leverage `tests/helpers.ts` for shared fixtures; extend it when adding reusable radio snapshots.
- New features must include tests covering success and error replies, mirroring message flows in `protocol.spec.ts`.
- Execute `pnpm run test` and `pnpm run typecheck` prior to review; add focused integration checks when touching session lifecycle code.

## Commit & Pull Request Guidelines

- Follow Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, etc.) to highlight change intent; keep subject lines under 72 characters.
- Group logically related changes per commit and include brief body bullets when behaviour shifts or new adapters appear.
- Pull requests should summarise the radio flow affected, list testing commands run, and reference any related issues or upstream FlexLib notes.
- Attach protocol captures or screenshots when UX-facing adapters (e.g., discovery UIs) are impacted, and note any new environment variables.
