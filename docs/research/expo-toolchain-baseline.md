# Expo and repository toolchain baseline

Research date: 2026-09-27

## Decision

Use the latest patched **Expo SDK 57** line, with the versions selected by Expo rather than independently upgrading React or React Native:

| Layer | Baseline |
| --- | --- |
| Expo | `expo ~57.0.25` (SDK 57) |
| UI runtimes | `react 19.2.3`, `react-dom 19.2.3`, `react-native 0.86.3`, `react-native-web ~0.21.0` |
| Navigation/app shell | Expo Router `~57.0.23` and the current SDK 57 default template |
| Host Node | Node `24.21.0` LTS, pinned in local development and CI |
| Package manager | npm `11.19.0`, the version shipped with Node 24.21.0; commit `package-lock.json` and use `npm ci` |
| Language | TypeScript `~6.0.3`, `@types/react ~19.2.2`; extend `expo/tsconfig.base` |
| Static analysis | ESLint flat config with `eslint 10.11.0` and `eslint-config-expo 57.0.2`; Prettier `3.9.9` as a separate formatting check |
| Unit/component tests | Jest `29.7.x`, `jest-expo ~57.0.5`, React Native Testing Library `14.0.1` |
| Web E2E | Playwright Test `1.63.0`, with its matching browser binaries |
| Native E2E | Maestro, pinned to one release in developer setup and CI; run against a built `.app`/`.apk` |
| Cloudflare | Wrangler `4.141.0`, installed locally; Pages Functions in root `/functions`; generated runtime types; pinned compatibility date |

The exact app dependency graph should start from the current `create-expo-app` SDK 57 default template and be normalized with `npx expo install --fix`. In CI, `npx expo install --check` and `npx expo-doctor@latest` should reject drift. Expo explicitly warns that React Native dependencies often require the exact version paired with the SDK and provides these commands for validation and correction ([Expo CLI](https://docs.expo.dev/more/expo-cli/), [upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)).

This is a maintained, stable baseline as of the research date. SDK 57 was released on 2026-06-30; SDK 58 was still prerelease, so it is not the baseline. Expo's supported-version table maps SDK 57 to React Native 0.86, React 19.2.3, React Native Web 0.21.0, and a minimum Node 22.13.x ([SDK reference](https://docs.expo.dev/versions/latest/), [SDK 57 release notes](https://expo.dev/changelog/sdk-57)). The later SDK 57 patches matter: Expo moved to React Native 0.86.2 to address a Hermes regression and then 0.86.3 to address development startup time, which is why the recommendation is the current patch line rather than 57.0.0.

## Compatibility constraints

### Native and web targets

SDK 57 supports Android 7+, compiles and targets Android API 36, and supports iOS 16.4+ with Xcode 26.4+ ([Expo SDK support table](https://docs.expo.dev/versions/latest/)). Xcode 27/iOS 27 scene lifecycle support requires `expo` 57.0.23 or later and an explicit `ios.enableSceneSupport` opt-in through `expo-build-properties`; it is not an automatic SDK 57 behavior ([SDK 57 release notes](https://expo.dev/changelog/sdk-57)).

Use Expo's universal Metro path for Android, iOS, and web. A production web bundle is produced with `npx expo export -p web` in `dist` ([Expo web publishing](https://docs.expo.dev/guides/publishing-websites/)). For Cloudflare Pages, choose Expo Router `web.output: "static"` unless a separately designed request-time server is required; Expo says static output can deploy to Cloudflare Pages ([static rendering](https://docs.expo.dev/router/web/static-rendering/)). Pages Functions remain separate files under the repository-root `/functions` directory, not under `dist` ([Pages Functions get started](https://developers.cloudflare.com/pages/functions/get-started/)).

### Node and package installation

Node 24 is LTS and supported by all three critical consumers: it exceeds Expo SDK 57's Node 22.13 minimum, Wrangler supports Current/Active/Maintenance Node releases, and Playwright supports the latest 22.x, 24.x, or 26.x ([Node release status](https://nodejs.org/en/about/previous-releases), [Wrangler installation](https://developers.cloudflare.com/workers/wrangler/install-and-update/), [Playwright installation](https://playwright.dev/docs/next/intro)). Pinning `24.21.0` also fixes npm at `11.19.0` according to the official Node archive ([Node 24 archive](https://nodejs.org/en/download/archive/v24)).

Use one package manager only. Record `"packageManager": "npm@11.19.0"`, an exact Node version file/tool declaration, and an `engines.node` constraint such as `24.21.x`. Commit the npm lockfile. Local setup and every CI job begin with `npm ci`; npm documents that it fails when the manifest and lock disagree instead of rewriting the lock ([npm install/CI behavior](https://docs.npmjs.com/cli/install/)). Do not invoke unpinned `npx wrangler` in automation: Cloudflare notes that it downloads the latest version when Wrangler is absent and recommends a project-local installation so a team can control and roll back the version ([Wrangler installation](https://developers.cloudflare.com/workers/wrangler/install-and-update/)).

### Cloudflare Pages Functions

Use `wrangler.jsonc` as the source of truth with `pages_build_output_dir: "./dist"` and a literal compatibility date. Set it initially to `2026-09-25` (the current documented example date at research time) and move it only through reviewed dependency/toolchain updates. Cloudflare requires Wrangler 3.45+ for Pages configuration and applies the same file to local, preview, and production environments ([Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)).

Pages Functions execute in `workerd`, not the host Node process. With compatibility dates on or after 2026-08-04, Cloudflare enables its Node compatibility behavior by date; this remains a subset/polyfill environment, so code must not assume every Node API behaves as in Node itself ([Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)). Prefer Web Platform APIs. Run `wrangler types --path='./functions/types.d.ts'`, give Functions their own `tsconfig.json`, and include Node types only if Node compatibility APIs are intentionally used ([Pages TypeScript](https://developers.cloudflare.com/pages/functions/typescript/)).

The reproducible integration loop is:

1. `npm run export:web` runs `expo export -p web` into `dist`.
2. `npm run cf:types` regenerates/verifies Function bindings and runtime types.
3. `npm run dev:pages` runs the pinned local Wrangler as `wrangler pages dev`, serving the static bundle and Functions together; Cloudflare identifies this as the supported Pages local-development command ([local development](https://developers.cloudflare.com/pages/functions/local-development/)).
4. Preview and production deployments use that same checked-in Wrangler configuration. Secrets live outside Git in `.dev.vars*` locally and Cloudflare secrets remotely ([Pages bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/)).

## Quality toolchain

Use the SDK 57 template's TypeScript `~6.0.3`, even though newer standalone TypeScript releases exist; this is the version Expo's template tests with. Extend `expo/tsconfig.base` and make `tsc --noEmit` a distinct CI step ([Expo TypeScript guide](https://docs.expo.dev/guides/typescript/)).

Use ESLint's flat configuration, which Expo has made its default since SDK 53, extending `eslint-config-expo/flat`. Run `expo lint` in CI. Run Prettier independently with `prettier --check .`; avoid making formatting depend solely on ESLint so each tool has one responsibility. Expo documents both the flat config and the supported Prettier packages ([ESLint and Prettier](https://docs.expo.dev/guides/using-eslint/)). Pinning their exact resolved versions in the lockfile is more important than permitting package ranges to float.

For unit and component tests, use `jest-expo` plus React Native Testing Library. Expo recommends this pairing and specifically says not to use the deprecated `react-test-renderer` interface for React 19 ([unit testing](https://docs.expo.dev/develop/unit-testing/)). Keep Jest on 29.7.x because `jest-expo` 57's internal Jest packages are on the 29 line; do not independently advance Jest until the Expo preset supports that major. Use `expo-router/testing-library` for in-memory route integration tests and keep tests outside the routes directory ([Expo Router testing](https://docs.expo.dev/router/reference/testing/)).

Use Playwright `1.63.0` for browser-level tests of the exported web app and Pages Function routes. The Playwright package and browser binaries are a coupled set, so CI must run the matching `playwright install --with-deps`; Playwright recommends `npm ci` and one worker in CI for stability ([browser coupling](https://playwright.dev/docs/browsers), [Playwright CI](https://playwright.dev/docs/ci)). Use Maestro for a small set of critical native journeys. Expo's EAS example requires a built Android APK or iOS app and runs the same Maestro flows locally or in workflows ([Expo Maestro E2E](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)). Playwright's mobile emulation is browser emulation, not a replacement for native-device coverage.

## Expo Go, development, preview, and production builds

Expo Go is only a quick smoke-test path for screens that use its fixed native-library set. Expo describes it as a learning playground, while a development build is the production-project environment that permits custom native libraries and configuration ([development-build FAQ](https://docs.expo.dev/develop/development-builds/faq/), [development-build introduction](https://docs.expo.dev/develop/development-builds/introduction/)). The installed Expo Go version must support SDK 57; Android devices/emulators and iOS simulators can install an SDK-specific build, but physical iOS distribution has stricter current availability rules ([Expo Go mismatch guidance](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)). Therefore Expo Go must never be the only acceptance gate.

Check in these EAS build intents:

- `development`: `developmentClient: true`, `distribution: "internal"`; used by developers with the Metro server and arbitrary native modules.
- `preview`: `distribution: "internal"`; production-like binary without developer tools, directly installable for stakeholder and native E2E checks. Add a separate `ios.simulator: true` profile for simulator artifacts.
- `production`: store-distribution binary; not treated as directly installable test output.

These meanings and platform artifact differences are defined by Expo's EAS profile reference ([EAS configuration](https://docs.expo.dev/build/eas-json/)). Give development, preview, and production unique Android application IDs and iOS bundle identifiers when they must coexist on a device ([app variants](https://docs.expo.dev/build-reference/variants/)).

## Reproducible local and CI contract

The repository should expose the same package scripts locally and in CI:

```text
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npx expo install --check
npx expo-doctor@latest
npm run export:web
npm run test:e2e:web
npm run test:e2e:native   # on jobs with the pinned simulator/emulator and built binary
```

CI should pin the operating-system image/action revisions as well as Node and npm, cache only by lockfile plus tool version, and never substitute `npm install` for `npm ci`. Native build jobs should pin the EAS image/toolchain compatible with SDK 57; local native builds must meet Android API 36 and Xcode 26.4 requirements. Keep generated `ios/` and `android/` directories either consistently committed and reviewed or consistently generated through Expo Continuous Native Generation—never a mixture.

## Upgrade boundary

Patch releases inside SDK 57 can be accepted through a dedicated lockfile update that runs the full matrix above. A move to Expo SDK 58, React/React Native majors, Node major, Wrangler major, TypeScript major, Jest major, or Playwright version is a deliberate toolchain upgrade: update the pinned versions and compatibility date together, regenerate Cloudflare types and Playwright browsers, rebuild development/preview binaries, and rerun web plus native E2E. Do not use Expo beta/canary packages in the baseline; Expo explicitly classifies prereleases separately from stable SDK releases ([SDK prerelease policy](https://docs.expo.dev/versions/latest/)).
