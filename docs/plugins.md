# Plugin packages

BridgeKit accepts SDK v1 packages and selected native Chrome MV3 packages. They are registry entries rather than hardcoded host branches.

## SDK package

```text
my-plugin/
  manifest.json
  index.html
  panel.js
  client.js
  client.css
```

```json
{
  "apiVersion": 1,
  "id": "my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "entry": "index.html",
  "permissions": ["panel", "storage.local", "page.scripts", "page.styles"],
  "contentScripts": [{"runAt":"document_end","js":["client.js"],"css":["client.css"]}]
}
```

Use external scripts/styles in index.html; panel CSP restricts inline scripts/network requests. Entries may be nested. Request only capabilities you use. A style-only package can omit page scripts/storage, as [Ad Cleaner](../plugins/faceit-ad-cleaner/manifest.json) does.

| Permission | Purpose |
| --- | --- |
| panel | Required local panel/settings entry |
| storage.local | Small scalar settings per adapter/plugin |
| page.read | Page info and limited DOM snapshots |
| page.dom | Sanitized HTML and controlled DOM changes |
| page.styles | Insert/remove resource-free CSS |
| page.scripts | Bundled client JavaScript in the app document |
| addons.manage | List entries/open enabled settings, not install arbitrary packages |

Methods, limits and examples: [SDK.md](../SDK.md).

## Lifecycle

Each enabled SDK package has an explicit host, channel and isolated page world. Automatic content runs at document_end and after full navigation. CSS matches new SPA elements naturally; scripts must be idempotent and handle dynamic content themselves.

Scripts receive bridgePage.pluginId, a settings snapshot, AbortSignal and onCleanup(fn). Register cleanup for observers, timers, listeners and custom DOM changes. Disabling removes managed CSS/wrappers and disposes the host. Arbitrary edits require cooperative restoration or reload.

Closing settings leaves the plugin enabled. Grants/states persist; uninstall keeps saved settings. Changed fingerprints cannot activate. Reinstall reviewed code instead of editing managed snapshots.

## Install and distribute

Install folder selects the directory containing manifest.json. A ZIP may contain it at root or one enclosing folder. Packages are copied before review and imports start disabled; no npm/package install scripts run.

To package the style plugin with PowerShell:

```powershell
Compress-Archive -Path .\plugins\faceit-ad-cleaner\* -DestinationPath .\faceit-ad-cleaner.zip
```

Use Install ZIP. Share your own source/license. No marketplace or automatic plugin updater exists.

## Native MV3

Supply an extracted extension you are authorized to use. Select extension code/assets only, never browser databases/authentication state. Native content-script paths beginning with / normalize in the managed copy; escapes remain rejected.

The compatibility prefix is added to isolated scripts without changing original JavaScript. MAIN-world entries keep their world. Optional bridge-plugin.json can declare id and `settings: {"css":"relative.css"}` for package-owned layout. Styles are contained and size-checked.

getAll/contains reflect approved API/site grants, including content-script sites and saved optional grants. Already-approved origin requests succeed; unapproved origins are denied. Declared optional clipboardWrite can prompt; general optional-host granting is not implemented.

Consult [compatibility](supported-apps.md#plugin-compatibility). Import can succeed while a required runtime API is unavailable.

## Per-app targets and generic profiles

A bridge-plugin.json sidecar may declare `apps: ["faceit"]`. Non-empty targets restrict bundled discovery and explicit imports to matching app IDs; an omitted/empty list is app-independent. FACEIT Ad Cleaner declares its target. Do not put app-specific selectors in generic hosts.

Generic profiles isolate data under ElectronBridge/apps/<appId>, never auto-enable bundled defaults, and default native Chrome compatibility off. Use a stable unique app ID and SDK-only capabilities where possible. A Chrome package may be listed but fail activation with a clear error when native mode is off.
