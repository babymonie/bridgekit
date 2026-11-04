# App scanner

Run `npm start` or Start-BridgeKit.cmd. The desktop picker automatically scans installed apps.

## Coverage

On Windows it reads standard LocalAppData/Program Files locations and per-user/system uninstall records. On Linux it checks common /opt, /usr/lib, /usr/share and user-local locations. macOS applications can be inspected, but bundle patching is blocked.

Known resource layouts are probed before a bounded breadth-first search, so one large SDK/game directory does not consume the entire search before other registered apps are checked. Scans skip browser/profile/cache folders, node_modules and links. They have entry/depth limits and report permission errors and partial coverage. Portable/custom apps may need Add folder or Choose app file.

All discovery is read-only. Detected binaries are inspected, never executed.

## Result meanings

| Label | Meaning |
| --- | --- |
| Candidate | A packed entry and readable Electron fuse state were found, without an observed blocker. Runtime behavior is still unverified. |
| BridgeKit installed | A matching installation/receipt was detected. Ownership and app-closed checks run again before mutation. |
| Blocked | The detail panel explains the detected problem. |

Different app versions are separate entries. The filter can hide blocked results. Use Choose executable if the app has multiple launchers; common update helpers are excluded automatically.

## Review and patch

1. Select an app.
2. For a generic profile, choose a unique app ID, exact origins (such as https://app.example.com or app://desktop), and/or specific local HTML pages.
3. Leave native Chrome compatibility off unless needed. SDK plugins work independently of it.
4. Fully exit the selected app.
5. Review the exact target, backup, runtime and access in the confirmation dialog.
6. Apply, then reopen the app normally. Ctrl+Shift+B opens its plugin manager.

No page access is guessed automatically. A read-only scan cannot establish runtime preferences or every startup assumption. The generated-fixture tests establish the engine's CJS/ESM path, not universal third-party compatibility.

Installed generic profiles are stored inside the owned sidecar and exported under `%APPDATA%/ElectronBridge/patcher/profiles/` by the desktop tool. The CLI instead saves under .bridgekit/profiles by default. Machine profiles are not committed.

## Update / restore

Select an installed entry to update BridgeKit or restore original app bytes. The target must be stopped. Runtime ownership, original backup and archive hashes are checked again; changed/unowned files are refused. Saved plugin settings remain.

FACEIT uses its existing preset, directories and data format, rather than being migrated into a generic installation. No app is automatically repatched after a vendor update.
