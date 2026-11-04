# Supported layouts and apps

BridgeKit 0.5 uses a general app scanner/profile/patch engine. FACEIT is a tested preset rather than the definition of the platform.

## General engine

| Layout/capability | Status |
| --- | --- |
| Packed ASAR, nested CommonJS .cjs/.js | Implemented; generated app launch/plugin/update/rollback tested |
| Packed ASAR, ESM .mjs or type module | Implemented with awaited original entry; generated app tested |
| Exact HTTP(S)/custom-protocol origins | Explicit profile policy |
| Selected local HTML pages | Exact contained file policy |
| Ephemeral sessions with SDK plugins | Tested with native compatibility disabled |
| Unpacked app or external/unpacked main | Not archive-patchable; use source integration |
| Embedded ASAR integrity enabled | Blocked; fuses are not changed |
| Unknown executable/fuse state | Blocked pending correct executable/inspection |
| macOS signed bundles | Inspection-only; patching unsupported |
| Archives over 512 MiB | Refused by this version |

Static checks establish candidates, not full app/runtime compatibility. Windows/Linux generic process checks are implemented. App preferences must still allow Node-disabled, context-isolated pages for SDK attachment.

## FACEIT preset

The known Windows 2.10.0 and 2.11.0 original hashes remain supported through the existing installer format. 2.11.0 has local SDK/native/manager/live-opening evidence; 2.10.0 has historical rollback/runtime evidence. These are not claims about the latest release. See [hashes and instructions](patching-faceit.md).

## Other Electron apps

Discord, Slack, Visual Studio Code, Obsidian, GitHub Desktop and Figma appear in [Electron's official directory](https://www.electronjs.org/apps), checked 4 November 2026. No universal per-product guarantee follows. The scanner checks installed builds directly: some are packed candidates, some unpacked, some integrity-protected.

Use a generic reviewed profile where eligible. Apps with unusual startup/window behavior may need dedicated integration; prefer an app's supported plugin API where suitable. Do not relabel a scanned candidate as a fully tested vendor integration.

## Plugin compatibility

| Package/path | Established | Limits |
| --- | --- | --- |
| Hello panel | General SDK settings, page APIs and cleanup | Demo, disabled by default |
| FACEIT Ad Cleaner | FACEIT-targeted cosmetic collapse/restore | No request blocking/Premium |
| User-owned FORECAST 2.0.2 | Selected native content/worker/popup/storage fixture | Not distributed; sync warnings remain |
| User-owned Repeek 5.6.18 | Approved site reporting and permission screen fix | Background management/polyfill error remains |
| User-owned uploader 0.6.2 | Root-relative resource import | offscreen API unsupported |

Generic profiles default native Chrome mode off. Optional native mode implements only selected MV3 workers, resources, messaging, storage and tabs/windows/permission paths. No complete Chrome emulation, Web Store downloader, automatic updater or cloud sync is promised.
