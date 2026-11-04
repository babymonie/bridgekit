> Historical local integration notes. Third-party packages and machine-specific receipts are not distributed in Git. See [current compatibility](docs/supported-apps.md) and [testing](docs/testing.md).

# FACEIT FORECAST 2.0.2 — Bridge conversion

The earlier Bridge 0.3.0 conversion was installed in FACEIT 2.11.0. The 0.4.0 update was installed and launched for authorized testing on 4 November 2026. In the new manager, use the FORECAST row to enable/disable it or open Settings; Ctrl+Shift+B and the tray reopen the independent manager.

## What was converted

The extension supplied at `Default/Extensions/mpkkcddegpblmobincjkbpgfcbejjbcp/2.0.2_0` is copied into `plugins/faceit-forecast` as a Chrome-compatible Bridge addon. The manifest public key is preserved, so its extension ID remains `mpkkcddegpblmobincjkbpgfcbejjbcp`. The original Chrome installation was not modified.

The original `forecast.js`, `src/background/worker.js`, `src/visual/popup.js`, MAIN-world network hook, configurations and assets are byte-identical. The converted manifest prepends a Bridge storage compatibility script and appends a diagnostic content script. The copy omits Chrome's signed `_metadata` directory. `bridge-plugin.json` records source hashes and the adaptations. No Chrome profile settings, passwords, cookies, tokens or extension-storage databases were read or copied.

This is a Bridge-managed native Chrome compatibility mode, alongside the existing universal SDK. FORECAST was not rewritten as an SDK-only plugin. This preserves its existing logic and service worker rather than rebuilding its statistics features.

## Added Bridge capabilities

| Capability | Implementation |
|---|---|
| MV3 service worker and runtime messaging | Electron native extension support |
| MAIN-world document-start script | Native manifest execution |
| Isolated document-start content script | Native manifest execution |
| Extension resources and original popup | Native chrome-extension URLs and a sandboxed Bridge window |
| Object storage, remove and change events | Native Chrome local storage |
| Sync-storage fallback | Local storage alias; no Chrome or Google cloud synchronization |
| Tab create/get/remove, tab events and windows | electron-chrome-extensions 4.10.0 integrated into Bridge |
| Permission queries and optional requests | Compatibility layer; clipboard writes require a native user decision |
| App-window protection | Extension tab/window removal cannot close FACEIT-owned windows |
| Bridge SDK addon controls | `bridge.addons.list()` and `bridge.addons.open('faceit-forecast')`, requiring `addons.manage` |
| Startup/session lifecycle | Reload addon on each launch; attach it to persistent app sessions; handle a first-load race with one initial page reload |

The popup and addon-created web windows use sandboxing, context isolation, disabled Node integration, and web security. Addon-created web windows accept only HTTP(S) URLs; they cannot open local files or execute system commands. The extension's original page script can inspect and modify FACEIT's page and observe the XHR responses it already observed in Chrome. It does not receive Node.js or Electron objects.

## Historical 0.3.0 verification

- **16 FORECAST checks passed in the installed Electron 45.1.0 runtime.** They cover identity, document-start worlds, original content loading, local sync fallback, popup APIs, Node isolation, the original worker's ADDR_HOSTS response, nested storage, resources, tab lifecycle, app-window protection, permission handling and Bridge popup opening.
- **38 existing Bridge runtime checks passed.**
- The live FACEIT app loaded FORECAST without the earlier sync-storage error. Its original settings popup was opened from Bridge and visually verified, including language, extension status, account and update-history controls.
- The tests use an offline page and mock service responses. They do not prove every live statistic, premium feature, external-service response, authentication flow, clipboard operation, or match automation. No match or account action was performed during verification.

FORECAST uses its own account state in the FACEIT app session. Sign in through FORECAST's own settings if a feature requires it. This conversion does not transfer your Chrome login. The source package is a local-use copy of the supplied extension, not a grant to republish its assets or code.

## Reproduce checks

```powershell
npm test
npm run faceit:verify
npm run forecast:verify-installed
```

Close FACEIT before running packaged diagnostics. Development checks use `npm run forecast:verify`. Reports are `forecast-verification.json` and `verification.json`.

## Dependencies and sources

The compatibility library and its runtime dependencies are bundled under `vendor/` with their license files, so the installed app does not depend on this workspace's node_modules directory.

- [electron-chrome-extensions source and API](https://github.com/samuelmaddock/electron-browser-shell/tree/master/packages/electron-chrome-extensions) — version 4.10.0, MIT.
- [Electron native extension support](https://www.electronjs.org/docs/latest/api/extensions)
- [Electron session preload registration](https://www.electronjs.org/docs/latest/api/session#sesregisterpreloadscriptscript)

## 0.4.0 package and layout changes

The runtime and FACEIT adapter no longer hardcode FORECAST. Generic discovery reads this package's bridge-plugin.json and manifest entry points. Its package metadata preserves the existing converted bundle's first-discovery default; persisted disable/uninstall state takes precedence. The Hello panel demo is independently disabled by default.

Package-owned bridge-settings.css changes the popup container to full window height, removes padding, rounded framing and the orange animated frame, and gives the content its own scroll area. Original FORECAST JavaScript remains unchanged. The manager can unload this package and close its settings independently of other packages.

Fresh 0.4.0 checks include 17 native FORECAST checks and a 19-check manager fixture in FACEIT's packaged Electron runtime. They validate native load/unload, settings closure, persisted disabling and both outer and inner settings height. The normal app's settings were opened and visually inspected; that inspection exposed the inner 200px history cap, which was removed in the package CSS. Automated window capture for this native popup returned UnknownVizError, so no fresh native popup PNG is claimed. The historical runtime checks above must not be counted as validation of the new manager. No Chrome profile credentials or storage were imported.
