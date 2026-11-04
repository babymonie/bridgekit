# Supported apps and compatibility

Electron use alone does not make an app patchable. Each target needs an adapter, approved page boundaries, a compatible runtime, a reversible integration path and exact-build evidence.

## Tested targets

| App/environment | Platform/build | Status |
| --- | --- | --- |
| FACEIT | Windows 2.11.0, recorded archive hash | Working adapter; local SDK/native/manager fixtures and live opening |
| FACEIT | Windows 2.10.0, recorded archive hash | Recognized installer; historical runtime/rollback evidence |
| Offline development bench | Pinned development Electron | Included fixture; no vendor app patched |
| Your own Electron app | You choose runtime/origin | Source integration available; your integration must be tested |

Only the FACEIT installer is shipped. Windows is the supported packaged-app workflow. macOS/Linux third-party patching is not implemented or qualified. See [exact hashes](patching-faceit.md).

## Known Electron apps without BridgeKit adapters

These apps appear in [Electron's official app directory](https://www.electronjs.org/apps), checked 4 November 2026. That establishes Electron use, not BridgeKit compatibility.

| App | BridgeKit status | Next step |
| --- | --- | --- |
| Discord | No adapter; untested | Request exact channel/version/platform |
| Slack | No adapter; untested | Request exact desktop distribution/version |
| Visual Studio Code | No adapter; untested | Prefer supported extensions where suitable |
| Obsidian | No adapter; untested | Prefer its supported plugin API where suitable |
| GitHub Desktop | No adapter; untested | Request exact build and desired feature |
| Figma desktop | No adapter; untested | Identify desktop-specific need and package channel |

Do not point the FACEIT patcher at these apps. Packaging, signing, integrity, windows/sessions and updates differ. BridgeKit does not bypass those mechanisms. Propose support through the [App request form](https://github.com/babymonie/bridgekit/issues/new?template=app-request.yml).

## Plugin compatibility

| Package/path | Established behavior | Limits |
| --- | --- | --- |
| Hello panel SDK example | Settings, HTML/CSS/scripts and cleanup | Demo; disabled by default |
| FACEIT Ad Cleaner | Cosmetic collapse, dynamic content and restore | No network blocking or Premium access |
| User-owned FORECAST 2.0.2 | Content/worker, popup and tested local storage fallback | Not bundled; sync warnings remain; no full live-feature guarantee |
| User-owned Repeek 5.6.18 | Both approved FACEIT origins reported; permission screen removed in fixture | Background webextension-polyfill Proxy error at chrome.management |
| User-owned Leetify uploader 0.6.2 | Root-relative paths import correctly | chrome.offscreen unsupported; upload workflow unverified |

Native support covers selected MV3 workers, messaging, resources, local object storage, popup/options and tabs/windows/permission APIs. Required nativeMessaging/debugger packages are rejected. No Web Store downloader, automatic updater, complete optional-host acquisition, full Chrome emulation or cloud sync is implemented.

Never supply raw Node/Electron as a substitute for a missing API.
