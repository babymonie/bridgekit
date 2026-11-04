# Wand companion plugins

Two independent packages demonstrate useful SDK and native Chrome workflows. Neither is hardcoded into the runtime. Both are disabled by default and targeted to the generic `wand` profile ID. They do not access game processes, trainers, paid features or account credentials.

| Plugin | Format | Features | Permissions |
| --- | --- | --- | --- |
| Wand Game Notebook | Bridge SDK v1 | Eight per-game notes; current-page-title suggestion; local persistence | panel, storage.local, page.read |
| Wand Session Planner | Chrome MV3 | Five goals, saved checklist, persistent break deadline | storage only |

## Install in Wand

1. In the BridgeKit patcher, use a stable app ID of `wand` for Wand. Select the actual Electron executable, not a launcher. For an existing install, keep its original ID; these packages will reject a different ID. Supporting another ID requires changing each source sidecar’s apps list before importing a fresh reviewed package.
2. Choose the Wand page origins/local HTML pages explicitly. Game Notebook’s title button can read only those approved pages. There is no inferred game detection.
3. For Session Planner, enable **partial Chrome extension compatibility** in the reviewed Wand profile. This requires a persistent app session. On an existing BridgeKit installation, review **Update BridgeKit…** with that option enabled, while Wand is closed, then reopen Wand yourself. The SDK notebook needs no native mode.
4. Open Wand’s Bridge plugin manager with Ctrl+Shift+B. Use **Install ZIP** with the supplied ZIP or **Install folder** with the individual manifest directory. Review the permissions. Imports start disabled.
5. Enable each package and open its **Settings**. Their settings fill the available window and scroll vertically. Use the manager to disable or uninstall them.

If `wand` is not your existing profile ID, do not rename the profile just to import plugins: that changes the data namespace. Adapt the standalone sidecars instead. Source/runtime updates may require BridgeKit’s reviewed update to make newly bundled packages available; importing their ZIPs works independently of bundled discovery.

## Behavior and limits

Game Notebook stores scalar records through the SDK broker, with eight slots and bounded note lengths that fit its storage quotas. Use Save before switching games. A captured page title may be Wand’s app title rather than the current game: edit it manually. Note deletion asks for a second click. No DOM changes or client scripts are requested.

Session Planner uses only native chrome.storage.local. The timer persists a deadline rather than relying on a background interval. When the panel is closed, there is no visible or system reminder; reopening shows the remaining time or Time for a break. Saving goals replaces the checklist. It does not launch/pause games or modify Wand’s app HTML.

Both packages work locally with no analytics or external requests. They are original MIT-licensed code, not Chrome Store downloads. The Chrome package can also be loaded unpacked in Chrome; separate app/browser sessions have separate data.

## Evidence

`node --test tests/wand-plugins.test.cjs` covers package discovery/permissions, notebook save/reopen/delete, errors and unsaved edits, escaped rendering, planner persistence, deadlines and validation. `npm run wand:verify` loads both original packages through the real BridgeKit manager in a temporary offline Electron fixture, exercises persistence after disabling/re-enabling, checks Node isolation and full-height settings. It does not launch or patch Wand. Live Wand 12.0.3 compatibility and Chrome-browser UI have not been exercised by this verification.

## Wand 12.0.3 uses companion settings mode

Static inspection of Wand 12.0.3’s packaged main-window setup found Node integration enabled and context isolation disabled. BridgeKit refuses to inject SDK content or attach native page integrations to that renderer. Changing Wand’s renderer preferences is not part of this integration.

Local tools can instead open settings under a hidden, sandboxed Bridge-owned workspace with a separate persistent companion session. Game Notebook and Session Planner work there. Notebook’s title button reads the title/URL of an approved Wand window through the main-process metadata broker, without renderer code execution or DOM access. You may still edit the suggested game name. This workspace never grants access to Wand’s renderer. Its native storage is separate from an earlier app-session installation; no automatic data migration is performed.

The fallback accepts SDK panels without content scripts, DOM/style/script or addon-management permissions, and Chrome packages with only storage permission and no host access/content scripts. Page-modifying extensions still require a supported app window. Tests can reproduce this layout with `node tools/verify-wand-plugins.cjs --unsafe-parent` (12 actual Electron checks). This remains fixture evidence; the user launches Wand for live validation.
