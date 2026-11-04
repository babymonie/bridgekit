# Testing and evidence

## Clean clone

```powershell
npm ci
npm test
```

Node checks cover imports/registry, grants, lifecycle, manager authentication, JSDOM UI, page rules and installer paths. CI uses Windows. Optional FORECAST checks explain skips without its local package. The real-archive rollback test skips without a supported local archive.

The repository omits proprietary packages, app archives and machine receipts. Skipped optional tests are not evidence those features work.

## Actual Electron fixtures

```powershell
npm run manager:verify
npm run ad-cleaner:verify
npm run verify:adapter
```

These open windows using pinned development Electron with separate profiles/offline pages. The manager exercises an unrelated SDK package through real IPC, install/enable/settings, DOM cleanup, persistence and uninstall. Native FORECAST checks skip explicitly if that package is absent.

Ad Cleaner has 17 local checks covering zero-height collapse, dynamic nodes, hashes, navigation and disable cleanup. These are layout assertions, not match actions.

## Installed runtime

Fully exit FACEIT first:

```powershell
npm run faceit:verify
npm run manager:verify-installed
```

A verified patched build is required. Diagnostic flags run fixtures in the packaged executable rather than normal account flow.

Optional FORECAST fixtures expect a locally supplied converted package under plugins/faceit-forecast (Git-ignored). An arbitrary raw folder may not reproduce that conversion. Repeek/import diagnostics use BRIDGE_TEST_REPEEK and BRIDGE_TEST_IMPORT extension-package paths only.

## Historical local evidence

Before repo setup, separate runs recorded 51 Node tests, 38 SDK checks, 19 manager checks, 17 FORECAST checks, 10 import/Repeek checks and 17 Ad Cleaner checks. Counts refer to distinct scopes/runtimes. The SDK receipt predates some 0.4.1 fixes. These are historical local results, not claimed clean-clone/CI outcomes.

Fresh receipts appear beside package.json and are Git-ignored because they may contain paths/logs. Check success, freshness, skips and runtime versions. Older fixture labels are not installed build identity; use bridge-install.json.

Node/JSDOM does not prove desktop isolation/visuals. Offline Electron does not prove all live features. A popup opening does not establish statistics, Premium, sign-in, clipboard or upload automation.

## Repository preparation validation — 4 November 2026

The initial source commit passed [GitHub Windows CI](https://github.com/babymonie/bridgekit/actions/runs/41800916234): 51 discovered tests, 46 passed, zero failures and five explicit optional skips (FORECAST package/layout and local archive). A clean local export installed with npm ci and passed 47 tests with four FORECAST skips; the supported local archive was available there. Its actual Electron manager fixture passed 13 SDK/manager checks and explicitly skipped the missing native FORECAST phase. The full local source, with optional fixtures present, passed all 51 Node tests.

These results establish a usable clean source distribution. They do not expand the supported app or native extension matrix.
