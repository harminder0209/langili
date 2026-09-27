# Cloudflare runbook

How the development deployment and the canonical staging origin are set up and checked (spec §7,
issue #28). Every step here is done by an administrator in the Cloudflare and Google Cloud
consoles. Never write secrets, tester email addresses, account IDs or recovery material into this
file, any issue or any chat.

## Account

- Workers Free, with no payment method on file and no paid bindings.
- Workers & Pages → Plans: the Free plan fails closed when the daily request allowance runs out.
  Nothing upgrades automatically.
- MFA on for both administrators. The second administrator has an individual login with only
  the roles needed for Pages.
- No Zero Trust: its Free plan requires a payment method, so tester access is a Google sign-in
  middleware instead (below).
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
- `dist/_routes.json` (from `public/`) sends every path to Functions, so `functions/_middleware.ts`
  guards the static assets too. After it lets a request through, a path with no Function falls to
  the assets, and with no top-level `404.html` Pages serves `index.html`: the SPA fallback.

## Tester access

`functions/_middleware.ts` puts Google sign-in in front of every path of both hostnames. A
signed-out page visit goes to Google, and only the Gmail addresses in `TESTER_EMAILS` get back
in, with a 24-hour session cookie for that hostname. Anything missing or malformed in the
settings below makes every path answer `503`.

**Google OAuth client** (Google Cloud console, free, no billing account):

1. Create a project, for example `langili-testers`.
2. Google Auth Platform → Branding: app name `Langili`, your support email. Audience: **External**,
   left in **Testing**, with both testers' Gmail addresses added as test users.
3. Clients → Create client → **Web application**, with these authorized redirect URIs:
   - `https://langili.pages.dev/auth/callback`
   - `https://dev.langili.pages.dev/auth/callback`
   - `http://localhost:8788/auth/callback`
4. Keep the client ID and client secret for the next step. Don't paste them anywhere else.

**Cloudflare** (Settings → Variables and secrets, once under **Production** and once under
**Preview**):

| Name                   | Type   | Value                                                        |
| ---------------------- | ------ | ------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | Text   | The client ID                                                |
| `GOOGLE_CLIENT_SECRET` | Secret | The client secret                                            |
| `SESSION_SECRET`       | Secret | `openssl rand -base64 32`, different for each environment    |
| `TESTER_EMAILS`        | Text   | Both Gmail addresses, comma-separated                        |

Variables apply to the next deployment, so retry the latest deployment after changing them.
Changing `SESSION_SECRET` signs everyone out, which is how sessions are revoked.

Locally, put the same four keys in `.dev.vars` for `npm run dev:pages`. The Playwright suite
starts its own server with local-only settings and signs itself in.

## Verification

Record the results on the ticket, without email addresses or session material.

1. Push a commit to `dev`. Note the head SHA with `git rev-parse origin/dev`.
2. In a browser, open `https://dev.<project>.pages.dev/` and sign in with Google as a tester, then
   open `/api/health`. It shows
   `"environment": "development"` and `"version"` equal to that SHA.
3. Open a client route such as `https://dev.<project>.pages.dev/anything`. The app loads.
4. In a private window (signed out), open the app and `/api/health` on both hostnames, plus a
   `<hash>.<project>.pages.dev` deployment URL. Pages go to Google's sign-in, `/api/health` answers
   `401`, and a Gmail account that isn't allowlisted gets `403`. Never the app or the health JSON.
5. Push a branch other than `dev` or `stage`. No deployment appears.
6. Check the account is still on Workers Free with no payment method, and that GitHub holds no
   Cloudflare token.
