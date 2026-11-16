# BridgeKit

**Find Electron apps. Add a controlled plugin system. Restore the original when you want.**

BridgeKit is an Electron app patcher and permission-scoped plugin framework. Its desktop picker scans installed apps, explains compatibility checks, and guides you through page access and reversible patching. FACEIT remains a tested preset; ordinary compatible ASAR apps use data profiles without writing an app-specific adapter.

[App scanner](docs/app-scanner.md) · [General patching](docs/patching-electron.md) · [FACEIT preset](docs/patching-faceit.md) · [Build plugins](docs/plugins.md) · [Known limits](docs/supported-apps.md)

## Start here

Requires Node.js 22+ and npm. See the [installation guides and plugin store](https://babymonie.github.io/bridgekit/).

```powershell
git clone https://github.com/babymonie/bridgekit.git
cd bridgekit
npm ci
npm start
```

Or open **Start-BridgeKit.cmd** after installing dependencies.

The picker scans standard installation locations and Windows install records. Select a result, choose exact app origins or local HTML pages, and use **Review patch**. A final dialog shows the archive, backup, runtime and page access before changes. Fully exit the target app first.

- Search by name or location; filter to candidates and already-patched apps.
- Use **Add folder** / **Choose app file** for portable or custom installs.
- Read blockers for integrity protection, ambiguous executables or unsupported layouts.
- Update BridgeKit or restore the original from the same app detail panel.
- Scanning is read-only and never launches detected apps.

**Candidate means file/fuse checks passed, not that every app or plugin feature has been verified.** Scan limits, inaccessible directories and custom locations are reported; this is not a promise to discover or patch every Electron app.

## What can be patched?

The general engine handles packed JavaScript entry points in standard ASAR layouts, including nested CommonJS and ES modules. Profiles pin the archive and executable hashes. Windows/Linux are the supported generic process-check platforms; macOS bundle patching is inspection-only.

Embedded ASAR integrity protection blocks ordinary patching. On Windows, Review integrity change offers an explicit warning and backed-up fuse change before a separate patch review. This disables tamper validation and invalidates the executable signature. Unpacked apps, oversized archives and unsupported entries are reported. Apps with incompatible window preferences or custom startup assumptions may need source integration or a dedicated adapter.

The Windows FACEIT 2.10.0/2.11.0 hash-checked preset and existing installation/data format are retained. These are inspected historical builds, not a claim about the latest release. See the [support matrix](docs/supported-apps.md).

## Command-line workflow

```powershell
npm run bridgekit
npm run bridgekit -- inspect "C:\Apps\Example"
npm run bridgekit -- setup "C:\Apps\Example" --id example --origin app://desktop
npm run bridgekit -- plan ".bridgekit/profiles/example.json"
npm run bridgekit -- patch ".bridgekit/profiles/example.json"
npm run bridgekit -- restore ".bridgekit/profiles/example.json"
```

For a local renderer use `--local-page renderer/index.html` instead of a web origin. Setup saves a reviewed profile; it does not silently patch the app. Paths may point to an install directory, executable or exact app.asar. Multiple versions require explicit selection.

FACEIT remains available through the same CLI:

```powershell
npm run bridgekit -- patch --preset faceit
npm run bridgekit -- update --preset faceit
npm run bridgekit -- restore --preset faceit
```

Existing faceit:* commands and .cmd helpers still work.

## Plugins inside the patched app

Open the app normally and press **Ctrl+Shift+B** or use its Bridge tray icon.

Install folders/ZIPs, review permissions, then enable packages in the independent manager. Close hides UI; disable stops a plugin and runs cleanup. Some script changes need an explicit page reload after active work is finished.

New generic profiles default to **SDK plugins only** and never automatically enable bundled packages. Partial native Chrome compatibility is an explicit profile option. SDK panels keep sandboxing, context isolation and Node disabled; privileged operations use a sender-authenticated permission broker.

| Example | Scope |
| --- | --- |
| [Hello panel](plugins/hello-panel) | General SDK example: settings, HTML/CSS/scripts |
| [FACEIT Ad Cleaner](plugins/faceit-ad-cleaner) | FACEIT-targeted cosmetic style plugin; not seeded into unrelated apps |

Packages can declare app targets in bridge-plugin.json. Original third-party extensions, app archives and browser profiles are not distributed. See [notices](THIRD_PARTY_NOTICES.md).

## Documentation

- [App scanner and review flow](docs/app-scanner.md)
- [General patching, profiles and rollback](docs/patching-electron.md)
- [FACEIT preset](docs/patching-faceit.md)
- [Support/compatibility matrix](docs/supported-apps.md)
- [Plugins](docs/plugins.md) and [SDK reference](SDK.md)
- [Architecture](docs/architecture.md) and [source integration](docs/adding-an-adapter.md)
- [Testing](docs/testing.md), [troubleshooting](docs/troubleshooting.md) and [roadmap](docs/roadmap.md)
- [Contact/app requests](CONTACT.md), [contributing](CONTRIBUTING.md) and [agent instructions](AGENTS.md)

## Development

```powershell
npm test
npm run picker:verify
npm run patcher:verify
npm run manager:verify
npm run demo
```

Node tests cover scanning, profiles, ownership/rollback, CLI and UI behavior. picker:verify tests the desktop broker/controller against generated fixtures. patcher:verify patches and launches independent CJS/ESM fixtures, tests plugins, updates and restores them. Neither modifies installed user apps. Optional proprietary fixtures explain skips in clean clones.

Original source is [MIT licensed](LICENSE). BridgeKit is independent of the app vendors. The optional reviewed Windows integrity preparation changes the executable and invalidates its signature. BridgeKit does not alter anti-cheat, import authentication databases, or automate account/match actions.

## Wand companion plugins

[Game Notebook and Session Planner](docs/wand-plugins.md) are independent, disabled-by-default packages for the `wand` profile. The SDK notebook saves per-game notes; the Chrome MV3 planner saves session goals and a break deadline. Native mode is required only for the planner. Install their individual folders or ZIPs through Wand’s Bridge manager.
