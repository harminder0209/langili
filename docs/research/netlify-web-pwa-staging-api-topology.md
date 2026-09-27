# Netlify web, PWA, and staging API topology

Research for “Verify the Netlify web, PWA, and staging API topology”, current as of 2026-09-27.

## Recommendation

Use one Git-connected Netlify project for the first Langili skeleton. Treat its configured production branch and primary `*.netlify.app` URL as the canonical **staging** deployment, despite Netlify naming that deploy context `production`. Enable Deploy Previews for pull requests against that branch. Build the Expo web client and the TypeScript API functions together so every preview and staging release is one immutable, atomic deploy.

Do not create a second Netlify project or a long-lived `staging` branch merely to model the application environment. Langili's `staging` value is a product configuration value, while Netlify's `production` context means “the deploy on this project's primary URL.” A separate production project can be introduced when a public production deployment is actually in scope; it can then use `EXPO_PUBLIC_APP_ENV=production` without changing the staging project's role.

This fits Netlify Free: the plan includes unlimited Deploy Previews and serverless functions and has a hard 300-credit monthly limit. Deploy Previews and branch deploys themselves cost zero credits, while production deploys, function compute, bandwidth, and web requests consume credits. A successful production deploy currently costs 15 credits, so avoid no-op staging rebuilds and monitor usage. If the team reaches the Free limit, projects pause until the next billing cycle rather than incurring overage. [Netlify credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)

## Deploy shape

- Connect the public GitHub repository to one Netlify project and select the integration/default branch as Netlify's production branch. Commits to it replace the stable staging URL; pull requests receive URLs shaped like `deploy-preview-<PR>--<site>.netlify.app`. Netlify enables PR Deploy Previews by default, subject to its controls. [Deploy overview](https://docs.netlify.com/deploy/deploy-overview/) [Deploy Previews](https://docs.netlify.com/deploy/deploy-types/deploy-previews/)
- Run a repository-owned build command such as `npm run build:web`, ultimately invoking `npx expo export -p web`; publish `dist`. Expo documents that command and directory and explicitly supports continuous delivery through Netlify. [Expo: Publish websites](https://docs.expo.dev/guides/publishing-websites/)
- Use Expo Router `web.output: "single"` for the skeleton unless a later product decision requires pre-rendered HTML. Add `public/_redirects` containing `/* /index.html 200` so browser navigation falls back to the SPA entry point. Expo says the redirect is required for `single` output and may be skipped for static rendering. [Expo: Publish websites](https://docs.expo.dev/guides/publishing-websites/)
- Keep `netlify/functions/*.mts` outside `dist`. Use the modern Netlify Functions API (`Request`, `Context`, `Response`) and `@netlify/functions` types; route the health handler directly to `/api/health` with its exported `Config.path`. Netlify compiles TypeScript without an extra compiler setup, finds `tsconfig.json` in the function, base, or repository directory, and recommends ESM via `.mts`. [Get started with functions](https://docs.netlify.com/build/functions/get-started/) [Function configuration](https://docs.netlify.com/build/functions/configuration/)
- Keep the API and client same-origin in every Netlify deploy: the web client should use `/api` (or derive the absolute URL from the current browser origin) rather than embedding the stable staging hostname. A preview then calls its own preview function, not the shared staging function. Netlify functions are immutable per deploy, so a later staging change does not mutate a prior preview's API. [Functions overview](https://docs.netlify.com/build/functions/overview/)
- The native clients still require the absolute `EXPO_PUBLIC_API_BASE_URL` agreed in the environment contract. For staging native artifacts, point it to the stable staging site origin. This means the same public input may be resolved differently by platform/build tooling while retaining one contract.

## PWA shell

Expo Router does not automatically generate a PWA manifest or service worker. Put the install manifest and its icons in `public/`, link `/manifest.json` from the web HTML, and let Expo copy public assets into `dist`. For the agreed “installable shell” requirement, the manifest is required; offline API behavior is not.

Do not add a service worker merely to qualify the skeleton as installable. If offline shell caching is later required, Expo's supported path is a Workbox CLI post-build step after `expo export`, but Expo explicitly warns that aggressive service-worker caching can prevent users from receiving updates. That also makes Netlify rollback behavior harder to reason about at the browser cache boundary. [Expo: Progressive web apps](https://docs.expo.dev/guides/progressive-web-apps/) [Expo: Migrate from Expo Webpack](https://docs.expo.dev/router/migrate/from-expo-webpack/)

## Environment configuration

Commit non-secret structural configuration (`build.command`, `build.publish`, functions directory and route behavior) in root `netlify.toml`. Keep secrets in Netlify's UI, CLI, or API. Netlify warns against committing sensitive values, and values declared in `netlify.toml` are not available to functions at runtime. [File-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/) [Function environment variables](https://docs.netlify.com/build/functions/environment-variables/)

For this staging-only project, set these public values consistently for both Netlify `production` and `deploy-preview` contexts:

| Input | Staging deploy | Deploy Preview |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | `staging` | `staging` |
| Web API base | Same-origin `/api` behavior | Same-origin `/api` behavior |
| Native `EXPO_PUBLIC_API_BASE_URL` | Stable staging origin | Normally still stable staging, unless a dedicated preview-native flow is later approved |

Netlify supports context-specific and branch-specific values. Variables stored through the UI/CLI/API default to all scopes on Free because selectable scopes are Pro/Enterprise-only; therefore use least privilege in code and never expose server-only values through Expo's `EXPO_PUBLIC_` namespace. [Environment variables overview](https://docs.netlify.com/build/environment-variables/overview/)

For the public repository, retain Netlify's default **Require approval** sensitive-variable policy for deploys from unrecognized contributors, or choose **Deploy without sensitive variables** only if the preview build and health function are deliberately able to operate without them. Never use **Deploy without restrictions** with secrets. [Sensitive variable policy](https://docs.netlify.com/build/environment-variables/get-started/#sensitive-variable-policy)

The existing explicit CORS allowlist remains necessary for native clients and any direct cross-origin call. The same-origin web path avoids needing to enumerate Netlify's changing preview subdomains for ordinary browser traffic. If cross-origin preview access is nevertheless required, the implementation must validate Netlify's exact `deploy-preview-<number>--<site>.netlify.app` hostname shape rather than emit `Access-Control-Allow-Origin: *`.

## Deployment metadata

During a Netlify build, `COMMIT_REF`, `DEPLOY_ID`, `DEPLOY_URL`, `DEPLOY_PRIME_URL`, `CONTEXT`, `HEAD`, and (for PRs) `REVIEW_ID` are available. Use the build command or a small build step to copy only approved public values into both artifacts:

- expose `COMMIT_REF` to Expo as the client commit SHA;
- compile `COMMIT_REF` (preferred API version for Git-backed deploys) and, optionally, `DEPLOY_ID` into a generated module imported by the health function;
- use `DEPLOY_PRIME_URL` only for build/verification evidence, not as Langili's environment identity.

This injection is necessary because at function runtime Netlify exposes only `URL`, `SITE_NAME`, and `SITE_ID` from its read-only variables; build metadata such as `COMMIT_REF` and `DEPLOY_ID` is not promised there. The health response should emit only the approved opaque `version`, never Netlify site/account IDs, branch names, deploy URLs, or arbitrary environment data. [Build environment variables](https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata) [Function environment variables](https://docs.netlify.com/build/functions/environment-variables/#netlify-read-only-variables)

## Rollback

Each deploy is atomic and includes its corresponding static site and immutable functions. To roll staging back, select a prior successful deploy and use **Publish Deploy**. Netlify says this instantly republishes the previous atomic deploy without starting a new build; on credit-based plans, rollback does not consume production-deploy credits. A subsequent Git-triggered deploy will supersede it while auto-publishing remains enabled. Locking the published deploy temporarily stops new builds from being promoted while still allowing them to complete. [Manage deploys](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/#credit-usage-for-production-deploys)

Rollback is time-bounded on Free. Netlify automatically deletes most deploys after 30 days, while preserving the currently published deploy, most recent successful production deploy, and most recent successful branch deploy per branch. Therefore the acceptance test should prove one-click rollback using a recent known-good deploy; Netlify history is not a permanent release archive. Source tags/commits remain the durable recovery mechanism, and rebuilding an old commit is the fallback after its deploy expires. [Automatic deploy deletion](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#automatic-deploy-deletion)

## Decisions this evidence supports

1. One staging Netlify project is sufficient for the skeleton; Netlify's primary/`production` deploy context may legitimately carry Langili's `staging` application environment.
2. Deploy Previews contain both the Expo web artifact and that revision's API functions and use same-origin `/api`, giving coherent preview isolation without a second API project.
3. PWA scope is an explicit manifest/installable shell. Service-worker/offline caching is deferred.
4. Public environment identity and commit metadata are injected at build time and validated; functions do not infer them from runtime Netlify variables or hostnames.
5. Rollback republishes a recent atomic deploy; Git history is the durable fallback beyond Free-plan retention.

## Newly surfaced decisions / fog

- The future public-production topology is intentionally not selected here. When production enters scope, decide whether it is a separately permissioned Netlify project (cleanest isolation) and how promotion between projects is authorized; automatic production promotion is already out of scope.
- Decide during implementation planning whether the web-facing `EXPO_PUBLIC_API_BASE_URL` contract accepts a relative `/api` value or whether the build materializes an absolute `DEPLOY_PRIME_URL + /api`. Relative same-origin configuration is safer and simpler for previews, but the current contract calls the value a base URL and may require an explicit clarification.
- A service-worker cache/update policy becomes a separate decision only if offline shell operation is promoted beyond “installable shell.”
- Account provisioning must configure the Git connection, stable site name/domain, production branch, contextual public variables, sensitive-variable policy, and usage notifications. No credentials or concrete site URL exist yet.
