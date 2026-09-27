# Langili

A language-learning application for web, iPhone and Android, built as one Expo app with a
Cloudflare Pages Functions API. See [`CONTEXT.md`](CONTEXT.md) for the vocabulary and
[`docs/spec/langili-skeleton.md`](docs/spec/langili-skeleton.md) for the current milestone.

## Setup

- Node `24.21.0` (see `.nvmrc`) with its bundled npm `11.19.0`. npm is the only package manager.
- Install with `npm ci`, never `npm install`, so the committed lockfile is reproduced exactly.
- `.env` holds the non-secret development values. Local Function variables go in `.dev.vars`
  (gitignored), using the key names in `.dev.vars.example`. `npm run dev:pages` needs a
  `TESTER_CREDENTIALS` entry there, or every path answers `503`.

## Everyday commands

| Command              | Does                                                        |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Expo dev server                                             |
| `npm run export:web` | Exports the web bundle to `dist/`                           |
| `npm run dev:pages`  | Serves `dist/` and `functions/` with the local Pages server |
| `npm run check`      | Format check, lint, typecheck and unit tests (pre-commit)   |
| `npm run ci`         | Everything CI runs, including web end-to-end tests          |

Web end-to-end tests need the Playwright browser once: `npx playwright install chromium`.
