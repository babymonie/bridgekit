# Testing and evidence

## General patcher and picker (0.5)

```powershell
npm ci
npm test
npm run picker:verify
npm run patcher:verify
```

The Node suite now covers archive entry resolution, CJS/ESM preservation, profile scopes, read-only app discovery, fuse blockers, running/changed-app refusal, locks, ownership, backup/update/restore, CLI lifecycle, desktop controller and app-picker UI in addition to the existing plugin suites. CI runs on Windows and Linux. Optional proprietary packages and original vendor archives explain skips in a clean clone.

picker:verify launches a separate Electron desktop fixture. It exercises the real preload/IPC/controller and worker scanner, patches/updates/restores only generated apps, verifies exact backups, checks Node isolation, and rejects an unrelated renderer. It does not mutate installed user apps.

patcher:verify creates unrelated CommonJS and ES-module ASAR apps, patches them through the general engine, launches their original entries, exercises SDK plugins on explicitly scoped local pages with ephemeral sessions, updates the sidecar and restores exact original archive bytes. Close the app picker first: sharing the development Electron executable conservatively counts as running.

Local 0.5 evidence: all 78 Node tests passed with local optional fixtures present; nine desktop picker checks passed; 22 generated-app launch/plugin/update/restore checks passed across CJS/ESM. Real machine discovery found 23 entries in a bounded partial scan. Those entries are static candidates/blocked results, not 23 verified vendor integrations. No detected real app was patched by these tests.

Receipts and screenshots are generated locally beside package.json and Git-ignored because they may contain paths/logs. Check freshness, actual runtime, skipped phases and success. Node/JSDOM, offline desktop fixtures, installed vendor runtime and live behavior are different evidence levels.


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
