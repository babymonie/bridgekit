# BridgeKit

**Permission-scoped plugins for Electron apps.**

BridgeKit provides a plugin manager, an SDK for extending app pages, and a partial Chrome Manifest V3 compatibility layer. FACEIT is the first tested adapter. This is an experimental framework with a working local manager; other apps need a reviewed adapter.

[Get started](docs/getting-started.md) · [Patch FACEIT](docs/patching-faceit.md) · [Supported apps](docs/supported-apps.md) · [Build a plugin](docs/plugins.md) · [Request an app](https://github.com/babymonie/bridgekit/issues/new?template=app-request.yml)

## Features

- Discover and install local plugin folders or ZIPs.
- List, search, enable, disable, configure and uninstall plugins.
- Persist approved permissions, enabled states and SDK settings.
- Extend supported pages with approved HTML, CSS and client-side JavaScript.
- Keep Node.js, process/filesystem access and raw Electron APIs out of plugin renderers.
- Reopen the independent manager with **Ctrl+Shift+B** or its tray icon. The UI currently says **Bridge**.
- Patch known FACEIT archives reversibly, retaining an exact original backup.

The native Chrome layer implements selected APIs. Installing an extension or reporting permissions correctly does not prove every feature works. See [compatibility](docs/supported-apps.md#plugin-compatibility).

## Try locally

The documented FACEIT workflow requires Windows and Node.js 22+.

```powershell
git clone https://github.com/babymonie/bridgekit.git
cd bridgekit
npm ci
npm test
npm run demo
```

This repository is private: GitHub access is needed to clone it or open issues. The demo uses a separate offline bench/profile and does not patch FACEIT. Bundled examples start disabled.

## Install into FACEIT

Fully exit FACEIT, including its tray process. From the project directory:

```powershell
npm run faceit:status
npm run faceit:install
```

Open FACEIT normally, then press **Ctrl+Shift+B**. For an existing installation use `npm run faceit:update` while closed. To restore the original archive use `npm run faceit:uninstall` while closed.

Only the explicitly verified Windows FACEIT **2.10.0** and **2.11.0** archive hashes are accepted. The 2.11.0 integration was tested locally; 2.10.0 has historical verification. This is not a claim about the latest release or a recommendation to downgrade. Unknown builds are refused. Read [patching and rollback](docs/patching-faceit.md).

## Install a plugin

1. Open Bridge and choose **Install folder** or **Install ZIP**.
2. Select a package containing manifest.json and review requested access.
3. Enable the plugin. New imports are initially disabled.
4. Use **Settings** to open its page; disable it to stop its host and run cleanup.

The manager indicates reload requirements. Finish active work/matches before reloading. Closing settings/manager only hides UI; it does not disable a plugin.

| Included example | Demonstrates | Default |
| --- | --- | --- |
| [Hello panel](plugins/hello-panel) | Saved settings, HTML, CSS and page code | Disabled |
| [FACEIT Ad Cleaner](plugins/faceit-ad-cleaner) | Style-only removal of visible ads and their space | Disabled |

FORECAST, Repeek, the Leetify uploader, browser profiles and app archives are **not distributed here**. Optional diagnostics accept user-supplied packages. See [third-party notices](THIRD_PARTY_NOTICES.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Getting started](docs/getting-started.md) | Setup, demo, everyday controls |
| [Patching FACEIT](docs/patching-faceit.md) | Install, update, verify, rollback and data |
| [Supported apps](docs/supported-apps.md) | Tested builds, unsupported apps, Chrome limits |
| [Plugins](docs/plugins.md) and [SDK](SDK.md) | Packages, permissions, page APIs and lifecycle |
| [Architecture](docs/architecture.md) | Registry, manager, brokers and native layer |
| [Adding an adapter](docs/adding-an-adapter.md) | Source integration and packaged-build qualification |
| [Testing](docs/testing.md) | Clean-clone tests and evidence |
| [Troubleshooting](docs/troubleshooting.md) | Imports, permissions, updates and known gaps |
| [Roadmap](docs/roadmap.md) | Current scope and remaining work |
| [Contact](CONTACT.md) | App/plugin requests and maintainer |

## Security

SDK panels use sandboxing, context isolation and disabled Node integration. Privileged calls use a sender-authenticated permission broker. Page scripts have separate isolated worlds, but approved scripts can read/change browser-visible app data. Native compatibility does not reproduce every Chrome security/permission mechanism.

BridgeKit does not bypass integrity fuses, modify anti-cheat, import authentication databases or automate matches. Disabling runs cleanup; arbitrary page edits and MAIN-world hooks may need reload. See [security model](docs/security.md).

## Development

```powershell
npm test
npm run manager:verify
npm run ad-cleaner:verify
```

The first command runs Node/JSDOM checks. The others open isolated Electron fixtures. Optional checks explain skips when user-owned packages/app archives are absent. CI runs the clean-clone Node suite; installed-runtime/live evidence is separate. See [testing](docs/testing.md), [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).

## License

Original source is [MIT licensed](LICENSE). Dependencies retain their notices. Imported extensions/app assets are not covered. BridgeKit is independent and not endorsed by FACEIT or other listed vendors.
