# Getting started

The documented FACEIT workflow requires Windows, Node.js 22+, npm and a verified app build. Git/GitHub access is needed for the private repository.

```powershell
git clone https://github.com/babymonie/bridgekit.git
cd bridgekit
npm ci
npm test
npm run demo
```

Run commands in the project folder. npm ci uses the lockfile. The demo opens a separate offline bench/profile and does not patch FACEIT.

## Try a package

Hello panel and Ad Cleaner start disabled. Enable Hello panel after permission review, open Settings and try its saved settings/page widget. Ad Cleaner only affects matching ad markup, so an ordinary demo page may show no difference.

For your package select Install folder on the directory containing manifest.json, or Install ZIP with that manifest at its root/one enclosing folder. Imports are copied and initially disabled. See [plugins](plugins.md).

## Controls

Ctrl+Shift+B in an observed app window or the Bridge tray icon opens management. The icon may be under Windows hidden icons. Search lists SDK/native packages; Settings opens an enabled entry.

Closing hides UI. The switch disables a plugin. Uninstall removes its managed package and keeps saved settings. Removed bundled packages are not silently re-added.

Native MAIN-world hooks and arbitrary mutations may survive until reload. Finish active work first; do not reload a match for setup.

For the real app follow [patching FACEIT](patching-faceit.md). Runtime and plugin installation are separate. Other apps need an adapter; see [supported apps](supported-apps.md).
