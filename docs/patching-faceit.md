# Patching FACEIT

The Windows installer accepts these original app.asar SHA-256 values:

| Build | Original SHA-256 | Evidence |
| --- | --- | --- |
| 2.10.0 | `9978364f76a77da79d632fd90511a54f25d5b3dcf811d32766a0327dfd2d060c` | Historical runtime/rollback |
| 2.11.0 | `e9db0b789b237733592698166c1355966a15044acf78464b771fb4695f787c12` | Local SDK/native/manager and live opening |

These are inspected historical builds, not a claim about the latest release or a recommendation to downgrade. Different hashes are refused even with a matching version label.

## Install

Run npm ci. Fully exit FACEIT including its tray process; finish matches first. Do not use this installer on another app, Store layout or unknown build.

```powershell
npm run faceit:status
npm run faceit:install
```

Open FACEIT normally, then Ctrl+Shift+B. The UI says Bridge. Included examples default disabled. Supply third-party packages separately.

Install-FACEIT.cmd, Update-FACEIT.cmd and Uninstall-FACEIT.cmd provide equivalent actions. Start-Demo.cmd opens the offline bench.

## What changes

Default root: `%LOCALAPPDATA%/FACEIT`. Preflight selects an existing known version, verifies its hash and requires the target executable stopped.

The installer saves resources/app.asar.bridge-original, adds a bootstrap/changes package entry metadata, then creates resources/bridge-runtime. Existing packed members other than package metadata remain byte-identical, including main.js. Executables, fuses, native modules and anti-cheat are not patched.

The receipt records hashes. Startup rechecks the archive: if changed, Bridge stays disabled and the original app starts. New versions are not automatically repatched.

## Update

```powershell
npm run faceit:update
```

Run closed. Owned runtime files are staged/replaced, preserving the archive, backup and settings. Changed/unowned files are refused. Imported plugin snapshots are not automatically updated; manage those separately.

## Verify and restore

With FACEIT closed:

```powershell
npm run faceit:verify
npm run manager:verify-installed
```

These run offline diagnostic modes inside the packaged executable, not a live match. Optional native phases need user-owned packages; see [testing](testing.md).

To restore the original:

```powershell
npm run faceit:uninstall
```

This validates archive/backup/receipt/owned files, restores the exact original and removes its runtime. Registry/settings remain. On refusal preserve everything and inspect the discrepancy; do not force-delete unknown data or overwrite the only backup.

## Custom root

Arguments: operation, FACEIT root, optional known version.

```powershell
node tools/faceit.cjs status "D:\Apps\FACEIT" 2.11.0
node tools/faceit.cjs install "D:\Apps\FACEIT" 2.11.0
```

The root contains app-2.11.0, not resources directly. Hash checks remain. Diagnostic launchers generally use the default root unless documented otherwise.

## Data

`%APPDATA%/ElectronBridge/faceit/` contains registry.json, plugins/<id>/ snapshots and settings/<id>.json SDK settings. Native storage belongs to the app session. Browser sign-in databases are not imported. Do not post those folders or private logs to issues.
