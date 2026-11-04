# Third-party notices

Original BridgeKit source is MIT licensed. This does not relicense dependencies, applications or imported extensions.

## Vendored runtime dependencies

| Dependency | Version | License |
| --- | --- | --- |
| adm-zip | 0.6.1 | [MIT](vendor/adm-zip/LICENSE) |
| electron-chrome-extensions | 4.10.0 | [MIT](vendor/electron-chrome-extensions/LICENSE.md) |
| debug | 4.4.3 | [MIT](vendor/electron-chrome-extensions/node_modules/debug/LICENSE) |
| ms | 2.1.3 | [MIT](vendor/electron-chrome-extensions/node_modules/ms/license.md) |

Retain original copyright/permission notices. The compatibility library includes local integration/permission adjustments. Runtime packages use vendor/, including nested node_modules. npm development dependencies retain their licenses.

## User-supplied artifacts

FORECAST, Repeek, the Leetify uploader, FACEIT archives/executables/native components and browser profiles are not distributed. Historical docs discuss local versions; that does not grant redistribution rights or establish full compatibility.

The local FORECAST fixture is Git-ignored; its tests skip without it. Obtain packages through authorized sources and respect their terms. Never bundle authentication storage or other profile data with extension code.
