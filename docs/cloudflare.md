# Cloudflare runbook

How the development deployment and the canonical staging origin are set up and checked (spec §7,
issue #28). Every step here is done by an administrator in the Cloudflare dashboard. Never write
allowlisted email addresses, account IDs or recovery material into this file or any issue.

## Account

- Workers Free, with no payment method on file and no paid bindings.
- Workers & Pages → Plans: the Free plan fails closed when the daily request allowance runs out.
  Nothing upgrades automatically.
- MFA on for both administrators. The second administrator has an individual login with only
  the roles needed for Pages and Zero Trust.
- No Cloudflare API token is created for GitHub. Builds use the GitHub integration only.

## Pages project

Create one Pages project with **Connect to Git** on `harminder0209/langili`. Use the name `langili`
if it's free, which gives `langili.pages.dev`.

| Setting                | Value                  |
| ---------------------- | ---------------------- |
| Production branch      | `stage`                |
| Build command          | `npm run build:pages`  |
| Build output directory | `dist`                 |
| Root directory         | _(empty)_              |
| Build system version   | 3 (reads `.nvmrc`)     |

**Branch control.** Automatic production deployments are on. Preview deployments are set to
**Custom branches**, including only `dev`. Leave the exclude list empty. Pull requests from forks
never build.

**Build variables** (Settings → Variables and Secrets). Both are plain text, not encrypted:

| Variable                   | Production (`stage`)            | Preview (`dev`)                     |
| -------------------------- | ------------------------------- | ----------------------------------- |
| `EXPO_PUBLIC_APP_ENV`      | `staging`                       | `development`                       |
| `EXPO_PUBLIC_API_BASE_URL` | `https://<project>.pages.dev/api` | `https://dev.<project>.pages.dev/api` |

Encrypted Function secrets, when there are any, go in the same place: production gets the staging
values and preview gets the development values.

## What a build does

`npm run build:pages` runs `scripts/build-info.js`, then `expo export -p web --clear`:

- `build-info.js` writes `functions/build-info.ts` (gitignored) with `CF_PAGES_COMMIT_SHA` as the
  **API version** and `EXPO_PUBLIC_APP_ENV` as the environment. On Cloudflare the build fails if
  either value is missing or invalid, so it never falls back to the committed `.env`.
- `app.config.ts` puts `CF_PAGES_COMMIT_SHA` into `extra.clientRevision`, the **client revision**.
  The Metro cache is cleared so a cached manifest can't carry an older commit.
- Pages then compiles `functions/`, so the client and the Functions deploy as one unit.
- `dist/_routes.json` (from `public/`) sends only `/api/*` to Functions. With no top-level
  `404.html`, Pages serves `index.html` for every other path: the SPA fallback.

## Access

Zero Trust → Access → Applications → **Add a self-hosted application**:

- Destinations: `<project>.pages.dev` and `*.<project>.pages.dev`. The wildcard covers
  `dev.<project>.pages.dev` and each deployment's own `<hash>.<project>.pages.dev` URL, which is
  otherwise public.
- Session duration: 24 hours.
- Login method: **One-time PIN** only.
- One **Allow** policy: include **Emails**, holding exactly the two testers' addresses. Add
  nothing else: no everyone, no email domain, no service token. Anyone not on the list is denied.
- Every path is covered, including `/api/*`. There are no bypass policies.

The Pages built-in "Enable access policy" toggle protects only preview hostnames, so the
self-hosted application above is what protects the production hostname.

## Verification

Record the results on the ticket, without email addresses or session material.

1. Push a commit to `dev`. Note the head SHA with `git rev-parse origin/dev`.
2. In an authorized browser, open `https://dev.<project>.pages.dev/api/health`. It shows
   `"environment": "development"` and `"version"` equal to that SHA.
3. Open a client route such as `https://dev.<project>.pages.dev/anything`. The app loads.
4. In a private window (signed out), open the app and `/api/health` on both hostnames, plus a
   `<hash>.<project>.pages.dev` deployment URL. Each shows the Access login, never the app or JSON.
5. Push a branch other than `dev` or `stage`. No deployment appears.
6. Check the account is still on Workers Free with no payment method, and that GitHub holds no
   Cloudflare token.
