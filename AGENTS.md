# BridgeKit agent instructions

## Scope

BridgeKit is a permission-scoped Electron framework prototype. UI/storage retain Bridge/ElectronBridge names for compatibility. Source version: 0.4.1. FACEIT is the only packaged-app adapter. Do not claim universal patchability or complete Chrome emulation.

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
