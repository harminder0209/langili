# Cloudflare Pages topology for Langili web, PWA, and staging API

_Research date: 2026-09-27. Scope: current official Cloudflare and Expo documentation only._

## Question

What Free-plan-compatible Cloudflare topology supports Langili's Expo web/PWA previews, canonical staging site, TypeScript API, environment configuration, deployment identity, fail-closed exhaustion behavior, build limits, and rollback without automatic usage charges?

## Answer

Use one GitHub-connected Cloudflare Pages project on the **Workers Free plan**. Configure the repository's integration branch (normally `main`) as the Pages **production branch**, but treat its stable `<project>.pages.dev` URL (or an attached custom domain) as Langili's canonical **staging** deployment. Cloudflare's “production” and “preview” are provider deployment classes; both should receive Langili's `staging` application environment. Keep eventual public production out of this project/topology unless the application-environment decision is deliberately revisited.

Build the Expo client with `npx expo export -p web` and publish `dist`. Expo documents that this command emits the web artifact to `dist` and copies `public` into it; its default `single` output is a SPA, while `static` emits route HTML suitable for static hosts including Cloudflare Pages. Choose deliberately between those modes during implementation. The already-approved skeleton shape is compatible with `single`; if used, add a Pages SPA fallback. Expo's PWA guide supports a manifest in `public`, which the export copies into `dist`. A service worker is optional and should remain deferred for this milestone because it creates another cache/rollback surface. ([Expo publishing](https://docs.expo.dev/guides/publishing-websites/), [Expo PWA guide](https://docs.expo.dev/guides/progressive-web-apps/), [Expo static rendering](https://docs.expo.dev/router/web/static-rendering/))

Place the health API at `functions/api/health.ts`. Pages Functions supports `.ts` files in the root-level `/functions` directory, file-based routing, the `PagesFunction<Env>` type, and generated runtime types. The directory is outside the static output (`dist`), and Git integration deploys it with the site. Restrict invocation to `/api/*` with a `dist/_routes.json`; otherwise adding Functions causes all requests to invoke the Function by default, consuming the shared Workers Free request quota. Static asset requests that do not invoke Functions are free and unlimited. ([Functions setup](https://developers.cloudflare.com/pages/functions/get-started/), [TypeScript](https://developers.cloudflare.com/pages/functions/typescript/), [routing and `_routes.json`](https://developers.cloudflare.com/pages/functions/routing/), [Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/))

## Deployment topology

- The Pages production branch updates the stable `<project>.pages.dev` hostname and any custom domain. That stable hostname is the canonical Langili staging origin. ([Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/))
- Each eligible non-production branch gets an immutable hash URL and a moving branch alias. Pull requests originating in the same repository get preview URLs; fork PRs do not. Use custom branch controls to exclude bot/untrusted/noisy branches and conserve builds. ([GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/), [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [known issues](https://developers.cloudflare.com/pages/platform/known-issues/))
- A deployment contains the exported client and that revision's `/functions` code, so web can use same-origin `/api`. This avoids preview CORS churn and keeps client/API revisions aligned. Native staging builds cannot use a relative URL and should use the canonical staging origin.
- Preview deployments are public by default. Cloudflare Access can protect preview deployments, but the Access configuration described for previews is separate from protecting the stable `*.pages.dev`/custom domain. Decide whether previews may be public before provisioning. ([Preview access](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/))

## Configuration and deployment metadata

Set these non-secret values for both Cloudflare deployment classes:

- `EXPO_PUBLIC_APP_ENV=staging` for the Expo build. Never derive Langili's application environment from Cloudflare's `production`/`preview` class, branch, or hostname.
- `EXPO_PUBLIC_API_BASE_URL=/api` for Pages web builds; native staging configuration uses the absolute canonical staging origin.
- Inject `CF_PAGES_COMMIT_SHA` into the client under Langili's public client-revision variable during the build. Cloudflare supplies `CF_PAGES_COMMIT_SHA`, `CF_PAGES_BRANCH`, and `CF_PAGES_URL` to Pages builds. Only the commit SHA matches Langili's approved client-revision meaning. ([Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/))
- Supply the same commit SHA to the Function as the API version. Because build variables and Function bindings have distinct consumption paths, implementation must prove the chosen wiring rather than assume `CF_PAGES_COMMIT_SHA` exists at Function runtime. One robust option is for the build to generate a non-secret version module consumed by the Function; another is an explicitly configured Function variable updated with the deployment pipeline.

Expo replaces statically referenced `process.env.EXPO_PUBLIC_*` values in the client bundle, so those values are public and must never contain secrets. Validate the two required public variables and fail explicitly when missing or invalid, per Langili's existing environment contract. ([Expo environment variables](https://docs.expo.dev/guides/environment-variables/))

Pages Function plain-text variables are readable at `context.env`; encrypted secrets are also accessed there but cannot be viewed after creation. Cloudflare supports separate production and preview values. Store actual credentials only as encrypted secrets, never in Wrangler `vars`, `EXPO_PUBLIC_*`, or committed `.env`/`.dev.vars` files. A Wrangler configuration can version structural settings and distinct `[env.production]`/`[env.preview]` overrides, but Pages does not support configuration per individual preview branch. Configuration or binding changes require a redeployment to take effect. ([Pages bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/), [Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/))

## Free-plan behavior and charge boundary

Pages static asset delivery is free and unlimited. Pages Function requests share the Workers Free allowance: currently **100,000 requests per UTC day across the account**, with a **10 ms CPU limit per invocation**. The free allowance resets at midnight UTC. Configure Pages **fail closed** under Settings > Runtime > Fail open / closed: after the Function allowance is exhausted, Cloudflare returns an error page instead of bypassing Functions and serving assets. This is required so a health/API gate cannot silently disappear. ([Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages fail open/closed](https://developers.cloudflare.com/pages/functions/routing/))

To prevent automatic usage charges:

1. Keep the account on **Workers Free**; do not subscribe to Workers Paid/Standard. Cloudflare says users have Free by default, Free requests cost $0, and excess Free-plan operations fail rather than becoming paid overages. Pages Functions use the Workers plan. ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/))
2. Do not add separately billable products or paid bindings. This skeleton needs no KV, D1, R2, Durable Objects, Queues, AI, or other usage-priced service.
3. Confirm the dashboard still shows Workers Free before launch and after any account-level changes. A billing card or unrelated Cloudflare subscription is not itself evidence that this project cannot incur charges; the operative guard is remaining on Workers Free and avoiding billable products.
4. Keep fail-closed enabled and test it operationally. It protects correctness at request exhaustion; the Free plan is what protects the billing boundary.

Official pricing supports the no-overage conclusion for this scoped topology, but Cloudflare does not document a project-level “hard spend cap” that neutralizes every product an account owner might later enable. Therefore “cannot incur automatic usage charges” remains true only while the account stays on Workers Free and this project uses only Pages static assets and Pages Functions.

## Build limits and control

On the Pages Free plan, the documented limits are **500 builds per month per account**, **one concurrent build**, and a **20-minute build timeout**. A Free-plan site supports up to **20,000 files**, each at most **25 MiB**; a project may have unlimited active preview deployments. ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/))

Use branch controls to deploy the canonical branch plus intentional human feature branches, excluding dependency bots and other high-churn branches. Cloudflare also recognizes documented `[CI Skip]`/`[CF-Pages-Skip]` commit prefixes. Treat build-budget monitoring as an operational check; the official limit page states the cap but does not promise a particular user experience when the monthly build quota is exhausted. ([Branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/))

## Rollback

Cloudflare can instantly roll the Pages **production deployment** back to any previously successful production deployment. Preview deployments are not rollback targets. In this topology, that operation atomically restores the canonical staging site's previously deployed client and Functions artifact. The moving branch alias is not a rollback mechanism; immutable hash preview URLs remain useful for inspection. ([Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/), [preview aliases](https://developers.cloudflare.com/pages/configuration/preview-deployments/))

Keep Git commits/tags as the durable recovery source and retain a rebuild/redeploy procedure. Cloudflare's cited rollback page does not state an indefinite retention guarantee, and a configuration or external binding may have changed since an old artifact was produced. Rollback acceptance must therefore verify both `/api/health` metadata and the client against the target revision.

## Recommended decision

Adopt the one-project topology above for the Langili skeleton:

- Pages production branch = canonical **staging** site.
- Pages previews = same-repository branch/PR previews, all reporting Langili environment `staging`.
- `npx expo export -p web` to `dist`, manifest included, no service worker yet.
- `functions/api/health.ts` with a narrow `_routes.json`, same-origin web API, and absolute canonical URL for native staging.
- Commit SHA injected as client revision and API version; do not expose provider/account identifiers.
- Workers Free only, no paid bindings, fail closed, and explicit quota/build monitoring.
- Roll back the canonical staging deployment through Pages production rollback; rebuild a known Git revision as the durable fallback.

## Decisions still requiring human input

1. **Canonical hostname:** use the stable `<project>.pages.dev` URL initially or attach a custom staging domain.
2. **Preview access:** leave previews public (with Cloudflare's default `noindex`) or require Cloudflare Access; if Access is chosen, establish who must be able to authenticate.
3. **Web output mode:** retain Expo Router's `single` SPA output and add the host fallback, or use `static` output. The current two-screen skeleton does not force either choice.
4. **Branch policy:** which branch names besides the canonical integration branch are eligible for automatic previews within the 500-build monthly allowance.
5. **Metadata wiring:** generate the API version module at build time or manage an explicit Function binding in deployment automation; either must be verified against a real preview and rollback.

## Caveats

- Cloudflare now recommends Workers for many new full-stack projects, but Pages remains documented and available on all plans; this question specifically evaluates Pages and Pages Functions. ([Pages overview](https://developers.cloudflare.com/pages/))
- GitHub fork PRs do not receive Pages previews. If external contributors matter later, a trusted post-review deployment workflow will be a separate security decision.
- Preview configuration is shared across all preview branches, not branch-specific. Do not place production-only secrets in the preview environment.
- The 100,000 request allowance is account-wide, so unrelated Workers/Pages Functions can consume Langili's capacity.
- Fail closed returns Cloudflare's error page when capacity is exhausted; it does not preserve Langili's JSON error envelope. The client must treat this as the already-defined HTTP/service failure.
