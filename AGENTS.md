# BridgeKit agent instructions

## Scope

BridgeKit is a permission-scoped Electron framework prototype. UI/storage retain Bridge/ElectronBridge names for compatibility. Source version: 0.5.0. Generic profiles support compatible packed Electron apps; FACEIT remains a tested legacy preset. Do not claim universal patchability or complete Chrome emulation.

Read README.md, docs/architecture.md and task-relevant guides. Use work/ for temporary assets; do not commit generated receipts/screenshots. The surrounding workspace may require deliverable archives under outputs/.

## Ownership

- registry.cjs: validation, identities, fingerprints, grants, discovery and persisted states.
- package-import.cjs: private snapshots, bounded ZIP extraction and staging.
- normalize-package.cjs / chrome-paths.cjs: changes to copied native packages only. Slash trimming is for native content-script resources, never SDK/filesystem paths.
- plugin-controller.cjs: serialized activation, disabling and uninstall.
- plugin-manager.cjs / manager/: trusted management, sender checks, review/pickers, tray and shortcuts.
- host.cjs / preload.cjs / broker.cjs / page-api.cjs: explicit per-plugin SDK hosts, narrow IPC and parent-bound operations.
- chrome-addons.cjs / chrome-permissions.cjs: partial native integration; report only approved API/site grants including content-script sites and saved optional grants.
- adapters/: app windows/pages only. No plugin products, IDs, popup paths or selectors in generic runtime/adapters.
- plugins/: standalone packages, included examples disabled. FORECAST is local-only and Git-ignored.
- vendor/: runtime dependencies, including nested node_modules and licenses. Preserve them in Git and archives.
- tools/faceit.cjs: exact hashes, backups, staged install/update/rollback and owned-file checks.

Runtime files above are under runtime/.

## Boundaries

Keep sandboxing, context isolation, web security and Node-disabled renderers. Never expose raw IPC, process/filesystem execution or unrestricted Electron. Authenticate exact WebContents/main frame/entry URL. Bind calls to approved pages and grants.

Snapshot imports before review. Never run package installers. Reject traversal, escaping links, identity conflicts, changed fingerprints and unapproved grants. Chrome helper names cannot start with underscore. Correct permission reporting does not prove an unavailable API works.

Closing hides UI and leaves plugins active. Disabling persists, disposes hosts, runs cleanup, closes native settings and unloads packages. MAIN-world hooks/arbitrary changes may require reload. Keep management accessible with all plugins disabled. Loader shortcuts may reopen trusted UI without granting plugins unsafe/Node-enabled page access.

## App/data rules

Never replace archives/runtime while the app runs. Verify it exited. Preserve exact backups and settings. Refuse unknown hashes, changed/unowned files and automatic repatching. Do not weaken fuses/signatures or modify executables/anti-cheat.

Do not import browser databases, cookies, credentials, tokens or authentication state. Do not automate sign-in, matchmaking, invitations, payments or account changes for tests. Never restart/reload active matches. User launch/deployment instructions override suggested checks.

## Verification

npm test must work without proprietary packages/app archives. Explain optional skips. GUI fixtures open windows and respect launch constraints. Installed-runtime diagnostics require a supported installed app to be closed.

Use manager:verify and ad-cleaner:verify for actual offline Electron. Keep Node/JSDOM, desktop, installed-runtime and live evidence distinct. Record versions/counts/skips/limits; older receipts may be historical. Repeek management/polyfill errors, uploader offscreen and native sync contexts remain gaps.

Ad Cleaner uses panel/page.styles only: cosmetic filtering, not request blocking or Premium access. Keep it standalone.

## Repository hygiene

Do not commit copied third-party extensions, app archives, browser profiles, private logs, credentials, machine paths or user screenshots. Ignore root node_modules only; vendor nested dependencies are required. Preserve licenses and update THIRD_PARTY_NOTICES.md.

Keep README, SDK and docs current. Supported means exact-build evidence, not Electron use alone. Requests use issue forms; private issues need collaborator access.

## General app patcher (0.5)

patcher/ is the standalone trusted desktop app picker, separate from each patched app's plugin manager. Scanner results are candidates, not vendor compatibility guarantees. The worker checks standard install roots/records, probes known layouts before bounded breadth-first search, skips profile/cache/link locations, and reports scan limits/errors. Never launch detected apps while scanning.

tools/app-inspection.cjs reads hashes/main entry/fuses; tools/patch-engine.cjs owns profile plans, stopped-app checks, locks, backups, staged sidecars, inventory and restore. tools/native-fs.cjs is required for raw ASAR operations inside Electron; virtualized node:fs must not treat a target archive as an app directory. @electron/fuses is read-only here: never call flipFuses. Unknown/protected states block patching.

runtime/app-profile.cjs scopes exact HTTP/custom origins and selected local pages. adapters/generic.cjs defaults native Chrome mode and bundled auto-enable off, with data under ElectronBridge/apps/<id>. Explicit apps metadata keeps FACEIT-specific bundles out of other apps. FACEIT preset preserves its existing paths/receipts/data and does not silently migrate installs.

Use npm run picker:verify for desktop IPC/scan/review/mutation fixtures and npm run patcher:verify for generated CJS/ESM launch/plugin/update/restore tests. They must never patch installed user apps. Close the standalone picker first for launch tests: a shared development Electron executable conservatively counts as running. GUI app startup is npm start / Start-BridgeKit.cmd; npm run demo remains the offline plugin bench.
