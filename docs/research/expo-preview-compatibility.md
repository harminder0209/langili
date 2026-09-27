# Expo preview compatibility and runtime fingerprinting

Research for the Wayfinder decision **Verify Expo preview compatibility and runtime fingerprinting**, checked against current official Expo documentation on 2026-09-27.

## Recommendation for the Langili skeleton

Use three deliberately different test surfaces:

1. **Expo Go only for the earliest JavaScript/UI loop.** It is useful while Langili uses only native capabilities already bundled in Expo Go. It cannot validate custom native code/configuration, native branding, universal/app links, or remote push notifications; each Expo Go binary also supports one Expo SDK version. Expo explicitly describes it as a learning playground rather than a production-grade review environment. ([Expo development-build FAQ](https://docs.expo.dev/develop/development-builds/faq/), [Expo Go mismatch guide](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/))
2. **A development build for developer integration testing.** Add `expo-dev-client` once Langili needs production-representative native behavior or native dependencies. Build locally with `npx expo run:android` / `npx expo run:ios`, or in EAS with a development profile. The development-client launcher can open local development servers and published EAS updates. ([Development-build introduction](https://docs.expo.dev/develop/development-builds/introduction/))
3. **An internal-distribution `preview` build for stakeholder and release-candidate testing.** Give it a dedicated `preview` update channel and no developer tools. EAS's standard preview profile is production-like but directly installable: Android uses an APK; iOS uses ad hoc provisioning and only registered devices can install it. ([EAS build profiles](https://docs.expo.dev/build/eas-json/), [Internal distribution](https://docs.expo.dev/tutorial/eas/internal-distribution-builds/))

Configure the native/update compatibility boundary with Expo's currently recommended policy:

```json
{
  "expo": {
    "runtimeVersion": { "policy": "appVersion" }
  }
}
```

`appVersion` is what `eas update:configure` sets and what Expo's current deployment guide recommends; increment the app version whenever Langili creates a new native release. The `fingerprint` policy is technically supported and hashes project inputs that can affect the native runtime, making incompatible updates extremely unlikely, but Expo still labels it experimental and not yet widely recommended. Langili can reassess fingerprinting later rather than making an experimental policy foundational to the skeleton. ([Deploy updates](https://docs.expo.dev/eas-update/deployment/), [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [`expo-updates` reference](https://docs.expo.dev/versions/latest/sdk/updates/))

## Channels, branches, and OTA delivery

Set `build.preview.channel` to `preview` and `build.production.channel` to `production` in `eas.json`. A channel is embedded in native code at build time; it points to an EAS Update branch, whose ordered update groups contain the actual updates. A standalone build only accepts an update that matches its platform, channel, and native runtime. This isolates preview OTA traffic from production while still allowing the channel-to-branch pointer to be changed later. ([Using EAS Update with EAS Build](https://docs.expo.dev/build/updates/), [Manage branches and channels](https://docs.expo.dev/eas-update/eas-cli/), [EAS configuration reference](https://docs.expo.dev/eas/json/))

A minimal eventual shape is:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  }
}
```

Publish JavaScript/assets to the preview audience with `eas update --channel preview --message "…"` (or publish to the branch explicitly). A non-development preview build normally checks and downloads on launch, then runs the downloaded update on the next launch, so testers may need to close and reopen it twice. Do not use Expo Go to validate an update configured with `runtimeVersion`; Expo states those updates must be loaded in a development build. For non-technical reviewers, install the preview binary and publish compatible updates to its channel. ([Get started with EAS Update](https://docs.expo.dev/eas-update/getting-started/), [Using EAS Update with EAS Build](https://docs.expo.dev/build/updates/), [Preview updates](https://docs.expo.dev/eas-update/preview/))

## Native preview builds

The normal shareable path is `eas build --platform android|ios --profile preview`. A newly registered iOS test device requires a new build containing its UDID. For local/manual developer builds, use `npx expo run:android` or `npx expo run:ios`; those generate native projects when absent, compile, install, and start Metro. `eas build --local --platform … --profile preview` runs the EAS build process locally and is chiefly documented for reproducing cloud builds or satisfying infrastructure policy; it requires the local native toolchain, omits EAS caching, and cannot consume EAS secrets automatically. ([Internal distribution](https://docs.expo.dev/tutorial/eas/internal-distribution-builds/), [Development-build introduction](https://docs.expo.dev/develop/development-builds/introduction/), [Local EAS Build](https://docs.expo.dev/build-reference/local-builds/))

Thus “manual native preview build” should mean one of two explicit things in future tickets: a locally compiled development build for developer testing, or a local EAS build using the `preview` profile when parity with the cloud build process is required. It should not be the default stakeholder-distribution workflow.

## Identifying what is running

Use EAS identities rather than a Git commit alone:

- `eas channel:view preview` shows the channel and its linked branch; `eas branch:view <branch>` lists its updates.
- `eas update:list --branch <branch>` lists recent update groups, optionally filtered by platform/runtime; `eas update:view <update-group-id>` identifies one group.
- In the app, `expo-updates` exposes `Updates.updateId`, `Updates.runtimeVersion`, `Updates.createdAt`, and `Updates.isEmbeddedLaunch`. `Updates.channel` is `null` in Expo Go and development builds. Downloaded update IDs can be inserted into the EAS dashboard update URL; embedded update IDs are not tracked there, so check `isEmbeddedLaunch` first. Surface these values on a diagnostics screen or support export so a tester can report the exact binary/update pairing. ([EAS CLI update management](https://docs.expo.dev/eas-update/eas-cli/), [Trace an update ID](https://docs.expo.dev/eas-update/trace-update-id-expo-dashboard/), [`expo-updates` API](https://docs.expo.dev/versions/latest/sdk/updates/))

## Rollback and recovery

EAS supports two deliberate rollback targets through `eas update:rollback`: republish a previously published update so it becomes newest, or instruct compatible clients to return to the update embedded in their binary. The explicit CLI equivalents are `eas update:republish` and `eas update:roll-back-to-embedded`. A subsequent normal publication is then received by clients again. ([Rollbacks](https://docs.expo.dev/eas-update/rollbacks/), [EAS CLI reference](https://docs.expo.dev/eas/cli/))

Operationally, retain the update group ID and message for every preview/production publish, verify the candidate first on a preview build with the same runtime as production, and treat rollback as runtime-specific. A native incompatibility cannot be repaired by redirecting an update to a binary with a different runtime; ship a new binary when the native layer changed. A rollback may also be unsafe if a bad update made persistent device state backward-incompatible, in which case fix forward. Expo's automatic client-side recovery is a last-resort safeguard rather than the release rollback plan. ([Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [Error recovery](https://docs.expo.dev/eas-update/error-recovery/))

## Decision summary

The supported Langili path is: Expo Go for the initial constrained UI loop; development builds as soon as native fidelity matters; an internally distributed preview binary pinned to the `preview` channel; EAS Update for JavaScript/assets only when platform, channel, and runtime match; `appVersion` runtime policy for now, with fingerprinting explicitly deferred while Expo calls it experimental; runtime/update IDs exposed for support; and rollback by republishing a known-good update or returning to the embedded update. Native changes always cross the OTA boundary and require another build.
