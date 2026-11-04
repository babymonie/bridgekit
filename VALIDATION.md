# BridgeKit 0.5 general patcher validation

All 78 local Node tests passed. The standalone desktop IPC/worker/controller fixture passed nine checks. Generated CommonJS and ES-module apps passed 22 launch/plugin/isolation/update/exact-restore checks. Runtime/profile data were isolated; only synthetic fixture archives were patched. The real installed-app scan found 23 entries with explicit partial-coverage reporting. No real app was patched or reloaded by this work.

See docs/testing.md and the locally generated patcher-ui-verification.json / patcher-verification.json receipts. The reports and screenshot are excluded from Git. A candidate label establishes static checks only, not universal vendor compatibility. FACEIT's existing installation format, preset hashes and data paths remain supported.

---

> Historical local integration notes. Third-party packages and machine-specific receipts are not distributed in Git. See [current compatibility](docs/supported-apps.md) and [testing](docs/testing.md).

# Current follow-up: Bridge 0.4.1

51 Node tests passed. Fresh installed FACEIT-runtime tests passed 10 targeted import/Repeek checks, 19 manager lifecycle checks and 17 FORECAST checks. See compatibility-verification.json and IMPORT-PERMISSIONS-FIX.md. Actual installed version is recorded in bridge-install.json; the manager fixture's older template version field remains 0.4.0.

The uploader is installed disabled. Repeek's missing-site-permission screen is fixed, but its separate background polyfill error remains; complete feature compatibility is not claimed. FACEIT was left closed following this update.

---

# Bridge 0.4.0 validation â€” 4 November 2026

The user authorized launching FACEIT and Bridge for this test. The verified FACEIT 2.11.0 runtime was updated to Bridge 0.4.0; original archive backup and saved settings were preserved.

- **48 Node/JSDOM/fake-Electron tests passed**: manager-node-tests.tap.
- **38 SDK checks passed in FACEIT Electron 45.1.0**: verification.json. Tests include actual DOM operations, broker denials, settings persistence and renderer isolation on an offline fixture.
- **17 FORECAST checks passed in that packaged runtime**: forecast-verification.json. Tests include original identity/worker, content loading, local sync fallback, native APIs, app-window protection and full-height outer settings.
- **19 manager checks passed through the real FACEIT adapter in that packaged runtime**: manager-electron-verification.json. An unrelated SDK package is installed via the manager preload/IPC, enabled, attached to an offline page, opened, disabled, re-enabled and uninstalled. Checks verify Node absence, DOM cleanup, saved settings, persisted disabling and independent manager availability. A native package is then loaded/opened/disabled; settings closure, native unload, disabled persistence and both outer/inner full-height settings layout are verified.

Manager fixture file selection and approval dialogs return deterministic test responses; this proves the real installer/broker path but does not replace visual file-picker testing. It uses a temporary profile, offline page and separate registry. No match, payment, invitation or account change was performed.

The normal FACEIT app reached its website after restart. Ctrl+Shift+B opened the installed manager, which listed FORECAST Running and Hello panel Disabled. FORECAST Settings opened in the normal app. Visual inspection found its history region still capped at 200px despite a full-height outer page; package CSS now lets expanded history fill the remaining space. That fix passed actual installed-runtime geometry assertions.

Testing also found a reserved underscore-prefixed compatibility folder and a missing shortcut on app-owned loader windows. Both were fixed; the shortcut regression has a dedicated Node test and grants no plugin access to unsafe loader pages.

Limits: these checks do not prove every live FORECAST statistic, premium feature, sign-in or Chrome API. FACEIT initially remained on its loader with plugins both enabled and disabled; a later normal restart reached the website, so the test does not establish the initial delay's cause. Native popup capture returned UnknownVizError; automated PNG capture of that popup remains unavailable. A sync-unavailable console warning also appeared during the manager/native fixture, although the separate content-storage fallback test passed. Cloud sync is unsupported. Treat this as a remaining compatibility limitation, not a clean claim for every extension storage context.

Reproduce: npm test; npm run manager:verify; npm run faceit:verify; npm run forecast:verify-installed; npm run manager:verify-installed. Close normal FACEIT before packaged diagnostics or runtime updates.

## FACEIT Ad Cleaner 1.0.0

Fresh ad-cleaner-verification.json records 17 passing checks in Electron 45.2.1 through the actual SDK host and style broker. The offline page reproduces the supplied styled wrapper, Fuse slot attributes, premium placeholder and Google ad iframe. Checks verify zero-height collapse, standalone slots, dynamic insertions and changing class hashes, preservation of ordinary Premium links/match video/queue controls, reapplication after full navigation, stylesheet removal and restoration on disable. The settings page also loads and is disposed properly.

This plugin requests panel and page.styles only. It is packaged separately and disabled by default; the live app was not modified, restarted or reloaded during these checks. Testing proves cosmetic filtering of these patterns, not request blocking or unknown future placements.

## Reviewed Windows integrity preparation (2026-11-04)

84 local Node tests passed. The actual Electron picker fixture passed 13 checks, including native-warning cancellation, integrity-only preparation without archive changes and byte-identical executable restoration. No installed app was changed by these feature tests. The warning defaults to Cancel. Normal patch review remains separate.

## Wand plugin packages (2026-11-04)

Six focused Node/JSDOM checks and ten actual Electron manager checks passed for the standalone SDK notebook and native MV3 planner. Fixture checks include local persistence after disable/re-enable, panel disposal, SDK/native Node isolation, title capture and full-height native settings. This is offline fixture evidence, not live Wand or Chrome-browser validation.

## Legacy native extension API fix (2026-11-04)

Reproduced the exact undefined-loadExtension error using a session with legacy loadExtension/removeExtension methods and no extensions property. The regression now passes through native loading, settings opening and removal, with session method binding preserved. Two further regression tests confirm SDK activation/opening and manager access survive native constructor or session initialization failure. All 93 local tests and 10 actual Electron Wand-plugin fixture checks passed. The installed Wand 12.0.3 runtime was updated only after process checks proved it closed; archive and executable were unchanged. Wand itself was not launched for live validation.

## Companion settings for Node-enabled apps (2026-11-04)

Reproduced Open a supported app window first with the Wand SDK notebook and storage-only native planner under a Node-enabled, context-isolation-disabled fixture. The fallback uses a separate sandboxed companion workspace; page APIs reject both the unsafe app and the unapproved workspace. Page-modifying SDK packages cannot fall back, and stale/unapproved app parents are rechecked. 95 local tests, 10 normal Electron plugin checks and 11 unsafe-parent Electron checks passed. Static Wand main-window evidence was inspected without executing its packaged code. No change to Wand’s renderer preferences or page grants was made.
